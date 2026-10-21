/**
 * Rotas do reset de senha pelo painel (spec 2026-10-20). Router separado
 * porque admin.ts já passou de ~400 linhas. A permissão é checada aqui, no
 * servidor — a aba bloqueada no front é só a segunda camada.
 */
import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db.js";
import { users, userRoles } from "../../../db/schema/identidade.js";
import { getAuthUser } from "../lib/match-flow.js";
import { gerarTokenReset, podeGerarReset } from "../lib/password-reset.js";

export const adminPasswordResetRouter = Router();

/** Mesmo padrão do OAuth: host real da requisição, com APP_URL de fallback. */
function origem(req: any): string {
  const host = req.get("host");
  if (host) return `${req.protocol === "http" ? "http" : "https"}://${host}`;
  return (process.env.APP_URL || "https://m7arena.pro").replace(/\/$/, "");
}

async function getRoles(userId: string): Promise<string[]> {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

// POST /api/admin/usuarios/:userId/reset-link
adminPasswordResetRouter.post("/usuarios/:userId/reset-link", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });

    const roles = await getRoles(user.id);
    if (!podeGerarReset(roles)) {
      return res.status(403).json({ erro: "apenas_proprietario" });
    }

    // UUID malformado não é "erro interno": é alvo inexistente.
    const userId = req.params.userId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return res.status(404).json({ erro: "usuario_nao_encontrado" });
    }

    const [alvo] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    if (!alvo) return res.status(404).json({ erro: "usuario_nao_encontrado" });

    const { token, expiresAt } = await gerarTokenReset(db, alvo.id);
    const url = `${origem(req)}/redefinir-senha?token=${encodeURIComponent(token)}`;

    return res.json({ url, expira_em: expiresAt.toISOString() });
  } catch (error: any) {
    console.error("[admin-password-reset] erro:", error?.message);
    return res.status(500).json({ erro: "erro_interno" });
  }
});
