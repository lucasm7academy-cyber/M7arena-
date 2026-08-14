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
import { registrarServerTime, agoraServidor } from '../lib/clockSync';
import { tocarInicioConfirmacao, tocarTickConfirmacao, pararMusicaConfirmacao } from '../lib/somSala';
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
 * `ja_em_sala_apostada`. O ban (`conta_banida`) bloqueia casual e apostada.
 */
export type ErroElegibilidade =
  | { tipo: 'saldo'; faltam: number }
  | { tipo: 'outra_sala'; salaNum: number; modo?: string }
  | { tipo: 'riot_id' }
  | { tipo: 'termos' }
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
    const [mostrarMensagem, setMostrarMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);
    const [erroElegibilidade, setErroElegibilidade] = useState<ErroElegibilidade>(null);
    const [kickTick, setKickTick] = useState(0); // re-render periódico do aviso de ociosidade

    // ── Refs (apenas UI/anti-clique-duplo — NADA de coordenação de estado) ──
    const mensagemTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const entrandoRef = useRef(false);
    const saindoRef = useRef(false);
    const confirmandoRef = useRef(false);
    const ultimoEstadoRef = useRef<string>('');
    const tickRef = useRef<{ chave: string; ts: number } | null>(null);
    const tickEmVooRef = useRef(false);
    const jogadoresRef = useRef<any[]>([]);
    // Timestamp da última saída VOLUNTÁRIA: o realtime que chega logo depois
    // não pode virar o aviso de "removido por ociosidade".
    const saiuProprioRef = useRef(0);
    // ── Fallback polling (ajustarsala bug A) ──
    // O WS é a via principal, mas se ele cai (serviço fora, aba em background,
    // mensagem perdida) o jogador que já está na sala não vê a transição.
    // Enquanto a sala estiver ativa, faz um GET leve de backup a cada 5s
    // apenas quando o WS não entregou nada recente.
    const wsVivoRef = useRef(false);
    const ultimoUpdateRef = useRef(0);
    const pollingAtivoRef = useRef(false);

    // ── TIMERS DERIVADOS (apresentação; a decisão é do servidor) ──────
    // Usam `agoraServidor()` (now + offset) para que TODOS os clientes vejam o
    // MESMO tempo restante, mesmo com relógios locais diferentes (ajustarsala
    // bug B). O offset é re-medido a cada sync via server_time.
    const agora = agoraServidor();
    const timer = sala?.confirmacao_expires_at
        ? Math.max(0, Math.round((new Date(sala.confirmacao_expires_at).getTime() - agora) / 1000))
        : 75;

    const timerIniciandoPartida = sala?.iniciando_partida_at
        ? Math.max(0, Math.round((new Date(sala.iniciando_partida_at).getTime() + 90000 - agora) / 1000))
        : 90;

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
        // Um ÚNICO GET da sala (o detail já traz `jogadores` embutidos).
        // Antes fazia buscarsalas + buscarJogadores = 2 GETs do MESMO endpoint,
        // o que dobrava o tráfego com 10 jogadores e podia trazer estados
        // diferentes em cada resposta (flicker/divergência na UI).
        const dadosSala = await buscarsalas(salaId);
        if (!dadosSala) return null;

        registrarServerTime(dadosSala.server_time);
        setSala(dadosSala);
        setCodigoPartida(dadosSala.codigo_partida || null);
        const dadosJogadores = dadosSala.jogadores || [];
        setJogadores(dadosJogadores);
        jogadoresRef.current = dadosJogadores;

        // Som de abertura da contagem: o polling/realtime/entrar refaz o GET
        // da sala; quando o estado transiciona para `confirmacao`, a contagem
        // acabou de abrir — avisa com um ding (tipo notificação).
        const estadoAnterior = ultimoEstadoRef.current;
        ultimoEstadoRef.current = dadosSala.estado;
        if (estadoAnterior !== 'confirmacao' && dadosSala.estado === 'confirmacao') {
            tocarInicioConfirmacao();
        }

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
            registrarServerTime(dadosSala.server_time);
            setSala(dadosSala);
            setCodigoPartida(dadosSala.codigo_partida || null);
            ultimoEstadoRef.current = dadosSala.estado;
            ultimoUpdateRef.current = Date.now(); // carga inicial — WS não está quieto
        ultimoUpdateRef.current = Date.now(); // acabamos de sincronizar — WS não está quieto

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
            ultimoUpdateRef.current = Date.now();
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
        onStatusChange: (conectado) => {
            wsVivoRef.current = conectado;
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

    // ── SOM DE CONFIRMAÇÃO (tick + música de fundo) ──
    // Enquanto a contagem de confirmação estiver aberta e eu ainda não
    // confirmei, toca um tick a cada segundo (tipo música de contagem) e a
    // música de fundo segue. Para tudo quando eu confirmar ou a sala sair de
    // `confirmacao`.
    const euConfirmei = !!jogadores.find((j: any) => j.user_id === usuarioAtual.id)?.confirmed;
    useEffect(() => {
        if (sala?.estado !== 'confirmacao' || euConfirmei) return;

        const id = setInterval(() => tocarTickConfirmacao(), 1000);
        return () => {
            clearInterval(id);
            pararMusicaConfirmacao();
        };
    }, [sala?.estado, euConfirmei, sala?.confirmacao_expires_at]);

    // ── FALLBACK POLLING (ajustarsala bug A) ──────────
    // Quando o WS não está ENTREGANDO (socket morto, OU aba em background com o
    // socket congelado pelo Chrome sem fechar), refaz o GET da sala a cada 5s.
    // O critério é `ultimoUpdateRef`: se nenhum `match_update` chegou há vários
    // segundos, não importa se o socket está "aberto" — ele não está funcionando
    // para nós (Chrome congela WS de aba em background sem disparar onclose).
    // Antes usava `wsVivoRef` (só fica false quando o socket FECHA), o que
    // deixava o join invisível para quem já estava na sala em background.
    const salaAtiva = !!sala && ['preenchendo', 'confirmacao', 'iniciando_partida', 'partida_iniciada', 'aguardando_revisao'].includes(sala?.estado);
    useEffect(() => {
        if (!salaAtiva) return;

        const POLL_INTERVALO_MS = 5000;
        // WS quieto por este tempo (sem match_update) dispara o polling, mesmo
        // com o socket "vivo" — o socket vivo mas congelado não entrega nada.
        const WS_QUIETO_MS = 5000;

        const id = setInterval(() => {
            const quietoHa = Date.now() - ultimoUpdateRef.current;
            if (quietoHa < WS_QUIETO_MS) return; // WS entregando: confia nele

            if (pollingAtivoRef.current) return; // um GET já em voo
            pollingAtivoRef.current = true;
            sincronizarTudo('polling-fallback').finally(() => {
                pollingAtivoRef.current = false;
            });
        // Jitter de 0–2000ms: com WS morto, TODOS os clientes cairiam no polling
        // de 5s no mesmo instante (clientes sincronizados = rajada no GET). O
        // intervalo de 5 a 7s dessincroniza os refetches sem atrasar a entrega.
        }, POLL_INTERVALO_MS + Math.random() * 2000);

        return () => clearInterval(id);
    }, [salaAtiva, sincronizarTudo]);

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

    // ── AÇÕES (só disparam RPC; quem decide é o servidor) ──────
    const entrar = async (role: string, isTimeA: boolean, senha?: string) => {
        if (entrandoRef.current) {
            if (IS_DEV) console.log(`⚠️ [entrar] Requisição em voo, ignorando`);
            return;
        }
        entrandoRef.current = true;

        try {
            if (IS_DEV) console.log(`🚪 [entrar] sala_entrar(role=${role}, timeA=${isTimeA})`);
            const r = await entrarNaVaga(salaId, role, isTimeA, senha);

            if (!r.ok) {
                if (IS_DEV) console.log(`❌ [entrar] Recusado pelo servidor: ${r.erro}`);

                // Erros de elegibilidade viram MODAL específico (design v3 §11),
                // nunca mensagem genérica. O servidor é a fonte da verdade.
                if (r.erro === 'saldo_insuficiente') {
                    setErroElegibilidade({ tipo: 'saldo', faltam: r.faltam ?? 0 });
                } else if (r.erro === 'ja_em_sala_apostada') {
                    setErroElegibilidade({ tipo: 'outra_sala', salaNum: r.salaNum ?? 0, modo: r.salaModo });
                } else if (r.erro === 'riot_id_obrigatorio') {
                    setErroElegibilidade({ tipo: 'riot_id' });
                } else if (r.erro === 'termos_nao_aceitos') {
                    setErroElegibilidade({ tipo: 'termos' });
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

    // Dispara o modal de saldo insuficiente ANTES da chamada ao servidor
    // (aviso antecipado no clique da vaga, design v3 §11). O servidor continua
    // sendo a fonte da verdade; isto é só UX.
    const mostrarSaldoFaltante = useCallback((faltam: number) => {
        setErroElegibilidade({ tipo: 'saldo', faltam });
    }, []);

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

    return {
        sala, jogadores, loading, erro,
        timer, timerIniciandoPartida, codigoPartida,
        mostrarMensagem,
        erroElegibilidade, fecharErroElegibilidade, aceitarTermos, mostrarSaldoFaltante,
        ociosidadeMin,
        atualizar: () => sincronizarTudo('manual'),
        entrar, sair, confirmar, recusar,
    };
}
