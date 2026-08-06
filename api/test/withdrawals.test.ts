import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets, userPayoutInfo } from "../../db/schema/identidade.js";
import { withdrawals, walletTransactions } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import { solicitarSaque, decidirSaque } from "../src/lib/withdrawals.js";

const ADMIN = "00000000-0000-0000-0000-0000000000aa";

async function criaJogador(db: any, id: string, mc: number, pixKey: string | null = "111.111.111-11") {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
  await db.insert(userWallets).values({ userId: id, mc });
  if (pixKey !== null) {
    await db.insert(userPayoutInfo).values({ userId: id, pixType: "cpf", pixKey, pixName: "Jogador Teste" });
  }
}

describe("saque de MC", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
    await ctx.db.insert(users).values({ id: ADMIN, email: "admin@x.com", displayName: "Admin" });
  });
  after(async () => {
    await ctx.client.close();
  });

  test("solicitarSaque debita MC, grava withdrawal_hold e cria pending com amountBrl", async () => {
    const db = ctx.db;
    await criaJogador(db, "11111111-1111-1111-1111-111111111111", 5000);
    const pedido = await solicitarSaque(db as any, "11111111-1111-1111-1111-111111111111", 2000);
    assert.equal(pedido.status, "pending");
    assert.equal(pedido.mcAmount, 2000);
    assert.equal(Number(pedido.amountBrl), 20);
    assert.equal(pedido.pixKey, "111.111.111-11");

    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "11111111-1111-1111-1111-111111111111"));
    assert.equal(w.mc, 3000);

    const [lanc] = await db.select().from(walletTransactions).where(eq(walletTransactions.kind, "withdrawal_hold")).limit(1);
    assert.equal(lanc.amount, -2000);
    assert.equal(lanc.balanceAfter, 3000);
  });

  test("rejeita valor não múltiplo de 100 e abaixo do mínimo", async () => {
    const db = ctx.db;
    await criaJogador(db, "22222222-2222-2222-2222-222222222222", 5000);
    await assert.rejects(
      () => solicitarSaque(db as any, "22222222-2222-2222-2222-222222222222", 1550),
      (e: any) => e.code === "valor_invalido"
    );
    await assert.rejects(
      () => solicitarSaque(db as any, "22222222-2222-2222-2222-222222222222", 1000),
      (e: any) => e.code === "valor_minimo_nao_atingido"
    );
  });

  test("rejeita sem chave PIX e sem saldo", async () => {
    const db = ctx.db;
    await criaJogador(db, "33333333-3333-3333-3333-333333333333", 5000, null);
    await assert.rejects(
      () => solicitarSaque(db as any, "33333333-3333-3333-3333-333333333333", 2000),
      (e: any) => e.code === "pix_nao_cadastrado"
    );
    await criaJogador(db, "44444444-4444-4444-4444-444444444444", 500, "222.222.222-22");
    await assert.rejects(
      () => solicitarSaque(db as any, "44444444-4444-4444-4444-444444444444", 2000),
      (e: any) => e.code === "saldo_insuficiente"
    );
  });

  test("decidirSaque paid consolida (MC não volta) e marca adminId", async () => {
    const db = ctx.db;
    await criaJogador(db, "55555555-5555-5555-5555-555555555555", 5000);
    const pedido = await solicitarSaque(db as any, "55555555-5555-5555-5555-555555555555", 2000);
    const pago = await decidirSaque(db as any, pedido.id, ADMIN, "paid", "a0000000-0000-0000-0000-000000000001");
    assert.equal(pago.status, "paid");
    assert.equal(pago.adminId, ADMIN);
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "55555555-5555-5555-5555-555555555555"));
    assert.equal(w.mc, 3000);
    const linhas = await db.select().from(walletTransactions).where(eq(walletTransactions.kind, "withdrawal_refund"));
    assert.equal(linhas.length, 0);
  });

  test("decidirSaque rejected devolve MC com ledger withdrawal_refund", async () => {
    const db = ctx.db;
    await criaJogador(db, "66666666-6666-6666-6666-666666666666", 5000);
    const pedido = await solicitarSaque(db as any, "66666666-6666-6666-6666-666666666666", 2000);
    const rejeitado = await decidirSaque(db as any, pedido.id, ADMIN, "rejected", "b0000000-0000-0000-0000-000000000002");
    assert.equal(rejeitado.status, "rejected");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "66666666-6666-6666-6666-666666666666"));
    assert.equal(w.mc, 5000);
    const [lanc] = await db.select().from(walletTransactions).where(eq(walletTransactions.kind, "withdrawal_refund")).limit(1);
    assert.equal(lanc.amount, 2000);
    assert.equal(lanc.balanceAfter, 5000);
  });

  test("decidirSaque é idempotente: segunda decisão lança pedido_ja_decidido", async () => {
    const db = ctx.db;
    await criaJogador(db, "77777777-7777-7777-7777-777777777777", 5000);
    const pedido = await solicitarSaque(db as any, "77777777-7777-7777-7777-777777777777", 2000);
    await decidirSaque(db as any, pedido.id, ADMIN, "paid", "c0000000-0000-0000-0000-000000000003");
    await assert.rejects(
      () => decidirSaque(db as any, pedido.id, ADMIN, "rejected", "d0000000-0000-0000-0000-000000000004"),
      (e: any) => e.code === "pedido_ja_decidido"
    );
    await assert.rejects(
      () => decidirSaque(db as any, "00000000-0000-0000-0000-00000000dead", ADMIN, "paid", "e0000000-0000-0000-0000-000000000005"),
      (e: any) => e.code === "pedido_nao_encontrado"
    );
  });
});
