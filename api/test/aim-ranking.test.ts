import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { desc, eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { aimScores } from "../../db/schema/aim.js";
import { setupDb } from "./helpers.js";
import { ErroAim, notaDoScore, rankingAim, registrarScore } from "../src/modules/aim/service.js";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";

async function criarJogador(db: any, id: string, nome: string) {
  await db.insert(users).values({ id, email: id.slice(0, 4) + "@x.com", displayName: nome });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    mode: "flick",
    score: 5000,
    accuracy: 70,
    apm: 50,
    combo: 10,
    durationMs: 60000,
    ...overrides,
  };
}

describe("ranking de mira com autoridade do servidor", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
    await criarJogador(ctx.db, A, "Ana");
    await criarJogador(ctx.db, B, "Beto");
    await criarJogador(ctx.db, C, "Caio");
  });
  after(async () => {
    await ctx.client.close();
  });

  test("curva de nota é a do motor e é recalculada no servidor", () => {
    assert.equal(notaDoScore(97, 9000), "SS");
    assert.equal(notaDoScore(96, 20000), "S");
    assert.equal(notaDoScore(86, 100), "A");
    assert.equal(notaDoScore(76, 100), "B");
    assert.equal(notaDoScore(62, 100), "C");
    assert.equal(notaDoScore(61, 100), "D");
  });

  test("POST ignora a grade enviada pelo cliente e persiste a nota do servidor", async () => {
    const db = ctx.db;
    const { row, position } = await registrarScore(db, A, payload({ grade: "SS", accuracy: 70.4, score: 5000 }));
    assert.equal(row.mode, "flick");
    assert.equal(row.grade, "C", "grade do cliente é descartada");
    assert.equal(row.score, 5000);
    assert.equal(row.accuracy, 70);
    assert.equal(row.name, "Ana");
    assert.equal(position, 1);

    const [gravada] = await db.select().from(aimScores).where(eq(aimScores.id, row.id));
    assert.equal(gravada.grade, "C");
    assert.equal(gravada.accuracyPct, 70);
    assert.equal(gravada.userId, A);

    const alta = await registrarScore(db, A, payload({ accuracy: 97, score: 12000 }));
    assert.equal(alta.row.grade, "SS");
    assert.equal(alta.position, 1, "o melhor score do jogador continua em 1º");
  });

  test("payload inválido recebe erro de dados e não grava", async () => {
    const db = ctx.db;
    const antes = await db.select().from(aimScores);
    const invalidos = [
      payload({ mode: "sniper" }),
      payload({ score: 200001 }),
      payload({ score: -1 }),
      payload({ accuracy: 101 }),
      payload({ apm: 601 }),
      payload({ combo: -1 }),
      payload({ durationMs: 5000 }),
      payload({ accuracy: "97" }),
    ];
    for (const invalido of invalidos) {
      await assert.rejects(
        () => registrarScore(db, B, invalido),
        (erro: any) => erro instanceof ErroAim && erro.code === "dados_invalidos"
      );
    }
    const depois = await db.select().from(aimScores);
    assert.equal(depois.length, antes.length);
  });

  test("leaderboard devolve um registro por jogador, o melhor score de cada um", async () => {
    const db = ctx.db;
    await registrarScore(db, B, payload({ score: 4000 }));
    await registrarScore(db, B, payload({ score: 8000, accuracy: 80 }));
    await registrarScore(db, C, payload({ mode: "track", score: 9000, accuracy: 90 }));

    const todos = await rankingAim(db, "all");
    assert.equal(todos.length, 3, "um registro por jogador");
    assert.deepEqual(todos.map((linha: any) => linha.name), ["Ana", "Caio", "Beto"]);
    const beto = todos.find((linha: any) => linha.name === "Beto");
    assert.equal(beto.score, 8000, "melhor score do jogador, não o último enviado");
    assert.equal(todos.filter((linha: any) => linha.name === "Beto").length, 1);
    assert.match(todos[0].at, /^\d{4}-\d{2}-\d{2}T/);

    const soFlick = await rankingAim(db, "flick");
    assert.deepEqual(soFlick.map((linha: any) => linha.name), ["Ana", "Beto"]);
    assert.ok(soFlick.every((linha: any) => linha.mode === "flick"));

    const soTrack = await rankingAim(db, "track");
    assert.deepEqual(soTrack.map((linha: any) => linha.name), ["Caio"]);

    const limitado = await rankingAim(db, "all", 1);
    assert.equal(limitado.length, 1);
    assert.equal(limitado[0].name, "Ana");
  });

  test("desempate por createdAt asc: quem chegou antes fica na frente", async () => {
    const db = ctx.db;
    await criarJogador(db, "dddddddd-dddd-dddd-dddd-dddddddddddd", "Davi");
    await criarJogador(db, "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "Eva");
    await db.insert(aimScores).values({
      userId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      mode: "precision",
      score: 7000,
      accuracyPct: 90,
      apm: 40,
      combo: 0,
      grade: "A",
      createdAt: new Date("2026-11-01T10:00:00Z"),
    });
    await db.insert(aimScores).values({
      userId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      mode: "precision",
      score: 7000,
      accuracyPct: 90,
      apm: 40,
      combo: 0,
      grade: "A",
      createdAt: new Date("2026-11-02T10:00:00Z"),
    });

    const linhas = await rankingAim(db, "precision");
    assert.deepEqual(linhas.map((linha: any) => linha.name), ["Davi", "Eva"]);
    assert.equal(linhas[0].score, linhas[1].score);

    const ordem = await db.select().from(aimScores).orderBy(desc(aimScores.score)).limit(1);
    assert.equal(ordem.length, 1);
  });
});
