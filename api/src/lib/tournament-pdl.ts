import { db } from "../db.js";
import { teams, teamStats } from "../../../db/schema/teams.js";
import { tournamentMatches } from "../../../db/schema/tournaments.js";

/**
 * PDL global (paridade com recalcular_pdl_global do site antigo):
 *  - vitória no cronograma: +15 PDL e +1 vitória;
 *  - derrota: -13 PDL e +1 derrota;
 *  - PDL nunca negativo (clamp em 0);
 *  - jogo da CHAVE (bracket) não conta — a chave é só visual;
 *  - ranking = posição por PDL desc, vitórias desc.
 *
 * É um recálculo do zero (não incremental), idempotente: rodar de novo depois de
 * finalizar/editar/excluir jogo corrige sozinho. As estatísticas por time vivem
 * em team_stats; o winrate exibido é derivado de wins/(wins+losses) no shape.
 */

const PDL_VITORIA = 15;
const PDL_DERROTA = -13;
const FASE_CHAVE = "MATA-MATA (CHAVEAMENTO)";
const STATUS_FINALIZADOS = ["finalizado", "finalizada", "finished"];

export interface ResultadoPdl {
  times: number;
  jogos: number;
}

export async function recalcularPdlGlobal(d: any = db): Promise<ResultadoPdl> {
  const todosTimes: any[] = await d
    .select({ id: teams.id, tag: teams.tag })
    .from(teams);

  const porId = new Map<string, any>(todosTimes.map((t) => [t.id, t]));
  const porTag = new Map<string, any>(todosTimes.map((t) => [t.tag, t]));

  const acumulado = new Map<string, { pdl: number; wins: number; losses: number }>();
  for (const t of todosTimes) acumulado.set(t.id, { pdl: 0, wins: 0, losses: 0 });

  const jogos: any[] = await d
    .select({
      status: tournamentMatches.status,
      scoreDisplay: tournamentMatches.scoreDisplay,
      scoreA: tournamentMatches.scoreA,
      scoreB: tournamentMatches.scoreB,
      phaseLabel: tournamentMatches.phaseLabel,
      teamAId: tournamentMatches.teamAId,
      teamBId: tournamentMatches.teamBId,
      teamATag: tournamentMatches.teamATag,
      teamBTag: tournamentMatches.teamBTag,
    })
    .from(tournamentMatches);

  let contados = 0;
  for (const jogo of jogos) {
    if (!STATUS_FINALIZADOS.includes(jogo.status)) continue;
    if (!jogo.scoreDisplay || !String(jogo.scoreDisplay).trim()) continue;
    if (jogo.phaseLabel === FASE_CHAVE) continue;

    const timeA = jogo.teamAId ? porId.get(jogo.teamAId) : porTag.get(jogo.teamATag ?? "");
    const timeB = jogo.teamBId ? porId.get(jogo.teamBId) : porTag.get(jogo.teamBTag ?? "");
    if (!timeA || !timeB) continue;

    const s1 = jogo.scoreA ?? 0;
    const s2 = jogo.scoreB ?? 0;
    if (s1 === s2) continue; // empate não pontua (paridade com o antigo)

    const [vencedor, perdedor] = s1 > s2 ? [timeA, timeB] : [timeB, timeA];
    const v = acumulado.get(vencedor.id)!;
    v.wins++;
    v.pdl += PDL_VITORIA;
    const p = acumulado.get(perdedor.id)!;
    p.losses++;
    p.pdl += PDL_DERROTA;
    contados++;
  }

  // Ranking: pdl desc, wins desc, tag asc (desempate estável entre iguais).
  const ordenado = todosTimes
    .map((t) => {
      const s = acumulado.get(t.id)!;
      return { id: t.id, tag: t.tag, pdl: Math.max(0, s.pdl), wins: s.wins, losses: s.losses };
    })
    .sort((a, b) => b.pdl - a.pdl || b.wins - a.wins || String(a.tag).localeCompare(String(b.tag)));

  const agora = new Date();
  for (let i = 0; i < ordenado.length; i++) {
    const s = ordenado[i];
    await d
      .insert(teamStats)
      .values({
        teamId: s.id,
        seasonId: "s1",
        pdl: s.pdl,
        wins: s.wins,
        losses: s.losses,
        ranking: i + 1,
        updatedAt: agora,
      })
      .onConflictDoUpdate({
        target: [teamStats.teamId, teamStats.seasonId],
        set: { pdl: s.pdl, wins: s.wins, losses: s.losses, ranking: i + 1, updatedAt: agora },
      });
  }

  return { times: ordenado.length, jogos: contados };
}
