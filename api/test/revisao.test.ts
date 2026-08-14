import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets, userRoles } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { walletTransactions, platformRevenue } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import { pagarPremio, pagarEmpate, pagarCancelamento } from "../src/lib/escrow.js";
import { calcularPayout } from "../src/lib/escrow.js";
import { matchDisputas } from "../../db/schema/apostas.js";
import { reverterPayout } from "../src/lib/escrow.js";

async function criaJogador(db: any, id: string, mc: number, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
  await db.insert(userWallets).values({ userId: id, mc, mcReservado });
}

async function criaAdmin(db: any, id: string, role = "admin") {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Admin" });
  await db.insert(userRoles).values({ userId: id, role });
}

async function criaSalaEmRevisao(db: any, aposta = 30) {
  const dono = crypto.randomUUID();
  await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
  const [sala] = await db.insert(matches).values({
    gameId: "lol",
    mode: "5v5",
    createdBy: dono,
    status: "aguardando_revisao",
    apostaMc: aposta,
    taxaPct: "8.99",
    revisaoDesde: new Date(),
  }).returning();
  return sala;
}

describe("revisão (lógica de decisão idempotente)", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("aprovar paga uma vez; segunda decisão é rejeitada pelo estado", async () => {
    const db = ctx.db;
    const admin = "aaaaaaa2-0000-0000-0000-000000000001";
    const a = "aaaaaaa2-0000-0000-0000-000000000010";
    const b = "aaaaaaa2-0000-0000-0000-000000000011";
    await criaAdmin(db, admin, "admin");
    await criaJogador(db, a, 70, 30);
    await criaJogador(db, b, 70, 30);

    const sala = await criaSalaEmRevisao(db, 30);
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true });
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: b, side: "red", slot: 0, roleSlot: "TOP", confirmed: true });

    // 1a decisão: aprovar blue (o que a rota /decidir faz, com lock)
    const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id)).limit(1);
    assert.equal(m.status, "aguardando_revisao");
    await pagarPremio(db as any, sala.id, m.apostaMc ?? 0, players, "blue", Number(m.taxaPct ?? 8.99));
    await db.update(matches).set({
      status: "encerrada",
      resultado: "blue",
      decisaoId: "dec00000-0000-0000-0000-000000000001",
      revisadoPor: admin,
      revisadoEm: new Date(),
      endedAt: new Date(),
    }).where(eq(matches.id, sala.id));

    const calc = calcularPayout(30, 2, 8.99, 1);
    const [aPos] = await db.select().from(userWallets).where(eq(userWallets.userId, a));
    assert.equal(aPos.mc, 70 + calc.porVencedor);
    const [bPos] = await db.select().from(userWallets).where(eq(userWallets.userId, b));
    assert.equal(bPos.mcReservado, 0);

    // 2a decisão: estado mudou -> partida_ja_decidida (a rota checa status antes)
    const [m2] = await db.select().from(matches).where(eq(matches.id, sala.id)).limit(1);
    assert.equal(m2.status, "encerrada");
    assert.notEqual(m2.status, "aguardando_revisao");

    // exatamente 1 match_prize (vencedor) e 1 match_loss (perdedor) na partida
    const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.refId, sala.id));
    assert.equal(txs.filter((t: any) => t.kind === "match_prize").length, 1);
    assert.equal(txs.filter((t: any) => t.kind === "match_loss").length, 1);
  });

  test("empate devolve o reservado de todos, sem taxa", async () => {
    const db = ctx.db;
    const a = "bbbbbbb2-0000-0000-0000-000000000001";
    const b = "bbbbbbb2-0000-0000-0000-000000000002";
    await criaJogador(db, a, 50, 30);
    await criaJogador(db, b, 50, 30);

    const sala = await criaSalaEmRevisao(db, 30);
    await pagarEmpate(db as any, sala.id, 30, [{ userId: a }, { userId: b }]);
    const [wa] = await db.select().from(userWallets).where(eq(userWallets.userId, a));
    assert.equal(wa.mc, 80);
    assert.equal(wa.mcReservado, 0);
    const revs = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, sala.id));
    assert.equal(revs.length, 0);
  });

  test("cancelamento devolve tudo e zera o reservado", async () => {
    const db = ctx.db;
    const a = "ccccccc2-0000-0000-0000-000000000001";
    await criaJogador(db, a, 50, 30);

    const sala = await criaSalaEmRevisao(db, 30);
    await pagarCancelamento(db as any, sala.id, 30, [{ userId: a }]);
    const [wa] = await db.select().from(userWallets).where(eq(userWallets.userId, a));
    assert.equal(wa.mc, 80);
    assert.equal(wa.mcReservado, 0);
  });

  test("disputa procedente → reverterPayout + sala cancelada", async () => {
    const db = ctx.db;
    const admin = "aaaaaaa2-0000-0000-0000-000000000002";
    await criaAdmin(db, admin, "admin");
    const a = "aaaaaaa2-0000-0000-0000-000000000020";
    const b = "aaaaaaa2-0000-0000-0000-000000000021";
    await criaJogador(db, a, 70, 30);
    await criaJogador(db, b, 70, 30);
    const [sala] = await db.insert(matches).values({
      gameId: "lol", mode: "1v1", createdBy: admin, status: "encerrada",
      apostaMc: 30, taxaPct: "8.99", winnerSide: "blue", resultado: "blue", endedAt: new Date(),
    }).returning();
    await db.insert(matchPlayers).values([
      { matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true },
      { matchId: sala.id, userId: b, side: "red", slot: 0, roleSlot: "TOP", confirmed: true },
    ]);
    const players = [{ userId: a, side: "blue" }, { userId: b, side: "red" }];
    await pagarPremio(db as any, sala.id, 30, players, "blue", 8.99);
    const [disputa] = await db.insert(matchDisputas).values({
      matchId: sala.id, userId: a, motivo: "impostor jogou no meu lugar", contestacaoUrl: "/api/prints/x/arquivo",
    }).returning();

    // Lógica do admin (mesma da rota): procedente → reverterPayout + cancelar
    const r = await reverterPayout(db as any, sala.id, 30, players, "blue", 8.99);
    assert.equal(r.ok, true);
    await db.update(matches).set({ status: "cancelada", resultado: null, canceladoEm: new Date(), revisadoPor: admin, revisadoEm: new Date() }).where(eq(matches.id, sala.id));
    await db.update(matchDisputas).set({ status: "resolvida" }).where(eq(matchDisputas.id, disputa.id));

    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "cancelada");
    const [d] = await db.select().from(matchDisputas).where(eq(matchDisputas.id, disputa.id));
    assert.equal(d.status, "resolvida");
  });

  test("disputa improcedente → fecha sem tocar escrow", async () => {
    const db = ctx.db;
    const admin = "aaaaaaa2-0000-0000-0000-000000000003";
    await criaAdmin(db, admin, "admin");
    const [sala] = await db.insert(matches).values({
      gameId: "lol", mode: "1v1", createdBy: admin, status: "encerrada",
      apostaMc: 0, taxaPct: "8.99", winnerSide: "blue", resultado: "blue", endedAt: new Date(),
    }).returning();
    const [disputa] = await db.insert(matchDisputas).values({ matchId: sala.id, userId: admin, motivo: "resultado duvidoso" }).returning();

    // Improcedente: só fecha a disputa, sala continua encerrada
    await db.update(matchDisputas).set({ status: "resolvida" }).where(eq(matchDisputas.id, disputa.id));
    const [d] = await db.select().from(matchDisputas).where(eq(matchDisputas.id, disputa.id));
    assert.equal(d.status, "resolvida");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "encerrada");
  });
});
