import { MODE_LABEL } from '../domain/engine';
import type { AimMode } from '../domain/engine';
import type { AimHud as AimHudData } from '../hooks/useAimGame';

export function AimHud({ hud, mode, playing }: { hud: AimHudData; mode: AimMode; playing: boolean }) {
  const color = mode === 'flick' ? '#38e8ff' : mode === 'track' ? '#3fbf9a' : '#a855f7';
  const metrics = [
    ['Tempo', `${Math.ceil(hud.remainingMs / 1000)}s`],
    ['Pontos', hud.score.toLocaleString('pt-BR')],
    ['Combo', `x${hud.combo}`],
    ['Acerto', `${hud.accuracy.toFixed(1)}%`],
    ['APM', String(hud.apm)],
  ];
  return (
    <div role="group" aria-label="Placar da rodada" className="border border-white/10 bg-[rgba(13,13,13,0.8)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color }}>{MODE_LABEL[mode]}</span>
        <div className="grid flex-1 grid-cols-5 gap-2 sm:max-w-2xl">
          {metrics.map(([label, value]) => (
            <div key={label} className="min-w-0 text-center">
              <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-white/40">{label}</p>
              <p className={`truncate text-sm font-black tabular-nums sm:text-xl ${label === 'Tempo' && playing && hud.remainingMs < 5000 ? 'text-red-400' : 'text-white'}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="h-0.5 bg-white/5"><div className="h-full transition-[width] duration-200" style={{ width: `${hud.progress}%`, background: color }} /></div>
    </div>
  );
}
