import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { mcPackages, payments, walletTransactions } from "../../db/schema/economia.js";
import { users, userWallets } from "../../db/schema/identidade.js";
import { setupDb } from "./helpers.js";
import { validarAssinatura } from "../src/lib/mercado-pago.js";
import { processarPagamentoAprovado } from "../src/lib/pagamentos.js";

describe("mercado-pago", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  async function criaUsuario(db: any, id: string) {
    await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
  }

  test("processarPagamentoAprovado credita MC + ledger deposit", async () => {
    const db = ctx.db;
    const uid = "11111111-1111-1111-1111-111111111111";
    const payId = "22222222-2222-2222-2222-222222222222";
    await criaUsuario(db, uid);
    await db.insert(payments).values({
      id: payId,
      userId: uid,
      gateway: "mercadopago",
      gatewayRef: "mp-1001",
      product: "mc_pack_00000000-0000-0000-0000-000000000001",
      amountBrl: "50.00",
      mcCredit: 5300,
      status: "pending",
    });

    const r = await processarPagamentoAprovado(db, "mp-1001");
    assert.deepEqual(r, { ok: true, jaAprovado: false });

    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mc, 5300);

    const [tx] = await db.select().from(walletTransactions).where(eq(walletTransactions.refId, payId));
    assert.equal(tx.kind, "deposit");
    assert.equal(tx.amount, 5300);
    assert.equal(tx.balanceAfter, 5300);

    const [pag] = await db.select().from(payments).where(eq(payments.id, payId));
    assert.equal(pag.status, "approved");
    assert.ok(pag.paidAt);
  });

  test("processarPagamentoAprovado é idempotente (webhook duplicado não credita 2x)", async () => {
    const db = ctx.db;
    const uid = "33333333-3333-3333-3333-333333333333";
    const payId = "44444444-4444-4444-4444-444444444444";
    await criaUsuario(db, uid);
    await db.insert(payments).values({
      id: payId,
      userId: uid,
      gateway: "mercadopago",
      gatewayRef: "mp-1002",
      product: "mc_pack_00000000-0000-0000-0000-000000000001",
      amountBrl: "100.00",
      mcCredit: 10600,
      status: "pending",
    });

    await processarPagamentoAprovado(db, "mp-1002");
    const r2 = await processarPagamentoAprovado(db, "mp-1002");
    assert.deepEqual(r2, { ok: true, jaAprovado: true });

    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mc, 10600); // não dobrou

    const txRows = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.refId, payId));
    assert.equal(txRows.length, 1); // 1 lançamento deposit, não 2
  });

  test("processarPagamentoAprovado retorna 404 para gatewayRef desconhecido", async () => {
    const r = await processarPagamentoAprovado(ctx.db, "mp-inexistente");
    assert.equal(r.ok, false);
    assert.equal(r.code, 404);
  });

  test("validarAssinatura aceita assinatura correta e rejeita errada", () => {
    const secret = "segredo_teste";
    const dataId = "1234567890";
    const requestId = "req-abc";
    const ts = "1700000000";
    const dataStr = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac("sha256", secret).update(dataStr).digest("hex");
    const signature = `ts=${ts},v1=${v1}`;

    assert.equal(validarAssinatura({ secret, signature, requestId, dataId }), true);
    assert.equal(validarAssinatura({ secret, signature: `ts=${ts},v1=0000000000`, requestId, dataId }), false);
    assert.equal(validarAssinatura({ secret, signature: "v1=sem-ts", requestId, dataId }), false);
  });

  test("seed de mc_packages tem 6 pacotes, bônus proporcional e popular no R$50", async () => {
    const rows = await ctx.db.select().from(mcPackages).orderBy(mcPackages.sortOrder);
    assert.equal(rows.length, 6);

    const popular = rows.find((p: any) => p.isPopular);
    assert.ok(popular);
    assert.equal(Number(popular.priceBrl), 50);

    for (const p of rows) {
      const price = Number(p.priceBrl);
      // R$1 = 100 MC base
      assert.equal(p.baseMc, price * 100);
      // bônus = 6 MC por real, só a partir de R$50
      const bonusEsperado = price >= 50 ? price * 6 : 0;
      assert.equal(p.bonusMc, bonusEsperado);
    }
  });
});
