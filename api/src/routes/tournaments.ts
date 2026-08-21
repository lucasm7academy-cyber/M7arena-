import { Router } from "express";
import { eq, and, gt, asc, desc, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions } from "../../../db/schema/identidade.js";
import { tournaments, tournamentTeams, tournamentMatches, tournamentStandings } from "../../../db/schema/tournaments.js";
import { toLegacyTournament, toLegacyTournamentList, statusToNew, formatToNew, statusToLegacy, formatToLegacy } from "../lib/tournament-shape.js";
import { storeLegacyWrites, storeTimesInscritos, storeCronograma, storeBracket } from "../lib/tournament-store.js";
import { appendTiebreakers } from "../lib/tournament-tiebreakers.js";

export const tournamentsRouter = Router();

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

/** Gera slug único a partir do título — padrão legado, com sufixo anti-colisão. */async function generateSlug(titulo: string) {
  const base =
    titulo
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "campeonato";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const [existing] = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.slug, slug))
      .limit(1);
    if (!existing) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Valores escalares legados → colunas novas (ignora os blocos normalizados). */
function legacyScalarsToDb(body: any) {
  return {
    ...(body.titulo !== undefined ? { name: String(body.titulo).trim() } : {}),
    ...(body.frase !== undefined ? { frase: body.frase ?? null } : {}),
    ...(body.formato !== undefined ? { format: formatToNew(body.formato) } : {}),
    ...(body.status !== undefined ? { status: statusToNew(body.status) } : {}),
    ...(body.vagas !== undefined ? { vagas: Math.max(0, Number(body.vagas) || 0) } : {}),
    ...(body.times_por_grupo !== undefined ? { timesPorGrupo: body.times_por_grupo ?? null } : {}),
    ...(body.classificados_por_grupo !== undefined ? { classificadosPorGrupo: body.classificados_por_grupo ?? null } : {}),
    ...(body.tier !== undefined ? { tier: body.tier ?? null } : {}),
    ...(body.data !== undefined ? { data: body.data ?? null } : {}),
    ...(body.premiacao !== undefined ? { premiacao: body.premiacao ?? null } : {}),
    ...(body.taxa !== undefined ? { taxa: body.taxa ?? null } : {}),
    ...(body.tem_outros_premios !== undefined ? { temOutrosPremios: Boolean(body.tem_outros_premios) } : {}),
    ...(body.outros_premios !== undefined ? { outrosPremios: body.outros_premios ?? null } : {}),
    ...(body.logo_url !== undefined ? { logoUrl: body.logo_url ?? null } : {}),
    ...(body.banner_url !== undefined ? { bannerUrl: body.banner_url ?? null } : {}),
    ...(body.org_photo_url !== undefined ? { orgPhotoUrl: body.org_photo_url ?? null } : {}),
    ...(body.organizacao !== undefined ? { organizacao: body.organizacao ?? null } : {}),
    ...(body.regulamento !== undefined ? { regulamento: body.regulamento ?? null } : {}),
    ...(body.theme_color !== undefined ? { themeColor: body.theme_color ?? "#FFB700" } : {}),
  };
}

/**
 * Desempate automático (ADR-046): ao finalizar jogos de um grupo, anexa jogos
 * de "DESEMPATE - {grupo}" quando há empate na fronteira de classificação.
 * Persiste via merge com chave determinística (idempotente).
 */
async function applyAutoTiebreakers(id: string, incoming: any[]) {
  const finalizedFases = new Set<string>();
  for (const j of incoming || []) {
    if (j.status === "finalizado" && j.fase) finalizedFases.add(j.fase);
  }
  if (!finalizedFases.size) return;

  const legacy = await toLegacyTournament(id);
  if (!legacy) return;

  let next = legacy as any;
  for (const fase of finalizedFases) {
    next = appendTiebreakers(next, fase);
  }

  const novos = (next.cronograma || []).filter((j: any) => !j.id);
  if (!novos.length) return;

  const withKeys = novos.map((j: any) => ({
    ...j,
    id: `${id}-desempate-${(j.fase || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${j.timeA}-${j.timeB}`,
  }));
  await storeCronograma(id, withKeys, true);
}

// ── GET /api/tournaments — lista em shape legado ───────────────────────────
tournamentsRouter.get("/", async (req, res) => {
  try {
    const statusLegacy = String(req.query.status || "").trim();
    const criadoPor = String(req.query.criado_por || "").trim();
    const ids = String(req.query.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const sort = String(req.query.sort || "created_at");

    const clauses: any[] = [];
    if (statusLegacy) clauses.push(eq(tournaments.status, statusToNew(statusLegacy)));
    if (criadoPor) clauses.push(eq(tournaments.organizerId, criadoPor));
    if (ids.length) clauses.push(inArray(tournaments.id, ids));

    const orderBy = sort === "titulo" ? [asc(tournaments.name)] : [desc(tournaments.createdAt)];

    const rows = clauses.length
      ? await db.select().from(tournaments).where(and(...clauses)).orderBy(...orderBy)
      : await db.select().from(tournaments).orderBy(...orderBy);

    if (!rows.length) return res.json([]);

    const counts = await toLegacyTournamentList(rows.map((r) => r.id));
    const items: any[] = [];
    for (const r of rows) {
      items.push(await toLegacyTournament(r.id, counts[r.id] ?? 0));
    }
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar campeonatos" });
  }
});

// ── GET /api/tournaments/:id — linha legada completa ──────────────────────
tournamentsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const legacy = await toLegacyTournament(id);
    if (!legacy) {
      return res.status(404).json({ error: "Campeonato não encontrado" });
    }
    return res.json(legacy);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar campeonato" });
  }
});

// ── POST /api/tournaments — criar (organizador vem da sessão, nunca do body) ─
tournamentsRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const body = req.body || {};
    const titulo = String(body.titulo || "").trim();
    if (!titulo) {
      return res.status(400).json({ error: "Título do campeonato é obrigatório" });
    }

    const [created] = await db
      .insert(tournaments)
      .values({
        gameId: "lol",
        name: titulo,
        slug: await generateSlug(titulo),
        format: formatToNew(body.formato),
        status: statusToNew(body.status),
        organizerId: user.id,
        prize: {},
        ...legacyScalarsToDb(body),
      })
      .returning();

    // Persiste os blocos legados nas tabelas
    await storeLegacyWrites(created.id, body);

    return res.status(201).json(await toLegacyTournament(created.id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar campeonato" });
  }
});

// ── PUT /api/tournaments/:id — atualização parcial (scalares + blocos) ─────
tournamentsRouter.put("/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { id } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) {
      return res.status(404).json({ error: "Campeonato não encontrado" });
    }

    const body = req.body || {};
    await db
      .update(tournaments)
      .set({ ...legacyScalarsToDb(body), updatedAt: new Date() })
      .where(eq(tournaments.id, id));

    await storeLegacyWrites(id, body);

    return res.json(await toLegacyTournament(id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar campeonato" });
  }
});

// ── DELETE /api/tournaments/:id — excluir (apenas o organizador) ───────────
tournamentsRouter.delete("/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { id } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) {
      return res.status(404).json({ error: "Campeonato não encontrado" });
    }
    if (t.organizerId !== user.id) {
      return res.status(403).json({ error: "Apenas o organizador pode excluir o campeonato" });
    }

    await db.delete(tournaments).where(eq(tournaments.id, id));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao excluir campeonato" });
  }
});

// ── Inscrição de time ──────────────────────────────────────────────────────
// Substitui a RPC registrar_time_campeonato (append atômico de um time).
tournamentsRouter.post("/:id/inscricoes", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    const teamEntry = req.body || {};
    await storeTimesInscritos(id, [teamEntry]);
    return res.status(201).json(await toLegacyTournament(id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao inscrever time" });
  }
});

// ── Aprovar/rejeitar time inscrito ─────────────────────────────────────────
// Substitui a RPC aprovar_time_campeonato.
tournamentsRouter.post("/:id/inscricoes/:teamId/aprovar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id, teamId } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    const aprovar = req.body?.p_aprovar !== false;
    await db.update(tournamentTeams)
      .set({ status: aprovar ? "approved" : "rejected" })
      .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId)));

    return res.json(await toLegacyTournament(id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao aprovar time" });
  }
});

// ── Reabrir campeonato ─────────────────────────────────────────────────────
// Substitui a RPC reabrir_campeonato.
tournamentsRouter.post("/:id/reabrir", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    await db.update(tournaments).set({ status: "open", updatedAt: new Date() }).where(eq(tournaments.id, id));
    return res.json(await toLegacyTournament(id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao reabrir campeonato" });
  }
});

// ── Atualizar cronograma (replace) ─────────────────────────────────────────
// Substitui a RPC atualizar_cronograma_campeonato.
tournamentsRouter.put("/:id/cronograma", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    await storeCronograma(id, req.body?.cronograma || [], false);
    await applyAutoTiebreakers(id, req.body?.cronograma || []);
    return res.json(await toLegacyTournament(id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao atualizar cronograma" });
  }
});

// ── Merge de jogos no cronograma (append/update atômico) ───────────────────
// Substitui a RPC merge_jogos_cronograma. Recebe { jogos: [...] }.
tournamentsRouter.put("/:id/cronograma/merge", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    await storeCronograma(id, req.body?.jogos || req.body?.cronograma || [], true);
    await applyAutoTiebreakers(id, req.body?.jogos || req.body?.cronograma || []);
    return res.json(await toLegacyTournament(id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao mesclar cronograma" });
  }
});

// ── Recalcular PDL global ──────────────────────────────────────────────────
// Substitui a RPC recalcular_pdl_global. No schema novo o PDL de cada time é
// derivado das partidas finalizadas; aqui apenas devolvemos ok (a classificação
// é sempre recalculada no shape).
tournamentsRouter.post("/:id/recalcular-pdl", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao recalcular PDL" });
  }
});
