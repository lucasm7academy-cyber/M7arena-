// Crupiê da Sala M7: Twisted Fate, da barriga para cima, atrás da mesa.
// A arte é a splash oficial do DDragon (skin Árbitro), com fallback para a
// splash base; nenhum asset é baixado para o repositório.
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { PlayingCard } from './PlayingCard';

const SPLASH_ARBITRO =
  'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/TwistedFate_8.jpg';
const SPLASH_BASE =
  'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/TwistedFate_0.jpg';

export type DealerMood = 'idle' | 'deal' | 'showdown' | 'result';

export interface PokerDealerProps {
  mood: DealerMood;
  /** Só vale em `result`: dourado quando o herói levou a mão, vermelho quando perdeu. */
  heroWon?: boolean;
  className?: string;
}

const POSTURA: Record<DealerMood, { y: number; rotate: number; scale: number }> = {
  idle: { y: 0, rotate: 0, scale: 1 },
  deal: { y: -4, rotate: 2, scale: 1.02 },
  showdown: { y: -10, rotate: -2.4, scale: 1.05 },
  result: { y: 3, rotate: 0, scale: 1.01 },
};

const MASCARA = 'linear-gradient(to bottom, #000 0 72%, transparent 100%)';

export function PokerDealer({ mood, heroWon = false, className = '' }: PokerDealerProps) {
  const semMovimento = useReducedMotion();
  const [src, setSrc] = useState(SPLASH_ARBITRO);
  const [tentouBase, setTentouBase] = useState(false);

  const postura = POSTURA[mood];

  const brilho =
    mood === 'showdown'
      ? { cor: '#FFB700', opacidade: 0.34 }
      : mood === 'result'
        ? heroWon
          ? { cor: '#FFB700', opacidade: 0.46 }
          : { cor: '#e0679b', opacidade: 0.34 }
        : { cor: '#c8aa6e', opacidade: 0.16 };

  return (
    <div
      className={`relative aspect-[3/4] h-full ${className}`}
      style={{ transformOrigin: '50% 100%' }}
    >
      {/* Halo atrás do personagem */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-x-[30%] top-[2%] bottom-[12%] rounded-[50%] blur-2xl"
        style={{
          background: `radial-gradient(ellipse at 50% 46%, ${brilho.cor} 0%, transparent 68%)`,
        }}
        animate={{ opacity: brilho.opacidade }}
        transition={{ duration: 0.45 }}
      />

      <motion.div
        className="relative z-10 h-full w-full"
        animate={
          semMovimento
            ? { ...postura }
            : mood === 'idle'
              ? { y: 0, rotate: 0, scale: [1, 1.01, 1] }
              : { ...postura }
        }
        transition={
          semMovimento
            ? { duration: 0 }
            : mood === 'idle'
              ? { duration: 4, repeat: Infinity, ease: 'easeInOut' }
              : { type: 'spring', stiffness: 130, damping: 17 }
        }
      >
        <div
          className="relative h-full w-full overflow-hidden"
          style={{ maskImage: MASCARA, WebkitMaskImage: MASCARA }}
        >
          <img
            src={src}
            alt="Twisted Fate, crupiê da Sala M7"
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover object-top"
            style={{ filter: 'saturate(0.95) contrast(1.04)' }}
            onError={() => {
              if (!tentouBase) {
                setTentouBase(true);
                setSrc(SPLASH_BASE);
              }
            }}
          />
          {/* Assenta o personagem no feltro: sombra quente na base visível */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
            style={{
              background: 'linear-gradient(to top, rgba(6,20,16,0.65) 0%, transparent 100%)',
            }}
          />
        </div>
      </motion.div>

      {/* Cartas na mão — parado, acima da borda da mesa */}
      <div className="pointer-events-none absolute left-1/2 top-[40%] z-20 flex -translate-x-1/2 items-end">
        <div className="-rotate-[9deg]">
          <PlayingCard faceDown size="sm" />
        </div>
        <div className="-ml-2 rotate-[6deg]">
          <PlayingCard faceDown size="sm" />
        </div>
      </div>

      {/* Distribuindo: leque de 3 cartas saindo da mão */}
      {mood === 'deal' && !semMovimento && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[38%] z-20 h-0">
          {[-1, 0, 1].map((dir, i) => (
            <motion.div
              key={`${mood}-${i}`}
              className="absolute left-1/2 top-0"
              style={{ marginLeft: -15 }}
              initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.82 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: [0, dir * 42, dir * 74],
                y: [0, -16, -26],
                rotate: [0, dir * 16, dir * 28],
                scale: [0.82, 1, 0.94],
              }}
              transition={{
                duration: 1.5,
                delay: i * 0.18,
                repeat: Infinity,
                repeatDelay: 0.2,
                ease: 'easeOut',
              }}
            >
              <PlayingCard faceDown size="sm" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Revelação: brilho quente na frente do personagem */}
      {mood === 'showdown' && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-[6%] top-[8%] z-20 h-1/2 rounded-[50%] blur-xl"
          style={{
            background:
              'radial-gradient(ellipse at 50% 60%, rgba(255,183,0,0.35) 0%, transparent 70%)',
          }}
          animate={semMovimento ? { opacity: 0.6 } : { opacity: [0.35, 0.75, 0.35] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}
