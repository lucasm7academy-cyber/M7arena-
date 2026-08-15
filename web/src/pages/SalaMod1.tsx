// src/pages/SalaMod1.tsx
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, AlertTriangle, LinkIcon, Loader, Clock, X, Trash2, Share2, Trophy } from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';
import toast from 'react-hot-toast';
import { useSalaSimples } from '../hooks/useSalaSimples';
import { VagaSlot } from '../components/partidas/VagaSlot';
import { ModaisElegibilidade } from '../components/partidas/ModaisElegibilidade';
import { ROLE_CONFIG, type Role, traduzirErroSala } from '../api/salamod1';
import { api } from '../lib/api';
import { lerSenhaSala, limparSenhaSala } from '../lib/salaSenhaStore';
import { useAuth } from '../contexts/AuthContext';
import { usePerfil } from '../contexts/PerfilContext';

// ── Componentes visuais ─────────────────────────────
// Borda cortada no padrão das vagas/cards de campeonato: wrapper com
// clipPath (frame) + conteúdo interno com clipPath um pouco menor (fill).
const CUT_FRAME = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const CUT_INNER = 'polygon(11px 0, 100% 0, 100% calc(100% - 11px), calc(100% - 11px) 100%, 0 100%, 0 11px)';

function ArcaneIndicators() {
    return (
        <div className="absolute inset-0 rounded-full pointer-events-none z-10">
            {[...Array(30)].map((_, i) => (
                <div
                    key={`tick-${i}`}
                    className="absolute top-1/2 left-1/2 w-[1px] bg-white/5 origin-bottom"
                    style={{
                        transform: `translate(-50%, -50%) rotate(${i * 12}deg) translateY(-35vmin)`,
                        height: i % 5 === 0 ? '2.5vmin' : '1.2vmin',
                        backgroundColor: i % 5 === 0 ? 'rgba(255, 183, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    }}
                />
            ))}
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 100, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-[2vmin] rounded-full border border-dashed border-white/[0.03]" />
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 150, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-[5vmin] rounded-full border border-dotted border-[#FFB700]/[0.02]" />
        </div>
    );
}

function CentralDisplay() {
    return (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-full">
            <AnimatePresence mode="wait">
                <motion.div
                    key="image-step"
                    initial={{ scale: 0.2, opacity: 0, filter: 'blur(10px)' }}
                    animate={{ scale: 0.85, opacity: 0.8, filter: 'blur(0px)' }}
                    exit={{ scale: 1.1, opacity: 0, filter: 'blur(5px)' }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <img
                        src="https://static.wikia.nocookie.net/leagueoflegends/images/9/9c/Summoner%27s_Rift_LoL_Promo_01.png/revision/latest/scale-to-width-down/1000?cb=20220817091416"
                        alt="Summoner's Rift" loading="lazy"
                        className="w-[90%] h-[90%] object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                        referrerPolicy="no-referrer"
                    />
                </motion.div>
            </AnimatePresence>
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%] z-20 opacity-20" />
        </div>
    );
}

// ── PÁGINA ──────────────────────────────────────────
export default function SalaMod1() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const salaId = parseInt(id ?? '0', 10);
    const { user } = useAuth();
    const { perfil, refetch: refetchPerfil } = usePerfil();

    const usuarioAtual = perfil ? {
        ...perfil,
        avatar: perfil.avatar,
    } : {
        id: user?.id || '',
        nome: user?.email?.split('@')[0] || 'Visitante',
        tag: '',
        elo: 'Sem Elo',
        avatar: undefined,
    };

    const {
        sala, jogadores, loading, erro,
        timer, codigoPartida,
        mostrarMensagem,
        erroElegibilidade, fecharErroElegibilidade, aceitarTermos, mostrarSaldoFaltante,
        ociosidadeMin, atualizar,
        entrar, sair, confirmar, recusar,
    } = useSalaSimples(salaId, usuarioAtual);

    const [codigoCopiado, setCodigoCopiado] = useState(false);
    const codigoCopiadoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [showAvisoRiotId, setShowAvisoRiotId] = useState(false);
    const [showAvisoLogin, setShowAvisoLogin] = useState(false);
    const [verificandoPartida, setVerificandoPartida] = useState(false);

    const copiarCodigo = () => {
        if (codigoPartida) {
            navigator.clipboard.writeText(codigoPartida);
            setCodigoCopiado(true);
            if (codigoCopiadoTimeoutRef.current) clearTimeout(codigoCopiadoTimeoutRef.current);
            codigoCopiadoTimeoutRef.current = setTimeout(() => setCodigoCopiado(false), 2000);
        }
    };

    const [compartilhado, setCompartilhado] = useState(false);
    const compartilhadoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ── COMPARTILHAR SALA ─────────────────────────────
    // Monta uma mensagem formatada convidando para a partida e copia para a
    // área de transferência. 100% front — não depende do crawler de embeds.
    const compartilharSala = () => {
        if (!sala) return;

        const nick = perfil?.riotId || perfil?.nome || 'Jogador';
        const textoModo: Record<string, string> = {
            '5v5': "5x5 Summoner's Rift",
            'aram': 'ARAM Howling Abyss',
            '1v1': '1v1 Howling Abyss',
            'time_vs_time': 'Time vs Time Summoner\'s Rift',
        };
        const eloLinha = sala.elo_minimo ? `Mínimo: ${sala.elo_minimo}` : 'Free Elo';
        const premio = (sala.mpoints || 0) > 0 ? `${sala.mpoints} M7Coins` : 'Casual';
        const link = `${window.location.origin}/${sala.modo}/${sala.id}`;

        const mensagem =
`🎮 ${nick} convida você para jogar ${textoModo[sala.modo] || 'uma partida'} personalizado
🎯 ${eloLinha}
👥 ${jogadores.length}/${sala.max_jogadores} vagas preenchidas
💰 ${premio}
👇 Entre aqui

${link}`;

        navigator.clipboard.writeText(mensagem);
        setCompartilhado(true);
        if (compartilhadoTimeoutRef.current) clearTimeout(compartilhadoTimeoutRef.current);
        compartilhadoTimeoutRef.current = setTimeout(() => setCompartilhado(false), 2000);
        toast.success('Mensagem de convite copiada!');
    };


    if (loading) {
        return (
            <div className="flex-1 bg-[#050505] flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1510_0%,#050505_100%)]" />
                <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="relative z-10 w-16 h-16 rounded-full border-2 border-[#FFB700]/20 border-t-[#FFB700] shadow-[0_0_20px_rgba(255,183,0,0.2)]" 
                />
                <p className="mt-6 text-[#FFB700] font-black uppercase tracking-[0.5em] text-[1.4vmin] animate-pulse">Invocando Sala...</p>
            </div>
        );
    }

    if (erro || !sala) {
        return (
            <div className="flex-1 bg-[#050505] flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#050505]" />
                <AlertTriangle className="w-16 h-16 text-red-500/20 mb-6 relative z-10" />
                <p className="text-white/40 font-black mb-8 relative z-10 uppercase tracking-widest">{erro ?? 'Sala não encontrada'}</p>
                <button onClick={() => navigate('/jogar')}
                    className="relative z-10 px-[4vmin] py-[1.5vmin] rounded-full bg-white/5 border border-white/10 text-white font-black text-[1.4vmin] uppercase tracking-widest hover:bg-white/10 transition-all">
                    Voltar às Salas
                </button>
            </div>
        );
    }

    const isX1 = sala.modo === '1v1';
    const roles: Role[] = isX1 ? ['MID'] : ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
    const timeA = jogadores.filter((j: any) => j.is_time_a);
    const timeB = jogadores.filter((j: any) => !j.is_time_a);
    const jogadorAtual = jogadores.find((j: any) => j.user_id === usuarioAtual.id);

    // Stats reais da partida (resultado_riot, da Riot) por PUUID ou Nome — as vagas da
    // sala finalizada mostram campeão + KDA + CS cruzando por este mapa.
    const statsPorPuuid = new Map<string, any>(
        (sala?.resultado_riot?.participantes ?? []).map((p: any) => [p.puuid, p])
    );
    const statsPorNome = new Map<string, any>(
        (sala?.resultado_riot?.participantes ?? []).map((p: any) => [p.nome?.toLowerCase()?.trim(), p])
    );
    const statsDoJogador = (j: any) => {
        if (!j) return null;
        let p = j?.puuid ? statsPorPuuid.get(j.puuid) : null;
        if (!p && j?.nome) {
            p = statsPorNome.get(j.nome.toLowerCase().trim());
        }
        if (!p) return null;
        return {
            campeao: p.campeao,
            championId: p.champion_id,
            kills: p.kills,
            deaths: p.deaths,
            assists: p.assists,
            cs: p.cs,
            venceu: !!p.venceu,
        };
    };

    // Resultado da partida finalizada (header no topo da tela, sem o círculo).
    const vencedorSala = sala?.vencedor; // 'A' | 'B' | 'empate' | null
    const corVencedor = vencedorSala === 'A' ? '#3b82f6' : vencedorSala === 'B' ? '#ef4444' : '#fbbf24';
    const nomeVencedor =
        vencedorSala === 'A' ? (sala?.time_a_nome || 'Time Azul')
        : vencedorSala === 'B' ? (sala?.time_b_nome || 'Time Vermelho')
        : 'Empate';
    const duracaoFinalizada = sala?.resultado_riot?.duracao_s
        ? `${Math.floor(sala.resultado_riot.duracao_s / 60)}:${String(Math.round(sala.resultado_riot.duracao_s % 60)).padStart(2, '0')}`
        : null;
    const placarFinalizada = sala?.resultado_riot?.placar;

    // ── Salas apostadas (design v3 §11): cálculo financeiro, aviso antecipado, print e regras ──
    const apostaPorJogador = Number(sala.aposta_mc ?? sala.mpoints ?? 0);
    const ehApostada = apostaPorJogador > 0;
    const numJogadores = isX1 ? 2 : (sala.max_jogadores || 10);
    const poteBruto = ehApostada ? apostaPorJogador * numJogadores : 0;
    const taxaPct = Number(sala.taxa_pct || 8.99);
    const poteLiquido = ehApostada ? Math.round(poteBruto * (1 - taxaPct / 100)) : 0;
    const numVencedores = isX1 ? 1 : 5;
    const premioPorJogador = ehApostada && numVencedores > 0 ? Math.floor(poteLiquido / numVencedores) : 0;
    const temRiotId = !!perfil?.riotId;
    const jogadorConfirmado = !!jogadorAtual?.confirmado;
    const minutosParaKick = ehApostada ? Math.max(0, Math.ceil(30 - ociosidadeMin)) : 0;

    const usuarioParticipou = !!jogadorAtual;
    const usuarioVenceu = jogadorAtual ? (
        (jogadorAtual.is_time_a && vencedorSala === 'A') || (!jogadorAtual.is_time_a && vencedorSala === 'B')
    ) : false;

    // Intercepta o clique na vaga: visitante sem login, sem Riot ID ou sem MC
    // (sala apostada) avisa ANTES de tentar entrar (design v3 §11) — o servidor
    // continua sendo a fonte da verdade.
    const handleEntrar = (role: string, isTimeA: boolean) => {
        if (!user) {
            setShowAvisoLogin(true);
            return;
        }
        if (ehApostada && !temRiotId) {
            setShowAvisoRiotId(true);
            return;
        }
        if (ehApostada && (perfil?.saldo ?? 0) < apostaPorJogador) {
            mostrarSaldoFaltante(apostaPorJogador - (perfil?.saldo ?? 0));
            return;
        }
        // Senha de sala privada (MORPH-001): vem do store preenchido no lobby
        // e é validada no SERVIDOR durante o join. Limpa após o uso.
        const senha = lerSenhaSala(salaId);
        limparSenhaSala(salaId);
        entrar(role, isTimeA, senha || undefined);
    };

    // Acelerador do polling: dispara a verificação automática via Riot na hora.
    // O servidor decide quem venceu e leva a sala para `encerrada`/`cancelada`.
    const verificarPartidaAgora = async () => {
        if (!salaId) return;
        setVerificandoPartida(true);
        try {
            const r = await api.matches.verificar(Number(salaId));
            if (r.estado === 'encerrada') {
                toast.success(`Partida finalizada! ${r.vencedor === 'A' ? 'Time Azul' : 'Time Vermelho'} venceu.`);
            } else if (r.estado === 'cancelada') {
                toast.error('Partida cancelada — os nicks não conferiram ou o jogo não foi encontrado.');
            } else {
                toast('Partida ainda em andamento ou não encontrada. Verificação automática continua.');
            }
            await atualizar();
        } catch (e: any) {
            toast.error(traduzirErroSala(e?.message));
        } finally {
            setVerificandoPartida(false);
        }
    };

    const aceitarTermosEAtualizar = async () => {
        await aceitarTermos();
        refetchPerfil(); // atualiza termosAceitos no contexto
    };

    const coresModo: Record<string, string> = {
        '1v1': 'text-red-500', 
        'aram': 'text-blue-400', 
        '5v5': 'text-green-400',
    };

    // Rótulo amigável do estado da sala no top bar (antes mostrava o valor cru
    // do banco: "preenchendo", "confirmacao"...).
    const ESTADO_ROTULO: Record<string, string> = {
        preenchendo: 'Aguardando Jogadores',
        confirmacao: 'Confirmando Presença',
        iniciando_partida: 'Iniciando Partida',
        partida_iniciada: 'Em Jogo',
        aguardando_revisao: 'Em Análise',
        encerrada: 'Encerrada',
        cancelada: 'Cancelada',
    };
    const estadoRotulo = ESTADO_ROTULO[sala.estado] ?? sala.estado.replace('_', ' ');

    const hexCoresModo: Record<string, string> = {
        '1v1': '#ef4444',
        'aram': '#3b82f6',
        '5v5': '#22c55e',
    };
    const corModoHeader = hexCoresModo[sala.modo] || '#FFB700';

    // ── Exclusão administrativa (admin/proprietário) ──
    // Cargo vem do PerfilContext (perfil.cargo: 'proprietario'|'admin'|...). A
    // validação REAL roda no servidor (DELETE /api/matches/:id); aqui só
    // escondemos o botão para quem não tem cargo.
    const ehAdminOuProprietario = perfil?.cargo === 'admin' || perfil?.cargo === 'proprietario';

    const excluirSala = async () => {
        if (!ehAdminOuProprietario) return;
        const confirmou = window.confirm(
            `Excluir a sala "${sala.nome}" permanentemente? As reservas dos jogadores serão devolvidas.`
        );
        if (!confirmou) return;
        try {
            await api.matches.excluir(salaId);
            toast.success('Sala excluída.');
            navigate('/jogar');
        } catch (e: any) {
            toast.error(traduzirErroSala(e?.message));
        }
    };

    return (
        <div className="flex-1 w-full min-h-screen md:min-h-0 bg-[#050505] flex flex-col items-center justify-start md:justify-between p-0 font-sans relative overflow-x-hidden md:overflow-hidden md:h-full text-white">

            {/* Background Layer */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[#050505]" />
                <div className="absolute inset-0">
                    <img src="/images/fundo_elite.jpg" alt="" className="w-full h-full object-cover object-center opacity-30" />
                </div>

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,183,0,0.05)_0%,#050505_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
            </div>

            <AnimatePresence>
                {erro && (
                    <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
                        className="absolute top-24 left-1/2 -translate-x-1/2 z-[100]">
                        <div className="px-6 py-3 rounded-2xl bg-red-500/10 backdrop-blur-md border border-red-500/30 text-red-100 text-[1.4vmin] font-black uppercase tracking-widest shadow-2xl">
                            {erro}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TOP BAR BANNER - LARGURA TOTAL SEM BORDAS */}
            <motion.div 
                initial={{ y: -100 }} animate={{ y: 0 }}
                className="w-full min-h-[64px] h-auto py-2 md:py-0 md:h-[10vh] bg-[#050505] shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 relative flex items-center px-4 md:px-[4vmin] justify-between overflow-hidden shrink-0 flex-wrap md:flex-nowrap gap-2 md:gap-0"
            >
                {/* Background Ryze Banner */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <img 
                        src="/images/fundoryzecortado.webp" 
                        alt="Ryze Background" 
                        className="w-full h-full object-cover opacity-35 object-center" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/60 to-[#050505]" />
                </div>

                <div className="flex items-center gap-3 md:gap-[3vmin] z-10">
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigate('/jogar')} 
                        className="group relative flex items-center justify-center text-red-500"
                        title="Sair da sala"
                    >
                        <motion.span
                            initial={{ rotate: 0 }}
                            whileHover={{ rotate: 90 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="flex"
                        >
                            <X className="w-8 h-8 md:w-[5vmin] md:h-[5vmin]" strokeWidth={3.5} />
                        </motion.span>
                    </motion.button>
                    <div className="flex flex-col">
                        <h1 className="text-base md:text-[2.2vmin] font-black tracking-widest text-white uppercase leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{sala.nome}</h1>
                        <span className="text-xs md:text-[1.7vmin] font-black text-[#FFB700] tracking-widest mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">#{String(sala.id).padStart(6, '0')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-6 md:gap-[5vmin] z-10">
                    <div className="flex items-center gap-3 sm:gap-6 md:gap-[4vmin]">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] md:text-[1.1vmin] font-bold text-white/40 uppercase tracking-widest">Estado</span>
                            <span className="text-xs md:text-[1.5vmin] font-black text-[#FFB700] uppercase tracking-widest mt-0.5">{estadoRotulo}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] md:text-[1.1vmin] font-bold text-white/40 uppercase tracking-widest">Modo</span>
                            <span className={`text-xs md:text-[1.5vmin] font-black uppercase tracking-widest mt-0.5 ${coresModo[sala.modo] || 'text-white'}`}>{sala.modo}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] md:text-[1.1vmin] font-bold text-white/40 uppercase tracking-widest">Aposta / Pote</span>
                            <span className="text-xs md:text-[1.5vmin] font-black text-[#FFB700] uppercase tracking-widest mt-0.5 flex items-center gap-1 md:gap-[0.4vmin]">
                                {ehApostada ? (
                                    <>
                                        <GiTwoCoins className="w-3.5 h-3.5 md:w-[1.6vmin] md:h-[1.6vmin] text-[#FFB700]" />
                                        {apostaPorJogador} MC (Pote {poteBruto} MC)
                                    </>
                                ) : (
                                    <span className="text-green-400">Casual</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Compartilhar sala — copia convite formatado */}
                    <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={compartilharSala}
                        className="w-8 h-8 md:w-[5vmin] md:h-[5vmin] rounded-xl bg-[#FFB700]/10 border border-[#FFB700]/30 flex items-center justify-center text-[#FFB700] hover:bg-[#FFB700]/20 transition-colors backdrop-blur-md shrink-0"
                        title="Compartilhar sala"
                    >
                        {compartilhado ? (
                            <Check className="w-4 h-4 md:w-[2.2vmin] md:h-[2.2vmin] text-green-400" />
                        ) : (
                            <Share2 className="w-4 h-4 md:w-[2.2vmin] md:h-[2.2vmin]" />
                        )}
                    </motion.button>

                    {/* Excluir sala — só admin/proprietário (validação real no servidor) */}
                    {ehAdminOuProprietario && (
                        <motion.button
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={excluirSala}
                            className="w-8 h-8 md:w-[5vmin] md:h-[5vmin] rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 hover:bg-red-500/20 hover:text-red-400 transition-colors backdrop-blur-md shrink-0"
                            title="Excluir sala permanentemente"
                        >
                            <Trash2 className="w-4 h-4 md:w-[2.2vmin] md:h-[2.2vmin]" />
                        </motion.button>
                    )}
                </div>
            </motion.div>

            {/* AVISO ANTECIPADO DE RIOT ID (salas apostadas, design v3 §11) */}
            {ehApostada && !temRiotId && (
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className="absolute top-[13vh] left-1/2 -translate-x-1/2 z-[45] w-[min(600px,92vw)]">
                    <div className="px-4 py-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 backdrop-blur-md flex items-center gap-3 shadow-2xl">
                        <LinkIcon className="w-4 h-4 text-blue-400 shrink-0" />
                        <p className="flex-1 text-blue-100 text-xs md:text-[1.4vmin] font-black uppercase tracking-wider">
                            Vincule seu Riot ID para jogar valendo MC
                        </p>
                        <button onClick={() => navigate('/vincular')}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs md:text-[1.2vmin] font-black uppercase tracking-widest hover:bg-blue-500/30 transition-all">
                            Vincular
                        </button>
                    </div>
                </motion.div>
            )}

            {/* AVISO DE KICK POR OCIOSIDADE (aos 25 min, design v3 §8) */}
            {sala.estado === 'preenchendo' && ociosidadeMin >= 25 && (
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className="absolute top-[13vh] left-1/2 -translate-x-1/2 z-[45]">
                    <div className="px-4 py-2 rounded-full border border-orange-500/40 bg-orange-500/10 backdrop-blur-md text-orange-300 text-xs md:text-[1.4vmin] font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl">
                        <Clock className="w-4 h-4 md:w-[1.6vmin] md:h-[1.6vmin]" />
                        Ocioso — removido da vaga em {minutosParaKick} min
                    </div>
                </motion.div>
            )}

            {/* MAIN CENTRAL AREA */}
            <div className="w-full relative flex flex-col items-center justify-start md:justify-center md:flex-1 overflow-visible py-4 md:py-[2vmin]">

                {/* HEADER DE RESULTADO — partida finalizada: vencedor + placar +
                    duração no topo, no padrão de borda cortada, sem o círculo. */}
                {sala.estado === 'encerrada' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        className="w-full flex justify-center mb-4 md:mb-[2vmin] z-20 px-3 md:px-0">
                        <div className="relative p-[1.5px] max-w-[440px] md:max-w-none w-full md:w-auto" style={{ clipPath: CUT_FRAME, backgroundColor: corVencedor }}>
                            <div className="bg-[#0A0A0A] px-3 py-2 sm:px-6 sm:py-3 md:px-[4vmin] md:py-[1.4vmin] flex flex-wrap md:flex-nowrap items-center justify-center gap-2 sm:gap-4 md:gap-[2.5vmin]"
                                style={{ clipPath: CUT_INNER }}>
                                <div className="w-8 h-8 md:w-[4vmin] md:h-[4vmin] rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: `${corVencedor}20`, border: `1px solid ${corVencedor}60` }}>
                                    <Trophy className="w-4 h-4 md:w-[2vmin] md:h-[2vmin]" style={{ color: corVencedor }} />
                                </div>
                                <div className="text-left shrink-0">
                                    <p className="text-[10px] md:text-[0.9vmin] font-black text-white/40 uppercase tracking-[0.4em]">Partida Finalizada</p>
                                    <p className="text-xs sm:text-sm md:text-[1.8vmin] font-black uppercase tracking-[0.15em]"
                                        style={{ color: corVencedor, textShadow: `0 0 18px ${corVencedor}55` }}>
                                        {vencedorSala === 'empate' ? '⚖️ Empate' : `${nomeVencedor} venceu`}
                                    </p>
                                </div>
                                {placarFinalizada && (
                                    <div className="flex items-center gap-2 md:gap-[1.5vmin] pl-2 md:pl-[2vmin] border-l border-white/10">
                                        <div className="text-center">
                                            <p className="text-[9px] md:text-[0.8vmin] font-black uppercase tracking-widest text-blue-400">Blue</p>
                                            <p className="text-xs sm:text-sm md:text-[1.8vmin] font-black text-white tabular-nums leading-tight">{placarFinalizada.blue.kills}</p>
                                        </div>
                                        <span className="text-xs md:text-[1.1vmin] font-black text-white/25">×</span>
                                        <div className="text-center">
                                            <p className="text-[9px] md:text-[0.8vmin] font-black uppercase tracking-widest text-red-400">Red</p>
                                            <p className="text-xs sm:text-sm md:text-[1.8vmin] font-black text-white tabular-nums leading-tight">{placarFinalizada.red.kills}</p>
                                        </div>
                                    </div>
                                )}
                                {duracaoFinalizada && (
                                    <div className="flex items-center pl-2 md:pl-[2vmin] border-l border-white/10 shrink-0">
                                        <span className="text-xs sm:text-sm md:text-[1.8vmin] font-black text-white tabular-nums tracking-wide">
                                            {duracaoFinalizada}
                                        </span>
                                    </div>
                                )}
                                {ehApostada && (
                                    <div className="flex items-center gap-2 sm:gap-3 md:gap-[1.8vmin] pl-2 md:pl-[2vmin] border-l border-white/10 shrink-0">
                                        <div className="text-center">
                                            <p className="text-[9px] md:text-[0.8vmin] font-black uppercase tracking-widest text-[#FFB700]/70">Pote Total</p>
                                            <p className="text-xs sm:text-sm md:text-[1.6vmin] font-black text-[#FFB700] tabular-nums leading-tight flex items-center justify-center gap-1 md:gap-[0.4vmin]">
                                                <GiTwoCoins className="w-3.5 h-3.5 md:w-[1.6vmin] md:h-[1.6vmin]" /> {poteBruto} MC
                                            </p>
                                        </div>
                                        <div className="text-center pl-2 md:pl-[1.5vmin] border-l border-white/10">
                                            <p className="text-[9px] md:text-[0.8vmin] font-black uppercase tracking-widest text-emerald-400/80">Prêmio / Jogador</p>
                                            <p className="text-xs sm:text-sm md:text-[1.6vmin] font-black text-emerald-400 tabular-nums leading-tight">
                                                +{premioPorJogador} MC
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* SIDE GRID SECTION — mobile: empilhado vertical (time A →
                    hub → time B); desktop: times nas laterais do hub central */}
                <div className={`w-full flex items-center justify-start md:justify-center z-20 flex-col md:flex-row gap-4 md:gap-0 py-2 md:py-0 ${
                    sala.estado === 'encerrada'
                        ? 'md:gap-[8vmin]'
                        : isX1
                            ? 'md:gap-[74vmin]'
                            : 'md:gap-[70vmin]'
                }`}>
                    {/* BLUE SIDE — oculto apenas em aguardando_revisao (o card
                        central mostra o lineup); na encerrada fica visível com as
                        vagas mostrando campeão + KDA + CS da Riot. */}
                    {sala.estado !== 'aguardando_revisao' && (
                    <div className="flex flex-col gap-2 md:gap-[1.5vmin] items-center w-full max-w-[440px] md:w-[44vmin] md:max-w-none px-3 md:px-0 shrink-0">
                        <div
                            className="relative mb-1 md:mb-[1vmin] p-[1.5px] overflow-hidden self-center"
                            style={{
                                backgroundColor: '#3B82F6',
                                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                            }}
                        >
                            <div
                                className="bg-[#050505] px-5 py-1"
                                style={{
                                    clipPath: 'polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)',
                                }}
                            >
                                <span className="block text-xs md:text-[1.4vmin] font-black text-[#3B82F6] uppercase tracking-[0.4em]">Blue-Side</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 md:gap-[1.5vmin] items-center w-full">
                            {roles.map((role) => {
                                const jogador = timeA.find((j: any) => j.role === role);
                                const isAtual = jogador?.user_id === usuarioAtual.id;
                                const avatar = isAtual ? perfil?.avatar : jogador?.avatar;
                                const isVip = jogador?.isVip ?? false;
                                return (
                                    <VagaSlot key={`A-${role}`} ocupada={!!jogador}
                                        nome={jogador?.nome} tag={jogador?.tag} icone={avatar}
                                        isTimeA={true} role={role as any} isConfirmado={jogador?.confirmado}
                                        aoEntrar={() => handleEntrar(role, true)}
                                        aoSair={isAtual ? sair : undefined}
                                        roleIconImg={ROLE_CONFIG[role].img}
                                        vipTier={isVip ? 'vip' : 'free'}
                                        stats={statsDoJogador(jogador)}
                                        isFinalizada={sala.estado === 'encerrada'}
                                        apostaMC={apostaPorJogador}
                                        premioMC={premioPorJogador}
                                        timeVencedor={vencedorSala}
                                    />
                                );
                            })}
                        </div>
                    </div>
                    )}

                    {/* CÍRCULO CENTRAL HUB — oculto na partida finalizada (o header
                        de resultado no topo + lados blue/red mostram tudo) e no
                        estado "Em análise" (o card quadrado central mostra o lineup).
                        Desktop (md+): absoluto, no centro geométrico do MAIN entre os
                        dois times. Mobile: entra no fluxo vertical — vagas do time A →
                        hub → vagas do time B. */}
                    {sala.estado !== 'encerrada' && sala.estado !== 'aguardando_revisao' && (
                    <div className="relative md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-[84vw] h-[84vw] max-w-[340px] max-h-[340px] md:w-[55vmin] md:h-[55vmin] md:max-w-none md:max-h-none rounded-full z-10 flex items-center justify-center shrink-0 my-4 md:my-0">
                        {/* Outer rings */}
                        <div className="absolute inset-[-8vmin] rounded-full border border-white/[0.02] border-dashed animate-[spin_100s_linear_infinite]" />
                        <div className="absolute inset-[-4vmin] rounded-full border-t-4 border-l-2 border-[#FFB700]/10 opacity-30 animate-[spin_60s_linear_infinite]" />

                        {/* Main Hub Body */}
                        <div className="relative w-full h-full rounded-full bg-black shadow-[0_0_100px_rgba(0,0,0,1)] border-[6px] border-white/5 flex flex-col items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(40,30,20,0.6)_0%,transparent_100%)] opacity-50" />
                            <ArcaneIndicators />
                            <CentralDisplay />

                            {/* PARTIDA INICIADA — prompt de envio do resultado no
                                display (fala com quem ainda não voltou da partida) */}
                            {sala.estado === 'partida_iniciada' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="absolute inset-0 z-[35] bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 md:p-[6vmin] text-center pointer-events-none">
                                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 }}
                                        className="flex flex-col items-center gap-2 md:gap-[2.5vmin]">
                                        <span className="text-xl md:text-[3vmin] font-black text-white uppercase tracking-[0.25em] drop-shadow-[0_0_20px_rgba(255,183,0,0.4)]">
                                            Finalizou a partida?
                                        </span>
                                        <span className="text-xs md:text-[1.3vmin] font-bold text-white/70 uppercase tracking-[0.3em]">
                                            Envie os resultados no botão abaixo
                                        </span>
                                    </motion.div>
                                </motion.div>
                            )}

                            {/* HUB HUD Overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
                                <div className={`absolute flex flex-col items-center ${ehApostada ? 'top-[14%] md:top-[12vmin]' : 'top-8 md:top-10'}`}>
                                    <div className="w-12 md:w-[6vmin] h-[2px] bg-gradient-to-r from-transparent via-[#FFB700]/40 to-transparent mb-1 md:mb-2" />
                                    {ehApostada ? (
                                        <span className="text-xs md:text-[1.6vmin] font-black text-[#FFB700] uppercase tracking-[0.4em] md:tracking-[0.5em]">
                                            Partida Valendo!
                                        </span>
                                    ) : (
                                        <span className="text-[10px] md:text-[0.9vmin] font-black text-[#FFB700]/60 uppercase tracking-[0.6em] md:tracking-[0.8em]">{sala.modo === 'aram' ? 'Howling Abyss' : "Summoner's Rift"}</span>
                                    )}
                                </div>
                                <div className="absolute bottom-8 md:bottom-10 flex flex-col items-center">
                                    {ehApostada ? (
                                        <>
                                            <span className="flex items-center gap-1.5 md:gap-[1vmin] text-xs sm:text-sm md:text-[1.6vmin] font-black text-[#FFB700] uppercase tracking-[0.2em] md:tracking-[0.3em] drop-shadow-[0_0_12px_rgba(255,183,0,0.4)]">
                                                <GiTwoCoins className="w-4 h-4 md:w-[2.2vmin] md:h-[2.2vmin]" /> Pote {poteBruto.toLocaleString('pt-BR')} MC
                                            </span>
                                            <span className="text-[10px] md:text-[1.05vmin] font-black text-emerald-400 uppercase tracking-widest mt-0.5 md:mt-1 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                                                Prêmio +{premioPorJogador.toLocaleString('pt-BR')} MC / vencedor
                                            </span>
                                            <div className="w-20 md:w-[10vmin] h-[2px] bg-gradient-to-r from-transparent via-[#FFB700]/40 to-transparent mt-1 md:mt-2" />
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[10px] md:text-[0.9vmin] font-black text-white/20 uppercase tracking-[0.5em]">FASE BETA V1</span>
                                            <div className="w-20 md:w-[10vmin] h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent mt-2" />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* RED SIDE — oculto apenas em aguardando_revisao (o card
                        central mostra o lineup); na encerrada fica visível com as
                        vagas mostrando campeão + KDA + CS da Riot. */}
                    {sala.estado !== 'aguardando_revisao' && (
                    <div className="flex flex-col gap-2 md:gap-[1.5vmin] items-center w-full max-w-[440px] md:w-[44vmin] md:max-w-none px-3 md:px-0 shrink-0">
                        <div
                            className="relative mb-1 md:mb-[1vmin] p-[1.5px] overflow-hidden self-center"
                            style={{
                                backgroundColor: '#ef4444',
                                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                            }}
                        >
                            <div
                                className="bg-[#050505] px-5 py-1"
                                style={{
                                    clipPath: 'polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)',
                                }}
                            >
                                <span className="block text-xs md:text-[1.4vmin] font-black text-[#ef4444] uppercase tracking-[0.4em]">Red-Side</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 md:gap-[1.5vmin] items-center w-full">
                            {roles.map((role) => {
                                const jogador = timeB.find((j: any) => j.role === role);
                                const isAtual = jogador?.user_id === usuarioAtual.id;
                                const avatar = isAtual ? perfil?.avatar : jogador?.avatar;
                                const isVip = jogador?.isVip ?? false;
                                return (
                                    <VagaSlot key={`B-${role}`} ocupada={!!jogador}
                                        nome={jogador?.nome} tag={jogador?.tag} icone={avatar}
                                        isTimeA={false} role={role as any} isConfirmado={jogador?.confirmado}
                                        aoEntrar={() => handleEntrar(role, false)}
                                        aoSair={isAtual ? sair : undefined}
                                        roleIconImg={ROLE_CONFIG[role].img}
                                        vipTier={isVip ? 'vip' : 'free'}
                                        stats={statsDoJogador(jogador)}
                                        isFinalizada={sala.estado === 'encerrada'}
                                        apostaMC={apostaPorJogador}
                                        premioMC={premioPorJogador}
                                        timeVencedor={vencedorSala}
                                    />
                                );
                            })}
                        </div>
                    </div>
                    )}
                </div>

                {/* OVERLAYS (CONFIRMATION / VOTING/ ETC IN THE MIDDLE) */}

                <AnimatePresence>
                    {/* CONFIRMAÇÃO */}
                    {sala.estado === 'confirmacao' && (
                        <motion.div 
                            key="overlay-confirmacao"
                            initial={{ opacity: 0, scale: 1.1 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[84vw] h-[84vw] max-w-[340px] max-h-[340px] md:w-[55vmin] md:h-[55vmin] rounded-full bg-black/60 backdrop-blur-md z-[60] flex flex-col items-center justify-center p-4 md:p-[5vmin] border border-[#FFB700]/20"
                        >
                            <motion.span 
                                initial={{ y: 20, opacity: 0 }} 
                                animate={{ y: 0, opacity: 1 }}
                                className="text-6xl md:text-[15vmin] font-black text-white tabular-nums leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                {timer ?? 0}
                            </motion.span>
                            <motion.div 
                                initial={{ y: 20, opacity: 0 }} 
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex flex-col items-center gap-2 md:gap-4 mt-2 md:mt-4"
                            >
                                <span className="text-xs md:text-[1.8vmin] font-black text-[#FFB700] uppercase tracking-[0.5em] md:tracking-[1em]">CONFIRME AGORA</span>
                                <span className="text-[10px] md:text-[1.1vmin] font-bold text-white/50 uppercase tracking-[0.2em] text-center max-w-[280px] md:max-w-[40vmin]">
                                    Confiram os nicks — quem jogar no lugar do dono da vaga cancela a partida
                                </span>
                                <div className="w-24 md:w-[12vmin] h-[4px] bg-white/10 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-[#FFB700]" 
                                        initial={{ width: '100%' }}
                                        animate={{ width: `${Math.min(100, (timer / 60) * 100)}%` }}
                                        transition={{ duration: 1, ease: 'linear' }}
                                    />
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* PARTIDA CONFIRMADA */}
                    {sala.estado === 'iniciando_partida' && jogadorAtual && (
                        <motion.div 
                            key="overlay-partida-confirmada"
                            initial={{ opacity: 0, filter: 'blur(10px)' }} 
                            animate={{ opacity: 1, filter: 'blur(0px)' }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[84vw] h-[84vw] max-w-[340px] max-h-[340px] md:w-[55vmin] md:h-[55vmin] rounded-full overflow-hidden bg-black/70 backdrop-blur-md z-[60] flex flex-col items-center justify-center border border-[#FFB700]/20"
                        >
                            {/* Tutorial de como colar o código — dentro do display, sem textos */}
                            <motion.img
                                initial={{ scale: 0.85, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.6 }}
                                src="/images/tutorial.png"
                                alt="Como entrar na partida personalizada"
                                className="w-[85%] h-[85%] object-contain rounded-full select-none pointer-events-none drop-shadow-[0_0_30px_rgba(255,183,0,0.35)]"
                            />
                        </motion.div>
                    )}

                    {/* MENSAGEM DE TIMEOUT/ERRO */}
                    {mostrarMensagem && (
                        <motion.div
                            key="overlay-mensagem"
                            initial={{ opacity: 0, scale: 0.8, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 20 }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] flex flex-col items-center justify-center gap-[2vmin] p-[5vmin]"
                        >
                            <div className="w-[55vmin] h-[55vmin] rounded-full bg-red-600 border-2 border-red-400 flex flex-col items-center justify-center shadow-[0_0_60px_rgba(239,68,68,0.4)]">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-[12vmin] font-black text-white mb-[2vmin]"
                                >
                                    ✕
                                </motion.div>
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-[2vmin] font-black text-white uppercase tracking-[0.2em] text-center"
                                >
                                    {mostrarMensagem.texto}
                                </motion.p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ESTADO PÓS-PRINT (LEGADO) — nenhuma sala nova entra em
                    aguardando_revisao desde a verificação automática via Riot
                    (Tasks 3-10). Se uma sala antiga em voo ainda estiver nesse
                    estado, mostra um card simples em vez do fluxo de print. */}
                {sala.estado === 'aguardando_revisao' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[65]"
                    >
                        <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-center">
                            <p className="text-white/60 text-xs uppercase tracking-widest font-bold">
                                Partida em análise — aguarde o admin
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* PARTIDA FINALIZADA — o resultado fica direto na tela: lados
                    blue/red visíveis com campeão + KDA + CS e o hub central
                    mostrando vencedor + placar + duração (ResultadoDisplay). */}
            </div>

            {/* ACTION FOOTER */}
            <div className="w-full min-h-[80px] md:h-[15vh] flex flex-col items-center justify-center z-[70] pt-4 pb-8 md:pb-[5vh] pointer-events-none shrink-0">
                <AnimatePresence>
                    {/* ✅ BOTÃO DE CONFIRMAR - Aparece apenas se NÃO confirmou ainda */}
                    {sala.estado === 'confirmacao' && jogadorAtual && !jogadorAtual.confirmado && (
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                            className="flex items-center gap-3 md:gap-[2vmin]">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={confirmar}
                                className="pointer-events-auto relative p-[1.5px] bg-black hover:bg-black transition-colors"
                                style={{ clipPath: CUT_FRAME }}
                            >
                                <span className="block bg-[#FFB700] px-8 py-3.5 md:px-[12vmin] md:py-[2.5vmin] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-sm md:text-[1.8vmin] text-black hover:bg-yellow-400 transition-colors relative z-10"
                                    style={{ clipPath: CUT_INNER }}>
                                    Confirmar Presença
                                </span>
                            </motion.button>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={recusar}
                                className="pointer-events-auto relative p-[1.5px] bg-black hover:bg-black transition-colors"
                                style={{ clipPath: CUT_FRAME }}
                            >
                                <span className="block bg-red-500 px-6 py-3.5 md:px-[6vmin] md:py-[2.5vmin] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-sm md:text-[1.4vmin] text-white hover:bg-red-600 transition-colors relative z-10"
                                    style={{ clipPath: CUT_INNER }}>
                                    Recusar
                                </span>
                            </motion.button>
                        </motion.div>
                    )}

                    {/* ✅ ESTADO CONFIRMADO - Mostra após usuário confirmar */}
                    {sala.estado === 'confirmacao' && jogadorAtual && jogadorAtual.confirmado && (
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}>
                            <motion.div
                                className="pointer-events-auto relative p-[1.5px] bg-black"
                                style={{ clipPath: CUT_FRAME }}
                            >
                                <span className="block bg-green-500 px-8 py-3.5 md:px-[12vmin] md:py-[2.5vmin] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-sm md:text-[1.8vmin] text-black flex items-center gap-2 md:gap-[1.5vmin]"
                                    style={{ clipPath: CUT_INNER }}>
                                    <Check className="w-5 h-5 md:w-[2.5vmin] md:h-[2.5vmin]" />
                                    Confirmado
                                </span>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* PARTIDA CONFIRMADA — copiar código (mesmo lugar dos botões
                        de confirmar presença / enviar print) */}
                    {sala.estado === 'iniciando_partida' && codigoPartida && (
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                            className="flex flex-col items-center gap-2 md:gap-[1.5vmin]">
                            <p className="text-xs md:text-[1.4vmin] font-black text-white uppercase tracking-[0.4em] md:tracking-[0.5em]">Prepare-se para a batalha</p>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={copiarCodigo}
                                className="pointer-events-auto relative p-[1.5px] bg-black"
                                style={{ clipPath: CUT_FRAME }}
                            >
                                <span className="block bg-[#FFB700] px-8 py-3.5 md:px-[12vmin] md:py-[2.5vmin] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-sm md:text-[1.8vmin] text-black hover:bg-yellow-400 flex items-center justify-center gap-2 md:gap-[1.5vmin] transition-colors"
                                    style={{ clipPath: CUT_INNER }}>
                                    {codigoCopiado ? (
                                        <Check className="w-5 h-5 md:w-[2.2vmin] md:h-[2.2vmin]" />
                                    ) : (
                                        <Copy className="w-5 h-5 md:w-[2.2vmin] md:h-[2.2vmin]" />
                                    )}
                                    {codigoCopiado ? 'Código Copiado!' : 'Copiar Código'}
                                </span>
                            </motion.button>
                        </motion.div>
                    )}

                    {/* PARTIDA INICIADA — verificação automática via Riot (acelerador
                        do polling) substitui o envio de print nesta etapa; o print
                        existe só na contestação em ResultadoPartida */}
                    {sala.estado === 'partida_iniciada' && jogadorAtual && (
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={verificarPartidaAgora}
                                disabled={verificandoPartida}
                                className="pointer-events-auto relative p-[1.5px] bg-black disabled:opacity-50"
                                style={{ clipPath: CUT_FRAME }}
                            >
                                <span className="block bg-[#FFB700] px-8 py-3.5 md:px-[12vmin] md:py-[2.5vmin] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-sm md:text-[1.8vmin] text-black hover:bg-yellow-400 flex items-center justify-center gap-2 md:gap-[1.5vmin] transition-colors"
                                    style={{ clipPath: CUT_INNER }}>
                                    {verificandoPartida ? <Loader className="w-5 h-5 md:w-[2.2vmin] md:h-[2.2vmin] animate-spin" /> : <Check className="w-5 h-5 md:w-[2.2vmin] md:h-[2.2vmin]" />}
                                    {verificandoPartida ? 'Verificando...' : 'Verificar Partida'}
                                </span>
                            </motion.button>
                        </motion.div>
                    )}

                    {/* PARTIDA FINALIZADA — status financeiro pessoal e botões de ação */}
                    {sala.estado === 'encerrada' && (
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                            className="flex flex-col items-center gap-3 md:gap-[1.5vmin] z-30 w-full px-3 md:px-0">
                            {ehApostada && usuarioParticipou && (
                                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                    className={`px-4 py-2 md:px-[3.5vmin] md:py-[1vmin] rounded-full border backdrop-blur-md flex items-center gap-2 md:gap-[1vmin] text-center ${
                                        usuarioVenceu 
                                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                                            : 'bg-white/5 border-white/10 text-white/60'
                                    }`}>
                                    {usuarioVenceu ? (
                                        <>
                                            <GiTwoCoins className="w-4 h-4 md:w-[2vmin] md:h-[2vmin] text-[#FFB700] shrink-0" />
                                            <span className="text-xs md:text-[1.3vmin] font-black uppercase tracking-wider">
                                                Parabéns! Você faturou <strong className="text-[#FFB700]">+{premioPorJogador} MC</strong> nesta partida!
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-[11px] md:text-[1.2vmin] font-bold uppercase tracking-wider text-white/50">
                                            Partida finalizada • Débito da entrada: -{apostaPorJogador} MC
                                        </span>
                                    )}
                                </motion.div>
                            )}

                            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-[2vmin] w-full max-w-[440px]">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => navigate('/jogar')}
                                    className="pointer-events-auto relative p-[1.5px] bg-black hover:bg-black transition-colors flex-1 sm:flex-initial"
                                    style={{ clipPath: CUT_FRAME }}
                                >
                                    <span className="block bg-[#FFB700] px-8 py-3.5 md:px-[7vmin] md:py-[1.8vmin] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-sm md:text-[1.4vmin] text-black hover:bg-yellow-400 flex items-center justify-center gap-2 md:gap-[1vmin] transition-colors shadow-[0_0_25px_rgba(255,183,0,0.35)]"
                                        style={{ clipPath: CUT_INNER }}>
                                        Voltar ao Lobby
                                    </span>
                                </motion.button>

                                {ehApostada && (
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => navigate('/perfil')}
                                        className="pointer-events-auto relative p-[1.5px] bg-white/20 hover:bg-white/40 transition-colors flex-1 sm:flex-initial"
                                        style={{ clipPath: CUT_FRAME }}
                                    >
                                        <span className="block bg-[#0A0A0A] px-6 py-3.5 md:px-[4vmin] md:py-[1.8vmin] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-xs sm:text-sm md:text-[1.3vmin] text-white hover:text-[#FFB700] flex items-center justify-center gap-2 md:gap-[1vmin] transition-colors"
                                            style={{ clipPath: CUT_INNER }}>
                                            <GiTwoCoins className="w-4 h-4 md:w-[1.8vmin] md:h-[1.8vmin] text-[#FFB700]" />
                                            Minha Carteira
                                        </span>
                                    </motion.button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* MODAIS DE ELEGIBILIDADE (saldo, outra sala, Riot ID, termos, suspensão) */}
            <ModaisElegibilidade
                erro={erroElegibilidade}
                onClose={fecharErroElegibilidade}
                onAceitarTermos={aceitarTermosEAtualizar}
            />

            {/* AVISO ANTECIPADO DE RIOT ID AO CLICAR NA VAGA */}
            <AnimatePresence>
                {showAvisoRiotId && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowAvisoRiotId(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
                            style={{
                                background: 'rgba(13, 13, 13, 0.9)',
                                border: '2px solid #FFB700',
                                boxShadow: '0 0 45px -10px rgba(255, 183, 0, 0.4)',
                                backdropFilter: 'blur(16px)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <LinkIcon className="w-5 h-5 text-blue-400" />
                                    <h2 className="text-white font-black text-base uppercase tracking-tight">Riot ID obrigatório</h2>
                                </div>
                                <button onClick={() => setShowAvisoRiotId(false)} className="text-white/30 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-white/70 text-sm leading-relaxed">
                                    Esta sala vale <b className="text-white">MC</b>. Vincule seu <b className="text-white">Riot ID</b> para jogar — é ele que garante sua elegibilidade e amarra o print de resultado ao seu perfil.
                                </p>
                                <button onClick={() => { setShowAvisoRiotId(false); navigate('/vincular'); }}
                                    className="w-full py-3 rounded-xl bg-yellow-500 text-black text-sm font-black hover:bg-yellow-400 flex items-center justify-center gap-2">
                                    <LinkIcon className="w-4 h-4" /> Vincular Riot ID
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AVISO DE LOGIN AO CLICAR NA VAGA SEM ESTAR LOGADO */}
            <AnimatePresence>
                {showAvisoLogin && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowAvisoLogin(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
                            style={{
                                background: 'rgba(13, 13, 13, 0.9)',
                                border: '2px solid #FFB700',
                                boxShadow: '0 0 45px -10px rgba(255, 183, 0, 0.4)',
                                backdropFilter: 'blur(16px)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                    <h2 className="text-white font-black text-base uppercase tracking-tight">Faça login para entrar na vaga</h2>
                                </div>
                                <button onClick={() => setShowAvisoLogin(false)} className="text-white/30 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-white/70 text-sm leading-relaxed">
                                    Você pode assistir a sala, mas para ocupar uma vaga e jogar precisa estar logado.
                                </p>
                                <button
                                    onClick={() => { setShowAvisoLogin(false); navigate('/login'); }}
                                    className="w-full py-3 rounded-xl bg-yellow-500 text-black text-sm font-black hover:bg-yellow-400 flex items-center justify-center gap-2"
                                >
                                    <AlertTriangle className="w-4 h-4" /> Entrar / Criar conta
                                </button>
                                <button
                                    onClick={() => setShowAvisoLogin(false)}
                                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-bold hover:bg-white/10"
                                >
                                    Continuar assistindo
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edge Fog */}
            <div className="absolute inset-y-0 left-0 w-[15vw] bg-gradient-to-r from-black via-black/40 to-transparent z-[5] pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-[15vw] bg-gradient-to-l from-black via-black/40 to-transparent z-[5] pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 h-[30vh] bg-gradient-to-t from-black via-black/40 to-transparent z-[5] pointer-events-none" />
        </div>
    );
}