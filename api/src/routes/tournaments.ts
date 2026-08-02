import { Router } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions } from "../../../db/schema/identidade.js";
import { tournaments, tournamentTeams, tournamentMatches } from "../../../db/schema/tournaments.js";

export const tournamentsRouter = Router();

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

// GET /api/tournaments - Lista todos os campeonatos
tournamentsRouter.get("/", async (_req, res) => {
  try {
    const list = await db.select().from(tournaments);
    const results = await Promise.all(
      list.map(async (t) => {
        const teamsCount = await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, t.id));
        return {
          ...t,
          registeredTeamsCount: teamsCount.length,
        };
      })
    );
    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar campeonatos" });
  }
});

// GET /api/tournaments/:id - Detalhes do campeonato
tournamentsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);

    if (!t) {
      return res.status(404).json({ error: "Campeonato não encontrado" });
    }

    const teamsList = await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, t.id));
    const matchesList = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, t.id));

    return res.json({
      ...t,
      teams: teamsList,
      matches: matchesList,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar detalhes do campeonato" });
  }
});

// POST /api/tournaments - Criar campeonato
tournamentsRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { name, slug, format, prize, startsAt } = req.body;
    if (!name || !format) {
      return res.status(400).json({ error: "Nome e formato do campeonato são obrigatórios" });
    }

    const tournamentSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const [created] = await db
      .insert(tournaments)
      .values({
        gameId: "lol",
        name: name.trim(),
        slug: tournamentSlug,
        format,
        status: "open",
        organizerId: user.id,
        prize: prize || {},
        startsAt: startsAt ? new Date(startsAt) : null,
      })
      .returning();

    return res.status(201).json(created);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar campeonato" });
  }
});
