import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { games } from "../../db/schema/games.js";
import { teams, teamStats } from "../../db/schema/teams.js";
import { tournaments, tournamentMatches } from "../../db/schema/tournaments.js";
import { setupDb } from "./helpers.js";
import { recalcularPdlGlobal } from "../src/lib/tournament-pdl.js";

const U = (n: number) => `aaaaaaa7-0000-0000-0000-00000000000${n}`;
const T = (n: number) => `bbbbbbb7-0000-0000-0000-00000000000${n}`;

async function seed(db: any) {
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(users).values({ id: U(1), email: "dono@x.com", displayName: "Dono" });
  await db.insert(teams).values([
    { id: T(1), gameId: "lol", name: "Time A", tag: "TMA", ownerId: U(1) },
    { id: T(2), gameId: "lol", name: "Time B", tag: "TMB", ownerId: U(1) },
    { id: T(3), gameId: "lol", name: "Time C", tag: "TMC", ownerId: U(1) },
    { id: T(4), gameId: "lol", name: "Time D", tag: "TMD", ownerId: U(1) },
  ]);
  const [torneio] = await db
    .insert(tournaments)
    .values({ gameId: "lol", slug: "pdl-teste", name: "PDL Teste", format: "groups", status: "in_progress", organizerId: U(1) })
    .returning();

  const jogo = (over: any) => ({
    tournamentId: torneio.id,
    phase: "group_stage",
    round: 0,
    status: "finalizado",
    phaseLabel: "Fase de Grupos",
    ...over,
  });

  await db.insert(tournamentMatches).values([
    // 1) A vence B → A +15/1V, B -13/1D
    jogo({ teamAId: T(1), teamBId: T(2), scoreA: 2, scoreB: 0, scoreDisplay: "2 - 0" }),
    // 2) B vence C → B +15/1V, C -13/1D
    jogo({ teamAId: T(2), teamBId: T(3), scoreA: 1, scoreB: 0, scoreDisplay: "1 - 0" }),
    // 3) empate A x C → não pontua
    jogo({ teamAId: T(1), teamBId: T(3), scoreA: 1, scoreB: 1, scoreDisplay: "1 - 1" }),
    // 4) não finalizado → ignorado
    jogo({ teamAId: T(1), teamBId: T(3), scoreA: 5, scoreB: 0, scoreDisplay: "5 - 0", status: "confirmado" }),
    // 5) chave é visual → ignorado
    jogo({ teamAId: T(1), teamBId: T(3), scoreA: 3, scoreB: 0, scoreDisplay: "3 - 0", phaseLabel: "MATA-MATA (CHAVEAMENTO)" }),
    // 6) sem ids, resolve por tag: C vence A → C +15, A -13
    jogo({ teamAId: null, teamBId: null, teamATag: "TMC", teamBTag: "TMA", scoreA: 2, scoreB: 1, scoreDisplay: "2 - 1" }),
    // 7) B vence D → B +15, D -13 (clampa em 0)
    jogo({ teamAId: T(2), teamBId: T(4), scoreA: 2, scoreB: 1, scoreDisplay: "2 - 1" }),
  ]);
}

async function statsPorTag(db: any) {
  const rows = await db
    .select({ tag: teams.tag, pdl: teamStats.pdl, wins: teamStats.wins, losses: teamStats.losses, ranking: teamStats.ranking })
    .from(teamStats)
    .innerJoin(teams, eq(teams.id, teamStats.teamId));
  return Object.fromEntries(rows.map((r: any) => [r.tag, r]));
}

describe("recalcularPdlGlobal (paridade recalcular_pdl_global)", () => {
  let ctx: any;
  beforeEach(async () => { ctx = await setupDb(); await seed(ctx.db); });
  afterEach(async () => { await ctx.client.close(); });

  test("aplica +15/-13, ignora empate/chave/não-finalizado e clampa em 0", async () => {
    const r = await recalcularPdlGlobal(ctx.db);
    assert.equal(r.times, 4);
    assert.equal(r.jogos, 4, "só os 4 jogos válidos contam");

    const s = await statsPorTag(ctx.db);
    assert.deepEqual(
      { pdl: s.TMA.pdl, wins: s.TMA.wins, losses: s.TMA.losses },
      { pdl: 2, wins: 1, losses: 1 },
      "A: +15 -13 = 2"
    );
    assert.deepEqual(
      { pdl: s.TMB.pdl, wins: s.TMB.wins, losses: s.TMB.losses },
      { pdl: 17, wins: 2, losses: 1 },
      "B: -13 +15 +15 = 17"
    );
    assert.deepEqual(
      { pdl: s.TMC.pdl, wins: s.TMC.wins, losses: s.TMC.losses },
      { pdl: 2, wins: 1, losses: 1 },
      "C: -13 +15 = 2"
    );
    assert.deepEqual(
      { pdl: s.TMD.pdl, wins: s.TMD.wins, losses: s.TMD.losses },
      { pdl: 0, wins: 0, losses: 1 },
      "D: -13 clampa em 0"
    );
  });

  test("ranking = pdl desc, wins desc (empate por tag)", async () => {
    await recalcularPdlGlobal(ctx.db);
    const s = await statsPorTag(ctx.db);
    assert.equal(s.TMB.ranking, 1);
    assert.equal(s.TMA.ranking, 2);
    assert.equal(s.TMC.ranking, 3);
    assert.equal(s.TMD.ranking, 4);
  });

  test("é idempotente: rodar de novo mantém os mesmos valores", async () => {
    await recalcularPdlGlobal(ctx.db);
    const antes = await statsPorTag(ctx.db);
    await recalcularPdlGlobal(ctx.db);
    const depois = await statsPorTag(ctx.db);
    assert.deepEqual(depois, antes);
  });
});
