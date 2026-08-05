import { Router } from "express";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { mcPackages, payments } from "../../../db/schema/economia.js";
import { getAuthUser } from "../lib/match-flow.js";
import { criarPagamentoPix, consultarStatusPagamento, MpPixOrder } from "../lib/mercado-pago.js";
import { processarWebhook } from "../lib/pagamentos.js";

export const paymentsRouter = Router();

/**
 * Gateway de pagamento de MC (ADR-031) — Mercado Pago, Checkout Transparente,
 * PIX. Substitui as edge functions `create-mercado-pago-order` e
 * `mercado-pago-webhook` do Supabase (BLK-003). O cliente só envia `packageId`;
 * preço, bônus e crédito são decididos no servidor (invariante 3.3).
 */

// GET /api/payments/packages — público. Devolve os pacotes ativos para o
// DepositModal renderizar. O preço vem do banco (fonte da verdade), nunca do
// cliente.
paymentsRouter.get("/packages", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(mcPackages)
      .where(eq(mcPackages.active, true))
      .orderBy(mcPackages.sortOrder);
    return res.json(
      rows.map((p) => ({
        id: p.id,
        priceBrl: Number(p.priceBrl),
        baseMc: p.baseMc,
        bonusMc: p.bonusMc,
        totalMc: p.baseMc + p.bonusMc,
        isPopular: p.isPopular,
      }))
    );
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "erro_interno" });
  }
});

// POST /api/payments/mc/order — autenticado. Cria pedido PIX no Mercado Pago e
// grava em `payments` com `mc_credit` (base+bônus) definido no servidor.
paymentsRouter.post("/mc/order", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const { packageId } = req.body ?? {};
    if (!packageId || typeof packageId !== "string") {
      return res.status(400).json({ error: "pacote_invalido" });
    }

    const [pkg] = await db
      .select()
      .from(mcPackages)
      .where(and(eq(mcPackages.id, packageId), eq(mcPackages.active, true)))
      .limit(1);
    if (!pkg) return res.status(400).json({ error: "pacote_invalido" });

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
    if (!accessToken) return res.status(500).json({ error: "mercadopago_nao_configurado" });

    const isTest = accessToken.startsWith("TEST-");
    const totalMc = pkg.baseMc + pkg.bonusMc;
    const amountBrl = Number(pkg.priceBrl);
    // external_reference = id do nosso registro (uuid) para o webhook poder
    // casar por gatewayRef depois.
    const paymentId = crypto.randomUUID();
    const notificationUrl =
      process.env.MERCADO_PAGO_NOTIFICATION_URL || `${process.env.APP_URL}/api/payments/webhook`;

    // INSERT ANTES de chamar o MP (fix da revisão final): se o PIX for criado
    // mas o INSERT falhar, o usuário paga sem registro no banco e o webhook
    // não encontra o pagamento → MC nunca creditado. Gravando primeiro com
    // gatewayRef=paymentId (placeholder) e atualizando depois, o registro
    // existe antes de o MP poder notificar. Se o MP falhar, marca rejected.
    await db.insert(payments).values({
      id: paymentId,
      userId: user.id,
      gateway: "mercadopago",
      gatewayRef: paymentId,
      product: `mc_pack_${pkg.id}`,
      amountBrl: amountBrl.toString(),
      mcCredit: totalMc,
      status: "pending",
    });

    let pix: MpPixOrder;
    try {
      pix = await criarPagamentoPix({
        accessToken,
        amountBrl,
        description: `M7 Arena - ${totalMc} MCs`,
        payerEmail: isTest
          ? "test_user_123456@testuser.com"
          : `user-${user.id.substring(0, 8)}@m7arena.pro`,
        externalReference: paymentId,
        notificationUrl,
        idempotencyKey: `${user.id}_${Date.now()}`,
      });
    } catch (e) {
      await db.update(payments).set({ status: "rejected" }).where(eq(payments.id, paymentId));
      throw e;
    }

    await db.update(payments).set({ gatewayRef: pix.id }).where(eq(payments.id, paymentId));

    return res.status(201).json({
      paymentId,
      orderId: pix.id,
      method: pix.method,
      qrCode: pix.qrCode,
      brCode: pix.brCode,
    });
  } catch (e: any) {
    // Erro do Mercado Pago: não vaza o corpo (pode conter detalhes da conta).
    if (e?.status && e?.mpBody) {
      return res.status(502).json({ error: "mercadopago_indisponivel" });
    }
    return res.status(500).json({ error: "erro_interno" });
  }
});

// POST /api/payments/webhook — público (Mercado Pago). A lógica de decisão
// (assinatura → confirmar status no MP → creditar, idempotente) vive em
// processarWebhook (lib/pagamentos.ts), testada sem rede.
paymentsRouter.post("/webhook", async (req, res) => {
  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "";
    const isTest = accessToken.startsWith("TEST-");

    const r = await processarWebhook(db, {
      dataId: String(req.query["data.id"] ?? ""),
      type: String(req.query.type ?? ""),
      isTest,
      secret,
      signature: String(req.headers["x-signature"] ?? ""),
      requestId: String(req.headers["x-request-id"] ?? ""),
      consultarStatus: (id: string) => consultarStatusPagamento(accessToken, id),
    });
    return res.status(r.status).json(r.body);
  } catch (e: any) {
    // Falha ao consultar o MP ou erro interno → 500 para o MP reenviar o
    // webhook; a idempotência do processamento protege contra duplicação.
    if (e?.status && e?.mpBody) {
      return res.status(502).json({ error: "mercadopago_indisponivel" });
    }
    return res.status(500).json({ error: "erro_interno" });
  }
});

// GET /api/payments/:orderId/status — autenticado. Lê o status do nosso
// registro (uuid nosso, o `paymentId` devolvido no create). Só o dono vê.
paymentsRouter.get("/:orderId/status", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const [pag] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, req.params.orderId), eq(payments.userId, user.id)))
      .limit(1);
    if (!pag) return res.status(404).json({ error: "pagamento_nao_encontrado" });

    return res.json({ orderId: pag.id, status: pag.status });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "erro_interno" });
  }
});
