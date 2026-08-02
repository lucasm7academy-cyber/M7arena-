import { Router } from "express";
import { eq, and, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../db.js";
import { userSessions, users } from "../../../db/schema/identidade.js";
import { gameAccounts } from "../../../db/schema/games.js";

export const playersRouter = Router();

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
playersRouter.get("/by-ids", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const ids = String(req.query.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

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
});

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

// ── GET /api/players/filtrados — busca paginada com filtros (elo/role/search) ─
// Substitui a RPC buscar_jogadores_filtrados. Filtra contas Riot (game_accounts)
// por elo_cache (tier), role (lane em users) e busca por handle/puuid.
playersRouter.get("/filtrados", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

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
      clauses.push(sql`${gameAccounts.metadata}->'elo_cache'->>'tier' ILIKE ${`%${eloTier}%`}`);
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

    return res.json(
      result.map((r, i) => ({ ...toLegacyRiot(r), total_count: countRow?.total ?? 0, rank: offset + i + 1 }))
    );
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar jogadores" });
  }
});
