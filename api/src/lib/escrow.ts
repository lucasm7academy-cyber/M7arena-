import { eq } from "drizzle-orm";
import { userWallets } from "../../../db/schema/identidade.js";
import { walletTransactions, platformRevenue } from "../../../db/schema/economia.js";

/**
 * Escrow das salas apostadas (ADR-019 / design v3 §4).
 *
 * Invariante: `mc + mc_reservado = total` sempre; `mc` nunca negativo.
 * Todo `mc_reservado` tem exatamente um caminho de saída: payout, devolução
 * por empate/cancelamento, ou devolução por saída antes do início da partida.
 *
 * As funções recebem `tx` (transação Drizzle) — em produção é a transação da
 * rota (roda atômica com a máquina de estados); nos testes, o próprio `db`.
 * Lock de linha (FOR UPDATE) impede dois cliques simultâneos com saldo para
 * uma só vaga — a fonte da verdade é o servidor (design v3 §2.1).
 */

/** Reserva a aposta: move mc -> mc_reservado. Lança SALDO_INSUFICIENTE. */
export async function reservarEntrada(tx: any, userId: string, aposta: number, matchId: string) {
  if (!aposta || aposta <= 0) return;
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  if (!w || w.mc < aposta) {
    const err: any = new Error("saldo_insuficiente");
    err.code = "SALDO_INSUFICIENTE";
    throw err;
  }
  const novoMc = w.mc - aposta;
  const novoReservado = (w.mcReservado ?? 0) + aposta;
  await tx.update(userWallets).set({ mc: novoMc, mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, userId));
  await gravarLancamento(tx, userId, -aposta, "match_entry_reserve", matchId, novoMc);
}

/** Devolve a reserva: move mc_reservado -> mc. No-op se não há reserva (idempotente). */
export async function devolverEntrada(tx: any, userId: string, aposta: number, matchId: string) {
  if (!aposta || aposta <= 0) return;
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  const reservadoAtual = w?.mcReservado ?? 0;
  if (reservadoAtual < aposta) return; // nada reservado desta aposta — não criar MC do nada
  const novoMc = (w?.mc ?? 0) + aposta;
  const novoReservado = Math.max(0, reservadoAtual - aposta);
  await tx.update(userWallets).set({ mc: novoMc, mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, userId));
  await gravarLancamento(tx, userId, aposta, "match_entry_refund", matchId, novoMc);
}

/** Lança uma linha no ledger (auditoria). */
export async function gravarLancamento(tx: any, userId: string, amount: number, kind: string, matchId: string, balanceAfter: number) {
  await tx.insert(walletTransactions).values({
    userId,
    currency: "mc",
    amount,
    kind,
    refType: "match",
    refId: matchId,
    balanceAfter,
  });
}

/**
 * Política de arredondamento (design v3 §4.1). MC é inteiro:
 * taxa ceil (pra cima), prêmio floor (pra baixo), resto vai pra plataforma
 * com lançamento próprio. A soma fecha exatamente com o pote — a invariante
 * nunca quebra por 1 MC.
 */
export function calcularPayout(aposta: number, totalJogadores: number, taxaPct: number, numVencedores: number) {
  // Segurança (MORPH-002): defesa em profundidade — nunca deixa uma taxa
  // inválida (negativa ou >100%) inflar o prêmio. O clamp na rota de criação
  // já protege a entrada; isto protege qualquer caminho futuro que chame a
  // função sem validar. Taxa negativa faria premioLiq > pote (cria MC do nada).
  const taxaClamp = Number.isFinite(taxaPct) ? Math.max(0, Math.min(taxaPct, 100)) : 8.99;
  const pote = aposta * totalJogadores;
  const taxa = Math.ceil((pote * taxaClamp) / 100);
  const premioLiq = pote - taxa;
  const porVencedor = numVencedores > 0 ? Math.floor(premioLiq / numVencedores) : 0;
  const resto = premioLiq - porVencedor * numVencedores;
  return { pote, taxa, premioLiq, porVencedor, resto };
}

/**
 * Paga os vencedores de uma sala apostada. Os perdedores já perderam o
 * `mc_reservado` (nunca mais volta); os vencedores recebem `porVencedor` do
 * prêmio líquido. A taxa + o resto vão para `platform_revenue`.
 *
 * Idempotência (§4.3): a constraint UNIQUE do ledger (`idx_ledger_match_unico`)
 * impede inserir 2x `match_prize` para o mesmo jogador na mesma partida — a
 * segunda tentativa estoura constraint e faz rollback da transação.
 */
export async function pagarPremio(tx: any, matchId: string, aposta: number, players: { userId: string; side: string }[], winnerSide: string, taxaPct: number) {
  if (!aposta || aposta <= 0 || players.length === 0) return;
  const vencedores = players.filter((p) => p.side === winnerSide);
  if (vencedores.length === 0) return;

  const calc = calcularPayout(aposta, players.length, taxaPct, vencedores.length);

  for (const v of vencedores) {
    const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, v.userId)).limit(1).for("update");
    const novoMc = (w?.mc ?? 0) + calc.porVencedor;
    const novoReservado = Math.max(0, (w?.mcReservado ?? 0) - aposta);
    await tx.update(userWallets).set({ mc: novoMc, mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, v.userId));
    await gravarLancamento(tx, v.userId, calc.porVencedor, "match_prize", matchId, novoMc);
  }

  // Perdedores: zera o reservado (sem mover nada — o MC já saiu na reserva).
  for (const p of players) {
    if (p.side !== winnerSide) {
      const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, p.userId)).limit(1).for("update");
      const novoReservado = Math.max(0, (w?.mcReservado ?? 0) - aposta);
      await tx.update(userWallets).set({ mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, p.userId));
      await gravarLancamento(tx, p.userId, -aposta, "match_loss", matchId, w?.mc ?? 0);
    }
  }

  await tx.insert(platformRevenue).values({ matchId, mcFee: calc.taxa, mcFeeRounding: calc.resto });
}

/** Empate: devolve o reservado de todos, sem taxa. Sala vira `encerrada` com resultado 'draw'. */
export async function pagarEmpate(tx: any, matchId: string, aposta: number, players: { userId: string }[]) {
  for (const p of players) {
    await devolverEntrada(tx, p.userId, aposta, matchId);
  }
}

/** Cancelamento: devolve o reservado de todos, sem taxa. Sala vira `cancelada`. */
export async function pagarCancelamento(tx: any, matchId: string, aposta: number, players: { userId: string }[]) {
  for (const p of players) {
    await devolverEntrada(tx, p.userId, aposta, matchId);
  }
}
