import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { games } from "../../db/schema/games.js";
import { users } from "../../db/schema/identidade.js";
import { teams, teamMembers } from "../../db/schema/teams.js";
import {
  tournaments,
  tournamentMatches,
  bracketMatches,
  tournamentSeriesGames,
} from "../../db/schema/tournaments.js";
import { setupDb } from "./helpers.js";
import {
  resolverSerie,
  ladoVencedorDaJogada,
  killsPorLado,
  bestOfToWins,
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
      scoreA: 1,
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
    assert.equal(r.scoreA, 1);
    assert.equal(r.scoreB, 1);
    assert.equal(r.winnerSide, null);
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

describe("serie-campeonato (persistência no banco)", () => {
  let ctx: any;
  before(async () => { ctx = await setupDb(); });
  after(async () => { await ctx.client.close(); });

  async function criaCenario() {
    const db = ctx.db;
    await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
    const dono = crypto.randomUUID();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const [torneio] = await db.insert(tournaments).values({
      gameId: "lol",
      slug: "camp-serie-teste",
      name: "Campeonato Teste",
      format: "groups",
      status: "in_progress",
      organizerId: dono,
    }).returning();
    const [timeA] = await db.insert(teams).values({ gameId: "lol", name: "Time A", tag: "TA", ownerId: dono }).returning();
    const [timeB] = await db.insert(teams).values({ gameId: "lol", name: "Time B", tag: "TB", ownerId: dono }).returning();
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
      codigoPartida: "BR-CAMP-COD-PERSIST-0001",
      bestOf: 3,
      status: "em_andamento",
      phaseLabel: "Grupo A",
      matchKey: "camp-serie-teste-Grupo A-0-1",
      teamATag: "TA",
      teamBTag: "TB",
    }).returning();
    return { db, torneio, serie };
  }

  test("verificarSerieMatch fecha série e grava partidas individuais", async () => {
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
            { puuid: "PUUID_B", teamId: 200, win: false, kills: 6 },
          ]),
      }
    );

    assert.equal(r.estado, "finalizada");
    assert.equal(r.scoreA, 2);
    assert.equal(r.scoreB, 0);

    const [m] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, serie.id));
    assert.equal(m.status, "finalizada");
    assert.equal(m.scoreA, 2);
    assert.equal(m.scoreB, 0);

    const jogadas = await db.select().from(tournamentSeriesGames).where(eq(tournamentSeriesGames.matchId, serie.id));
    assert.equal(jogadas.length, 2, "duas jogadas gravadas");
    assert.equal(jogadas[0].gameNumber, 1);
    assert.equal(jogadas[0].winnerSide, "a");
    assert.equal(jogadas[0].killA, 9);
    assert.equal(jogadas[1].gameNumber, 2);
  });
});
