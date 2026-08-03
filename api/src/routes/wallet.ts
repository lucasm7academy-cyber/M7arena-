import { Router } from "express";
import { eq, and, gt, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userWallets, userRoles } from "../../../db/schema/identidade.js";
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

/** Cargo admin no schema novo (user_roles). `proprietario` é aceito por legado. */
async function ehAdmin(userId: string): Promise<boolean> {
  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return roles.some((r) => r.role === "admin" || r.role === "proprietario");
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

// GET /api/wallet/admin/balances?userIds=a,b,c — leitura em lote.
// Com userIds: qualquer usuário autenticado (ranking/time exibem saldo de
// terceiros, como o RLS antigo permitia). Sem userIds: só admin (agregação).
walletRouter.get("/admin/balances", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const userIds = String(req.query.userIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (userIds.length === 0) {
      if (!(await ehAdmin(user.id))) {
        return res.status(403).json({ error: "Apenas admin pode listar todos os saldos" });
      }
      const todas = await db.select().from(userWallets);
      return res.json(todas.map((w) => ({ userId: w.userId, mp: w.mp, mc: w.mc })));
    }

    if (userIds.length > 500) {
      return res.status(400).json({ error: "Limite de 500 userIds por consulta" });
    }

    const wallets = await db
      .select()
      .from(userWallets)
      .where(inArray(userWallets.userId, userIds));
    return res.json(wallets.map((w) => ({ userId: w.userId, mp: w.mp, mc: w.mc })));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao consultar saldos" });
  }
});

// POST /api/wallet/admin/adjust — ajuste de saldo por DELTA, exclusivo de admin.
// O cliente nunca decide o valor final: o servidor valida o cargo, calcula os
// saldos (recusa negativo) e grava o ledger wallet_transactions (kind
// admin_adjustment + balance_after) na mesma operação.
walletRouter.post("/admin/adjust", async (req, res) => {
  try {
    const admin = await getAuthUser(req);
    if (!admin) {
      return res.status(401).json({ ok: false, erro: "nao_autenticado", error: "nao_autenticado", mc: 0, mp: 0 });
    }
    if (!(await ehAdmin(admin.id))) {
      return res.status(403).json({ ok: false, erro: "nao_autorizado", error: "nao_autorizado", mc: 0, mp: 0 });
    }

    const { userId, deltaMC = 0, deltaMP = 0, motivo } = req.body ?? {};
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ ok: false, erro: "parametros_invalidos", error: "parametros_invalidos", mc: 0, mp: 0 });
    }
    const dMC = Number.isFinite(Number(deltaMC)) ? Number(deltaMC) : 0;
    const dMP = Number.isFinite(Number(deltaMP)) ? Number(deltaMP) : 0;

    const [alvo] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!alvo) {
      return res.status(404).json({ ok: false, erro: "usuario_nao_encontrado", error: "usuario_nao_encontrado", mc: 0, mp: 0 });
    }

    const [wallet] = await db.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1);
    const mcAtual = wallet?.mc ?? 0;
    const mpAtual = wallet?.mp ?? 0;
    const novoMC = mcAtual + dMC;
    const novoMP = mpAtual + dMP;

    if (novoMC < 0 || novoMP < 0) {
      return res.status(400).json({ ok: false, erro: "saldo_insuficiente", error: "saldo_insuficiente", mc: mcAtual, mp: mpAtual });
    }

    // Upsert da carteira — usuário pode ainda não ter linha em user_wallets.
    if (wallet) {
      await db
        .update(userWallets)
        .set({ mp: novoMP, mc: novoMC, updatedAt: new Date() })
        .where(eq(userWallets.userId, userId));
    } else {
      await db.insert(userWallets).values({ userId, mp: novoMP, mc: novoMC });
    }

    // refType/refId carregam o motivo do ajuste (polimórfico: refType
    // discrimina o tipo, refId guarda o texto) para o ledger preservar o "porquê".
    const ref = {
      refType: "admin_adjustment" as const,
      refId: typeof motivo === "string" && motivo.trim() ? motivo.trim() : "ajuste_admin",
    };

    if (dMC !== 0) {
      await db.insert(walletTransactions).values({
        userId,
        currency: "mc",
        amount: dMC,
        kind: "admin_adjustment",
        ...ref,
        balanceAfter: novoMC,
      });
    }
    if (dMP !== 0) {
      await db.insert(walletTransactions).values({
        userId,
        currency: "mp",
        amount: dMP,
        kind: "admin_adjustment",
        ...ref,
        balanceAfter: novoMP,
      });
    }

    return res.json({ ok: true, erro: null, mc: novoMC, mp: novoMP });
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "erro_interno", error: error?.message || "erro_interno", mc: 0, mp: 0 });
  }
});
