import { Router } from "express";
import { eq, and, or, ilike, desc, asc, inArray, count, gt, ne } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions } from "../../../db/schema/identidade.js";
import {
  teams,
  teamMembers,
  teamStats,
  teamInvites,
} from "../../../db/schema/teams.js";

export const teamsRouter = Router();

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

// ── Tradução entre o vocabulário do fork (legado) e o schema novo ──────────
// O fork do front (ADR-010) lê lançamentos `lane` TOP/JG/MID/ADC/SUP/RES/COACH,
// `tipo` jogador/coach e `status` ativo/saiu. O schema novo usa role_slot
// top/jungle/mid/adc/support/sub/coach e status accepted/declined. A tradução
// vive aqui, na API, para as telas não mudarem uma linha de JSX (ADR-005).

const ROLE_LEGACY_TO_SLOT: Record<string, string> = {
  TOP: "top",
  JG: "jungle",
  MID: "mid",
  ADC: "adc",
  SUP: "support",
  RES: "sub",
  COACH: "coach",
};

const ROLE_SLOT_TO_LEGACY: Record<string, string> = {
  top: "TOP",
  jungle: "JG",
  mid: "MID",
  adc: "ADC",
  support: "SUP",
  sub: "RES",
  coach: "COACH",
};

function slotToLegacy(slot: string | null): string {
  return (slot && ROLE_SLOT_TO_LEGACY[slot]) || "TOP";
}

function legacyToSlot(role: string | null | undefined): string {
  return (role && ROLE_LEGACY_TO_SLOT[role]) || "top";
}

function memberStatusToLegacy(status: string): string {
  if (status === "declined") return "saiu";
  if (status === "pending") return "pendente";
  return "ativo";
}

function toLegacyMember(m: any) {
  return {
    id: m.id,
    time_id: m.teamId,
    user_id: m.userId,
    tipo: m.roleSlot === "coach" ? "coach" : "jogador",
    lane: slotToLegacy(m.roleSlot),
    is_capitao: Boolean(m.isCaptain),
    status: memberStatusToLegacy(m.status),
    guest_riot_id: m.guestRiotId ?? m.guestHandle ?? null,
    guest_puuid: m.guestPuuid ?? null,
    guest_profile_icon_id: m.guestProfileIconId ?? null,
    guest_elo_cache: m.guestEloCache ?? null,
  };
}

function toLegacyTeam(t: any, stats: any, capitaoId: string | null = null) {
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const gamesPlayed = wins + losses;
  const winrate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const contacts = (t.contacts as Record<string, string>) || {};
  return {
    id: t.id,
    nome: t.name,
    tag: t.tag,
    logo_url: t.logoUrl ?? null,
    gradient_from: t.gradientFrom || "#FFB700",
    gradient_to: t.gradientTo || "#FF6600",
    pdl: stats?.pdl ?? 0,
    winrate,
    ranking: stats?.ranking ?? 999,
    wins,
    games_played: gamesPlayed,
    dono_id: t.ownerId,
    capitao_id: capitaoId,
    whatsapp: contacts.whatsapp ?? null,
    discord: contacts.discord ?? null,
    status: t.status,
  };
}

function toLegacyInvite(i: any) {
  return {
    id: i.id,
    time_id: i.teamId,
    de_user_id: i.fromUserId,
    para_user_id: i.toUserId,
    riot_id: i.riotId ?? null,
    role: i.role,
    mensagem: i.message ?? null,
    tipo: i.type === "request" ? "solicitacao" : "convite",
    status: i.status === "accepted" ? "aceito" : i.status === "declined" ? "recusado" : "pendente",
    criado_em: i.createdAt,
  };
}

const INVITE_LEGACY_TYPE_TO_NEW: Record<string, string> = {
  solicitacao: "request",
  convite: "invite",
};

async function getStats(teamId: string) {
  const [stats] = await db.select().from(teamStats).where(eq(teamStats.teamId, teamId)).limit(1);
  return stats || null;
}

/** Valida vaga no time replicando a regra do validarVagaTime do fork. */
function validateSlot(members: any[], roleLegacy: string): string | null {
  const nonCoach = members.filter((m) => slotToLegacy(m.roleSlot) !== "COACH").length;
  if (roleLegacy !== "COACH" && nonCoach >= 8) {
    return "O time já está cheio (máximo de 8 jogadores).";
  }
  if (roleLegacy !== "RES") {
    if (members.some((m) => slotToLegacy(m.roleSlot) === roleLegacy)) {
      return "Essa rota já foi preenchida no time.";
    }
  } else if (members.filter((m) => slotToLegacy(m.roleSlot) === "RES").length >= 3) {
    return "O time já tem 3 reservas.";
  }
  return null;
}

// ── GET /api/teams/batch?ids=a,b,c — legenda de times por id (nomes/cores) ──
teamsRouter.get("/batch", async (req, res) => {
  try {
    const ids = String(req.query.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return res.json([]);

    const rows = await db.select().from(teams).where(inArray(teams.id, ids));
    return res.json(
      rows.map((t) => ({
        id: t.id,
        nome: t.name,
        tag: t.tag,
        logo_url: t.logoUrl ?? null,
        gradient_from: t.gradientFrom || "#FFB700",
        gradient_to: t.gradientTo || "#FF6600",
      }))
    );
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar times" });
  }
});

// ── GET /api/teams/members?user_ids=a,b&guest_riot_ids=x,y — membros lote ──
teamsRouter.get("/members", async (req, res) => {
  try {
    const userIds = String(req.query.user_ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const guestRiotIds = String(req.query.guest_riot_ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const clauses = [];
    if (userIds.length) clauses.push(inArray(teamMembers.userId, userIds));
    if (guestRiotIds.length)
      clauses.push(inArray(teamMembers.guestRiotId, guestRiotIds));
    if (clauses.length === 0) return res.json([]);

    const rows = await db.select().from(teamMembers).where(or(...clauses));
    return res.json(
      rows.map((m) => ({
        user_id: m.userId,
        time_id: m.teamId,
        guest_riot_id: m.guestRiotId ?? null,
      }))
    );
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar membros" });
  }
});

// ── GET /api/teams/by-user/:userId — times de um usuário (público) ─────────
teamsRouter.get("/by-user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const rows = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const memberships = rows.map((m) => ({ time_id: m.teamId, status: memberStatusToLegacy(m.status) }));

    const teamIds = [...new Set(rows.map((m) => m.teamId).filter(Boolean))];
    let teamsList: any[] = [];
    if (teamIds.length) {
      const trows = await db.select().from(teams).where(inArray(teams.id, teamIds));
      teamsList = trows.map((t) => ({
        id: t.id,
        nome: t.name,
        tag: t.tag,
        logo_url: t.logoUrl ?? null,
        gradient_from: t.gradientFrom || "#FFB700",
        gradient_to: t.gradientTo || "#FF6600",
      }));
    }

    return res.json({ memberships, teams: teamsList });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar times do usuário" });
  }
});

// ── GET /api/teams — lista com busca + paginação ───────────────────────────
teamsRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(0, parseInt(String(req.query.page || "0"), 10) || 0);
    const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
    const search = String(req.query.search || "").trim();
    const sort = String(req.query.sort || "pdl");
    const dir = String(req.query.dir || "desc");

    const filters = search
      ? and(eq(teams.status, "active"), or(ilike(teams.name, `%${search}%`), ilike(teams.tag, `%${search}%`)))
      : eq(teams.status, "active");

    const orderBy =
      sort === "ranking"
        ? [dir === "asc" ? asc(teamStats.ranking) : desc(teamStats.ranking), desc(teamStats.pdl)]
        : sort === "nome"
          ? [asc(teams.name)]
          : [desc(teamStats.pdl), desc(teamStats.wins)];

    const [countRow] = await db.select({ total: count() }).from(teams).where(filters);

    const rows = await db
      .select()
      .from(teams)
      .leftJoin(teamStats, and(eq(teamStats.teamId, teams.id), eq(teamStats.seasonId, "s1")))
      .where(filters)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(page * limit);

    const statsByTeam = new Map<string, any>();
    for (const row of rows) {
      const stats = row.team_stats || (await getStats(row.teams.id));
      statsByTeam.set(row.teams.id, stats);
    }

    return res.json({
      teams: rows.map((r) => toLegacyTeam(r.teams, statsByTeam.get(r.teams.id))),
      total: countRow?.total ?? 0,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar times" });
  }
});

// ── GET /api/teams/invites — convites do usuário logado ────────────────────
teamsRouter.get("/invites", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const rows = await db
      .select()
      .from(teamInvites)
      .where(or(eq(teamInvites.toUserId, user.id), eq(teamInvites.fromUserId, user.id)))
      .orderBy(desc(teamInvites.createdAt))
      .limit(50);
    return res.json(rows.map(toLegacyInvite));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar convites" });
  }
});

// ── GET /api/teams/:id — detalhe com membros (shape que a TimePage consome) ─
teamsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      return res.status(404).json({ error: "Time não encontrado" });
    }

    const [stats] = await db.select().from(teamStats).where(eq(teamStats.teamId, team.id)).limit(1);
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, team.id));

    const capitao = members.find((m) => m.isCaptain);
    return res.json({
      ...toLegacyTeam(team, stats || null, capitao?.userId ?? team.ownerId),
      time_membros: members.map(toLegacyMember),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar detalhes do time" });
  }
});

// ── POST /api/teams — criar time (dono vira capitão, stats zeradas) ────────
teamsRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { nome, tag, logo_url, gradient_from, gradient_to, whatsapp, discord } = req.body;
    if (!nome || !tag) {
      return res.status(400).json({ error: "Nome e TAG do time são obrigatórios" });
    }

    const [existing] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.gameId, "lol"), eq(teams.tag, String(tag).trim().toUpperCase())))
      .limit(1);
    if (existing) {
      return res.status(409).json({ error: `A tag #${String(tag).trim().toUpperCase()} já está em uso. Escolha outra tag.` });
    }

    const [newTeam] = await db
      .insert(teams)
      .values({
        gameId: "lol",
        name: String(nome).trim(),
        tag: String(tag).trim().toUpperCase(),
        logoUrl: logo_url ?? null,
        gradientFrom: gradient_from || "#FFB700",
        gradientTo: gradient_to || "#FF6600",
        ownerId: user.id,
        contacts: { whatsapp: whatsapp ?? undefined, discord: discord ?? undefined },
      })
      .returning();

    await db.insert(teamStats).values({
      teamId: newTeam.id,
      seasonId: "s1",
      pdl: 0,
      wins: 0,
      losses: 0,
    });

    await db.insert(teamMembers).values({
      teamId: newTeam.id,
      userId: user.id,
      roleSlot: "top",
      isCaptain: true,
      status: "accepted",
    });

    return res.status(201).json(toLegacyTeam(newTeam, { pdl: 0, wins: 0, losses: 0, ranking: null }, user.id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar time" });
  }
});

// ── PUT /api/teams/:id — atualizar cadastro (dono ou capitão) ──────────────
teamsRouter.put("/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { id } = req.params;
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      return res.status(404).json({ error: "Time não encontrado" });
    }

    const isOwner = team.ownerId === user.id;
    const [cap] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.isCaptain, true)))
      .limit(1);
    const isCaptain = !isOwner && Boolean(cap && cap.userId === user.id);
    if (!isOwner && !isCaptain) {
      return res.status(403).json({ error: "Apenas o dono ou capitão pode editar o time" });
    }

    const { nome, tag, logo_url, gradient_from, gradient_to, whatsapp, discord } = req.body;
    const [updated] = await db
      .update(teams)
      .set({
        ...(nome !== undefined ? { name: String(nome).trim() } : {}),
        ...(tag !== undefined ? { tag: String(tag).trim().toUpperCase() } : {}),
        ...(logo_url !== undefined ? { logoUrl: logo_url || null } : {}),
        ...(gradient_from !== undefined ? { gradientFrom: gradient_from || null } : {}),
        ...(gradient_to !== undefined ? { gradientTo: gradient_to || null } : {}),
        ...(whatsapp !== undefined || discord !== undefined
          ? { contacts: { ...(team.contacts || {}), ...(whatsapp !== undefined ? { whatsapp: whatsapp || undefined } : {}), ...(discord !== undefined ? { discord: discord || undefined } : {}) } }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(teams.id, id))
      .returning();

    return res.json(toLegacyTeam(updated, await getStats(id), cap?.userId ?? team.ownerId));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar time" });
  }
});

// ── POST /api/teams/:id/leave — sair do time (saga do handleSairTime) ──────
teamsRouter.post("/:id/leave", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { id } = req.params;
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      return res.status(404).json({ error: "Time não encontrado" });
    }

    const [my] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, user.id)))
      .limit(1);
    if (!my) {
      return res.status(400).json({ error: "Você não é membro deste time" });
    }

    const todos = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.status, "accepted")));
    const restantes = todos.filter((m) => m.userId !== user.id);

    if (restantes.length === 0) {
      await db.delete(teamMembers).where(eq(teamMembers.teamId, id));
      await db.delete(teamStats).where(eq(teamStats.teamId, id));
      await db.delete(teams).where(eq(teams.id, id));
      return res.json({ ok: true, deleted: true });
    }

    const isLeader = Boolean(my.isCaptain) || team.ownerId === user.id;
    if (isLeader) {
      const proximo = restantes.find((m) => !m.isCaptain) || restantes[0];
      await db
        .update(teamMembers)
        .set({ isCaptain: true })
        .where(eq(teamMembers.id, proximo.id));
    }

    const aposPromocao = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.status, "accepted"), ne(teamMembers.userId, user.id)));

    if (aposPromocao.length > 0 && aposPromocao.every((m: any) => !m.isCaptain)) {
      await db
        .update(teamMembers)
        .set({ isCaptain: true })
        .where(eq(teamMembers.id, aposPromocao[0].id));
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, my.id));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao sair do time" });
  }
});

// ── POST /api/teams/memberships/remove — remove todas as associações do user ─
teamsRouter.post("/memberships/remove", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    await db.delete(teamMembers).where(eq(teamMembers.userId, user.id));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao remover associações" });
  }
});

// ── POST /api/teams/invites — criar convite/solicitação ────────────────────
teamsRouter.post("/invites", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { time_id, para_user_id, riot_id, role, mensagem, tipo } = req.body;
    if (!time_id || !role) {
      return res.status(400).json({ error: "time_id e role são obrigatórios" });
    }

    const [invite] = await db
      .insert(teamInvites)
      .values({
        teamId: time_id,
        fromUserId: user.id,
        toUserId: para_user_id ?? null,
        riotId: riot_id ?? null,
        role,
        message: mensagem ?? null,
        type: INVITE_LEGACY_TYPE_TO_NEW[tipo] || "request",
        status: "pending",
      })
      .returning();

    return res.status(201).json(toLegacyInvite(invite));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar convite" });
  }
});

// ── POST /api/teams/invites/clear — limpar convites de status ──────────────
teamsRouter.post("/invites/clear", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.json({ ok: true });

    await db
      .delete(teamInvites)
      .where(and(inArray(teamInvites.id, ids), eq(teamInvites.fromUserId, user.id)));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao limpar convites" });
  }
});

// ── POST /api/teams/invites/:id/accept — aceitar convite/solicitação ───────
teamsRouter.post("/invites/:id/accept", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const [invite] = await db.select().from(teamInvites).where(eq(teamInvites.id, req.params.id)).limit(1);
    if (!invite) return res.status(404).json({ error: "Convite não encontrado" });
    if (invite.status !== "pending") return res.status(400).json({ error: "Este convite já foi respondido." });

    const [team] = await db.select().from(teams).where(eq(teams.id, invite.teamId)).limit(1);
    if (!team) return res.status(404).json({ error: "Time não encontrado" });

    const isRequest = invite.type === "request";
    const targetUserId = isRequest ? invite.fromUserId : invite.toUserId;
    if (!targetUserId) {
      return res.status(400).json({ error: "Este convite não tem destinatário" });
    }

    if (!isRequest) {
      if (invite.toUserId !== user.id) {
        return res.status(403).json({ error: "Este convite não é para você" });
      }
    } else {
      const [cap] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.isCaptain, true)))
        .limit(1);
      const canManage = team.ownerId === user.id || (cap && cap.userId === user.id);
      if (!canManage) {
        return res.status(403).json({ error: "Apenas o dono ou capitão pode aceitar solicitações" });
      }
    }

    const [existing] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, targetUserId))
      .limit(1);
    if (existing) {
      const msg = isRequest
        ? "Este jogador já pertence a outro time."
        : "Você já pertence a um time. Saia antes de aceitar outro convite.";
      return res.status(409).json({ error: msg });
    }

    const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, team.id));
    const slotErro = validateSlot(members, invite.role);
    if (slotErro) return res.status(409).json({ error: slotErro });

    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: targetUserId,
      roleSlot: legacyToSlot(invite.role),
      isCaptain: false,
      status: "accepted",
    });
    await db.update(teamInvites).set({ status: "accepted" }).where(eq(teamInvites.id, invite.id));

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao aceitar convite" });
  }
});

// ── POST /api/teams/invites/:id/decline — recusar convite/solicitação ──────
teamsRouter.post("/invites/:id/decline", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const [invite] = await db.select().from(teamInvites).where(eq(teamInvites.id, req.params.id)).limit(1);
    if (!invite) return res.status(404).json({ error: "Convite não encontrado" });
    if (invite.status !== "pending") return res.status(400).json({ error: "Este convite já foi respondido." });

    await db.update(teamInvites).set({ status: "declined" }).where(eq(teamInvites.id, invite.id));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao recusar convite" });
  }
});

// ── DELETE /api/teams/:id — dissolver (apenas quando sem membros) ──────────
teamsRouter.delete("/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const { id } = req.params;
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) return res.status(404).json({ error: "Time não encontrado" });

    const [countRow] = await db
      .select({ total: count() })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.status, "accepted")));
    if ((countRow?.total ?? 0) > 0) {
      return res.status(409).json({ error: "O time ainda tem membros" });
    }

    await db.delete(teamStats).where(eq(teamStats.teamId, id));
    await db.delete(teamInvites).where(eq(teamInvites.teamId, id));
    await db.delete(teams).where(eq(teams.id, id));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao dissolver time" });
  }
});
