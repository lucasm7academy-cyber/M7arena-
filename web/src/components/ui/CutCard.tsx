// src/components/ui/CutCard.tsx
// Borda com cantos RECORTADOS sem o bug clássico: `clipPath` corta a borda do
// PRÓPRIO elemento junto com o canto — aí a borda some nas arestas diagonais.
//
// Solução (padrão do projeto): o WRAPPER recortado pinta a "borda" (backgroundColor
// = cor da borda) e o conteúdo entra num FILHO com o clip INTERNO (corte menor),
// deixando a espessura visível em TODAS as arestas, inclusive as diagonais.
//
// USE SEMPRE ESTE COMPONENTE quando precisar de borda + canto recortado.
// Não use `border` direto em elemento com `clipPath` — é exatamente o bug.
//
// Os pares de clip do projeto vêm de componentes/draft (CUT_BUTTON +
// CUT_BUTTON_INNER, CUT_FRAME + CUT_FRAME_INNER, etc.). Para o brilho (glow),
// aplique `filter: drop-shadow(...)` num wrapper SEM clip — o drop-shadow segue
// o recorte; box-shadow seria cortado junto.
import type { CSSProperties, ReactNode } from 'react';

interface CutCardProps {
  /** Cor da "borda" (pinta o wrapper recortado). Pode ser rgba. */
  borderColor: string;
  /** Espessura da borda em px. @default 1.5 */
  thickness?: number;
  /** Polygon externo (maior) — ex.: CUT_BUTTON. */
  outerClip: string;
  /** Polygon interno (corte menor) — ex.: CUT_BUTTON_INNER. */
  innerClip: string;
  /** Fundo do conteúdo. @default 'transparent' */
  background?: string;
  /** Classes do wrapper (borda). */
  className?: string;
  /** Classes do conteúdo (filho). */
  innerClassName?: string;
  /** Estilos extras do wrapper. */
  style?: CSSProperties;
  children: ReactNode;
}

export function CutCard({
  borderColor,
  thickness = 1.5,
  outerClip,
  innerClip,
  background = 'transparent',
  className = '',
  innerClassName = '',
  style,
  children,
}: CutCardProps) {
  return (
    <div className={className} style={{ padding: `${thickness}px`, backgroundColor: borderColor, clipPath: outerClip, ...style }}>
      <div className={`w-full h-full ${innerClassName}`} style={{ backgroundColor: background, clipPath: innerClip }}>
        {children}
      </div>
    </div>
  );
}
