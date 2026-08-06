import { eq } from "drizzle-orm";
import { userWallets, userPayoutInfo } from "../../../db/schema/identidade.js";
import { withdrawals, walletTransactions } from "../../../db/schema/economia.js";

/**
 * Saque de MC via PIX (spec saque-mc-pix). Mesmo padrão do escrow: funções
 * recebem `tx` (transação Drizzle) — em produção a transação da rota, nos
 * testes o próprio `db`. Lock de linha (FOR UPDATE) impede concorrência.
 *
 * Invariantes:
 * - 100 MC = R$1 (MC_POR_REAL); mcAmount múltiplo de 100 para conversão exata.
 * - O MC sai da carteira NA SOLICITAÇÃO (withdrawal_hold). Pago consolida;
 *   rejeitado devolve (withdrawal_refund). Nenhuma taxa.
 */
export const MC_POR_REAL = 100;
export const VALOR_MINIMO_MC = 2000; // R$ 20,00

export function mcParaBrl(mc: number): number {
  return mc / MC_POR_REAL;
}

class ErroSaque extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/** Cria o pedido de saque: valida, debita o MC, grava ledger e snapshot do PIX. */
export async function solicitarSaque(tx: any, userId: string, mcAmount: number) {
  if (!Number.isInteger(mcAmount) || mcAmount <= 0 || mcAmount % MC_POR_REAL !== 0) {
    throw new ErroSaque("valor_invalido");
  }
  if (mcAmount < VALOR_MINIMO_MC) throw new ErroSaque("valor_minimo_nao_atingido");

  const [payout] = await tx.select().from(userPayoutInfo).where(eq(userPayoutInfo.userId, userId)).limit(1);
  if (!payout?.pixKey?.trim()) throw new ErroSaque("pix_nao_cadastrado");

  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  if (!w || w.mc < mcAmount) throw new ErroSaque("saldo_insuficiente");

  const [pedido] = await tx
    .insert(withdrawals)
    .values({
      userId,
      mcAmount,
      amountBrl: mcParaBrl(mcAmount).toString(),
      pixType: payout.pixType,
      pixKey: payout.pixKey,
      pixName: payout.pixName,
      status: "pending",
    })
    .returning();

  const novoMc = w.mc - mcAmount;
  await tx.update(userWallets).set({ mc: novoMc, updatedAt: new Date() }).where(eq(userWallets.userId, userId));
  await tx.insert(walletTransactions).values({
    userId,
    currency: "mc",
    amount: -mcAmount,
    kind: "withdrawal_hold",
    refType: "withdrawal",
    refId: pedido.id,
    balanceAfter: novoMc,
  });
  return pedido;
}

/**
 * Decide um saque como admin. `paid` consolida (MC já saiu na solicitação);
 * `rejected` devolve o MC e grava `withdrawal_refund`. Idempotente via lock
 * FOR UPDATE + checagem de status dentro da transação.
 */
export async function decidirSaque(tx: any, withdrawalId: string, adminId: string, action: "paid" | "rejected", decisionId: string) {
  const [pedido] = await tx.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).limit(1).for("update");
  if (!pedido) throw new ErroSaque("pedido_nao_encontrado");
  if (pedido.status !== "pending") throw new ErroSaque("pedido_ja_decidido");

  if (action === "rejected") {
    const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, pedido.userId)).limit(1).for("update");
    const novoMc = (w?.mc ?? 0) + pedido.mcAmount;
    await tx.update(userWallets).set({ mc: novoMc, updatedAt: new Date() }).where(eq(userWallets.userId, pedido.userId));
    await tx.insert(walletTransactions).values({
      userId: pedido.userId,
      currency: "mc",
      amount: pedido.mcAmount,
      kind: "withdrawal_refund",
      refType: "withdrawal",
      refId: pedido.id,
      balanceAfter: novoMc,
    });
  }

  const [atualizado] = await tx
    .update(withdrawals)
    .set({
      status: action === "paid" ? "paid" : "rejected",
      adminId,
      decisionId,
      decidedAt: new Date(),
    })
    .where(eq(withdrawals.id, withdrawalId))
    .returning();
  return atualizado;
}
