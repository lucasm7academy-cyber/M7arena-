import { Router } from "express";
import { eq, and, gt, inArray, desc, ilike, or } from "drizzle-orm";
import { db } from "../../db.js";
import { users, userSessions, userRoles } from "../../../../db/schema/identidade.js";
import { userAdvertencias } from "../../../../db/schema/apostas.js";
import { removerAdvertencia } from "../../lib/match-flow.js";
import { aplicarBanAutomaticoSeNecessario } from "../../lib/elegibilidade.js";

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

// ── GET /api/admin/cargos — lista usuários e cargos ────────────────────────
// Substitui a RPC listar_admins_com_email. Só admin/proprietário vê. Lista
// TODOS os usuários (não só quem tem cargo) — o painel de cargos do site
// original mostra a base completa para o proprietário promover/rebaixar.
adminRouter.get("/cargos", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode listar cargos" });
    }

    // LEFT JOIN: usuários sem linha em user_roles aparecem com cargo vazio.
    // Usa o cargo "mais alto" por usuário (proprietario > admin > ...) via
    // DISTINCT ON, no mesmo espírito da RPC antiga.
    const rows: any[] = await db
      .selectDistinctOn([users.id], {
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: userRoles.role,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .orderBy(users.id, desc(userRoles.role))
      .limit(500);

    return res.json(rows.map((r) => ({
      id: r.id,
      user_id: r.id,
      email: r.email,
      display_name: r.displayName,
      cargo: r.role ? ROLE_TO_LEGACY[r.role] || r.role : "jogador",
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

// ── GET /api/admin/usuarios?q= — busca de usuários (admin) ─────────────────
// Busca por email, nome de exibição ou Riot ID (parcial). Usada pela aba
// Punições para localizar o alvo de advertência/ban.
adminRouter.get("/usuarios", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário" });
    }

    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json([]);

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        riotId: users.riotId,
        status: users.status,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(or(ilike(users.email, `%${q}%`), ilike(users.displayName, `%${q}%`), ilike(users.riotId, `%${q}%`)))
      .orderBy(desc(users.createdAt))
      .limit(20);

    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar usuários" });
  }
});

// ── GET /api/admin/advertencias/:userId — lista advertências (admin) ────────
// ADR-033: advertências manuais. Histórico para o admin decidir ban.
adminRouter.get("/advertencias/:userId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode ver advertências" });
    }

    const rows = await db
      .select()
      .from(userAdvertencias)
      .where(eq(userAdvertencias.userId, req.params.userId))
      .orderBy(desc(userAdvertencias.createdAt));
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar advertências" });
  }
});

// ── POST /api/admin/advertencias — aplica advertência (admin) ──────────────
// Cria a advertência (criado_por = admin) e, se o total ativo chegar ao teto,
// aplica ban automático (ADR-033). Retorna o total ativo.
adminRouter.post("/advertencias", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode aplicar advertência" });
    }

    const { userId, motivo } = req.body ?? {};
    if (!userId || !motivo || !String(motivo).trim()) {
      return res.status(400).json({ error: "userId e motivo são obrigatórios" });
    }

    const [alvo] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!alvo) return res.status(404).json({ error: "Usuário não encontrado" });

    const r = await db.transaction(async (tx: any) => {
      await tx.insert(userAdvertencias).values({ userId, criadoPor: user.id, motivo: String(motivo).trim() });
      const total = await aplicarBanAutomaticoSeNecessario(tx, userId);
      return { total };
    });

    return res.json({ ok: true, advertencias: r.total, banido: r.total >= 3 });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao aplicar advertência" });
  }
});

// ── DELETE /api/admin/advertencias/:id — remove advertência (admin) ─────────
// Seta removido_por/removido_em (deixa de contar). Idempotente. Não desbana
// sozinho: ban só sai pelo unban manual (ADR-033).
adminRouter.delete("/advertencias/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode remover advertência" });
    }

    const total = await removerAdvertencia(db, req.params.id, user.id);
    if (total === null) return res.status(404).json({ error: "Advertência não encontrada" });
    return res.json({ ok: true, advertencias: total });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao remover advertência" });
  }
});

// ── POST /api/admin/usuarios/:userId/ban — ban manual (admin) ───────────────
// Ban permanente até o admin desbanir. Auditado (banido_por/em/motivo).
adminRouter.post("/usuarios/:userId/ban", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode banir" });
    }

    const { motivo } = req.body ?? {};
    const [alvo] = await db.select().from(users).where(eq(users.id, req.params.userId)).limit(1);
    if (!alvo) return res.status(404).json({ error: "Usuário não encontrado" });

    await db
      .update(users)
      .set({
        status: "banida",
        banidoPor: user.id,
        banidoEm: new Date(),
        banMotivo: motivo ? String(motivo).trim() : "Ban manual",
        banAutomatico: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, alvo.id));

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao banir usuário" });
  }
});

// ── POST /api/admin/usuarios/:userId/unban — desban (admin) ─────────────────
// Reativa a conta (active) e limpa o audit de ban. É a ÚNICA forma de sair do
// ban — mesmo o ban automático (3 advertências) depende deste desban.
adminRouter.post("/usuarios/:userId/unban", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await getRoles(user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode desbanir" });
    }

    const [alvo] = await db.select().from(users).where(eq(users.id, req.params.userId)).limit(1);
    if (!alvo) return res.status(404).json({ error: "Usuário não encontrado" });

    await db
      .update(users)
      .set({
        status: "active",
        banidoPor: null,
        banidoEm: null,
        banMotivo: null,
        banAutomatico: false,
        suspensaAte: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, alvo.id));

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao desbanir usuário" });
  }
});
