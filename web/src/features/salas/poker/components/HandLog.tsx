// Histórico da mesa: ações, ruas e resultado da mão atual. O motor já entrega
// as entradas da mais recente para a mais antiga.
import { ScrollText } from 'lucide-react';
import type { LogEntry } from '../domain/engine';

const CORES: Record<LogEntry['kind'], string> = {
  action: 'text-white/70',
  street: 'text-[#FFB700]',
  result: 'text-[#6fe3d0]',
  system: 'text-white/35',
};

export interface HandLogProps {
  log: LogEntry[];
  handNo: number;
}

export function HandLog({ log, handNo }: HandLogProps) {
  return (
    <section
      aria-label={`Histórico da mão ${handNo}`}
      className="flex flex-col overflow-hidden rounded-[8px] border border-white/10 bg-[rgba(13,13,13,0.8)]"
    >
      <header className="flex items-center justify-between border-b border-white/8 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/45">
          <ScrollText className="h-3 w-3 text-[#FFB700]" />
          Histórico
        </span>
        <span className="text-[9px] font-black uppercase tracking-wider text-white/30">
          Mão #{handNo}
        </span>
      </header>

      <div className="max-h-[230px] min-h-[120px] overflow-y-auto px-3 py-2 lg:max-h-[330px]">
        {log.length === 0 ? (
          <p className="py-6 text-center text-[10px] font-bold uppercase tracking-wider text-white/20">
            As ações da mão aparecem aqui
          </p>
        ) : (
          <ul className="space-y-1">
            {log.map((entrada) => (
              <li
                key={entrada.id}
                className={`flex gap-1.5 text-[10px] leading-snug ${CORES[entrada.kind]}`}
              >
                <span
                  aria-hidden
                  className={`mt-[5px] h-1 w-1 shrink-0 rounded-full ${
                    entrada.kind === 'street'
                      ? 'bg-[#FFB700]'
                      : entrada.kind === 'result'
                        ? 'bg-[#6fe3d0]'
                        : 'bg-white/25'
                  }`}
                />
                <span className={entrada.kind === 'street' ? 'font-black uppercase tracking-wide' : ''}>
                  {entrada.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
