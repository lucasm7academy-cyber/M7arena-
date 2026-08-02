import { Router } from "express";
import { eq, and, gt, ilike, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { userSessions } from "../../../db/schema/identidade.js";
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
