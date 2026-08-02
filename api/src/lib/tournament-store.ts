/**
 * tournament-store.ts — decompõe as escritas do shape legado nas tabelas
 * relacionais normalizadas (ADR-016).
 *
 * O PUT /api/tournaments/:id recebe o shape legado (times_inscritos, cronograma,
 * bracket_data, ...). Este módulo converte cada bloco em upserts nas tabelas:
 *  - times_inscritos  → tournament_teams (resolve team por id/tag)
 *  - cronograma       → tournament_matches (match_key, tags, exibição)
 *  - bracket_data     → bracket_matches (células da árvore)
 *  - grupos           → tournament_groups + tournament_teams.group_id
 *  - classificacao    → tournament_standings
 *  - times_ordem_sorteio → tournaments.seed_order
 */
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db.js";
import {
  tournaments,
  tournamentTeams,
  tournamentGroups,
  tournamentMatches,
  bracketMatches,
  tournamentStandings,
} from "../../../db/schema/tournaments.js";
import { teams } from "../../../db/schema/teams.js";

/** Resolve o id de um time por id ou tag (retorna null se não achar). */
async function resolveTeamId(idOrTag: string | undefined): Promise<string | null> {
  if (!idOrTag) return null;
  // Se é uuid, usa direto
  if (/^[0-9a-fA-F-]{36}$/.test(idOrTag)) {
    const [t] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, idOrTag)).limit(1);
    return t?.id || null;
  }
  const [t] = await db.select({ id: teams.id }).from(teams).where(eq(teams.tag, idOrTag)).limit(1);
  return t?.id || null;
}

/**
 * Persiste times_inscritos (array de TeamRegistration) → tournament_teams.
 * Resolve team por id ou tag. Upsert por (tournament_id, team_id).
 */
export async function storeTimesInscritos(tournamentId: string, registrations: any[]) {
  if (!Array.isArray(registrations)) return;
  for (const r of registrations) {
    const teamId = await resolveTeamId(r.id || r.tag || r.name);
    if (!teamId) continue;
    const existing = await db
      .select()
      .from(tournamentTeams)
      .where(and(eq(tournamentTeams.tournamentId, tournamentId), eq(tournamentTeams.teamId, teamId)))
      .limit(1);
    const values = {
      status: r.status === "approved" ? "approved" : r.status === "rejected" ? "rejected" : "registered",
      paid: !!r.paid,
      discord: r.discord ?? null,
      whatsapp: r.whatsapp ?? null,
    };
    if (existing.length) {
      await db.update(tournamentTeams).set(values).where(and(eq(tournamentTeams.tournamentId, tournamentId), eq(tournamentTeams.teamId, teamId)));
    } else {
      await db.insert(tournamentTeams).values({ tournamentId, teamId, ...values });
    }
  }
}

/**
 * Persiste cronograma (array de jogos) → tournament_matches.
 * `merge` = true faz upsert por match_key (sem apagar os que não vieram),
 * usado pelos endpoints de merge atômico (merge_jogos_cronograma).
 */
export async function storeCronograma(tournamentId: string, cronograma: any[], merge = false) {
  if (!Array.isArray(cronograma)) return;
  const existingKeys = await db
    .select({ key: tournamentMatches.matchKey })
    .from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, tournamentId));

  for (const j of cronograma) {
    const key = j.id || j.matchKey;
    if (!key) continue;
    const teamAId = await resolveTeamId(j.timeA);
    const teamBId = await resolveTeamId(j.timeB);
    const values = {
      matchKey: key,
      phaseLabel: j.fase ?? j.phaseLabel ?? "Grupo A",
      teamATag: j.timeA ?? null,
      teamBTag: j.timeB ?? null,
      teamAId,
      teamBId,
      scoreA: parseInt((j.placar || "0 - 0").split(" - ")[0]) || 0,
      scoreB: parseInt((j.placar || "0 - 0").split(" - ")[1]) || 0,
      scoreDisplay: j.placar ?? "0 - 0",
      displayDate: j.data ?? "A COMBINAR",
      displayTime: j.hora ?? "--:--",
      proposedBy: j.proposedBy ?? "",
      status: j.status ?? "combinando",
    };
    const exists = existingKeys.some((e) => e.key === key);
    if (exists) {
      await db.update(tournamentMatches).set({ ...values, updatedAt: new Date() }).where(and(eq(tournamentMatches.tournamentId, tournamentId), eq(tournamentMatches.matchKey, key)));
    } else {
      await db.insert(tournamentMatches).values({ tournamentId, phase: "group_stage", round: 0, ...values });
    }
  }

  // Sem merge: apaga os que não vieram (replaces o cronograma inteiro)
  if (!merge && cronograma.length) {
    const keys = cronograma.map((j) => j.id || j.matchKey).filter(Boolean);
    const toDelete = existingKeys.filter((e) => e.key && !keys.includes(e.key)).map((e) => e.key);
    const safeDelete = toDelete.filter((k): k is string => !!k);
    if (safeDelete.length) {
      await db.delete(tournamentMatches).where(and(eq(tournamentMatches.tournamentId, tournamentId), inArray(tournamentMatches.matchKey, safeDelete)));
    }
  }
}

/**
 * Persiste bracket_data (árvore) → bracket_matches.
 * Faz replace: apaga as células do torneio e reinsere as que têm conteúdo.
 */
export async function storeBracket(tournamentId: string, bracket: any) {
  if (!bracket || typeof bracket !== "object") return;
  await db.delete(bracketMatches).where(eq(bracketMatches.tournamentId, tournamentId));

  const rows: any[] = [];
  const walk = (section: string, obj: any, round: string | null) => {
    if (!obj) return;
    // side.left / side.right → arrays por round
    if (section === "side" && obj.left) {
      Object.entries(obj.left).forEach(([r, arr]: [string, any]) => {
        if (Array.isArray(arr)) arr.forEach((cell, slot) => pushCell("side", r, slot, cell));
      });
    }
    if (section === "side" && obj.right) {
      Object.entries(obj.right).forEach(([r, arr]: [string, any]) => {
        if (Array.isArray(arr)) arr.forEach((cell, slot) => pushCell("side", r, slot, cell));
      });
    }
    if (section === "side" && obj.grandFinal) pushCell("side", "grandFinal", 0, obj.grandFinal);
    // upper / lower → { r64: [...], r32: [...], ... }
    if ((section === "upper" || section === "lower") && typeof obj === "object") {
      Object.entries(obj).forEach(([r, arr]: [string, any]) => {
        if (Array.isArray(arr)) arr.forEach((cell, slot) => pushCell(section, r, slot, cell));
      });
    }
    // preFinal / grandFinal (raiz)
    if (section === "preFinal") pushCell("preFinal", "final", 0, obj);
    if (section === "grandFinal") pushCell("grandFinal", "final", 0, obj);
  };

  const pushCell = (section: string, round: string, slot: number, cell: any) => {
    if (!cell || typeof cell !== "object") return;
    const t1 = cell.t1 ?? "";
    const t2 = cell.t2 ?? "";
    if (!t1 && !t2) return; // célula vazia não persiste
    rows.push({
      tournamentId,
      section,
      round,
      slot,
      teamATag: t1 || null,
      teamBTag: t2 || null,
      teamAId: null,
      teamBId: null,
      scoreA: cell.s1 || 0,
      scoreB: cell.s2 || 0,
      winnerSide: cell.winner ?? null,
    });
  };

  walk("upper", bracket.upper, null);
  walk("lower", bracket.lower, null);
  walk("side", bracket.side, null);
  walk("preFinal", bracket.preFinal, null);
  walk("grandFinal", bracket.grandFinal, null);

  if (rows.length) {
    await db.insert(bracketMatches).values(rows);
  }
}

/**
 * Persiste grupos (objeto { "Grupo A": [times] }) → tournament_groups +
 * tournament_teams.group_id. Resolve os times por id/tag.
 */
export async function storeGrupos(tournamentId: string, grupos: any) {
  if (!grupos || typeof grupos !== "object") return;
  const groups = await db.select().from(tournamentGroups).where(eq(tournamentGroups.tournamentId, tournamentId));

  for (const [name, teamList] of Object.entries(grupos)) {
    let g = groups.find((x) => x.name === name);
    if (!g) {
      const [ins] = await db.insert(tournamentGroups).values({ tournamentId, name }).returning();
      g = ins;
    }
    if (Array.isArray(teamList)) {
      for (const t of teamList) {
        const teamId = await resolveTeamId(t.id || t.tag || t.name);
        if (!teamId) continue;
        await db.update(tournamentTeams)
          .set({ groupId: g.id })
          .where(and(eq(tournamentTeams.tournamentId, tournamentId), eq(tournamentTeams.teamId, teamId)));
      }
    }
  }
}

/**
 * Persiste classificacao (array de Standing) → tournament_standings.
 * Upsert por (tournament_id, team_id).
 */
export async function storeClassificacao(tournamentId: string, classificacao: any[]) {
  if (!Array.isArray(classificacao)) return;
  for (const s of classificacao) {
    const teamId = await resolveTeamId(s.id || s.tag || s.nome);
    if (!teamId) continue;
    const existing = await db
      .select()
      .from(tournamentStandings)
      .where(and(eq(tournamentStandings.tournamentId, tournamentId), eq(tournamentStandings.teamId, teamId)))
      .limit(1);
    const values = { rank: s.rank || 0, v: s.v || 0, d: s.d || 0, wo: s.wo || 0, j: s.j || 0, cor: s.cor ?? null, logo: s.logo ?? null };
    if (existing.length) {
      await db.update(tournamentStandings).set(values).where(and(eq(tournamentStandings.tournamentId, tournamentId), eq(tournamentStandings.teamId, teamId)));
    } else {
      await db.insert(tournamentStandings).values({ tournamentId, teamId, ...values });
    }
  }
}

/**
 * Aplica todas as escritas legadas de um PUT. Só toca o que veio no body.
 */
export async function storeLegacyWrites(tournamentId: string, body: any) {
  if (body.times_inscritos !== undefined) await storeTimesInscritos(tournamentId, body.times_inscritos);
  if (body.cronograma !== undefined) await storeCronograma(tournamentId, body.cronograma);
  if (body.bracket_data !== undefined) await storeBracket(tournamentId, body.bracket_data);
  if (body.grupos !== undefined) await storeGrupos(tournamentId, body.grupos);
  if (body.classificacao !== undefined) await storeClassificacao(tournamentId, body.classificacao);
  if (body.times_ordem_sorteio !== undefined) {
    await db.update(tournaments).set({ seedOrder: body.times_ordem_sorteio }).where(eq(tournaments.id, tournamentId));
  }
  if (body.grupos_sorteados !== undefined) {
    await db.update(tournaments).set({ gruposSorteados: !!body.grupos_sorteados }).where(eq(tournaments.id, tournamentId));
  }
  if (body.chaves_sorteados !== undefined) {
    await db.update(tournaments).set({ chavesSorteados: !!body.chaves_sorteados }).where(eq(tournaments.id, tournamentId));
  }
}
