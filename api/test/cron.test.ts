import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { userStrikes } from "../../db/schema/apostas.js";
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
  test("kick de ociosidade remove vaga ocupada há 30min e devolve o MC", async () => {
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
        createdAt: new Date(Date.now() - 31 * 60 * 1000),
      });

      const r = await runCron(db);
      assert.equal(r.kikados, 1);

      const vagas = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
      assert.equal(vagas.length, 0);
      const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, jogador));
      assert.equal(w.mc, 100);
      assert.equal(w.mcReservado, 0);
      const strikes = await db.select().from(userStrikes).where(eq(userStrikes.userId, jogador));
      assert.equal(strikes.length, 1);
      assert.equal(strikes[0].motivo, "kick_ociosidade");
    } finally {
      await client.close();
    }
  });

  test("vaga recente (< 30min) NÃO é kikada", async () => {
    const { client, db } = await setupDb();
    try {
      const jogador = "aaaaaaa3-0000-0000-0000-000000000002";
      await criaJogador(db, jogador, 70, 30);
      const sala = await criaSala(db, { status: "preenchendo", apostaMc: 30 });
      await db.insert(matchPlayers).values({
        matchId: sala.id,
        userId: jogador,
        side: "blue",
        slot: 0,
        roleSlot: "TOP",
        confirmed: false,
        createdAt: new Date(),
      });

      const r = await runCron(db);
      assert.equal(r.kikados, 0);
      const vagas = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
      assert.equal(vagas.length, 1);
    } finally {
      await client.close();
    }
  });

  test("partida fantasma move para aguardando_revisao", async () => {
    const { client, db } = await setupDb();
    try {
      const sala = await criaSala(db, {
        status: "partida_iniciada",
        apostaMc: 50,
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000),
      });

      const r = await runCron(db);
      assert.equal(r.fantasmas, 1);

      const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
      assert.equal(m.status, "aguardando_revisao");
      assert.ok(m.revisaoDesde);
    } finally {
      await client.close();
    }
  });

  test("partida casual (aposta 0) iniciada há 3h sem print também vira fantasma", async () => {
    const { client, db } = await setupDb();
    try {
      const sala = await criaSala(db, {
        status: "partida_iniciada",
        apostaMc: 0,
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000),
      });

      const r = await runCron(db);
      assert.equal(r.fantasmas, 1);
      const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
      assert.equal(m.status, "aguardando_revisao");
    } finally {
      await client.close();
    }
  });
});
