import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { matches, matchPlayers, matchDrafts, matchCodes, campeonatoSalaEstado } from "../../db/schema/matches.js";
import { gameAccounts, games } from "../../db/schema/games.js";
import { setupDb } from "./helpers.js";
import { avaliarTransicoes } from "../src/lib/match-flow.js";
import { verificarPartida } from "../src/lib/verificar-partida.js";
import {
  avancarSerie5v5,
  normalizarFormato,
  CONFIRMACAO_SERIE_MS,
} from "../src/lib/serie-sala.js";
import { alvoVitorias } from "../src/lib/serie-livre.js";

/** Jogador com Riot vinculado (o motor exige em salas apostadas; aqui é só conveniência). */
async function criaJogador(db: any, id: string, nome = "Jogador") {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: nome, riotId: "RIOT-" + id });
}

type Vaga = { userId: string; side: "blue" | "red"; role: string; slot: number };

/**
 * Sala 5v5 em `confirmacao` com o estado da série já criado (como a rota POST
 * /api/matches faz). `vagas` permite montar o caso do MID (blue MID + blue JG).
 */
async function criaSala5v5(
  db: any,
  opts: { formato?: string; vagas?: Vaga[]; comEstado?: boolean } = {}
) {
  const dono = crypto.randomUUID();
  await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });

  const vagas: Vaga[] = opts.vagas ?? [
    { userId: crypto.randomUUID(), side: "blue", role: "MID", slot: 0 },
    { userId: crypto.randomUUID(), side: "red", role: "MID", slot: 0 },
  ];
  for (const v of vagas) await criaJogador(db, v.userId);

  const [sala] = await db
    .insert(matches)
    .values({
      gameId: "lol",
      mode: "5v5",
      createdBy: dono,
      status: "confirmacao",
      apostaMc: 0,
      taxaPct: "8.99",
      maxJogadores: vagas.length,
      confirmacaoExpiresAt: new Date(Date.now() + 60_000),
    })
    .returning();

  if (opts.comEstado !== false) {
    await db.insert(campeonatoSalaEstado).values({ matchId: sala.id, formato: opts.formato ?? "md3" });
  }
  await db.insert(matchPlayers).values(
    vagas.map((v) => ({ matchId: sala.id, userId: v.userId, side: v.side, slot: v.slot, roleSlot: v.role, confirmed: true }))
  );

  return { sala, vagas };
}

describe("série da sala 5v5: formato e alvo de vitórias", () => {
  test("normalizarFormato: md1/md3/md5 válidos; qualquer outra coisa vira md3", () => {
    assert.equal(normalizarFormato("md1"), "md1");
    assert.equal(normalizarFormato("md5"), "md5");
    assert.equal(normalizarFormato("md3"), "md3");
    assert.equal(normalizarFormato(undefined), "md3");
    assert.equal(normalizarFormato("md7"), "md3");
    assert.equal(normalizarFormato(3), "md3");
  });

  test("alvo de vitórias por formato", () => {
    assert.equal(alvoVitorias("md1"), 1);
    assert.equal(alvoVitorias("md3"), 2);
    assert.equal(alvoVitorias("md5"), 3);
  });
});

describe("série da sala 5v5: SEM draft no site", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("confirmados → iniciando_partida com código; nenhuma linha de draft", async () => {
    const db = ctx.db;
    await db.insert(matchCodes).values({ code: "BR04fa2-SERIE5V5-NODRAFT", used: false, mode: null });

    const { sala } = await criaSala5v5(db);
    const r = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r.estado, "iniciando_partida", "5v5 vai direto para a partida");

    const drafts = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.equal(drafts.length, 0, "nenhuma linha de draft criada no 5v5");

    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.ok(m.codigoPartida && m.codigoPartida !== "SEM-CODIGO-AGUARDE", "código Tournament Draft atribuído");
    assert.ok(m.iniciandoPartidaAt, "timer de início marcado pelo servidor");
  });
});

describe("série da sala 5v5: MD3/MD5 avançam e fecham no alvo", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("MD3: 1-0 continua no jogo 2 sem draft; 2-1 fecha", async () => {
    const db = ctx.db;
    await db.insert(matchCodes).values({ code: "BR04fa2-SERIE5V5-MD3", used: false, mode: null });

    const { sala } = await criaSala5v5(db, { formato: "md3" });

    // Jogo 1: confirmados → iniciando_partida (sem draft), código atribuído.
    const r1 = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r1.estado, "iniciando_partida");
    const [inicio1] = await db.select().from(matches).where(eq(matches.id, sala.id));
    const codigoSerie = inicio1.codigoPartida;
    assert.ok(codigoSerie && !codigoSerie.startsWith("SEM-CODIGO"), "código real do pool");
    const drafts1 = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.equal(drafts1.length, 0, "5v5 não cria draft");

    // Jogo 1: azul vence → série continua.
    const continua1 = await avancarSerie5v5(db as any, sala.id, "blue");
    assert.equal(continua1, true);

    const [st1] = await db.select().from(campeonatoSalaEstado).where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.equal(st1.jogo, 2);
    assert.equal(st1.placarA, 1);
    assert.equal(st1.placarB, 0);

    const [sala1] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(sala1.status, "confirmacao", "volta para a confirmação do próximo jogo");
    const janela = new Date(sala1.confirmacaoExpiresAt).getTime() - Date.now();
    assert.ok(janela > CONFIRMACAO_SERIE_MS - 10_000, `janela de 5 min (veio ${janela}ms)`);

    const jogadores = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    assert.ok(jogadores.every((p: any) => p.confirmed === false && p.linked === false), "todos precisam confirmar de novo");
    assert.equal(sala1.codigoPartida, codigoSerie, "o código da série é preservado");

    // Ninguém confirmou ainda: continua na confirmação.
    const rParado = await avaliarTransicoes(db as any, sala.id);
    assert.equal(rParado.estado, "confirmacao");

    // Todos confirmam → iniciando_partida do jogo 2 (sem draft), mesmo código.
    await db.update(matchPlayers).set({ confirmed: true }).where(eq(matchPlayers.matchId, sala.id));
    const r2 = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r2.estado, "iniciando_partida");
    const [inicio2] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(inicio2.codigoPartida, codigoSerie);
    const drafts2 = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.equal(drafts2.length, 0, "continua sem draft no jogo 2");

    // Jogo 2: vermelho vence (1-1) → continua no jogo 3.
    const continua2 = await avancarSerie5v5(db as any, sala.id, "red");
    assert.equal(continua2, true);

    // Jogo 3: azul vence (2-1) → atinge o alvo do MD3 e FECHA.
    const continua3 = await avancarSerie5v5(db as any, sala.id, "blue");
    assert.equal(continua3, false);

    const [st2] = await db.select().from(campeonatoSalaEstado).where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.equal(st2.jogo, 3, "não avança além do jogo que fechou a série");
    assert.equal(st2.placarA, 2);
    assert.equal(st2.placarB, 1);
  });

  test("MD1: o primeiro jogo já fecha a série", async () => {
    const db = ctx.db;
    const { sala } = await criaSala5v5(db, { formato: "md1" });

    const continua = await avancarSerie5v5(db as any, sala.id, "red");
    assert.equal(continua, false);

    const [st] = await db.select().from(campeonatoSalaEstado).where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.equal(st.placarA, 0);
    assert.equal(st.placarB, 1);
    assert.equal(st.jogo, 1, "MD1 não abre jogo 2");
  });

  test("sala antiga sem estado de série: não avança (encerramento normal)", async () => {
    const db = ctx.db;
    const { sala } = await criaSala5v5(db, { comEstado: false });
    const continua = await avancarSerie5v5(db as any, sala.id, "blue");
    assert.equal(continua, false);
  });
});

describe("série 5v5: verificação NÃO recontar o jogo anterior da série", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("jogo antigo (antes do draft atual) é ignorado; só o jogo novo conta", async () => {
    const db = ctx.db;
    const { sala, vagas } = await criaSala5v5(db, { formato: "md3" });

    // Sala no jogo atual: código da série + início 10 min atrás.
    const inicio = new Date(Date.now() - 10 * 60_000);
    await db
      .update(matches)
      .set({ status: "partida_iniciada", codigoPartida: "BR-TEST-SERIE-217", iniciandoPartidaAt: inicio })
      .where(eq(matches.id, sala.id));

    // Conta Riot vinculada dos dois jogadores (o motor exige PUUID de todos).
    await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
    const puuidPorSide: Record<string, string> = {};
    for (const v of vagas) {
      const puuid = "PUUID_" + v.side.toUpperCase();
      puuidPorSide[v.side] = puuid;
      await db.insert(gameAccounts).values({ userId: v.userId, gameId: "lol", externalId: puuid, handle: "nick#BR1", verified: true });
    }

    const partida = (matchId: string, gameCreation: number) => ({
      metadata: { matchId },
      info: {
        tournamentCode: "BR-TEST-SERIE-217",
        gameCreation,
        endOfGameResult: "GameComplete",
        participants: [
          { puuid: puuidPorSide.blue, teamId: 100, win: true },
          { puuid: puuidPorSide.red, teamId: 200, win: false },
        ],
        teams: [
          { teamId: 100, win: true },
          { teamId: 200, win: false },
        ],
      },
    });
    const antigo = partida("BR1_JOGO_ANTERIOR", Date.now() - 40 * 60_000);
    const novo = partida("BR1_JOGO_ATUAL", Date.now() - 5 * 60_000);

    // Só o jogo ANTERIOR está no histórico (o atual ainda não acabou): não conta.
    const r1 = await verificarPartida(db as any, sala.id, {
      agora: new Date(),
      buscarIds: async () => ["BR1_JOGO_ANTERIOR"],
      buscarMatch: async (id: string) => ((id === "BR1_JOGO_ANTERIOR" ? antigo : null) as any),
    });
    assert.equal(r1.ok, false);
    // O jogo anterior é descartado pelo piso do jogo atual — o motor responde
    // "não encontrada" (para esta jogada) e NÃO soma nada.
    assert.equal("motivo" in r1 && r1.motivo, "nao_encontrada", "não pode recontar o jogo anterior");
    const [st1] = await db.select().from(campeonatoSalaEstado).where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.equal(st1.placarA, 0);

    // Com o jogo ATUAL no histórico, conta 1-0 e a série continua.
    const r2 = await verificarPartida(db as any, sala.id, {
      agora: new Date(),
      buscarIds: async () => ["BR1_JOGO_ANTERIOR", "BR1_JOGO_ATUAL"],
      buscarMatch: async (id: string) => ((id === "BR1_JOGO_ANTERIOR" ? antigo : id === "BR1_JOGO_ATUAL" ? novo : null) as any),
    });
    assert.equal(r2.ok, true);
    assert.equal("motivo" in r2 && r2.motivo, "serie_avancou");
    const [st2] = await db.select().from(campeonatoSalaEstado).where(eq(campeonatoSalaEstado.matchId, sala.id));
    assert.equal(st2.placarA, 1);
    assert.equal(st2.placarB, 0);
    assert.equal(st2.jogo, 2);
  });
});
