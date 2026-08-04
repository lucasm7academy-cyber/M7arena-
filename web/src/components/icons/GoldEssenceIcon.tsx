import React, { useId } from 'react';

/**
 * Ícone da moeda M7 (Gold Essence) — o mesmo SVG do DepositModal, extraído
 * para reuso no header da sidebar. Visual idêntico (ADR-005); apenas os ids
 * internos do SVG são únicos por instância via useId, para que dois ícones na
 * mesma página não colidam no `url(#glow)`/`url(#essence_grad)`.
 */
const GoldEssenceIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const glowId = `glow_${uid}`;
  const gradId = `essence_grad_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g filter={`url(#${glowId})`}>
        <path
          d="M16 2L22 16L16 30L10 16L16 2Z"
          fill={`url(#${gradId})`}
        />
        <path d="M16 2L16 30L10 16L16 2Z" fill="white" fillOpacity="0.2" />
        <path d="M16 2L22 16L16 16L16 2Z" fill="white" fillOpacity="0.1" />
        <path d="M25 10L28 13L24 14L25 10Z" fill="#FFD700" />
        <path d="M7 20L4 23L8 24L7 20Z" fill="#E6A600" />
        <path d="M23 24L25 27L21 28L23 24Z" fill="#FFD700" opacity="0.6" />
      </g>
      <defs>
        <linearGradient id={gradId} x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD700" />
          <stop offset="0.5" stopColor="#E6A600" />
          <stop offset="1" stopColor="#996F00" />
        </linearGradient>
        <filter id={glowId} x="0" y="0" width="32" height="32" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
};

export default GoldEssenceIcon;
