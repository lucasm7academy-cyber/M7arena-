import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers, matchCodes } from "../../db/schema/matches.js";
import { setupDb } from "./helpers.js";
import { runCron } from "../src/cron.js";

async function criaJogador(db: any, id: string, mc: number, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
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

describe("cron", () => {
  test("kick de ociosidade foi removido (ADR-033): vaga antiga não é mais kickada", async () => {
    const { client, db } = await setupDb();
    try {
      const jogador = "aaaaaaa3-0000-0000-0000-000000000001";
      await criaJogador(db, jogador, 70, 30);
      const sala = await criaSala(db, { status: "preenchendo", apostaMc: 30 });
      await db.insert(matchPlayers).values({
        matchId: sala.id,
        userId: jogador,
        side: "blue",
        slot: 0,
        roleSlot: "TOP",
        confirmed: false,
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const r = await runCron(db);
      assert.equal(r.verificadas, 0, "cron não encerra sala em preenchimento");
      assert.equal(r.canceladas, 0, "cron não cancela sala em preenchimento");

      // A vaga continua lá, o usuário não perde nada (punição é manual agora).
      const vagas = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
      assert.equal(vagas.length, 1);
    } finally {
      await client.close();
    }
  });

  test("partida fantasma (>= 3h) vira cancelada e devolve", async () => {
    const { client, db } = await setupDb();
    try {
      const jogador = "aaaaaaa3-0000-0000-0000-000000000050";
      await db.insert(users).values({ id: jogador, email: jogador + "@x.com", displayName: "Jogador" });
      await db.insert(userWallets).values({ userId: jogador, mc: 50, mcReservado: 50 });
      const sala = await criaSala(db, {
        status: "partida_iniciada",
        apostaMc: 50,
        codigoPartida: "BR-TEST-FANTASMA-0002",
        iniciandoPartidaAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000),
      });
      await db.insert(matchPlayers).values({ matchId: sala.id, userId: jogador, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: true });

      const r = await runCron(db);
      assert.ok(r.canceladas >= 1, "fantasma de 3h deve cancelar");
      const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
      assert.equal(m.status, "cancelada");
      const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, jogador));
      assert.equal(w.mc, 100, "reserva devolvida");
      assert.equal(w.mcReservado, 0);
    } finally {
      await client.close();
    }
  });

  test("partida fantasma devolve o tournament code ao pool (fix SEM-CODIGO-AGUARDE)", async () => {
    const { client, db } = await setupDb();
    try {
      const sala = await criaSala(db, {
        status: "partida_iniciada",
        apostaMc: 50,
        codigoPartida: "BR-TEST-FANTASMA-0001",
        iniciandoPartidaAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000),
      });
      // Simula um código atribuído à sala (era assim que ficava preso).
      const [codigo] = await db.insert(matchCodes).values({ code: "BR-TEST-FANTASMA-0001", used: true, matchId: sala.id }).returning();

      await runCron(db);

      const [c] = await db.select().from(matchCodes).where(eq(matchCodes.id, codigo.id));
      assert.equal(c.used, false, "código de partida fantasma deve voltar ao pool");
      assert.equal(c.matchId, null, "código não pode continuar vinculado à sala");
    } finally {
      await client.close();
    }
  });

  test("partida casual (aposta 0) >= 3h vira cancelada", async () => {
    const { client, db } = await setupDb();
    try {
      const sala = await criaSala(db, {
        status: "partida_iniciada",
        apostaMc: 0,
        codigoPartida: "BR-TEST-FANTASMA-0003",
        iniciandoPartidaAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000),
      });
      const r = await runCron(db);
      assert.ok(r.canceladas >= 1);
      const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
      assert.equal(m.status, "cancelada");
    } finally {
      await client.close();
    }
  });

  test("saneamento: sala presa em 'finalizacao' (estado morto) vira encerrada e libera linked", async () => {
    const { client, db } = await setupDb();
    try {
      const jogador = "aaaaaaa3-0000-0000-0000-000000000003";
      await criaJogador(db, jogador, 100, 0);
      // Estado morto do ADR-027: a votação foi removida, mas a sala ficou no banco.
      const sala = await criaSala(db, {
        status: "finalizacao",
        apostaMc: 0,
      });
      await db.insert(matchPlayers).values({
        matchId: sala.id,
        userId: jogador,
        side: "blue",
        slot: 0,
        roleSlot: "TOP",
        confirmed: true,
        linked: true,
      });

      const r = await runCron(db);
      assert.ok(r.sanitizadas >= 1, "cron deve sinalizar sala sanitizada");

      const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
      assert.equal(m.status, "encerrada");

      const [vaga] = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
      assert.equal(vaga.linked, false);
    } finally {
      await client.close();
    }
  });

  test("saneamento: linked residual em sala 'encerrada' é liberado (bug ja_em_outra_sala)", async () => {
    const { client, db } = await setupDb();
    try {
      const jogador = "aaaaaaa3-0000-0000-0000-000000000004";
      await criaJogador(db, jogador, 100, 0);
      const sala = await criaSala(db, {
        status: "encerrada",
        apostaMc: 0,
        endedAt: new Date(),
      });
      await db.insert(matchPlayers).values({
        matchId: sala.id,
        userId: jogador,
        side: "blue",
        slot: 0,
        roleSlot: "TOP",
        confirmed: true,
        linked: true,
      });

      const r = await runCron(db);
      const [vaga] = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
      assert.equal(vaga.linked, false, "linked residual deve ser liberado pelo cron");
    } finally {
      await client.close();
    }
  });
});
