import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "../../../db/schema/identidade.js";
import { withdrawals } from "../../../db/schema/economia.js";
import { getAuthUser } from "../lib/match-flow.js";
import { getAdminUser } from "../lib/content.js";
import { solicitarSaque, decidirSaque } from "../lib/withdrawals.js";

export const withdrawalsRouter = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape público de um pedido; admin recebe também dados do usuário. */
function shape(p: any, usuario: any = null) {
  return {
    id: p.id,
    mcAmount: p.mcAmount,
    amountBrl: Number(p.amountBrl),
    pixType: p.pixType,
    pixKey: p.pixKey,
    pixName: p.pixName,
    status: p.status,
    createdAt: p.createdAt,
    decidedAt: p.decidedAt,
    ...(usuario ? { userId: usuario.id, riotId: usuario.riotId, displayName: usuario.displayName } : {}),
  };
}

// POST /api/withdrawals — { mcAmount }. Autenticado. O servidor converte.
withdrawalsRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });
    const mcAmount = Number(req.body?.mcAmount);
    const criado = await db.transaction(async (tx: any) => solicitarSaque(tx, user.id, mcAmount));
    return res.status(201).json(shape(criado));
  } catch (e: any) {
    if (e?.code) {
      return res.status(400).json({ error: e.code });
    }
    return res.status(500).json({ error: "erro_interno" });
  }
});

// GET /api/withdrawals/mine — histórico do próprio jogador (mais recentes 50).
withdrawalsRouter.get("/mine", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });
    const rows = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.userId, user.id))
      .orderBy(desc(withdrawals.createdAt))
      .limit(50);
    return res.json(rows.map((p) => shape(p)));
  } catch (e: any) {
    return res.status(500).json({ error: "erro_interno" });
  }
});

// GET /api/withdrawals/admin — fila + histórico recente (admin). Chave PIX completa.
withdrawalsRouter.get("/admin", async (req, res) => {
  try {
    const admin = await getAdminUser(req, res, ["admin"]);
    if (!admin) return;
    const rows = await db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt)).limit(100);
    const comUsuario = await Promise.all(
      rows.map(async (p) => {
        const [u] = await db.select().from(users).where(eq(users.id, p.userId)).limit(1);
        return shape(p, u);
      })
    );
    return res.json(comUsuario);
  } catch (e: any) {
    return res.status(500).json({ error: "erro_interno" });
  }
});

// POST /api/withdrawals/:id/decide — { action: 'paid'|'rejected', decisionId }. Admin.
withdrawalsRouter.post("/:id/decide", async (req, res) => {
  try {
    const admin = await getAdminUser(req, res, ["admin"]);
    if (!admin) return;
    const { action, decisionId } = req.body ?? {};
    if (action !== "paid" && action !== "rejected") {
      return res.status(400).json({ error: "acao_invalida" });
    }
    if (!decisionId || typeof decisionId !== "string" || !UUID_REGEX.test(decisionId)) {
      return res.status(400).json({ error: "decision_id_invalido" });
    }
    if (!req.params.id || !UUID_REGEX.test(req.params.id)) {
      return res.status(404).json({ error: "pedido_nao_encontrado" });
    }
    const atualizado = await db.transaction(async (tx: any) =>
      decidirSaque(tx, req.params.id, admin.id, action, decisionId)
    );
    return res.json({ ok: true, ...shape(atualizado) });
  } catch (e: any) {
    if (e?.code) {
      const status = e.code === "pedido_nao_encontrado" ? 404 : e.code === "pedido_ja_decidido" ? 409 : 400;
      return res.status(status).json({ error: e.code });
    }
    return res.status(500).json({ error: "erro_interno" });
  }
});
