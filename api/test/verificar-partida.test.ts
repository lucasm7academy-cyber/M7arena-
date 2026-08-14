import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers, matchCodes, matchResults } from "../../db/schema/matches.js";
import { gameAccounts, games } from "../../db/schema/games.js";
import { setupDb } from "./helpers.js";
import { verificarPartida } from "../src/lib/verificar-partida.js";

async function criaJogador(db: any, id: string, puuid: string, mc: number, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
  await db.insert(userWallets).values({ userId: id, mc, mcReservado });
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(gameAccounts).values({ userId: id, gameId: "lol", externalId: puuid, handle: "nick#BR1", verified: true });
}

async function criaSala(db: any, values: any = {}) {
  const dono = crypto.randomUUID();
  await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
  const [sala] = await db.insert(matches).values({
    gameId: "lol",
    mode: "5v5",
    createdBy: dono,
    status: "partida_iniciada",
    apostaMc: 30,
    taxaPct: "8.99",
    codigoPartida: "BR-TEST-COD-0001",
    iniciandoPartidaAt: new Date(),
    ...values,
  }).returning();
  return sala;
}

function partidaRiot(over: any = {}) {
  return {
    metadata: { matchId: "BR1_9999999999" },
    info: {
      tournamentCode: "BR-TEST-COD-0001",
      gameCreation: Date.now(),
      endOfGameResult: "GameComplete",
      participants: [
        { puuid: "PUUID_A", teamId: 100 },
        { puuid: "PUUID_B", teamId: 100 },
        { puuid: "PUUID_C", teamId: 200 },
        { puuid: "PUUID_D", teamId: 200 },
      ],
      teams: [
        { teamId: 100, win: true },
        { teamId: 200, win: false },
      ],
      ...over,
    },
  };
}

describe("verificarPartida", () => {
  let ctx: any;
  before(async () => { ctx = await setupDb(); });
  after(async () => { await ctx.client.close(); });

  test("acha + nicks batem → encerrada + paga vencedor", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000001";
    const b = "aaaaaaa4-0000-0000-0000-000000000002";
    const c = "aaaaaaa4-0000-0000-0000-000000000003";
    const d = "aaaaaaa4-0000-0000-0000-000000000004";
    await criaJogador(db, a, "PUUID_A", 70, 30);
    await criaJogador(db, b, "PUUID_B", 70, 30);
    await criaJogador(db, c, "PUUID_C", 70, 30);
    await criaJogador(db, d, "PUUID_D", 70, 30);
    const sala = await criaSala(db);
    await db.insert(matchPlayers).values([
      { matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
      { matchId: sala.id, userId: b, side: "blue", slot: 1, roleSlot: "JG", confirmed: true, linked: true },
      { matchId: sala.id, userId: c, side: "red", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
      { matchId: sala.id, userId: d, side: "red", slot: 1, roleSlot: "JG", confirmed: true, linked: true },
    ]);
    await db.insert(matchCodes).values({ code: "BR-TEST-ENC-0001", used: true, matchId: sala.id });

    const r = await verificarPartida(db, sala.id, {
      buscarIds: async () => ["BR1_9999999999"],
      buscarMatch: async () => partidaRiot(),
    });

    assert.equal(r.ok, true);
    assert.equal(r.estado, "encerrada");
    assert.equal(r.winnerSide, "blue");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "encerrada");
    assert.equal(m.winnerSide, "blue");
    const [res] = await db.select().from(matchResults).where(eq(matchResults.matchId, sala.id));
    assert.ok(res, "deve gravar match_results");
    const mps = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    for (const mp of mps) assert.equal(mp.linked, false, "jogadores liberados");
    const [codigo] = await db.select().from(matchCodes).where(eq(matchCodes.code, "BR-TEST-ENC-0001"));
    assert.equal(codigo.used, false, "código liberado após encerrar");
    assert.equal(codigo.matchId, null, "código desatrelado da sala");
  });

  test("nick nao bate → cancelada + devolve", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000011";
    const c = "aaaaaaa4-0000-0000-0000-000000000012";
    // PUUIDs únicos deste teste: o PGlite é compartilhado entre os testes e
    // game_external_id_idx é UNIQUE global (gameId, externalId) — reusar o
    // mesmo puuid de outro teste estouraria a constraint.
    await criaJogador(db, a, "PUUID_A2", 70, 30);
    await criaJogador(db, c, "PUUID_C2", 70, 30);
    const sala = await criaSala(db);
    await db.insert(matchPlayers).values([
      { matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
      { matchId: sala.id, userId: c, side: "red", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
    ]);
    await db.insert(matchCodes).values({ code: "BR-TEST-NICK-0001", used: true, matchId: sala.id });

    // Partida com um impostor (PUUID_X no lugar de PUUID_C)
    const r = await verificarPartida(db, sala.id, {
      buscarIds: async () => ["BR1_9999999999"],
      buscarMatch: async () =>
        partidaRiot({
          participants: [
            { puuid: "PUUID_A2", teamId: 100 },
            { puuid: "PUUID_X", teamId: 200 },
          ],
        }),
    });

    assert.equal(r.ok, true);
    assert.equal(r.estado, "cancelada");
    assert.equal(r.motivo, "nick_nao_bate");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "cancelada");
    const [wa] = await db.select().from(userWallets).where(eq(userWallets.userId, a));
    assert.equal(wa.mc, 100, "reserva devolvida");
    assert.equal(wa.mcReservado, 0);
    const mps = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    for (const mp of mps) assert.equal(mp.linked, false, "jogadores liberados");
    const [codigo] = await db.select().from(matchCodes).where(eq(matchCodes.code, "BR-TEST-NICK-0001"));
    assert.equal(codigo.used, false, "código liberado após cancelar");
    assert.equal(codigo.matchId, null, "código desatrelado da sala");
  });

  test("nao achou < 3h → segue partida_iniciada", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000021";
    await criaJogador(db, a, "PUUID_A3", 70, 30);
    const sala = await criaSala(db, { iniciandoPartidaAt: new Date(Date.now() - 60 * 60 * 1000) });

    const r = await verificarPartida(db, sala.id, {
      buscarIds: async () => [],
      buscarMatch: async () => null,
      agora: new Date(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.estado, "partida_iniciada");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "partida_iniciada");
  });

  test("nao achou >= 3h → cancelada + devolve", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000031";
    await criaJogador(db, a, "PUUID_A4", 70, 30);
    const sala = await criaSala(db, { iniciandoPartidaAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000) });

    const r = await verificarPartida(db, sala.id, {
      buscarIds: async () => [],
      buscarMatch: async () => null,
      agora: new Date(),
    });
    assert.equal(r.ok, true);
    assert.equal(r.estado, "cancelada");
    assert.equal(r.motivo, "nao_encontrada");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "cancelada");
  });

  test("idempotente: sala ja encerrada → no-op", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000041";
    await criaJogador(db, a, "PUUID_A5", 70, 30);
    const sala = await criaSala(db, { status: "encerrada" });
    const r = await verificarPartida(db, sala.id, { buscarIds: async () => [], buscarMatch: async () => null });
    assert.equal(r.ok, false);
  });

  test("sem conta vinculada >= 3h → cancelada (nunca paga às cegas)", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000051";
    // Jogador SEM linha em game_accounts (sem puuid) — cria direto, sem o
    // helper criaJogador que insere a conta vinculada.
    await db.insert(users).values({ id: a, email: a + "@x.com", displayName: "Jogador" });
    await db.insert(userWallets).values({ userId: a, mc: 70, mcReservado: 30 });
    const sala = await criaSala(db, { iniciandoPartidaAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000) });
    await db.insert(matchPlayers).values([
      { matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
    ]);

    const r = await verificarPartida(db, sala.id, {
      buscarIds: async () => [],
      buscarMatch: async () => null,
    });
    assert.equal(r.ok, true);
    assert.equal(r.estado, "cancelada");
    assert.equal(r.motivo, "nao_encontrada");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "cancelada");
    const [wa] = await db.select().from(userWallets).where(eq(userWallets.userId, a));
    assert.equal(wa.mc, 100, "reserva devolvida");
    assert.equal(wa.mcReservado, 0);
  });

  test("sala orfa (sem jogadores) >= 3h → cancelada + código liberado", async () => {
    const db = ctx.db;
    const sala = await criaSala(db, { iniciandoPartidaAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000) });
    await db.insert(matchCodes).values({ code: "BR-TEST-ORFAO-0001", used: true, matchId: sala.id });

    const r = await verificarPartida(db, sala.id, {
      buscarIds: async () => [],
      buscarMatch: async () => null,
    });
    assert.equal(r.ok, true);
    assert.equal(r.estado, "cancelada");
    assert.equal(r.motivo, "nao_encontrada");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "cancelada");
    const [codigo] = await db.select().from(matchCodes).where(eq(matchCodes.code, "BR-TEST-ORFAO-0001"));
    assert.equal(codigo.used, false, "código liberado após cancelar");
    assert.equal(codigo.matchId, null, "código desatrelado da sala");
  });
});
