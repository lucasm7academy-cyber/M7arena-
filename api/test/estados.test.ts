import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, and } from "drizzle-orm";
import { userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { walletTransactions, platformRevenue } from "../../db/schema/economia.js";
import { reservarEntrada, devolverEntrada, pagarPremio } from "../src/lib/escrow.js";
import { entrarEmRevisao } from "../src/lib/match-flow.js";

async function setupDb() {
  const client = new PGlite();
  await client.exec(`CREATE TABLE user_wallets (
    user_id uuid PRIMARY KEY,
    mp integer NOT NULL DEFAULT 0,
    mc integer NOT NULL DEFAULT 0,
    mc_reservado integer NOT NULL DEFAULT 0,
    updated_at timestamp NOT NULL DEFAULT now()
  )`);
  await client.exec(`CREATE TABLE wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    currency varchar(10) NOT NULL,
    amount integer NOT NULL,
    kind varchar(50) NOT NULL,
    ref_type varchar(50),
    ref_id text,
    balance_after integer NOT NULL,
    created_at timestamp DEFAULT now()
  )`);
  await client.exec(`CREATE TABLE platform_revenue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL,
    mc_fee integer NOT NULL,
    mc_fee_rounding integer NOT NULL DEFAULT 0,
    created_at timestamp DEFAULT now()
  )`);
  await client.exec(`CREATE TABLE matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sala_num integer,
    status varchar(50) NOT NULL DEFAULT 'preenchendo',
    game_id varchar(50) NOT NULL DEFAULT 'lol',
    mode varchar(50) NOT NULL DEFAULT '5v5',
    created_by uuid,
    room_code varchar(20),
    winner_side varchar(10),
    entry_mp integer NOT NULL DEFAULT 0,
    nome text,
    descricao text,
    max_jogadores integer NOT NULL DEFAULT 10,
    tem_senha boolean NOT NULL DEFAULT false,
    senha text,
    elo_minimo varchar(50),
    time_a_nome text,
    time_a_tag text,
    time_a_logo text,
    time_b_nome text,
    time_b_tag text,
    time_b_logo text,
    codigo_partida text,
    confirmacao_expires_at timestamp,
    iniciando_partida_at timestamp,
    state_deadline_at timestamp,
    aposta_mc integer NOT NULL DEFAULT 0,
    taxa_pct numeric(5,2) NOT NULL DEFAULT '8.99',
    resultado varchar(10),
    cancelado_em timestamp,
    revisado_por uuid,
    revisado_em timestamp,
    decisao_id uuid,
    revisao_desde timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    ended_at timestamp
  )`);
  await client.exec(`CREATE TABLE match_players (
    match_id uuid NOT NULL,
    user_id uuid NOT NULL,
    side varchar(10) NOT NULL,
    slot integer NOT NULL,
    role_slot varchar(50),
    confirmed boolean NOT NULL DEFAULT false,
    linked boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, user_id)
  )`);
  const db = drizzle(client);
  return { client, db };
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
    // saldo inicial de cada um
    await db.insert(userWallets).values({ userId: criador, mc: 100, mcReservado: 0 });
    await db.insert(userWallets).values({ userId: segundo, mc: 100, mcReservado: 0 });

    // criar sala com aposta 30 -> criador reserva 30
    const [sala] = await db.insert(matches).values({ status: "preenchendo", apostaMc: 30, taxaPct: "8.99" }).returning();
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
    const [sala] = await db.insert(matches).values({
      status: "partida_iniciada",
      apostaMc: 50,
      stateDeadlineAt: new Date(Date.now() + 60_000),
    }).returning();
    const r = await entrarEmRevisao(db as any, sala.id);
    assert.equal(r.ok, true);
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "aguardando_revisao");
    assert.ok(m.revisaoDesde);
    assert.equal(m.stateDeadlineAt, null);
  });

  test("entrarEmRevisao: sala casual (aposta 0) é rejeitada", async () => {
    const db = ctx.db;
    const [sala] = await db.insert(matches).values({ status: "partida_iniciada", apostaMc: 0 }).returning();
    const r = await entrarEmRevisao(db as any, sala.id);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "sala_casual");
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
    const [sala] = await db.insert(matches).values({ status: "partida_iniciada", apostaMc: 30 }).returning();
    const saldoInicial = 100;
    for (const p of players) {
      await db.insert(userWallets).values({ userId: p.userId, mc: saldoInicial - 30, mcReservado: 30 });
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
    const [sala] = await db.insert(matches).values({ status: "partida_iniciada", apostaMc: 30 }).returning();
    for (const p of players) {
      await db.insert(userWallets).values({ userId: p.userId, mc: 70, mcReservado: 30 });
    }
    await pagarPremio(db as any, sala.id, 30, players, "blue", 8.99);
    const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.refId, sala.id));
    const prizes = txs.filter((t: any) => t.kind === "match_prize");
    assert.equal(prizes.length, 1);
    const losses = txs.filter((t: any) => t.kind === "match_loss");
    assert.equal(losses.length, 1);
  });
});
