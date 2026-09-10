/**
 * serie-campeonato.ts — verificação de SÉRIE de campeonato via código de partida
 * (ADR-047).
 *
 * Diferença para o /jogar: lá cada sala é 1 partida (1 código → 1 vencedor).
 * No campeonato, um JOGO (bracket ou cronograma) é uma SÉRIE (MD3/MD5) que usa
 * UM código de partida para N jogadas. A Riot lista todas as partidas de um
 * tournament code; o motor decide o vencedor de cada jogada pelo ROSTER dos
 * times (titulares + reservas = team_members accepted) e acumula vitórias até
 * fechar em `bestOf` (2 para MD3, 3 para MD5).
 *
 * Regras assinadas com o usuário:
 *  - Quem jogou é validado por pertinência ao roster. Jogador FORA do roster →
 *    a jogada conta normal, mas a série fica `irregular = true` (selo visível
 *    para o ADM decidir punição depois) — nunca bloqueia o andamento.
 *  - Sem PUUID vinculado nos 10 participantes → não verifica (segue aberta até
 *    sair do escopo; e sem código não nasce série).
 *  - Resultado da série (scoreA/scoreB/winnerSide) é decidido aqui, no servidor.
 *
 * Toda a decisão acontece em transação com lock, reusando o motor de sala
 * (verificar-partida) só como referência de decisão por jogada — a agregação
 * MD3/MD5 é própria do campeonato.
 */
import { eq, and, isNull, sql } from "drizzle-orm";
import { teamMembers } from "../../../db/schema/teams.js";
import { gameAccounts } from "../../../db/schema/games.js";
import { matchCodes } from "../../../db/schema/matches.js";
import {
  tournamentMatches,
  bracketMatches,
  tournamentSeriesGames,
} from "../../../db/schema/tournaments.js";
import { riotRaw } from "../routes/riot.js";
import { RiotMatch, QUEUE_SUMMONERS_RIFT, QUEUE_HOWLING_ABYSS } from "./verificar-partida.js";

/** Peso de cada jogada em número de vitórias (usado para a fileira de melhor-de). */
export function bestOfToWins(bestOf: number): number {
  return Math.ceil(bestOf / 2) || 1;
}

/**
 * Atribui um código de partida livre do pool para uma SÉRIE de campeonato
 * (ADR-047). Reproduz o rodízio LRU de `atribuirCodigoPartida` (salas), mas
 * sem gravar `match_id` (a FK de `match_codes.match_id` aponta para `matches`,
 * e a série vive em tournament_matches/bracket_matches). O vínculo série↔código
 * fica na coluna `codigo_partida` da própria série.
 *
 * `mode` segue a fila: '1v1' usa os códigos exclusivos; demais usam os
 * genéricos (mode IS NULL). Retorna o código, ou "SEM-CODIGO-AGUARDE".
 */
export async function atribuirCodigoSerie(tx: any, mode: string): Promise<string> {
  const [row]: any[] = await tx
    .select({ id: matchCodes.id, code: matchCodes.code })
    .from(matchCodes)
    .where(
      and(
        eq(matchCodes.used, false),
        mode === "1v1" ? eq(matchCodes.mode, "1v1") : isNull(matchCodes.mode)
      )
    )
    .orderBy(sql`${matchCodes.lastUsedAt} ASC NULLS FIRST`)
    .limit(1)
    .for("update", { skipLocked: true });

  if (!row) return "SEM-CODIGO-AGUARDE";

  await tx
    .update(matchCodes)
    .set({ used: true, matchId: null, lastUsedAt: new Date() })
    .where(eq(matchCodes.id, row.id));
  return row.code;
}

/**
 * Resolve o PUUID de cada membro do time (roster): vem de `guest_puuid`
 * (convidado sem conta) ou do `game_accounts.external_id` do usuário cadastrado.
 * Retorna o conjunto { puuid → role } e a contagem de membros sem PUUID.
 */
export async function resolverRosterPuuids(
  db: any,
  teamId: string | null | undefined
): Promise<{ puuids: Set<string>; semPuuid: number; total: number; semConta: number }> {
  if (!teamId) return { puuids: new Set(), semPuuid: 0, total: 0, semConta: 0 };
  const members: any[] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "accepted")));

  const puuids = new Set<string>();
  let semPuuid = 0;
  let semConta = 0;
  for (const m of members) {
    if (m.guestPuuid) {
      puuids.add(m.guestPuuid);
    } else if (m.userId) {
      const [ga] = await db
        .select({ externalId: gameAccounts.externalId })
        .from(gameAccounts)
        .where(and(eq(gameAccounts.userId, m.userId), eq(gameAccounts.gameId, "lol")))
        .limit(1);
      if (ga?.externalId) puuids.add(ga.externalId);
      else semConta++;
    } else {
      semPuuid++;
    }
  }
  return { puuids, semPuuid, total: members.length, semConta };
}

/**
 * Decide o vencedor de UMA jogada da Riot por pertinência ao roster.
 * Localiza os PUUIDs dos participantes que pertencem ao time A ou B e, se EXISTE
 * um jogador fora de ambos os rosters → marca a jogada `irregular`. O lado
 * vencedor é encontrado pelo participante que pertence ao roster do time que
 * venceu (nunca pelo teamId da Riot, que em custom game é arbitrário).
 */
export function ladoVencedorDaJogada(
  match: RiotMatch,
  rostA: Set<string>,
  rostB: Set<string>
): { lado: "a" | "b" | null; irregular: boolean } {
  const parts = match?.info?.participants ?? [];
  const pertence = (puuid: string): "a" | "b" | null => {
    if (rostA.has(puuid)) return "a";
    if (rostB.has(puuid)) return "b";
    return null;
  };

  // Quem é de fora: jogou e não pertence a NENHUM roster.
  let irregular = false;
  for (const p of parts) {
    if (!pertence(p.puuid)) irregular = true;
  }

  // Equipes vencedoras: participantes com win=true. Se a Riot não marcou win
  // (partida abortada), cai no teamId com win.
  const vencedores = parts.filter((p: any) => p.win);
  let lado: "a" | "b" | null = null;
  if (vencedores.length) {
    const p = vencedores[0];
    lado = pertence(p.puuid);
  } else {
    // Fallback: teamId do time vencedor (100=A, 200=B) quando nenhum participant
    // tem win (partida incompleta/abortada). Ainda assim, só aceita se o teamId
    // do time vencedor tiver pelo menos um participante do roster.
    const teamWin = (match?.info?.teams ?? []).find((t: any) => t.win);
    if (teamWin) {
      const membrosDoTime = parts.filter((p: any) => p.teamId === teamWin.teamId);
      const primeiroDoRoster = membrosDoTime.find((p: any) => pertence(p.puuid));
      if (primeiroDoRoster) lado = pertence(primeiroDoRoster.puuid);
    }
  }

  return { lado, irregular };
}

/**
 * Conta os kills agregados por lado (A/B) de uma jogada, clusterizando pelo
 * roster — mesmo princípio do fix do placar invertido das salas (ADR-047).
 */
export function killsPorLado(
  match: RiotMatch,
  rostA: Set<string>,
  rostB: Set<string>
): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const p of match?.info?.participants ?? []) {
    const k = p.kills || 0;
    if (rostA.has(p.puuid)) a += k;
    else if (rostB.has(p.puuid)) b += k;
  }
  return { a, b };
}

// ── Busca Riot de partidas por código ────────────────────────────────────────
//
// O endpoint match-v5 `by-tournament-code` é restrito a chaves de provedor de
// torneio: com a chave atual ele devolve 403 até para um código inexistente
// (verificado em 2026-09-10), então NÃO é usado aqui. O motor de salas já
// resolve pelo histórico dos jogadores — busca as partidas recentes de cada
// PUUID do roster (filtro de queue + janela) e confirma no detalhe da partida
// pelo `info.tournamentCode`. É o mesmo mecanismo, e funciona com a chave dev.

export type BuscarIdsPuuid = (
  puuid: string,
  inicio: number,
  fim: number,
  queue: number
) => Promise<string[] | null>;

async function buscaIdsPuuidRiot(
  puuid: string,
  inicio: number,
  fim: number,
  queue: number
): Promise<string[] | null> {
  const url = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=${queue}&startTime=${inicio}&endTime=${fim}&count=50`;
  return (await riotRaw(`serie:ids:${puuid}:${inicio}:${fim}:${queue}`, url)) as string[] | null;
}

/** Busca uma partida individual da Riot na americas (match-v5). */
export async function buscaMatchRiot(matchId: string): Promise<RiotMatch | null> {
  const url = `https://americas.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  return (await riotRaw(`serie:match:${matchId}`, url)) as RiotMatch | null;
}

export type BuscarMatchRiot = (matchId: string) => Promise<RiotMatch | null>;

export type BuscarIdsPorCodigo = (
  codigo: string,
  ctx: { puuids: string[]; inicio: number; fim: number; queue: number }
) => Promise<string[] | null>;

/**
 * Descobre as partidas de um código de série pelo histórico dos jogadores:
 * lista os matchIds recentes de cada PUUID (queue + janela), confirma no detalhe
 * pelo `info.tournamentCode` e devolve em ordem cronológica (gameNumber 1..n).
 * `null` = a Riot falhou (não confundir com lista vazia = ainda não há partida).
 */
export async function buscaIdsPorCodigo(
  codigo: string,
  ctx: { puuids: string[]; inicio: number; fim: number; queue: number },
  deps: { buscarIdsPuuid?: BuscarIdsPuuid; buscarMatch?: BuscarMatchRiot } = {}
): Promise<string[] | null> {
  const buscarIdsPuuid = deps.buscarIdsPuuid ?? buscaIdsPuuidRiot;
  const buscarMatch = deps.buscarMatch ?? buscaMatchRiot;

  const vistos = new Set<string>();
  const candidatos: string[] = [];
  let falhas = 0;
  for (const puuid of ctx.puuids) {
    const ids = await buscarIdsPuuid(puuid, ctx.inicio, ctx.fim, ctx.queue);
    if (ids === null) {
      falhas++;
      continue;
    }
    for (const id of ids) {
      if (!vistos.has(id)) {
        vistos.add(id);
        candidatos.push(id);
      }
    }
  }
  if (ctx.puuids.length > 0 && falhas === ctx.puuids.length) return null;

  const doCodigo: { id: string; creation: number }[] = [];
  for (const id of candidatos) {
    const match = await buscarMatch(id);
    if (!match) continue;
    if (match.info?.tournamentCode !== codigo) continue;
    doCodigo.push({ id: match.metadata?.matchId ?? id, creation: match.info?.gameCreation ?? 0 });
  }
  doCodigo.sort((a, b) => a.creation - b.creation);
  return doCodigo.map((c) => c.id);
}

export interface ResultadoSerie {
  ok: boolean;
  estado: "em_andamento" | "finalizada" | "sem_codigo" | "nao_encontrada";
  scoreA: number;
  scoreB: number;
  winnerSide: "a" | "b" | null;
  irregular: boolean;
  motivo?: string;
}

interface SerieAlvo {
  id: string;
  modo: string;
  matchId: string | null;
  bracketMatchId: string | null;
  codigoPartida: string | null;
  bestOf: number;
  teamAId: string | null;
  teamBId: string | null;
  status: string;
  scoreA: number;
  scoreB: number;
  serieIniciadaAt?: Date | string | null;
  queue?: number;
}

/** Status que representam série já decidida — resultado não é reescrito. */
const STATUS_FINALIZADOS = ["finalizada", "finalizado", "finished"];

/**
 * Empacota a resolução de rosters + escritas por jogada, para um teste de
 * unidade possível sem tocar no banco (a função decide por jogada e retorna o
 * resultado). Fora dos testes, use `verificarSerieCampeonato`.
 */
export async function resolverSerie(
  db: any,
  alvo: SerieAlvo,
  opts: { buscarIds?: BuscarIdsPorCodigo; buscarMatch?: BuscarMatchRiot; onJogada?: (db: any, jogada: any) => Promise<void>; rostA?: Set<string>; rostB?: Set<string> } = {}
): Promise<ResultadoSerie> {
  const buscarIds = opts.buscarIds ?? buscaIdsPorCodigo;
  const buscarMatch = opts.buscarMatch ?? buscaMatchRiot;

  if (!alvo.codigoPartida) return { ok: false, estado: "sem_codigo", scoreA: 0, scoreB: 0, winnerSide: null, irregular: false, motivo: "sem_codigo" };
  if (STATUS_FINALIZADOS.includes(alvo.status)) return { ok: true, estado: "finalizada", scoreA: alvo.scoreA, scoreB: alvo.scoreB, winnerSide: null, irregular: false };

  // Rosters de cada time (titulares + reservas accepted). `opts.rostA/rostB`
  // é override para testes de unidade (sem time no banco).
  let rostApuuids = opts.rostA;
  let rostBpuuids = opts.rostB;
  if (!rostApuuids || !rostBpuuids) {
    const [a, b] = await Promise.all([
      resolverRosterPuuids(db, alvo.teamAId),
      resolverRosterPuuids(db, alvo.teamBId),
    ]);
    rostApuuids = rostApuuids ?? a.puuids;
    rostBpuuids = rostBpuuids ?? b.puuids;
  }
  const winsNeeded = bestOfToWins(alvo.bestOf || 3);

  // Janela: do início da série até agora. A lista por PUUID não traz o código,
  // então o filtro final é no detalhe da partida (info.tournamentCode).
  const fim = Math.floor(Date.now() / 1000);
  const inicio = alvo.serieIniciadaAt
    ? Math.floor(new Date(alvo.serieIniciadaAt).getTime() / 1000) - 300
    : fim - 24 * 60 * 60;

  const ids = await buscarIds(alvo.codigoPartida, {
    puuids: [...rostApuuids, ...rostBpuuids],
    inicio,
    fim,
    queue: alvo.queue ?? QUEUE_SUMMONERS_RIFT,
  });
  if (ids === null) {
    // Riot indisponível/limitada: NÃO é "0 a 0" — o front mostra erro e o cron
    // tenta de novo. Sem isso o clique em Verificar ficava mudo.
    return { ok: false, estado: "em_andamento", scoreA: alvo.scoreA ?? 0, scoreB: alvo.scoreB ?? 0, winnerSide: null, irregular: false, motivo: "riot_indisponivel" };
  }

  // Detalhes + ordem cronológica: o gameNumber (1..n) precisa ser estável entre
  // verificações para a gravação idempotente das jogadas.
  const partidas: { id: string; match: RiotMatch }[] = [];
  const jaVistos = new Set<string>();
  for (const id of ids) {
    if (jaVistos.has(id)) continue;
    jaVistos.add(id);
    const match = await buscarMatch(id);
    if (!match) continue;
    partidas.push({ id, match });
  }
  partidas.sort((a, b) => (a.match.info?.gameCreation ?? 0) - (b.match.info?.gameCreation ?? 0));

  // Placar SEMPRE recalculado do zero: a busca devolve TODAS as partidas do
  // código, então somar em cima do placar salvo contaria a mesma jogada duas
  // vezes (ex.: verificou 1x0 e depois achou 2 jogos → 3x0). Resultado manual
  // do ADM é preservado pelo guard de status finalizado no topo.
  let scoreA = 0;
  let scoreB = 0;
  let irregular = false;
  let gameNumber = 0;

  for (const { id, match } of partidas) {
    // Remake/abortada não é jogada válida de série (mesma regra das salas).
    const fimJogo = match.info?.endOfGameResult;
    if (fimJogo && fimJogo !== "GameComplete") continue;

    const { lado, irregular: irregJogada } = ladoVencedorDaJogada(match, rostApuuids, rostBpuuids);
    const { a, b } = killsPorLado(match, rostApuuids, rostBpuuids);
    if (irregJogada) irregular = true;
    if (!lado) continue; // jogada indefinida (ainda em jogo) — ignora

    gameNumber++;
    // Só conta se ainda não chegou ao fim (evita contar além do bestOf).
    if (scoreA >= winsNeeded || scoreB >= winsNeeded) continue;
    if (lado === "a") scoreA++;
    else scoreB++;

    // Persistência opcional da jogada individual (para o histórico do front).
    if (opts.onJogada) {
      await opts.onJogada(db, {
        matchIdRiot: match?.metadata?.matchId ?? id,
        gameNumber,
        winnerSide: lado,
        killA: a,
        killB: b,
        duracaoS: match?.info?.gameDuration ?? 0,
        irregular: irregJogada,
        payload: (match as any),
      });
    }
  }

  let winnerSide: "a" | "b" | null = null;
  if (scoreA >= winsNeeded) winnerSide = "a";
  else if (scoreB >= winsNeeded) winnerSide = "b";

  const fechou = !!winnerSide;
  return {
    ok: true,
    estado: fechou ? "finalizada" : "em_andamento",
    scoreA,
    scoreB,
    winnerSide,
    irregular,
  };
}

/**
 * Verifica uma série de campeonato em transação (persistindo o resultado).
 * `alvoRef` é { matchId } OU { bracketMatchId } conforme o formato do jogo.
 * Atualiza a linha da série (score/winner/irregular/status) e, se fechou,
 * libera o código de volta ao pool.
 */
export async function verificarSerieCampeonato(
  tx: any,
  alvoRef: { matchId?: string; bracketMatchId?: string },
  opts: { buscarIds?: BuscarIdsPorCodigo; buscarMatch?: BuscarMatchRiot } = {}
): Promise<ResultadoSerie> {
  if (alvoRef.matchId) {
    const resMatch = await verificarSerieMatch(tx, alvoRef.matchId, opts);
    if (resMatch.estado !== "nao_encontrada") return resMatch;
    // Se não encontrou em tournamentMatches, tenta como bracketMatch
    return verificarSerieBracket(tx, alvoRef.matchId, opts);
  }
  if (alvoRef.bracketMatchId) return verificarSerieBracket(tx, alvoRef.bracketMatchId, opts);
  return { ok: false, estado: "nao_encontrada", scoreA: 0, scoreB: 0, winnerSide: null, irregular: false, motivo: "nao_encontrada" };
}

/**
 * Fila do pool define o queue do mapa da Riot: códigos 1v1 são ARAM (3200),
 * os genéricos são Summoner's Rift (3130) — mesma convenção do motor de salas.
 */
async function resolverQueueSerie(tx: any, codigo: string | null): Promise<number> {
  if (!codigo) return QUEUE_SUMMONERS_RIFT;
  const [mc] = await tx
    .select({ mode: matchCodes.mode })
    .from(matchCodes)
    .where(eq(matchCodes.code, codigo))
    .limit(1);
  return mc?.mode === "1v1" ? QUEUE_HOWLING_ABYSS : QUEUE_SUMMONERS_RIFT;
}

async function verificarSerieMatch(
  tx: any,
  matchId: string,
  opts: { buscarIds?: BuscarIdsPorCodigo; buscarMatch?: BuscarMatchRiot }
): Promise<ResultadoSerie> {
  const [serie] = await tx.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId)).limit(1).for("update");
  if (!serie) return { ok: false, estado: "nao_encontrada", scoreA: 0, scoreB: 0, winnerSide: null, irregular: false, motivo: "nao_encontrada" };

  // Resultado já decidido (motor ou ADM manual) não é reescrito.
  if (STATUS_FINALIZADOS.includes(serie.status)) {
    return { ok: true, estado: "finalizada", scoreA: serie.scoreA ?? 0, scoreB: serie.scoreB ?? 0, winnerSide: null, irregular: serie.irregular ?? false };
  }

  const alvo: SerieAlvo = {
    id: serie.id,
    modo: serie.phase ?? "groups",
    matchId: serie.id,
    bracketMatchId: null,
    codigoPartida: serie.codigoPartida ?? null,
    bestOf: serie.bestOf ?? 3,
    teamAId: serie.teamAId ?? null,
    teamBId: serie.teamBId ?? null,
    status: serie.status,
    scoreA: serie.scoreA ?? 0,
    scoreB: serie.scoreB ?? 0,
    serieIniciadaAt: serie.serieIniciadaAt ?? null,
    queue: await resolverQueueSerie(tx, serie.codigoPartida ?? null),
  };

  const r = await resolverSerie(tx, alvo, {
    ...opts,
    onJogada: async (d, jogada) => {
      // Idempotente: a série é recontada do zero a cada verificação, então a
      // mesma jogada não pode virar duas linhas.
      const [existente] = await d
        .select({ id: tournamentSeriesGames.id })
        .from(tournamentSeriesGames)
        .where(and(
          eq(tournamentSeriesGames.matchId, serie.id),
          eq(tournamentSeriesGames.matchIdRiot, jogada.matchIdRiot)
        ))
        .limit(1);
      if (existente) return;
      await d.insert(tournamentSeriesGames).values({
        matchId: serie.id,
        tournamentId: serie.tournamentId,
        gameNumber: jogada.gameNumber,
        winnerSide: jogada.winnerSide,
        matchIdRiot: jogada.matchIdRiot,
        killA: jogada.killA,
        killB: jogada.killB,
        duracaoS: jogada.duracaoS,
        irregular: jogada.irregular,
        payload: jogada.payload,
      });
    },
  });

  if (r.estado === "finalizada") {
    // tournament_matches (grupos/cronograma): guarda o resultado via
    // scoreA/scoreB/scoreDisplay/status — o front de grupos lê o placar numérico e scoreDisplay.
    await tx
      .update(tournamentMatches)
      .set({
        scoreA: r.scoreA,
        scoreB: r.scoreB,
        scoreDisplay: `${r.scoreA} - ${r.scoreB}`,
        irregular: r.irregular,
        status: "finalizada",
        updatedAt: new Date(),
      })
      .where(eq(tournamentMatches.id, serie.id));
    if (serie.codigoPartida) {
      await tx
        .update(matchCodes)
        .set({ used: false, matchId: null, lastUsedAt: new Date() })
        .where(eq(matchCodes.code, serie.codigoPartida));
    }
  } else if (r.estado === "em_andamento") {
    await tx
      .update(tournamentMatches)
      .set({
        scoreA: r.scoreA,
        scoreB: r.scoreB,
        scoreDisplay: `${r.scoreA} - ${r.scoreB}`,
        irregular: r.irregular,
        updatedAt: new Date(),
      })
      .where(eq(tournamentMatches.id, serie.id));
  }

  return r;
}

async function verificarSerieBracket(
  tx: any,
  bracketMatchId: string,
  opts: { buscarIds?: BuscarIdsPorCodigo; buscarMatch?: BuscarMatchRiot }
): Promise<ResultadoSerie> {
  const [serie] = await tx.select().from(bracketMatches).where(eq(bracketMatches.id, bracketMatchId)).limit(1).for("update");
  if (!serie) return { ok: false, estado: "nao_encontrada", scoreA: 0, scoreB: 0, winnerSide: null, irregular: false, motivo: "nao_encontrada" };

  // Resultado já decidido (motor ou ADM manual) não é reescrito.
  if (STATUS_FINALIZADOS.includes(serie.status)) {
    return { ok: true, estado: "finalizada", scoreA: serie.scoreA ?? 0, scoreB: serie.scoreB ?? 0, winnerSide: (serie.winnerSide as "a" | "b" | null) ?? null, irregular: serie.irregular ?? false };
  }

  const alvo: SerieAlvo = {
    id: serie.id,
    modo: "bracket",
    matchId: null,
    bracketMatchId: serie.id,
    codigoPartida: serie.codigoPartida ?? null,
    bestOf: serie.bestOf ?? 3,
    teamAId: serie.teamAId ?? null,
    teamBId: serie.teamBId ?? null,
    status: serie.status,
    scoreA: serie.scoreA ?? 0,
    scoreB: serie.scoreB ?? 0,
    serieIniciadaAt: serie.serieIniciadaAt ?? null,
    queue: await resolverQueueSerie(tx, serie.codigoPartida ?? null),
  };

  const r = await resolverSerie(tx, alvo, {
    ...opts,
    onJogada: async (d, jogada) => {
      // Idempotente: a série é recontada do zero a cada verificação, então a
      // mesma jogada não pode virar duas linhas.
      const [existente] = await d
        .select({ id: tournamentSeriesGames.id })
        .from(tournamentSeriesGames)
        .where(and(
          eq(tournamentSeriesGames.bracketMatchId, serie.id),
          eq(tournamentSeriesGames.matchIdRiot, jogada.matchIdRiot)
        ))
        .limit(1);
      if (existente) return;
      await d.insert(tournamentSeriesGames).values({
        bracketMatchId: serie.id,
        tournamentId: serie.tournamentId,
        gameNumber: jogada.gameNumber,
        winnerSide: jogada.winnerSide,
        matchIdRiot: jogada.matchIdRiot,
        killA: jogada.killA,
        killB: jogada.killB,
        duracaoS: jogada.duracaoS,
        irregular: jogada.irregular,
        payload: jogada.payload,
      });
    },
  });

  if (r.estado === "finalizada") {
    const patch: any = {
      scoreA: r.scoreA,
      scoreB: r.scoreB,
      irregular: r.irregular,
      winnerSide: r.winnerSide,
      status: "finalizada",
      updatedAt: new Date(),
    };
    await tx.update(bracketMatches).set(patch).where(eq(bracketMatches.id, serie.id));
    if (serie.codigoPartida) {
      await tx
        .update(matchCodes)
        .set({ used: false, matchId: null, lastUsedAt: new Date() })
        .where(eq(matchCodes.code, serie.codigoPartida));
    }
  } else if (r.estado === "em_andamento") {
    await tx
      .update(bracketMatches)
      .set({ scoreA: r.scoreA, scoreB: r.scoreB, irregular: r.irregular, updatedAt: new Date() })
      .where(eq(bracketMatches.id, serie.id));
  }

  return r;
}
