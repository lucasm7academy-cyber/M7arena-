import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { matches, matchPlayers, matchDrafts, campeonatoSalaEstado } from "../../db/schema/matches.js";
import { setupDb } from "./helpers.js";
import { avaliarTransicoes } from "../src/lib/match-flow.js";
import { aplicarAcaoDraft } from "../src/lib/draft/index.js";
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

describe("série da sala 5v5: MID é o único que bane/escolhe", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("MID bane; JG do mesmo lado é recusado com apenas_mid", async () => {
    const db = ctx.db;
    const midBlue = crypto.randomUUID();
    const jgBlue = crypto.randomUUID();
    const midRed = crypto.randomUUID();
    const { sala } = await criaSala5v5(db, {
      vagas: [
        { userId: midBlue, side: "blue", role: "MID", slot: 0 },
        { userId: jgBlue, side: "blue", role: "JG", slot: 1 },
        { userId: midRed, side: "red", role: "MID", slot: 0 },
      ],
    });
    await avaliarTransicoes(db as any, sala.id);
    const [match] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(match.status, "draft", "sala entrou no draft do jogo 1");

    // JG do azul tenta banir no turno do azul → recusado pela regra do capitão.
    const jg = await aplicarAcaoDraft(db as any, match, jgBlue, "ban", "Aatrox");
    assert.equal(jg.ok, false);
    assert.equal(jg.erro, "apenas_mid");

    // MID do azul age normalmente.
    const mid = await aplicarAcaoDraft(db as any, match, midBlue, "ban", "Aatrox");
    assert.equal(mid.ok, true);

    const [draft] = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.deepEqual(draft.blueBans, ["Aatrox"]);
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

  test("MD3: 1-0 continua no jogo 2 (todos desconfirmados); 2-1 fecha", async () => {
    const db = ctx.db;
    const { sala } = await criaSala5v5(db, { formato: "md3" });

    // Fluxo real: a sala entra no draft do jogo 1 e o jogo termina.
    await avaliarTransicoes(db as any, sala.id);
    await db
      .update(matchDrafts)
      .set({ status: "finished" })
      .where(eq(matchDrafts.matchId, sala.id));

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
    assert.equal(sala1.codigoPartida, null, "o código só é atribuído quando o draft fecha");

    // Ninguém confirmou ainda: a sala continua na confirmação (não pula pro draft).
    const rParado = await avaliarTransicoes(db as any, sala.id);
    assert.equal(rParado.estado, "confirmacao");

    // Todos confirmam → draft do JOGO 2, preservando o draft do jogo 1.
    await db.update(matchPlayers).set({ confirmed: true }).where(eq(matchPlayers.matchId, sala.id));
    const rDraft = await avaliarTransicoes(db as any, sala.id);
    assert.equal(rDraft.estado, "draft");

    const drafts = await db.select().from(matchDrafts).where(eq(matchDrafts.matchId, sala.id));
    assert.equal(drafts.length, 2, "draft do jogo 1 (histórico) + draft do jogo 2");
    const jogo2 = drafts.find((d: any) => d.jogo === 2);
    assert.ok(jogo2, "draft do jogo 2 criado");
    assert.equal(jogo2.status, "ongoing");

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
