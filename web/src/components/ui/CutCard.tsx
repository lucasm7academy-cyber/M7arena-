// src/components/ui/CutCard.tsx
// Card com borda "cortada" (clip-path 12px), mesmo padrão dos cards de
// campeonato e vagas de sala. O fundo é uma camada absoluta clipada (frame
// p-[1px] + fill); o conteúdo flui por cima sem clip, permitindo que
// elementos vazem (ex.: dropdowns) quando o container não tiver overflow-hidden.
import { motion } from 'motion/react';

const CUT_OUTER = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const CUT_INNER = 'polygon(11.4px 0, 100% 0, 100% calc(100% - 11.4px), calc(100% - 11.4px) 100%, 0 100%, 0 11.4px)';

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
  background = 'rgba(255,255,255,0.03)',
  borderColor = '#FFB800',
  children,
  ...rest
}: CutCardProps) {
  return (
    <motion.div {...rest} className={`relative ${className}`}>
      <div className="absolute inset-0 p-[1px]" style={{ backgroundColor: borderColor, clipPath: CUT_OUTER }}>
        <div className="w-full h-full" style={{ clipPath: CUT_INNER, background, backdropFilter: 'blur(16px)' }} />
      </div>
      <div className={`relative ${contentClassName}`}>{children}</div>
    </motion.div>
  );
}
