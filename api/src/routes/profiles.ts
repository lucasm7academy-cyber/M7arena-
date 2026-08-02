import { Router } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db.js";
import {
  users,
  userSessions,
  userRoles,
  userIdentities,
  userPayoutInfo,
} from "../../../db/schema/identidade.js";
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

async function getRoles(userId: string): Promise<string[]> {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

async function getRiotAccount(userId: string) {
  const [row] = await db
    .select()
    .from(gameAccounts)
    .where(and(eq(gameAccounts.userId, userId), eq(gameAccounts.gameId, "lol")))
    .limit(1);
  return row || null;
}

/**
 * Traduz game_accounts para o shape legado de `contas_riot` que o fork consome
 * (ADR-005/010): riot_id, puuid, summoner_id, level, profile_icon_id, elo_cache,
 * champions_cache, stats_updated_at. Os campos que o schema novo não tem como
 * coluna própria (summoner_id, level, icon, caches) vivem em metadata (jsonb).
 */
function toLegacyRiot(ga: any) {
  if (!ga) return null;
  const m = (ga.metadata as Record<string, any>) || {};
  return {
    user_id: ga.userId,
    riot_id: ga.handle,
    puuid: ga.externalId,
    summoner_id: m.summoner_id ?? null,
    level: m.level ?? null,
    profile_icon_id: m.profile_icon_id ?? null,
    elo_cache: m.elo_cache ?? null,
    champions_cache: m.champions_cache ?? null,
    stats_updated_at: m.stats_updated_at ?? null,
    verified_at: ga.syncedAt ?? ga.createdAt ?? null,
    created_at: ga.createdAt,
  };
}

/**
 * Traduz users + user_payout_info para o shape legado de `profiles` que as telas
 * leem (lane_primaria, lane_secundaria, is_vip, redes sociais e chave Pix).
 */
function toLegacyProfile(user: any, payout: any) {
  const socials = (user?.socials as Record<string, string>) || {};
  return {
    id: user.id,
    bio: user.bio ?? "",
    lane_primaria: user.lanePrimary ?? null,
    lane_secundaria: user.laneSecondary ?? null,
    is_vip: Boolean(user.isVip),
    instagram: socials.instagram ?? "",
    twitch: socials.twitch ?? "",
    youtube: socials.youtube ?? "",
    discord: socials.discord ?? "",
    chave_pix: payout?.pixKey ?? "",
    tipo_chave_pix: payout?.pixType ?? "",
    nome_pix: payout?.pixName ?? "",
  };
}

// GET /api/profiles/me - Perfil completo do usuário logado (shape legado)
profilesRouter.get("/me", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const [roles, riotAccount, discordIdentity] = await Promise.all([
      getRoles(user.id),
      getRiotAccount(user.id),
      db
        .select()
        .from(userIdentities)
        .where(and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, "discord")))
        .limit(1),
    ]);

    const [payout] = await db.select().from(userPayoutInfo).where(eq(userPayoutInfo.userId, user.id)).limit(1);
    const socials = (user.socials as Record<string, string>) || {};

    return res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roles,
      profile: toLegacyProfile(user, payout),
      riotAccount: toLegacyRiot(riotAccount),
      discordAccount: discordIdentity?.length
        ? { providerAccountId: discordIdentity[0].providerAccountId, discord_tag: socials.discord ?? null }
        : null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar perfil" });
  }
});

// GET /api/profiles/me/riot - Conta Riot do usuário logado (shape legado)
profilesRouter.get("/me/riot", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const riotAccount = await getRiotAccount(user.id);
    return res.json(toLegacyRiot(riotAccount));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar conta Riot" });
  }
});

// GET /api/profiles/me/discord - Discord vinculado do usuário logado
profilesRouter.get("/me/discord", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const socials = (user.socials as Record<string, string>) || {};
    return res.json({ discord_tag: socials.discord ?? null });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar Discord" });
  }
});

// PUT /api/profiles/me - Atualiza perfil do usuário logado (fields legados)
profilesRouter.put("/me", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const {
      displayName,
      bio,
      avatarUrl,
      socials: socialsPatch,
      lane_primaria,
      lane_secundaria,
      instagram,
      twitch,
      youtube,
      discord,
      chave_pix,
      tipo_chave_pix,
      nome_pix,
    } = req.body ?? {};

    const [current] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const currentSocials = (current?.socials as Record<string, string>) || {};

    const nextSocials: Record<string, string> = {
      ...currentSocials,
      ...(socialsPatch || {}),
      ...(instagram !== undefined ? { instagram } : {}),
      ...(twitch !== undefined ? { twitch } : {}),
      ...(youtube !== undefined ? { youtube } : {}),
      ...(discord !== undefined ? { discord } : {}),
    };

    await db
      .update(users)
      .set({
        ...(displayName !== undefined ? { displayName: String(displayName).trim() } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(lane_primaria !== undefined ? { lanePrimary: lane_primaria } : {}),
        ...(lane_secundaria !== undefined ? { laneSecondary: lane_secundaria } : {}),
        socials: nextSocials,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Chave Pix vive em user_payout_info (uma linha por usuário).
    if (chave_pix !== undefined || tipo_chave_pix !== undefined || nome_pix !== undefined) {
      const [existing] = await db.select().from(userPayoutInfo).where(eq(userPayoutInfo.userId, user.id)).limit(1);
      if (existing) {
        await db
          .update(userPayoutInfo)
          .set({
            ...(tipo_chave_pix !== undefined ? { pixType: tipo_chave_pix } : {}),
            ...(chave_pix !== undefined ? { pixKey: chave_pix } : {}),
            ...(nome_pix !== undefined ? { pixName: nome_pix } : {}),
            updatedAt: new Date(),
          })
          .where(eq(userPayoutInfo.userId, user.id));
      } else {
        await db.insert(userPayoutInfo).values({
          userId: user.id,
          pixType: tipo_chave_pix ?? "cpf",
          pixKey: chave_pix ?? "",
          pixName: nome_pix ?? "",
        });
      }
    }

    const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const [payout] = await db.select().from(userPayoutInfo).where(eq(userPayoutInfo.userId, user.id)).limit(1);

    return res.json({
      id: updated.id,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      socials: nextSocials,
      profile: toLegacyProfile(updated, payout),
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

    const { riot_id, puuid, summoner_id, level, profile_icon_id, nickname, handle } = req.body ?? {};
    const riotId = riot_id || handle;
    if (!riotId || !puuid) {
      return res.status(400).json({ error: "riot_id (Riot ID) e puuid são obrigatórios" });
    }

    const metadata: Record<string, any> = {
      ...(summoner_id !== undefined ? { summoner_id } : {}),
      ...(level !== undefined ? { level } : {}),
      ...(profile_icon_id !== undefined ? { profile_icon_id } : {}),
      ...(nickname !== undefined ? { nickname } : {}),
      verified_at: new Date().toISOString(),
    };

    const [existing] = await db
      .select()
      .from(gameAccounts)
      .where(and(eq(gameAccounts.userId, user.id), eq(gameAccounts.gameId, "lol")))
      .limit(1);

    if (existing) {
      const currentMeta = (existing.metadata as Record<string, any>) || {};
      const [updated] = await db
        .update(gameAccounts)
        .set({
          handle: riotId,
          externalId: puuid,
          metadata: { ...currentMeta, ...metadata },
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(gameAccounts.id, existing.id))
        .returning();
      return res.json(toLegacyRiot(updated));
    }

    const [created] = await db
      .insert(gameAccounts)
      .values({
        userId: user.id,
        gameId: "lol",
        externalId: puuid,
        handle: riotId,
        verified: true,
        metadata,
        syncedAt: new Date(),
      })
      .returning();

    return res.status(201).json(toLegacyRiot(created));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao vincular conta Riot" });
  }
});

// PUT /api/profiles/me/riot - Atualiza cache Riot (elo/champions) da PRÓPRIA conta
profilesRouter.put("/me/riot", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const [existing] = await db
      .select()
      .from(gameAccounts)
      .where(and(eq(gameAccounts.userId, user.id), eq(gameAccounts.gameId, "lol")))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: "Nenhuma conta Riot vinculada" });
    }

    const { elo_cache, champions_cache, stats_updated_at, profile_icon_id, level, summoner_id } = req.body ?? {};
    const currentMeta = (existing.metadata as Record<string, any>) || {};
    const nextMeta = {
      ...currentMeta,
      ...(elo_cache !== undefined ? { elo_cache } : {}),
      ...(champions_cache !== undefined ? { champions_cache } : {}),
      ...(stats_updated_at !== undefined ? { stats_updated_at } : {}),
      ...(profile_icon_id !== undefined ? { profile_icon_id } : {}),
      ...(level !== undefined ? { level } : {}),
      ...(summoner_id !== undefined ? { summoner_id } : {}),
    };

    const [updated] = await db
      .update(gameAccounts)
      .set({ metadata: nextMeta, updatedAt: new Date() })
      .where(eq(gameAccounts.id, existing.id))
      .returning();

    return res.json(toLegacyRiot(updated));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar conta Riot" });
  }
});

// DELETE /api/profiles/me/riot - Desvincula a conta Riot do usuário logado
profilesRouter.delete("/me/riot", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    await db
      .delete(gameAccounts)
      .where(and(eq(gameAccounts.userId, user.id), eq(gameAccounts.gameId, "lol")));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao desvincular conta Riot" });
  }
});

// GET /api/profiles/:id - Perfil público de qualquer usuário (shape legado)
profilesRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const [riotAccount, payout] = await Promise.all([
      getRiotAccount(user.id),
      db.select().from(userPayoutInfo).where(eq(userPayoutInfo.userId, user.id)).limit(1),
    ]);

    return res.json({
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      socials: user.socials,
      isVip: user.isVip,
      profile: toLegacyProfile(user, payout),
      riotAccount: toLegacyRiot(riotAccount),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar perfil público" });
  }
});
