import { Router } from "express";
import { eq, and, gt, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userRoles } from "../../../db/schema/identidade.js";

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
