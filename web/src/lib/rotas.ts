/**
 * Rota pública de uma SALA pelo modo do banco.
 *
 * Os modos de time têm rota própria (`/sala-time/:id` → SalaCampeonato e
 * `/campeonato/sala/:id`); os demais seguem `/:modo/:id`. Montar a URL direto
 * com o modo cru gera `/time_vs_time_livre/217` — rota que NÃO existe no
 * App.tsx (erro "No routes matched"), que apareceu no card de partidas
 * finalizadas em 2026-10-24.
 */
export function rotaDaSala(modo: string | null | undefined, id: number | string): string {
  if (modo === 'campeonato') return `/campeonato/sala/${id}`;
  if (modo === 'time_vs_time_livre') return `/sala-time/${id}`;
  if (modo === 'time_vs_time') return `/time_vs_time/${id}`;
  return `/${modo || '5v5'}/${id}`;
}
