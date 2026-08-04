import React from 'react';
import { motion } from 'motion/react';
import { Check, X, Lock } from 'lucide-react';

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
    // Partida finalizada: vaga vazia mostra "FINALIZADO" (sem clique).
    finalizada?: boolean;
}

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
    finalizada = false,
}) => {

    const teamColor = isTimeA ? '#3B82F6' : '#ef4444';

    // Largura 100% uniforme para todos os cards
    const cardWidth = 'w-[44vmin]';

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
                    className={`w-[5vmin] h-[5vmin] rounded-lg object-cover border ${config.avatarBorder} transition-all`}
                    style={config.avatarFilter ? { filter: config.avatarFilter } : {}}
                />
            </div>
        )
        : (
            <div className={`w-[5vmin] h-[5vmin] bg-white/5 rounded-lg flex items-center justify-center border ${config.avatarBorder} shrink-0`}>
                <span className="text-white/20 text-[1.8vmin] font-black uppercase">{nome?.[0] || '?'}</span>
            </div>
        );

    if (ocupada) {
        const slotInner = (
            <div style={{ transform: `translateX(${arcOffset})` }}>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.015 }}
                    className={`relative ${cardWidth} h-[8.2vmin] p-[1px] group overflow-hidden`}
                    style={{
                        backgroundColor: teamColor,
                        clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                    }}
                >
                    <div
                        className={`
                            w-full h-full bg-[#050505] flex items-center px-[2.5vmin] relative overflow-hidden
                            ${isTimeA ? 'flex-row' : 'flex-row-reverse'}
                        `}
                        style={{
                            clipPath: 'polygon(11.4px 0, 100% 0, 100% calc(100% - 11.4px), calc(100% - 11.4px) 100%, 0 100%, 0 11.4px)',
                        }}
                    >
                        {/* Efeito extra Premium - anel pulsante */}
                        {vipTier === 'premium' && (
                            <motion.div
                                animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.05, 1] }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="absolute inset-0 border-2 border-purple-400/30 pointer-events-none"
                            />
                        )}

                        {isConfirmado && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={`absolute mid-[0vmin] ${isTimeA ? 'right-[2.5vmin]' : 'left-[2.5vmin]'} z-20`}
                            >
                                <div className="w-[3vmin] h-[3vmin] bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.6)] border-[3px] border-[#050505]">
                                    <Check className="w-[1.5vmin] h-[1.5vmin] text-black stroke-[3px]" />
                                </div>
                            </motion.div>
                        )}

                        {/* Overlay Hover Centrado para Sair */}
                        {aoSair && (
                            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center pointer-events-none group-hover:pointer-events-auto">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        aoSair();
                                    }}
                                    className="px-[2.5vmin] py-[0.8vmin] bg-red-600/30 hover:bg-red-600 border border-red-500/60 hover:border-red-400 rounded-xl text-red-100 hover:text-white text-[1.3vmin] font-black uppercase tracking-widest flex items-center gap-[1vmin] shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all transform hover:scale-105 active:scale-95"
                                >
                                    <X className="w-[1.6vmin] h-[1.6vmin] text-red-400 group-hover:text-white" />
                                    <span>Sair da Vaga</span>
                                </button>
                            </div>
                        )}

                        <div className={`flex items-center gap-[2vmin] flex-1 overflow-hidden ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}>
                            <img src={roleIconImg} alt={role} className="w-[4.8vmin] h-[4.8vmin] object-contain brightness-0 invert opacity-80 group-hover:opacity-100 transition-opacity" />
                            {avatarEl}
                            <div className={`flex flex-col min-w-0 ${isTimeA ? 'text-left' : 'text-right'}`}>
                                <div className="flex items-center gap-[1vmin]">
                                    <span
                                        className="text-[2vmin] font-black truncate uppercase tracking-tight"
                                        style={config.nomeStyle}
                                    >
                                        {nome}
                                    </span>
                                </div>
                                <div className={`flex items-center gap-[0.8vmin] mt-0.5 ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}>
                                    <span className="text-[1.2vmin] font-bold text-white/40 uppercase tracking-[0.2em] leading-none">
                                        {tag}
                                    </span>
                                    {vipTier === 'vip' && (
                                        <span className="px-[0.6vmin] py-[0.2vmin] bg-gradient-to-r from-[#FFB700] to-[#ffd54f] text-black text-[0.7vmin] font-black rounded" style={{
                                            boxShadow: '0 0 8px rgba(255, 183, 0, 0.5)'
                                        }}>
                                            VIP
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        );

        return slotInner;
    }

    return (
        <div style={{ transform: `translateX(${arcOffset})` }}>
            <motion.div
                whileHover={finalizada ? undefined : { scale: 1.015 }}
                whileTap={finalizada ? undefined : { scale: 0.98 }}
                onClick={finalizada ? undefined : aoEntrar}
                className={`group relative ${cardWidth} h-[8.2vmin] p-[1px] transition-colors duration-300 overflow-hidden ${finalizada ? 'bg-red-500/40 border border-red-500/50 cursor-default' : 'bg-white/10 hover:bg-white/30 cursor-pointer'}`}
                style={{
                    clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                }}
            >
                <div
                    className={`w-full h-full bg-[#050505] flex items-center justify-center gap-[2.5vmin] transition-all duration-300 ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}
                    style={{
                        clipPath: 'polygon(11.4px 0, 100% 0, 100% calc(100% - 11.4px), calc(100% - 11.4px) 100%, 0 100%, 0 11.4px)',
                    }}
                >
                    <div className="w-[6vmin] h-[6vmin] rounded-xl border border-red-500/40 bg-red-500/10 flex items-center justify-center">
                        <Lock className="w-[2.5vmin] h-[2.5vmin] text-red-500/80" />
                    </div>
                    <div className={`flex flex-col ${isTimeA ? 'items-start' : 'items-end'}`}>
                        <span className="text-[1.6vmin] font-black text-red-500 uppercase tracking-[0.4em]">FINALIZADO</span>
                        <div className={`flex items-center gap-[1vmin] mt-[0.2vmin] ${isTimeA ? 'flex-row' : 'flex-row-reverse'}`}>
                            <img src={roleIconImg} className="w-[2vmin] h-[2vmin] opacity-30 brightness-0 invert" alt={role} />
                            <span className="text-[1.4vmin] font-black text-red-500/40 uppercase tracking-widest">{role}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// Memoizar VagaSlot para evitar re-renders desnecessários
// Comparação customizada: só re-renderiza se props que importam mudarem
export const VagaSlot = React.memo(
    VagaSlotComponent,
    (prev, next) => {
        // true = não renderiza, false = renderiza
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
            prev.finalizada === next.finalizada
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
