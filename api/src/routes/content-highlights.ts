import { Router } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { db } from "../db.js";
import { highlights } from "../../../db/schema/conteudo.js";
import { getAdminUser } from "../lib/content.js";

export const contentHighlightsRouter = Router();

// GET /api/content/highlights - Highlights ativos (Lobby/Streamers).
contentHighlightsRouter.get("/", async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(highlights)
      .where(eq(highlights.active, true))
      .orderBy(asc(highlights.ordem), desc(highlights.createdAt))
      .limit(50);
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar highlights" });
  }
});

// GET /api/content/highlights/all - Todos (Admin), inclusive inativos.
contentHighlightsRouter.get("/all", async (req, res) => {
  try {
    const user = await getAdminUser(req, res, ["admin"]);
    if (!user) return;
    const items = await db
      .select()
      .from(highlights)
      .orderBy(asc(highlights.ordem), desc(highlights.createdAt))
      .limit(200);
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar highlights" });
  }
});

// POST /api/content/highlights - Criar highlight.
contentHighlightsRouter.post("/", async (req, res) => {
  try {
    const user = await getAdminUser(req, res, ["admin"]);
    if (!user) return;

    const body = req.body || {};
    const titulo = String(body.title || "").trim();
    const link = String(body.videoUrl || "").trim();
    if (!titulo || !link) {
      return res.status(400).json({ error: "Título e link são obrigatórios" });
    }

    const [created] = await db
      .insert(highlights)
      .values({
        title: titulo,
        description: body.description ?? null,
        videoUrl: link,
        thumbnailUrl: body.thumbnailUrl ?? null,
        authorId: user.id,
        active: body.active ?? true,
        ordem: body.ordem ?? 0,
        categoria: body.categoria || "highlight",
      })
      .returning();

    return res.status(201).json(created);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar highlight" });
  }
});

// PUT /api/content/highlights/:id - Atualização parcial (toggle ativo, etc.).
contentHighlightsRouter.put("/:id", async (req, res) => {
  try {
    const user = await getAdminUser(req, res, ["admin"]);
    if (!user) return;

    const { id } = req.params;
    const [exists] = await db.select({ id: highlights.id }).from(highlights).where(eq(highlights.id, id)).limit(1);
    if (!exists) {
      return res.status(404).json({ error: "Highlight não encontrado" });
    }

    const body = req.body || {};
    const patch: any = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.videoUrl !== undefined) patch.videoUrl = body.videoUrl;
    if (body.thumbnailUrl !== undefined) patch.thumbnailUrl = body.thumbnailUrl;
    if (body.active !== undefined) patch.active = !!body.active;
    if (body.ordem !== undefined) patch.ordem = body.ordem;
    if (body.categoria !== undefined) patch.categoria = body.categoria;

    const [updated] = await db.update(highlights).set(patch).where(eq(highlights.id, id)).returning();
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar highlight" });
  }
});

// DELETE /api/content/highlights/:id
contentHighlightsRouter.delete("/:id", async (req, res) => {
  try {
    const user = await getAdminUser(req, res, ["admin"]);
    if (!user) return;
    const { id } = req.params;
    await db.delete(highlights).where(eq(highlights.id, id));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao excluir highlight" });
  }
});
