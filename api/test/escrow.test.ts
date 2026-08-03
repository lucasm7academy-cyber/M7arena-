import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { userWallets } from "../../db/schema/identidade.js";
import { walletTransactions, platformRevenue } from "../../db/schema/economia.js";
import {
  reservarEntrada,
  devolverEntrada,
  calcularPayout,
  pagarPremio,
  pagarEmpate,
  pagarCancelamento,
} from "../src/lib/escrow.js";

async function setupDb() {
  const client = new PGlite();
  await client.exec(`CREATE TABLE user_wallets (
    user_id uuid PRIMARY KEY,
    mp integer NOT NULL DEFAULT 0,
    mc integer NOT NULL DEFAULT 0,
    mc_reservado integer NOT NULL DEFAULT 0,
    updated_at timestamp NOT NULL DEFAULT now()
  )`);
  await client.exec(`CREATE TABLE wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    currency varchar(10) NOT NULL,
    amount integer NOT NULL,
    kind varchar(50) NOT NULL,
    ref_type varchar(50),
    ref_id text,
    balance_after integer NOT NULL,
    created_at timestamp DEFAULT now()
  )`);
  await client.exec(`CREATE TABLE platform_revenue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL,
    mc_fee integer NOT NULL,
    mc_fee_rounding integer NOT NULL DEFAULT 0,
    created_at timestamp DEFAULT now()
  )`);
  const db = drizzle(client);
  return { client, db };
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
    await db.insert(userWallets).values({ userId: "11111111-1111-1111-1111-111111111111", mc: 100, mcReservado: 0 });
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
    await db.insert(userWallets).values({ userId: "22222222-2222-2222-2222-222222222222", mc: 50, mcReservado: 30 });
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
    for (const p of players) {
      await db.insert(userWallets).values({ userId: p.userId, mc: 70, mcReservado: 30 });
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
      await db.insert(userWallets).values({ userId: u, mc: 50, mcReservado: 30 });
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
    await db.insert(userWallets).values({ userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", mc: 50, mcReservado: 30 });
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
