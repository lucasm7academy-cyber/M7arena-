import { Router } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userIdentities } from "../../../db/schema/identidade.js";
import { gameAccounts } from "../../../db/schema/games.js";

export const profilesRouter = Router();

// Middleware auxiliar de autenticação
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

// GET /api/profiles/me - Perfil do usuário logado
profilesRouter.get("/me", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const [riotAccount] = await db
      .select()
      .from(gameAccounts)
      .where(and(eq(gameAccounts.userId, user.id), eq(gameAccounts.gameId, "lol")))
      .limit(1);

    const [discordIdentity] = await db
      .select()
      .from(userIdentities)
      .where(and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, "discord")))
      .limit(1);

    return res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      socials: user.socials,
      isVip: user.isVip,
      vipExpiresAt: user.vipExpiresAt,
      riotAccount: riotAccount
        ? {
            handle: riotAccount.handle,
            puuid: riotAccount.externalId,
            verified: riotAccount.verified,
            metadata: riotAccount.metadata,
          }
        : null,
      discordAccount: discordIdentity
        ? {
            providerAccountId: discordIdentity.providerAccountId,
          }
        : null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar perfil" });
  }
});

// GET /api/profiles/:id - Perfil público de qualquer usuário
profilesRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const [riotAccount] = await db
      .select()
      .from(gameAccounts)
      .where(and(eq(gameAccounts.userId, user.id), eq(gameAccounts.gameId, "lol")))
      .limit(1);

    return res.json({
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      socials: user.socials,
      isVip: user.isVip,
      riotAccount: riotAccount
        ? {
            handle: riotAccount.handle,
            verified: riotAccount.verified,
          }
        : null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar perfil público" });
  }
});

// PUT /api/profiles/me - Atualiza perfil do usuário logado
profilesRouter.put("/me", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { displayName, bio, socials, avatarUrl } = req.body;

    const [updated] = await db
      .update(users)
      .set({
        ...(displayName ? { displayName: displayName.trim() } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(socials !== undefined ? { socials } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    return res.json({
      id: updated.id,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      socials: updated.socials,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar perfil" });
  }
});

// POST /api/profiles/me/riot - Vincula/Atualiza conta da Riot (LoL)
profilesRouter.post("/me/riot", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { handle, puuid, metadata } = req.body;
    if (!handle || !puuid) {
      return res.status(400).json({ error: "handle (Riot ID) e puuid são obrigatórios" });
    }

    const [existing] = await db
      .select()
      .from(gameAccounts)
      .where(and(eq(gameAccounts.userId, user.id), eq(gameAccounts.gameId, "lol")))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(gameAccounts)
        .set({
          handle,
          externalId: puuid,
          metadata: metadata || existing.metadata,
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(gameAccounts.id, existing.id))
        .returning();

      return res.json(updated);
    }

    const [created] = await db
      .insert(gameAccounts)
      .values({
        userId: user.id,
        gameId: "lol",
        externalId: puuid,
        handle,
        verified: true,
        metadata: metadata || {},
        syncedAt: new Date(),
      })
      .returning();

    return res.status(201).json(created);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao vincular conta Riot" });
  }
});
