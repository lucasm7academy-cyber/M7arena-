import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { gameAccounts } from "../../../db/schema/games.js";

/**
 * Refresh do elo dos jogadores (elo_cache) — fonte única da escrita de elo.
 *
 * Leve por design:
 *  - UMA varredura por execução, em lote com concorrência e pacing limitados
 *    (nunca estoura o rate limit da Riot: chave pessoal = 100 req/2min).
 *  - Grava só `elo_cache` (JSON pequeno) + `stats_updated_at` no
 *    `game_accounts.metadata` — não cria tabela nova nem infla o banco.
 *  - Cache em memória de 10min por puuid (evita re-busca num mesmo lote).
 *
 * Incidente 2026-10-07 (por que a falha da Riot não pode gravar): com ~261
 * contas e sem pacing, o refresh em massa tomou 429 na Riot; o erro era
 * tratado como "lista vazia" e o cache regravava `soloQ: null`, exibindo
 * jogadores de Diamante/Mestre como "Sem Rank" (e renovando o
 * stats_updated_at, o que atrasava a nova tentativa em 7 dias). Agora:
 * `null` = Riot falhou → cache preservado e contado em `erros`; `[]` = conta
 * genuinamente sem ranqueada → aí sim grava null.
 *
 * Uso:
 *  - Cron semanal:  runRefreshElos(db, { ttlMs: 7 * 24 * 60 * 60 * 1000 })
 *  - Botão admin:   runRefreshElos(db, { force: true }) — em background
 */

const RIOT_LEAGUE_URL = "https://br1.api.riotgames.com/lol/league/v4/entries/by-puuid";
const LEAGUE_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_STALE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_BATCH = 60;
const DEFAULT_CONCURRENCY = 3;
// ADR-069: 3 contas a cada 10s = 36 req/min (72/2min, teto pessoal é 100) —
// folga para os outros consumidores da Riot (séries, reconciliação).
const DEFAULT_PACE_MS = 10_000;

type LeagueFetcher = (puuid: string) => Promise<any[] | null>;

const leagueCache = new Map<string, { data: any[]; expiresAt: number }>();

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Busca o league (ranqueadas) de um puuid na Riot, com cache de 10min.
 * `null` = a Riot falhou (sem chave, 429 persistente, 5xx, rede) — NUNCA
 * confundir com `[]` (lista vazia = conta genuinamente sem ranqueada).
 */
async function fetchLeague(puuid: string): Promise<any[] | null> {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    console.warn("[atualizar-elos] RIOT_API_KEY não configurada — refresh abortado");
    return null;
  }

  const agora = Date.now();
  const cacheado = leagueCache.get(puuid);
  if (cacheado && cacheado.expiresAt > agora) return cacheado.data;

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const res = await fetch(`${RIOT_LEAGUE_URL}/${encodeURIComponent(puuid)}`, {
        headers: { "X-Riot-Token": apiKey },
      });

      if (res.status === 429 && tentativa === 0) {
        const header = Number(res.headers.get("retry-after"));
        const espera = Number.isFinite(header) && header > 0 ? Math.min(header, 30) : 5;
        console.warn(`[atualizar-elos] 429 na Riot — aguardando ${espera}s antes do retry`);
        await sleep(espera * 1000);
        continue;
      }
      if (!res.ok) {
        console.warn(`[atualizar-elos] fetchLeague ${puuid}: status ${res.status} (${res.statusText})`);
        return null;
      }
      const data: any[] = (await res.json()) as any[];
      leagueCache.set(puuid, { data, expiresAt: Date.now() + LEAGUE_CACHE_TTL_MS });
      return data;
    } catch (error: any) {
      console.warn(`[atualizar-elos] fetchLeague ${puuid} falhou:`, error?.message || error);
      return null;
    }
  }
  console.warn(`[atualizar-elos] fetchLeague ${puuid}: 429 persistiu após retry`);
  return null;
}

export interface RefreshElosOptions {
  /** `true` ignora o TTL e atualiza TODAS as contas com puuid (botão admin). */
  force?: boolean;
  /** Considera stale se stats_updated_at for mais antigo que isso (cron). */
  ttlMs?: number;
  /** Máximo de contas por execução (evita rodada longa). */
  limit?: number;
  /** Requisições Riot em paralelo (por lote). */
  concurrency?: number;
  /** Espera entre lotes, em ms. 0 desliga (usado nos testes). */
  paceMs?: number;
  /** Injeção usada pelos testes; em produção usa a Riot de verdade. */
  buscarLeague?: LeagueFetcher;
}

export interface RefreshElosResult {
  verificadas: number;
  atualizadas: number;
  erros: number;
}

export interface RefreshElosStatus {
  emAndamento: boolean;
  iniciadoEm: string | null;
  finalizadoEm: string | null;
  resultado: RefreshElosResult | null;
}

let statusAtual: RefreshElosStatus = {
  emAndamento: false,
  iniciadoEm: null,
  finalizadoEm: null,
  resultado: null,
};
let execucaoAtual: Promise<RefreshElosResult> | null = null;

export function getRefreshElosStatus(): RefreshElosStatus {
  return { ...statusAtual };
}

/**
 * Single-flight: se já existe um refresh rodando (cron ou botão), devolve a
 * MESMA execução em vez de iniciar outra — duas varreduras paralelas estouram
 * o rate limit da Riot.
 */
export function runRefreshElos(db: any, opts: RefreshElosOptions = {}): Promise<RefreshElosResult> {
  if (execucaoAtual) return execucaoAtual;
  execucaoAtual = executarRefresh(db, opts).finally(() => {
    execucaoAtual = null;
  });
  return execucaoAtual;
}

async function executarRefresh(db: any, opts: RefreshElosOptions): Promise<RefreshElosResult> {
  const {
    force = false,
    ttlMs = DEFAULT_STALE_TTL_MS,
    limit = DEFAULT_BATCH,
    concurrency = DEFAULT_CONCURRENCY,
    paceMs = DEFAULT_PACE_MS,
    buscarLeague = fetchLeague,
  } = opts;

  statusAtual = {
    emAndamento: true,
    iniciadoEm: new Date().toISOString(),
    finalizadoEm: null,
    resultado: null,
  };

  try {
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

    const rows = await db.select().from(gameAccounts).where(and(...clauses)).limit(limit);

    let atualizadas = 0;
    let erros = 0;

    for (let i = 0; i < rows.length; i += concurrency) {
      const fatia = rows.slice(i, i + concurrency);
      await Promise.all(
        fatia.map(async (conta: any) => {
          try {
            const entries = await buscarLeague(conta.externalId);

            // Riot falhou → NÃO grava nada (cache anterior preservado e o
            // stats_updated_at fica velho de propósito, para a próxima rodada
            // tentar de novo).
            if (entries === null) {
              erros++;
              console.warn(
                `[atualizar-elos] Riot falhou para ${conta.handle ?? conta.externalId} — cache preservado`
              );
              return;
            }

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

      // Pacing entre lotes (ADR-069): sem isso um refresh em massa toma 429.
      if (paceMs > 0 && i + concurrency < rows.length) await sleep(paceMs);
    }

    const resultado: RefreshElosResult = { verificadas: rows.length, atualizadas, erros };
    statusAtual = {
      emAndamento: false,
      iniciadoEm: statusAtual.iniciadoEm,
      finalizadoEm: new Date().toISOString(),
      resultado,
    };
    return resultado;
  } catch (error: any) {
    statusAtual = {
      ...statusAtual,
      emAndamento: false,
      finalizadoEm: new Date().toISOString(),
    };
    throw error;
  }
}
