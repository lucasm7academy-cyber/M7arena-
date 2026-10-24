import { eq, and, inArray } from "drizzle-orm";
import { matches, matchPlayers, matchResults, matchCodes } from "../../../db/schema/matches.js";
import { gameAccounts } from "../../../db/schema/games.js";
import { teams } from "../../../db/schema/teams.js";
import { pagarPremio, pagarCancelamento } from "./escrow.js";
import { notifyMatchChange } from "./match-flow.js";
import { avancarSerieLivre } from "./serie-livre.js";
import { avancarSerie5v5 } from "./serie-sala.js";
import { resolverRosterPuuids, ladoVencedorDaJogada } from "./serie-campeonato.js";
import { findUserTeamMemberships } from "./team-membership.js";
import { riotRaw } from "../routes/riot.js";

export const FANTASMA_MS = 3 * 60 * 60 * 1000;

export interface RiotMatch {
  metadata: { matchId: string };
  info: {
    tournamentCode?: string;
    gameCreation: number;
    gameDuration?: number;
    endOfGameResult?: string;
    participants: {
      puuid: string;
      teamId: number;
      win?: boolean;
      kills?: number;
      firstBloodKill?: boolean;
      totalMinionsKilled?: number;
      neutralMinionsKilled?: number;
    }[];
    teams: { teamId: number; win: boolean }[];
  };
}

export type BuscarIds = (puuid: string, startTime: number, endTime: number, queue: number) => Promise<string[] | null>;
export type BuscarMatch = (matchId: string) => Promise<RiotMatch | null>;

// Queue IDs das partidas custom/torneio no match-v5 da Riot. O mapa é definido
// na criação do tournament code, não no modo em si: os códigos BR050c8-* (1v1)
// são Howling Abyss (ARAM), os BR04fa2-* (5v5/aram/time_vs_time) são Summoner's
// Rift. Filtra a busca de histórico pelo queue certo — senão a partida ARAM
// nunca aparece quando se busca queue=3130 (SR).
export const QUEUE_SUMMONERS_RIFT = 3130;
export const QUEUE_HOWLING_ABYSS = 3200;

export type ResultadoVerificacao =
  | { ok: true; estado: "encerrada"; winnerSide: "blue" | "red"; matchIdRiot: string }
  | { ok: true; estado: "cancelada"; motivo: "nick_nao_bate" | "nao_encontrada"; matchIdRiot?: string }
  // Sala LIVRE com série (scrim MD1/MD3/MD5): o jogo fechou e a sala volta pro
  // PRONTO do próximo jogo (isolado em time_vs_time_livre — ver serie-livre.ts).
  | { ok: true; estado: "camp_prontos"; motivo: "serie_avancou"; matchIdRiot: string }
  // SALA 5v5 PERSONALIZADA com série (MD1/MD3/MD5): o jogo fechou e a sala volta
  // para a confirmação do próximo (ver serie-sala.ts).
  | { ok: true; estado: "confirmacao"; motivo: "serie_avancou"; matchIdRiot: string }
  | { ok: false; estado: "partida_iniciada"; motivo: "ainda_em_jogo" | "nao_encontrada"; matchIdRiot?: string };

/** Busca real na Riot (match v5) filtrando pelo queue do mapa (3130 SR / 3200 ARAM). */
async function buscaIdsRiot(puuid: string, startTime: number, endTime: number, queue: number): Promise<string[] | null> {
  const url = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=${queue}&startTime=${startTime}&endTime=${endTime}&count=50`;
  return (await riotRaw(`verify:ids:${puuid}:${startTime}:${endTime}:${queue}`, url)) as string[] | null;
}

async function buscaMatchRiot(matchId: string): Promise<RiotMatch | null> {
  const url = `https://americas.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  return (await riotRaw(`verify:match:${matchId}`, url)) as RiotMatch | null;
}

/**
 * Time de uma VAGA da sala de TIMES (TIME vs TIME livre): o ocupante da vaga é
 * membro do time — mesma regra da entrada na vaga (membership aceita mais
 * recente), com a TAG do snapshot da sala desempatando (o jogador pode ter
 * trocado de time depois).
 */
async function timeDaVaga(d: any, m: any, lado: "blue" | "red"): Promise<string | null> {
  const [vaga] = await d
    .select()
    .from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, m.id), eq(matchPlayers.side, lado)))
    .limit(1);
  if (!vaga?.userId) return null;
  const tag = (lado === "blue" ? m.timeATag : m.timeBTag) ?? null;
  // ADR-056: a vaga pode ser ocupada por um CONVIDADO (team_members.user_id
  // NULL) — resolve pelo vínculo Riot do ocupante (PUUID/Riot ID), não só por
  // user_id. Sem isso o roster do lado ficava vazio e o vencedor da jogada não
  // era identificado (caso real: sala 217, vaga vermelha com o coach convidado
  // do BKA — a série ficava travada em 0-0).
  const vagas = await findUserTeamMemberships(d, vaga.userId, { onlyAccepted: true });
  if (!vagas.length) return null;
  const equipes = await d
    .select({ id: teams.id, tag: teams.tag })
    .from(teams)
    .where(inArray(teams.id, vagas.map((v: any) => v.teamId)));
  const tagPorId = new Map<string, string>(equipes.map((t: any) => [t.id, t.tag]));
  const porTag = tag ? vagas.find((v: any) => tagPorId.get(v.teamId) === tag) : null;
  return (porTag ?? vagas[0])?.teamId ?? null;
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
        .select({ puuid: gameAccounts.externalId, userId: gameAccounts.userId })
        .from(gameAccounts)
        .where(and(eq(gameAccounts.gameId, "lol"), inArray(gameAccounts.userId, players.map((p: any) => p.userId))))
    : [];
  const puuids: string[] = contas.map((c: any) => c.puuid);
  // Mapa puuid → lado da VAGA (nosso "blue"/"red"). O teamId da Riot (100/200)
  // NÃO corresponde de forma confiável ao nosso lado: em custom games quem cria
  // o lobby define qual time é o 100. Para não premiar o lado errado, o vencedor
  // é resolvido pelo puuid do participante, não pelo teamId.
  const puuidToSide = new Map<string, "blue" | "red">();
  for (const c of contas) {
    const player = players.find((p: any) => p.userId === c.userId);
    if (player) puuidToSide.set(c.puuid, player.side as "blue" | "red");
  }

  // Sala de TIMES (TIME vs TIME livre): a sala tem 1 VAGA por time e o jogo é
  // 5v5 com o ROSTER dos times — a checagem "N participantes = N vagas" das
  // salas normais cancelaria um jogo real (10 jogadores). Resolve os dois
  // rosters (mesmo motor da série do campeonato: convidado com `guest_puuid`
  // ou conta vinculada) e decide a jogada por PERTINÊNCIA ao roster.
  const ehSalaDeTimes = m.mode === "time_vs_time_livre";
  const rostA = new Set<string>();
  const rostB = new Set<string>();
  if (ehSalaDeTimes) {
    for (const p of (await resolverRosterPuuids(d, await timeDaVaga(d, m, "blue"))).puuids) rostA.add(p);
    for (const p of (await resolverRosterPuuids(d, await timeDaVaga(d, m, "red"))).puuids) rostB.add(p);
    // Sem roster resolvido, cai nas contas vinculadas dos ocupantes da vaga.
    if (rostA.size === 0 && rostB.size === 0) {
      for (const [puuid, side] of puuidToSide) (side === "blue" ? rostA : rostB).add(puuid);
    }
  }

  // Sala sem jogadores OU alguém sem conta vinculada → impossível confirmar os
  // nicks. Trata como não verificável: segue no polling até o teto de 3h e
  // então cancela (nunca paga às cegas). O teto também cobre salas órfãs, que
  // precisam liberar o tournament code mesmo sem ninguém na vaga. (Sala de
  // TIMES: verificável quando qualquer roster resolveu.)
  const semComoVerificar = ehSalaDeTimes
    ? rostA.size === 0 && rostB.size === 0
    : players.length === 0 || puuids.length !== players.length;
  if (semComoVerificar) {
    const decorrido = agora.getTime() - new Date(m.iniciandoPartidaAt ?? m.createdAt).getTime();
    if (decorrido >= FANTASMA_MS) return aplica(d, m, () => aplicarCancelamento(d, m, players, "nao_encontrada"));
    return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };
  }

  // SÉRIE (sala livre de times e 5v5 personalizada): o jogo da VEZ começa
  // DEPOIS do draft fechar (`iniciando_partida_at`). Sem esse piso, a
  // verificação do jogo N+1 podia achar o jogo N (já contado) enquanto o novo
  // ainda estava começando e somar o mesmo jogo duas vezes — foi o que
  // aconteceu na sala 217: o jogo 2 (já 1-1) foi recontado às 01:58 enquanto o
  // jogo 3 começava, virando 2-1 errado. Margem de 2 min cobre o intervalo
  // entre o draft fechar e a partida ser criada no client.
  const temSerie = m.mode === "time_vs_time_livre" || m.mode === "5v5";
  const pisoJogoAtual =
    temSerie && m.iniciandoPartidaAt
      ? new Date(m.iniciandoPartidaAt).getTime() - 2 * 60_000
      : null;

  // Busca no histórico: nas salas de TIMES vale o roster inteiro dos dois times
  // (qualquer membro que jogou acha a partida); nas demais, os PUUIDs das vagas.
  const puuidsBusca =
    ehSalaDeTimes && (rostA.size > 0 || rostB.size > 0) ? [...new Set([...rostA, ...rostB])] : puuids;

  const inicio = Math.floor(new Date(m.createdAt).getTime() / 1000);
  const fim = Math.floor(agora.getTime() / 1000);
  const queue = m.mode === "1v1" ? QUEUE_HOWLING_ABYSS : QUEUE_SUMMONERS_RIFT;
  const vistos = new Set<string>();
  const candidatos: string[] = [];
  for (const puuid of puuidsBusca) {
    const ids = await buscarIds(puuid, inicio, fim, queue);
    if (ids) for (const id of ids) if (!vistos.has(id)) { vistos.add(id); candidatos.push(id); }
  }

  // Das candidatas, fica a do nosso código e com gameCreation mais próxima do
  // início da sala (código é reutilizável — janela + PUUIDs desambiguam).
  let melhor: { match: RiotMatch; diff: number } | null = null;
  const inicioRef = new Date(m.iniciandoPartidaAt ?? m.createdAt).getTime();
  for (const id of candidatos) {
    const match = await buscarMatch(id);
    if (!match || match.info.tournamentCode !== m.codigoPartida) continue;
    // Só vale o jogo da VEZ (criado depois do draft fechar) — ver piso acima.
    if (pisoJogoAtual !== null && match.info.gameCreation < pisoJogoAtual) continue;
    const diff = Math.abs(match.info.gameCreation - inicioRef);
    if (!melhor || diff < melhor.diff) melhor = { match, diff };
  }

  if (!melhor) {
    const decorrido = agora.getTime() - new Date(m.iniciandoPartidaAt ?? m.createdAt).getTime();
    if (decorrido >= FANTASMA_MS) return aplica(d, m, () => aplicarCancelamento(d, m, players, "nao_encontrada"));
    return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };
  }

  const matchRiot = melhor.match;

  // Confere os nicks: mesmo conjunto de participantes e todos os esperados lá.
  // Sala de TIMES fica de fora: o jogo tem 10 jogadores e a validação é por
  // PERTINÊNCIA ao roster (feita logo abaixo, na decisão do vencedor).
  if (!ehSalaDeTimes) {
    const puuidsPartida = new Set(matchRiot.info.participants.map((p) => p.puuid));
    const todosBatem =
      matchRiot.info.participants.length === players.length && puuids.every((p) => puuidsPartida.has(p));
    if (!todosBatem) {
      return aplica(d, m, () => aplicarCancelamento(d, m, players, "nick_nao_bate", matchRiot.metadata.matchId));
    }
  }

  // Partida completa normalmente: o time com `win` vence. Nas salas normais o
  // lado vencedor sai do puuid dos vencedores (não do teamId, que em custom
  // game é arbitrário); na sala de TIMES sai da pertinência ao ROSTER (mesmo
  // motor da série do campeonato).
  if (matchRiot.info.endOfGameResult === "GameComplete") {
    let winnerSide: "blue" | "red" | null = null;
    if (ehSalaDeTimes) {
      const { lado } = ladoVencedorDaJogada(matchRiot, rostA, rostB);
      winnerSide = lado === "a" ? "blue" : lado === "b" ? "red" : null;
    } else {
      const teamVencedor = matchRiot.info.teams.find((t) => t.win);
      const fallback: "blue" | "red" = teamVencedor?.teamId === 200 ? "red" : "blue";
      const puuidsVencedores = matchRiot.info.participants
        .filter((p) => p.teamId === teamVencedor?.teamId)
        .map((p) => p.puuid);
      winnerSide = ladoPorPuuids(puuidsVencedores, puuidToSide, fallback);
    }
    // Jogo completo, mas ninguém identificado no roster (ex.: participante sem
    // conta vinculada): não decide às cegas — segue no polling.
    if (!winnerSide) {
      return { ok: false, estado: "partida_iniciada", motivo: "ainda_em_jogo", matchIdRiot: matchRiot.metadata.matchId };
    }
    // SÉRIE DA SALA 5v5 PERSONALIZADA (MD1/MD3/MD5): grava o placar do jogo e
    // volta para a confirmação do próximo enquanto a série não fechar. O
    // encerramento normal — e o pagamento do pote, uma vez só — só acontece no
    // último jogo (quando `avancarSerie5v5` devolve false).
    if (m.mode === "5v5") {
      const continua = await avancarSerie5v5(d, m.id, winnerSide);
      if (continua) {
        return { ok: true, estado: "confirmacao", motivo: "serie_avancou", matchIdRiot: matchRiot.metadata.matchId };
      }
    }
    // SÉRIE DA SALA LIVRE (scrim MD1/MD3/MD5, isolada em time_vs_time_livre):
    // grava o jogo e volta pro PRONTO quando ainda há jogo; só quando o alvo é
    // atingido o encerramento normal below assume.
    if (m.mode === "time_vs_time_livre") {
      const continua = await avancarSerieLivre(d, m.id, winnerSide);
      if (continua) {
        return { ok: true, estado: "camp_prontos", motivo: "serie_avancou", matchIdRiot: matchRiot.metadata.matchId };
      }
    }
    return aplica(d, m, () => aplicarEncerramento(d, m, players, winnerSide, matchRiot));
  }

  // Partida ABORTADA (desistência/abandono — "Abort", "Abort_TooFewPlayers",
  // "GameLength", etc.). A win condition por first blood / 100 CS vale SÓ para
  // o modo 1v1: quem atinge a condição quita, então o jogo NUNCA chega a
  // GameComplete. Em 5v5/aram/time_vs_time uma partida abortada sem surrender
  // não é vitória legítima → segue até o teto e cancela (como antes).
  if (m.mode === "1v1") {
    const condicao = vencedorPorWinCondition(matchRiot, puuidToSide);
    if (condicao) {
      return aplica(d, m, () =>
        aplicarEncerramento(d, m, players, condicao.lado, matchRiot, condicao.motivo)
      );
    }
  }

  return { ok: false, estado: "partida_iniciada", motivo: "ainda_em_jogo", matchIdRiot: matchRiot.metadata.matchId };
}

/** Resolve o lado vencedor pela lista de puuids (primeiro puuid mapeado vence), com fallback. */
function ladoPorPuuids(puuids: string[], puuidToSide: Map<string, "blue" | "red">, fallback: "blue" | "red"): "blue" | "red" {
  for (const p of puuids) {
    const lado = puuidToSide.get(p);
    if (lado) return lado;
  }
  return fallback;
}

/**
 * Decide o vencedor de uma partida 1v1 que terminou sem "GameComplete"
 * (abortada por desistência) e POR QUE venceu. Win conditions do modo:
 *  1. First blood — quem matou primeiro vence (ordem de prioridade);
 *  2. 100 de farm — primeiro a chegar em 100 CS vence.
 * Retorna { lado, motivo } quando alguma condição foi atingida, senão null
 * (partida ainda em jogo, ou sem condição → segue até o teto e cancela).
 */
function vencedorPorWinCondition(match: RiotMatch, puuidToSide: Map<string, "blue" | "red">): { lado: "blue" | "red"; motivo: "first_blood" | "100_cs" } | null {
  const parts = match.info.participants ?? [];
  const cs = (p: any) => (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0);

  const primeiroAbate = parts.find((p: any) => p.firstBloodKill);
  if (primeiroAbate) {
    const lado = puuidToSide.get(primeiroAbate.puuid);
    if (lado) return { lado, motivo: "first_blood" };
  }

  const cemFarm = parts.find((p: any) => cs(p) >= 100);
  if (cemFarm) {
    const lado = puuidToSide.get(cemFarm.puuid);
    if (lado) return { lado, motivo: "100_cs" };
  }

  return null;
}

/**
 * Fase B + notificação pós-commit. As funções aplicar* rodam transação própria;
 * a notificação realtime só dispara DEPOIS do commit — se o rollback estourar
 * (ex.: ledger 23505), ninguém é avisado de um estado que nunca existiu.
 */
async function aplica(d: any, m: any, acao: () => Promise<ResultadoVerificacao>): Promise<ResultadoVerificacao> {
  const r = await acao();
  if (r.ok) notifyMatchChange(m.id);
  return r;
}

/** Fase B: aplica o encerramento em transação com lock (evita dupla-finalização). */
async function aplicarEncerramento(d: any, m: any, players: any[], winnerSide: "blue" | "red", matchRiot: RiotMatch, vitoriaMotivo?: "first_blood" | "100_cs") {
  return d.transaction(async (tx: any) => {
    const [m2] = await tx.select().from(matches).where(eq(matches.id, m.id)).limit(1).for("update");
    if (!m2 || m2.status !== "partida_iniciada") return { ok: false, estado: m2?.status ?? "partida_iniciada", motivo: "nao_encontrada" };
    const aposta = m2.apostaMc ?? 0;
    await pagarPremio(tx, m2.id, aposta, players, winnerSide, Number(m2.taxaPct ?? 8.99));
    await tx.insert(matchResults).values({ matchId: m2.id, winnerSide, payload: matchRiot as any });
    await tx.update(matches).set({ status: "encerrada", winnerSide, resultado: winnerSide, vitoriaMotivo, endedAt: new Date() }).where(eq(matches.id, m2.id));
    await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, m2.id));
    await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, m2.id));
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
    return { ok: true as const, estado: "cancelada" as const, motivo, matchIdRiot };
  });
}
