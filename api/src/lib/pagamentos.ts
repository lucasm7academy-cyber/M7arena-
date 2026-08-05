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
export async function processarPagamentoAprovado(db: any, gatewayRef: string) {
  return db.transaction(async (tx: any) => {
    const [pag] = await tx
      .select()
      .from(payments)
      .where(eq(payments.gatewayRef, gatewayRef))
      .limit(1)
      .for("update");

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
