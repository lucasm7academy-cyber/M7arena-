/**
 * Depósito de MC via Mercado Pago (ADR-031).
 *
 * `creditarDeposito` é a única forma de creditar MC comprado: upsert na carteira
 * + ledger `deposit` (kind `deposit`, refType `payment`) atômicos na mesma
 * transação. `processarPagamentoAprovado` garante idempotência: roda em
 * transação com `FOR UPDATE` na linha do pagamento e verifica o status DENTRO
 * da transação — dois webhooks simultâneos (ou retries do MP) creditam só uma vez.
 */

import { eq } from "drizzle-orm";
import { userWallets } from "../../../db/schema/identidade.js";
import { walletTransactions, payments } from "../../../db/schema/economia.js";
import { validarAssinatura } from "./mercado-pago.js";

/** Credita MC comprado: upsert na carteira + ledger `deposit`, atômico. */
export async function creditarDeposito(tx: any, userId: string, mcCredit: number, paymentId: string) {
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  const novoMc = (w?.mc ?? 0) + mcCredit;

  if (w) {
    await tx
      .update(userWallets)
      .set({ mc: novoMc, updatedAt: new Date() })
      .where(eq(userWallets.userId, userId));
  } else {
    await tx.insert(userWallets).values({ userId, mc: novoMc });
  }

  await tx.insert(walletTransactions).values({
    userId,
    currency: "mc",
    amount: mcCredit,
    kind: "deposit",
    refType: "payment",
    refId: paymentId,
    balanceAfter: novoMc,
  });
}

/**
 * Aplica o pagamento aprovado pelo webhook. Idempotente: lock `FOR UPDATE` +
 * checagem de `status` dentro da transação → o segundo webhook (retry/duplicado)
 * vê `approved` e sai sem creditar de novo.
 */
export async function processarPagamentoAprovado(db: any, gatewayRef: string, externalReference?: string | null) {
  return db.transaction(async (tx: any) => {
    let [pag] = await tx
      .select()
      .from(payments)
      .where(eq(payments.gatewayRef, gatewayRef))
      .limit(1)
      .for("update");

    // Fallback: se o gatewayRef (id do MP) ainda não foi gravado porque o
    // UPDATE do mc/order não rodou, casa pelo external_reference (= nosso
    // payments.id). Sem isso o webhook que chega na janela daria 404.
    if (!pag && externalReference) {
      [pag] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, externalReference))
        .limit(1)
        .for("update");
    }

    if (!pag) return { ok: false, code: 404, erro: "pagamento_nao_encontrado" };
    if (pag.status === "approved") return { ok: true, jaAprovado: true };

    await creditarDeposito(tx, pag.userId, pag.mcCredit ?? 0, pag.id);
    await tx
      .update(payments)
      .set({ status: "approved", paidAt: new Date() })
      .where(eq(payments.id, pag.id));

    return { ok: true, jaAprovado: false };
  });
}

/**
 * Lógica de decisão do webhook do Mercado Pago (ADR-031). Extraída para ser
 * testável sem rede: `consultarStatus` é injetado (em produção é a chamada
 * real à API do MP). Retorna o status HTTP e o corpo da resposta.
 */
export async function processarWebhook(
  d: any,
  params: {
    dataId: string;
    type: string;
    isTest: boolean;
    secret: string;
    signature: string;
    requestId: string;
    consultarStatus: (paymentId: string) => Promise<{ status: string; externalReference: string | null }>;
  }
): Promise<{ status: number; body: any }> {
  if (!params.dataId || params.type !== "payment") {
    return { status: 200, body: { success: true } };
  }

  if (!params.isTest) {
    if (!params.secret) {
      return { status: 500, body: { error: "webhook_nao_configurado" } };
    }
    if (!validarAssinatura({ secret: params.secret, signature: params.signature, requestId: params.requestId, dataId: params.dataId })) {
      return { status: 401, body: { error: "assinatura_invalida" } };
    }
  }

  const mp = await params.consultarStatus(params.dataId);
  if (mp.status !== "approved") {
    return { status: 200, body: { success: true } };
  }

  const r = await processarPagamentoAprovado(d, params.dataId, mp.externalReference);
  if (!r.ok) {
    return { status: r.code || 500, body: { error: r.erro || "erro_interno" } };
  }
  return { status: 200, body: { success: true } };
}
