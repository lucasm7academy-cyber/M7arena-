/**
 * tournament-shape.ts — reconstrói o shape legado de campeonato (ADR-016).
 *
 * O fork do front (ADR-010) consome os nomes snake_case e os 8 campos que
 * antigamente eram blobs JSONB (times_inscritos, cronograma, classificacao,
 * grupos, bracket_data, times_ordem_sorteio, grupos_sorteados, chaves_sorteados).
 * Com a normalização (ADR-016), esses dados vivem em tabelas relacionais; este
 * módulo recompõe o shape 1:1 que o JSX espera — o front não muda uma linha.
 *
 * O bracket guarda tags de exibição + ids resolvidos (snapshot). O cronograma
 * idem. A classificação é derivada do cronograma quando há jogos finalizados,
 * com fallback para a tabela tournament_standings (manual).
 */
import { eq, inArray, count } from "drizzle-orm";
import { db } from "../db.js";
import { matches as salasTable } from "../../../db/schema/matches.js";
import {
  tournaments,
  tournamentTeams,
  tournamentGroups,
  tournamentMatches,
  bracketMatches,
  tournamentStandings,
} from "../../../db/schema/tournaments.js";
import { teams } from "../../../db/schema/teams.js";

// Fases vivas da Sala Campeonato (espelha FASES_ATIVAS_CAMPEONATO de sala-campeonato.ts).
const SALA_CAMPEONATO_ATIVA = ["camp_vagas", "camp_prontos", "camp_lado", "camp_draft", "camp_jogo"];

// Vocabulário legado <-> novo (mesma tradução da rota)
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

export function statusToLegacy(status: string): string {
  return NEW_TO_LEGACY_STATUS[status] || status;
}
export function statusToNew(status: string | undefined): string {
  return (status && LEGACY_TO_NEW_STATUS[status]) || "open";
}
export function formatToLegacy(format: string): string {
  return NEW_TO_LEGACY_FORMAT[format] || format;
}
export function formatToNew(format: string | undefined): string {
  return (format && LEGACY_TO_NEW_FORMAT[format]) || "single_elimination";
}

/** Traduz o status do cronograma legado para o valor que o fork espera. */
export function cronogramaStatusToLegacy(status: string | null | undefined): string {
  if (status === "finalizada") return "finalizado";
  return status || "combinando";
}

/**
 * Salas Campeonato ativas por série (o cronograma mostra "Entrar na Sala").
 * Extraído para ser reutilizado tanto pela carga completa quanto pela seção
 * `cronograma` (lazy load por aba).
 */
async function loadSalasMap(matches: any[], d: any) {
  const salasMap = new Map<string, number>();
  if (!matches.length) return salasMap;

  const salas = await d
    .select({ matchId: salasTable.tournamentMatchId, salaNum: salasTable.salaNum, status: salasTable.status })
    .from(salasTable)
    .where(inArray(salasTable.tournamentMatchId, matches.map((m: any) => m.id)));

  for (const s of salas) {
    if (s.matchId && SALA_CAMPEONATO_ATIVA.includes(s.status)) salasMap.set(s.matchId, s.salaNum);
  }
  return salasMap;
}

/**
 * Busca todos os dados relacionados de um torneio de uma vez.
 * Retorna { t, teams, groups, matches, brackets, standings, teamRows }.
 */
export async function loadTournamentData(id: string, d: typeof db = db as any) {
  const [t] = await d.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!t) return null;

  const teamRows = await d.select().from(teams).innerJoin(tournamentTeams, eq(tournamentTeams.teamId, teams.id)).where(eq(tournamentTeams.tournamentId, id));
  const groups = await d.select().from(tournamentGroups).where(eq(tournamentGroups.tournamentId, id));
  const matches = await d.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
  const brackets = await d.select().from(bracketMatches).where(eq(bracketMatches.tournamentId, id));
  const standings = await d.select().from(tournamentStandings).where(eq(tournamentStandings.tournamentId, id));
  const salasMap = await loadSalasMap(matches, d);

  return { t, teamRows, groups, matches, brackets, standings, salasMap };
}

/** Seções que o detalhe carrega sob demanda (uma por aba pesada). */
export type TournamentSection = "cronograma" | "classificacao" | "grupos" | "chaves";

/**
 * Carga enxuta do torneio + times (o "shell" do detalhe). Não toca nas tabelas
 * de cronograma/chave/classificação/grupos: são seções carregadas por aba.
 */
export async function loadTournamentShell(id: string, d: typeof db = db as any) {
  const [t] = await d.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!t) return null;

  const teamRows = await d
    .select()
    .from(teams)
    .innerJoin(tournamentTeams, eq(tournamentTeams.teamId, teams.id))
    .where(eq(tournamentTeams.tournamentId, id));

  return { t, teamRows };
}

/**
 * Tags dos times inscritos — o mínimo para redigir `codigo_partida` de uma
 * seção (cronograma/chave) sem carregar o shape inteiro.
 */
export async function loadTournamentTags(id: string, d: typeof db = db as any) {
  return d
    .select({ id: teams.id, tag: teams.tag })
    .from(teams)
    .innerJoin(tournamentTeams, eq(tournamentTeams.teamId, teams.id))
    .where(eq(tournamentTeams.tournamentId, id));
}

/**
 * Carga de UMA seção pesada. Cada seção busca apenas as tabelas de que precisa,
 * mantendo a mesma forma que os builders abaixo esperam.
 */
export async function loadTournamentSection(id: string, section: TournamentSection, d: typeof db = db as any) {
  const [t] = await d.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!t) return null;

  if (section === "cronograma") {
    const matches = await d.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
    const salasMap = await loadSalasMap(matches, d);
    return { t, matches, salasMap };
  }

  if (section === "classificacao") {
    const teamRows = await d
      .select()
      .from(teams)
      .innerJoin(tournamentTeams, eq(tournamentTeams.teamId, teams.id))
      .where(eq(tournamentTeams.tournamentId, id));
    const matches = await d.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
    const standings = await d.select().from(tournamentStandings).where(eq(tournamentStandings.tournamentId, id));
    return { t, teamRows, matches, standings };
  }

  if (section === "grupos") {
    const teamRows = await d
      .select()
      .from(teams)
      .innerJoin(tournamentTeams, eq(tournamentTeams.teamId, teams.id))
      .where(eq(tournamentTeams.tournamentId, id));
    const groups = await d.select().from(tournamentGroups).where(eq(tournamentGroups.tournamentId, id));
    return { t, teamRows, groups };
  }

  const brackets = await d.select().from(bracketMatches).where(eq(bracketMatches.tournamentId, id));
  return { t, brackets };
}

/** `times_inscritos` — array de TeamRegistration (id, name, tag, status, paid, discord, whatsapp, logo). */
export function buildTimesInscritos(data: { teamRows: any[] }) {
  return data.teamRows.map(({ teams: team, tournament_teams: tt }) => ({
    id: tt.teamId,
    name: team.name,
    tag: team.tag,
    status: tt.status === "approved" ? "approved" : tt.status === "rejected" ? "rejected" : "pending",
    paid: tt.paid,
    discord: tt.discord,
    whatsapp: tt.whatsapp,
    logo: team.logoUrl,
    gradient_from: team.gradientFrom,
    gradient_to: team.gradientTo,
    cor: team.gradientFrom || team.gradientTo || "#FFB700",
  }));
}

/** `cronograma` — array de jogos legado. */
export function buildCronograma(data: { matches: any[]; salasMap?: Map<string, number> }) {
  return data.matches.map((m) => ({
    id: m.matchKey || m.id,
    fase: m.phaseLabel || m.phase,
    timeA: m.teamATag,
    timeB: m.teamBTag,
    status: cronogramaStatusToLegacy(m.status),
    data: m.displayDate || "A COMBINAR",
    hora: m.displayTime || "--:--",
    placar: m.scoreDisplay || `${m.scoreA ?? 0} - ${m.scoreB ?? 0}`,
    proposedBy: m.proposedBy || "",
    iconeA: "ShieldCheck",
    iconeB: "Swords",
    // ── Verificação de série (ADR-047) ──
    codigo_partida: m.codigoPartida ?? null,
    irregular: !!m.irregular,
    resultado_riot: m.resultadoRiot ?? null,
    // Identificadores internos para o motor (a série vive em tournament_matches).
    match_id: m.id,
    best_of: m.bestOf ?? 3,
    // Sala Campeonato da série (ADR-084): o card vira "Entrar na Sala".
    sala_num: data.salasMap?.get(m.id) ?? null,
  }));
}

/** Ordenação da classificação: saldo (V−D), menos derrotas, mais jogos, alfabético. */
function sortStandings(a: any, b: any) {
  const saldoA = (a.v || 0) - (a.d || 0);
  const saldoB = (b.v || 0) - (b.d || 0);
  if (saldoB !== saldoA) return saldoB - saldoA;
  if (a.d !== b.d) return a.d - b.d;
  if (b.matches !== a.matches) return b.matches - a.matches;
  return (a.nome || "").localeCompare(b.nome || "");
}

/** `classificacao` — derivada do cronograma, com fallback para a tabela manual. */
export function buildClassificacao(data: { t: any; matches: any[]; teamRows: any[]; standings: any[] }) {
  const { t, matches, teamRows, standings } = data;
  const approved = teamRows.filter((r) => r.tournament_teams.status === "approved");

  // Jogos de chaveamento ("MATA-MATA (CHAVEAMENTO)") são só visuais e não contam.
  const finished = matches.filter((m) => {
    const fase = m.phaseLabel || m.phase;
    return (m.status === "finalizado" || m.status === "finalizada") && fase !== "MATA-MATA (CHAVEAMENTO)";
  });

  // Se não há jogos finalizados e há classificação manual → devolve a manual
  if (finished.length === 0 && standings.length > 0) {
    return standings.map((s) => ({
      rank: s.rank,
      nome: teamRows.find((r) => r.teams.id === s.teamId)?.teams.name || s.teamId,
      tag: teamRows.find((r) => r.teams.id === s.teamId)?.teams.tag || s.teamId,
      v: s.v,
      d: s.d,
      wo: s.wo,
      j: s.j,
      cor: s.cor,
      logo: s.logo,
      matches: 0,
      icone: "ShieldCheck",
    }));
  }

  const stats: any = {};
  approved.forEach((r) => {
    stats[r.teams.tag] = {
      rank: 0, nome: r.teams.name, tag: r.teams.tag, logo: r.teams.logoUrl,
      v: 0, d: 0, wo: 0, j: 0, matches: 0, cor: "#FFB700", icone: "ShieldCheck",
    };
  });

  const isLiga = t.format === "groups";
  finished.forEach((m) => {
    const scores = (m.scoreDisplay || "0 - 0").split(" - ");
    const s1 = parseInt(scores[0]) || 0;
    const s2 = parseInt(scores[1]) || 0;
    const a = m.teamATag, b = m.teamBTag;
    if (!a || !b) return;
    if (isLiga) {
      if (stats[a]) { stats[a].matches++; stats[a].v += s1; stats[a].d += s2; stats[a].j += s1 + s2; }
      if (stats[b]) { stats[b].matches++; stats[b].v += s2; stats[b].d += s1; stats[b].j += s1 + s2; }
    } else {
      if (stats[a]) { stats[a].matches++; stats[a].j++; if (s1 > s2) stats[a].v++; else if (s1 < s2) stats[a].d++; }
      if (stats[b]) { stats[b].matches++; stats[b].j++; if (s2 > s1) stats[b].v++; else if (s2 < s1) stats[b].d++; }
    }
  });

  return Object.values(stats)
    .sort(sortStandings)
    .map((t: any, i: number) => ({ ...t, rank: i + 1 }));
}

/** `grupos` — objeto { "Grupo A": [times...] } montado de tournament_groups + membership. */
export function buildGrupos(data: { groups: any[]; teamRows: any[] }) {
  const { groups, teamRows } = data;
  const byGroup: Record<string, any[]> = {};
  groups.forEach((g) => (byGroup[g.name] = []));
  teamRows.forEach((r) => {
    if (!r.tournament_teams.groupId) return;
    const g = groups.find((gg) => gg.id === r.tournament_teams.groupId);
    if (!g) return;
    byGroup[g.name] = byGroup[g.name] || [];
    byGroup[g.name].push({
      id: r.teams.id,
      tag: r.teams.tag,
      name: r.teams.name,
      logo: r.teams.logoUrl,
      status: r.tournament_teams.status,
    });
  });
  return byGroup;
}

/**
 * `bracket_data` — monta a árvore double-elimination completa (o shape fixo que
 * o fork espera) e preenche com as linhas de bracket_matches.
 */
export function buildBracket(data: { brackets: any[] }) {
  const { brackets } = data;
  const empty = { t1: "", t2: "", s1: 0, s2: 0, winner: null };

  const mkRound = (n: number) => Array(n).fill(null).map(() => ({ ...empty }));
  const mkSide = (n: number, prefix: string) =>
    Array(n).fill(null).map((_, i) => ({ ...empty, id: `${prefix}_${i}` }));

  const bracket: any = {
    upper: { r64: mkRound(32), r32: mkRound(16), r16: mkRound(8), qf: mkRound(4), sf: mkRound(2), final: [{ ...empty }] },
    lower: { r1: mkRound(16), r2: mkRound(16), r3: mkRound(8), r4: mkRound(8), r5: mkRound(4), r6: mkRound(4), r7: mkRound(2), final: [{ ...empty }] },
    preFinal: { ...empty },
    grandFinal: { ...empty },
    side: {
      left: { r64: mkSide(16, "L_R64"), r32: mkSide(8, "L_R32"), r16: mkSide(4, "L_R16"), qf: mkSide(2, "L_QF"), sf: [{ ...empty, id: "L_SF_0" }] },
      right: { r64: mkSide(16, "R_R64"), r32: mkSide(8, "R_R32"), r16: mkSide(4, "R_R16"), qf: mkSide(2, "R_QF"), sf: [{ ...empty, id: "R_SF_0" }] },
      grandFinal: { ...empty },
    },
  };

  const fillCell = (target: any, tagA: string | null, tagB: string | null, s1: number, s2: number, winner: string | null, extra?: any) => {
    target.t1 = tagA || "";
    target.t2 = tagB || "";
    target.s1 = s1;
    target.s2 = s2;
    target.winner = winner;
    if (extra) {
      target.codigo_partida = extra.codigoPartida ?? null;
      target.irregular = !!extra.irregular;
      target.resultado_riot = extra.resultadoRiot ?? null;
      target.bracket_match_id = extra.id;
      target.best_of = extra.bestOf ?? 3;
    }
  };

  brackets.forEach((b) => {
    const br: any = bracket;
    const sectionKey = b.section as keyof typeof br;
    const extra = { codigoPartida: b.codigoPartida, irregular: b.irregular, resultadoRiot: b.resultadoRiot, id: b.id, bestOf: b.bestOf };
    if (b.section === "upper" || b.section === "lower") {
      const roundArr = br[sectionKey]?.[b.round];
      if (Array.isArray(roundArr) && roundArr[b.slot]) fillCell(roundArr[b.slot], b.teamATag, b.teamBTag, b.scoreA, b.scoreB, b.winnerSide, extra);
    } else if (b.section === "side") {
      // O round persistido carrega o lado ('left_qf'/'right_qf'; 'grand_final'
      // na decisão) — ver tournament-store.storeBracket. Decodifica de volta
      // para a árvore side.left/side.right que o fork consome.
      if (b.round === "grand_final" || b.round === "grandFinal") {
        fillCell(br.side.grandFinal, b.teamATag, b.teamBTag, b.scoreA, b.scoreB, b.winnerSide, extra);
      } else {
        const m = /^(left|right)_(.+)$/.exec(b.round);
        const roundArr = m ? br.side?.[m[1]]?.[m[2]] : undefined;
        if (Array.isArray(roundArr) && roundArr[b.slot]) fillCell(roundArr[b.slot], b.teamATag, b.teamBTag, b.scoreA, b.scoreB, b.winnerSide, extra);
      }
    } else if (b.section === "preFinal") fillCell(br.preFinal, b.teamATag, b.teamBTag, b.scoreA, b.scoreB, b.winnerSide, extra);
    else if (b.section === "grandFinal") fillCell(br.grandFinal, b.teamATag, b.teamBTag, b.scoreA, b.scoreB, b.winnerSide, extra);
  });

  return bracket;
}

/**
 * Campos escalares do shape legado. Compartilhados entre o documento completo
 * (admin/escrita), o shell do detalhe e o card da listagem — assim um campo
 * novo nunca fica de fora de um contrato sem querer.
 */
function legacyScalars(t: any) {
  return {
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
    times_ordem_sorteio: t.seedOrder ?? [],
    grupos_sorteados: !!t.gruposSorteados,
    chaves_sorteados: !!t.chavesSorteados,
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
}

/**
 * Escalares do detalhe público: tudo, menos a foto da organização. Ela é
 * usada só no formulário do admin e pode ser um data URL grande (a Copa do
 * Milho tinha 59 KB de base64); o detalhe não renderiza esse campo.
 */
function publicScalars(t: any) {
  const scalars: any = legacyScalars(t);
  delete scalars.org_photo_url;
  return scalars;
}

/**
 * Contrato do card de `/campeonatos`: só o que o card desenha. Sem cronograma,
 * chave, classificação, grupos, regulamento, inscritos ou foto da organização.
 */
export function toLegacyTournamentCard(t: any, teamsCount?: number) {
  return {
    id: t.id,
    titulo: t.name,
    nome: t.name,
    criado_por: t.organizerId,
    formato: formatToLegacy(t.format),
    status: statusToLegacy(t.status),
    frase: t.frase ?? null,
    logo_url: t.logoUrl ?? null,
    theme_color: t.themeColor ?? "#FFB700",
    vagas: t.vagas ?? 0,
    tier: t.tier ?? null,
    data: t.data ?? null,
    premiacao: t.premiacao ?? null,
    taxa: t.taxa ?? null,
    tem_outros_premios: t.temOutrosPremios ?? false,
    outros_premios: t.outrosPremios ?? null,
    organizacao: t.organizacao ?? null,
    grupos_sorteados: !!t.gruposSorteados,
    chaves_sorteados: !!t.chavesSorteados,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    gameId: t.gameId,
    slug: t.slug,
    ...(teamsCount !== undefined ? { registeredTeamsCount: teamsCount } : {}),
  };
}

/**
 * Shell do detalhe: escalares + times inscritos. É o que o hero, a aba Visão
 * Geral e o modal de inscrição precisam para o primeiro paint. As seções
 * pesadas vêm depois, por aba.
 */
export async function toLegacyTournamentShell(id: string, d: typeof db = db as any) {
  const data = await loadTournamentShell(id, d);
  if (!data) return null;

  return {
    ...publicScalars(data.t),
    times_inscritos: buildTimesInscritos(data),
    registeredTeamsCount: data.teamRows.length,
  };
}

/** Uma seção pesada do detalhe (cronograma, classificação, grupos ou chave). */
export async function toLegacyTournamentSection(
  id: string,
  section: TournamentSection,
  d: typeof db = db as any,
) {
  const data: any = await loadTournamentSection(id, section, d);
  if (!data) return null;

  if (section === "cronograma") return { cronograma: buildCronograma(data) };
  if (section === "classificacao") return { classificacao: buildClassificacao(data) };
  if (section === "grupos") return { grupos: buildGrupos(data) };
  return { bracket_data: buildBracket(data) };
}

/**
 * Times inscritos no formato enxuto que a agenda do Lobby usa (sem paid,
 * discord e whatsapp). A agenda só precisa resolver tag/nome/logo/cor.
 */
export function buildTimesInscritosResumo(data: { teamRows: any[] }) {
  return data.teamRows.map(({ teams: team, tournament_teams: tt }) => ({
    id: tt.teamId,
    name: team.name,
    tag: team.tag,
    status: tt.status === "approved" ? "approved" : tt.status === "rejected" ? "rejected" : "pending",
    logo: team.logoUrl,
    gradient_from: team.gradientFrom,
    gradient_to: team.gradientTo,
    cor: team.gradientFrom || team.gradientTo || "#FFB700",
  }));
}

/**
 * Monta o shape legado completo de um torneio (o que o front consome).
 * `teamsCount` é opcional (só na listagem).
 */
export async function toLegacyTournament(id: string, teamsCountOrDb?: number | any, maybeDb?: any) {
  const teamsCount = typeof teamsCountOrDb === "number" ? teamsCountOrDb : undefined;
  const d = typeof teamsCountOrDb === "object" && teamsCountOrDb !== null ? teamsCountOrDb : (maybeDb || db);
  const data = await loadTournamentData(id, d);
  if (!data) return null;
  const { t } = data;

  return {
    ...legacyScalars(t),
    times_inscritos: buildTimesInscritos(data),
    cronograma: buildCronograma(data),
    bracket_data: buildBracket(data),
    classificacao: buildClassificacao(data),
    grupos: buildGrupos(data),
    ...(teamsCount !== undefined ? { registeredTeamsCount: teamsCount } : {}),
  };
}

/** Listagem — shape legado sem os dados pesados por linha (só contagem). */
export async function toLegacyTournamentList(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const grouped = await db
    .select({ tournamentId: tournamentTeams.tournamentId, total: count() })
    .from(tournamentTeams)
    .where(inArray(tournamentTeams.tournamentId, ids))
    .groupBy(tournamentTeams.tournamentId);
  return Object.fromEntries(grouped.map((g) => [g.tournamentId, g.total]));
}
