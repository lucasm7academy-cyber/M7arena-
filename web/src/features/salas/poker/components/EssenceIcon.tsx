// Essência (EA) — moeda fictícia da Sala M7. Não é o MC da carteira e não é
// sacável; o ícone existe para não confundir as duas moedas na mesa.
import { useId } from 'react';

interface EssenceIconProps {
  size?: number;
  className?: string;
}

export function EssenceIcon({ size = 14, className = '' }: EssenceIconProps) {
  const id = useId().replace(/:/g, '');
  const fill = `ea-${id}`;
  const shine = `ea-shine-${id}`;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A8F7E6" />
          <stop offset="52%" stopColor="#3FCBB8" />
          <stop offset="100%" stopColor="#18756C" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M12 1.4 21.1 8.1 17.5 22.6H6.5L2.9 8.1z" fill={`url(#${fill})`} />
      <path d="M12 1.4 5.4 12.2 12 22.6 18.6 12.2z" fill={`url(#${shine})`} />
      <path d="M2.9 8.1h18.2" stroke="#04251F" strokeOpacity="0.45" strokeWidth="1.1" />
    </svg>
  );
}
