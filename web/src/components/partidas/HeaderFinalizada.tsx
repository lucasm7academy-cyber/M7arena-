import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';

const FONTE_ANTON = '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif';

interface HeaderFinalizadaProps {
    /** Cor do time vencedor (azul/vermelho) ou dourado no empate. */
    cor: string;
    /** Texto da faixa: "TIME VENCEU" ou "EMPATE". */
    vencedor: string;
    /** Placar de kills do ÚLTIMO jogo (não é o placar da série). */
    placar?: { blue: number; red: number } | null;
    /** Duração do último jogo, já formatada (ex.: "32:14"). */
    duracao?: string | null;
    /** Rótulo extra no fim da faixa (ex.: "SÉRIE MD3"). */
    subtitulo?: string | null;
}

/**
 * Titlebar de partida finalizada no estilo da sala normal (Liga RK):
 * gradiente na cor do vencedor + fonte Anton + faixa de informações.
 * Usado pela SalaCampeonato para manter o mesmo visual das demais salas.
 */
export function HeaderFinalizada({ cor, vencedor, placar, duracao, subtitulo }: HeaderFinalizadaProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col items-center mb-4 md:mb-[2.5vmin] z-20 px-3 md:px-0"
        >
            {/* Section Titlebar */}
            <div
                className="w-full max-w-[min(94vw,760px)] grid grid-cols-[3.2rem_1fr_3.2rem] sm:grid-cols-[5rem_1fr_5rem] md:grid-cols-[6.5rem_1fr_6.5rem] items-center gap-2 sm:gap-4 min-h-[3.6rem] sm:min-h-[4.8rem] md:min-h-[5.4rem] px-3 sm:px-6 py-2 border shadow-2xl relative overflow-hidden"
                style={{
                    background: `linear-gradient(90deg, #0c0814 0%, color-mix(in srgb, ${cor} 40%, #0c0814) 45%, ${cor} 88%, #ffffff 100%)`,
                    borderColor: `color-mix(in srgb, ${cor} 55%, rgba(255,255,255,0.2))`,
                    boxShadow: `0 0 45px -10px ${cor}55, inset 0 1px 0 rgba(255,255,255,0.25)`
                }}
            >
                <img
                    src="/images/cropped-cropped-LOGO-M7-PNG-1 (4).png"
                    alt="M7"
                    className="w-8 h-8 sm:w-11 sm:h-11 md:w-13 md:h-13 object-contain justify-self-center brightness-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                />
                <h2
                    className="m-0 text-center uppercase tracking-tight font-normal text-white text-[1.85rem] sm:text-[2.8rem] md:text-[3.6rem] leading-[0.95] select-none truncate sm:overflow-visible"
                    style={{
                        fontFamily: FONTE_ANTON,
                        textShadow: '0 2px 12px rgba(0,0,0,0.65), 0 0 20px rgba(0,0,0,0.4)',
                        color: '#f4f4f2'
                    }}
                >
                    PARTIDA FINALIZADA
                </h2>
                <img
                    src="/images/cropped-cropped-LOGO-M7-PNG-1 (4).png"
                    alt="M7"
                    className="w-8 h-8 sm:w-11 sm:h-11 md:w-13 md:h-13 object-contain justify-self-center brightness-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                />
            </div>

            {/* Update Strip */}
            <div
                className="w-max max-w-[94vw] -mt-2 sm:-mt-2.5 mx-auto px-4 sm:px-6 py-1 sm:py-1.5 border flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-center text-xs sm:text-sm md:text-[1.35rem] uppercase tracking-wider select-none z-10"
                style={{
                    background: 'rgba(8, 8, 10, 0.92)',
                    backdropFilter: 'blur(12px)',
                    borderColor: `color-mix(in srgb, ${cor} 45%, rgba(255,255,255,0.15))`,
                    fontFamily: FONTE_ANTON,
                    color: '#cfcfcb',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.7)'
                }}
            >
                <span className="font-normal flex items-center gap-1.5" style={{ color: cor }}>
                    <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={{ color: cor }} />
                    <span>{vencedor}</span>
                </span>

                {placar && (
                    <span className="flex items-center gap-1.5 text-white/90 pl-2 sm:pl-3 border-l border-white/15">
                        <span className="text-blue-400">BLUE {placar.blue}</span>
                        <span className="text-white/40">×</span>
                        <span className="text-red-400">{placar.red} RED</span>
                    </span>
                )}

                {duracao && (
                    <span className="text-white/70 pl-2 sm:pl-3 border-l border-white/15">
                        {duracao}
                    </span>
                )}

                {subtitulo && (
                    <span className="text-white/70 pl-2 sm:pl-3 border-l border-white/15">
                        {subtitulo}
                    </span>
                )}
            </div>
        </motion.div>
    );
}
