import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { matchDisputas, matchPrints } from "../../db/schema/apostas.js";
import { walletTransactions, platformRevenue } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import { abrirDisputa, listarDisputas } from "../src/routes/disputas.js";
import { pagarPremio, calcularPayout } from "../src/lib/escrow.js";

async function criaJogador(db: any, id: string, mc = 100, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador " + id.slice(0, 6) });
  await db.insert(userWallets).values({ userId: id, mc, mcReservado });
}

async function criaSalaEmRevisao(db: any, dono: string, aposta = 30) {
  const [sala] = await db
    .insert(matches)
    .values({
      gameId: "lol",
      mode: "5v5",
      createdBy: dono,
      status: "aguardando_revisao",
      apostaMc: aposta,
      taxaPct: "8.99",
      revisaoDesde: new Date(),
    })
    .returning();
  return sala;
}

describe("disputas (contestação de resultado, design v3 §6.1)", () => {
  let ctx: any;
  let db: any;

  before(async () => {
    ctx = await setupDb();
    db = ctx.db;
  });
  after(async () => {
    await ctx.client.close();
  });

  test("participante abre contestação em sala em revisão", async () => {
    const dono = "d1001000-0000-0000-0000-000000000001";
    await criaJogador(db, dono);
    const sala = await criaSalaEmRevisao(db, dono);
    await db.insert(matchPlayers).values({
      matchId: sala.id, userId: dono, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true,
    });

    const r = await abrirDisputa(db, { userId: dono, matchId: sala.id, motivo: "O print mostra que nós ganhamos" });
    assert.equal(r.ok, true);

    const lista = await listarDisputas(db, sala.id);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].nomeJogador, "Jogador " + dono.slice(0, 6));
    assert.equal(lista[0].status, "aberta");
    assert.equal(lista[0].motivo, "O print mostra que nós ganhamos");
  });

  test("2ª contestação do mesmo jogador é rejeitada (constraint UNIQUE)", async () => {
    const dono = "d1002000-0000-0000-0000-000000000001";
    await criaJogador(db, dono);
    const sala = await criaSalaEmRevisao(db, dono);
    await db.insert(matchPlayers).values({
      matchId: sala.id, userId: dono, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true,
    });

    await abrirDisputa(db, { userId: dono, matchId: sala.id, motivo: "Primeira contestação" });
    const r2 = await abrirDisputa(db, { userId: dono, matchId: sala.id, motivo: "Segunda contestação" });
    assert.equal(r2.ok, false);
    assert.equal(r2.erro, "ja_contestou");

    const lista = await listarDisputas(db, sala.id);
    assert.equal(lista.length, 1);
  });

  test("não-participante é rejeitado", async () => {
    const dono = "d1003000-0000-0000-0000-000000000001";
    const fora = "d1003000-0000-0000-0000-000000000002";
    await criaJogador(db, dono);
    await criaJogador(db, fora);
    const sala = await criaSalaEmRevisao(db, dono);
    await db.insert(matchPlayers).values({
      matchId: sala.id, userId: dono, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true,
    });

    const r = await abrirDisputa(db, { userId: fora, matchId: sala.id, motivo: "Quero contestar também" });
    assert.equal(r.ok, false);
    assert.equal(r.erro, "nao_participante");
  });

  test("motivo curto é rejeitado e sala fora de revisão também", async () => {
    const dono = "d1004000-0000-0000-0000-000000000001";
    await criaJogador(db, dono);
    const sala = await criaSalaEmRevisao(db, dono);
    await db.insert(matchPlayers).values({
      matchId: sala.id, userId: dono, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true,
    });

    const curto = await abrirDisputa(db, { userId: dono, matchId: sala.id, motivo: "ai" });
    assert.equal(curto.ok, false);
    assert.equal(curto.erro, "motivo_invalido");

    await db.update(matches).set({ status: "partida_iniciada" }).where(eq(matches.id, sala.id));
    const foraDeRevisao = await abrirDisputa(db, { userId: dono, matchId: sala.id, motivo: "Sala não está mais em revisão" });
    assert.equal(foraDeRevisao.ok, false);
    assert.equal(foraDeRevisao.erro, "estado_invalido");
  });

  test("decisão do admin segue funcionando com prints e disputas presentes (não regride)", async () => {
    const admin = "d1005000-0000-0000-0000-000000000001";
    const a = "d1005000-0000-0000-0000-000000000010";
    const b = "d1005000-0000-0000-0000-000000000011";
    await db.insert(users).values({ id: admin, email: admin + "@x.com", displayName: "Admin" });
    await criaJogador(db, a, 70, 30);
    await criaJogador(db, b, 70, 30);

    const sala = await criaSalaEmRevisao(db, a, 30);
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true });
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: b, side: "red", slot: 0, roleSlot: "TOP", confirmed: true });

    // Sala "suja": 1 print de cada lado + 1 disputa aberta
    await db.insert(matchPrints).values({ matchId: sala.id, userId: a, url: `/uploads/match-prints/${sala.id}/a.png` });
    await db.insert(matchPrints).values({ matchId: sala.id, userId: b, url: `/uploads/match-prints/${sala.id}/b.png` });
    await abrirDisputa(db, { userId: b, matchId: sala.id, motivo: "Disputa aberta para pesar a decisão" });

    // Mesma sequência do endpoint /decidir: aprovar blue
    const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id)).limit(1);
    assert.equal(m.status, "aguardando_revisao");
    await pagarPremio(db as any, sala.id, m.apostaMc ?? 0, players, "blue", Number(m.taxaPct ?? 8.99));
    await db.update(matches).set({
      status: "encerrada",
      resultado: "blue",
      decisaoId: "d000dec0-0000-0000-0000-000000000001",
      revisadoPor: admin,
      revisadoEm: new Date(),
      endedAt: new Date(),
    }).where(eq(matches.id, sala.id));

    const [aPos] = await db.select().from(userWallets).where(eq(userWallets.userId, a));
    const calc = calcularPayout(30, 2, 8.99, 1);
    assert.equal(aPos.mc, 70 + calc.porVencedor);
    const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.refId, sala.id));
    assert.equal(txs.filter((t: any) => t.kind === "match_prize").length, 1);
    assert.equal(txs.filter((t: any) => t.kind === "match_loss").length, 1);
    const revs = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, sala.id));
    assert.ok(revs.length >= 1);

    // Prints e disputas permanecem para auditoria após a decisão
    const prints = await db.select().from(matchPrints).where(eq(matchPrints.matchId, sala.id));
    assert.equal(prints.length, 2);
    const disputas = await db.select().from(matchDisputas).where(eq(matchDisputas.matchId, sala.id));
    assert.equal(disputas.length, 1);
  });
});
