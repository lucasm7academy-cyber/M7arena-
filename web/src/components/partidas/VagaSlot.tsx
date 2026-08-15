import React from 'react';
import { motion } from 'motion/react';
import { UserPlus, Check, X } from 'lucide-react';

const PRIMARY_COLOR = '#FFB700';

interface VagaSlotProps {
    ocupada: boolean;
    nome?: string;
    tag?: string;
    icone?: string;
    isTimeA: boolean;
    role: string;
    isConfirmado?: boolean;
    aoEntrar: () => void;
    aoSair?: () => void;
    roleIconImg: string;
    // NOVO - Sistema VIP
    vipTier?: 'free' | 'vip' | 'premium';
    // Modo partida finalizada: mostra campeão (ícone) + KDA + CS no lugar do
    // avatar/nick padrão. `venceu` destaca o lado ganhador.
    stats?: { campeao: string; championId?: number; kills: number; deaths: number; assists: number; cs: number; venceu: boolean } | null;
    isFinalizada?: boolean;
    apostaMC?: number;
    premioMC?: number;
    timeVencedor?: 'A' | 'B' | 'empate' | null;
}

const CHAMPION_ICON_URL = (id: number) =>
    `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`;

const VagaSlotComponent: React.FC<VagaSlotProps> = ({
    ocupada,
    nome,
    tag,
    icone,
    isTimeA,
    role,
    isConfirmado,
    aoEntrar,
    aoSair,
    roleIconImg,
    vipTier = 'free',
    stats = null,
    isFinalizada = false,
    apostaMC = 0,
    premioMC = 0,
    timeVencedor = null,
}) => {

    const teamColor = isTimeA ? '#3B82F6' : '#ef4444';
    const isDesistente = isFinalizada && ocupada && !stats;
    const venceu = isFinalizada
        ? timeVencedor
            ? (isTimeA && timeVencedor === 'A') || (!isTimeA && timeVencedor === 'B')
            : !!stats?.venceu
        : false;

    // Largura 100% uniforme para todos os cards. min-w-full + shrink-0 impedem
    // o flex pai de encolher o card conforme o conteúdo (nick curto → card fino).
    const cardWidth = 'w-full min-w-full shrink-0';

    // Cards 100% alinhados e centralizados em relação aos badges dos times
    const arcOffset = '0vmin';

    // Configuração VIP por tier
    const vipConfig = {
        free: {
            borderColor: isTimeA ? 'border-2 border-blue-500/60' : 'border-2 border-red-500/60',
            glowColor: isTimeA ? 'shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'shadow-[0_0_15px_rgba(239,68,68,0.4)]',
            avatarBorder: isTimeA ? 'border-blue-500/40' : 'border-red-500/40',
            avatarFilter: '',
            bgOverlay: '',
            nomeStyle: { color: teamColor, textShadow: `0 0 10px ${teamColor}44` },
        },
        vip: {
            borderColor: isTimeA ? 'border-2 border-blue-500/60' : 'border-2 border-red-500/60',
            glowColor: isTimeA ? 'shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'shadow-[0_0_15px_rgba(239,68,68,0.4)]',
            avatarBorder: isTimeA ? 'border-blue-500/40' : 'border-red-500/40',
            avatarFilter: '',
            bgOverlay: '',
            nomeStyle: {
                background: 'linear-gradient(to right, #FCD34D, #F59E0B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: `drop-shadow(0 0 8px rgba(255, 183, 0, 0.6)) drop-shadow(0 0 12px rgba(255, 183, 0, 0.3))`,
            },
        },
        premium: {
            borderColor: 'border-purple-500/50',
            glowColor: 'shadow-[0_0_30px_rgba(139,92,246,0.7)]',
            avatarBorder: 'border-purple-400/70 shadow-[0_0_18px_rgba(139,92,246,0.7)]',
            avatarFilter: 'drop-shadow(0 0 10px rgba(139,92,246,0.7))',
            bgOverlay: '',
            nomeStyle: { color: '#FFF', textShadow: `0 0 15px rgba(139,92,246,0.7)` },
        },
    };

    const config = vipConfig[vipTier];

    const avatarEl = icone
        ? (
            <div className="relative shrink-0">
                <img
                    src={icone}
                    alt={nome}
                    className={`w-10 h-10 md:w-[min(12vw,5vmin)] md:h-[min(12vw,5vmin)] rounded-full object-cover border ${config.avatarBorder} transition-all`}
                    style={config.avatarFilter ? { filter: config.avatarFilter } : {}}
                />
            </div>
        )
        : (
            <div className={`w-10 h-10 md:w-[min(12vw,5vmin)] md:h-[min(12vw,5vmin)] bg-white/5 rounded-full flex items-center justify-center border ${config.avatarBorder} shrink-0`}>
                <span className="text-sm md:text-[min(4vw,1.8vmin)] text-white/20 font-black uppercase">{nome?.[0] || '?'}</span>
            </div>
        );

    if (ocupada) {
        const slotInner = (
            <div className="w-full" style={{ transform: `translateX(${arcOffset})` }}>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.015 }}
                    className={`relative ${cardWidth} h-[60px] md:h-[min(16vw,8.2vmin)] p-[1px] group overflow-hidden`}
                    style={{
                        backgroundColor: isDesistente ? '#374151' : teamColor,
                        clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                    }}
                >
                    <div
                        className={`
                            w-full h-full bg-[#050505] flex items-center px-3 md:px-[2.5vmin] relative overflow-hidden
                            ${isTimeA ? 'flex-row' : 'flex-row-reverse'}
                        `}
                        style={{
                            clipPath: 'polygon(11.4px 0, 100% 0, 100% calc(100% - 11.4px), calc(100% - 11.4px) 100%, 0 100%, 0 11.4px)',
                        }}
                    >
                        {/* Efeito extra Premium - anel pulsante */}
                        {vipTier === 'premium' && !isDesistente && (
                            <motion.div
                                animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.05, 1] }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="absolute inset-0 border-2 border-purple-400/30 pointer-events-none"
                            />
                        )}

                        {isConfirmado && !isFinalizada && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={`absolute mid-[0vmin] ${isTimeA ? 'right-2.5 md:right-[2.5vmin]' : 'left-2.5 md:left-[2.5vmin]'} z-20`}
                            >
                                <div className="w-6 h-6 md:w-[3vmin] md:h-[3vmin] bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.6)] border-[2px] md:border-[3px] border-[#050505]">
                                    <Check className="w-3.5 h-3.5 md:w-[1.5vmin] md:h-[1.5vmin] text-black stroke-[3px]" />
                                </div>
                            </motion.div>
                        )}

                        {/* Overlay Hover Centrado para Sair */}
                        {aoSair && !isFinalizada && (
                            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center pointer-events-none group-hover:pointer-events-auto">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        aoSair();
                                    }}
                                    className="px-3 py-1.5 md:px-[2.5vmin] md:py-[0.8vmin] bg-red-600/30 hover:bg-red-600 border border-red-500/60 hover:border-red-400 rounded-xl text-red-100 hover:text-white text-xs md:text-[1.3vmin] font-black uppercase tracking-widest flex items-center gap-1.5 md:gap-[1vmin] shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all transform hover:scale-105 active:scale-95"
                                >
                                    <X className="w-4 h-4 md:w-[1.6vmin] md:h-[1.6vmin] text-red-400 group-hover:text-white" />
                                    <span>Sair da Vaga</span>
                                </button>
                            </div>
                        )}

                        <div className={`flex items-center gap-2.5 md:gap-[2vmin] flex-1 overflow-hidden ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}>
                            {/* Ícone da Rota */}
                            <img
                                src={roleIconImg}
                                alt={role}
                                className={`w-8 h-8 md:w-[min(12vw,4.8vmin)] md:h-[min(12vw,4.8vmin)] object-contain brightness-0 invert opacity-80 group-hover:opacity-100 transition-opacity shrink-0 ${isDesistente ? 'grayscale opacity-30' : ''}`}
                            />

                            {/* Ícone: Desistente (avatar em P&B), Campeão se finalizada, Avatar se normal */}
                            {isDesistente ? (
                                <div className="relative shrink-0 grayscale opacity-40">
                                    {avatarEl}
                                </div>
                            ) : stats && (stats.championId || stats.campeao) ? (
                                <div className="relative shrink-0">
                                    <img
                                        src={stats.championId ? CHAMPION_ICON_URL(stats.championId) : `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${stats.campeao}.png`}
                                        alt={stats.campeao || nome}
                                        title={stats.campeao || 'Campeão'}
                                        loading="lazy"
                                        className={`w-10 h-10 md:w-[min(12vw,5vmin)] md:h-[min(12vw,5vmin)] rounded-full object-cover border ${config.avatarBorder} transition-all`}
                                        onError={(e) => {
                                            if (stats.campeao && !e.currentTarget.src.includes('ddragon')) {
                                                e.currentTarget.src = `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${stats.campeao}.png`;
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                avatarEl
                            )}

                            {/* Info do Jogador */}
                            <div className={`flex flex-col min-w-0 flex-1 ${isTimeA ? 'text-left items-start' : 'text-right items-end'}`}>
                                {isDesistente ? (
                                    <>
                                        <div className={`flex items-center gap-1.5 md:gap-[1vmin] max-w-full ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}>
                                            <span className="text-sm md:text-[min(4.8vw,1.9vmin)] font-black truncate uppercase tracking-tight text-white/40 line-through">
                                                {nome}
                                            </span>
                                            <span className="px-2 py-0.5 md:px-[0.8vmin] md:py-[0.15vmin] bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] md:text-[min(2.4vw,1vmin)] font-black uppercase tracking-widest rounded shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                                                {apostaMC > 0 ? `Desistente (-${apostaMC} MC)` : 'Desistente'}
                                            </span>
                                        </div>
                                        <div className={`flex items-center gap-1 md:gap-[0.8vmin] mt-0.5 ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}>
                                            <span className="text-[11px] md:text-[min(2.6vw,1.1vmin)] font-bold text-red-400/60 uppercase tracking-[0.2em] leading-none">
                                                {tag || 'Não jogou'}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={`flex items-center gap-1.5 md:gap-[1vmin] max-w-full ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}>
                                            <span
                                                className="text-sm md:text-[min(4.8vw,1.9vmin)] font-black truncate uppercase tracking-tight"
                                                style={config.nomeStyle}
                                            >
                                                {nome}
                                            </span>
                                            {vipTier === 'vip' && (
                                                <span className="px-1.5 py-0.5 md:px-[0.6vmin] md:py-[0.2vmin] bg-gradient-to-r from-[#FFB700] to-[#ffd54f] text-black text-[9px] md:text-[0.7vmin] font-black rounded shrink-0 shadow-[0_0_8px_rgba(255,183,0,0.5)]">
                                                    VIP
                                                </span>
                                            )}
                                        </div>

                                        {stats ? (
                                            <div className={`flex items-center gap-2 md:gap-[1.2vmin] mt-0.5 md:mt-[0.2vmin] ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}>
                                                {tag && (
                                                    <span className="text-[11px] md:text-[min(2.5vw,1.1vmin)] font-bold text-white/40 uppercase tracking-[0.2em] leading-none">
                                                        {tag}
                                                    </span>
                                                )}
                                                <span className="text-xs md:text-[min(3.2vw,1.4vmin)] font-black tabular-nums text-white">
                                                    {stats.kills}/{stats.deaths}/{stats.assists}
                                                </span>
                                                <span className="text-[11px] md:text-[min(2.5vw,1.1vmin)] font-bold text-[#FFB700] uppercase tracking-wider">
                                                    {stats.cs} CS
                                                </span>
                                                {apostaMC > 0 && isFinalizada && (
                                                    venceu ? (
                                                        <span className="text-[10px] md:text-[min(2.4vw,1.05vmin)] font-black text-emerald-400 uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 md:px-[0.6vmin] md:py-[0.1vmin] rounded shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                                                            +{premioMC} MC
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] md:text-[min(2.2vw,0.95vmin)] font-bold text-white/40 uppercase tracking-wider bg-white/5 border border-white/10 px-1 py-0.5 md:px-[0.5vmin] md:py-[0.1vmin] rounded">
                                                            -{apostaMC} MC
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <div className={`flex items-center gap-1 md:gap-[0.8vmin] mt-0.5 ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}>
                                                <span className="text-xs md:text-[min(3vw,1.2vmin)] font-bold text-white/40 uppercase tracking-[0.2em] leading-none">
                                                    {tag}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        );

        return slotInner;
    }

    return (
        <div className="w-full" style={{ transform: `translateX(${arcOffset})` }}>
            <motion.div
                whileHover={isFinalizada ? undefined : { scale: 1.015 }}
                whileTap={isFinalizada ? undefined : { scale: 0.98 }}
                onClick={isFinalizada ? undefined : aoEntrar}
                className={`group relative ${cardWidth} h-[60px] md:h-[min(16vw,8.2vmin)] p-[1px] ${isFinalizada ? 'bg-white/5 opacity-40 cursor-default' : 'bg-white/10 hover:bg-white/30 transition-colors duration-300 cursor-pointer'} overflow-hidden`}
                style={{
                    clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                }}
            >
                <div
                    className={`w-full h-full bg-[#050505] flex items-center justify-center gap-3 md:gap-[2.5vmin] transition-all duration-300 ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}
                    style={{
                        clipPath: 'polygon(11.4px 0, 100% 0, 100% calc(100% - 11.4px), calc(100% - 11.4px) 100%, 0 100%, 0 11.4px)',
                    }}
                >
                    <div className="w-10 h-10 md:w-[min(14vw,6vmin)] md:h-[min(14vw,6vmin)] rounded-xl border border-white/10 bg-white/5 flex items-center justify-center group-hover:scale-103 group-hover:border-white/30 transition-all duration-300 shrink-0">
                        <UserPlus className="w-5 h-5 md:w-[min(6vw,2.5vmin)] md:h-[min(6vw,2.5vmin)] text-white/10 group-hover:text-white/60 transition-colors" />
                    </div>
                    <div className={`flex flex-col ${isTimeA ? 'items-start' : 'items-end'}`}>
                        <span className="text-xs md:text-[min(4vw,1.6vmin)] font-black text-white/10 uppercase tracking-[0.4em] group-hover:text-white/60 transition-colors">
                            {isFinalizada ? 'VAZIO' : 'ENTRAR'}
                        </span>
                        <div className={`flex items-center gap-2 md:gap-[1vmin] mt-0.5 md:mt-[0.2vmin] ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}>
                            <img src={roleIconImg} className="w-4 h-4 md:w-[min(5vw,2vmin)] md:h-[min(5vw,2vmin)] opacity-[0.05] group-hover:opacity-40 transition-opacity brightness-0 invert" alt={role} />
                            <span className="text-[11px] md:text-[min(3.5vw,1.4vmin)] font-black text-white/5 uppercase tracking-widest group-hover:text-white/20">{role}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// Memoizar VagaSlot para evitar re-renders desnecessários
export const VagaSlot = React.memo(
    VagaSlotComponent,
    (prev, next) => {
        return (
            prev.ocupada === next.ocupada &&
            prev.nome === next.nome &&
            prev.tag === next.tag &&
            prev.icone === next.icone &&
            prev.isConfirmado === next.isConfirmado &&
            prev.vipTier === next.vipTier &&
            prev.role === next.role &&
            prev.isTimeA === next.isTimeA &&
            prev.roleIconImg === next.roleIconImg &&
            prev.isFinalizada === next.isFinalizada &&
            prev.apostaMC === next.apostaMC &&
            prev.premioMC === next.premioMC &&
            prev.timeVencedor === next.timeVencedor &&
            prev.stats?.kills === next.stats?.kills &&
            prev.stats?.deaths === next.stats?.deaths &&
            prev.stats?.assists === next.stats?.assists &&
            prev.stats?.cs === next.stats?.cs &&
            prev.stats?.championId === next.stats?.championId &&
            prev.stats?.campeao === next.stats?.campeao
        );
    }
);

// Adicionar estilo global para o shine effect
if (typeof document !== 'undefined' && !document.querySelector('#vaga-slot-styles')) {
    const style = document.createElement('style');
    style.id = 'vaga-slot-styles';
    style.textContent = `
        @keyframes shine-sweep-vaga {
            0% {
                transform: translate(-100%, -100%) rotate(45deg);
            }
            50% {
                transform: translate(100%, 100%) rotate(45deg);
            }
            100% {
                transform: translate(100%, 100%) rotate(45deg);
            }
        }
    `;
    document.head.appendChild(style);
}
