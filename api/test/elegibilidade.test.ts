import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets, userRoles } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { userAdvertencias } from "../../db/schema/apostas.js";
import { setupDb } from "./helpers.js";
import {
  validarElegibilidade,
  contarAdvertenciasAtivas,
  aplicarBanAutomaticoSeNecessario,
  removerAdvertencia,
  LIMITES,
} from "../src/lib/match-flow.js";
import { runCron } from "../src/cron.js";

/** Cria um usuário com as opções de elegibilidade (ADR-033). */
async function criaJogador(db: any, id: string, opts: any = {}) {
  await db.insert(users).values({
    id,
    email: id + "@x.com",
    displayName: "Jogador",
    riotId: opts.riotId ?? null,
    status: opts.status ?? "active",
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

/** Aplica N advertências manuais para o usuário (como o admin faria). */
async function daAdvertencias(db: any, userId: string, n: number) {
  for (let i = 0; i < n; i++) {
    await db.insert(userAdvertencias).values({ userId, motivo: "Advertência de teste" });
  }
}

describe("elegibilidade (ADR-033)", () => {
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

  test("sem Riot ID em sala casual → riot_id_obrigatorio", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000003";
    await criaJogador(db, id, { mc: 0, riotId: null, termos: null });
    const r = await validarElegibilidade(db as any, id, 0);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "riot_id_obrigatorio");
  });

  test("sala casual (aposta 0) com Riot ID passa mesmo sem saldo/termos", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000030";
    await criaJogador(db, id, { mc: 0, riotId: "Casual#BR1", termos: null });
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

  test("advertências ativas não bloqueiam até atingir o teto (ban)", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000005";
    await criaJogador(db, id, { mc: 100, riotId: "Aviso#BR1" });
    await daAdvertencias(db, id, LIMITES.ADVERTENCIAS_PARA_BAN - 1);

    const count = await contarAdvertenciasAtivas(db as any, id);
    assert.equal(count, LIMITES.ADVERTENCIAS_PARA_BAN - 1);

    // Ainda pode jogar apostada (só o ban bloqueia; advertência é contador).
    const r = await validarElegibilidade(db as any, id, 50);
    assert.equal(r.ok, true);
  });

  test("aplicarBanAutomatico bane ao atingir 3 advertências", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000006";
    await criaJogador(db, id, { mc: 100, riotId: "Tres#BR1" });
    await daAdvertencias(db, id, LIMITES.ADVERTENCIAS_PARA_BAN);

    const total = await aplicarBanAutomaticoSeNecessario(db as any, id);
    assert.equal(total, LIMITES.ADVERTENCIAS_PARA_BAN);

    const [u] = await db.select().from(users).where(eq(users.id, id));
    assert.equal(u.status, "banida");
    assert.equal(u.banAutomatico, true);
    assert.equal(u.banMotivo, "3 advertências");

    // Ban bloqueia até sala casual.
    const r = await validarElegibilidade(db as any, id, 0);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "conta_banida");
  });

  test("remover advertência NÃO desbana sozinho (ban só sai com unban)", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-000000000007";
    const admin = "aaaaaaaa-e000-0000-0000-0000000000ad";
    await criaJogador(db, id, { mc: 100, riotId: "Banido#BR1" });
    await db.insert(users).values({ id: admin, email: admin + "@x.com", displayName: "Admin" });
    await db.insert(userRoles).values({ userId: admin, role: "admin" });
    await daAdvertencias(db, id, LIMITES.ADVERTENCIAS_PARA_BAN);
    await aplicarBanAutomaticoSeNecessario(db as any, id);

    const [uma] = await db.select().from(userAdvertencias).where(eq(userAdvertencias.userId, id)).limit(1);
    const total = await removerAdvertencia(db as any, uma.id, admin);
    assert.equal(total, LIMITES.ADVERTENCIAS_PARA_BAN - 1);

    // Mesmo com contagem abaixo do teto, continua banido (ADR-033).
    const [u] = await db.select().from(users).where(eq(users.id, id));
    assert.equal(u.status, "banida");
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

  test("admin não é bloqueado por advertências nem pela regra de 1 sala ativa", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-00000000000a";
    await criaJogador(db, id, { mc: 100, riotId: "Admin#BR1", termos: null });
    await db.insert(userRoles).values({ userId: id, role: "admin" });
    await daAdvertencias(db, id, LIMITES.ADVERTENCIAS_PARA_BAN);

    const r = await validarElegibilidade(db as any, id, 50);
    assert.equal(r.ok, true);
  });

  test("cron NÃO gera mais punições (só partida fantasma e saneamento)", async () => {
    const db = ctx.db;
    const id = "aaaaaaaa-e000-0000-0000-00000000000b";
    await criaJogador(db, id, { mc: 100, riotId: "Nada#BR1" });
    const sala = await criaSala(db, { status: "partida_iniciada", apostaMc: 50, updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000) });

    const r = await runCron(db);
    assert.equal(r.fantasmas, 1);

    const advertencias = await db.select().from(userAdvertencias).where(eq(userAdvertencias.userId, id));
    assert.equal(advertencias.length, 0);

    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "aguardando_revisao");
  });
});
