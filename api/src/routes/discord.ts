import { Router } from "express";
import crypto from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userIdentities } from "../../../db/schema/identidade.js";

export const discordRouter = Router();

async function getAuthUser(req: any) {
  const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;

  const [session] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
    .limit(1);

  if (!session) return null;
  return { id: session.userId };
}

/**
 * Estado OAuth do Discord (CSRF token). A API roda numa única instância na VPS
 * (ADR-010) — um Map em memória é suficiente e dispensa uma tabela nova para um
 * token que expira em 10 minutos. On restart, estados pendentes se perdem e o
 * usuário só precisa clicar em "Vincular Discord" de novo.
 */
const states = new Map<string, { userId: string; used: boolean; createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

// POST /api/discord/state — gera um estado OAuth para o usuário logado
discordRouter.post("/state", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const state = crypto.randomUUID();
    states.set(state, { userId: user.id, used: false, createdAt: Date.now() });
    return res.json({ state });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao gerar estado OAuth" });
  }
});

// GET /api/discord/state/:state — valida o estado (não usado e dentro do TTL)
discordRouter.get("/state/:state", async (req, res) => {
  try {
    const row = states.get(req.params.state);
    if (!row) return res.json({ valid: false, reason: "not_found" });
    if (Date.now() - row.createdAt > STATE_TTL_MS) {
      states.delete(req.params.state);
      return res.json({ valid: false, reason: "expired" });
    }
    if (row.used) return res.json({ valid: false, reason: "used" });
    return res.json({ valid: true, userId: row.userId });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao validar estado OAuth" });
  }
});

// POST /api/discord/link — vincula o Discord do usuário logado (identidade + tag)
discordRouter.post("/link", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { state, discordId, discordTag } = req.body ?? {};
    if (!discordId || !discordTag) {
      return res.status(400).json({ error: "discordId e discordTag são obrigatórios" });
    }

    // CSRF: o estado precisa existir, pertencer ao usuário logado e não estar usado.
    const row = states.get(state);
    if (!row || row.userId !== user.id) {
      return res.status(403).json({ error: "Link expirado ou já utilizado. Gere um novo link." });
    }
    states.delete(state);

    const [existing] = await db
      .select()
      .from(userIdentities)
      .where(and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, "discord")))
      .limit(1);

    if (existing) {
      await db
        .update(userIdentities)
        .set({ providerAccountId: discordId })
        .where(eq(userIdentities.id, existing.id));
    } else {
      await db
        .insert(userIdentities)
        .values({ userId: user.id, provider: "discord", providerAccountId: discordId });
    }

    const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const socials = (u?.socials as Record<string, string>) || {};
    await db
      .update(users)
      .set({ socials: { ...socials, discord: discordTag }, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao vincular Discord" });
  }
});
