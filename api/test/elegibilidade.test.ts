import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and } from "drizzle-orm";
import { users, userWallets, userRoles } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { userStrikes } from "../../db/schema/apostas.js";
import { walletTransactions } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import {
  validarElegibilidade,
  contarStrikesAtivos,
  aplicarSuspensaoSeNecessario,
  removerStrike,
  LIMITES,
} from "../src/lib/match-flow.js";
import { runCron } from "../src/cron.js";

/** Cria um usuário com as opções de elegibilidade (design v3 §2.1). */
async function criaJogador(db: any, id: string, opts: any = {}) {
  await db.insert(users).values({
    id,
    email: id + "@x.com",
    displayName: "Jogador",
    riotId: opts.riotId ?? null,
    status: opts.status ?? "active",
    suspensaAte: opts.suspensaAte ?? null,
    termosAceitosEm: opts.termos === undefined ? new Date() : opts.termos,
  });
  await db.insert(userWallets).values({
    userId: id,
    mc: opts.mc ?? 100,
    mcReservado: opts.mcReservado ?? 0,
  });
}

/** Cria uma sala (dono separado) com os valores passados. */
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

/** Cria N strikes (kick_ociosidade) para o usuário em salas próprias. */
async function daStrikes(db: any, userId: string, n: number, diasAtras = 1) {
  for (let i = 0; i < n; i++) {
    const sala = await criaSala(db, { status: "preenchendo", apostaMc: 0 });
    await db.insert(userStrikes).values({
      userId,
      matchId: sala.id,
      motivo: "kick_ociosidade",
      createdAt: new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000),
    });
  }
}

describe("elegibilidade (design v3 §2.1)", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("sem saldo → saldo_insuficiente com o quanto falta", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000001";
    await criaJogador(db, id, { mc: 20, riotId: "Fome#BR1" });
    const r = await validarElegibilidade(db as any, id, 50);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "saldo_insuficiente");
    assert.equal(r.faltam, 30);
  });

  test("sem Riot ID em sala apostada → riot_id_obrigatorio", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000002";
    await criaJogador(db, id, { mc: 100, riotId: null });
    const r = await validarElegibilidade(db as any, id, 50);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "riot_id_obrigatorio");
  });

  test("sala casual (aposta 0) não exige Riot ID nem saldo", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000003";
    await criaJogador(db, id, { mc: 0, riotId: null, termos: null });
    const r = await validarElegibilidade(db as any, id, 0);
    assert.equal(r.ok, true);
  });

  test("2 salas apostadas simultâneas → ja_em_sala_apostada com o sala_num", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000004";
    await criaJogador(db, id, { mc: 500, riotId: "Dono#BR1" });
    const sala1 = await criaSala(db, { apostaMc: 50 });
    await db.insert(matchPlayers).values({
      matchId: sala1.id,
      userId: id,
      side: "blue",
      slot: 0,
      roleSlot: "TOP",
      confirmed: false,
    });

    const r = await validarElegibilidade(db as any, id, 50);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "ja_em_sala_apostada");
    assert.equal((r as any).extra.sala_num, sala1.salaNum);

    // Troca de vaga na MESMA sala passa (ignorarMatchId exclui a sala atual).
    const r2 = await validarElegibilidade(db as any, id, 50, sala1.id);
    assert.equal(r2.ok, true);
  });

  test("3 strikes em 30 dias → suspenso_por_strikes e aplica suspensão", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000005";
    await criaJogador(db, id, { mc: 100, riotId: "Strike#BR1" });
    await daStrikes(db, id, LIMITES.STRIKES_PARA_SUSPENSAO);

    const r = await validarElegibilidade(db as any, id, 50);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "suspenso_por_strikes");
    assert.ok((r as any).extra.liberado_em instanceof Date);

    // A própria checagem aplicou a suspensão (design v3 §2.1).
    const [u] = await db.select().from(users).where(eq(users.id, id));
    assert.equal(u.status, "suspensa");
    assert.ok(u.suspensaAte);
  });

  test("strike removido pelo admin deixa de contar e libera o jogador", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000006";
    const admin = "aaaaaaaa-e000-0000-0000-0000000000ad";
    await criaJogador(db, id, { mc: 100, riotId: "Perdoado#BR1" });
    await db.insert(users).values({ id: admin, email: admin + "@x.com", displayName: "Admin" });
    await db.insert(userRoles).values({ userId: admin, role: "admin" });
    await daStrikes(db, id, LIMITES.STRIKES_PARA_SUSPENSAO);

    const antes = await validarElegibilidade(db as any, id, 50);
    assert.equal(antes.ok, false);

    // O que DELETE /api/admin/strikes/:id faz: perdoa o strike e, se a contagem
    // cair abaixo do teto, reativa a suspensão que ele tinha causado.
    const [um] = await db.select().from(userStrikes).where(eq(userStrikes.userId, id));
    const total = await removerStrike(db as any, um.id, admin);

    assert.equal(total, LIMITES.STRIKES_PARA_SUSPENSAO - 1);
    const count = await contarStrikesAtivos(db as any, id);
    assert.equal(count, LIMITES.STRIKES_PARA_SUSPENSAO - 1);

    // Jogador volta a entrar em sala apostada.
    const r = await validarElegibilidade(db as any, id, 50);
    assert.equal(r.ok, true);
  });

  test("suspensão expirada é reativada pelo cron", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000007";
    await criaJogador(db, id, {
      mc: 100,
      riotId: "Reativa#BR1",
      status: "suspensa",
      suspensaAte: new Date(Date.now() - 1000),
    });

    const r = await runCron(db);
    assert.ok(r.reativados >= 1);

    const [u] = await db.select().from(users).where(eq(users.id, id));
    assert.equal(u.status, "active");
    assert.equal(u.suspensaAte, null);

    const liberado = await validarElegibilidade(db as any, id, 50);
    assert.equal(liberado.ok, true);
  });

  test("conta banida é bloqueada até em sala casual", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000008";
    await criaJogador(db, id, { status: "banida" });
    const r = await validarElegibilidade(db as any, id, 0);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "conta_banida");
  });

  test("termos não aceitos → termos_nao_aceitos em sala apostada", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000009";
    await criaJogador(db, id, { mc: 100, riotId: "Menor#BR1", termos: null });
    const r = await validarElegibilidade(db as any, id, 50);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "termos_nao_aceitos");
  });

  test("admin não é bloqueado por strikes nem pela regra de 1 sala ativa", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-00000000000a";
    await criaJogador(db, id, { mc: 100, riotId: "Admin#BR1", termos: null });
    await db.insert(userRoles).values({ userId: id, role: "admin" });
    await daStrikes(db, id, LIMITES.STRIKES_PARA_SUSPENSAO);

    const r = await validarElegibilidade(db as any, id, 50);
    assert.equal(r.ok, true);
  });

  test("cron gera strike de abandono quando a vaga pagante some da sala iniciada", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-00000000000b";
    await criaJogador(db, id, { mc: 100, riotId: "Afk#BR1" });
    const sala = await criaSala(db, { status: "partida_iniciada", apostaMc: 50 });

    // Pagou a reserva, mas não está mais no match_players (abandono pós-início).
    await db.insert(walletTransactions).values({
      userId: id,
      currency: "mc",
      amount: -50,
      kind: "match_entry_reserve",
      refType: "match",
      refId: sala.id,
      balanceAfter: 50,
    });

    const r = await runCron(db);
    assert.equal(r.abandonos, 1);

    const strikes = await db
      .select()
      .from(userStrikes)
      .where(and(eq(userStrikes.userId, id), eq(userStrikes.motivo, "abandono")));
    assert.equal(strikes.length, 1);

    // AplicarSuspensao é uma função separada e auditável (usada no cron).
    const total = await aplicarSuspensaoSeNecessario(db as any, id);
    assert.equal(total, 1);
  });
});
