import { Router } from "express";
import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userWallets } from "../../../db/schema/identidade.js";
import { walletTransactions, payments } from "../../../db/schema/economia.js";

export const walletRouter = Router();

async function getAuthUser(req: any) {
  const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;

  const [session] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
    .limit(1);

  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user || null;
}

// GET /api/wallet/balance - Retorna saldo de MP e MC
walletRouter.get("/balance", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const [wallet] = await db.select().from(userWallets).where(eq(userWallets.userId, user.id)).limit(1);

    return res.json({
      userId: user.id,
      mp: wallet?.mp || 0,
      mc: wallet?.mc || 0,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao consultar saldo da carteira" });
  }
});

// GET /api/wallet/transactions - Histórico de transações
walletRouter.get("/transactions", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const txs = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, user.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50);

    return res.json(txs);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao consultar extrato de transações" });
  }
});

// POST /api/wallet/deposit - Inicia intenção de depósito de MC
walletRouter.post("/deposit", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { amountBrl, mcAmount } = req.body;
    if (!amountBrl || !mcAmount || amountBrl <= 0) {
      return res.status(400).json({ error: "Valor de depósito inválido" });
    }

    const gatewayRef = `PIX-${Date.now()}-${user.id.slice(0, 8)}`;

    const [payment] = await db
      .insert(payments)
      .values({
        userId: user.id,
        gateway: "mercadopago",
        gatewayRef,
        product: `mc_pack_${mcAmount}`,
        amountBrl: amountBrl.toString(),
        status: "pending",
      })
      .returning();

    return res.status(201).json({
      paymentId: payment.id,
      gatewayRef: payment.gatewayRef,
      status: payment.status,
      amountBrl: payment.amountBrl,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao gerar cobrança de depósito" });
  }
});
