import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { api } from '../../../lib/api';
import type { ApiAimMode, ApiAimScore } from '../../../lib/api';
import { MODE_LABEL, SEED_LEADERBOARD } from '../domain/engine';
import { AIM_CUT_CARD, AIM_CUT_CARD_IN } from './frames';

interface AimLeaderboardProps {
  /** Muda quando o servidor aceita uma nota nova; força recarregar. */
  refreshKey?: number;
  /** Nome do jogador logado, para destacar a própria linha se o servidor não marcar. */
  highlightName?: string | null;
}

type Filter = 'all' | ApiAimMode;
type Status = 'loading' | 'ready' | 'error';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'flick', label: 'Flick' },
  { value: 'track', label: 'Movimento' },
  { value: 'precision', label: 'Precisão' },
];

const GRADE_TINT: Record<string, string> = {
  SS: '#c8aa6e',
  S: '#f0d9a8',
  A: '#3fbf9a',
  B: '#5b8def',
  C: '#b07be0',
  D: '#c14b4b',
};

const filterLabel = (value: Filter) => (value === 'all' ? 'todos os modos' : MODE_LABEL[value]);

/** O servidor guarda o percentual inteiro; não inventar decimal à toa. */
const formatAccuracy = (value: number) => {
  const accuracy = Number(value);
  if (!Number.isFinite(accuracy)) return '—';
  return `${Number.isInteger(accuracy) ? accuracy : accuracy.toFixed(1)}%`;
};

/**
 * Ranking geral do treino de mira. A lista vem do servidor (`/api/aim/leaderboard`);
 * a semente do motor só aparece como exemplo quando a API não responde.
 */
export function AimLeaderboard({ refreshKey = 0, highlightName = null }: AimLeaderboardProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<ApiAimScore[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    api.aim
      .leaderboard(filter, 25)
      .then((response) => {
        if (cancelled) return;
        setRows(Array.isArray(response?.rows) ? response.rows : []);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [filter, refreshKey, reloadToken]);

  const changeFilter = useCallback((value: Filter) => {
    setFilter(value);
    setRows([]);
  }, []);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const example = status === 'error';
  const visible: ApiAimScore[] = example
    ? SEED_LEADERBOARD.filter((row) => filter === 'all' || row.mode === filter)
    : rows;
  const normalizedName = (highlightName ?? '').trim().toLowerCase();

  return (
    <section aria-labelledby="aim-ranking-title" className="w-full">
      <div className="flex flex-col gap-4 border-b border-white/5 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2.5">
            <span className="h-[2px] w-8 bg-[#FFB700]" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FFB700]">Ranking do servidor</span>
          </span>
          <h2
            id="aim-ranking-title"
            className="mt-2 flex items-center gap-3 text-3xl font-black uppercase tracking-tighter text-white sm:text-4xl"
          >
            <Trophy className="h-6 w-6 text-[#FFB700] sm:h-7 sm:w-7" aria-hidden="true" />
            Melhores <span className="text-[#FFB700]">miras</span>
          </h2>
        </div>

        <div role="group" aria-label="Filtrar ranking por modo" className="flex flex-wrap items-center gap-2">
          {FILTERS.map((option) => {
            const active = option.value === filter;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => changeFilter(option.value)}
                aria-pressed={active}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB700] ${
                  active
                    ? 'bg-[#FFB700] text-black'
                    : 'border border-white/10 text-white/50 hover:border-white/30 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={reload}
            aria-label="Recarregar ranking"
            className="inline-flex h-7 w-7 items-center justify-center border border-white/10 text-white/40 transition-colors hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB700]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mt-4">
        {example && (
          <p className="mb-3 border-l-2 border-[#FFB700]/50 bg-[#FFB700]/[0.04] px-3 py-2 text-[11px] leading-relaxed text-white/55">
            O ranking do servidor não respondeu agora. As linhas abaixo são <strong className="text-white/75">exemplos</strong>{' '}
            de referência, não notas reais — jogue uma rodada e tente recarregar.
          </p>
        )}

        {status === 'loading' && visible.length === 0 && (
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse bg-white/[0.03]" />
            ))}
          </div>
        )}

        {(status !== 'loading' || visible.length > 0) && visible.length > 0 && (
          <div
            className="relative overflow-hidden p-[1px] bg-white/10"
            style={{ clipPath: AIM_CUT_CARD }}
          >
            <div className="overflow-x-auto bg-[#08080a]" style={{ clipPath: AIM_CUT_CARD_IN }}>
              <table className="w-full min-w-[540px] border-collapse text-left">
                <caption className="sr-only">
                  Melhores notas do treino de mira em {filterLabel(filter)}
                </caption>
                <thead>
                  <tr className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                    <th scope="col" className="w-12 px-3 py-2.5 font-black">#</th>
                    <th scope="col" className="px-3 py-2.5 font-black">Jogador</th>
                    <th scope="col" className="w-14 px-3 py-2.5 font-black">Nota</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-black">Pontos</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-black">Acerto</th>
                    <th scope="col" className="hidden px-3 py-2.5 text-right font-black sm:table-cell">APM</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, index) => {
                    const mine =
                      Boolean(row.hero) ||
                      (normalizedName.length > 0 && row.name.trim().toLowerCase() === normalizedName);
                    const tint = GRADE_TINT[row.grade] ?? '#8a8a92';
                    return (
                      <tr
                        key={row.id ?? `${row.name}-${index}`}
                        className={`border-t border-white/[0.04] transition-colors ${
                          mine ? 'bg-[#FFB700]/[0.07]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-anton text-sm tabular-nums ${
                              index < 3 ? 'text-[#FFB700]' : 'text-white/30'
                            }`}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`max-w-[190px] truncate text-[13px] font-black uppercase tracking-tight ${
                                mine ? 'text-[#FFB700]' : 'text-white'
                              }`}
                            >
                              {row.name}
                            </span>
                            {mine && (
                              <span className="shrink-0 border border-[#FFB700]/40 px-1.5 py-0.5 text-[8px] font-black uppercase leading-none tracking-[0.18em] text-[#FFB700]">
                                Você
                              </span>
                            )}
                            {example && (
                              <span className="shrink-0 border border-white/15 px-1.5 py-0.5 text-[8px] font-black uppercase leading-none tracking-[0.18em] text-white/35">
                                Exemplo
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] uppercase tracking-[0.16em] text-white/25">
                            {MODE_LABEL[row.mode]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-flex h-6 w-8 items-center justify-center border text-[11px] font-black"
                            style={{ color: tint, borderColor: `${tint}55`, backgroundColor: `${tint}14` }}
                          >
                            {row.grade}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-anton text-sm tabular-nums text-white">
                          {row.score.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[12px] font-bold tabular-nums text-white/65">
                          {formatAccuracy(row.accuracy)}
                        </td>
                        <td className="hidden px-3 py-2.5 text-right text-[12px] font-bold tabular-nums text-white/65 sm:table-cell">
                          {row.apm}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {status === 'ready' && visible.length === 0 && (
          <p className="border border-dashed border-white/10 bg-white/[0.015] px-4 py-6 text-center text-[12px] text-white/45">
            Nenhuma nota registrada em {filterLabel(filter)} ainda. Jogue uma rodada para abrir o ranking.
          </p>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-white/25">
          Top 25 do servidor. A nota é recalculada no envio — o placar local é só a prévia.
        </p>
      </div>
    </section>
  );
}
