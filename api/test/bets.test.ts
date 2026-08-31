import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { gameAccounts } from "../../db/schema/games.js";
import { setupDb } from "./helpers.js";
import { betTickets, betLegs } from "../../db/schema/bets.js";
import {
  validarBilhete,
  reservarStake,
  devolverStake,
  pagarLeg,
  perderLeg,
  getMarket,
  getMarketsByGroup,
  payoutFor,
  BET_MIN_STAKE,
  QUEUE_SOLO,
  QUEUE_FLEX,
} from "../src/lib/bets.js";
import { detectarPartida, liquidarPartida, jogadorEmJogo } from "../src/lib/live-bets.js";
import { walletTransactions } from "../../db/schema/economia.js";

let seq = 0;
/** Cria um usuário + conta Riot (com puuid) + wallet. */
async function criaJogador(db: any, id: string, mc: number, puuid: string, mcReservado = 0) {
  seq++;
  const tag = `T${seq.toString().padStart(4, "0")}`;
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador", riotId: `Game#${tag}` });
  await db.insert(gameAccounts).values({ userId: id, gameId: "lol", externalId: puuid || `puuid-${seq}`, handle: `Game#${tag}` });
  await db.insert(userWallets).values({ userId: id, mc, mcReservado });
}

describe("bets: catálogo e validação", () => {
  test("catálogo tem resultado, kills over/under e first blood", () => {
    const g = getMarketsByGroup();
    assert.ok(g.resultado.some((m) => m.key === "result_vitoria"));
    assert.ok(g.kills.some((m) => m.key === "kills_over_13"));
    assert.ok(g.kills.some((m) => m.key === "kills_under_10"));
    assert.ok(g.first_blood.some((m) => m.key === "first_blood_sim"));
  });

  test("payoutFor = floor(stake × odd)", () => {
    assert.equal(payoutFor(100, 1.35), 135);
    assert.equal(payoutFor(150, 1.2), 180);
    assert.equal(payoutFor(100, 2.6), 260);
  });

  test("validação: aceita legs válidos e soma stake/payout", () => {
    const r = validarBilhete([
      { marketKey: "result_vitoria", stake: 100 },
      { marketKey: "kills_over_10", stake: 200 },
    ]);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.stakeTotal, 300);
      assert.equal(r.legs.length, 2);
      assert.equal(r.legs[0].payout, 135); // 100 × 1.35
      assert.equal(r.legs[1].payout, payoutFor(200, getMarket("kills_over_10")!.odd));
    }
  });

  test("validação: mercado inexistente", () => {
    const r = validarBilhete([{ marketKey: "nao_existe", stake: 100 }]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.erro, "mercado_invalido");
  });

  test("validação: stake abaixo do mínimo", () => {
    const r = validarBilhete([{ marketKey: "result_vitoria", stake: BET_MIN_STAKE - 1 }]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.erro, "stake_minimo_nao_atingido");
  });

  test("validação: sem legs", () => {
    const r = validarBilhete([]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.erro, "sem_legs");
  });

  test("validação: teto de payout não pode passar de 5000", () => {
    // 20 legs de 300 MC a 1.35x = 8100 de payout -> teto excedido.
    const legs = Array.from({ length: 20 }, () => ({ marketKey: "result_vitoria", stake: 300 }));
    const r = validarBilhete(legs);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.erro, "payout_teto_excedido");
  });
});

describe("bets: economia do bilhete (escrow em mc_reservado)", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("reservarStake move mc -> mc_reservado", async () => {
    const db = ctx.db;
    await criaJogador(db, "11111111-1111-1111-1111-111111111111", 500, "puuid-1");
    await reservarStake(db as any, "11111111-1111-1111-1111-111111111111", 200, "t1");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "11111111-1111-1111-1111-111111111111"));
    assert.equal(w.mc, 300);
    assert.equal(w.mcReservado, 200);
  });

  test("reservarStake lança SALDO_INSUFICIENTE", async () => {
    const db = ctx.db;
    await assert.rejects(
      () => reservarStake(db as any, "11111111-1111-1111-1111-111111111111", 9999, "t2"),
      (e: any) => e.code === "SALDO_INSUFICIENTE"
    );
  });

  test("devolverStake move mc_reservado -> mc (idempotente)", async () => {
    const db = ctx.db;
    await criaJogador(db, "22222222-2222-2222-2222-222222222222", 100, "puuid-2", 200);
    await devolverStake(db as any, "22222222-2222-2222-2222-222222222222", 200, "t3");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "22222222-2222-2222-2222-222222222222"));
    assert.equal(w.mc, 300);
    assert.equal(w.mcReservado, 0);
    // Idempotente: não cria MC do nada.
    await devolverStake(db as any, "22222222-2222-2222-2222-222222222222", 200, "t3");
    const [w2] = await db.select().from(userWallets).where(eq(userWallets.userId, "22222222-2222-2222-2222-222222222222"));
    assert.equal(w2.mc, 300);
  });

  test("pagarLeg credita payout e libera a reserva", async () => {
    const db = ctx.db;
    await criaJogador(db, "33333333-3333-3333-3333-333333333333", 100, "puuid-3", 200);
    await pagarLeg(db as any, "33333333-3333-3333-3333-333333333333", 200, 260, "t4");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "33333333-3333-3333-3333-333333333333"));
    assert.equal(w.mc, 360); // 100 + 260
    assert.equal(w.mcReservado, 0);
  });

  test("perderLeg libera a reserva sem creditar (stake fica retido)", async () => {
    const db = ctx.db;
    await criaJogador(db, "44444444-4444-4444-4444-444444444444", 100, "puuid-4", 200);
    await perderLeg(db as any, "44444444-4444-4444-4444-444444444444", 200, "t5");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "44444444-4444-4444-4444-444444444444"));
    assert.equal(w.mc, 100); // sem crédito
    assert.equal(w.mcReservado, 0);
  });

  test("ledger grava bet_prize, bet_loss, bet_refund com refType bet", async () => {
    const db = ctx.db;
    const kinds = (await db.select().from(walletTransactions)).map((t: any) => t.kind);
    assert.ok(kinds.includes("bet_prize"));
    assert.ok(kinds.includes("bet_loss"));
    assert.ok(kinds.includes("bet_refund"));
    assert.ok(kinds.includes("bet_entry_reserve"));
    const btxs = await db.select().from(walletTransactions).where(eq(walletTransactions.refType, "bet"));
    assert.ok(btxs.length > 0);
  });
});

// ── Fase de detecção e liquidação ─────────────────────────────────────────────
describe("bets: fluxo de detecção + liquidação (self-bet)", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  async function criaBilhete(db: any, userId: string, queue: string, marketKey: string, stake: number, agora = new Date()) {
    const expiresAt = new Date(agora.getTime() + 20 * 60 * 1000);
    const [t] = await db
      .insert(betTickets)
      .values({ userId, queue, status: "aguardando", stakeTotal: stake, expiresAt, summonerId: "encSummoner123", createdAt: agora, updatedAt: agora })
      .returning();
    const [legs] = await db
      .insert(betLegs)
      .values({ ticketId: t.id, marketKey, odd: String(getMarket(marketKey)!.odd), stake, payout: payoutFor(stake, getMarket(marketKey)!.odd) })
      .returning();
    return { ticket: t, leg: legs };
  }

  test("detectarPartida trava em_jogo quando o jogador está em ranqueada", async () => {
    const db = ctx.db;
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0011";
    await criaJogador(db, uid, 500, "puuid-a011");
    const { ticket } = await criaBilhete(db, uid, "solo", "result_vitoria", 100);

    const agora = new Date();
    await db.update(betTickets).set({ createdAt: new Date(Date.now() - 60 * 1000) }).where(eq(betTickets.id, ticket.id));
    // Espectador: jogador em jogo solo (420), começou depois do ticket.
    const spectatorPayload = { status: 200, gameId: 987654321, gameQueueConfigId: QUEUE_SOLO, gameStartTime: Date.now() - 30 * 1000 };
    const r = await detectarPartida(db, ticket.id, {
      agora,
      buscarIdsRiot: async () => spectatorPayload,
    });
    assert.equal(r.estado, "em_jogo");

    const [t2] = await db.select().from(betTickets).where(eq(betTickets.id, ticket.id));
    assert.equal(t2.status, "em_jogo");
    assert.equal(t2.matchRiotId, "BR1_987654321");
    assert.equal(t2.queueId, QUEUE_SOLO);
  });

  test("detectarPartida não trava fila errada (espera ranqueada certa)", async () => {
    const db = ctx.db;
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0012";
    await criaJogador(db, uid, 500, "puuid-a012");
    const { ticket } = await criaBilhete(db, uid, "flex", "result_vitoria", 100);
    await db.update(betTickets).set({ createdAt: new Date(Date.now() - 60 * 1000) }).where(eq(betTickets.id, ticket.id));
    // Jogador em jogo SOLO (420), mas bilhete é FLEX (440): não trava.
    const spectatorPayload = { status: 200, gameId: 11, gameQueueConfigId: QUEUE_SOLO, gameStartTime: Date.now() - 30 * 1000 };
    const r = await detectarPartida(db, ticket.id, { agora: new Date(), buscarIdsRiot: async () => spectatorPayload });
    assert.equal(r.estado, "aguardando");
  });

  test("detectarPartida cancela por timeout sem jogo", async () => {
    const db = ctx.db;
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0013";
    await criaJogador(db, uid, 500, "puuid-a013");
    const { ticket } = await criaBilhete(db, uid, "solo", "result_vitoria", 100);
    // Ticket criado há 30min (além do lock de 20min) e sem jogo detectado.
    await db.update(betTickets).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(betTickets.id, ticket.id));
    const r = await detectarPartida(db, ticket.id, { agora: new Date(), buscarIdsRiot: async () => null });
    assert.equal(r.estado, "cancelada");
    const [t2] = await db.select().from(betTickets).where(eq(betTickets.id, ticket.id));
    assert.equal(t2.status, "cancelada");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mcReservado, 0, "stake devolvido ao cancelar");
  });

  test("detectarPartida ignora partida que já estava em andamento (anti-fraude)", async () => {
    const db = ctx.db;
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0014";
    const agora = new Date();
    await criaJogador(db, uid, 500, "puuid-a014");
    const { ticket } = await criaBilhete(db, uid, "solo", "result_vitoria", 100, agora);
    // Jogo começou há 10min, MUITO antes da criação do ticket (que é `agora`):
    // a tolerância de 2min exclui a partida (começou antes da aposta).
    const spectatorPayload = { status: 200, gameId: 22, gameQueueConfigId: QUEUE_SOLO, gameStartTime: agora.getTime() - 10 * 60 * 1000 };
    const r = await detectarPartida(db, ticket.id, { agora, buscarIdsRiot: async () => spectatorPayload });
    assert.equal(r.estado, "aguardando");
  });

  test("jogadorEmJogo detecta partida ativa (anti-fraude na criação)", async () => {
    const db = ctx.db;
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0019";
    await criaJogador(db, uid, 500, "puuid-a019");
    // Espectador retorna jogo ativo (qualquer fila) → emJogo = payload.
    const payload = { status: 200, gameId: 999, gameQueueConfigId: QUEUE_SOLO };
    const emJogo = await jogadorEmJogo(db, uid, {
      buscarSummoner: async () => "encSummonerTest",
      buscarGame: async () => payload,
    });
    assert.ok(emJogo, "detectou que o jogador está em jogo");
    assert.equal(emJogo.gameId, 999);
  });

  test("jogadorEmJogo retorna null quando não está em jogo", async () => {
    const db = ctx.db;
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0020";
    await criaJogador(db, uid, 500, "puuid-a020");
    const emJogo = await jogadorEmJogo(db, uid, {
      buscarSummoner: async () => "encSummonerTest",
      buscarGame: async () => null,
    });
    assert.equal(emJogo, null);
  });

  test("liquidarPartida paga leg ganha (vitória) e libera reserva", async () => {
    const db = ctx.db;
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0015";
    await criaJogador(db, uid, 500, "puuid-a015");
    const { ticket, leg } = await criaBilhete(db, uid, "solo", "result_vitoria", 100);
    await db.update(betTickets).set({ status: "em_jogo", matchRiotId: "BR1_555" }).where(eq(betTickets.id, ticket.id));

    // match-v5: jogador venceu a partida.
    const matchPayload = {
      info: {
        endOfGameResult: "GameComplete",
        gameEndTimestamp: Date.now(),
        participants: [{ puuid: "puuid-a015", win: true, kills: 14, firstBloodKill: true }],
      },
    };
    const r = await liquidarPartida(db, ticket.id, { agora: new Date(), buscarMatch: async () => matchPayload });
    assert.equal(r.estado, "finalizada");
    assert.equal(r.motivo, "ganha");

    const [t2] = await db.select().from(betTickets).where(eq(betTickets.id, ticket.id));
    assert.equal(t2.status, "finalizada");
    assert.equal(t2.resultado, "ganha");
    const [leg2] = await db.select().from(betLegs).where(eq(betLegs.id, leg.id));
    assert.equal(leg2.status, "ganha");
    // Payout = 100 × 1.35 = 135. Saldo: 500 (nunca reservado) + 135.
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mc, 635);
    assert.equal(w.mcReservado, 0);
  });

  test("liquidarPartida liquida leg perdida (derrota) e retém stake", async () => {
    const db = ctx.db;
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0016";
    await criaJogador(db, uid, 500, "puuid-a016");
    const { ticket, leg } = await criaBilhete(db, uid, "solo", "result_derrota", 100);
    await db.update(betTickets).set({ status: "em_jogo", matchRiotId: "BR1_556" }).where(eq(betTickets.id, ticket.id));

    const matchPayload = {
      info: {
        endOfGameResult: "GameComplete",
        gameEndTimestamp: Date.now(),
        participants: [{ puuid: "puuid-a016", win: true, kills: 5, firstBloodKill: false }],
      },
    };
    const r = await liquidarPartida(db, ticket.id, { agora: new Date(), buscarMatch: async () => matchPayload });
    assert.equal(r.estado, "finalizada");
    assert.equal(r.motivo, "perdida");
    const [leg2] = await db.select().from(betLegs).where(eq(betLegs.id, leg.id));
    assert.equal(leg2.status, "perdida");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mc, 500, "nada creditado");
    assert.equal(w.mcReservado, 0);
  });

  test("liquidarPartida anula leg quando o jogador não está na partida", async () => {
    const db = ctx.db;
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0017";
    await criaJogador(db, uid, 500, "puuid-a017");
    const { ticket, leg } = await criaBilhete(db, uid, "flex", "first_blood_sim", 100);
    await db.update(betTickets).set({ status: "em_jogo", matchRiotId: "BR1_557" }).where(eq(betTickets.id, ticket.id));

    const matchPayload = {
      info: {
        endOfGameResult: "GameComplete",
        gameEndTimestamp: Date.now(),
        participants: [{ puuid: "outro-jogador", win: true, kills: 3, firstBloodKill: true }],
      },
    };
    const r = await liquidarPartida(db, ticket.id, { agora: new Date(), buscarMatch: async () => matchPayload });
    assert.equal(r.estado, "anulada");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mc, 500, "stake devolvido na anulação");
    assert.equal(w.mcReservado, 0);
  });

  test("liquidarPartida não liquida partida ainda em jogo", async () => {
    const db = ctx.db;
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0018";
    const agora = new Date();
    await criaJogador(db, uid, 500, "puuid-a018");
    const { ticket } = await criaBilhete(db, uid, "solo", "result_vitoria", 100, agora);

    // Em jogo há pouco tempo (updatedAt = agora): longe de 3h de fantasma.
    await db.update(betTickets).set({ status: "em_jogo", matchRiotId: "BR1_558", updatedAt: agora }).where(eq(betTickets.id, ticket.id));

    // match sem gameEndTimestamp/endOfGameResult → ainda não terminou.
    const matchPayload = {
      info: {
        participants: [{ puuid: "puuid-a018", win: true, kills: 3, firstBloodKill: false }],
      },
    };
    const r = await liquidarPartida(db, ticket.id, { agora, buscarMatch: async () => matchPayload });
    assert.equal(r.estado, "em_jogo");
    const [t2] = await db.select().from(betTickets).where(eq(betTickets.id, ticket.id));
    assert.equal(t2.status, "em_jogo");
  });
});
