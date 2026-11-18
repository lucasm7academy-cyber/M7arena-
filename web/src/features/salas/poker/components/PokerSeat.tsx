// Assento da mesa: avatar, nome, stack, aposta da rua, botão do dealer, cartas
// e o rótulo da última ação. Recebe estado pronto — não decide regra nenhuma.
import { motion, useReducedMotion } from 'motion/react';
import { formatChips, type Seat } from '../domain/engine';
import { EssenceIcon } from './EssenceIcon';
import { PlayingCard } from './PlayingCard';

const STYLE_LABEL: Record<Seat['style'], string> = {
  tight: 'Apertado',
  balanced: 'Equilibrado',
  loose: 'Solto',
  maniac: 'Agressivo',
};

export interface PokerSeatProps {
  seat: Seat;
  active: boolean;
  dealer: boolean;
  showdown: boolean;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function PokerSeat({
  seat,
  active,
  dealer,
  showdown,
  compact = false,
  className = '',
  style,
}: PokerSeatProps) {
  const semFichas = seat.stack <= 0;
  const revelar = seat.isHero || showdown;
  const apagado = seat.folded;
  const semMovimento = useReducedMotion();

  const descricao = [
    `Assento de ${seat.name}`,
    seat.isHero ? '(você)' : '',
    `${formatChips(seat.stack)} de essência`,
    seat.folded ? 'desistiu' : '',
    seat.allIn ? 'all-in' : '',
    active ? 'é a vez deste assento' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      role="group"
      aria-label={descricao}
      style={style}
      className={[
        'relative flex w-full flex-col items-center gap-1 transition-opacity duration-300',
        apagado ? 'opacity-45 grayscale' : '',
        semFichas && !apagado ? 'opacity-70' : '',
        className,
      ].join(' ')}
    >
      {/* Aposta da rua */}
      {seat.bet > 0 && (
        <motion.div
          key={`bet-${seat.bet}`}
          initial={{ opacity: 0, y: 5, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22 }}
          className="absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#FFB700]/45 bg-black/90 px-2 py-[1px] text-[10px] font-black tabular-nums text-[#FFB700] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.9)]"
          aria-label={`Aposta de ${formatChips(seat.bet)} de essência`}
        >
          {formatChips(seat.bet)}
        </motion.div>
      )}

      <div className="flex items-end justify-center gap-1">
        {/* Avatar */}
        <div className="relative">
          <div
            className="grid place-items-center rounded-full"
            style={{
              width: compact ? 34 : 40,
              height: compact ? 34 : 40,
              background: `radial-gradient(circle at 30% 25%, ${seat.tint}66, #0A0B0C 78%)`,
              border: `1.5px solid ${active ? '#FFB700' : `${seat.tint}88`}`,
              boxShadow: active ? '0 0 22px -6px rgba(255,183,0,0.85)' : 'none',
            }}
          >
            <span className="text-[12px] font-black text-white/90 tracking-tight">
              {seat.avatar || seat.name.slice(0, 2).toUpperCase()}
            </span>
          </div>

          {active && !semMovimento && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-full border border-[#FFB700]/70"
              animate={{ opacity: [0.35, 1, 0.35], scale: [1, 1.06, 1] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {dealer && (
            <span
              className="absolute -right-1.5 -bottom-1 grid h-5 w-5 place-items-center rounded-full border border-[#ffe082]/70 bg-[#FFB700] text-[9px] font-black text-black shadow-[0_0_12px_#ffb70040]"
              title="Botão do dealer"
              aria-label="Botão do dealer"
            >
              D
            </span>
          )}
        </div>

        {/* Cartas do herói sempre abertas; dos bots, só no showdown. */}
        {seat.cards.length > 0 && !apagado && (
          <div className="flex items-end">
            {seat.cards.map((card, i) => (
              <div key={card.id} className={i === 0 ? '' : '-ml-2.5 sm:-ml-3'}>
                <PlayingCard
                  card={card}
                  faceDown={!revelar}
                  size={seat.isHero ? 'md' : 'sm'}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nome + stack */}
      <div className="w-full max-w-[124px] rounded-[3px] border border-white/10 bg-black/75 px-1.5 py-[3px] text-center backdrop-blur-sm">
        <div className="flex items-center justify-center gap-1 leading-none">
          <span className="truncate text-[10px] font-black uppercase tracking-wide text-white/85">
            {seat.name}
          </span>
          {seat.isHero && (
            <span className="rounded-[2px] bg-[#FFB700] px-1 text-[7px] font-black uppercase text-black">
              você
            </span>
          )}
        </div>
        <div className="mx-auto mt-1 flex w-fit items-center justify-center gap-1 rounded-full border border-cyan-200/15 bg-cyan-200/5 px-2 py-0.5 text-[11px] font-black tabular-nums text-cyan-100">
          <EssenceIcon size={9} />
          {formatChips(seat.stack)}
        </div>
      </div>

      {/* Última ação / perfil / all-in */}
      <div className="flex h-4 items-center justify-center gap-1">
        {seat.allIn ? (
          <span className="rounded-[2px] bg-[#e0679b]/20 px-1.5 text-[8px] font-black uppercase tracking-widest text-[#f0a3c0]">
            all-in
          </span>
        ) : seat.lastAction ? (
          <span className="rounded-[2px] bg-white/5 px-1.5 text-[8px] font-bold uppercase tracking-wider text-white/55">
            {seat.lastAction}
          </span>
        ) : seat.bot ? (
          <span className="text-[8px] font-bold uppercase tracking-wider text-white/25">
            {STYLE_LABEL[seat.style]}
          </span>
        ) : null}
      </div>

      {/* Prêmio da mão */}
      {typeof seat.won === 'number' && seat.won > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="absolute -bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#FFB700]/60 bg-[#FFB700] px-2 py-[1px] text-[9px] font-black text-black shadow-lg"
        >
          +{formatChips(seat.won)} EA
        </motion.div>
      )}
    </div>
  );
}
