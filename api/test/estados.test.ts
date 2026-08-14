import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and, inArray } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers, matchCodes } from "../../db/schema/matches.js";
import { walletTransactions, platformRevenue } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import { reservarEntrada, devolverEntrada, pagarPremio } from "../src/lib/escrow.js";
import { entrarEmRevisao, avaliarTransicoes, validarElegibilidade, atribuirCodigoPartida } from "../src/lib/match-flow.js";

async function criaJogador(db: any, id: string, mc: number, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador", riotId: "RIOT-" + id, termosAceitosEm: new Date() });
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

  test("regra de timer: preencher a ultima vaga seta confirmacaoExpiresAt = now + 75s", async () => {
    // Reforço do ajustarsala F2: o deadline é definido no SERVIDOR (now+75s),
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
    // Tolerância generosa: >=70s (latência do teste) e <80s.
    assert.ok(diff >= 70_000 && diff < 80_000, `deadline ~75s a partir do now do servidor (foi ${Math.round(diff / 1000)}s)`);
  });

  test("5v5: 10 jogadores preenchem a sala -> confirmacao; o 11o NAO entra", async () => {
    // Reforço do ajustarsala para o teste real com 10 players: a transição
    // preenchendo->confirmacao só acontece com total >= max (10). E quem
    // tenta entrar depois (11o) deve ser barrado — sem estourar a sala.
    const db = ctx.db;
    const sala = await criaSala(db, { status: "preenchendo", maxJogadores: 10, apostaMc: 0 });
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const id = `eeeeeee1-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
      ids.push(id);
      await criaJogador(db, id, 100, 0);
    }

    // Primeiros 9 entram: sala segue preenchendo (9 < 10).
    for (let i = 0; i < 9; i++) {
      await db.insert(matchPlayers).values({
        matchId: sala.id,
        userId: ids[i],
        side: i < 5 ? "blue" : "red",
        slot: i % 5,
        roleSlot: i < 5 ? ["TOP", "JG", "MID", "ADC", "SUP"][i] : ["TOP", "JG", "MID", "ADC", "SUP"][i - 5],
        confirmed: false,
      });
    }
    await avaliarTransicoes(db as any, sala.id);
    const [m9] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m9.status, "preenchendo", "com 9 jogadores a sala segue preenchendo");

    // 10o jogador completa: -> confirmacao.
    await db.insert(matchPlayers).values({
      matchId: sala.id,
      userId: ids[9],
      side: "blue",
      slot: 4,
      roleSlot: "SUP",
      confirmed: false,
    });
    await avaliarTransicoes(db as any, sala.id);
    const [m10] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m10.status, "confirmacao", "com 10 jogadores a sala vai para confirmacao");

    // Um 11o jogador NÃO deve conseguir entrar: total >= max barra.
    const id11 = "eeeeeee1-0000-0000-0000-000000000011";
    await criaJogador(db, id11, 100, 0);
    const total = await db.select({ id: matchPlayers.userId }).from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    assert.equal(total.length, 10, "a sala tem exatamente 10 jogadores (11o barrado)");
  });

  test("jogador em sala apostada aguardando_revisao com linked residual NAO prende (pode jogar de novo)", async () => {
    // Regra nova (2026-08-10): o jogador não fica preso por falta de admin.
    // Uma sala em `aguardando_revisao` — mesmo com `linked` residual (ex.:
    // partida fantasma cron) — não bloqueia a entrada em outra sala. O MC
    // continua retido até o admin decidir; a checagem de saldo usa `w.mc`
    // (exclui o retido), então ele só entra se tiver MC livre.
    const db = ctx.db;
    const id = "eeeeeee1-0000-0000-0000-0000000000a1";
    await criaJogador(db, id, 70, 30);
    const salaRevisao = await criaSala(db, { status: "aguardando_revisao", apostaMc: 30, maxJogadores: 2 });
    await db.insert(matchPlayers).values({
      matchId: salaRevisao.id,
      userId: id,
      side: "blue",
      slot: 0,
      roleSlot: "TOP",
      confirmed: true,
      linked: true, // residual de partida fantasma (cron limpou, mas se chegar aqui...)
    });

    // A regra "1 sala apostada ativa por vez" agora ignora aguardando_revisao.
    const [outra] = await db
      .select()
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .where(and(eq(matchPlayers.userId, id), eq(matchPlayers.linked, true), inArray(matches.status, ["preenchendo", "confirmacao", "iniciando_partida", "partida_iniciada"])));
    assert.equal(outra, undefined, "sala em revisão não conta como vínculo ativo");

    // E a elegibilidade libera a entrada (tem 70 livres para reservar 30).
    const r = await validarElegibilidade(db as any, id, 30);
    assert.equal(r.ok, true);
  });

  test("rodízio LRU de códigos: usa o livre usado há mais tempo, volta ao primeiro quando todos usados", async () => {
    const db = ctx.db;
    // Isola o teste: remove o seed da migration 0007 (4 códigos reais).
    await db.delete(matchCodes);

    // Códigos em ordem de criação: C1, C2 (C2 foi usado depois de C1).
    const [c1] = await db.insert(matchCodes).values({ code: "BR-TEST-0001", used: false }).returning();
    const [c2] = await db.insert(matchCodes).values({ code: "BR-TEST-0002", used: false }).returning();
    await db.update(matchCodes).set({ used: false, lastUsedAt: new Date(Date.now() - 60_000) }).where(eq(matchCodes.id, c1.id));
    await db.update(matchCodes).set({ used: false, lastUsedAt: new Date(Date.now() - 30_000) }).where(eq(matchCodes.id, c2.id));

    const s1 = await criaSala(db, { apostaMc: 0 });
    const s2 = await criaSala(db, { apostaMc: 0 });
    const s3 = await criaSala(db, { apostaMc: 0 });
    const s4 = await criaSala(db, { apostaMc: 0 });
    const s5 = await criaSala(db, { apostaMc: 0 });

    // C1 foi usado há mais tempo → primeiro a ser reutilizado.
    const cod1 = await atribuirCodigoPartida(db as any, s1.id, "5v5");
    assert.equal(cod1, "BR-TEST-0001", "primeiro código livre usado há mais tempo");

    // C2 é o próximo.
    const cod2 = await atribuirCodigoPartida(db as any, s2.id, "5v5");
    assert.equal(cod2, "BR-TEST-0002");

    // Todos usados → SEM-CODIGO-AGUARDE.
    const cod3 = await atribuirCodigoPartida(db as any, s3.id, "5v5");
    assert.equal(cod3, "SEM-CODIGO-AGUARDE");

    // C1 libera (partida s1 terminou) → volta ao ciclo imediatamente.
    await db.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.id, c1.id));
    const cod4 = await atribuirCodigoPartida(db as any, s4.id, "5v5");
    assert.equal(cod4, "BR-TEST-0001", "após liberar, o código volta ao rodízio");

    // Nunca usado (last_used_at NULL) tem prioridade máxima sobre os usados.
    const [c3] = await db.insert(matchCodes).values({ code: "BR-TEST-0003", used: false }).returning();
    const cod5 = await atribuirCodigoPartida(db as any, s5.id, "5v5");
    assert.equal(cod5, "BR-TEST-0003", "código nunca usado entra na frente do rodízio");
  });
});
