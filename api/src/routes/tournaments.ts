import { Router } from "express";
import { eq, and, gt, asc, desc, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userRoles } from "../../../db/schema/identidade.js";
import { tournaments, tournamentTeams, tournamentMatches, bracketMatches, tournamentStandings } from "../../../db/schema/tournaments.js";
import { teams } from "../../../db/schema/teams.js";
import {
  toLegacyTournament,
  toLegacyTournamentList,
  toLegacyTournamentCard,
  toLegacyTournamentShell,
  toLegacyTournamentSection,
  loadTournamentTags,
  buildCronograma,
  buildTimesInscritosResumo,
  statusToNew,
  formatToNew,
  statusToLegacy,
  formatToLegacy,
  type TournamentSection,
} from "../lib/tournament-shape.js";
import { storeLegacyWrites, storeTimesInscritos, storeCronograma, storeBracket, jogoConfirmadoSemHorario, removerInscricao } from "../lib/tournament-store.js";
import { appendTiebreakers } from "../lib/tournament-tiebreakers.js";
import { atribuirCodigoSerie, normalizarBestOf, verificarSerieCampeonato } from "../lib/serie-campeonato.js";
import { identidadeAcessoCampeonato, acessoNoCampeonato, redigirCodigosDaSerie, resolverPermissaoSerie } from "../lib/tournament-access.js";
import { recalcularPdlGlobal } from "../lib/tournament-pdl.js";
import { criarSalaCampeonato } from "../lib/sala-campeonato.js";

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

/**
 * Shape do campeonato com o código da série redigido para quem não joga nem
 * administra (sec.codigo-campeonato). Usado em TODA resposta que devolve a
 * linha legada — inclusive as de escrita — para o código nunca sair da API
 * para espectador ou estranho (espelha a ADR-043 das salas).
 */
async function shapeComAcesso(req: any, id: string) {
  const legacy = await toLegacyTournament(id);
  if (!legacy) return null;
  const user = await getAuthUser(req);
  const ident = user ? await identidadeAcessoCampeonato(db, user.id) : null;
  const acesso = acessoNoCampeonato(ident, { userId: user?.id, organizerId: (legacy as any).criado_por });
  return redigirCodigosDaSerie(legacy, acesso);
}

/** Acha a série (cronograma ou chave) pelo matchId, escopada ao campeonato. */
async function encontrarSerie(tournamentId: string, matchId: string) {
  const [m] = await db
    .select()
    .from(tournamentMatches)
    .where(and(eq(tournamentMatches.id, matchId), eq(tournamentMatches.tournamentId, tournamentId)))
    .limit(1);
  if (m) return { serie: m as any, isBracket: false };

  const [b] = await db
    .select()
    .from(bracketMatches)
    .where(and(eq(bracketMatches.id, matchId), eq(bracketMatches.tournamentId, tournamentId)))
    .limit(1);
  if (b) return { serie: b as any, isBracket: true };
  return null;
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
    // `card` = contrato da listagem; `agenda` = card + próximos jogos do Lobby.
    // Sem `view`, mantém o documento completo (admin e compatibilidade).
    const view = String(req.query.view || "").trim();

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

    if (view === "card") {
      res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
      return res.json(rows.map((r) => toLegacyTournamentCard(r, counts[r.id] ?? 0)));
    }

    if (view === "agenda") {
      const ids = rows.map((r) => r.id);
      // Duas queries para todos os campeonatos (sem N+1): só jogos confirmados
      // e o resumo dos times. O Lobby não precisa de mais nada.
      const [confirmedMatches, teamRows] = await Promise.all([
        db
          .select()
          .from(tournamentMatches)
          .where(and(inArray(tournamentMatches.tournamentId, ids), eq(tournamentMatches.status, "confirmado"))),
        db
          .select()
          .from(teams)
          .innerJoin(tournamentTeams, eq(tournamentTeams.teamId, teams.id))
          .where(inArray(tournamentTeams.tournamentId, ids)),
      ]);

      const matchesBy = new Map<string, any[]>();
      for (const m of confirmedMatches) {
        if (!m.teamATag || !m.teamBTag) continue;
        if (!m.displayDate || m.displayDate === "A COMBINAR") continue;
        const list = matchesBy.get(m.tournamentId) || [];
        list.push(m);
        matchesBy.set(m.tournamentId, list);
      }

      const teamsBy = new Map<string, any[]>();
      for (const row of teamRows) {
        const tid = row.tournament_teams.tournamentId;
        const list = teamsBy.get(tid) || [];
        list.push(row);
        teamsBy.set(tid, list);
      }

      const items = rows.map((r) => ({
        ...toLegacyTournamentCard(r, counts[r.id] ?? 0),
        cronograma: buildCronograma({ matches: matchesBy.get(r.id) || [], salasMap: new Map() }),
        times_inscritos: buildTimesInscritosResumo({ teamRows: teamsBy.get(r.id) || [] }),
      }));

      res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
      return res.json(items);
    }

    const user = await getAuthUser(req);
    const ident = user ? await identidadeAcessoCampeonato(db, user.id) : null;
    const items: any[] = [];
    for (const r of rows) {
      const legacy = await toLegacyTournament(r.id, counts[r.id] ?? 0);
      if (!legacy) continue;
      const acesso = acessoNoCampeonato(ident, { userId: user?.id, organizerId: r.organizerId });
      items.push(redigirCodigosDaSerie(legacy, acesso));
    }
    // Documento completo contém códigos de série — nunca cache compartilhado.
    res.set("Cache-Control", "private, no-store");
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar campeonatos" });
  }
});

// ── GET /api/tournaments/:id — linha legada completa ──────────────────────
tournamentsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const legacy = await shapeComAcesso(req, id);
    if (!legacy) {
      return res.status(404).json({ error: "Campeonato não encontrado" });
    }
    return res.json(legacy);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar campeonato" });
  }
});

// ── GET /api/tournaments/:id/shell — detalhe sem as seções pesadas ────────
// O detalhe abre com escalares + times inscritos; cronograma, classificação,
// grupos e chaves chegam por aba (ver rotas de seção abaixo). É o mesmo shape
// legado, só que particionado — o endpoint completo acima continua existindo
// para admin e compatibilidade.
tournamentsRouter.get("/:id/shell", async (req, res) => {
  try {
    const { id } = req.params;
    const shell = await toLegacyTournamentShell(id);
    if (!shell) {
      return res.status(404).json({ error: "Campeonato não encontrado" });
    }
    // Curto e privado: shell tem por código de série nada, mas pode responder
    // diferente para staff em breve; cache compartilhado não é necessário.
    res.set("Cache-Control", "private, max-age=5, must-revalidate");
    return res.json(shell);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar campeonato" });
  }
});

// ── GET /api/tournaments/:id/:secao — uma seção pesada por vez ────────────
const SECOES_DETALHE: TournamentSection[] = ["cronograma", "classificacao", "grupos", "chaves"];

/**
 * Seção no shape legado. Cronograma e chaves carregam `codigo_partida`, então
 * passam pela mesma redação do detalhe completo (ADR-043): só staff ou quem
 * joga a série enxerga o código.
 */
async function shapeSecaoComAcesso(req: any, id: string, section: TournamentSection) {
  const secao = await toLegacyTournamentSection(id, section);
  if (!secao) return null;
  if (section !== "cronograma" && section !== "chaves") return secao;

  const [t, tags, user] = await Promise.all([
    db.select({ organizerId: tournaments.organizerId }).from(tournaments).where(eq(tournaments.id, id)).limit(1),
    loadTournamentTags(id),
    getAuthUser(req),
  ]);

  // `redigirCodigosDaSerie` resolve tag -> time por `times_inscritos`; aqui só
  // id/tag importam, então evita montar o cadastro completo dos times.
  const ident = user ? await identidadeAcessoCampeonato(db, user.id) : null;
  const acesso = acessoNoCampeonato(ident, { userId: user?.id, organizerId: (t[0] as any)?.organizerId });
  const inscritos = tags.map((row: any) => ({ id: row.id, tag: row.tag }));
  const comTags: any = redigirCodigosDaSerie({ times_inscritos: inscritos, ...secao }, acesso);
  // O mapa tag->time é só ferramenta de redação: a seção responde apenas com a
  // sua própria chave (cronograma ou bracket_data).
  delete comTags.times_inscritos;
  return comTags;
}

for (const section of SECOES_DETALHE) {
  tournamentsRouter.get(`/:id/${section}`, async (req, res) => {
    try {
      const { id } = req.params;
      const secao = await shapeSecaoComAcesso(req, id, section);
      if (!secao) {
        return res.status(404).json({ error: "Campeonato não encontrado" });
      }
      // Seção pode conter código de série para participante: nunca cache público.
      res.set("Cache-Control", "private, max-age=5, must-revalidate");
      return res.json(secao);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Erro ao buscar seção do campeonato" });
    }
  });
}

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

    return res.status(201).json(await shapeComAcesso(req, created.id));
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

    return res.json(await shapeComAcesso(req, id));
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
    // Organizador dono OU admin/proprietário (antes só o criador podia; o
    // admin tomava 403 silencioso e o campeonato "voltava" ao recarregar).
    const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));
    const podeExcluir =
      t.organizerId === user.id || roles.some((r) => ["admin", "proprietario"].includes(r.role));
    if (!podeExcluir) {
      return res.status(403).json({ error: "Apenas o organizador ou um administrador pode excluir o campeonato" });
    }

    await db.delete(tournaments).where(eq(tournaments.id, id));
    // Os jogos do campeonato saem junto (cascade): PDL/V/D precisam refletir.
    await recalcularPdlGlobal(db);
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
    return res.status(201).json(await shapeComAcesso(req, id));
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

    return res.json(await shapeComAcesso(req, id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao aprovar time" });
  }
});

// ── Remover inscrição de time ──────────────────────────────────────────────
// Exclui a inscrição (tournament_teams) e a classificação do time. Antes a tela
// mandava o campeonato inteiro no save e o upsert não removia nada — o time
// "voltava" ao recarregar a página.
tournamentsRouter.delete("/:id/inscricoes/:teamId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id, teamId } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));
    const podeGerenciar =
      t.organizerId === user.id || roles.some((r) => ["admin", "proprietario"].includes(r.role));
    if (!podeGerenciar) {
      return res.status(403).json({ error: "Apenas o organizador ou um administrador pode remover inscrições" });
    }

    await removerInscricao(id, teamId);
    return res.json(await shapeComAcesso(req, id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao remover inscrição" });
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
    return res.json(await shapeComAcesso(req, id));
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
    return res.json(await shapeComAcesso(req, id));
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

    const jogos = req.body?.jogos || req.body?.cronograma || [];
    // Confirmação exige data/hora: o aceite do agendamento não pode criar um
    // jogo confirmado sem horário (bug do 20:00).
    const semHorario = jogos.find(jogoConfirmadoSemHorario);
    if (semHorario) {
      return res.status(400).json({ error: "Jogo confirmado sem data/horário definidos. Proponha um horário antes de confirmar." });
    }

    await storeCronograma(id, jogos, true);
    await applyAutoTiebreakers(id, jogos);
    return res.json(await shapeComAcesso(req, id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao mesclar cronograma" });
  }
});

// ── Recalcular PDL global ──────────────────────────────────────────────────
// Substitui a RPC recalcular_pdl_global: PDL/V/D/ranking de cada time derivam
// dos jogos FINALIZADOS do cronograma (chave não conta). Recálculo do zero,
// idempotente — chamado pelo front após finalizar/editar um jogo.
tournamentsRouter.post("/:id/recalcular-pdl", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    const r = await recalcularPdlGlobal(db);
    return res.json({ ok: true, ...r });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao recalcular PDL" });
  }
});

// ── Verificação de série via código Riot (ADR-047) ─────────────────────────

/**
 * POST /api/tournaments/:id/jogo/:matchId/gerar-codigo
 * Atribui um tournament code do pool à SERIE (tournament_matches), marca o
 * jogo como 'em_andamento' e devolve o código. O criador do torneio (organizer)
 * chama ao agendar. O código vale a série inteira (MD3/MD5).
 */
tournamentsRouter.post("/:id/jogo/:matchId/gerar-codigo", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id, matchId } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    const encontrada = await encontrarSerie(id, matchId);
    if (!encontrada) return res.status(404).json({ error: "Jogo não encontrado" });
    const { serie, isBracket } = encontrada;

    // Permissão: staff do campeonato OU time da série (dono/membro aceito,
    // incluindo convidado reconhecido pelo vínculo Riot — ADR-056).
    const { isStaff, isParticipant } = await resolverPermissaoSerie(db, {
      userId: user.id,
      organizerId: t.organizerId,
      tournamentId: id,
      serie,
    });

    if (!isStaff && !isParticipant) {
      return res.status(403).json({
        error: "Sem permissão. Apenas capitães/jogadores da partida ou organizadores podem iniciar a série.",
      });
    }

    let codigo = serie.codigoPartida;
    if (!codigo) {
      // Códigos de sala: 1v1 tem fila própria; demais usam os genéricos 5v5.
      const modo = t.gameId === "lol" ? "5v5" : "5v5";
      codigo = await atribuirCodigoSerie(db, modo);
      if (codigo === "SEM-CODIGO-AGUARDE") return res.status(409).json({ error: "Sem código disponível no momento" });
      // Formato da série: `best_of` gravado na criação do jogo (MD1/MD3/MD5 no
      // Painel de Arbitragem). Sem valor válido → MD3. A heurística antiga
      // (final→MD5) nunca disparava: phase não existe em bracket e no
      // cronograma é sempre group_stage.
      const bestOf = normalizarBestOf(serie.bestOf) ?? 3;

      if (isBracket) {
        await db
          .update(bracketMatches)
          .set({
            codigoPartida: codigo,
            bestOf,
            serieIniciadaAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bracketMatches.id, serie.id));
      } else {
        await db
          .update(tournamentMatches)
          .set({
            codigoPartida: codigo,
            status: "em_andamento",
            bestOf,
            serieIniciadaAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tournamentMatches.id, serie.id));
      }
    } else {
      // Já tem código: garante o status 'em_andamento'.
      if (!isBracket) {
        await db
          .update(tournamentMatches)
          .set({ status: "em_andamento", updatedAt: new Date() })
          .where(eq(tournamentMatches.id, serie.id));
      }
    }

    return res.json(await shapeComAcesso(req, id));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao gerar código" });
  }
});

/**
 * POST /api/tournaments/:id/jogo/:matchId/verificar
 * Dispara a verificação da série agora (além do cron). Se fechou, marca o jogo
 * finalizada e devolve o resultado. Paridade com /matches/:id/verificar.
 */
tournamentsRouter.post("/:id/jogo/:matchId/verificar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id, matchId } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    // Acelerar a verificação é tão sensível quanto iniciar a série: exige staff
    // do campeonato ou time da série (antes, qualquer usuário logado disparava).
    const encontrada = await encontrarSerie(id, matchId);
    if (!encontrada) return res.status(404).json({ error: "Jogo não encontrado" });
    const { isStaff, isParticipant } = await resolverPermissaoSerie(db, {
      userId: user.id,
      organizerId: t.organizerId,
      tournamentId: id,
      serie: encontrada.serie,
    });
    if (!isStaff && !isParticipant) {
      return res.status(403).json({
        error: "Sem permissão. Apenas capitães/jogadores da partida ou organizadores podem verificar a série.",
      });
    }

    const r = await verificarSerieCampeonato(db, { matchId });
    return res.json({ ...r, tournament: await shapeComAcesso(req, id) });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao verificar série" });
  }
});

// ── Sala Campeonato: criação manual (A COMBINAR / imprevisto) — ADR-084 ─────
// Jogos com horário ganham sala sozinhos (T-10min); este endpoint cobre o resto
// e devolve a sala existente se já houver (idempotente para o front).
tournamentsRouter.post("/:id/jogo/:matchId/sala", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    const { id, matchId } = req.params;
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
    if (!t) return res.status(404).json({ error: "Campeonato não encontrado" });

    const encontrada = await encontrarSerie(id, matchId);
    if (!encontrada) return res.status(404).json({ error: "Jogo não encontrado" });

    const { isStaff, isParticipant } = await resolverPermissaoSerie(db, {
      userId: user.id,
      organizerId: t.organizerId,
      tournamentId: id,
      serie: encontrada.serie,
    });
    if (!isStaff && !isParticipant) {
      return res.status(403).json({
        error: "Sem permissão. Apenas capitães/jogadores da partida ou organizadores podem criar a sala.",
      });
    }

    const r = await criarSalaCampeonato(db, { torneio: t, serie: encontrada.serie, isBracket: encontrada.isBracket });
    if (!r.ok) return res.status(r.erro === "sem_codigo" ? 409 : 400).json({ error: r.erro });
    return res.json({ ok: true, criada: r.criada, sala_num: r.sala.salaNum, sala_id: r.sala.id });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao criar sala" });
  }
});
