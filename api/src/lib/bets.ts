import { eq } from "drizzle-orm";
import { userWallets } from "../../../db/schema/identidade.js";
import { walletTransactions } from "../../../db/schema/economia.js";
import { betTickets, betLegs } from "../../../db/schema/bets.js";

/**
 * Aposta individual (self-bet) — negócio e economia.
 *
 * Modelo de "casa" (house): odd fixa, a plataforma paga `stake × odd` se a leg
 * acertar e retém o stake se errar. Não é escrow entre jogadores (como salas):
 * o prêmio sair do caixa da plataforma, então há teto de risco por bilhete.
 *
 * Reusa o invariante das salas (`mc + mc_reservado = total`, `mc` nunca
 * negativo) via `mc_reservado`: o stake fica congelado enquanto o bilhete está
 * aberto. É o mesmo mecanismo que a carteira exibe como "em partida".
 */

// ── Limites / constantes de negócio ──────────────────────────────────────────
export const BET_MIN_STAKE = 100; // mínimo MC por leg
export const BET_MAX_PAYOUT = 5000; // teto de payout por bilhete (risco da casa)
// Janela para DETECTAR a próxima partida ranqueada. Passou disso sem entrar em
// jogo → cancela e devolve o MC.
export const BET_LOCK_MS = 20 * 60 * 1000;
// Teto de espera da LIQUIDAÇÃO depois de detectada a partida (partida fantasma:
// o jogo pode não terminar / não ser encontrada no match-v5).
export const BET_FANTASMA_MS = 3 * 60 * 60 * 1000;

// Queue da Riot por tipo de fila ranqueada.
export const QUEUE_SOLO = 420;
export const QUEUE_FLEX = 440;
// Região (prefixo do matchId Riot). O projeto é BR (ver riot.ts platform URL).
export const PLATFORM_PREFIX = "BR1";

// ── Catálogo de mercados ──────────────────────────────────────────────────────
// Cada mercado tem uma `resolve(info, puuid)` que devolve true/false, ou null
// para "não dá para liquidar" (vira anulada + devolve o stake). A odd fica na
// config; o bilhete guarda um snapshot, então mudar aqui não altera bets feitas.

export type MarketGroup = "resultado" | "kills" | "first_blood";
export type MarketVerdict = boolean | null;

export interface BetMarket {
  key: string;
  label: string;
  group: MarketGroup;
  odd: number;
  // (payloadDoMatch_v5, puuidDoJogador) -> verdict. null = void/anulada.
  resolve: (info: any, puuid: string) => MarketVerdict;
}

function partDoJogador(info: any, puuid: string): any | null {
  return info?.participants?.find((p: any) => p.puuid === puuid) ?? null;
}

/** Gera o mercado "Kills > N" (over). */
function killsOver(threshold: number): BetMarket {
  return {
    key: `kills_over_${threshold}`,
    label: `Matar mais de ${threshold} abates`,
    group: "kills",
    odd: OVER_ODDS[threshold] ?? 1.2,
    resolve: (info, puuid) => {
      const p = partDoJogador(info, puuid);
      if (!p) return null;
      if (typeof p.kills !== "number") return null;
      return p.kills > threshold;
    },
  };
}

/** Gera o mercado "Kills ≤ N" (under). */
function killsUnder(threshold: number): BetMarket {
  return {
    key: `kills_under_${threshold}`,
    label: `Matar até ${threshold} de abates`,
    group: "kills",
    odd: UNDER_ODDS[threshold] ?? 1.2,
    resolve: (info, puuid) => {
      const p = partDoJogador(info, puuid);
      if (!p) return null;
      if (typeof p.kills !== "number") return null;
      return p.kills <= threshold;
    },
  };
}

// Odd por faixa de Kills (over/under), escolher a fatia que a casa paga.
const OVER_ODDS: Record<number, number> = {
  7: 1.35, 8: 1.28, 9: 1.22, 10: 1.18, 12: 1.12, 13: 1.08,
};
const UNDER_ODDS: Record<number, number> = {
  6: 1.6, 8: 1.4, 10: 1.25, 12: 1.15,
};

export const BET_MARKETS: BetMarket[] = [
  // Resultado
  { key: "result_vitoria", label: "Vitória", group: "resultado", odd: 1.35, resolve: (info, puuid) => { const p = partDoJogador(info, puuid); if (!p) return null; return p.win === true; } },
  { key: "result_derrota", label: "Derrota", group: "resultado", odd: 2.6, resolve: (info, puuid) => { const p = partDoJogador(info, puuid); if (!p) return null; return p.win === false; } },
  // Kills over/under
  killsOver(7), killsOver(8), killsOver(9), killsOver(10), killsOver(12), killsOver(13),
  killsUnder(6), killsUnder(8), killsUnder(10), killsUnder(12),
  // First blood
  { key: "first_blood_sim", label: "First Blood", group: "first_blood", odd: 1.2, resolve: (info, puuid) => { const p = partDoJogador(info, puuid); if (!p) return null; return p.firstBloodKill === true; } },
  { key: "first_blood_nao", label: "Sem First Blood", group: "first_blood", odd: 1.2, resolve: (info, puuid) => { const p = partDoJogador(info, puuid); if (!p) return null; return p.firstBloodKill === false; } },
];

const MARKET_MAP = new Map(BET_MARKETS.map((m) => [m.key, m]));

export function getMarket(key: string): BetMarket | undefined {
  return MARKET_MAP.get(key);
}

export function getMarketsByGroup(): Record<MarketGroup, BetMarket[]> {
  return {
    resultado: BET_MARKETS.filter((m) => m.group === "resultado"),
    kills: BET_MARKETS.filter((m) => m.group === "kills"),
    first_blood: BET_MARKETS.filter((m) => m.group === "first_blood"),
  };
}

/** Payout esperado = stake × odd, arredondado para baixo (nunca supera o teto). */
export function payoutFor(stake: number, odd: number): number {
  return Math.floor(stake * odd);
}

// ── Economia do bilhete (mc_reservado, reaproveita o invariante das salas) ────

/** Congela o stake: mc -> mc_reservado. Lança SALDO_INSUFICIENTE se faltar. */
export async function reservarStake(tx: any, userId: string, stake: number, ticketId: string) {
  if (!stake || stake <= 0) return;
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  if (!w || w.mc < stake) {
    const err: any = new Error("saldo_insuficiente");
    err.code = "SALDO_INSUFICIENTE";
    throw err;
  }
  const novoMc = w.mc - stake;
  const novoReservado = (w.mcReservado ?? 0) + stake;
  await tx.update(userWallets).set({ mc: novoMc, mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, userId));
  await gravarLancamento(tx, userId, -stake, "bet_entry_reserve", ticketId, novoMc);
}

/** Devolve o stake: mc_reservado -> mc. No-op se nada tenso reservado (idempotente). */
export async function devolverStake(tx: any, userId: string, stake: number, ticketId: string) {
  if (!stake || stake <= 0) return;
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  const reservadoAtual = w?.mcReservado ?? 0;
  if (reservadoAtual < stake) return;
  const novoMc = (w?.mc ?? 0) + stake;
  const novoReservado = Math.max(0, reservadoAtual - stake);
  await tx.update(userWallets).set({ mc: novoMc, mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, userId));
  await gravarLancamento(tx, userId, stake, "bet_refund", ticketId, novoMc);
}

/**
 * Liquida uma leg GANHA: credita o payout (mc += stake × odd) e libera a
 * reserva do stake. O resultado do bilhete é decidido no serviço (live-bets).
 */
export async function pagarLeg(tx: any, userId: string, stake: number, payout: number, ticketId: string) {
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  const novoMc = (w?.mc ?? 0) + payout;
  const novoReservado = Math.max(0, (w?.mcReservado ?? 0) - stake);
  await tx.update(userWallets).set({ mc: novoMc, mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, userId));
  await gravarLancamento(tx, userId, payout, "bet_prize", ticketId, novoMc);
}

/** Liquida uma leg PERDIDA: libera a reserva do stake, sem creditar nada. */
export async function perderLeg(tx: any, userId: string, stake: number, ticketId: string) {
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  const novoReservado = Math.max(0, (w?.mcReservado ?? 0) - stake);
  await tx.update(userWallets).set({ mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, userId));
  await gravarLancamento(tx, userId, -stake, "bet_loss", ticketId, w?.mc ?? 0);
}

/** Lança uma linha no ledger (auditoria), refType 'bet'. */
export async function gravarLancamento(tx: any, userId: string, amount: number, kind: string, ticketId: string, balanceAfter: number) {
  await tx.insert(walletTransactions).values({
    userId,
    currency: "mc",
    amount,
    kind,
    refType: "bet",
    refId: ticketId,
    balanceAfter,
  });
}

// ── Helpers de montagem / validação do bilhete ────────────────────────────────

export interface LegInput {
  marketKey: string;
  stake: number;
}

export type ValidacaoBilhete =
  | { ok: true; legs: { marketKey: string; odd: number; stake: number; payout: number }[]; stakeTotal: number }
  | { ok: false; erro: string; faltam?: number };

/**
 * Valida o conjunto de legs: mercado existe, stake inteiro positivo, >= mínimo
 * e a SOMA dos payout (stake × odd) não passa do teto de risco da casa.
 * Devolve o snapshot para gravar, ou um erro ajustável para a rota.
 */
export function validarBilhete(legs: LegInput[]): ValidacaoBilhete {
  if (!Array.isArray(legs) || legs.length === 0) return { ok: false, erro: "sem_legs" };
  if (legs.length > 20) return { ok: false, erro: "legs_demais" };

  const resolvidos: { marketKey: string; odd: number; stake: number; payout: number }[] = [];
  let stakeTotal = 0;
  let payoutTotal = 0;
  // Mercados do mesmo GRUPO são mutuamente exclusivos (ADR-050): não pode
  // apostar em Vitória e Derrota ao mesmo tempo, nem em kills_over_7 e
  // kills_over_9 — são "o mesmo mercado", lados/faixas diferentes de um único
  // evento. Um grupo por bilhete.
  const gruposUsados = new Set<MarketGroup>();

  for (const leg of legs) {
    const market = getMarket(leg.marketKey);
    if (!market) return { ok: false, erro: "mercado_invalido" };
    if (gruposUsados.has(market.group)) return { ok: false, erro: "mercados_conflitantes" };
    gruposUsados.add(market.group);
    const stake = Number(leg.stake);
    if (!Number.isFinite(stake) || stake <= 0 || !Number.isInteger(stake)) {
      return { ok: false, erro: "stake_invalido" };
    }
    if (stake < BET_MIN_STAKE) return { ok: false, erro: "stake_minimo_nao_atingido" };
    const payout = payoutFor(stake, Number(market.odd));
    resolvidos.push({ marketKey: market.key, odd: Number(market.odd), stake, payout });
    stakeTotal += stake;
    payoutTotal += payout;
  }

  if (payoutTotal > BET_MAX_PAYOUT) return { ok: false, erro: "payout_teto_excedido" };
  if (stakeTotal > BET_MAX_PAYOUT) return { ok: false, erro: "payout_teto_excedido" };

  return { ok: true, legs: resolvidos, stakeTotal };
}

// ── Shape que a API devolve ao front ─────────────────────────────────────────
export interface ShapeLeg {
  id: string;
  marketKey: string;
  label: string;
  odd: string;
  stake: number;
  payout: number;
  status: string;
}

export interface ShapeTicket {
  id: string;
  queue: string;
  status: string;
  resultado: string | null;
  stakeTotal: number;
  legs: ShapeLeg[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  endedAt: string | null;
}

export function shapeTicket(t: any, legs: any[]): ShapeTicket {
  return {
    id: t.id,
    queue: t.queue,
    status: t.status,
    resultado: t.resultado ?? null,
    stakeTotal: t.stakeTotal ?? 0,
    legs: legs.map((l) => {
      const market = getMarket(l.marketKey);
      return {
        id: l.id,
        marketKey: l.marketKey,
        label: market?.label ?? l.marketKey,
        odd: String(l.odd),
        stake: l.stake,
        payout: l.payout ?? 0,
        status: l.status,
      };
    }),
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : new Date(t.createdAt).toISOString(),
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : new Date(t.updatedAt).toISOString(),
    expiresAt: t.expiresAt instanceof Date ? t.expiresAt.toISOString() : new Date(t.expiresAt).toISOString(),
    endedAt: t.endedAt ? (t.endedAt instanceof Date ? t.endedAt.toISOString() : new Date(t.endedAt).toISOString()) : null,
  };
}

export { betTickets, betLegs };
