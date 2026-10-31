// src/components/ui/CutCard.tsx
// Card com borda "cortada" (clip-path 12px), mesmo padrão dos cards de
// campeonato e vagas de sala. O fundo é uma camada absoluta clipada (frame
// da borda + fill opaco da cor do card); o conteúdo flui por cima sem clip,
// permitindo que elementos vazem (ex.: dropdowns) quando o container não
// tiver overflow-hidden. O fill precisa ser opaco para a cor do frame não
// atravessar o card.
import { motion } from 'motion/react';

export const CUT_OUTER = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
export const CUT_INNER = 'polygon(11.8px 0, 100% 0, 100% calc(100% - 11.8px), calc(100% - 11.8px) 100%, 0 100%, 0 11.8px)';

// Canto interno para uma moldura de `borderWidth` px. Na diagonal o corte
// "anda" √2 × a espessura, então o canto interno precisa encolher mais que as
// retas — sem isso a borda fica visivelmente mais grossa nos cantos.
// Ex.: corte 9px com borda 2px -> canto interno 7.83px.
export function cutPolygon(corner: number, borderWidth = 0): string {
  const c = Math.max(0, corner - borderWidth * (2 - Math.SQRT2));
  const v = Number(c.toFixed(2));
  return `polygon(${v}px 0, 100% 0, 100% calc(100% - ${v}px), calc(100% - ${v}px) 100%, 0 100%, 0 ${v}px)`;
}

interface CutCardProps {
  className?: string;
  contentClassName?: string;
  background?: string;
  borderColor?: string;
  children: React.ReactNode;
  [key: string]: any;
}

export function CutCard({
  className = '',
  contentClassName = '',
  background = '#0A0A0A',
  borderColor = 'rgba(255,255,255,0.1)',
  children,
  ...rest
}: CutCardProps) {
  return (
    <motion.div {...rest} className={`relative ${className}`}>
      <div className="absolute inset-0" style={{ backgroundColor: borderColor, clipPath: CUT_OUTER }} />
      <div className="absolute inset-[1px]" style={{ backgroundColor: background, clipPath: CUT_INNER }} />
      <div className={`relative ${contentClassName}`}>{children}</div>
    </motion.div>
  );
}
