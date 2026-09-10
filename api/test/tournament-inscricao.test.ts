import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { games } from "../../db/schema/games.js";
import { teams } from "../../db/schema/teams.js";
import { tournaments, tournamentTeams, tournamentStandings } from "../../db/schema/tournaments.js";
import { setupDb } from "./helpers.js";
import { removerInscricao } from "../src/lib/tournament-store.js";

const U = (n: number) => `aaaaaaa8-0000-0000-0000-00000000000${n}`;
const T = (n: number) => `bbbbbbb8-0000-0000-0000-00000000000${n}`;

async function seed(db: any) {
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(users).values({ id: U(1), email: "dono@x.com", displayName: "Dono" });
  await db.insert(teams).values([
    { id: T(1), gameId: "lol", name: "M7 E-SPORTS", tag: "M7K", ownerId: U(1) },
    { id: T(2), gameId: "lol", name: "Logo", tag: "LOG", ownerId: U(1) },
  ]);
  const [torneio] = await db
    .insert(tournaments)
    .values({ gameId: "lol", slug: "inscricao-teste", name: "Inscrição Teste", format: "groups", status: "open", organizerId: U(1) })
    .returning();
  await db.insert(tournamentTeams).values([
    { tournamentId: torneio.id, teamId: T(1), status: "registered" },
    { tournamentId: torneio.id, teamId: T(2), status: "approved" },
  ]);
  await db.insert(tournamentStandings).values([
    { tournamentId: torneio.id, teamId: T(1), rank: 1 },
    { tournamentId: torneio.id, teamId: T(2), rank: 2 },
  ]);
  return { torneio };
}

describe("removerInscricao", () => {
  let ctx: any;
  beforeEach(async () => {
    ctx = await setupDb();
    const { torneio } = await seed(ctx.db);
    ctx.torneio = torneio;
  });
  afterEach(async () => { await ctx.client.close(); });

  test("remove a inscrição e a classificação do time alvo, mantendo os outros", async () => {
    const torneio = ctx.torneio;
    await removerInscricao(torneio.id, T(1), ctx.db);

    const insc = await ctx.db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, torneio.id));
    assert.equal(insc.length, 1, "só o time removido sai");
    assert.equal(insc[0].teamId, T(2));

    const cls = await ctx.db.select().from(tournamentStandings).where(eq(tournamentStandings.tournamentId, torneio.id));
    assert.equal(cls.length, 1);
    assert.equal(cls[0].teamId, T(2));
  });

  test("idempotente: remover de novo não quebra e não afeta os outros", async () => {
    const torneio = ctx.torneio;
    await removerInscricao(torneio.id, T(1), ctx.db);
    await removerInscricao(torneio.id, T(1), ctx.db);

    const insc = await ctx.db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, torneio.id));
    assert.equal(insc.length, 1);
    assert.equal(insc[0].teamId, T(2));
  });
});
