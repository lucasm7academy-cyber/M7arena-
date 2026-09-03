import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../db.js";
import { gameAccounts } from "../../../db/schema/games.js";

/**
 * Refresh do elo dos jogadores (elo_cache) — fonte única da escrita de elo.
 *
 * Leve por design:
 *  - UMA varredura por execução, em lote com concorrência limitada (nunca
 *    estoura o rate limit da Riot nem pico de SQL).
 *  - Grava só `elo_cache` (JSON pequeno) + `stats_updated_at` no
 *    `game_accounts.metadata` — não cria tabela nova nem infla o banco.
 *  - Cache em memória de 10min por puuid (evita re-busca num mesmo lote).
 *
 * Uso:
 *  - Cron semanal:  runRefreshElos({ ttlMs: 7 * 24 * 60 * 60 * 1000 })
 *  - Botão admin:   runRefreshElos({ force: true })
 */

const RIOT_LEAGUE_URL = "https://br1.api.riotgames.com/lol/league/v4/entries/by-puuid";
const LEAGUE_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_STALE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_BATCH = 60;
const DEFAULT_CONCURRENCY = 3;

const leagueCache = new Map<string, { data: any[]; expiresAt: number }>();

/** Busca o league (ranqueadas) de um puuid na Riot, com cache de 10min.
 *  Nunca lança: sem RIOT_API_KEY, erro HTTP (429/5xx) ou de rede → [] + warn. */
async function fetchLeague(puuid: string): Promise<any[]> {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) return [];

  const agora = Date.now();
  const cacheado = leagueCache.get(puuid);
  if (cacheado && cacheado.expiresAt > agora) return cacheado.data;

  try {
    const res = await fetch(`${RIOT_LEAGUE_URL}/${encodeURIComponent(puuid)}`, {
      headers: { "X-Riot-Token": apiKey },
    });
    if (!res.ok) {
      console.warn(`[atualizar-elos] fetchLeague ${puuid}: status ${res.status} (${res.statusText})`);
      return [];
    }
    const data: any[] = (await res.json()) as any[];
    leagueCache.set(puuid, { data, expiresAt: agora + LEAGUE_CACHE_TTL_MS });
    return data;
  } catch (error: any) {
    console.warn(`[atualizar-elos] fetchLeague ${puuid} falhou:`, error?.message || error);
    return [];
  }
}

export interface RefreshElosOptions {
  /** `true` ignora o TTL e atualiza TODAS as contas com puuid (botão admin). */
  force?: boolean;
  /** Considera stale se stats_updated_at for mais antigo que isso (cron). */
  ttlMs?: number;
  /** Máximo de contas por execução (evita rodada longa). */
  limit?: number;
  /** Requisições Riot em paralelo. */
  concurrency?: number;
}

export interface RefreshElosResult {
  verificadas: number;
  atualizadas: number;
  erros: number;
}

export async function runRefreshElos(
  opts: RefreshElosOptions = {}
): Promise<RefreshElosResult> {
  const {
    force = false,
    ttlMs = DEFAULT_STALE_TTL_MS,
    limit = DEFAULT_BATCH,
    concurrency = DEFAULT_CONCURRENCY,
  } = opts;

  const limite = new Date(Date.now() - ttlMs).toISOString();

  const clauses: any[] = [eq(gameAccounts.gameId, "lol"), isNotNull(gameAccounts.externalId)];
  if (!force) {
    clauses.push(
      or(
        sql`${gameAccounts.metadata}->'elo_cache' IS NULL`,
        sql`${gameAccounts.metadata}->>'stats_updated_at' IS NULL`,
        sql`${gameAccounts.metadata}->>'stats_updated_at' < ${limite}`
      )
    );
  }

  const rows = await db
    .select()
    .from(gameAccounts)
    .where(and(...clauses))
    .limit(limit);

  let atualizadas = 0;
  let erros = 0;

  for (let i = 0; i < rows.length; i += concurrency) {
    const fatia = rows.slice(i, i + concurrency);
    await Promise.all(
      fatia.map(async (conta) => {
        try {
          const entries = await fetchLeague(conta.externalId);
          const soloEntry = entries.find((e: any) => e.queueType === "RANKED_SOLO_5x5");
          const flexEntry = entries.find((e: any) => e.queueType === "RANKED_FLEX_SR");

          // Sem entrada da fila → null. NUNCA gravar IRON por fallback: jogador
          // sem ranked aparece como "Sem Rank", não como Ferro.
          const eloCache = {
            soloQ: soloEntry
              ? {
                  tier: soloEntry.tier ?? null,
                  rank: soloEntry.rank ?? null,
                  lp: soloEntry.leaguePoints ?? 0,
                  wins: soloEntry.wins ?? 0,
                  losses: soloEntry.losses ?? 0,
                }
              : null,
            flexQ: flexEntry
              ? {
                  tier: flexEntry.tier ?? null,
                  rank: flexEntry.rank ?? null,
                  lp: flexEntry.leaguePoints ?? 0,
                  wins: flexEntry.wins ?? 0,
                  losses: flexEntry.losses ?? 0,
                }
              : null,
          };

          const meta = (conta.metadata as Record<string, any>) || {};
          await db
            .update(gameAccounts)
            .set({
              metadata: { ...meta, elo_cache: eloCache, stats_updated_at: new Date().toISOString() },
              updatedAt: new Date(),
            })
            .where(eq(gameAccounts.id, conta.id));
          atualizadas++;
        } catch (error: any) {
          erros++;
          console.warn(
            `[atualizar-elos] refresh falhou para ${conta.handle ?? conta.externalId}:`,
            error?.message || error
          );
        }
      })
    );
  }

  return { verificadas: rows.length, atualizadas, erros };
}
