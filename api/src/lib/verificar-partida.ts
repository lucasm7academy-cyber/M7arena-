import { eq, and, inArray } from "drizzle-orm";
import { matches, matchPlayers, matchResults, matchCodes } from "../../../db/schema/matches.js";
import { gameAccounts } from "../../../db/schema/games.js";
import { pagarPremio, pagarCancelamento } from "./escrow.js";
import { notifyMatchChange } from "./match-flow.js";
import { riotRaw } from "../routes/riot.js";

export const FANTASMA_MS = 3 * 60 * 60 * 1000;

export interface RiotMatch {
  metadata: { matchId: string };
  info: {
    tournamentCode?: string;
    gameCreation: number;
    endOfGameResult?: string;
    participants: { puuid: string; teamId: number }[];
    teams: { teamId: number; win: boolean }[];
  };
}

export type BuscarIds = (puuid: string, startTime: number, endTime: number) => Promise<string[] | null>;
export type BuscarMatch = (matchId: string) => Promise<RiotMatch | null>;

export type ResultadoVerificacao =
  | { ok: true; estado: "encerrada"; winnerSide: "blue" | "red"; matchIdRiot: string }
  | { ok: true; estado: "cancelada"; motivo: "nick_nao_bate" | "nao_encontrada"; matchIdRiot?: string }
  | { ok: false; estado: "partida_iniciada"; motivo: "ainda_em_jogo" | "nao_encontrada"; matchIdRiot?: string };

/** Busca real na Riot (match v5, queue 3130 = custom/torneio). */
async function buscaIdsRiot(puuid: string, startTime: number, endTime: number): Promise<string[] | null> {
  const url = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=3130&startTime=${startTime}&endTime=${endTime}&count=50`;
  return (await riotRaw(`verify:ids:${puuid}:${startTime}:${endTime}`, url)) as string[] | null;
}

async function buscaMatchRiot(matchId: string): Promise<RiotMatch | null> {
  const url = `https://americas.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  return (await riotRaw(`verify:match:${matchId}`, url)) as RiotMatch | null;
}

/**
 * Resolve o resultado de uma sala em `partida_iniciada` (spec
 * verificacao-partida-riot). A Riot é a fonte da verdade: acha a partida pelo
 * tournamentCode no histórico dos jogadores, confere os 10 PUUIDs e decide.
 * Fase A (leitura + rede) descobre o veredito; fase B (transação com lock)
 * aplica — nunca segura lock de linha durante chamada à Riot.
 */
export async function verificarPartida(
  d: any,
  matchId: string,
  opts: { agora?: Date; buscarIds?: BuscarIds; buscarMatch?: BuscarMatch } = {}
): Promise<ResultadoVerificacao> {
  const agora = opts.agora ?? new Date();
  const buscarIds = opts.buscarIds ?? buscaIdsRiot;
  const buscarMatch = opts.buscarMatch ?? buscaMatchRiot;

  const [m] = await d.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m) return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };
  if (m.status !== "partida_iniciada") return { ok: false, estado: m.status, motivo: "nao_encontrada" };
  if (!m.codigoPartida) return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };

  // PUUIDs esperados da sala (conta Riot vinculada de cada participante).
  const players = await d.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId));
  const contas = players.length
    ? await d
        .select({ puuid: gameAccounts.externalId })
        .from(gameAccounts)
        .where(and(eq(gameAccounts.gameId, "lol"), inArray(gameAccounts.userId, players.map((p: any) => p.userId))))
    : [];
  const puuids: string[] = contas.map((c: any) => c.puuid);
  // Sala sem jogadores OU alguém sem conta vinculada → impossível confirmar os
  // nicks. Trata como não verificável: segue no polling até o teto de 3h e
  // então cancela (nunca paga às cegas). O teto também cobre salas órfãs, que
  // precisam liberar o tournament code mesmo sem ninguém na vaga.
  if (players.length === 0 || puuids.length !== players.length) {
    const decorrido = agora.getTime() - new Date(m.iniciandoPartidaAt ?? m.createdAt).getTime();
    if (decorrido >= FANTASMA_MS) return aplicarCancelamento(d, m, players, "nao_encontrada");
    return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };
  }

  const inicio = Math.floor(new Date(m.createdAt).getTime() / 1000);
  const fim = Math.floor(agora.getTime() / 1000);
  const vistos = new Set<string>();
  const candidatos: string[] = [];
  for (const puuid of puuids) {
    const ids = await buscarIds(puuid, inicio, fim);
    if (ids) for (const id of ids) if (!vistos.has(id)) { vistos.add(id); candidatos.push(id); }
  }

  // Das candidatas, fica a do nosso código e com gameCreation mais próxima do
  // início da sala (código é reutilizável — janela + PUUIDs desambiguam).
  let melhor: { match: RiotMatch; diff: number } | null = null;
  const inicioRef = new Date(m.iniciandoPartidaAt ?? m.createdAt).getTime();
  for (const id of candidatos) {
    const match = await buscarMatch(id);
    if (!match || match.info.tournamentCode !== m.codigoPartida) continue;
    const diff = Math.abs(match.info.gameCreation - inicioRef);
    if (!melhor || diff < melhor.diff) melhor = { match, diff };
  }

  if (!melhor) {
    const decorrido = agora.getTime() - new Date(m.iniciandoPartidaAt ?? m.createdAt).getTime();
    if (decorrido >= FANTASMA_MS) return aplicarCancelamento(d, m, players, "nao_encontrada");
    return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };
  }

  const matchRiot = melhor.match;
  if (matchRiot.info.endOfGameResult !== "GameComplete") {
    return { ok: false, estado: "partida_iniciada", motivo: "ainda_em_jogo", matchIdRiot: matchRiot.metadata.matchId };
  }

  // Confere os 10 nicks: mesmo conjunto de participantes e todos os esperados lá.
  const puuidsPartida = new Set(matchRiot.info.participants.map((p) => p.puuid));
  const todosBatem =
    matchRiot.info.participants.length === players.length && puuids.every((p) => puuidsPartida.has(p));
  if (!todosBatem) {
    return aplicarCancelamento(d, m, players, "nick_nao_bate", matchRiot.metadata.matchId);
  }

  const teamVencedor = matchRiot.info.teams.find((t) => t.win);
  const winnerSide: "blue" | "red" = teamVencedor?.teamId === 200 ? "red" : "blue";
  return aplicarEncerramento(d, m, players, winnerSide, matchRiot);
}

/** Fase B: aplica o encerramento em transação com lock (evita dupla-finalização). */
async function aplicarEncerramento(d: any, m: any, players: any[], winnerSide: "blue" | "red", matchRiot: RiotMatch) {
  return d.transaction(async (tx: any) => {
    const [m2] = await tx.select().from(matches).where(eq(matches.id, m.id)).limit(1).for("update");
    if (!m2 || m2.status !== "partida_iniciada") return { ok: false, estado: m2?.status ?? "partida_iniciada", motivo: "nao_encontrada" };
    const aposta = m2.apostaMc ?? 0;
    await pagarPremio(tx, m2.id, aposta, players, winnerSide, Number(m2.taxaPct ?? 8.99));
    await tx.insert(matchResults).values({ matchId: m2.id, winnerSide, payload: matchRiot as any });
    await tx.update(matches).set({ status: "encerrada", winnerSide, resultado: winnerSide, endedAt: new Date() }).where(eq(matches.id, m2.id));
    await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, m2.id));
    await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, m2.id));
    notifyMatchChange(m2.id);
    return { ok: true as const, estado: "encerrada" as const, winnerSide, matchIdRiot: matchRiot.metadata.matchId };
  });
}

/** Fase B: aplica o cancelamento (devolve escrow) em transação com lock. */
async function aplicarCancelamento(d: any, m: any, players: any[], motivo: "nick_nao_bate" | "nao_encontrada", matchIdRiot?: string) {
  return d.transaction(async (tx: any) => {
    const [m2] = await tx.select().from(matches).where(eq(matches.id, m.id)).limit(1).for("update");
    if (!m2 || m2.status !== "partida_iniciada") return { ok: false, estado: m2?.status ?? "partida_iniciada", motivo: "nao_encontrada" };
    const aposta = m2.apostaMc ?? 0;
    await pagarCancelamento(tx, m2.id, aposta, players);
    await tx.update(matches).set({ status: "cancelada", resultado: null, canceladoEm: new Date() }).where(eq(matches.id, m2.id));
    await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, m2.id));
    await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, m2.id));
    notifyMatchChange(m2.id);
    return { ok: true as const, estado: "cancelada" as const, motivo, matchIdRiot };
  });
}
