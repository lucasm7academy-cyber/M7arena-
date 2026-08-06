import { lt, and, eq, inArray, isNull, not } from "drizzle-orm";
import { db } from "./db.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { users } from "../../db/schema/identidade.js";
import { notifyMatchChange } from "./lib/match-flow.js";
import { ESTADOS_ATIVOS } from "./lib/elegibilidade.js";

const FANTASMA_MS = 3 * 60 * 60 * 1000;

/**
 * Job único a cada 10 min (design v3 §8): partida fantasma + saneamento de
 * estados mortos. ADR-033 removeu o kick de ociosidade, o strike de abandono
 * e a reativação de suspensão — punições são manuais (admin), então o cron
 * nunca escreve em user_advertencias nem mexe no status do usuário.
 * Nunca escreve estado por fora da máquina — cada ação reusa a lógica com
 * FOR UPDATE.
 */
export async function runCron(d: any = db) {
  const agora = new Date();
  const fantasmaLimite = new Date(agora.getTime() - FANTASMA_MS);

  let fantasmas = 0;
  let sanitizadas = 0;

  // 1. Partida fantasma: 'partida_iniciada' há 3h sem print. Vale para TODAS as
  //    salas (decisão de 2026-08-03: o resultado é sempre decidido pelo admin;
  //    casuais e apostadas sem print em 3h entram na fila de revisão).
  const fantasmasList = await d
    .select()
    .from(matches)
    .where(and(eq(matches.status, "partida_iniciada"), lt(matches.updatedAt, fantasmaLimite)));
  for (const sala of fantasmasList) {
    await d
      .update(matches)
      .set({ status: "aguardando_revisao", revisaoDesde: agora })
      .where(eq(matches.id, sala.id));
    notifyMatchChange(sala.id); // jogadores veem "em análise" sem refresh
    fantasmas++;
  }

  // 2. Saneamento (ajustarsala bug D): salas presas em estados mortos (ex.:
  //    'finalizacao', estado da votação removida pelo ADR-027) viram
  //    'encerrada', e o `linked` residual de salas não ativas é liberado.
  //    Sem isso, um jogador fica bloqueado para sempre com `ja_em_outra_sala`.
  const ESTADOS_MORTOS = ["finalizacao"];
  const mortas = await d
    .select({ id: matches.id, salaNum: matches.salaNum })
    .from(matches)
    .where(inArray(matches.status, ESTADOS_MORTOS));
  for (const morta of mortas) {
    await d
      .update(matches)
      .set({ status: "encerrada", endedAt: agora, updatedAt: agora, stateDeadlineAt: null })
      .where(eq(matches.id, morta.id));
    await d
      .update(matchPlayers)
      .set({ linked: false })
      .where(and(eq(matchPlayers.matchId, morta.id), eq(matchPlayers.linked, true)));
    sanitizadas++;
  }
  if (mortas.length > 0) console.log(`[cron] saneamento: ${mortas.length} sala(s) morta(s) encerrada(s)`);

  // Libera `linked` residual de jogadores em salas que não estão mais ativas
  // (encerrada/cancelada), para nenhum join ficar preso por dado órfão.
  const linkedOrfao: { matchId: string }[] = await d
    .select({ matchId: matchPlayers.matchId })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .where(and(eq(matchPlayers.linked, true), not(inArray(matches.status, ESTADOS_ATIVOS))));
  if (linkedOrfao.length > 0) {
    const idsOrfaos = [...new Set(linkedOrfao.map((p) => p.matchId))];
    for (const matchId of idsOrfaos) {
      await d
        .update(matchPlayers)
        .set({ linked: false })
        .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.linked, true)));
    }
    console.log(`[cron] saneamento: ${linkedOrfao.length} vinculo(s) orfao(s) liberado(s) em ${idsOrfaos.length} sala(s)`);
  }

  return { fantasmas, sanitizadas };
}
