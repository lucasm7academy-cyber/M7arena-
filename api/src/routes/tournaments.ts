import { Router } from "express";
import { eq, and, gt, asc, desc, inArray, count } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions } from "../../../db/schema/identidade.js";
import { tournaments, tournamentTeams } from "../../../db/schema/tournaments.js";

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

// ── Tradução entre o vocabulário do fork (legado) e o schema novo ──────────
// O fork do front (ADR-010) lê `status` inscricoes_em_breve/inscricoes_abertas/
// em_andamento/finalizado/cancelled e `formato` liga/mata_mata. O schema novo
// usa draft/open/in_progress/finished/cancelled e groups/single_elimination.
// A tradução vive aqui, na API, para as telas não mudarem uma linha (ADR-005).

const NEW_TO_LEGACY_STATUS: Record<string, string> = {
  draft: "inscricoes_em_breve",
  open: "inscricoes_abertas",
  in_progress: "em_andamento",
  finished: "finalizado",
  cancelled: "cancelled",
};

const LEGACY_TO_NEW_STATUS: Record<string, string> = {
  inscricoes_em_breve: "draft",
  inscricoes_abertas: "open",
  em_andamento: "in_progress",
  finalizado: "finished",
  cancelled: "cancelled",
};

const NEW_TO_LEGACY_FORMAT: Record<string, string> = {
  groups: "liga",
  single_elimination: "mata_mata",
};

const LEGACY_TO_NEW_FORMAT: Record<string, string> = {
  liga: "groups",
  mata_mata: "single_elimination",
};

function statusToNew(status: string | undefined): string {
  return (status && LEGACY_TO_NEW_STATUS[status]) || "open";
}

function statusToLegacy(status: string): string {
  return NEW_TO_LEGACY_STATUS[status] || status;
}

function formatToNew(format: string | undefined): string {
  return (format && LEGACY_TO_NEW_FORMAT[format]) || "single_elimination";
}

function formatToLegacy(format: string): string {
  return NEW_TO_LEGACY_FORMAT[format] || format;
}

/** Gera slug único a partir do título — padrão legado, com sufixo anti-colisão. */
async function generateSlug(titulo: string) {
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

/**
 * Linha normalizada → shape legado 1:1 (ADR-014). O fork consome os nomes
 * snake_case; as colunas jsonb (times_inscritos, bracket_data, etc.) passam
 * como estão. Colunas normalizadas sem equivalente legado ficam no payload
 * com nome camelCase para o contrato continuar completo e inofensivo.
 */
function toLegacyTournament(t: any, teamsCount?: number) {
  const base = {
    id: t.id,
    titulo: t.name,
    nome: t.name,
    criado_por: t.organizerId,
    formato: formatToLegacy(t.format),
    status: statusToLegacy(t.status),
    frase: t.frase ?? null,
    logo_url: t.logoUrl ?? null,
    banner_url: t.bannerUrl ?? null,
    org_photo_url: t.orgPhotoUrl ?? null,
    theme_color: t.themeColor ?? "#FFB700",
    regulamento: t.regulamento ?? null,
    vagas: t.vagas ?? 0,
    times_por_grupo: t.timesPorGrupo ?? null,
    classificados_por_grupo: t.classificadosPorGrupo ?? null,
    tier: t.tier ?? null,
    data: t.data ?? null,
    premiacao: t.premiacao ?? null,
    taxa: t.taxa ?? null,
    tem_outros_premios: t.temOutrosPremios ?? false,
    outros_premios: t.outrosPremios ?? null,
    organizacao: t.organizacao ?? null,
    times_inscritos: t.timesInscritos ?? [],
    classificacao: t.classificacao ?? [],
    grupos: t.grupos ?? {},
    cronograma: t.cronograma ?? [],
    times_ordem_sorteio: t.timesOrdemSorteio ?? [],
    grupos_sorteados: t.gruposSorteados ?? [],
    chaves_sorteados: t.chavesSorteados ?? [],
    bracket_data: t.bracketData ?? {},
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    // Colunas normalizadas sem par legado — inofensivas no payload.
    gameId: t.gameId,
    slug: t.slug,
    prize: t.prize,
    registrationOpensAt: t.registrationOpensAt,
    startsAt: t.startsAt,
    endsAt: t.endsAt,
  };
  return teamsCount !== undefined ? { ...base, registeredTeamsCount: teamsCount } : base;
}

/**
 * Payload legado (snake_case) → valores do schema novo. Spread condicional:
 * só campos presentes no body são atualizados (padrão do teams.ts). O
 * organizador NUNCA vem do body — é decidido na rota a partir da sessão.
 */
function legacyToDbValues(body: any) {
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
    ...(body.grupos !== undefined ? { grupos: body.grupos ?? {} } : {}),
    ...(body.cronograma !== undefined ? { cronograma: body.cronograma ?? [] } : {}),
    ...(body.grupos_sorteados !== undefined ? { gruposSorteados: body.grupos_sorteados ?? [] } : {}),
    ...(body.chaves_sorteados !== undefined ? { chavesSorteados: body.chaves_sorteados ?? [] } : {}),
    ...(body.times_inscritos !== undefined ? { timesInscritos: body.times_inscritos ?? [] } : {}),
    ...(body.classificacao !== undefined ? { classificacao: body.classificacao ?? [] } : {}),
    ...(body.times_ordem_sorteio !== undefined ? { timesOrdemSorteio: body.times_ordem_sorteio ?? [] } : {}),
    ...(body.bracket_data !== undefined ? { bracketData: body.bracket_data ?? {} } : {}),
  };
}

// ── GET /api/tournaments — lista em shape legado ───────────────────────────
// Query params opcionais: status (vocábulo legado), criado_por (uuid), ids
// (uuids separados por vírgula), sort (titulo | created_at, default desc).
// O `registeredTeamsCount` entra só aqui (contagem de tournament_teams).
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

    let counts = new Map<string, number>();
    if (rows.length) {
      const grouped = await db
        .select({ tournamentId: tournamentTeams.tournamentId, total: count() })
        .from(tournamentTeams)
        .where(inArray(tournamentTeams.tournamentId, rows.map((r) => r.id)))
        .groupBy(tournamentTeams.tournamentId);
      counts = new Map(grouped.map((g) => [g.tournamentId, g.total]));
    }

    return res.json(rows.map((r) => toLegacyTournament(r, counts.get(r.id) ?? 0)));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar campeonatos" });
  }
});

// ── GET /api/tournaments/:id — linha legada completa (inclui bracket_data) ──
tournamentsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) {
      return res.status(404).json({ error: "Campeonato não encontrado" });
    }
    return res.json(toLegacyTournament(t));
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
        ...legacyToDbValues(body),
      })
      .returning();

    return res.status(201).json(toLegacyTournament(created));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar campeonato" });
  }
});

// ── PUT /api/tournaments/:id — atualização parcial (spread condicional) ────
// Aceita payload completo, só bracket_data, ou bracket_data + chaves_sorteados
// + cronograma de uma vez — o que não vier no body não é tocado.
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

    const [updated] = await db
      .update(tournaments)
      .set({
        ...legacyToDbValues(req.body || {}),
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, id))
      .returning();

    return res.json(toLegacyTournament(updated));
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
