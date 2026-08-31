import { eq, and, inArray, lt } from "drizzle-orm";
import { db } from "../db.js";
import { betTickets, betLegs } from "../../../db/schema/bets.js";
import { gameAccounts } from "../../../db/schema/games.js";
import { riotRaw } from "../routes/riot.js";
import {
  getMarket,
  reservarStake,
  devolverStake,
  pagarLeg,
  perderLeg,
  QUEUE_SOLO,
  QUEUE_FLEX,
  PLATFORM_PREFIX,
  BET_LOCK_MS,
  BET_FANTASMA_MS,
} from "./bets.js";

/**
 * live-bets.ts — detecção e liquidação das apostas individuais.
 *
 * A aposta é sobre a PRÓXIMA partida RANQUEADA do próprio jogador (Solo=420 /
 * Flex=440). Como não é um lobby nosso (não há `codigo_partida`), a partida é
 * descoberta por dois passos, ambos server-side:
 *
 * 1. DETECÇÃO (espectador da Riot): com o `encryptedSummonerId` do jogador,
 *    consulta `/lol/spectator/v4/active-games/by-summoner/:id`. Se ele está em
 *    jogo ranqueado (queue 420/440) que começou DEPOIS da aposta, o bilhete é
 *    travado em `em_jogo` com o matchId. Passou da janela sem jogo → cancela e
 *    devolve o MC.
 * 2. LIQUIDAÇÃO (match-v5): com o `matchId` travado, busca o detalhe da partida
 *    e resolve cada mercado (win, kills, first blood). Verdade = paga `stake×odd`;
 *    falso = retém; não-dá-para-saber = anula e devolve.
 *
 * Todas as telemetrias passam por `riotRaw` (cache de 10min, retorna null em
 * erro — o chamador trata como "ainda não vai").
 */

export interface DetectResult {
  estado: "em_jogo" | "cancelada" | "aguardando";
  motivo?: string;
}

export interface SettleResult {
  estado: "finalizada" | "anulada" | "em_jogo";
  motivo?: string;
}

function getRiotBySummonerUrl(summonerId: string): string {
  return `https://br1.api.riotgames.com/lol/spectator/v4/active-games/by-summoner/${encodeURIComponent(summonerId)}`;
}

function getMatchUrl(matchId: string): string {
  return `https://americas.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
}

/** Resolve o encryptedSummonerId a partir do puuid (endpoint da Riot). */
async function buscarSummonerId(puuid: string): Promise<string | null> {
  const url = `https://br1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
  const data = (await riotRaw(`bet:summoner:${puuid}`, url)) as any;
  return data?.id ?? null;
}

/** PUUID da conta LoL vinculada ao usuário. */
async function puuidDoUsuario(d: any, userId: string): Promise<string | null> {
  const [acc] = await d
    .select()
    .from(gameAccounts)
    .where(and(eq(gameAccounts.gameId, "lol"), eq(gameAccounts.userId, userId)))
    .limit(1);
  return acc?.externalId ?? null;
}

/**
 * [anti-fraude] Descobre se o jogador JÁ está em uma partida (espectador).
 * Retorna o jogo ativo quando está em jogo, senão null. Usado na criação do
 * bilhete para REJEITAR apostar numa partida já rolando — o jogador precisa
 * estar fora de qualquer jogo para poder apostar no próximo.
 *
 * `opts` permite injetar o fetch nos testes. Erro de rede/Riot retorna null
 * (não bloqueia a aposta; o fallback de timeout na detecção é a rede de
 * segurança — nunca paga às cegas).
 */
export async function jogadorEmJogo(
  d: any,
  userId: string,
  opts: { buscarSummoner?: (puuid: string) => Promise<string | null>; buscarGame?: (url: string) => Promise<any | null> } = {}
): Promise<any | null> {
  const puuid = await puuidDoUsuario(d, userId);
  if (!puuid) return null;

  const buscarSummoner = opts.buscarSummoner ?? buscarSummonerId;
  const summonerId = await buscarSummoner(puuid);
  if (!summonerId) return null;

  const buscarGame = opts.buscarGame ?? ((u: string) => riotRaw(`bet:spec:${userId}`, u));
  const game = (await buscarGame(getRiotBySummonerUrl(summonerId))) as any;
  if (!game || game.status === 404) return null;
  return game;
}

/**
 * Fase de detecção. Retorna o estado novo e aplica a mudança em transação com
 * lock (idempotente: se já `em_jogo`, no-op).
 */
export async function detectarPartida(d: any, ticketId: string, opts: { agora?: Date; buscarIdsRiot?: (url: string) => Promise<any | null> } = {}): Promise<DetectResult> {
  const agora = opts.agora ?? new Date();
  const riotFetch = opts.buscarIdsRiot ?? ((u: string) => riotRaw(`bet:spec:${ticketId}`, u));

  const [t] = await d.select().from(betTickets).where(eq(betTickets.id, ticketId)).limit(1);
  if (!t) return { estado: "aguardando" };
  if (t.status !== "aguardando") return { estado: "em_jogo", motivo: "já_em_jogo" };

  const puuid = await puuidDoUsuario(d, t.userId);
  if (!puuid) return { estado: "aguardando", motivo: "sem_puuid" };

  const summonerId = t.summonerId ?? (await buscarSummonerId(puuid));
  if (!summonerId) return { estado: "aguardando", motivo: "sem_summoner" };

  const game = (await riotFetch(getRiotBySummonerUrl(summonerId))) as any;

  // Se não está em jogo, checa timeout para cancelar.
  if (!game || game.status === 404) {
    if (new Date(t.expiresAt).getTime() < agora.getTime()) {
      return cancelarComDevolucao(d, t, "timeout_sem_partida");
    }
    return { estado: "aguardando" };
  }

  const queueId = Number(game.gameQueueConfigId);
  const queueEsperada = t.queue === "flex" ? QUEUE_FLEX : QUEUE_SOLO;
  if (queueId !== queueEsperada) {
    // Em jogo, mas de outra fila (ex.: normal). Espera a ranqueada.
    if (new Date(t.expiresAt).getTime() < agora.getTime()) {
      return cancelarComDevolucao(d, t, "timeout_sem_partida");
    }
    return { estado: "aguardando" };
  }

  const gameStartAt = new Date(game.gameStartTime);
  // Anti-fraude: só aceita partida que começou depois (com ~2min de tolerância
  // de relógio) da criação da aposta. Apostar numa partida JÁ EM ANDAMENTO
  // permite ver o estado e apostar sabido — fechado pela tolerância.
  const toleranciaMs = 2 * 60 * 1000;
  if (gameStartAt.getTime() < new Date(t.createdAt).getTime() - toleranciaMs) {
    if (new Date(t.expiresAt).getTime() < agora.getTime()) {
      return cancelarComDevolucao(d, t, "timeout_sem_partida");
    }
    return { estado: "aguardando" };
  }

  // matchId da Riot = "BR1_<gameId>" para filas ranqueadas.
  const matchRiotId = `${PLATFORM_PREFIX}_${game.gameId}`;

  await d.transaction(async (tx: any) => {
    const [t2] = await tx.select().from(betTickets).where(eq(betTickets.id, ticketId)).limit(1).for("update");
    if (!t2 || t2.status !== "aguardando") return;
    await tx
      .update(betTickets)
      .set({
        status: "em_jogo",
        summonerId,
        matchRiotId,
        queueId,
        gameStartAt,
        updatedAt: agora,
      })
      .where(eq(betTickets.id, ticketId));
  });

  return { estado: "em_jogo" };
}

/**
 * Fase de liquidação. Busca o match-v5 e resolve cada leg. Só liquida quando a
 * partida está encerrada (endOfGameResult present / gameEndTimestamp). Idempotente.
 */
export async function liquidarPartida(d: any, ticketId: string, opts: { agora?: Date; buscarMatch?: (matchId: string) => Promise<any | null> } = {}): Promise<SettleResult> {
  const agora = opts.agora ?? new Date();
  const buscarMatch = opts.buscarMatch ?? ((id: string) => riotRaw(`bet:match:${id}`, getMatchUrl(id)));

  const [t] = await d.select().from(betTickets).where(eq(betTickets.id, ticketId)).limit(1);
  if (!t || t.status !== "em_jogo") return { estado: "em_jogo" };
  if (!t.matchRiotId) return { estado: "em_jogo", motivo: "sem_match_id" };

  const puuid = await puuidDoUsuario(d, t.userId);
  if (!puuid) return { estado: "em_jogo", motivo: "sem_puuid" };

  const match = (await buscarMatch(t.matchRiotId)) as any;
  if (!match) return { estado: "em_jogo", motivo: "match_nao_encontrada" };

  const info = match?.info;
  const terminou = Boolean(info?.gameEndTimestamp || info?.endOfGameResult);
  if (!terminou) {
    if (new Date(t.updatedAt).getTime() + BET_FANTASMA_MS < agora.getTime()) {
      return anularComDevolucao(d, t, "partida_fantasma");
    }
    return { estado: "em_jogo" };
  }

  // O jogador apostador precisa estar na participação da partida; se não
  // estiver, não dá para liquidar de forma confiável → anula (devolve).
  const jogador = info?.participants?.find((p: any) => p.puuid === puuid);
  if (!jogador) return anularComDevolucao(d, t, "jogador_nao_encontrado");

  const legs = await d.select().from(betLegs).where(eq(betLegs.ticketId, ticketId));
  let algumaGanha = false;
  let algumaPerdida = false;

  await d.transaction(async (tx: any) => {
    const [t2] = await tx.select().from(betTickets).where(eq(betTickets.id, ticketId)).limit(1).for("update");
    if (!t2 || t2.status !== "em_jogo") return;

    for (const leg of legs) {
      const market = getMarket(leg.marketKey);
      // Config sem mercado correspondente (ex.: mercado removido) → anula a leg.
      const verdict: boolean | null = market ? market.resolve(info, puuid) : null;

      if (verdict === null) {
        await tx.update(betLegs).set({ status: "anulada" }).where(eq(betLegs.id, leg.id));
        await devolverStake(tx, t2.userId, leg.stake, t2.id);
      } else if (verdict === true) {
        await tx.update(betLegs).set({ status: "ganha" }).where(eq(betLegs.id, leg.id));
        await pagarLeg(tx, t2.userId, leg.stake, leg.payout, t2.id);
        algumaGanha = true;
      } else {
        await tx.update(betLegs).set({ status: "perdida" }).where(eq(betLegs.id, leg.id));
        await perderLeg(tx, t2.userId, leg.stake, t2.id);
        algumaPerdida = true;
      }
    }

    const resultado = algumaGanha ? "ganha" : algumaPerdida ? "perdida" : "anulada";
    await tx
      .update(betTickets)
      .set({ status: "finalizada", resultado, endedAt: agora, updatedAt: agora })
      .where(eq(betTickets.id, ticketId));
  });

  return { estado: "finalizada", motivo: algumaGanha ? "ganha" : algumaPerdida ? "perdida" : "anulada" };
}

/** Cancela por timeout (nunca detectou jogo) e devolve o stake. */
async function cancelarComDevolucao(d: any, t: any, motivo: string): Promise<DetectResult> {
  await d.transaction(async (tx: any) => {
    const [t2] = await tx.select().from(betTickets).where(eq(betTickets.id, t.id)).limit(1).for("update");
    if (!t2 || t2.status !== "aguardando") return;
    const legs = await tx.select().from(betLegs).where(eq(betLegs.ticketId, t.id));
    for (const leg of legs) {
      await tx.update(betLegs).set({ status: "anulada" }).where(eq(betLegs.id, leg.id));
      await devolverStake(tx, t2.userId, leg.stake, t2.id);
    }
    await tx
      .update(betTickets)
      .set({ status: "cancelada", resultado: "anulada", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(betTickets.id, t.id));
  });
  return { estado: "cancelada", motivo };
}

/** Anula por problema na liquidação (partida fantasma / jogador ausente) e devolve o stake. */
async function anularComDevolucao(d: any, t: any, motivo: string): Promise<SettleResult> {
  await d.transaction(async (tx: any) => {
    const [t2] = await tx.select().from(betTickets).where(eq(betTickets.id, t.id)).limit(1).for("update");
    if (!t2 || t2.status !== "em_jogo") return;
    const legs = await tx.select().from(betLegs).where(eq(betLegs.ticketId, t.id));
    for (const leg of legs) {
      await tx.update(betLegs).set({ status: "anulada" }).where(eq(betLegs.id, leg.id));
      await devolverStake(tx, t2.userId, leg.stake, t2.id);
    }
    await tx
      .update(betTickets)
      .set({ status: "anulada", resultado: "anulada", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(betTickets.id, t.id));
  });
  return { estado: "anulada", motivo };
}

// ── Varredura do cron (ADR: roda junto do runCron, 10min) ────────────────────

export async function runBetsCron(d: any = db, agora: Date = new Date()) {
  let detectadas = 0;
  let canceladas = 0;
  let liquidadas = 0;
  let anuladas = 0;

  const aguardando = await d.select().from(betTickets).where(eq(betTickets.status, "aguardando"));
  for (const t of aguardando) {
    const r = await detectarPartida(d, t.id, { agora });
    if (r.estado === "em_jogo") detectadas++;
    else if (r.estado === "cancelada") canceladas++;
  }

  const emJogo = await d.select().from(betTickets).where(eq(betTickets.status, "em_jogo"));
  for (const t of emJogo) {
    const r = await liquidarPartida(d, t.id, { agora });
    if (r.estado === "finalizada") liquidadas++;
    else if (r.estado === "anulada") anuladas++;
  }

  return { detectadas, canceladas, liquidadas, anuladas };
}
