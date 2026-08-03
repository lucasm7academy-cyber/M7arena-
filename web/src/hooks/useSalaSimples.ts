// src/hooks/useSalaSimples.ts
// ✅ FASE 1 — CLIENTE PURO DE LEITURA
//
// A máquina de estados da sala roda INTEIRA no servidor (RPCs `sala_*`).
// Este hook faz apenas três coisas:
//   1. lê o estado (carga inicial + Realtime + re-sync ao voltar do alt+tab);
//   2. deriva timers de apresentação a partir dos timestamps do servidor;
//   3. dispara RPCs (entrar / sair / confirmar / recusar / tick).
//
// ⚠️ NÃO existe mais nenhuma decisão de transição aqui. Nada de locks locais
// (`transicionandoRef` & cia) — 10 clientes não competem mais pela mesma linha.

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { useSalaRealtime } from './useSalaRealtime';
import {
    buscarsalas,
    buscarJogadores,
    entrarNaVaga,
    confirmarPresenca,
    recusarPresenca,
    sairDaVaga,
    tickSala,
    traduzirErroSala,
    registrarVoto,
    buscarVotos,
    encerrarSala,
} from '../api/salamod1';

const IS_DEV = import.meta.env.DEV;

// Tick preguiçoso: intervalo de reenvio enquanto o prazo continuar vencido
// sem o servidor ter avançado o estado.
const TICK_RETRY_MS = 3000;
// Janela mínima entre dois ticks para a MESMA deadline (anti-loop).
const TICK_DEBOUNCE_MS = 2500;

/**
 * Erros de elegibilidade que viram MODAL (design v3 §2.1/§11), nunca mensagem
 * genérica. `faltam` vem de `saldo_insuficiente`; `salaNum` de
 * `ja_em_sala_apostada`; `liberadoEm` de `suspenso_por_strikes`/`conta_suspensa`.
 */
export type ErroElegibilidade =
  | { tipo: 'saldo'; faltam: number }
  | { tipo: 'outra_sala'; salaNum: number }
  | { tipo: 'riot_id' }
  | { tipo: 'termos' }
  | { tipo: 'suspenso'; liberadoEm: string | null }
  | { tipo: 'banida' }
  | null;

export function useSalaSimples(
    salaId: number,
    usuarioAtual: {
        id: string;
        nome: string;
        tag: string;
        elo: string;
        avatar?: string;
    }
) {
    const [sala, setSala] = useState<any>(null);
    const [jogadores, setJogadores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [, setTimerTick] = useState(0); // força re-render dos timers derivados
    const [tabFocusTick, setTabFocusTick] = useState(0); // reinicia timers ao voltar do alt+tab

    const [codigoPartida, setCodigoPartida] = useState<string | null>(null);
    const [meuVoto, setMeuVoto] = useState<string | null>(null);
    const [votos, setVotos] = useState<any[]>([]);
    const [timerFinalizacao, setTimerFinalizacao] = useState(180);
    const [mostrarMensagem, setMostrarMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);
    const [erroElegibilidade, setErroElegibilidade] = useState<ErroElegibilidade>(null);
    const [kickTick, setKickTick] = useState(0); // re-render periódico do aviso de ociosidade

    // ── Refs (apenas UI/anti-clique-duplo — NADA de coordenação de estado) ──
    const timerFinRef = useRef<NodeJS.Timeout | null>(null);
    const mensagemTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const entrandoRef = useRef(false);
    const saindoRef = useRef(false);
    const confirmandoRef = useRef(false);
    const carregandoVotosRef = useRef(false);
    const ultimoEstadoRef = useRef<string>('');
    const tickRef = useRef<{ chave: string; ts: number } | null>(null);
    const tickEmVooRef = useRef(false);
    const jogadoresRef = useRef<any[]>([]);
    // Timestamp da última saída VOLUNTÁRIA: o realtime que chega logo depois
    // não pode virar o aviso de "removido por ociosidade".
    const saiuProprioRef = useRef(0);

    // ── TIMERS DERIVADOS (apresentação; a decisão é do servidor) ──────
    const timer = sala?.confirmacao_expires_at
        ? Math.max(0, Math.round((new Date(sala.confirmacao_expires_at).getTime() - Date.now()) / 1000))
        : 60;

    const timerIniciandoPartida = sala?.iniciando_partida_at
        ? Math.max(0, Math.round((new Date(sala.iniciando_partida_at).getTime() + 30000 - Date.now()) / 1000))
        : 30;

    // ── MENSAGEM TRANSITÓRIA ─────────────────────────
    // ⚠️ Erros de ação vão para `mostrarMensagem`, NUNCA para `erro`:
    // `erro` derruba a página inteira em SalaMod1 (`if (erro || !sala)`),
    // então ele fica reservado para falhas fatais de carregamento.
    const mostrar = useCallback((tipo: 'erro' | 'sucesso', texto: string) => {
        setMostrarMensagem({ tipo, texto });
        if (mensagemTimeoutRef.current) clearTimeout(mensagemTimeoutRef.current);
        mensagemTimeoutRef.current = setTimeout(() => setMostrarMensagem(null), 4000);
    }, []);

    // ── SINCRONIZAÇÃO COM O SERVIDOR ─────────────────
    const sincronizarJogadores = useCallback(async () => {
        const dados = await buscarJogadores(salaId);
        setJogadores(dados);
        jogadoresRef.current = dados;
        return dados;
    }, [salaId]);

    const sincronizarTudo = useCallback(async (motivo: string) => {
        const [dadosSala, dadosJogadores] = await Promise.all([
            buscarsalas(salaId),
            buscarJogadores(salaId),
        ]);
        if (!dadosSala) return null;

        setSala(dadosSala);
        setCodigoPartida(dadosSala.codigo_partida || null);
        setJogadores(dadosJogadores);
        jogadoresRef.current = dadosJogadores;
        ultimoEstadoRef.current = dadosSala.estado;

        if (IS_DEV) {
            console.log(`🔄 [Sync:${motivo}] estado=${dadosSala.estado}, jogadores=${dadosJogadores.length}`);
        }
        return dadosSala;
    }, [salaId]);

    // ── TICK PREGUIÇOSO ──────────────────────────────
    // Quando o timer derivado zera e o servidor ainda não avançou, pedimos a
    // reavaliação. É idempotente: se os 10 clientes chamarem, o lock do
    // servidor resolve. A `chave` (estado + deadline) garante 1 disparo por
    // prazo; o debounce garante que re-renders não viram enxurrada.
    const dispararTick = useCallback(async (chave: string) => {
        if (tickEmVooRef.current) return;

        const agora = Date.now();
        const anterior = tickRef.current;
        if (anterior && anterior.chave === chave && agora - anterior.ts < TICK_DEBOUNCE_MS) return;

        tickRef.current = { chave, ts: agora };
        tickEmVooRef.current = true;
        try {
            if (IS_DEV) console.log(`⏱️ [Tick] sala_tick(${salaId}) — ${chave}`);
            const r = await tickSala(salaId);
            if (IS_DEV) console.log(`⏱️ [Tick] ok=${r.ok} estado=${r.estado} mudou=${r.mudou}`);

            // Realtime normalmente entrega a mudança; sincronizamos só quando o
            // servidor confirma que algo mudou (ou divergiu do que temos).
            if (r.mudou || (r.estado && r.estado !== ultimoEstadoRef.current)) {
                await sincronizarTudo('tick');
            }
        } finally {
            tickEmVooRef.current = false;
        }
    }, [salaId, sincronizarTudo]);

    // ── LIMPAR TIMERS AO DESMONTAR ────────────────────
    // ⚠️ NÃO remove jogador ao desmontar — quem decide isso é o servidor.
    useEffect(() => {
        return () => {
            if (timerFinRef.current) clearInterval(timerFinRef.current);
            if (mensagemTimeoutRef.current) clearTimeout(mensagemTimeoutRef.current);
        };
    }, []);

    // ── CARREGAR DADOS INICIAIS ──────────────────────
    useEffect(() => {
        let mounted = true;
        async function carregar() {
            const dadosSala = await buscarsalas(salaId);
            if (!mounted) return;
            if (!dadosSala) {
                setErro('Sala não encontrada');
                setLoading(false);
                return;
            }
            setSala(dadosSala);
            setCodigoPartida(dadosSala.codigo_partida || null);
            ultimoEstadoRef.current = dadosSala.estado;

            const dadosJogadores = await buscarJogadores(salaId);
            if (!mounted) return;

            setJogadores(dadosJogadores);
            jogadoresRef.current = dadosJogadores;
            if (IS_DEV) console.log(`📥 [Initial Load] estado=${dadosSala.estado}, ${dadosJogadores.length} jogadores`);
            setLoading(false);
        }
        carregar();
        return () => { mounted = false; };
    }, [salaId]);

    // ── RECARREGAR DADOS QUANDO ABA VOLTA DO ALT+TAB ─
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;

            if (IS_DEV) console.log(`👁️ [Aba] Voltou para visível, sincronizando...`);
            tickRef.current = null; // libera o tick para o prazo atual
            sincronizarTudo('visibilidade').then(() => {
                setTabFocusTick(prev => prev + 1); // recria o loop de timers
            });
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [sincronizarTudo]);

    // ── REALTIME ─────────────────────────────────────
    // O socket próprio (P4) só avisa "a sala mudou"; o estado completo vem do
    // GET /api/matches/:id (que revalida permissão no servidor). Substitui o
    // supabase.channel (ADR-009): as mensagens de transição de estado passam a
    // ser derivadas comparando o estado antes/depois do refetch.
    useSalaRealtime(salaId, {
        onUpdate: async () => {
            const estadoAnterior = ultimoEstadoRef.current;
            const tinhaEu = jogadoresRef.current.some((j: any) => j.user_id === usuarioAtual.id);
            const dadosSala = await sincronizarTudo('realtime');
            if (!dadosSala) return;
            const novoEstado = dadosSala.estado;

            // Kick por ociosidade (design v3 §8): minha vaga sumiu sem eu ter
            // saído e a sala CONTINUA em `preenchendo` → aviso do strike na hora
            // (design v3 §11). Remoção por timeout de confirmação (confirmacao→
            // preenchendo) NÃO gera strike e já tem a própria mensagem abaixo.
            const saiuHagora = Date.now() - saiuProprioRef.current < 5000;
            const tinhaEuAgora = jogadoresRef.current.some((j: any) => j.user_id === usuarioAtual.id);
            if (tinhaEu && !saiuHagora && !tinhaEuAgora && estadoAnterior === 'preenchendo' && novoEstado === 'preenchendo') {
                mostrar('erro', 'Você foi removido da vaga por ociosidade — strike registrado.');
            }

            if (novoEstado === estadoAnterior) return;

            if (IS_DEV) console.log(`📡 [Realtime] Sala ${salaId}: ${estadoAnterior} → ${novoEstado}`);
            tickRef.current = null; // o servidor avançou: prazo antigo não interessa mais

            if (estadoAnterior === 'confirmacao' && novoEstado === 'preenchendo') {
                mostrar('erro', 'Confirmação cancelada — sala reaberta');
            } else if (novoEstado === 'cancelada') {
                mostrar('erro', 'Partida cancelada');
            }
        },
        onReconnect: () => {
            if (IS_DEV) console.log(`🔌 [Realtime] Reconectado — refazendo GET da sala ${salaId}`);
            sincronizarTudo('reconexao');
        },
    });

    // ── LOOP DE RE-RENDER DOS TIMERS DERIVADOS ────────
    // ⚡ requestAnimationFrame: pausa sozinho quando a aba vai para background.
    const estadoComTimer = sala?.estado === 'confirmacao' || sala?.estado === 'iniciando_partida';
    useEffect(() => {
        if (!estadoComTimer) return;

        let rafId: number;
        let ultimo = 0;
        const loop = (agora: number) => {
            if (agora - ultimo >= 100) { // ~10fps, mesma cadência visual de antes
                ultimo = agora;
                setTimerTick(prev => prev + 1);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(rafId);
    }, [estadoComTimer, sala?.confirmacao_expires_at, sala?.iniciando_partida_at, tabFocusTick]);

    // ── DISPARO DO TICK QUANDO O PRAZO VENCE ──────────
    const timerZerado = timer <= 0;
    const timerIniciandoZerado = timerIniciandoPartida <= 0;
    useEffect(() => {
        if (!sala) return;

        let chave: string | null = null;
        if (sala.estado === 'confirmacao' && sala.confirmacao_expires_at && timerZerado) {
            chave = `confirmacao:${sala.confirmacao_expires_at}`;
        } else if (sala.estado === 'iniciando_partida' && sala.iniciando_partida_at && timerIniciandoZerado) {
            chave = `iniciando_partida:${sala.iniciando_partida_at}`;
        }
        if (!chave) return;

        const alvo = chave;
        dispararTick(alvo);

        // Reenvio espaçado enquanto o prazo continuar vencido. O efeito é
        // desmontado assim que o Realtime traz o novo estado.
        const id = setInterval(() => dispararTick(alvo), TICK_RETRY_MS);
        return () => clearInterval(id);
    }, [
        sala?.estado,
        sala?.confirmacao_expires_at,
        sala?.iniciando_partida_at,
        timerZerado,
        timerIniciandoZerado,
        dispararTick,
    ]);

    // ── CARREGAR VOTOS AO ENTRAR EM FINALIZAÇÃO ───────
    useEffect(() => {
        if (sala?.estado !== 'finalizacao') return;
        if (votos.length > 0) return;
        carregarVotos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sala?.estado, votos.length]);

    // ── TIMER DE FINALIZAÇÃO ──────────────────────────
    // ⚠️ FASE 2: a apuração de votos ainda é decidida no cliente.
    useEffect(() => {
        if (sala?.estado !== 'finalizacao') {
            setTimerFinalizacao(180);
            return;
        }

        const is1v1 = sala?.modo === '1v1';

        if (is1v1) {
            // 1v1: 2 votos para o mesmo lado (1 de cada jogador)
            const votosA = votos.filter(v => v.opcao === 'time_a').length;
            const votosB = votos.filter(v => v.opcao === 'time_b').length;

            if (votosA >= 2) { encerrarPartida('A'); return; }
            if (votosB >= 2) { encerrarPartida('B'); return; }
        } else {
            // 5v5/ARAM/Time vs Time: 2 votos de time A + 2 de time B para o mesmo lado
            const votosATimeA = votos.filter(v => v.opcao === 'time_a' && v.is_time_a === true).length;
            const votosATimeB = votos.filter(v => v.opcao === 'time_a' && v.is_time_a === false).length;
            const votosBTimeA = votos.filter(v => v.opcao === 'time_b' && v.is_time_a === true).length;
            const votosBTimeB = votos.filter(v => v.opcao === 'time_b' && v.is_time_a === false).length;

            if (votosATimeA >= 2 && votosATimeB >= 2) { encerrarPartida('A'); return; }
            if (votosBTimeA >= 2 && votosBTimeB >= 2) { encerrarPartida('B'); return; }
        }

        if (!timerFinRef.current) {
            timerFinRef.current = setInterval(() => {
                setTimerFinalizacao(prev => {
                    if (prev <= 1) {
                        if (timerFinRef.current) {
                            clearInterval(timerFinRef.current);
                            timerFinRef.current = null;
                        }
                        encerrarPartida('empate');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerFinRef.current) {
                clearInterval(timerFinRef.current);
                timerFinRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sala?.estado, votos]);

    // ── ENCERRAR PARTIDA ─────────────────────────────
    // O servidor encerra a sala, paga o prêmio e solta os vínculos atômicamente.
    async function encerrarPartida(vencedor: 'A' | 'B' | 'empate') {
        if (IS_DEV) console.log(`🏆 [Partida] Encerrando com vencedor: ${vencedor}`);
        if (timerFinRef.current) { clearInterval(timerFinRef.current); timerFinRef.current = null; }
        const ok = await encerrarSala(salaId, vencedor);
        if (!ok && IS_DEV) console.log(`❌ [Partida] Falha ao encerrar sala ${salaId}`);
        // → encerrada (casual) ou aguardando_revisao (apostada): refaz a sala
        // inteira na hora (mesma razão do entrar/confirmar).
        await sincronizarTudo('encerrar');
    }

    // ── CARREGAR VOTOS (COM TRAVA) ────────────────────
    async function carregarVotos() {
        if (carregandoVotosRef.current) return;
        carregandoVotosRef.current = true;

        try {
            const dadosVotos = await buscarVotos(salaId);
            setVotos(dadosVotos);
            const meu = dadosVotos.find((v: any) => v.user_id === usuarioAtual.id);
            if (meu) setMeuVoto(meu.opcao);
        } finally {
            setTimeout(() => { carregandoVotosRef.current = false; }, 500);
        }
    }

    // ── AÇÕES (só disparam RPC; quem decide é o servidor) ──────
    const entrar = async (role: string, isTimeA: boolean) => {
        if (entrandoRef.current) {
            if (IS_DEV) console.log(`⚠️ [entrar] Requisição em voo, ignorando`);
            return;
        }
        entrandoRef.current = true;

        try {
            if (IS_DEV) console.log(`🚪 [entrar] sala_entrar(role=${role}, timeA=${isTimeA})`);
            const r = await entrarNaVaga(salaId, role, isTimeA);

            if (!r.ok) {
                if (IS_DEV) console.log(`❌ [entrar] Recusado pelo servidor: ${r.erro}`);

                // Erros de elegibilidade viram MODAL específico (design v3 §11),
                // nunca mensagem genérica. O servidor é a fonte da verdade.
                if (r.erro === 'saldo_insuficiente') {
                    setErroElegibilidade({ tipo: 'saldo', faltam: r.faltam ?? 0 });
                } else if (r.erro === 'ja_em_sala_apostada') {
                    setErroElegibilidade({ tipo: 'outra_sala', salaNum: r.salaNum ?? 0 });
                } else if (r.erro === 'riot_id_obrigatorio') {
                    setErroElegibilidade({ tipo: 'riot_id' });
                } else if (r.erro === 'termos_nao_aceitos') {
                    setErroElegibilidade({ tipo: 'termos' });
                } else if (r.erro === 'suspenso_por_strikes') {
                    setErroElegibilidade({ tipo: 'suspenso', liberadoEm: r.liberadoEm ?? null });
                } else if (r.erro === 'conta_suspensa') {
                    setErroElegibilidade({ tipo: 'suspenso', liberadoEm: r.suspensaAte ?? null });
                } else if (r.erro === 'conta_banida') {
                    setErroElegibilidade({ tipo: 'banida' });
                } else {
                    mostrar('erro', traduzirErroSala(r.erro));
                }

                await sincronizarJogadores(); // realinha a UI com a verdade do banco
                return;
            }

            if (IS_DEV) console.log(`✅ [entrar] OK — estado da sala: ${r.estado}`);
            // Caso especial "vagas cheias": entrar preencheu a última vaga e o
            // servidor transicionou para confirmacao (r.estado). Refaz o fetch
            // da sala INTEIRA na hora para a contagem aparecer — sem depender
            // do WebSocket, que o Chrome congela em aba de background.
            if (r.estado === 'confirmacao') {
                await sincronizarTudo('entrar');
            } else {
                await sincronizarJogadores();
            }
        } finally {
            entrandoRef.current = false;
        }
    };

    const sair = async () => {
        if (saindoRef.current) return;
        saindoRef.current = true;

        try {
            if (IS_DEV) console.log(`🚪 [sair] sala_sair(${salaId})`);
            const r = await sairDaVaga(salaId);

            if (!r.ok) {
                mostrar('erro', traduzirErroSala(r.erro));
                return;
            }
            // Marca a saída como voluntária para o realtime não virar "kick".
            saiuProprioRef.current = Date.now();
            await sincronizarJogadores();
        } finally {
            saindoRef.current = false;
        }
    };

    // ── FECHAR MODAL DE ELEGIBILIDADE ─────────────────────────
    const fecharErroElegibilidade = useCallback(() => setErroElegibilidade(null), []);

    // ── ACEITAR TERMOS (modal `termos_nao_aceitos`) ────────────
    const aceitarTermos = useCallback(async () => {
        try {
            await api.terms.accept();
            setErroElegibilidade(null);
            if (IS_DEV) console.log(`📋 [Termos] Aceite registrado — pode tentar entrar de novo`);
        } catch (error: any) {
            if (IS_DEV) console.error(`❌ [Termos] ${error?.message}`);
            mostrar('erro', 'Não foi possível registrar o aceite. Tente novamente.');
        }
    }, [mostrar]);

    // ── TICKER DE OCIOSIDADE (aviso de kick aos 25 min, design v3 §8) ──
    // Enquanto eu estiver numa vaga de sala em `preenchendo`, re-renderiza a
    // cada 15s para o badge "será removido em 5 min" derivar de `created_at`
    // (o servidor kicka aos 30 min desde o created_at da vaga).
    useEffect(() => {
        if (sala?.estado !== 'preenchendo') return;
        const temVaga = jogadores.some((j: any) => j.user_id === usuarioAtual.id && !!j.created_at);
        if (!temVaga) return;
        const id = setInterval(() => setKickTick((t) => t + 1), 15_000);
        return () => clearInterval(id);
    }, [sala?.estado, jogadores, usuarioAtual.id]);

    // ── OCIOSIDADE DERIVADA DO SERVIDOR (minutos desde a entrada na vaga) ──
    const minhaVaga = jogadores.find((j: any) => j.user_id === usuarioAtual.id);
    const ociosidadeMin = sala?.estado === 'preenchendo' && minhaVaga?.created_at
        ? Math.max(0, (Date.now() - new Date(minhaVaga.created_at).getTime()) / 60_000)
        : 0;

    const confirmar = async () => {
        if (confirmandoRef.current) {
            if (IS_DEV) console.log(`⚠️ [confirmar] Requisição em voo, ignorando clique duplo`);
            return;
        }
        confirmandoRef.current = true;

        try {
            if (IS_DEV) console.log(`📝 [confirmar] sala_confirmar(${salaId})`);
            const r = await confirmarPresenca(salaId);

            if (!r.ok) {
                if (IS_DEV) console.log(`❌ [confirmar] Recusado: ${r.erro}`);
                mostrar('erro', traduzirErroSala(r.erro));
            }
            // Caso especial: o último confirmar dispara confirmacao →
            // iniciando_partida (r.estado). Refaz o fetch da sala INTEIRA na
            // hora para os demais verem "Preparar para a Batalha" — sem
            // depender do WebSocket congelado em aba de background.
            if (r.estado === 'iniciando_partida') {
                await sincronizarTudo('confirmar');
            } else {
                await sincronizarJogadores();
            }
        } finally {
            setTimeout(() => { confirmandoRef.current = false; }, 300);
        }
    };

    const recusar = async () => {
        if (confirmandoRef.current) {
            if (IS_DEV) console.log(`⚠️ [recusar] Requisição em voo, ignorando clique duplo`);
            return;
        }
        confirmandoRef.current = true;

        try {
            if (IS_DEV) console.log(`🚫 [recusar] sala_recusar(${salaId})`);
            const r = await recusarPresenca(salaId);

            if (!r.ok) {
                if (IS_DEV) console.log(`❌ [recusar] Recusado: ${r.erro}`);
                mostrar('erro', traduzirErroSala(r.erro));
            }
            await sincronizarTudo('recusar');
        } finally {
            setTimeout(() => { confirmandoRef.current = false; }, 300);
        }
    };

    const votar = async (opcao: 'time_a' | 'time_b') => {
        const jogador = jogadores.find((j: any) => j.user_id === usuarioAtual.id);
        const sucesso = await registrarVoto(salaId, usuarioAtual.id, opcao, jogador?.is_time_a || false);
        if (sucesso) { setMeuVoto(opcao); await carregarVotos(); }
    };

    // Solicita a finalização no servidor (transição para votação).
    const solicitarFinalizacao = async () => {
        const r = await api.matches.finalizar(salaId);
        if (!r.ok && IS_DEV) console.log(`❌ [Finalizar] Recusado: ${r.erro}`);
        // partida_iniciada → finalizacao: refaz a sala inteira para a tela de
        // votação aparecer na hora (mesma razão do entrar/confirmar).
        await sincronizarTudo('finalizar');
    };

    return {
        sala, jogadores, loading, erro,
        timer, timerIniciandoPartida, codigoPartida,
        meuVoto, votos, timerFinalizacao,
        mostrarMensagem,
        erroElegibilidade, fecharErroElegibilidade, aceitarTermos,
        ociosidadeMin,
        atualizar: () => sincronizarTudo('manual'),
        entrar, sair, confirmar, recusar, votar, solicitarFinalizacao,
    };
}
