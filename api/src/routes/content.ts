import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db.js";
import { playerStats } from "../../../db/schema/conteudo.js";
import { getAuthUser } from "../lib/content.js";
import { contentNewsRouter } from "./content-news.js";
import { contentHighlightsRouter } from "./content-highlights.js";

export const contentRouter = Router();

// Swap app.swap.conteudo: CRUD de notícias e highlights (admin via user_roles)
// vive nos sub-routers; o shape legado (snake_case) é reconstruído no SDK.
contentRouter.use("/news", contentNewsRouter);
contentRouter.use("/highlights", contentHighlightsRouter);

// ── PLAYER STATS ─────────────────────────────────────────────────────────────

// GET /api/content/player-stats/:userId - Stats por modo de um jogador.
contentRouter.get("/player-stats/:userId", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(playerStats)
      .where(eq(playerStats.userId, req.params.userId))
      .orderBy(desc(playerStats.totalGames));
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar stats do jogador" });
  }
});

// POST /api/content/player-stats - Registra o resultado de uma partida e
// recalcula o agregado (vitórias/derrotas/total/winrate) no servidor, de forma
// atômica. O cliente só informa quem jogou, em que modo e se venceu.
contentRouter.post("/player-stats", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { userId, modo, vitoria } = req.body || {};
    if (!userId || !modo) {
      return res.status(400).json({ error: "userId e modo são obrigatórios" });
    }
    const ehVitoria = !!vitoria;

    const [existing] = await db
      .select()
      .from(playerStats)
      .where(and(eq(playerStats.userId, userId), eq(playerStats.modo, String(modo))))
      .limit(1);

    if (!existing) {
      const [created] = await db
        .insert(playerStats)
        .values({
          userId,
          modo: String(modo),
          victories: ehVitoria ? 1 : 0,
          defeats: ehVitoria ? 0 : 1,
          totalGames: 1,
          winrate: ehVitoria ? 100 : 0,
        })
        .returning();
      return res.status(201).json(created);
    }

    const novasVitorias = existing.victories + (ehVitoria ? 1 : 0);
    const novasDerrotas = existing.defeats + (ehVitoria ? 0 : 1);
    const total = novasVitorias + novasDerrotas;
    const winrate = total > 0 ? (novasVitorias / total) * 100 : 0;

    const [updated] = await db
      .update(playerStats)
      .set({ victories: novasVitorias, defeats: novasDerrotas, totalGames: total, winrate, updatedAt: new Date() })
      .where(and(eq(playerStats.userId, userId), eq(playerStats.modo, String(modo))))
      .returning();
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao registrar stats" });
  }
});
