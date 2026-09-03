import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db.js";
import { notifications } from "../../../db/schema/conteudo.js";
import { getAuthUser } from "../lib/match-flow.js";

export const notificationsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/notifications - Notificações do usuário autenticado (mais recentes
// primeiro) + contagem de não lidas. Leve: limit 50 e sem join (só o próprio
// usuário). Não lê nenhum dado de outro usuário (segurança por userId).
notificationsRouter.get("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return res.json({
      notifications: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        message: r.message,
        payload: r.payload,
        read: r.read,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
      })),
      unreadCount: rows.filter((r) => !r.read).length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao carregar notificações" });
  }
});

// POST /api/notifications/:id/read - Marca UMA notificação do usuário como lida.
// Valida uuid e restringe ao próprio dono (não deixa marcar lida do outros).
notificationsRouter.post("/:id/read", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "notification_id_invalido" });

    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, user.id)));

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao marcar notificação como lida" });
  }
});

// POST /api/notifications/read-all - Marca TODAS as notificações do usuário como
// lidas (usado ao abrir o sino). Declarada antes de `/:id/read` para o Express
// não interceptar "read-all" como um id.
notificationsRouter.post("/read-all", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao marcar notificações como lidas" });
  }
});
