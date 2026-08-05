import { Router } from "express";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { mcPackages, payments } from "../../../db/schema/economia.js";
import { getAuthUser } from "../lib/match-flow.js";
import { criarPagamentoPix, consultarStatusPagamento, validarAssinatura } from "../lib/mercado-pago.js";
import { processarPagamentoAprovado } from "../lib/pagamentos.js";

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

    const pix = await criarPagamentoPix({
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

    await db.insert(payments).values({
      id: paymentId,
      userId: user.id,
      gateway: "mercadopago",
      gatewayRef: pix.id,
      product: `mc_pack_${pkg.id}`,
      amountBrl: amountBrl.toString(),
      mcCredit: totalMc,
      status: "pending",
    });

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
    return res.status(500).json({ error: e?.message || "erro_interno" });
  }
});

// POST /api/payments/webhook — público (Mercado Pago). Valida assinatura,
// confirma o status na API do MP e credita MC (idempotente).
paymentsRouter.post("/webhook", async (req, res) => {
  try {
    const dataId = String(req.query["data.id"] ?? "");
    const type = String(req.query.type ?? "");
    if (!dataId || type !== "payment") {
      return res.json({ success: true }); // MP ignora — não é pagamento
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "";
    const isTest = accessToken.startsWith("TEST-");

    // Em produção valida a assinatura; em modo teste (TEST-) o MP não envia a
    // assinatura corretamente, igual à edge function antiga.
    if (!isTest && secret) {
      const signature = String(req.headers["x-signature"] ?? "");
      const requestId = String(req.headers["x-request-id"] ?? "");
      if (!validarAssinatura({ secret, signature, requestId, dataId })) {
        return res.status(401).json({ error: "assinatura_invalida" });
      }
    }

    // NÃO confia no payload: consulta o status real no Mercado Pago.
    const status = await consultarStatusPagamento(accessToken, dataId);
    if (status !== "approved") {
      return res.json({ success: true }); // pendente/rejeitado — nada a fazer
    }

    const r = await processarPagamentoAprovado(db, dataId);
    if (!r.ok) {
      return res.status(r.code || 500).json({ error: r.erro || "erro_interno" });
    }
    return res.json({ success: true });
  } catch (e: any) {
    // Falha ao consultar o MP ou erro interno → 500 para o MP reenviar o
    // webhook; a idempotência do processamento protege contra duplicação.
    if (e?.status && e?.mpBody) {
      return res.status(502).json({ error: "mercadopago_indisponivel" });
    }
    return res.status(500).json({ error: e?.message || "erro_interno" });
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
