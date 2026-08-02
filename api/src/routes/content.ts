import { Router } from "express";
import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions } from "../../../db/schema/identidade.js";
import { news, broadcasts, recruitmentPosts, notifications } from "../../../db/schema/conteudo.js";

export const contentRouter = Router();

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

// GET /api/content/news - Notícias publicadas
contentRouter.get("/news", async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(news)
      .where(eq(news.published, true))
      .orderBy(desc(news.publishedAt))
      .limit(20);
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar notícias" });
  }
});

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
