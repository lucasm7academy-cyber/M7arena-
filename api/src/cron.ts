import { and, eq, inArray, isNull, not } from "drizzle-orm";
import { db } from "./db.js";
import { matches, matchPlayers, matchCodes } from "../../db/schema/matches.js";
import { users } from "../../db/schema/identidade.js";
import { ESTADOS_ATIVOS } from "./lib/elegibilidade.js";
import { verificarPartida, FANTASMA_MS } from "./lib/verificar-partida.js";

/**
 * Job único a cada 10 min (design v3 §8): verificação automática de partidas +
 * saneamento de estados mortos. ADR-033 removeu o kick de ociosidade, o strike
 * de abandono e a reativação de suspensão — punições são manuais (admin), então
 * o cron nunca escreve em user_advertencias nem mexe no status do usuário.
 * Nunca escreve estado por fora da máquina — cada ação reusa a lógica com
 * FOR UPDATE.
 */
export async function runCron(d: any = db) {
  const agora = new Date();

  let verificadas = 0;
  let canceladas = 0;
  let sanitizadas = 0;

  // 1. Verificação automática (spec verificacao-partida-riot): varre TODAS as
  //    salas em `partida_iniciada`. O motor decide: encontrou + nicks batem →
  //    encerra e paga; encontrou com nick errado → cancela; não encontrou ≥ 3h →
  //    cancela (devolve MC). Sem chave da Riot, `riotRaw` retorna null e o motor
  //    trata como "não encontrada" — o teto de 3h é o fallback honesto.
  const emJogo = await d.select().from(matches).where(eq(matches.status, "partida_iniciada"));
  for (const sala of emJogo) {
    const r = await verificarPartida(d, sala.id, { agora });
    if (r.ok) {
      if (r.estado === "cancelada") canceladas++;
      else if (r.estado === "encerrada") verificadas++;
    }
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

  return { verificadas, canceladas, sanitizadas };
}
