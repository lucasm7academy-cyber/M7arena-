import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches } from "../../db/schema/matches.js";
import { walletTransactions, platformRevenue } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import {
  reservarEntrada,
  devolverEntrada,
  calcularPayout,
  pagarPremio,
  pagarEmpate,
  pagarCancelamento,
  reverterPayout,
} from "../src/lib/escrow.js";

/** Cria um usuário + wallet (FK de user_wallets exige o usuário). */
async function criaJogador(db: any, id: string, mc: number, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
  await db.insert(userWallets).values({ userId: id, mc, mcReservado });
}

/** Cria uma sala (FK de platform_revenue e match_players exigem a sala). */
async function criaSala(db: any, id: string, aposta = 30, status = "partida_iniciada") {
  const dono = "00000000-0000-0000-0000-00000000cafe";
  await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
  await db.insert(matches).values({
    id,
    gameId: "lol",
    mode: "5v5",
    createdBy: dono,
    status,
    apostaMc: aposta,
    taxaPct: "8.99",
  });
}

describe("escrow", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("reserva move mc -> mc_reservado e lança se saldo insuficiente", async () => {
    const db = ctx.db;
    await criaJogador(db, "11111111-1111-1111-1111-111111111111", 100);
    await reservarEntrada(db as any, "11111111-1111-1111-1111-111111111111", 30, "m1");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "11111111-1111-1111-1111-111111111111"));
    assert.equal(w.mc, 70);
    assert.equal(w.mcReservado, 30);

    await assert.rejects(
      () => reservarEntrada(db as any, "11111111-1111-1111-1111-111111111111", 100, "m2"),
      (e: any) => e.code === "SALDO_INSUFICIENTE"
    );
  });

  test("devolução move mc_reservado -> mc", async () => {
    const db = ctx.db;
    await criaJogador(db, "22222222-2222-2222-2222-222222222222", 50, 30);
    await devolverEntrada(db as any, "22222222-2222-2222-2222-222222222222", 30, "m1");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "22222222-2222-2222-2222-222222222222"));
    assert.equal(w.mc, 80);
    assert.equal(w.mcReservado, 0);
  });

  test("calcularPayout: taxa ceil, premio floor, resto para a plataforma", () => {
    const r = calcularPayout(100, 10, 8.99, 5);
    assert.equal(r.pote, 1000);
    assert.equal(r.taxa, 90);
    assert.equal(r.premioLiq, 910);
    assert.equal(r.porVencedor, 182);
    assert.equal(r.resto, 0);
  });

  test("calcularPayout: pote que não divide exato gera resto", () => {
    const r = calcularPayout(100, 10, 8.99, 3);
    assert.equal(r.taxa, 90);
    assert.equal(r.premioLiq, 910);
    assert.equal(r.porVencedor, 303);
    assert.equal(r.resto, 1);
  });

  test("calcularPayout: taxa inválida (negativa/>100) é clampada — nunca infla o pote (MORPH-002)", () => {
    // Taxa negativa faria premioLiq > pote (criaria MC do nada). Deve virar 0.
    const neg = calcularPayout(100, 10, -100, 5);
    assert.equal(neg.taxa, 0);
    assert.equal(neg.premioLiq, 1000); // igual ao pote, nunca maior

    // Taxa acima de 100% é absurda; clamp em 100.
    const alta = calcularPayout(100, 10, 500, 5);
    assert.ok(alta.taxa >= 900, `taxa clampada <= 100% (foi ${alta.taxa})`);

    // NaN é tratado como padrão 8.99.
    const nan = calcularPayout(100, 10, Number.NaN, 5);
    assert.equal(nan.taxa, 90);
  });

  test("pagarPremio: credita vencedores, debita nada (já reservado), taxa+resto na plataforma", async () => {
    const db = ctx.db;
    const players = [
      { userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", side: "blue" },
      { userId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", side: "blue" },
      { userId: "cccccccc-cccc-cccc-cccc-cccccccccccc", side: "blue" },
      { userId: "dddddddd-dddd-dddd-dddd-dddddddddddd", side: "red" },
      { userId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", side: "red" },
    ];
    await criaSala(db, "00000000-0000-0000-0000-000000000001");
    for (const p of players) {
      await criaJogador(db, p.userId, 70, 30);
    }
    await pagarPremio(db as any, "00000000-0000-0000-0000-000000000001", 30, players, "blue", 8.99);

    const [a] = await db.select().from(userWallets).where(eq(userWallets.userId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
    const [d] = await db.select().from(userWallets).where(eq(userWallets.userId, "dddddddd-dddd-dddd-dddd-dddddddddddd"));
    const calc = calcularPayout(30, 5, 8.99, 3);
    assert.equal(a.mc, 70 + calc.porVencedor);
    assert.equal(d.mc, 70);
    const [rev] = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, "00000000-0000-0000-0000-000000000001"));
    assert.equal(rev.mcFee, calc.taxa);
    assert.equal(rev.mcFeeRounding, calc.resto);
  });

  test("pagarEmpate: devolve o reservado de todos, sem taxa", async () => {
    const db = ctx.db;
    for (const u of ["ffffffff-ffff-ffff-ffff-ffffffffffff", "99999999-9999-9999-9999-999999999999"]) {
      await criaJogador(db, u, 50, 30);
    }
    await pagarEmpate(db as any, "00000000-0000-0000-0000-000000000002", 30, [
      { userId: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
      { userId: "99999999-9999-9999-9999-999999999999" },
    ]);
    const [f] = await db.select().from(userWallets).where(eq(userWallets.userId, "ffffffff-ffff-ffff-ffff-ffffffffffff"));
    assert.equal(f.mc, 80);
    assert.equal(f.mcReservado, 0);
    const revs = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, "00000000-0000-0000-0000-000000000002"));
    assert.equal(revs.length, 0);
  });

  test("pagarCancelamento: devolve o reservado de todos, sem taxa", async () => {
    const db = ctx.db;
    await criaJogador(db, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", 50, 30);
    await pagarCancelamento(db as any, "00000000-0000-0000-0000-000000000003", 30, [{ userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1" }]);
    const [h] = await db.select().from(userWallets).where(eq(userWallets.userId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"));
    assert.equal(h.mc, 80);
    assert.equal(h.mcReservado, 0);
  });

  test("pagarPremio grava match_prize e match_loss no ledger", async () => {
    const db = ctx.db;
    const txs = await db.select().from(walletTransactions);
    const kinds = txs.map((t) => t.kind);
    assert.ok(kinds.includes("match_prize"));
    assert.ok(kinds.includes("match_loss"));
  });

  test("reverterPayout: todos voltam ao saldo pré-aposta e estorna a taxa", async () => {
    const db = ctx.db;
    const v = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"; // vencedor blue
    const p = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3"; // perdedor red
    await db.insert(users).values({ id: v, email: v + "@x.com", displayName: "V" });
    await db.insert(userWallets).values({ userId: v, mc: 70, mcReservado: 0 });
    await db.insert(users).values({ id: p, email: p + "@x.com", displayName: "P" });
    await db.insert(userWallets).values({ userId: p, mc: 70, mcReservado: 0 });
    const salaId = "00000000-0000-0000-0000-000000000004";
    const dono = "00000000-0000-0000-0000-00000000cafe";
    await db.insert(matches).values({ id: salaId, gameId: "lol", mode: "1v1", createdBy: dono, status: "encerrada", apostaMc: 30, taxaPct: "8.99", winnerSide: "blue", resultado: "blue" });
    const players = [
      { userId: v, side: "blue" },
      { userId: p, side: "red" },
    ];
    // Fluxo real: reserva (70 -> 40 mc + 30 reservado) e depois payout.
    await reservarEntrada(db as any, v, 30, salaId);
    await reservarEntrada(db as any, p, 30, salaId);
    await pagarPremio(db as any, salaId, 30, players, "blue", 8.99);
    const calc = calcularPayout(30, 2, 8.99, 1);
    const [vPago] = await db.select().from(userWallets).where(eq(userWallets.userId, v));
    assert.equal(vPago.mc, 40 + calc.porVencedor, "vencedor recebeu o prêmio em cima da reserva");

    // Reverte: todos voltam ao pré-aposta (70, reservado 0).
    const r = await reverterPayout(db as any, salaId, 30, players, "blue", 8.99);
    assert.equal(r.ok, true);
    const [vPos] = await db.select().from(userWallets).where(eq(userWallets.userId, v));
    const [pPos] = await db.select().from(userWallets).where(eq(userWallets.userId, p));
    assert.equal(vPos.mc, 70, "vencedor volta ao pré-aposta");
    assert.equal(vPos.mcReservado, 0);
    assert.equal(pPos.mc, 70, "perdedor volta ao pré-aposta");
    assert.equal(pPos.mcReservado, 0);
    const revs = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, salaId));
    assert.equal(revs.length, 0, "taxa estornada");
  });

  test("reverterPayout: vencedor sem saldo → erro saldo_insuficiente", async () => {
    const db = ctx.db;
    const v = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4";
    const p = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5";
    await db.insert(users).values({ id: v, email: v + "@x.com", displayName: "V" });
    await db.insert(userWallets).values({ userId: v, mc: 0, mcReservado: 0 }); // gastou o prêmio
    await db.insert(users).values({ id: p, email: p + "@x.com", displayName: "P" });
    await db.insert(userWallets).values({ userId: p, mc: 70, mcReservado: 0 });
    const salaId = "00000000-0000-0000-0000-000000000005";
    const dono = "00000000-0000-0000-0000-00000000cafe";
    await db.insert(matches).values({ id: salaId, gameId: "lol", mode: "1v1", createdBy: dono, status: "encerrada", apostaMc: 30, taxaPct: "8.99", winnerSide: "blue", resultado: "blue" });
    const players = [{ userId: v, side: "blue" }, { userId: p, side: "red" }];
    await pagarPremio(db as any, salaId, 30, players, "blue", 8.99);

    // Vencedor gastou o prêmio antes do estorno: fica com menos do que o
    // porVencedor a devolver (54). O estorno precisa falhar com
    // saldo_insuficiente.
    const calc = calcularPayout(30, 2, 8.99, 1);
    await db.update(userWallets).set({ mc: calc.porVencedor - 1 }).where(eq(userWallets.userId, v));
    const r = await reverterPayout(db as any, salaId, 30, players, "blue", 8.99);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "saldo_insuficiente");
    assert.equal(r.userId, v);
  });

  test("reverterPayout: 2º vencedor sem saldo → rollback total, NADA persiste (contrato da rota)", async () => {
    const db = ctx.db;
    const w1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa61"; // vencedor blue com saldo
    const w2 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa62"; // vencedor blue que gastou o prêmio
    const l1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa63"; // perdedor red
    const l2 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa64"; // perdedor red
    const salaId = "00000000-0000-0000-0000-000000000006";
    const dono = "00000000-0000-0000-0000-00000000cafe"; // já existe (criado no 1º teste)
    for (const u of [w1, w2, l1, l2]) {
      await db.insert(users).values({ id: u, email: u + "@x.com", displayName: "Jogador" });
      await db.insert(userWallets).values({ userId: u, mc: 70, mcReservado: 0 });
    }
    await db.insert(matches).values({ id: salaId, gameId: "lol", mode: "5v5", createdBy: dono, status: "encerrada", apostaMc: 30, taxaPct: "8.99", winnerSide: "blue", resultado: "blue" });
    const players = [
      { userId: w1, side: "blue" },
      { userId: w2, side: "blue" },
      { userId: l1, side: "red" },
      { userId: l2, side: "red" },
    ];
    // Fluxo real: reserva → payout → vencedor 2 gastou o prêmio.
    for (const p of players) await reservarEntrada(db as any, p.userId, 30, salaId);
    await pagarPremio(db as any, salaId, 30, players, "blue", 8.99);
    const calc = calcularPayout(30, 4, 8.99, 2);
    assert.equal(calc.porVencedor, 54, "pote 120, taxa 11 → prêmio 109/2 vencedores = 54");
    const [w2Pago] = await db.select().from(userWallets).where(eq(userWallets.userId, w2));
    assert.equal(w2Pago.mc, 40 + calc.porVencedor, "vencedor 2 recebeu o prêmio em cima da reserva");
    await db.update(userWallets).set({ mc: calc.porVencedor - 1 }).where(eq(userWallets.userId, w2));

    // Contrato da rota (revisao.ts /disputas/:id/decidir): reverterPayout roda
    // dentro de transação; se um vencedor não tem saldo, o THROW no callback
    // faz o ROLLBACK — senão o w1 (estornado antes de achar o w2) ficaria
    // parcialmente revertido para sempre.
    await assert.rejects(
      () =>
        db.transaction(async (tx: any) => {
          const r = await reverterPayout(tx, salaId, 30, players, "blue", 8.99);
          if (!r.ok) throw Object.assign(new Error(r.erro), { userId: r.userId });
        }),
      (e: any) => e.message === "saldo_insuficiente" && e.userId === w2
    );

    // NADA persistiu: w1 NÃO foi estornado em parte, w2 não foi revertido,
    // perdedores não foram reembolsados e a taxa segue na plataforma.
    const [w1Pos] = await db.select().from(userWallets).where(eq(userWallets.userId, w1));
    const [w2Pos] = await db.select().from(userWallets).where(eq(userWallets.userId, w2));
    const [l1Pos] = await db.select().from(userWallets).where(eq(userWallets.userId, l1));
    const [l2Pos] = await db.select().from(userWallets).where(eq(userWallets.userId, l2));
    assert.equal(w1Pos.mc, 40 + calc.porVencedor, "vencedor 1 intocado (rollback desfez o estorno parcial)");
    assert.equal(w1Pos.mcReservado, 0);
    assert.equal(w2Pos.mc, calc.porVencedor - 1, "vencedor 2 continua como gastou");
    assert.equal(w2Pos.mcReservado, 0);
    assert.equal(l1Pos.mc, 40, "perdedor não reembolsado");
    assert.equal(l1Pos.mcReservado, 0);
    assert.equal(l2Pos.mc, 40, "perdedor não reembolsado");
    assert.equal(l2Pos.mcReservado, 0);
    const [rev] = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, salaId));
    assert.ok(rev, "taxa continua na plataforma");
    assert.equal(rev.mcFee, calc.taxa);
    assert.equal(rev.mcFeeRounding, calc.resto);
    const reverts = await db.select().from(walletTransactions).where(eq(walletTransactions.refId, salaId));
    const kinds = reverts.map((t: any) => t.kind);
    assert.ok(!kinds.includes("match_prize_revert"), "nenhum estorno persistiu no ledger");
  });
});
