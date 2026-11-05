import React from 'react';

/**
 * Ícone da moeda da plataforma (E).
 * Arte oficial do Blue Essence (League) — assets em /public/images/be-icon.png.
 */
export const MCIcon: React.FC<{ className?: string; size?: number; style?: React.CSSProperties }> = ({
  className = '',
  size,
  style,
}) => (
  <img
    src="/images/be-icon.png"
    alt="E"
    draggable={false}
    className={`inline-block object-contain shrink-0 ${className}`}
    style={{ ...(size ? { width: size, height: size } : null), ...style }}
  />
);

export default MCIcon;
