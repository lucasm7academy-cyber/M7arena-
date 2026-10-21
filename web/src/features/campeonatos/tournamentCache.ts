/**
 * tournamentCache.ts — cache em memória do detalhe do campeonato.
 *
 * O detalhe agora é particionado (shell + seções por aba). Sem cache, cada
 * navegação para fora e volta refaz shell + classificação; com ele, voltar
 * dentro de 30s é instantâneo. O prefetch do card (`prefetchTournament`) usa o
 * mesmo cache, então o clique no card já encontra o shell carregado.
 *
 * Invalidação: toda escrita do campeonato chama `invalidateTournament(id)`.
 * Leitura de refetch após ação (ex.: verificar série) passa `force: true` para
 * não servir dado velho.
 */
import { api, type ApiLegacyTournament, type TournamentSection } from "../../lib/api";

const TTL_MS = 30_000;

type Entry = { ts: number; data: any };

const shellCache = new Map<string, Entry>();
const sectionCache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<any>>();

const sectionKey = (id: string, section: TournamentSection) => `${id}:${section}`;

function isFresh(entry?: Entry) {
  return !!entry && Date.now() - entry.ts < TTL_MS;
}

/** Deduplica chamadas concorrentes (prefetch + montagem da página). */
function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = run().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export async function loadShell(id: string, opts: { force?: boolean } = {}): Promise<ApiLegacyTournament> {
  const cached = shellCache.get(id);
  if (!opts.force && isFresh(cached)) return cached!.data;
  return once(`shell:${id}`, async () => {
    const data = await api.tournaments.shell(id);
    shellCache.set(id, { ts: Date.now(), data });
    return data;
  });
}

export async function loadSection(
  id: string,
  section: TournamentSection,
  opts: { force?: boolean } = {}
): Promise<Partial<ApiLegacyTournament>> {
  const key = sectionKey(id, section);
  const cached = sectionCache.get(key);
  if (!opts.force && isFresh(cached)) return cached!.data;
  return once(`section:${key}`, async () => {
    const data = await api.tournaments.section(id, section);
    sectionCache.set(key, { ts: Date.now(), data });
    return data;
  });
}

/** Descarta o cache do campeonato (usar depois de qualquer escrita). */
export function invalidateTournament(id: string) {
  shellCache.delete(id);
  for (const key of Array.from(sectionCache.keys())) {
    if (key.startsWith(`${id}:`)) sectionCache.delete(key);
  }
}

/**
 * Prefetch disparado no hover/focus do card. Falha aqui não é erro de tela:
 * a navegação normal tenta de novo e mostra o erro de verdade.
 */
export function prefetchTournament(id: string): Promise<void> {
  return Promise.all([loadShell(id), loadSection(id, "classificacao")])
    .then(() => undefined)
    .catch((err: any) => {
      console.warn("prefetch do campeonato falhou:", err?.message || err);
    });
}
