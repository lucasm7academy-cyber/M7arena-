import { Router } from "express";
import { eq, and, gt, inArray, desc } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userRoles } from "../../../db/schema/identidade.js";
import { userStrikes } from "../../../db/schema/apostas.js";
import { removerStrike } from "../lib/match-flow.js";

export const adminRouter = Router();

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

async function getRoles(userId: string): Promise<string[]> {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

const ROLE_TO_LEGACY: Record<string, string> = {
  admin: "admin",
  proprietario: "proprietario",
  organizer: "organizador",
  streamer: "streamer",
  caster: "caster",
  user: "jogador",
};

const LEGACY_TO_ROLE: Record<string, string> = {
  admin: "admin",
  proprietario: "proprietario",
  organizador: "organizer",
  streamer: "streamer",
  caster: "caster",
  jogador: "user",
};

// ── GET /api/admin/cargos — lista usuários com cargo (admin+proprietario) ──
// Substitui a RPC listar_admins_com_email. Só admin/proprietário vê.
adminRouter.get("/cargos", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode listar cargos" });
    }

    const rows = await db
      .select({ id: users.id, email: users.email, displayName: users.displayName, userId: userRoles.userId, role: userRoles.role })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(inArray(userRoles.role, ["admin", "proprietario"]));

    return res.json(rows.map((r) => ({
      id: r.id,
      user_id: r.userId,
      email: r.email,
      display_name: r.displayName,
      cargo: ROLE_TO_LEGACY[r.role] || r.role,
    })));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar cargos" });
  }
});

// ── PUT /api/admin/cargos/:userId — atualiza cargo de um usuário ───────────
// Substitui a RPC atualizar_cargo_usuario. Só proprietário pode.
adminRouter.put("/cargos/:userId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas proprietário pode alterar cargos" });
    }

    const { userId } = req.params;
    const novoCargo = String(req.body?.p_cargo ?? req.body?.cargo ?? "").trim();
    if (!novoCargo) return res.status(400).json({ error: "cargo é obrigatório" });

    const newRole = LEGACY_TO_ROLE[novoCargo] || novoCargo;
    const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return res.status(404).json({ error: "Usuário não encontrado" });

    await db.delete(userRoles).where(and(eq(userRoles.userId, userId), inArray(userRoles.role, ["admin", "organizer", "streamer", "caster", "user"])));
    if (newRole !== "user") {
      await db.insert(userRoles).values({ userId, role: newRole });
    }

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar cargo" });
  }
});

// ── GET /api/admin/strikes/:userId — lista strikes de um usuário (admin) ────
// Design v3 §2.1: admin pode ver o histórico de punições para decidir se perdoa.
adminRouter.get("/strikes/:userId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode ver strikes" });
    }

    const rows = await db
      .select()
      .from(userStrikes)
      .where(eq(userStrikes.userId, req.params.userId))
      .orderBy(desc(userStrikes.createdAt));
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar strikes" });
  }
});

// ── DELETE /api/admin/strikes/:id — remove um strike (admin, auditado) ─────
// Seta removido_por/removido_em (o strike deixa de contar). Idempotente:
// já removido → ok sem duplicar auditoria.
adminRouter.delete("/strikes/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode remover strike" });
    }

    const [strike] = await db.select().from(userStrikes).where(eq(userStrikes.id, req.params.id)).limit(1);
    if (!strike) return res.status(404).json({ error: "Strike não encontrado" });

    // Seta removido_por/removido_em e, se a contagem cair abaixo do teto,
    // reativa a suspensão que os strikes causaram.
    const total = await removerStrike(db, strike.id, user.id);
    return res.json({ ok: true, strikes: total });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao remover strike" });
  }
});
