import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { matchPrints } from "../../db/schema/apostas.js";
import { setupDb } from "./helpers.js";
import { validarPrintDePartida, salvarPrintMatch } from "../src/routes/upload.js";

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "m7-contestacao-print-"));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

describe("print em modo contestacao (sala encerrada)", () => {
  let ctx: any;
  let db: any;

  before(async () => {
    process.env.UPLOAD_DIR = path.join(tmpBase, "uploads");
    ctx = await setupDb();
    db = ctx.db;
  });

  after(async () => {
    await ctx.client.close();
    fs.rmSync(tmpBase, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });

  async function criaJogador(id: string) {
    await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador " + id.slice(0, 6) });
    await db.insert(userWallets).values({ userId: id, mc: 0, mcReservado: 0 });
  }

  /** Sala encerrada com um participante confirmado (pré-condição p/ contestar). */
  async function criaSalaEncerrada(dono: string, participante: string) {
    const [sala] = await db
      .insert(matches)
      .values({
        gameId: "lol", mode: "5v5", createdBy: dono, status: "encerrada",
        apostaMc: 0, taxaPct: "8.99", winnerSide: "blue", resultado: "blue", endedAt: new Date(),
      })
      .returning();
    await db.insert(matchPlayers).values({
      matchId: sala.id, userId: participante, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: false,
    });
    return sala;
  }

  test("validarPrintDePartida(contestacao) aceita encerrada; revisao rejeita", async () => {
    const dono = "c1001000-0000-0000-0000-000000000001";
    const jogador = "c1001000-0000-0000-0000-000000000002";
    await criaJogador(dono);
    await criaJogador(jogador);
    const sala = await criaSalaEncerrada(dono, jogador);

    const ok = await validarPrintDePartida(db, jogador, sala.id, "contestacao");
    assert.equal(ok.ok, true);

    const rejeitado = await validarPrintDePartida(db, jogador, sala.id, "revisao");
    assert.equal(rejeitado.ok, false);
    assert.equal(rejeitado.erro, "estado_invalido");
    assert.equal(rejeitado.estado, "encerrada");
  });

  test("validarPrintDePartida(contestacao) exige participante confirmado", async () => {
    const dono = "c1002000-0000-0000-0000-000000000001";
    const fora = "c1002000-0000-0000-0000-000000000002";
    await criaJogador(dono);
    await criaJogador(fora);
    const [sala] = await db
      .insert(matches)
      .values({
        gameId: "lol", mode: "5v5", createdBy: dono, status: "encerrada",
        apostaMc: 0, taxaPct: "8.99", winnerSide: "blue", resultado: "blue", endedAt: new Date(),
      })
      .returning();

    const r = await validarPrintDePartida(db, fora, sala.id, "contestacao");
    assert.equal(r.ok, false);
    assert.equal(r.erro, "nao_participante");
  });

  test("salvarPrintMatch(contestacao) insere print sem entrar em revisao", async () => {
    const dono = "c1003000-0000-0000-0000-000000000001";
    const jogador = "c1003000-0000-0000-0000-000000000002";
    await criaJogador(dono);
    await criaJogador(jogador);
    const sala = await criaSalaEncerrada(dono, jogador);

    const r = await salvarPrintMatch(db, {
      userId: jogador,
      matchId: sala.id,
      originalname: "print.png",
      buffer: PNG,
      mimetype: "image/png",
      modo: "contestacao",
    });
    assert.equal(r.ok, true);
    assert.equal(r.entrouEmRevisao, false);
    assert.match(r.url, /^\/api\/prints\/[0-9a-f-]{36}\/arquivo$/);

    const prints = await db.select().from(matchPrints).where(eq(matchPrints.matchId, sala.id));
    assert.equal(prints.length, 1);
    assert.equal(prints[0].userId, jogador);

    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id)).limit(1);
    assert.equal(m.status, "encerrada");
  });

  test("contestacao ignora teto de 3 prints da partida; revisao mantém", async () => {
    const dono = "c1004000-0000-0000-0000-000000000001";
    const p1 = "c1004000-0000-0000-0000-000000000002";
    const p2 = "c1004000-0000-0000-0000-000000000003";
    const p3 = "c1004000-0000-0000-0000-000000000004";
    const p4 = "c1004000-0000-0000-0000-000000000005";
    for (const id of [dono, p1, p2, p3, p4]) await criaJogador(id);

    // Sala encerrada com 3 prints já gravados: 4º contestante passa em
    // contestacao (cap da partida não se aplica)…
    const sala = await criaSalaEncerrada(dono, p1);
    await db.insert(matchPlayers).values([
      { matchId: sala.id, userId: p2, side: "blue", slot: 1, roleSlot: "JGL", confirmed: true, linked: false },
      { matchId: sala.id, userId: p3, side: "red", slot: 0, roleSlot: "TOP", confirmed: true, linked: false },
      { matchId: sala.id, userId: p4, side: "red", slot: 1, roleSlot: "JGL", confirmed: true, linked: false },
    ]);
    await db.insert(matchPrints).values([
      { matchId: sala.id, userId: p1, url: "/uploads/match-prints/a/1.png" },
      { matchId: sala.id, userId: p2, url: "/uploads/match-prints/a/2.png" },
      { matchId: sala.id, userId: p3, url: "/uploads/match-prints/a/3.png" },
    ]);

    const ok = await validarPrintDePartida(db, p4, sala.id, "contestacao");
    assert.equal(ok.ok, true);

    // …enquanto numa sala em partida_iniciada o modo revisao mantém o cap de 3.
    const [sala2] = await db.insert(matches).values({
      gameId: "lol", mode: "5v5", createdBy: dono, status: "partida_iniciada",
      apostaMc: 0, taxaPct: "8.99",
    }).returning();
    await db.insert(matchPlayers).values([
      { matchId: sala2.id, userId: p1, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: false },
      { matchId: sala2.id, userId: p2, side: "blue", slot: 1, roleSlot: "JGL", confirmed: true, linked: false },
      { matchId: sala2.id, userId: p3, side: "red", slot: 0, roleSlot: "TOP", confirmed: true, linked: false },
      { matchId: sala2.id, userId: p4, side: "red", slot: 1, roleSlot: "JGL", confirmed: true, linked: false },
    ]);
    await db.insert(matchPrints).values([
      { matchId: sala2.id, userId: p1, url: "/uploads/match-prints/b/1.png" },
      { matchId: sala2.id, userId: p2, url: "/uploads/match-prints/b/2.png" },
      { matchId: sala2.id, userId: p3, url: "/uploads/match-prints/b/3.png" },
    ]);

    const rejeitado = await validarPrintDePartida(db, p4, sala2.id, "revisao");
    assert.equal(rejeitado.ok, false);
    assert.equal(rejeitado.erro, "limite_prints");
  });
});
