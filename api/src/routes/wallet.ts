import { Router } from "express";
import { eq, and, gt, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userWallets, userRoles } from "../../../db/schema/identidade.js";
import { walletTransactions } from "../../../db/schema/economia.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";
import { ESTADOS_ATIVOS } from "../lib/match-flow.js";

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

// GET /api/wallet/balance - Retorna saldo de Essência Azul (E)
walletRouter.get("/balance", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const [wallet] = await db.select().from(userWallets).where(eq(userWallets.userId, user.id)).limit(1);

    // Wallet transparente (design v3 §11): "X MC disponível + Y MC em partida".
    // `mcReservado` é o que está travado em salas apostadas ativas; `emPartida`
    // lista as salas que seguram a reserva para o valor virar link no perfil.
    const emPartida = await db
      .select({ salaNum: matches.salaNum, apostaMc: matches.apostaMc, nome: matches.nome, modo: matches.mode })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .where(and(eq(matchPlayers.userId, user.id), gt(matches.apostaMc, 0), inArray(matches.status, ESTADOS_ATIVOS)));

    return res.json({
      userId: user.id,
      mc: wallet?.mc || 0,
      mcReservado: wallet?.mcReservado || 0,
      emPartida: emPartida.map((s) => ({ salaNum: s.salaNum, apostaMc: s.apostaMc ?? 0, nome: s.nome, modo: s.modo })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao consultar saldo da carteira" });
  }
});

// O depósito legado `POST /wallet/deposit` foi removido (F02): a compra de E
// acontece só por `/payments/mc/order`, que calcula preço/pacote no servidor.

// GET /api/wallet/admin/balances?userIds=a,b,c — leitura administrativa.
// Sempre exige admin/proprietário: saldos de terceiros deixaram de ser
// públicos quando o card A09 passou a abrir o OP.GG (não há mais consumidor
// público). O parâmetro userIds continua aceito para a busca do painel.
walletRouter.get("/admin/balances", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    if (!(await ehAdmin(user.id))) {
      return res.status(403).json({ error: "Apenas admin pode listar saldos" });
    }

    const userIds = String(req.query.userIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (userIds.length > 500) {
      return res.status(400).json({ error: "Limite de 500 userIds por consulta" });
    }

    const wallets = userIds.length
      ? await db.select().from(userWallets).where(inArray(userWallets.userId, userIds))
      : await db.select().from(userWallets);
    return res.json(wallets.map((w) => ({ userId: w.userId, mc: w.mc, mcReservado: w.mcReservado })));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao consultar saldos" });
  }
});

/**
 * Regra de negócio do ajuste administrativo de Essência Azul (E):
 * recusa saldo negativo, faz upsert da carteira e grava o ledger
 * wallet_transactions (kind admin_adjustment + balance_after) na mesma operação.
 * A validação de cargo fica no endpoint — aqui só o DELTA de E é aplicado.
 */
async function aplicarAjusteMc(
  userId: string,
  deltaMC: number,
  motivo: string
): Promise<{ ok: true; mc: number } | { ok: false; status: number; erro: string; mc: number }> {
  const [alvo] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!alvo) {
    return { ok: false, status: 404, erro: "usuario_nao_encontrado", mc: 0 };
  }

  const [wallet] = await db.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1);
  const mcAtual = wallet?.mc ?? 0;
  const novoMC = mcAtual + deltaMC;

  if (novoMC < 0) {
    return { ok: false, status: 400, erro: "saldo_insuficiente", mc: mcAtual };
  }

  // Upsert da carteira — usuário pode ainda não ter linha em user_wallets.
  if (wallet) {
    await db
      .update(userWallets)
      .set({ mc: novoMC, updatedAt: new Date() })
      .where(eq(userWallets.userId, userId));
  } else {
    await db.insert(userWallets).values({ userId, mc: novoMC });
  }

  // refType/refId carregam o motivo do ajuste (polimórfico: refType
  // discrimina o tipo, refId guarda o texto) para o ledger preservar o "porquê".
  if (deltaMC !== 0) {
    await db.insert(walletTransactions).values({
      userId,
      currency: "mc",
      amount: deltaMC,
      kind: "admin_adjustment",
      refType: "admin_adjustment",
      refId: typeof motivo === "string" && motivo.trim() ? motivo.trim() : "ajuste_admin",
      balanceAfter: novoMC,
    });
  }

  return { ok: true, mc: novoMC };
}

// POST /api/wallet/admin/adjust-mc — ajuste de saldo E, EXCLUSIVO do
// proprietário. A validação de cargo fica aqui; a regra (delta, recusa
// negativo, upsert, ledger) é compartilhada em aplicarAjusteMc.
walletRouter.post("/admin/adjust-mc", async (req, res) => {
  try {
    const dono = await getAuthUser(req);
    if (!dono) {
      return res.status(401).json({ ok: false, erro: "nao_autenticado", error: "nao_autenticado", mc: 0 });
    }
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, dono.id));
    const ehProprietario = roles.some((r) => r.role === "proprietario");
    if (!ehProprietario) {
      return res.status(403).json({ ok: false, erro: "nao_autorizado", error: "nao_autorizado", mc: 0 });
    }

    const { userId, deltaMC = 0, motivo } = req.body ?? {};
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ ok: false, erro: "parametros_invalidos", error: "parametros_invalidos", mc: 0 });
    }
    const dMC = Number.isFinite(Number(deltaMC)) ? Number(deltaMC) : 0;

    const r = await aplicarAjusteMc(userId, dMC, motivo);
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, erro: r.erro, error: r.erro, mc: r.mc });
    }
    return res.json({ ok: true, erro: null, mc: r.mc });
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "erro_interno", error: error?.message || "erro_interno", mc: 0 });
  }
});
