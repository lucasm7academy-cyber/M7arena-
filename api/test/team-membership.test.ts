import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { games, gameAccounts } from "../../db/schema/games.js";
import { teams, teamMembers } from "../../db/schema/teams.js";
import { setupDb } from "./helpers.js";
import { findUserTeamMemberships, getRiotIdentities, sairDeOutrosTimes, resolverUserIdPorRiotId } from "../src/lib/team-membership.js";

const U = (n: number) => `aaaaaaa6-0000-0000-0000-00000000000${n}`;
const T = (n: number) => `bbbbbbb6-0000-0000-0000-00000000000${n}`;

async function seed(db: any) {
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(users).values([
    { id: U(1), email: "ghozt@x.com", displayName: "Ghozt" },
    { id: U(2), email: "semriot@x.com", displayName: "Sem Riot" },
    { id: U(3), email: "dono@x.com", displayName: "Dono" },
    // Conta sem game_account, mas com users.riot_id (fallback do resolvedor).
    { id: U(4), email: "fallback@x.com", displayName: "Fallback", riotId: "Fallback#BR1" },
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

  test("lineup: Riot ID com conta resolve para user_id (vaga de MEMBRO, não convidado)", async () => {
    const peloHandle = await resolverUserIdPorRiotId(ctx.db, "  ghozt#123 ");
    assert.equal(peloHandle, U(1), "handle da conta LoL casa sem caixa/espaço");
    const peloRiotId = await resolverUserIdPorRiotId(ctx.db, "fallback#br1");
    assert.equal(peloRiotId, U(4), "fallback pelo users.riot_id");
    const nenhum = await resolverUserIdPorRiotId(ctx.db, "Ninguem#000");
    assert.equal(nenhum, null, "Riot ID sem conta continua convidado");
  });

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

describe("team-membership — um time só (ADR-087)", () => {
  let ctx: any;
  beforeEach(async () => { ctx = await setupDb(); await seed(ctx.db); });
  afterEach(async () => { await ctx.client.close(); });

  test("sairDeOutrosTimes limpa vínculo real E vaga de convidado, preservando o time atual", async () => {
    // Ghozt: guest na M7W (T1) + vínculo real no TIME REAL (T3).
    const limpou = await sairDeOutrosTimes(ctx.db, { userId: U(1) }, T(1));
    assert.equal(limpou, 1, "só o vínculo real do T3 é removido");
    const restantes = await findUserTeamMemberships(ctx.db, U(1), { onlyAccepted: true });
    assert.deepEqual(restantes.map((r: any) => r.teamId), [T(1)], "fica só o time que ele acabou de entrar");
  });

  test("sairDeOutrosTimes com userId remove a vaga de CONVIDADO do outro time (caso macoinha)", async () => {
    // Caso macoinha: o cara TEM conta e está no time anterior só como guest.
    // Entrar num time novo (com user_id) tem que liberar a vaga guest.
    await ctx.db.delete(teamMembers).where(eq(teamMembers.teamId, T(3))); // tira o vínculo real
    const limpou = await sairDeOutrosTimes(ctx.db, { userId: U(1) }, T(2));
    assert.equal(limpou, 1, "vaga guest da M7W é apagada pelo vínculo Riot da conta");
    const naM7W = await ctx.db.select().from(teamMembers).where(eq(teamMembers.teamId, T(1)));
    assert.equal(naM7W.length, 0, "M7W ficou sem a vaga de convidado");
  });

  test("sairDeOutrosTimes por Riot ID remove a vaga de convidado do time anterior", async () => {
    // Só identidade de Riot ID (sem user_id): remove a vaga guest que casa.
    const limpou = await sairDeOutrosTimes(ctx.db, { userId: null, riotId: "ghozt#123 " }, T(3));
    assert.equal(limpou, 1, "vaga guest da M7W é apagada");
    const restantes = await ctx.db.select().from(teamMembers).where(eq(teamMembers.teamId, T(1)));
    assert.equal(restantes.length, 0, "M7W ficou sem a vaga de convidado");
    assert.equal(
      (await ctx.db.select().from(teamMembers).where(eq(teamMembers.teamId, T(3)))).length,
      1,
      "o vínculo real de outro jogador não é atingido"
    );
  });

  test("sairDeOutrosTimes não apaga vaga de convidado de OUTRA pessoa com nick parecido", async () => {
    await ctx.db.insert(teamMembers).values({
      teamId: T(2),
      userId: null,
      guestRiotId: "Ghozt#1234", // outro cara, handle diferente
      roleSlot: "adc",
      status: "accepted",
    });
    const limpou = await sairDeOutrosTimes(ctx.db, { userId: null, riotId: "Ghozt#123" }, T(3));
    assert.equal(limpou, 1, "remove só a vaga que casa exatamente");
    const noBBB = await ctx.db.select().from(teamMembers).where(eq(teamMembers.teamId, T(2)));
    assert.equal(noBBB.filter((m: any) => m.guestRiotId === "Ghozt#1234").length, 1);
  });

  test("sairDeOutrosTimes é no-op quando ele não está em outro time", async () => {
    // U(2) só existe como membro do T(1): nada a sair.
    await ctx.db.insert(teamMembers).values({
      teamId: T(1), userId: U(2), roleSlot: "mid", status: "accepted",
    });
    assert.equal(await sairDeOutrosTimes(ctx.db, { userId: U(2) }, T(1)), 0);
    assert.equal(await sairDeOutrosTimes(ctx.db, { userId: null, riotId: "ninguem#1" }, T(1)), 0);
    assert.equal(await sairDeOutrosTimes(ctx.db, {}, T(1)), 0, "sem identidade não mexe em nada");
    assert.equal(
      (await findUserTeamMemberships(ctx.db, U(2), { onlyAccepted: true })).length,
      1,
      "o vínculo do próprio time permanece"
    );
  });
});
