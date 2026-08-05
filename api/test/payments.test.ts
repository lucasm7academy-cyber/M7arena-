import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { mcPackages } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import { validarAssinatura } from "../src/lib/mercado-pago.js";

describe("mercado-pago", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
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
