import { Router } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, pool } from "../db.js";
import { users, userSessions } from "../../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";

export const matchesRouter = Router();

async function getAuthUser(req: any) {
  const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;

  const [session] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
    .limit(1);

  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user || null;
}

// Dispara notificação Postgres para o serviço WebSocket (realtime)
async function notifyMatchChange(matchId: string) {
  try {
    const client = await pool.connect();
    await client.query("SELECT pg_notify('matches_channel', $1)", [JSON.stringify({ matchId, timestamp: Date.now() })]);
    client.release();
  } catch {}
}

// GET /api/matches - Lista partidas/salas ativas
matchesRouter.get("/", async (_req, res) => {
  try {
    const activeMatches = await db.select().from(matches).where(eq(matches.status, "preenchendo"));
    const results = await Promise.all(
      activeMatches.map(async (m) => {
        const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, m.id));
        return {
          ...m,
          playersCount: players.length,
        };
      })
    );
    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar salas" });
  }
});

// GET /api/matches/:id - Detalhes da partida
matchesRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);

    if (!match) {
      return res.status(404).json({ error: "Partida não encontrada" });
    }

    const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, match.id));

    return res.json({
      ...match,
      players,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar sala" });
  }
});

// POST /api/matches - Criar sala
matchesRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { mode, entryMp } = req.body;
    const roomCode = `M7-${Math.floor(1000 + Math.random() * 9000)}`;

    const [newMatch] = await db
      .insert(matches)
      .values({
        gameId: "lol",
        mode: mode || "5v5",
        status: "preenchendo",
        createdBy: user.id,
        roomCode,
        entryMp: entryMp || 0,
      })
      .returning();

    // Entra como primeiro jogador (blue slot 0)
    await db.insert(matchPlayers).values({
      matchId: newMatch.id,
      userId: user.id,
      side: "blue",
      slot: 0,
      roleSlot: "top",
      confirmed: true,
    });

    notifyMatchChange(newMatch.id);
    return res.status(201).json(newMatch);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar sala" });
  }
});

// POST /api/matches/:id/join - Entrar na sala
matchesRouter.post("/:id/join", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { id } = req.params;
    const { side, slot, roleSlot } = req.body;

    const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
    if (!match || match.status !== "preenchendo") {
      return res.status(400).json({ error: "Sala indisponível para entrada" });
    }

    const existing = await db
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Você já está nesta sala" });
    }

    await db.insert(matchPlayers).values({
      matchId: match.id,
      userId: user.id,
      side: side || "blue",
      slot: slot ?? 0,
      roleSlot: roleSlot || "sub",
      confirmed: false,
    });

    notifyMatchChange(match.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao entrar na sala" });
  }
});

// POST /api/matches/:id/leave - Sair da sala
matchesRouter.post("/:id/leave", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { id } = req.params;
    await db.delete(matchPlayers).where(and(eq(matchPlayers.matchId, id), eq(matchPlayers.userId, user.id)));

    notifyMatchChange(id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao sair da sala" });
  }
});
