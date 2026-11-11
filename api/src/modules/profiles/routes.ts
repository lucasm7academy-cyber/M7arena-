import { Router } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../../db.js";
import {
  users,
  userSessions,
  userRoles,
  userPayoutInfo,
} from "../../../../db/schema/identidade.js";
import { gameAccounts } from "../../../../db/schema/games.js";
import { contarAdvertenciasAtivas, LIMITES } from "../../lib/match-flow.js";
import { vincularVagasConvidado } from "../teams/team-membership.js";

export const profilesRouter = Router();

/**
 * Confere na Riot se o PUUID informado pertence ao Riot ID antes de gravar o
 * vínculo. O front já consulta o proxy /api/riot, mas o endpoint precisa ser
 * seguro contra chamada direta: sem isso, qualquer conta poderia se declarar
 * dona de um Riot ID/PUUID alheio e herdar vagas de convidado.
 *
 * Em produção falha fechado: sem chave ou com erro da Riot, devolve null e a
 * rota responde 503. Em desenvolvimento local (NODE_ENV != production) permite
 * o fluxo sem Riot para testes de UI com chave dummy.
 */
async function validarRiotIdComPuuid(riotId: string, puuid: string): Promise<boolean | null> {
  if (process.env.NODE_ENV !== "production") return true;

  const key = process.env.RIOT_API_KEY;
  if (!key) return null;

  const [gameName, tagLine] = riotId.split("#");
  if (!gameName?.trim() || !tagLine?.trim()) return false;

  try {
    const url =
      "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/" +
      encodeURIComponent(gameName.trim()) + "/" + encodeURIComponent(tagLine.trim());
    const r = await fetch(url, { headers: { "X-Riot-Token": key } });
    if (r.status === 404) return false;
    if (!r.ok) return null;
    const account = await r.json() as { puuid?: string };
    return account?.puuid === puuid;
  } catch {
    return null;
  }
}

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

import { toLegacyProfile } from "../../lib/profile-shape.js";

// GET /api/profiles/me - Perfil completo do usuário logado (shape legado)
profilesRouter.get("/me", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const [roles, riotAccount, advertencias] = await Promise.all([
      getRoles(user.id),
      getRiotAccount(user.id),
      contarAdvertenciasAtivas(db, user.id),
    ]);

    const [payout] = await db.select().from(userPayoutInfo).where(eq(userPayoutInfo.userId, user.id)).limit(1);
    const socials = (user.socials as Record<string, string>) || {};

    return res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roles,
      // Advertências manuais (ADR-033) — "você tem 2/3 advertências" no perfil.
      advertencias,
      advertenciasMax: LIMITES.ADVERTENCIAS_PARA_BAN,
      status: user.status,
      banMotivo: user.banMotivo ?? null,
      banAutomatico: user.banAutomatico ?? false,
      suspensaAte: user.suspensaAte ?? null,
      termosAceitos: !!user.termosAceitosEm,
      profile: toLegacyProfile(user, payout),
      riotAccount: toLegacyRiot(riotAccount),
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

    const vinculoValido = await validarRiotIdComPuuid(String(riotId), String(puuid));
    if (vinculoValido === null) {
      return res.status(503).json({ error: "Não foi possível validar a conta na Riot agora. Tente novamente." });
    }
    if (!vinculoValido) {
      return res.status(400).json({ error: "Riot ID e PUUID não conferem na Riot" });
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
      await db.update(users).set({ riotId, updatedAt: new Date() }).where(eq(users.id, user.id)); // espelha users.riot_id (design v3 §2.1)
      // Decisão 24/10: ao vincular a conta, vaga de convidado que casa o Riot
      // ID/PUUID vira MEMBRO (é como se já tivesse aceitado).
      await vincularVagasConvidado(db, user.id, riotId, puuid);
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

    await db.update(users).set({ riotId, updatedAt: new Date() }).where(eq(users.id, user.id));
    await vincularVagasConvidado(db, user.id, riotId, puuid);
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
    await db.update(users).set({ riotId: null, updatedAt: new Date() }).where(eq(users.id, user.id)); // limpa espelho
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

    // Perfil público: NUNCA expõe dados de recebimento/Pix. O dono lê os
    // próprios dados em GET /api/profiles/me (autenticado).
    const riotAccount = await getRiotAccount(user.id);

    return res.json({
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      socials: user.socials,
      isVip: user.isVip,
      profile: toLegacyProfile(user, null),
      riotAccount: toLegacyRiot(riotAccount),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar perfil público" });
  }
});
