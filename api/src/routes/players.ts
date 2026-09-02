import { Router } from "express";
import { eq, and, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../db.js";
import { userSessions, users } from "../../../db/schema/identidade.js";
import { gameAccounts } from "../../../db/schema/games.js";

export const playersRouter = Router();

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function getAuthUser(req: any) {
  const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;

  const [session] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
    .limit(1);

  if (!session) return null;
  return { id: session.userId };
}

/** Shape legado de contas_riot (mesmo tradutor de profiles.ts — fork consome). */
function toLegacyRiot(ga: any) {
  if (!ga) return null;
  const m = (ga.metadata as Record<string, any>) || {};
  return {
    user_id: ga.userId,
    riot_id: ga.handle,
    puuid: ga.externalId,
    summoner_id: m.summoner_id ?? null,
    level: m.level ?? null,
    profile_icon_id: m.profile_icon_id ?? null,
    elo_cache: m.elo_cache ?? null,
    champions_cache: m.champions_cache ?? null,
    stats_updated_at: m.stats_updated_at ?? null,
    verified_at: ga.syncedAt ?? ga.createdAt ?? null,
    created_at: ga.createdAt,
  };
}

const RIOT_LEAGUE_URL = "https://br1.api.riotgames.com/lol/league/v4/entries/by-puuid";
const LEAGUE_CACHE_TTL_MS = 10 * 60 * 1000; // cache em memória por puuid
const ELO_CACHE_TTL_MS = 30 * 60 * 1000; // conta é "stale" se stats_updated_at mais velho que isso
const REFRESH_BATCH_LIMIT = 60; // máx de contas por chamada de refresh
const REFRESH_CONCURRENCY = 3; // nunca estourar rate limit da Riot

const leagueCache = new Map<string, { data: any[]; expiresAt: number }>();

/** Busca o league (ranqueadas) de um puuid na Riot, com cache em memória de 10min.
 *  Nunca lança: sem RIOT_API_KEY, erro HTTP (429/5xx) ou de rede → [] + console.warn. */
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
      console.warn(`[players] fetchLeague ${puuid}: status ${res.status} (${res.statusText})`);
      return [];
    }
    const data: any[] = (await res.json()) as any[];
    leagueCache.set(puuid, { data, expiresAt: agora + LEAGUE_CACHE_TTL_MS });
    return data;
  } catch (error: any) {
    console.warn(`[players] fetchLeague ${puuid} falhou:`, error?.message || error);
    return [];
  }
}

// GET /api/players/search?q= — busca jogadores pelo Riot ID (parcial)
playersRouter.get("/search", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json([]);

    const rows = await db
      .select()
      .from(gameAccounts)
      .where(and(eq(gameAccounts.gameId, "lol"), ilike(gameAccounts.handle, `%${q}%`)))
      .limit(8);

    return res.json(rows.map(toLegacyRiot));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar jogadores" });
  }
});

// GET /api/players/by-ids?ids=a,b,c — lote de contas Riot por user_id
// POST /api/players/by-ids — body { ids: string[] } (mesma busca; o GET estoura
// o request line do nginx com a base cheia — 232+ ids ≈ 8.5KB → 414).
playersRouter.get("/by-ids", async (req, res) => {
  return buscarContasPorIds(String(req.query.ids || ""), req, res);
});
playersRouter.post("/by-ids", async (req, res) => {
  const idsRaw = Array.isArray(req.body?.ids) ? (req.body.ids as string[]).join(",") : "";
  return buscarContasPorIds(idsRaw, req, res);
});

async function buscarContasPorIds(idsRaw: string, req: any, res: any) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    // game_accounts.user_id é UUID: qualquer id fora desse formato faria o
    // inArray lançar `invalid input syntax for type uuid` → 500, derrubando a
    // página do time inteira. Filtra os inválidos antes de tocar o banco.
    const ids = idsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => UUID_RE.test(s));

    if (ids.length === 0) return res.json([]);
    if (ids.length > 500) {
      return res.status(400).json({ error: "Limite de 500 userIds por consulta" });
    }

    const rows = await db
      .select()
      .from(gameAccounts)
      .where(and(eq(gameAccounts.gameId, "lol"), inArray(gameAccounts.userId, ids)));
    return res.json(rows.map(toLegacyRiot));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar contas" });
  }
}

// GET /api/players/by-puuid/:puuid — conta Riot por PUUID (público)
playersRouter.get("/by-puuid/:puuid", async (req, res) => {
  try {
    const { puuid } = req.params;
    const [row] = await db
      .select()
      .from(gameAccounts)
      .where(and(eq(gameAccounts.gameId, "lol"), eq(gameAccounts.externalId, puuid)))
      .limit(1);
    return res.json(toLegacyRiot(row));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar conta por PUUID" });
  }
});

// GET /api/players/count — total de contas Riot vinculadas (dashboard admin)
playersRouter.get("/count", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const rows = await db
      .select({ id: gameAccounts.id })
      .from(gameAccounts)
      .where(eq(gameAccounts.gameId, "lol"));
    return res.json({ count: rows.length });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao contar jogadores" });
  }
});

// POST /api/players/refresh-elo — grava elo_cache de contas exibidas (cache Riot).
// O cliente informa o cache calculado; a API só aceita contas que existem e
// autentica o chamador — a escrita nunca é "regra de negócio", é refresh de cache.
playersRouter.post("/refresh-elo", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const { updates } = req.body ?? {};
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "updates deve ser uma lista" });
    }

    let atualizadas = 0;
    for (const u of updates) {
      if (!u?.userId || !u?.eloCache) continue;
      const [row] = await db
        .select()
        .from(gameAccounts)
        .where(and(eq(gameAccounts.userId, u.userId), eq(gameAccounts.gameId, "lol")))
        .limit(1);
      if (!row) continue;
      const meta = (row.metadata as Record<string, any>) || {};
      await db
        .update(gameAccounts)
        .set({
          metadata: { ...meta, elo_cache: u.eloCache, stats_updated_at: new Date().toISOString() },
          updatedAt: new Date(),
        })
        .where(eq(gameAccounts.id, row.id));
      atualizadas++;
    }

    return res.json({ ok: true, atualizadas });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar cache de elo" });
  }
});

// POST /api/players/refresh-elos — refresh SERVER-SIDE do elo_cache das contas
// stale (sem elo_cache, stats_updated_at ausente ou mais velho que 30min), em
// lote com concorrência limitada (3 em paralelo) e cache em memória por puuid
// (10min). O cliente passa a fazer UMA chamada — antes eram ~154 buscarElo +
// ~154 escritas no load do /players (429 da Riot + pico no servidor). O endpoint
// antigo POST /refresh-elo (escrita de cache informado pelo cliente) permanece
// por compatibilidade.
playersRouter.post("/refresh-elos", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const limite = new Date(Date.now() - ELO_CACHE_TTL_MS).toISOString();
    const rows = await db
      .select()
      .from(gameAccounts)
      .where(
        and(
          eq(gameAccounts.gameId, "lol"),
          or(
            sql`${gameAccounts.metadata}->'elo_cache' IS NULL`,
            sql`${gameAccounts.metadata}->>'stats_updated_at' IS NULL`,
            sql`${gameAccounts.metadata}->>'stats_updated_at' < ${limite}`
          )
        )
      )
      .limit(REFRESH_BATCH_LIMIT);

    let atualizadas = 0;
    let erros = 0;

    for (let i = 0; i < rows.length; i += REFRESH_CONCURRENCY) {
      const fatia = rows.slice(i, i + REFRESH_CONCURRENCY);
      await Promise.all(
        fatia.map(async (conta) => {
          try {
            const entries = await fetchLeague(conta.externalId);
            const soloEntry = entries.find((e: any) => e.queueType === "RANKED_SOLO_5x5");
            const flexEntry = entries.find((e: any) => e.queueType === "RANKED_FLEX_SR");

            const eloCache = {
              soloQ: soloEntry
                ? {
                    tier: soloEntry.tier ?? "IRON",
                    rank: soloEntry.rank ?? "IV",
                    lp: soloEntry.leaguePoints ?? 0,
                    wins: soloEntry.wins ?? 0,
                    losses: soloEntry.losses ?? 0,
                  }
                : null,
              flexQ: flexEntry
                ? {
                    tier: flexEntry.tier ?? "IRON",
                    rank: flexEntry.rank ?? "IV",
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
              `[players] refresh-elos falhou para ${conta.handle ?? conta.externalId}:`,
              error?.message || error
            );
          }
        })
      );
    }

    return res.json({ atualizadas, total: rows.length, erros });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar elos em lote" });
  }
});

// GET /api/players/filtrados — busca paginada com filtros (elo/role/search) ─
// Substitui a RPC buscar_jogadores_filtrados. Devolve o SHAPE LEGADO PLANO
// (tier, soloq_wins/losses, flexq_wins/losses, lane, lane2, is_vip) que as
// telas do fork (players.tsx) já consomem — mesmo que o dado viva aninhado em
// game_accounts.metadata.elo_cache no schema novo.
// PÚBLICO (paridade com a RPC antiga, SECURITY DEFINER): a página /players é
// um "diretório público de jogadores" — visitante e logado veem a mesma lista.
playersRouter.get("/filtrados", async (req, res) => {
  try {
    const offset = Math.max(0, Number(req.query.p_offset ?? 0) || 0);
    const limit = Math.min(100, Number(req.query.p_limit ?? 20) || 20);
    const search = String(req.query.p_search ?? "").trim();
    const eloTier = String(req.query.p_elo_tier ?? "").trim();
    const roleLane = String(req.query.p_role_lane ?? "").trim();

    const clauses: any[] = [eq(gameAccounts.gameId, "lol")];
    if (search) {
      clauses.push(or(ilike(gameAccounts.handle, `%${search}%`), ilike(gameAccounts.externalId, `%${search}%`)));
    }
    if (eloTier) {
      clauses.push(sql`${gameAccounts.metadata}->'elo_cache'->'soloQ'->>'tier' ILIKE ${`%${eloTier}%`}`);
    }

    const whereBase = and(...clauses);
    const base = db.select().from(gameAccounts).where(whereBase);

    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(gameAccounts)
      .where(whereBase);

    const rows = await base.orderBy(gameAccounts.createdAt).limit(limit).offset(offset);

    // role: filtra pela lane_primary do usuário (profiles → users)
    let result = rows;
    if (roleLane) {
      const ids = rows.map((r) => r.userId);
      const userRows = ids.length
        ? await db.select({ id: users.id, lane: users.lanePrimary }).from(users).where(inArray(users.id, ids))
        : [];
      const laneMap = new Map(userRows.map((u) => [u.id, u.lane]));
      result = rows.filter((r) => laneMap.get(r.userId) === roleLane);
    }

    // Shape legado plano: join com users (lane/lane2/is_vip) e achatamento do
    // elo_cache (soloQ/flexQ wins+losses+tier). Sem isso as telas do fork leem
    // c.tier/c.soloq_wins como undefined → elo sem cor, winrate e partidas zerados.
    const userIds = [...new Set(result.map((r) => r.userId).filter(Boolean))];
    const userRows = userIds.length
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    return res.json(
      result.map((r, i) => {
        const meta = (r.metadata as Record<string, any>) || {};
        const eloCache = (meta.elo_cache as Record<string, any>) || {};
        const soloQ = eloCache.soloQ as Record<string, any> | null | undefined;
        const flexQ = eloCache.flexQ as Record<string, any> | null | undefined;
        const u = userMap.get(r.userId);

        return {
          user_id: r.userId,
          riot_id: r.handle,
          level: meta.level ?? null,
          profile_icon_id: meta.profile_icon_id ?? null,
          tier: soloQ?.tier ?? null,
          soloq_tier: soloQ?.tier ?? null,
          soloq_wins: Number(soloQ?.wins ?? 0),
          soloq_losses: Number(soloQ?.losses ?? 0),
          flexq_tier: flexQ?.tier ?? null,
          flexq_wins: Number(flexQ?.wins ?? 0),
          flexq_losses: Number(flexQ?.losses ?? 0),
          lane: u?.lanePrimary ?? null,
          lane2: u?.laneSecondary ?? null,
          is_vip: u?.isVip ?? false,
          mp: 0,
          mc: 0,
          puuid: r.externalId,
          stats_updated_at: meta.stats_updated_at ?? r.syncedAt ?? r.createdAt,
          total_count: countRow?.total ?? 0,
          rank: offset + i + 1,
        };
      })
    );
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar jogadores" });
  }
});
