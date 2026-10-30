import { and, eq, lt, inArray, isNull, not } from "drizzle-orm";
import { db } from "./db.js";
import { matches, matchPlayers, matchCodes, salaMensagens, campeonatoSalaEstado } from "../../db/schema/matches.js";
import { users } from "../../db/schema/identidade.js";
import { tournamentMatches, bracketMatches } from "../../db/schema/tournaments.js";
import { ESTADOS_ATIVOS } from "./lib/elegibilidade.js";
import { avaliarTransicoes, notifyMatchChange } from "./lib/match-flow.js";
import { verificarPartida, FANTASMA_MS } from "./lib/verificar-partida.js";
import { verificarSerieCampeonato } from "./lib/serie-campeonato.js";
import { garantirDraftSalaCampeonato, avaliarDraftSalaCampeonato } from "./lib/sala-campeonato-draft.js";
import { runBetsCron } from "./lib/live-bets.js";

/**
 * Job único a cada 10 min (design v3 §8): verificação automática de partidas +
 * saneamento de estados mortos. ADR-033 removeu o kick de ociosidade, o strike
 * de abandono e a reativação de suspensão — punições são manuais (admin), então
 * o cron nunca escreve em user_advertencias nem mexe no status do usuário.
 * Nunca escreve estado por fora da máquina — cada ação reusa a lógica com
 * FOR UPDATE.
 */
/**
 * Varredura de SÉRIES de campeonato em andamento com código (grupos + chave):
 * confere na Riot e o motor de série decide jogada a jogada, fechando no bestOf.
 * EXPORTADA porque a Sala Campeonato roda ela a cada 3 min (resultado mais
 * rápido que o runCron de 10 min — pedido do usuário 2026-10-12). Idempotente;
 * sem séries em andamento, é uma query indexada barata.
 */
export async function verificarSeriesPendentes(d: any = db): Promise<number> {
  let finalizadas = 0;
  const emAndamentoSeries = await d
    .select({ id: tournamentMatches.id })
    .from(tournamentMatches)
    .where(and(eq(tournamentMatches.status, "em_andamento"), not(isNull(tournamentMatches.codigoPartida))));
  for (const s of emAndamentoSeries) {
    const r = await verificarSerieCampeonato(d, { matchId: s.id });
    if (r.estado === "finalizada") finalizadas++;
  }
  const emAndamentoBrackets = await d
    .select({ id: bracketMatches.id })
    .from(bracketMatches)
    .where(and(isNull(bracketMatches.winnerSide), not(isNull(bracketMatches.codigoPartida))));
  for (const s of emAndamentoBrackets) {
    const r = await verificarSerieCampeonato(d, { bracketMatchId: s.id });
    if (r.estado === "finalizada") finalizadas++;
  }
  return finalizadas;
}

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

  // 2. Verificação de SÉRIES de campeonato (ADR-047): a MESMA varredura que o
  //    timer de 3 min da Sala Campeonato roda (verificarSeriesPendentes) —
  //    uma implementação só; aqui fica como rede de segurança de 10 min.
  const seriesFinalizadas = await verificarSeriesPendentes(d);
  if (seriesFinalizadas > 0) console.log(`[cron] campeonato: ${seriesFinalizadas} série(s) finalizada(s)`);

  // 2. Draft de sala: salas paradas no ban/pick (ninguém com a aba aberta para
  //    disparar o tick preguiçoso) são resolvidas pelo MESMO avaliador — o prazo
  //    é do servidor, então o cron fecha o turno vencido (ban vazio) ou cancela
  //    o draft (pick vencido → volta a preenchendo). Cada transição roda na
  //    própria transação com lock, como as ações de rota.
  let draftsResolvidos = 0;
  const emDraft = await d.select({ id: matches.id, salaNum: matches.salaNum }).from(matches).where(eq(matches.status, "draft"));
  for (const sala of emDraft) {
    const r = await d.transaction(async (tx: any) => {
      const [m] = await tx.select().from(matches).where(eq(matches.id, sala.id)).limit(1).for("update");
      if (!m || m.status !== "draft") return { mudou: false };
      return avaliarTransicoes(tx, m.id);
    });
    if (r.mudou) {
      draftsResolvidos++;
      notifyMatchChange(sala.id);
    }
  }
  if (draftsResolvidos > 0) console.log(`[cron] draft: ${draftsResolvidos} sala(s) avaliada(s)`);

  // 2b. Draft da SALA CAMPEONATO (passo 5, ADR-081): turno vencido (ban OU
  //     pick) TRAVA no jogo — espera alguém agir; nunca cancela (o adm
  //     destrava se precisar). O cron mantém o bookkeeping do draft fechado.
  let campeonatoDraftsResolvidos = 0;
  const emDraftCampeonato = await d
    .select({ id: matches.id, salaNum: matches.salaNum })
    .from(matches)
    .where(eq(matches.status, "camp_draft"));
  for (const sala of emDraftCampeonato) {
    const r = await d.transaction(async (tx: any) => {
      const [m] = await tx.select().from(matches).where(eq(matches.id, sala.id)).limit(1).for("update");
      if (!m || m.status !== "camp_draft") return { mudou: false };
      const [estado] = await tx
        .select()
        .from(campeonatoSalaEstado)
        .where(eq(campeonatoSalaEstado.matchId, m.id))
        .limit(1);
      if (!estado) return { mudou: false };
      await garantirDraftSalaCampeonato(tx, m, estado);
      return avaliarDraftSalaCampeonato(tx, m);
    });
    if (r.mudou) {
      campeonatoDraftsResolvidos++;
      notifyMatchChange(String(sala.salaNum));
    }
  }
  if (campeonatoDraftsResolvidos > 0) console.log(`[cron] sala-campeonato: ${campeonatoDraftsResolvidos} draft(s) avaliado(s)`);

  // 3. Saneamento (ajustarsala bug D): salas presas em estados mortos (ex.:
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

  // 4. Chat (ADR-040): mensagens de sala ficam por 24h (antes eram 5 min —
  //    pedido do usuário 30/10). O purge preguiçoso (no GET de histórico) faz
  //    a limpeza na leitura; aqui é a rede de segurança para a tabela não
  //    acumular para sempre mesmo sem leituras.
  const corteChat = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const purgadas = await d
    .delete(salaMensagens)
    .where(lt(salaMensagens.createdAt, corteChat))
    .returning({ id: salaMensagens.id });
  if (purgadas.length > 0) console.log(`[cron] chat: ${purgadas.length} mensagem(ns) expirada(s) purgada(s)`);

  // 5. Apostas individuais (self-bet): detecta a próxima partida ranqueada do
  //    jogador (espectador) e liquida quando acaba (match-v5). Timeout cancela
  //    e devolve o MC. Reusa o mesmo ciclo de 10min das salas.
  const bets = await runBetsCron(d, agora);
  if (bets.detectadas > 0 || bets.canceladas > 0 || bets.liquidadas > 0 || bets.anuladas > 0) {
    console.log(`[cron] bets: ${bets.detectadas} detectada(s), ${bets.canceladas} cancelada(s), ${bets.liquidadas} liquidada(s), ${bets.anuladas} anulada(s)`);
  }

  return { verificadas, canceladas, sanitizadas };
}
