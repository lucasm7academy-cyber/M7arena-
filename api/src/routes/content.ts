import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db.js";
import { broadcasts, recruitmentPosts, notifications, playerStats } from "../../../db/schema/conteudo.js";
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

// ── OUTROS (inalterados) ─────────────────────────────────────────────────────

// GET /api/content/streamers - Transmissões e streamers
contentRouter.get("/streamers", async (_req, res) => {
  try {
    const items = await db.select().from(broadcasts).orderBy(desc(broadcasts.isLive));
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar streamers" });
  }
});

// GET /api/content/recruitment - Posts de recrutamento (LFT/LFP)
contentRouter.get("/recruitment", async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(recruitmentPosts)
      .where(eq(recruitmentPosts.active, true))
      .orderBy(desc(recruitmentPosts.createdAt))
      .limit(50);
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar recrutamento" });
  }
});

// POST /api/content/recruitment - Criar anúncio de recrutamento
contentRouter.post("/recruitment", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { type, roleSlot, title, description } = req.body;
    if (!type || !roleSlot || !title || !description) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });
    }

    const [created] = await db
      .insert(recruitmentPosts)
      .values({
        authorId: user.id,
        type,
        roleSlot,
        title: title.trim(),
        description: description.trim(),
      })
      .returning();

    return res.status(201).json(created);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar anúncio" });
  }
});

// GET /api/content/notifications - Notificações do usuário
contentRouter.get("/notifications", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const items = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar notificações" });
  }
});
