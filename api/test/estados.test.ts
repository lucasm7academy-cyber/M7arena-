import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { walletTransactions, platformRevenue } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import { reservarEntrada, devolverEntrada, pagarPremio } from "../src/lib/escrow.js";
import { entrarEmRevisao, avaliarTransicoes } from "../src/lib/match-flow.js";

async function criaJogador(db: any, id: string, mc: number, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
  await db.insert(userWallets).values({ userId: id, mc, mcReservado });
}

async function criaSala(db: any, values: any = {}) {
  const dono = crypto.randomUUID();
  await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
  const [sala] = await db.insert(matches).values({
    gameId: "lol",
    mode: "5v5",
    createdBy: dono,
    status: "preenchendo",
    apostaMc: 0,
    taxaPct: "8.99",
    ...values,
  }).returning();
  return sala;
}

describe("máquina de estados com escrow", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("fluxo completo: criar com aposta -> reserva; sair -> devolve (invariante preservada)", async () => {
    const db = ctx.db;
    const criador = "aaaaaaa1-0000-0000-0000-000000000001";
    const segundo = "aaaaaaa1-0000-0000-0000-000000000002";
    await criaJogador(db, criador, 100);
    await criaJogador(db, segundo, 100);

    // criar sala com aposta 30 -> criador reserva 30
    const sala = await criaSala(db, { apostaMc: 30 });
    await reservarEntrada(db as any, criador, 30, sala.id);
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: criador, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true });

    // segundo jogador entra -> reserva 30
    await reservarEntrada(db as any, segundo, 30, sala.id);
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: segundo, side: "red", slot: 0, roleSlot: "TOP", confirmed: false });

    // conferir reserva de ambos
    const [wc] = await db.select().from(userWallets).where(eq(userWallets.userId, criador));
    const [ws] = await db.select().from(userWallets).where(eq(userWallets.userId, segundo));
    assert.equal(wc.mc, 70);
    assert.equal(wc.mcReservado, 30);
    assert.equal(ws.mc, 70);
    assert.equal(ws.mcReservado, 30);

    // segundo sai -> devolve
    await devolverEntrada(db as any, segundo, 30, sala.id);
    await db.delete(matchPlayers).where(and(eq(matchPlayers.matchId, sala.id), eq(matchPlayers.userId, segundo)));
    const [ws2] = await db.select().from(userWallets).where(eq(userWallets.userId, segundo));
    assert.equal(ws2.mc, 100);
    assert.equal(ws2.mcReservado, 0);

    // invariante: mc + reservado = saldo inicial para os dois
    const [wc2] = await db.select().from(userWallets).where(eq(userWallets.userId, criador));
    assert.equal(wc2.mc + wc2.mcReservado, 100);
    assert.equal(ws2.mc + ws2.mcReservado, 100);
  });

  test("entrarEmRevisao: só sala apostada em partida_iniciada; zera deadline", async () => {
    const db = ctx.db;
    const sala = await criaSala(db, {
      status: "partida_iniciada",
      apostaMc: 50,
      stateDeadlineAt: new Date(Date.now() + 60_000),
    });
    const r = await entrarEmRevisao(db as any, sala.id);
    assert.equal(r.ok, true);
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "aguardando_revisao");
    assert.ok(m.revisaoDesde);
    assert.equal(m.stateDeadlineAt, null);
  });

  test("entrarEmRevisao: sala casual (aposta 0) também entra em revisão", async () => {
    const db = ctx.db;
    const sala = await criaSala(db, { status: "partida_iniciada", apostaMc: 0 });
    const r = await entrarEmRevisao(db as any, sala.id);
    assert.equal(r.ok, true);
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "aguardando_revisao");
  });

  test("payout mantém invariante: pote = prize + taxa + resto; saldo total cai só pela taxa", async () => {
    const db = ctx.db;
    const ids = [
      "bbbbbbb1-0000-0000-0000-000000000001",
      "bbbbbbb1-0000-0000-0000-000000000002",
      "bbbbbbb1-0000-0000-0000-000000000003",
    ];
    const players = [
      { userId: ids[0], side: "blue" },
      { userId: ids[1], side: "blue" },
      { userId: ids[2], side: "red" },
    ];
    const sala = await criaSala(db, { status: "partida_iniciada", apostaMc: 30 });
    const saldoInicial = 100;
    for (const p of players) {
      await criaJogador(db, p.userId, saldoInicial - 30, 30);
    }
    await pagarPremio(db as any, sala.id, 30, players, "blue", 8.99);

    // pote = 90 (3x30); taxa ceil(8.091)=9; liq=81; 2 vencedores -> 40+40, resto 1
    const calc = { pote: 90, taxa: 9, premioLiq: 81, porVencedor: 40, resto: 1 };
    const total = [];
    for (const p of players) {
      const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, p.userId));
      total.push(w.mc + w.mcReservado);
    }
    const soma = total.reduce((a, b) => a + b, 0);
    // pote fecha exatamente: prize total + taxa + resto = 90
    assert.equal(calc.porVencedor * 2 + calc.taxa + calc.resto, calc.pote);
    // saldo dos jogadores cai apenas pela retenção da plataforma (taxa + resto)
    assert.equal(soma + calc.taxa + calc.resto, saldoInicial * 3);
    const revs = await db.select().from(platformRevenue);
    assert.equal(revs.length, 1);
  });

  test("ledger: um payout gera exatamente um match_prize por vencedor (sem duplicar)", async () => {
    // No PGlite o índice único parcial da migration não é criado pelo schema
    // de teste; aqui verificamos a contagem por partida isolada. A idempotência
    // real (2x chamada) depende da constraint idx_ledger_match_unico (0009).
    const db = ctx.db;
    const ids = [
      "ccccccc1-0000-0000-0000-000000000001",
      "ccccccc1-0000-0000-0000-000000000002",
    ];
    const players = [
      { userId: ids[0], side: "blue" },
      { userId: ids[1], side: "red" },
    ];
    const sala = await criaSala(db, { status: "partida_iniciada", apostaMc: 30 });
    for (const p of players) {
      await criaJogador(db, p.userId, 70, 30);
    }
    await pagarPremio(db as any, sala.id, 30, players, "blue", 8.99);
    const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.refId, sala.id));
    const prizes = txs.filter((t: any) => t.kind === "match_prize");
    assert.equal(prizes.length, 1);
    const losses = txs.filter((t: any) => t.kind === "match_loss");
    assert.equal(losses.length, 1);
  });

  test("regra de timer: preencher a ultima vaga seta confirmacaoExpiresAt = now + 60s", async () => {
    // Reforço do ajustarsala F2: o deadline é definido no SERVIDOR (now+60s),
    // nunca derivado do relógio de um cliente. Se isso falhar, clientes com
    // relógios diferentes divergem (bug B: 20s vs 75s).
    const db = ctx.db;
    const jogador1 = "ddddddd1-0000-0000-0000-000000000001";
    const jogador2 = "ddddddd1-0000-0000-0000-000000000002";
    await criaJogador(db, jogador1, 100, 0);
    await criaJogador(db, jogador2, 100, 0);

    const antes = Date.now();
    const sala = await criaSala(db, { status: "preenchendo", maxJogadores: 2, apostaMc: 0 });
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: jogador1, side: "blue", slot: 0, roleSlot: "TOP", confirmed: false });
    // Segundo jogador preenche a última vaga — isso dispara a transição.
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: jogador2, side: "red", slot: 0, roleSlot: "MID", confirmed: false });
    // A transição só roda explicitamente (na rota ela roda dentro do join).
    await avaliarTransicoes(db as any, sala.id);

    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "confirmacao");
    assert.ok(m.confirmacaoExpiresAt, "confirmacao_expires_at deve existir");
    const diff = new Date(m.confirmacaoExpiresAt).getTime() - antes;
    // Tolerância generosa: >=55s (latência do teste) e <70s.
    assert.ok(diff >= 55_000 && diff < 70_000, `deadline ~60s a partir do now do servidor (foi ${Math.round(diff / 1000)}s)`);
  });
});
