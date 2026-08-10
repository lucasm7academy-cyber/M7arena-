// src/pages/SalaMod1.tsx
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, AlertTriangle, LinkIcon, ImagePlus, Loader, Clock, X, Trash2, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSalaSimples } from '../hooks/useSalaSimples';
import { VagaSlot } from '../components/partidas/VagaSlot';
import { ModaisElegibilidade } from '../components/partidas/ModaisElegibilidade';
import { AguardandoRevisao } from '../components/partidas/AguardandoRevisao';
import { ResultadoPartida } from '../components/partidas/ResultadoPartida';
import { RegrasDaSala } from '../components/partidas/RegrasDaSala';
import { ROLE_CONFIG, type Role, traduzirErroSala } from '../api/salamod1';
import { api } from '../lib/api';
import { lerSenhaSala, limparSenhaSala } from '../lib/salaSenhaStore';
import { useAuth } from '../contexts/AuthContext';
import { usePerfil } from '../contexts/PerfilContext';

// ── Componentes visuais ─────────────────────────────
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [enviandoPrint, setEnviandoPrint] = useState(false);

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

    // ── Salas apostadas (design v3 §11): aviso antecipado, print e regras ──
    const ehApostada = (sala.mpoints || 0) > 0;
    const temRiotId = !!perfil?.riotId;
    const matchId = (sala.match_id as string) || '';
    const jogadorConfirmado = !!jogadorAtual?.confirmado;
    const minutosParaKick = ehApostada ? Math.max(0, Math.ceil(30 - ociosidadeMin)) : 0;

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
        if (ehApostada && (perfil?.saldo ?? 0) < (sala.mpoints || 0)) {
            mostrarSaldoFaltante((sala.mpoints || 0) - (perfil?.saldo ?? 0));
            return;
        }
        // Senha de sala privada (MORPH-001): vem do store preenchido no lobby
        // e é validada no SERVIDOR durante o join. Limpa após o uso.
        const senha = lerSenhaSala(salaId);
        limparSenhaSala(salaId);
        entrar(role, isTimeA, senha || undefined);
    };

    // Print de prova durante `partida_iniciada` — é o gatilho que leva a sala
    // apostada para `aguardando_revisao` (design v3 §6). Nunca cai no vazio:
    // toast de sucesso + refetch imediato + realtime.
    const enviarPrintPartida = async (file: File) => {
        if (!matchId || !file) return;
        setEnviandoPrint(true);
        try {
            await api.prints.upload(matchId, file);
            toast.success('Print enviado — entrando em análise.');
            await atualizar();
        } catch (e: any) {
            toast.error(traduzirErroSala(e?.message));
        } finally {
            setEnviandoPrint(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
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
        <div className="flex-1 w-full min-h-full bg-[#050505] flex flex-col items-center p-0 font-sans relative overflow-hidden md:h-full md:justify-between text-white">

            {/* Background Layer */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[#050505]" />

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
                className="w-full h-[10vh] bg-[#050505] shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 relative flex items-center px-[4vmin] justify-between overflow-hidden shrink-0"
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

                <div className="flex items-center gap-[3vmin] z-10">
                    <motion.button 
                        whileHover={{ scale: 1.15 }}
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
                            <X className="w-[5vmin] h-[5vmin]" strokeWidth={3.5} />
                        </motion.span>
                    </motion.button>
                    <div className="flex flex-col">
                        <h1 className="text-[2.2vmin] font-black tracking-widest text-white uppercase leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{sala.nome}</h1>
                        <span className="text-[1.7vmin] font-black text-[#FFB700] tracking-widest mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">#{String(sala.id).padStart(6, '0')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-[5vmin] z-10">
                    <div className="flex items-center gap-[4vmin]">
                        <div className="flex flex-col items-center">
                            <span className="text-[1.1vmin] font-bold text-white/40 uppercase tracking-widest">Estado</span>
                            <span className="text-[1.5vmin] font-black text-[#FFB700] uppercase tracking-widest mt-0.5">{estadoRotulo}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[1.1vmin] font-bold text-white/40 uppercase tracking-widest">Modo</span>
                            <span className={`text-[1.5vmin] font-black uppercase tracking-widest mt-0.5 ${coresModo[sala.modo] || 'text-white'}`}>{sala.modo}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[1.1vmin] font-bold text-white/40 uppercase tracking-widest">Premiação</span>
                            <span className="text-[1.5vmin] font-black text-green-400 uppercase tracking-widest mt-0.5">{sala.mpoints > 0 ? `${sala.mpoints} MC` : 'Casual'}</span>
                        </div>
                    </div>

                    {/* Compartilhar sala — copia convite formatado */}
                    <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={compartilharSala}
                        className="w-[5vmin] h-[5vmin] rounded-xl bg-[#FFB700]/10 border border-[#FFB700]/30 flex items-center justify-center text-[#FFB700] hover:bg-[#FFB700]/20 transition-colors backdrop-blur-md"
                        title="Compartilhar sala"
                    >
                        {compartilhado ? (
                            <Check className="w-[2.2vmin] h-[2.2vmin] text-green-400" />
                        ) : (
                            <Share2 className="w-[2.2vmin] h-[2.2vmin]" />
                        )}
                    </motion.button>

                    {/* Excluir sala — só admin/proprietário (validação real no servidor) */}
                    {ehAdminOuProprietario && (
                        <motion.button
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={excluirSala}
                            className="w-[5vmin] h-[5vmin] rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 hover:bg-red-500/20 hover:text-red-400 transition-colors backdrop-blur-md"
                            title="Excluir sala permanentemente"
                        >
                            <Trash2 className="w-[2.2vmin] h-[2.2vmin]" />
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
                        <p className="flex-1 text-blue-100 text-[1.4vmin] font-black uppercase tracking-wider">
                            Vincule seu Riot ID para jogar valendo MC
                        </p>
                        <button onClick={() => navigate('/vincular')}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[1.2vmin] font-black uppercase tracking-widest hover:bg-blue-500/30 transition-all">
                            Vincular
                        </button>
                    </div>
                </motion.div>
            )}

            {/* AVISO DE KICK POR OCIOSIDADE (aos 25 min, design v3 §8) */}
            {sala.estado === 'preenchendo' && ociosidadeMin >= 25 && (
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className="absolute top-[13vh] left-1/2 -translate-x-1/2 z-[45]">
                    <div className="px-5 py-2 rounded-full border border-orange-500/40 bg-orange-500/10 backdrop-blur-md text-orange-300 text-[1.4vmin] font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl">
                        <Clock className="w-[1.6vmin] h-[1.6vmin]" />
                        Ocioso — removido da vaga em {minutosParaKick} min
                    </div>
                </motion.div>
            )}

            {/* MAIN CENTRAL AREA */}
            <div className="w-full relative flex items-start justify-start md:flex-1 md:items-center md:justify-center overflow-visible py-[3vmin]">

                {/* SIDE GRID SECTION — mobile: empilhado vertical (time A →
                    hub → time B); desktop: times nas laterais do hub central */}
                <div className={`w-full flex items-center justify-start md:justify-center z-20 flex-col md:flex-row gap-[4vmin] md:gap-[66vmin] py-[3vmin] md:py-0 ${isX1 ? 'md:gap-[70vmin]' : 'md:gap-[66vmin]'}`}>
                    {/* BLUE SIDE — oculto em aguardando_revisao (o card quadrado central mostra o lineup) */}
                    {sala.estado !== 'aguardando_revisao' && (
                    <div className="flex flex-col gap-[1.5vmin] items-center w-[90vw] md:w-[48vmin] shrink-0">
                        <div
                            className="relative mb-[1vmin] p-[1.5px] overflow-hidden self-center"
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
                                <span className="block text-[1.4vmin] font-black text-[#3B82F6] uppercase tracking-[0.4em]">Blue-Side</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-[1.5vmin] items-center w-full">
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
                                    />
                                );
                            })}
                        </div>
                    </div>
                    )}

                    {/* CÍRCULO CENTRAL HUB — oculto na partida finalizada (o card de
                        resultado central já ocupa o espaço). Desktop (md+): absoluto,
                        no centro geométrico do MAIN entre os dois times. Mobile: entra
                        no fluxo vertical — vagas do time A → hub → vagas do time B. */}
                    {sala.estado !== 'encerrada' && (
                    <div className="relative md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-[55vmin] h-[55vmin] md:w-[55vmin] md:h-[55vmin] rounded-full z-10 flex items-center justify-center shrink-0">
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
                                    className="absolute inset-0 z-[35] bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-[6vmin] text-center pointer-events-none">
                                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 }}
                                        className="flex flex-col items-center gap-[2.5vmin]">
                                        <span className="text-[3vmin] font-black text-white uppercase tracking-[0.25em] drop-shadow-[0_0_20px_rgba(255,183,0,0.4)]">
                                            Finalizou a partida?
                                        </span>
                                        <span className="text-[1.3vmin] font-bold text-white/70 uppercase tracking-[0.3em]">
                                            Envie os resultados no botão abaixo
                                        </span>
                                    </motion.div>
                                </motion.div>
                            )}

                            {/* HUB HUD Overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
                                <div className="absolute top-10 flex flex-col items-center">
                                    <div className="w-[6vmin] h-[2px] bg-gradient-to-r from-transparent via-[#FFB700]/40 to-transparent mb-2" />
                                    <span className="text-[0.9vmin] font-black text-[#FFB700]/60 uppercase tracking-[0.8em]">{sala.modo === 'aram' ? 'Howling Abyss' : "Summoner's Rift"}</span>
                                </div>
                                <div className="absolute bottom-10 flex flex-col items-center">
                                    <span className="text-[0.9vmin] font-black text-white/20 uppercase tracking-[0.5em]">FASE BETA V1</span>
                                    <div className="w-[10vmin] h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent mt-2" />
                                </div>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* RED SIDE — oculto em aguardando_revisao (o card quadrado central mostra o lineup) */}
                    {sala.estado !== 'aguardando_revisao' && (
                    <div className="flex flex-col gap-[1.5vmin] items-center w-[90vw] md:w-[48vmin] shrink-0">
                        <div
                            className="relative mb-[1vmin] p-[1.5px] overflow-hidden self-center"
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
                                <span className="block text-[1.4vmin] font-black text-[#ef4444] uppercase tracking-[0.4em]">Red-Side</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-[1.5vmin] items-center w-full">
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
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55vmin] h-[55vmin] rounded-full bg-black/60 backdrop-blur-md z-[60] flex flex-col items-center justify-center p-[5vmin] border border-[#FFB700]/20"
                        >
                            <motion.span 
                                initial={{ y: 20, opacity: 0 }} 
                                animate={{ y: 0, opacity: 1 }}
                                className="text-[15vmin] font-black text-white tabular-nums leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                {timer}
                            </motion.span>
                            <motion.div 
                                initial={{ y: 20, opacity: 0 }} 
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex flex-col items-center gap-4 mt-4"
                            >
                                <span className="text-[1.8vmin] font-black text-[#FFB700] uppercase tracking-[1em]">CONFIRME AGORA</span>
                                <div className="w-[12vmin] h-[4px] bg-white/10 rounded-full overflow-hidden">
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
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55vmin] h-[55vmin] rounded-full overflow-hidden bg-black/70 backdrop-blur-md z-[60] flex flex-col items-center justify-center border border-[#FFB700]/20"
                        >
                            {/* Tutorial de como colar o código — dentro do display, sem textos */}
                            <motion.img
                                initial={{ scale: 0.85, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.6 }}
                                src="/images/tutorial-codigo.webp"
                                alt="Tutorial de como colar o código da sala"
                                className="absolute inset-0 w-full h-full object-cover"
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
                            <div className="w-[40vmin] h-[40vmin] rounded-full bg-red-500/10 backdrop-blur-md border-2 border-red-500/30 flex flex-col items-center justify-center shadow-[0_0_60px_rgba(239,68,68,0.3)]">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-[12vmin] font-black text-red-500 mb-[2vmin]"
                                >
                                    ✕
                                </motion.div>
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-[2vmin] font-black text-red-100 uppercase tracking-[0.2em] text-center"
                                >
                                    {mostrarMensagem.texto}
                                </motion.p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ESTADO PÓS-PRINT — "Em análise, prints X/3, pagamento em até 24h" */}
                {sala.estado === 'aguardando_revisao' && (
                    <AguardandoRevisao
                        sala={sala}
                        jogadores={jogadores}
                        jogadorConfirmado={jogadorConfirmado}
                        usuarioId={usuarioAtual.id}
                        onAtualizar={atualizar}
                    />
                )}

                {/* PARTIDA FINALIZADA — resultado no centro (prints + vencedores) */}
                {sala.estado === 'encerrada' && (
                    <ResultadoPartida sala={sala} />
                )}
            </div>

            {/* REGRAS VISÍVEIS ANTES DE CONFIRMAR (design v3 §11) */}
            {sala.estado === 'confirmacao' && ehApostada && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-[2vh] left-1/2 -translate-x-1/2 z-[65] w-[min(620px,94vw)]">
                    <RegrasDaSala aposta={sala.mpoints || 0} taxaPct={sala.taxa_pct ?? 8.99} />
                </motion.div>
            )}

            {/* ACTION FOOTER */}
            <div className="w-full h-[15vh] flex flex-col items-center justify-center z-[70] pb-[5vh] pointer-events-none">
                <AnimatePresence>
                    {/* ✅ BOTÃO DE CONFIRMAR - Aparece apenas se NÃO confirmou ainda */}
                    {sala.estado === 'confirmacao' && jogadorAtual && !jogadorAtual.confirmado && (
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                            className="flex items-center gap-[2vmin]">
                            <motion.button
                                whileHover={{ scale: 1.05, y: -5 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={confirmar}
                                className="pointer-events-auto px-[12vmin] py-[2.5vmin] font-black uppercase tracking-[0.5em] text-[1.8vmin] rounded-2xl bg-white text-black hover:bg-[#FFB700] hover:shadow-[0_0_50px_rgba(255,183,0,0.4)] transition-all shadow-2xl relative overflow-hidden group"
                            >
                                <span className="relative z-10">Confirmar Presença</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05, y: -5 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={recusar}
                                className="pointer-events-auto px-[6vmin] py-[2.5vmin] font-black uppercase tracking-[0.4em] text-[1.4vmin] rounded-2xl bg-red-500/10 border-2 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/60 hover:text-red-300 transition-all shadow-2xl"
                            >
                                Recusar
                            </motion.button>
                        </motion.div>
                    )}

                    {/* ✅ ESTADO CONFIRMADO - Mostra após usuário confirmar */}
                    {sala.estado === 'confirmacao' && jogadorAtual && jogadorAtual.confirmado && (
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}>
                            <motion.div
                                className="pointer-events-auto px-[12vmin] py-[2.5vmin] font-black uppercase tracking-[0.5em] text-[1.8vmin] rounded-2xl bg-green-500/20 border-2 border-green-500/40 text-green-400 flex items-center gap-[1.5vmin] shadow-[0_0_40px_rgba(34,197,94,0.2)]"
                            >
                                <Check className="w-[2.5vmin] h-[2.5vmin]" />
                                <span className="relative z-10">Confirmado</span>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* PARTIDA CONFIRMADA — copiar código (mesmo lugar dos botões
                        de confirmar presença / enviar print) */}
                    {sala.estado === 'iniciando_partida' && codigoPartida && (
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                            className="flex flex-col items-center gap-[1.5vmin]">
                            <p className="text-[1.4vmin] font-black text-white uppercase tracking-[0.5em]">Prepare-se para a batalha</p>
                            <motion.button
                                whileHover={{ scale: 1.05, y: -5 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={copiarCodigo}
                                className="pointer-events-auto px-[12vmin] py-[2.5vmin] font-black uppercase tracking-[0.5em] text-[1.8vmin] rounded-2xl bg-[#FFB700] text-black hover:bg-yellow-400 transition-all shadow-[0_20px_50px_rgba(255,183,0,0.3)] flex items-center justify-center gap-[1.5vmin]"
                            >
                                {codigoCopiado ? (
                                    <Check className="w-[2.2vmin] h-[2.2vmin]" />
                                ) : (
                                    <Copy className="w-[2.2vmin] h-[2.2vmin]" />
                                )}
                                {codigoCopiado ? 'Código Copiado!' : 'Copiar Código'}
                            </motion.button>
                        </motion.div>
                    )}

                    {/* PARTIDA INICIADA — envio de print é o gatilho da revisão
                        (design v3 §6; decisão 2026-08-03: TODAS as salas, casuais
                        e apostadas, passam pelo admin — sem votação no cliente) */}
                    {sala.estado === 'partida_iniciada' && jogadorAtual && (
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarPrintPartida(f); }} />
                            <motion.button
                                whileHover={{ scale: 1.05, y: -5 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={enviandoPrint}
                                className="pointer-events-auto px-[12vmin] py-[2.5vmin] font-black uppercase tracking-[0.5em] text-[1.8vmin] rounded-2xl bg-[#FFB700] text-black hover:bg-yellow-400 transition-all shadow-[0_20px_50px_rgba(255,183,0,0.3)] disabled:opacity-50 flex items-center justify-center gap-[1.5vmin]"
                            >
                                {enviandoPrint ? <Loader className="w-[2.2vmin] h-[2.2vmin] animate-spin" /> : <ImagePlus className="w-[2.2vmin] h-[2.2vmin]" />}
                                {enviandoPrint ? 'Enviando...' : 'Enviar Print e Iniciar Revisão'}
                            </motion.button>
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