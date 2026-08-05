import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { payments, walletTransactions } from "../../db/schema/economia.js";
import { users, userWallets } from "../../db/schema/identidade.js";
import { setupDb } from "./helpers.js";
import { processarWebhook } from "../src/lib/pagamentos.js";

describe("webhook Mercado Pago (decisão completa)", () => {
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

  async function criaPagamento(db: any, id: string, uid: string, gatewayRef: string, mcCredit = 5300) {
    await criaUsuario(db, uid);
    await db.insert(payments).values({
      id,
      userId: uid,
      gateway: "mercadopago",
      gatewayRef,
      product: "mc_pack_00000000-0000-0000-0000-000000000001",
      amountBrl: "50.00",
      mcCredit,
      status: "pending",
    });
  }

  test("type não é payment → 200 e não credita", async () => {
    const r = await processarWebhook(ctx.db, {
      dataId: "123", type: "plan", isTest: true, secret: "", signature: "", requestId: "",
      consultarStatus: async () => ({ status: "approved", externalReference: null }),
    });
    assert.equal(r.status, 200);
  });

  test("sem data.id → 200 e não credita", async () => {
    const r = await processarWebhook(ctx.db, {
      dataId: "", type: "payment", isTest: true, secret: "", signature: "", requestId: "",
      consultarStatus: async () => ({ status: "approved", externalReference: null }),
    });
    assert.equal(r.status, 200);
  });

  test("produção sem secret → 500 webhook_nao_configurado", async () => {
    const r = await processarWebhook(ctx.db, {
      dataId: "999", type: "payment", isTest: false, secret: "", signature: "", requestId: "",
      consultarStatus: async () => ({ status: "approved", externalReference: null }),
    });
    assert.equal(r.status, 500);
    assert.equal(r.body.error, "webhook_nao_configurado");
  });

  test("assinatura inválida em produção → 401", async () => {
    const secret = "segredo_teste";
    const r = await processarWebhook(ctx.db, {
      dataId: "1001", type: "payment", isTest: false, secret, signature: "ts=1,v1=0000000000", requestId: "req",
      consultarStatus: async () => ({ status: "approved", externalReference: null }),
    });
    assert.equal(r.status, 401);
    assert.equal(r.body.error, "assinatura_invalida");
  });

  test("status não aprovado → 200 sem creditar", async () => {
    const r = await processarWebhook(ctx.db, {
      dataId: "1002", type: "payment", isTest: true, secret: "", signature: "", requestId: "",
      consultarStatus: async () => ({ status: "pending", externalReference: null }),
    });
    assert.equal(r.status, 200);
  });

  test("aprovado credita MC + ledger, 200", async () => {
    const db = ctx.db;
    const uid = "51000000-0000-0000-0000-000000000001";
    const payId = "52000000-0000-0000-0000-000000000001";
    await criaPagamento(db, payId, uid, "mp-web-1");

    const r = await processarWebhook(db, {
      dataId: "mp-web-1", type: "payment", isTest: true, secret: "", signature: "", requestId: "",
      consultarStatus: async () => ({ status: "approved", externalReference: payId }),
    });
    assert.equal(r.status, 200);

    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mc, 5300);
    const [tx] = await db.select().from(walletTransactions).where(eq(walletTransactions.refId, payId));
    assert.equal(tx.kind, "deposit");
  });

  test("webhook duplicado (já approved) não credita 2x", async () => {
    const db = ctx.db;
    const uid = "53000000-0000-0000-0000-000000000001";
    const payId = "54000000-0000-0000-0000-000000000001";
    await criaPagamento(db, payId, uid, "mp-web-2");

    await processarWebhook(db, {
      dataId: "mp-web-2", type: "payment", isTest: true, secret: "", signature: "", requestId: "",
      consultarStatus: async () => ({ status: "approved", externalReference: payId }),
    });
    const r2 = await processarWebhook(db, {
      dataId: "mp-web-2", type: "payment", isTest: true, secret: "", signature: "", requestId: "",
      consultarStatus: async () => ({ status: "approved", externalReference: payId }),
    });
    assert.equal(r2.status, 200);

    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mc, 5300);
    const txRows = await db.select().from(walletTransactions).where(eq(walletTransactions.refId, payId));
    assert.equal(txRows.length, 1);
  });

  test("janela insert-before-MP: gatewayRef ainda é o paymentId, casa por externalReference", async () => {
    const db = ctx.db;
    const uid = "55000000-0000-0000-0000-000000000001";
    const payId = "56000000-0000-0000-0000-000000000001";
    // gatewayRef ainda é o placeholder (paymentId) — o UPDATE do mc/order não rodou
    await criaPagamento(db, payId, uid, payId);

    const r = await processarWebhook(db, {
      dataId: "mp-web-3", type: "payment", isTest: true, secret: "", signature: "", requestId: "",
      consultarStatus: async () => ({ status: "approved", externalReference: payId }),
    });
    assert.equal(r.status, 200);

    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mc, 5300);
  });
});
