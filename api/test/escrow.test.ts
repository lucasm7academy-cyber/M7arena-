import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches } from "../../db/schema/matches.js";
import { walletTransactions, platformRevenue } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import {
  reservarEntrada,
  devolverEntrada,
  calcularPayout,
  pagarPremio,
  pagarEmpate,
  pagarCancelamento,
} from "../src/lib/escrow.js";

/** Cria um usuário + wallet (FK de user_wallets exige o usuário). */
async function criaJogador(db: any, id: string, mc: number, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
  await db.insert(userWallets).values({ userId: id, mc, mcReservado });
}

/** Cria uma sala (FK de platform_revenue e match_players exigem a sala). */
async function criaSala(db: any, id: string, aposta = 30, status = "partida_iniciada") {
  const dono = "00000000-0000-0000-0000-00000000cafe";
  await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
  await db.insert(matches).values({
    id,
    gameId: "lol",
    mode: "5v5",
    createdBy: dono,
    status,
    apostaMc: aposta,
    taxaPct: "8.99",
  });
}

describe("escrow", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("reserva move mc -> mc_reservado e lança se saldo insuficiente", async () => {
    const db = ctx.db;
    await criaJogador(db, "11111111-1111-1111-1111-111111111111", 100);
    await reservarEntrada(db as any, "11111111-1111-1111-1111-111111111111", 30, "m1");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "11111111-1111-1111-1111-111111111111"));
    assert.equal(w.mc, 70);
    assert.equal(w.mcReservado, 30);

    await assert.rejects(
      () => reservarEntrada(db as any, "11111111-1111-1111-1111-111111111111", 100, "m2"),
      (e: any) => e.code === "SALDO_INSUFICIENTE"
    );
  });

  test("devolução move mc_reservado -> mc", async () => {
    const db = ctx.db;
    await criaJogador(db, "22222222-2222-2222-2222-222222222222", 50, 30);
    await devolverEntrada(db as any, "22222222-2222-2222-2222-222222222222", 30, "m1");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "22222222-2222-2222-2222-222222222222"));
    assert.equal(w.mc, 80);
    assert.equal(w.mcReservado, 0);
  });

  test("calcularPayout: taxa ceil, premio floor, resto para a plataforma", () => {
    const r = calcularPayout(100, 10, 8.99, 5);
    assert.equal(r.pote, 1000);
    assert.equal(r.taxa, 90);
    assert.equal(r.premioLiq, 910);
    assert.equal(r.porVencedor, 182);
    assert.equal(r.resto, 0);
  });

  test("calcularPayout: pote que não divide exato gera resto", () => {
    const r = calcularPayout(100, 10, 8.99, 3);
    assert.equal(r.taxa, 90);
    assert.equal(r.premioLiq, 910);
    assert.equal(r.porVencedor, 303);
    assert.equal(r.resto, 1);
  });

  test("pagarPremio: credita vencedores, debita nada (já reservado), taxa+resto na plataforma", async () => {
    const db = ctx.db;
    const players = [
      { userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", side: "blue" },
      { userId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", side: "blue" },
      { userId: "cccccccc-cccc-cccc-cccc-cccccccccccc", side: "blue" },
      { userId: "dddddddd-dddd-dddd-dddd-dddddddddddd", side: "red" },
      { userId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", side: "red" },
    ];
    await criaSala(db, "00000000-0000-0000-0000-000000000001");
    for (const p of players) {
      await criaJogador(db, p.userId, 70, 30);
    }
    await pagarPremio(db as any, "00000000-0000-0000-0000-000000000001", 30, players, "blue", 8.99);

    const [a] = await db.select().from(userWallets).where(eq(userWallets.userId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
    const [d] = await db.select().from(userWallets).where(eq(userWallets.userId, "dddddddd-dddd-dddd-dddd-dddddddddddd"));
    const calc = calcularPayout(30, 5, 8.99, 3);
    assert.equal(a.mc, 70 + calc.porVencedor);
    assert.equal(d.mc, 70);
    const [rev] = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, "00000000-0000-0000-0000-000000000001"));
    assert.equal(rev.mcFee, calc.taxa);
    assert.equal(rev.mcFeeRounding, calc.resto);
  });

  test("pagarEmpate: devolve o reservado de todos, sem taxa", async () => {
    const db = ctx.db;
    for (const u of ["ffffffff-ffff-ffff-ffff-ffffffffffff", "99999999-9999-9999-9999-999999999999"]) {
      await criaJogador(db, u, 50, 30);
    }
    await pagarEmpate(db as any, "00000000-0000-0000-0000-000000000002", 30, [
      { userId: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
      { userId: "99999999-9999-9999-9999-999999999999" },
    ]);
    const [f] = await db.select().from(userWallets).where(eq(userWallets.userId, "ffffffff-ffff-ffff-ffff-ffffffffffff"));
    assert.equal(f.mc, 80);
    assert.equal(f.mcReservado, 0);
    const revs = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, "00000000-0000-0000-0000-000000000002"));
    assert.equal(revs.length, 0);
  });

  test("pagarCancelamento: devolve o reservado de todos, sem taxa", async () => {
    const db = ctx.db;
    await criaJogador(db, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", 50, 30);
    await pagarCancelamento(db as any, "00000000-0000-0000-0000-000000000003", 30, [{ userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1" }]);
    const [h] = await db.select().from(userWallets).where(eq(userWallets.userId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"));
    assert.equal(h.mc, 80);
    assert.equal(h.mcReservado, 0);
  });

  test("pagarPremio grava match_prize e match_loss no ledger", async () => {
    const db = ctx.db;
    const txs = await db.select().from(walletTransactions);
    const kinds = txs.map((t) => t.kind);
    assert.ok(kinds.includes("match_prize"));
    assert.ok(kinds.includes("match_loss"));
  });
});
