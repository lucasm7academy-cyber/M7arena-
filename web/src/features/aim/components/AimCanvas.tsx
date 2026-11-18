import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { AIM_CUT_ARENA, AIM_CUT_ARENA_IN } from './frames';

interface AimCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  playing: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
  onPointerUp: () => void;
  /** Sobreposições: convite para começar e resultado da rodada. */
  children?: ReactNode;
  label: string;
}

/**
 * Arena de mira: moldura recortada da casa + canvas responsivo. O desenho é
 * feito pelo loop do `useAimGame`; este componente só entrega o elemento e o
 * palco para os overlays.
 */
export function AimCanvas({
  canvasRef,
  playing,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onPointerUp,
  children,
  label,
}: AimCanvasProps) {
  return (
    <div
      className="relative bg-gradient-to-br from-[#ff5fa2]/40 to-[#38e8ff]/40 p-[1px] shadow-[inset_0_0_0_1px_#ffffff0f,0_0_30px_#38e8ff18]"
      style={{ clipPath: AIM_CUT_ARENA }}
    >
      <div className="relative overflow-hidden bg-[#07070a]" style={{ clipPath: AIM_CUT_ARENA_IN }}>
        <div className="relative h-[calc(100dvh-150px)] min-h-[220px] w-full">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={label}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerLeave}
            onLostPointerCapture={onPointerUp}
            className={`block h-full w-full touch-none select-none ${playing ? 'cursor-none' : 'cursor-crosshair'}`}
          />

          {/* textura de varredura bem leve, sem atrapalhar a leitura dos alvos */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)',
            }}
          />

          {/* cantos de mira */}
          <span className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 border-l border-t border-[#FFB700]/45" />
          <span className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 border-r border-t border-[#FFB700]/45" />
          <span className="pointer-events-none absolute bottom-3 left-3 h-3.5 w-3.5 border-b border-l border-[#FFB700]/45" />
          <span className="pointer-events-none absolute bottom-3 right-3 h-3.5 w-3.5 border-b border-r border-[#FFB700]/45" />

          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
