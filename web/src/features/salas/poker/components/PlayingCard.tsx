// Carta de baralho desenhada em CSS + SVG: sem imagens externas e sem libs.
// O verso é a mesma peça sem a face; o espaço vazio aparece como "slot".
import type { Card, Suit } from '../domain/engine';
import { cardLabel } from '../domain/engine';

const RANK: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

const SIZE = {
  xs: { w: 22, h: 32, rank: 9, suit: 7, big: 0 },
  sm: { w: 30, h: 44, rank: 12, suit: 9, big: 0 },
  md: { w: 42, h: 61, rank: 16, suit: 12, big: 19 },
  lg: { w: 58, h: 84, rank: 22, suit: 15, big: 27 },
};

export type CardSize = keyof typeof SIZE;

const RED = '#C62B3E';
const INK = '#17181B';

function SuitGlyph({ suit, size }: { suit: Suit; size: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  switch (suit) {
    case 'h':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 20.9C7.2 17.8 3.6 14.7 3.6 10.6 3.6 8 5.7 6 8.3 6c1.5 0 2.9.8 3.7 2.1C12.8 6.8 14.2 6 15.7 6c2.6 0 4.7 2 4.7 4.6 0 4.1-3.6 7.2-8.4 10.3z" />
        </svg>
      );
    case 'd':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2.1 20 12 12 21.9 4 12z" />
        </svg>
      );
    case 'c':
      return (
        <svg {...common} fill="currentColor">
          <circle cx="12" cy="7.4" r="3.5" />
          <circle cx="7.3" cy="13.5" r="3.5" />
          <circle cx="16.7" cy="13.5" r="3.5" />
          <path d="M12 13.4 10.1 21.6h3.8z" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2.3C9.2 5.6 4.9 9 4.9 12.9c0 2.4 1.8 3.9 3.9 3.9 1.1 0 2.2-.5 2.9-1.3-.2 2.3-.9 3.6-2.2 4.9h5c-1.3-1.3-2-2.6-2.2-4.9.7.8 1.8 1.3 2.9 1.3 2.1 0 3.9-1.5 3.9-3.9 0-3.9-4.3-7.3-7.1-10.5z" />
        </svg>
      );
  }
}

export interface PlayingCardProps {
  card?: Card | null;
  faceDown?: boolean;
  size?: CardSize;
  dim?: boolean;
  highlight?: boolean;
  className?: string;
}

export function PlayingCard({
  card,
  faceDown = false,
  size = 'md',
  dim = false,
  highlight = false,
  className = '',
}: PlayingCardProps) {
  const s = SIZE[size];

  if (faceDown || !card) {
    return (
      <div
        role="img"
        aria-label="Carta virada para baixo"
        className={`relative shrink-0 overflow-hidden rounded-[6px] ${dim ? 'opacity-55' : ''} ${className}`}
        style={{
          width: s.w,
          height: s.h,
          background: 'linear-gradient(150deg, #1B2A38 0%, #0B141C 55%, #060B10 100%)',
          boxShadow: '0 8px 16px -10px rgba(0,0,0,0.95), inset 0 0 0 1px rgba(200,170,110,0.22)',
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(200,170,110,0.22) 0 1px, transparent 1px 5px)',
          }}
        />
        <span
          aria-hidden
          className="absolute inset-[2.5px] rounded-[4px] border border-[#c8aa6e]/30"
        />
        <span
          aria-hidden
          className="absolute inset-[18%] grid place-items-center border border-[#c8aa6e]/60 font-black text-[#c8aa6e]/90"
          style={{ fontSize: Math.max(7, s.rank * 0.62), letterSpacing: '-0.03em', clipPath: 'polygon(50% 0,100% 20%,90% 75%,50% 100%,10% 75%,0 20%)', background: 'linear-gradient(135deg,#c8aa6e22,#060609)' }}
        >
          M7
        </span>
      </div>
    );
  }

  const red = card.s === 'h' || card.s === 'd';
  const ink = red ? RED : INK;
  const label = cardLabel(card);

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative shrink-0 overflow-hidden rounded-[6px] ${dim ? 'opacity-60 saturate-50' : ''} ${className}`}
      style={{
        width: s.w,
        height: s.h,
        background: 'linear-gradient(158deg, #FFFFFF 0%, #F5F1E4 58%, #E5DDC8 100%)',
        boxShadow: highlight
          ? `0 0 0 1.5px rgba(255,183,0,0.85), 0 10px 20px -10px rgba(255,183,0,0.55)`
          : '0 8px 16px -10px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(23,24,27,0.12)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 76% 16%, rgba(255,255,255,0.95), transparent 58%)',
        }}
      />
      <div className="relative flex h-full flex-col justify-between p-[2px] sm:p-[3px]">
        <div className="flex flex-col items-center leading-none" style={{ color: ink }}>
          <span
            className="font-black tabular-nums"
            style={{ fontSize: s.rank, letterSpacing: '-0.05em' }}
          >
            {RANK[card.r]}
          </span>
          <SuitGlyph suit={card.s} size={s.suit} />
        </div>
        {s.big > 0 && (
          <div className="self-end pr-[1px] pb-[1px]" style={{ color: ink, opacity: 0.92 }}>
            <SuitGlyph suit={card.s} size={s.big} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Vaga de carta ainda não aberta (board incompleto). */
export function EmptyCardSlot({ size = 'md' }: { size?: CardSize }) {
  const s = SIZE[size];
  return (
    <div
      aria-hidden
      className="shrink-0 rounded-[6px] border border-dashed border-white/12 bg-black/20"
      style={{ width: s.w, height: s.h }}
    />
  );
}
