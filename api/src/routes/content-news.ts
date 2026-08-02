import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db.js";
import { news } from "../../../db/schema/conteudo.js";
import { getAdminUser, slugify, generateUniqueSlug } from "../lib/content.js";

export const contentNewsRouter = Router();

// GET /api/content/news - Notícias publicadas (Lobby). Ordem legada: destaque
// primeiro, depois por data de publicação.
contentNewsRouter.get("/", async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(news)
      .where(eq(news.published, true))
      .orderBy(desc(news.destaque), desc(news.publishedAt))
      .limit(20);
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar notícias" });
  }
});

// GET /api/content/news/all - Todas as notícias (Admin), com inativas.
contentNewsRouter.get("/all", async (req, res) => {
  try {
    const user = await getAdminUser(req, res, ["admin", "organizer"]);
    if (!user) return;
    const items = await db
      .select()
      .from(news)
      .orderBy(desc(news.destaque), desc(news.publishedAt))
      .limit(200);
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar notícias" });
  }
});

// POST /api/content/news - Criar notícia. O corpo já vem no shape novo
// (camelCase); o SDK converte o payload legado do Admin.
contentNewsRouter.post("/", async (req, res) => {
  try {
    const user = await getAdminUser(req, res, ["admin", "organizer"]);
    if (!user) return;

    const body = req.body || {};
    const titulo = String(body.title || "").trim();
    if (!titulo) {
      return res.status(400).json({ error: "Título é obrigatório" });
    }

    const slug = await generateUniqueSlug(body.slug ? String(body.slug) : slugify(titulo));

    const [created] = await db
      .insert(news)
      .values({
        slug,
        title: titulo,
        summary: body.summary ?? null,
        content: body.content || "",
        imageUrl: body.imageUrl ?? null,
        authorId: user.id,
        published: body.published ?? true,
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
        categoria: body.categoria || "Torneios",
        destaque: !!body.destaque,
        linkUrl: body.linkUrl ?? null,
        linkText: body.linkText ?? null,
        autor: body.autor || user.displayName,
      })
      .returning();

    return res.status(201).json(created);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar notícia" });
  }
});

// PUT /api/content/news/:id - Atualização parcial (payload legado já mapeado).
contentNewsRouter.put("/:id", async (req, res) => {
  try {
    const user = await getAdminUser(req, res, ["admin", "organizer"]);
    if (!user) return;

    const { id } = req.params;
    const [exists] = await db.select({ id: news.id }).from(news).where(eq(news.id, id)).limit(1);
    if (!exists) {
      return res.status(404).json({ error: "Notícia não encontrada" });
    }

    const body = req.body || {};
    if (body.slug && body.slug !== "") {
      body.slug = await generateUniqueSlug(String(body.slug), id);
    }

    const patch: any = { updatedAt: new Date() };
    if (body.slug !== undefined) patch.slug = body.slug;
    if (body.title !== undefined) patch.title = body.title;
    if (body.summary !== undefined) patch.summary = body.summary;
    if (body.content !== undefined) patch.content = body.content;
    if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl;
    if (body.published !== undefined) patch.published = !!body.published;
    if (body.publishedAt !== undefined)
      patch.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
    if (body.categoria !== undefined) patch.categoria = body.categoria;
    if (body.destaque !== undefined) patch.destaque = !!body.destaque;
    if (body.linkUrl !== undefined) patch.linkUrl = body.linkUrl;
    if (body.linkText !== undefined) patch.linkText = body.linkText;
    if (body.autor !== undefined) patch.autor = body.autor;

    const [updated] = await db.update(news).set(patch).where(eq(news.id, id)).returning();
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar notícia" });
  }
});

// DELETE /api/content/news/:id
contentNewsRouter.delete("/:id", async (req, res) => {
  try {
    const user = await getAdminUser(req, res, ["admin", "organizer"]);
    if (!user) return;
    const { id } = req.params;
    await db.delete(news).where(eq(news.id, id));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao excluir notícia" });
  }
});
