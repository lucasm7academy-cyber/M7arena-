import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { games } from "../../db/schema/games.js";
import { users } from "../../db/schema/identidade.js";
import { teams, teamMembers, teamStats } from "../../db/schema/teams.js";
import {
  tournaments,
  tournamentMatches,
  bracketMatches,
  tournamentSeriesGames,
} from "../../db/schema/tournaments.js";
import { matchCodes } from "../../db/schema/matches.js";
import { setupDb } from "./helpers.js";
import {
  resolverSerie,
  ladoVencedorDaJogada,
  killsPorLado,
  bestOfToWins,
  buscaIdsPorCodigo,
} from "../src/lib/serie-campeonato.js";

function partidaRiot(participants: any[], teams: any[] = [], over: any = {}) {
  return {
    metadata: { matchId: "BR1_SERIE_0001" },
    info: {
      tournamentCode: "BR-CAMP-COD-0001",
      gameCreation: Date.now(),
      gameDuration: 1500,
      endOfGameResult: "GameComplete",
      participants,
      teams: teams.length
        ? teams
        : [
            { teamId: 100, win: true },
            { teamId: 200, win: false },
          ],
      ...over,
    },
  };
}

describe("serie-campeonato (motor de série)", () => {
  let ctx: any;
  before(async () => { ctx = await setupDb(); });
  after(async () => { await ctx.client.close(); });

  test("bestOfToWins: md3→2, md5→3, md1→1", () => {
    assert.equal(bestOfToWins(3), 2);
    assert.equal(bestOfToWins(5), 3);
    assert.equal(bestOfToWins(1), 1);
  });

  test("ladoVencedorDaJogada decide pelo roster, não pelo teamId (lados invertidos)", () => {
    // Player A (vaga 'a') está no teamId 200; player B (vaga 'b') no teamId 100.
    // Time vencedor da Riot = 200 (win true). O lado vencedor deve ser 'a'.
    const rostA = new Set(["PUUID_A"]);
    const rostB = new Set(["PUUID_B"]);
    const match = partidaRiot(
      [
        { puuid: "PUUID_A", teamId: 200, win: true },
        { puuid: "PUUID_B", teamId: 100, win: false },
      ],
      [
        { teamId: 100, win: false },
        { teamId: 200, win: true },
      ]
    );
    const { lado, irregular } = ladoVencedorDaJogada(match, rostA, rostB);
    assert.equal(lado, "a");
    assert.equal(irregular, false);
  });

  test("ladoVencedorDaJogada marca irregular quando jogou jogador fora dos rosters", () => {
    const rostA = new Set(["PUUID_A"]);
    const rostB = new Set(["PUUID_B"]);
    const match = partidaRiot([
      { puuid: "PUUID_A", teamId: 100, win: true },
      { puuid: "PUUID_X", teamId: 100, win: true }, // fora
      { puuid: "PUUID_B", teamId: 200, win: false },
    ]);
    const { lado, irregular } = ladoVencedorDaJogada(match, rostA, rostB);
    assert.equal(lado, "a"); // vencedor = player do roster A
    assert.equal(irregular, true, "presença de PUUID_X fora marca irregular");
  });

  test("killsPorLado clusteriza pelo roster (lados invertidos)", () => {
    const rostA = new Set(["PUUID_A"]);
    const rostB = new Set(["PUUID_B"]);
    const match = partidaRiot([
      { puuid: "PUUID_A", teamId: 200, kills: 7 }, // A joga no teamId 200
      { puuid: "PUUID_B", teamId: 100, kills: 3 },
    ]);
    const { a, b } = killsPorLado(match, rostA, rostB);
    assert.equal(a, 7);
    assert.equal(b, 3);
  });

  test("resolverSerie acumula vitórias e fecha MD3 em 2", async () => {
    const db = ctx.db;
    const rostA = new Set(["PA1", "PA2"]);
    const rostB = new Set(["PB1", "PB2"]);
    const alvo = {
      id: "aaa-serie",
      modo: "groups",
      matchId: "aaa-serie",
      bracketMatchId: null,
      codigoPartida: "BR-CAMP-COD-0001",
      bestOf: 3,
      teamAId: null,
      teamBId: null,
      status: "em_andamento",
      scoreA: 0,
      scoreB: 0,
    };
    // Série com 3 partidas: A vence 2, B vence 1 → fecha 2x1 A.
    const partidas: any[] = [
      partidaRiot([
        { puuid: "PA1", teamId: 100, win: true, kills: 10 },
        { puuid: "PB1", teamId: 200, win: false, kills: 5 },
      ]),
      partidaRiot([
        { puuid: "PA1", teamId: 100, win: false, kills: 3 },
        { puuid: "PB1", teamId: 200, win: true, kills: 8 },
      ]),
      partidaRiot([
        { puuid: "PA1", teamId: 100, win: true, kills: 12 },
        { puuid: "PB1", teamId: 200, win: false, kills: 4 },
      ]),
    ];

    const r = await resolverSerie(db, alvo, {
      buscarIds: async () => ["M1", "M2", "M3"],
      buscarMatch: async (id: string) =>
        (id === "M1" ? partidas[0] : id === "M2" ? partidas[1] : partidas[2]),
      rostA: new Set(["PA1", "PA2"]),
      rostB: new Set(["PB1", "PB2"]),
    });

    assert.equal(r.estado, "finalizada");
    assert.equal(r.scoreA, 2);
    assert.equal(r.scoreB, 1);
    assert.equal(r.winnerSide, "a");
    assert.equal(r.irregular, false);
  });

  test("resolverSerie não fecha antes de alcançar 2 (MD3 em andamento)", async () => {
    const db = ctx.db;
    const alvo = {
      id: "aaa-serie2",
      modo: "groups",
      matchId: "aaa-serie2",
      bracketMatchId: null,
      codigoPartida: "BR-CAMP-COD-0002",
      bestOf: 3,
      teamAId: null,
      teamBId: null,
      status: "em_andamento",
      scoreA: 0,
      scoreB: 0,
    };
    const r = await resolverSerie(db, alvo, {
      buscarIds: async () => ["M1"],
      buscarMatch: async () => partidaRiot([
        { puuid: "PA1", teamId: 100, win: false },
        { puuid: "PB1", teamId: 200, win: true },
      ]),
      rostA: new Set(["PA1"]),
      rostB: new Set(["PB1"]),
    });
    assert.equal(r.estado, "em_andamento");
    assert.equal(r.scoreA, 0);
    assert.equal(r.scoreB, 1);
    assert.equal(r.winnerSide, null);
  });

  test("recontagem ignora o placar salvo e não infla (bug do 3x0)", async () => {
    const db = ctx.db;
    // Placar salvo diz 1x0, mas a busca devolve os DOIS jogos da série: o
    // resultado correto é 2x0 — não 3x0 (somar em cima do salvo).
    const alvo = {
      id: "aaa-serie-recontagem",
      modo: "groups",
      matchId: "aaa-serie-recontagem",
      bracketMatchId: null,
      codigoPartida: "BR-CAMP-COD-REC",
      bestOf: 3,
      teamAId: null,
      teamBId: null,
      status: "em_andamento",
      scoreA: 1,
      scoreB: 0,
    };
    const vitoriaA = partidaRiot([
      { puuid: "PA1", teamId: 100, win: true },
      { puuid: "PB1", teamId: 200, win: false },
    ]);
    const r = await resolverSerie(db, alvo, {
      buscarIds: async () => ["M1", "M2"],
      buscarMatch: async () => vitoriaA,
      rostA: new Set(["PA1"]),
      rostB: new Set(["PB1"]),
    });
    assert.equal(r.estado, "finalizada");
    assert.equal(r.scoreA, 2);
    assert.equal(r.scoreB, 0);
  });

  test("resolverSerie preserva série já finalizada (resultado manual do ADM)", async () => {
    const db = ctx.db;
    const alvo = {
      id: "aaa-serie-final",
      modo: "groups",
      matchId: "aaa-serie-final",
      bracketMatchId: null,
      codigoPartida: "BR-CAMP-COD-FIN",
      bestOf: 3,
      teamAId: null,
      teamBId: null,
      status: "finalizado",
      scoreA: 2,
      scoreB: 0,
    };
    const r = await resolverSerie(db, alvo, {
      buscarIds: async () => {
        throw new Error("não deve consultar a Riot para série finalizada");
      },
      buscarMatch: async () => null,
    });
    assert.equal(r.estado, "finalizada");
    assert.equal(r.scoreA, 2);
    assert.equal(r.scoreB, 0);
  });

  test("resolverSerie marca irregular quando há jogador de fora, mas conta normal", async () => {
    const db = ctx.db;
    const alvo = {
      id: "aaa-serie3",
      modo: "groups",
      matchId: "aaa-serie3",
      bracketMatchId: null,
      codigoPartida: "BR-CAMP-COD-0003",
      bestOf: 3,
      teamAId: null,
      teamBId: null,
      status: "em_andamento",
      scoreA: 0,
      scoreB: 0,
    };
    // Jogada com 1 de fora (PUUID_X) vencida por A → conta 1x0 mas irregular.
    const r = await resolverSerie(db, alvo, {
      buscarIds: async () => ["M1"],
      buscarMatch: async () =>
        partidaRiot([
          { puuid: "PA1", teamId: 100, win: true },
          { puuid: "PUUID_X", teamId: 100, win: true }, // fora do roster
          { puuid: "PB1", teamId: 200, win: false },
        ]),
      rostA: new Set(["PA1"]),
      rostB: new Set(["PB1"]),
    });
    assert.equal(r.scoreA, 1);
    assert.equal(r.scoreB, 0);
    assert.equal(r.irregular, true);
  });

  test("resolverSerie sem código → estado sem_codigo", async () => {
    const db = ctx.db;
    const alvo = {
      id: "aaa-serie4",
      modo: "groups",
      matchId: "aaa-serie4",
      bracketMatchId: null,
      codigoPartida: null,
      bestOf: 3,
      teamAId: null,
      teamBId: null,
      status: "pending",
      scoreA: 0,
      scoreB: 0,
    };
    const r = await resolverSerie(db, alvo, { buscarIds: async () => [], buscarMatch: async () => null });
    assert.equal(r.ok, false);
    assert.equal(r.estado, "sem_codigo");
  });
});

describe("serie-campeonato (busca por código via histórico dos PUUIDs)", () => {
  const mk = (id: string, code: string, creation: number) => ({
    metadata: { matchId: id },
    info: { tournamentCode: code, gameCreation: creation, participants: [], teams: [] },
  });

  test("filtra pelo tournamentCode e devolve em ordem cronológica", async () => {
    const ids = await buscaIdsPorCodigo(
      "COD",
      { puuids: ["PA", "PB"], inicio: 0, fim: 1, queue: 3130 },
      {
        buscarIdsPuuid: async (puuid: string) => (puuid === "PA" ? ["M2", "M1", "MX"] : ["M1"]),
        buscarMatch: async (id: string) =>
          id === "MX" ? mk(id, "OUTRO", 50) : mk(id, "COD", id === "M1" ? 100 : 200),
      }
    );
    assert.deepEqual(ids, ["M1", "M2"]);
  });

  test("sem partida do código → lista vazia (não é falha)", async () => {
    const ids = await buscaIdsPorCodigo(
      "COD",
      { puuids: ["PA"], inicio: 0, fim: 1, queue: 3130 },
      { buscarIdsPuuid: async () => [], buscarMatch: async () => null }
    );
    assert.deepEqual(ids, []);
  });

  test("Riot falhou em todos os PUUIDs → null (não confundir com vazio)", async () => {
    const ids = await buscaIdsPorCodigo(
      "COD",
      { puuids: ["PA", "PB"], inicio: 0, fim: 1, queue: 3130 },
      { buscarIdsPuuid: async () => null, buscarMatch: async () => null }
    );
    assert.equal(ids, null);
  });
});

describe("serie-campeonato (persistência no banco)", () => {
  let ctx: any;
  before(async () => { ctx = await setupDb(); });
  after(async () => { await ctx.client.close(); });

  async function criaCenario() {
    const db = ctx.db;
    await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
    const dono = crypto.randomUUID();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const uid = Math.random().toString(36).slice(2, 8);
    const [torneio] = await db.insert(tournaments).values({
      gameId: "lol",
      slug: `camp-serie-teste-${uid}`,
      name: "Campeonato Teste",
      format: "groups",
      status: "in_progress",
      organizerId: dono,
    }).returning();
    const [timeA] = await db.insert(teams).values({ gameId: "lol", name: "Time A", tag: `TA${uid}`, ownerId: dono }).returning();
    const [timeB] = await db.insert(teams).values({ gameId: "lol", name: "Time B", tag: `TB${uid}`, ownerId: dono }).returning();
    await db.insert(teamMembers).values([
      { teamId: timeA.id, userId: dono, roleSlot: "top", status: "accepted", guestPuuid: "PUUID_A" },
      { teamId: timeB.id, userId: dono, roleSlot: "top", status: "accepted", guestPuuid: "PUUID_B" },
    ]);
    const [serie] = await db.insert(tournamentMatches).values({
      tournamentId: torneio.id,
      phase: "group_stage",
      round: 0,
      teamAId: timeA.id,
      teamBId: timeB.id,
      codigoPartida: `BR-CAMP-COD-${uid}`,
      bestOf: 3,
      status: "em_andamento",
      phaseLabel: "Grupo A",
      matchKey: `camp-serie-teste-${uid}-Grupo A-0-1`,
      teamATag: `TA${uid}`,
      teamBTag: `TB${uid}`,
    }).returning();
    return { db, torneio, serie, timeA, timeB };
  }

  test("verificarSerieMatch fecha série e grava partidas individuais", async () => {
    const { db, torneio, serie, timeA } = await criaCenario();
    const { verificarSerieCampeonato } = await import("../src/lib/serie-campeonato.js");

    const r = await verificarSerieCampeonato(
      db,
      { matchId: serie.id },
      {
        buscarIds: async () => ["M1", "M2"],
        buscarMatch: async (id: string) => {
          const m: any = partidaRiot([
            { puuid: "PUUID_A", teamId: 100, win: true, kills: 9 },
            { puuid: "PUUID_B", teamId: 200, win: false, kills: 6 },
          ]);
          m.metadata.matchId = id;
          return m;
        },
      }
    );

    assert.equal(r.estado, "finalizada");
    assert.equal(r.scoreA, 2);
    assert.equal(r.scoreB, 0);

    const [m] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, serie.id));
    assert.equal(m.status, "finalizada");
    assert.equal(m.scoreA, 2);
    assert.equal(m.scoreB, 0);
    assert.equal(m.scoreDisplay, "2 - 0");

    const { toLegacyTournament } = await import("../src/lib/tournament-shape.js");
    const leg = await toLegacyTournament(torneio.id, db);
    const jogoLeg = leg.cronograma.find((j: any) => j.match_id === serie.id);
    assert.equal(jogoLeg?.placar, "2 - 0");
    assert.equal(jogoLeg?.status, "finalizado");

    const jogadas = await db.select().from(tournamentSeriesGames).where(eq(tournamentSeriesGames.matchId, serie.id));
    assert.equal(jogadas.length, 2, "duas jogadas gravadas");
    assert.equal(jogadas[0].gameNumber, 1);
    assert.equal(jogadas[0].winnerSide, "a");
    assert.equal(jogadas[0].killA, 9);
    assert.equal(jogadas[1].gameNumber, 2);

    const [statsA] = await db.select().from(teamStats).where(eq(teamStats.teamId, timeA.id));
    assert.equal(statsA.pdl, 15, "resultado da série entra no PDL global");
  });

  test("reverificar a série não duplica jogadas nem infla o placar", async () => {
    const { db, serie } = await criaCenario();
    const { verificarSerieCampeonato } = await import("../src/lib/serie-campeonato.js");

    const jogo = (matchIdRiot: string, creation: number) => {
      const m: any = partidaRiot(
        [
          { puuid: "PUUID_A", teamId: 100, win: true, kills: 9 },
          { puuid: "PUUID_B", teamId: 200, win: false, kills: 6 },
        ],
        [],
        { gameCreation: creation }
      );
      m.metadata.matchId = matchIdRiot;
      return m;
    };
    const m1 = jogo("BR1_G1", 1000);
    const m2 = jogo("BR1_G2", 2000);

    // 1ª verificação: só o jogo 1 → 1x0
    const r1 = await verificarSerieCampeonato(db, { matchId: serie.id }, {
      buscarIds: async () => ["BR1_G1"],
      buscarMatch: async () => m1,
    });
    assert.equal(r1.estado, "em_andamento");
    assert.equal(r1.scoreA, 1);

    // 2ª verificação: os dois jogos → 2x0 (não 3x0) e sem duplicar linhas
    const r2 = await verificarSerieCampeonato(db, { matchId: serie.id }, {
      buscarIds: async () => ["BR1_G1", "BR1_G2"],
      buscarMatch: async (id: string) => (id === "BR1_G1" ? m1 : m2),
    });
    assert.equal(r2.estado, "finalizada");
    assert.equal(r2.scoreA, 2);
    assert.equal(r2.scoreB, 0);

    const jogadas = await db.select().from(tournamentSeriesGames).where(eq(tournamentSeriesGames.matchId, serie.id));
    assert.equal(jogadas.length, 2, "a recontagem não pode duplicar jogadas");
  });

  test("série finalizada manualmente pelo ADM não é reescrita", async () => {
    const { db, serie } = await criaCenario();
    const { verificarSerieCampeonato } = await import("../src/lib/serie-campeonato.js");

    await db
      .update(tournamentMatches)
      .set({ status: "finalizado", scoreA: 2, scoreB: 0, scoreDisplay: "2 - 0" })
      .where(eq(tournamentMatches.id, serie.id));

    const r = await verificarSerieCampeonato(db, { matchId: serie.id }, {
      buscarIds: async () => ["BR1_G1"],
      buscarMatch: async () =>
        partidaRiot([
          { puuid: "PUUID_B", teamId: 100, win: true },
          { puuid: "PUUID_A", teamId: 200, win: false },
        ]),
    });
    assert.equal(r.estado, "finalizada");
    assert.equal(r.scoreA, 2);
    assert.equal(r.scoreB, 0);

    const [m] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, serie.id));
    assert.equal(m.status, "finalizado", "status manual preservado");
    assert.equal(m.scoreA, 2);
  });

  test("verificarSerieMatch com irregular marca irregular no banco e no shape legado", async () => {
    const { db, torneio, serie } = await criaCenario();
    const { verificarSerieCampeonato } = await import("../src/lib/serie-campeonato.js");

    const r = await verificarSerieCampeonato(
      db,
      { matchId: serie.id },
      {
        buscarIds: async () => ["M1", "M2"],
        buscarMatch: async (id: string) =>
          partidaRiot([
            { puuid: "PUUID_A", teamId: 100, win: true, kills: 9 },
            { puuid: "PUUID_EXTERNO", teamId: 100, win: true, kills: 1 },
            { puuid: "PUUID_B", teamId: 200, win: false, kills: 6 },
          ]),
      }
    );

    assert.equal(r.estado, "finalizada");
    assert.equal(r.irregular, true);

    const [m] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, serie.id));
    assert.equal(m.irregular, true);
    assert.equal(m.status, "finalizada");

    const { toLegacyTournament } = await import("../src/lib/tournament-shape.js");
    const leg = await toLegacyTournament(torneio.id, db);
    const jogoLeg = leg.cronograma.find((j: any) => j.match_id === serie.id);
    assert.equal(jogoLeg?.irregular, true);
  });

  test("storeCronograma libera código de partida quando ADM finaliza série manualmente (W.O.)", async () => {
    const { db, torneio, serie } = await criaCenario();
    const { storeCronograma } = await import("../src/lib/tournament-store.js");
    const { toLegacyTournament } = await import("../src/lib/tournament-shape.js");

    const [code] = await db
      .insert(matchCodes)
      .values({ code: `CODE-WO-${Date.now()}`, used: true })
      .returning();

    await db
      .update(tournamentMatches)
      .set({ codigoPartida: code.code })
      .where(eq(tournamentMatches.id, serie.id));

    // ADM marca W.O. 2x0 para o time A e confirma o resultado
    await storeCronograma(
      torneio.id,
      [
        {
          id: serie.matchKey,
          fase: serie.phaseLabel,
          timeA: serie.teamATag,
          timeB: serie.teamBTag,
          status: "finalizado",
          placar: "2 - 0",
        },
      ],
      true,
      db
    );

    // 1. O código de torneio deve ser liberado de volta ao pool
    const [codeDb] = await db.select().from(matchCodes).where(eq(matchCodes.code, code.code));
    assert.equal(codeDb.used, false);

    // 2. A partida deve estar finalizada com placar 2 - 0
    const [matchDb] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, serie.id));
    assert.equal(matchDb.status, "finalizado");
    assert.equal(matchDb.scoreA, 2);
    assert.equal(matchDb.scoreB, 0);

    // 3. O shape legado reflete o resultado finalizado
    const leg = await toLegacyTournament(torneio.id, db);
    const jogo = leg.cronograma.find((j: any) => j.id === serie.matchKey);
    assert.equal(jogo.status, "finalizado");
    assert.equal(jogo.placar, "2 - 0");
  });
});
