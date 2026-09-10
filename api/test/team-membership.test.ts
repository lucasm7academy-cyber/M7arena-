import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { games, gameAccounts } from "../../db/schema/games.js";
import { teams, teamMembers } from "../../db/schema/teams.js";
import { setupDb } from "./helpers.js";
import { findUserTeamMemberships, getRiotIdentities } from "../src/lib/team-membership.js";

const U = (n: number) => `aaaaaaa6-0000-0000-0000-00000000000${n}`;
const T = (n: number) => `bbbbbbb6-0000-0000-0000-00000000000${n}`;

async function seed(db: any) {
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(users).values([
    { id: U(1), email: "ghozt@x.com", displayName: "Ghozt" },
    { id: U(2), email: "semriot@x.com", displayName: "Sem Riot" },
    { id: U(3), email: "dono@x.com", displayName: "Dono" },
  ]);
  await db.insert(gameAccounts).values({
    userId: U(1),
    gameId: "lol",
    externalId: "PUUID_GHOZT",
    handle: "Ghozt#123",
    verified: true,
  });
  await db.insert(teams).values([
    { id: T(1), gameId: "lol", name: "M7 WHITE", tag: "M7W", ownerId: U(3) },
    { id: T(2), gameId: "lol", name: "OUTRO", tag: "OUT", ownerId: U(3) },
    { id: T(3), gameId: "lol", name: "TIME REAL", tag: "REAL", ownerId: U(3) },
  ]);
  // Vaga de convidado do Ghozt na M7W: guest_riot_id com espaço no fim, como
  // pode chegar do cadastro manual do capitão.
  await db.insert(teamMembers).values({
    teamId: T(1),
    userId: null,
    guestRiotId: "Ghozt#123 ",
    guestPuuid: "PUUID_GHOZT",
    roleSlot: "support",
    status: "accepted",
  });
  // Vaga de convidado de outra pessoa (não deve casar).
  await db.insert(teamMembers).values({
    teamId: T(2),
    userId: null,
    guestRiotId: "Outro#999",
    guestPuuid: "PUUID_OUTRO",
    roleSlot: "top",
    status: "accepted",
  });
  // Vínculo real (user_id) do Ghozt em outro time.
  await db.insert(teamMembers).values({
    teamId: T(3),
    userId: U(1),
    roleSlot: "mid",
    status: "accepted",
  });
}

describe("team-membership (ADR-056)", () => {
  let ctx: any;
  beforeEach(async () => { ctx = await setupDb(); await seed(ctx.db); });
  afterEach(async () => { await ctx.client.close(); });

  test("getRiotIdentities devolve PUUID e handle normalizado", async () => {
    const ids = await getRiotIdentities(ctx.db, U(1));
    assert.deepEqual(ids.puuids, ["PUUID_GHOZT"]);
    assert.deepEqual(ids.handles, ["ghozt#123"]);
  });

  test("vaga de convidado casa por PUUID mesmo com nick bagunçado", async () => {
    const rows = await findUserTeamMemberships(ctx.db, U(1), { onlyAccepted: true });
    const naM7W = rows.filter((r: any) => r.teamId === T(1));
    assert.equal(naM7W.length, 1, "vaga de convidado do Ghozt deve ser reconhecida");
    assert.equal(naM7W[0].guestPuuid, "PUUID_GHOZT");
  });

  test("vaga de convidado casa por Riot ID sem depender de caixa/espaço", async () => {
    // Sem PUUID na vaga: só o guest_riot_id liga ao handle "Ghozt#123".
    await ctx.db.update(teamMembers)
      .set({ guestPuuid: null, guestRiotId: "  gHoZt#123 " })
      .where(eq(teamMembers.teamId, T(1)));
    const rows = await findUserTeamMemberships(ctx.db, U(1), { onlyAccepted: true });
    assert.equal(rows.filter((r: any) => r.teamId === T(1)).length, 1);
  });

  test("vaga de outro jogador não casa", async () => {
    const rows = await findUserTeamMemberships(ctx.db, U(2), { onlyAccepted: true });
    assert.equal(rows.length, 0, "usuário sem vínculo e sem Riot não entra em nenhuma vaga");
  });

  test("onlyAccepted exclui vaga recusada; sem a flag ela aparece", async () => {
    await ctx.db.insert(teamMembers).values({
      teamId: T(2),
      userId: null,
      guestRiotId: "Ghozt#123",
      roleSlot: "sub",
      status: "declined",
    });
    const todas = await findUserTeamMemberships(ctx.db, U(1));
    assert.equal(todas.filter((r: any) => r.status === "declined").length, 1);
    const aceitas = await findUserTeamMemberships(ctx.db, U(1), { onlyAccepted: true });
    assert.equal(aceitas.filter((r: any) => r.status === "declined").length, 0);
  });

  test("teamIds limita a busca aos times da partida", async () => {
    const rows = await findUserTeamMemberships(ctx.db, U(1), {
      teamIds: [T(1)],
      onlyAccepted: true,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].teamId, T(1));
  });

  test("vínculo real (user_id) vem antes da vaga de convidado", async () => {
    const rows = await findUserTeamMemberships(ctx.db, U(1), { onlyAccepted: true });
    assert.equal(rows[0].userId, U(1), "time com user_id deve ser o primeiro");
    assert.equal(rows[0].teamId, T(3));
  });
});
