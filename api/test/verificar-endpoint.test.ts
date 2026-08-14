import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { gameAccounts, games } from "../../db/schema/games.js";
import { setupDb } from "./helpers.js";
import { verificarPartida } from "../src/lib/verificar-partida.js";

describe("endpoint verificar (lógica de rota)", () => {
  test("sala partida_iniciada responde encerrada quando o motor resolve", async () => {
    const { client, db } = await setupDb();
    try {
      const a = "aaaaaaa5-0000-0000-0000-000000000001";
      const c = "aaaaaaa5-0000-0000-0000-000000000002";
      await db.insert(users).values({ id: a, email: a + "@x.com", displayName: "A" });
      await db.insert(userWallets).values({ userId: a, mc: 70, mcReservado: 30 });
      await db.insert(users).values({ id: c, email: c + "@x.com", displayName: "C" });
      await db.insert(userWallets).values({ userId: c, mc: 70, mcReservado: 30 });
      await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
      await db.insert(gameAccounts).values({ userId: a, gameId: "lol", externalId: "PUUID_A", handle: "a#BR1", verified: true });
      await db.insert(gameAccounts).values({ userId: c, gameId: "lol", externalId: "PUUID_C", handle: "c#BR1", verified: true });
      const dono = crypto.randomUUID();
      await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
      const [sala] = await db.insert(matches).values({
        gameId: "lol", mode: "5v5", createdBy: dono, status: "partida_iniciada",
        apostaMc: 30, taxaPct: "8.99", codigoPartida: "BR-TEST-COD-0001", iniciandoPartidaAt: new Date(),
      }).returning();
      await db.insert(matchPlayers).values([
        { matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
        { matchId: sala.id, userId: c, side: "red", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
      ]);

      // A rota chama verificarPartida; aqui testamos o contrato de retorno que o
      // handler monta a partir do resultado do motor.
      const r = await verificarPartida(db, sala.id, {
        buscarIds: async () => ["BR1_9999999999"],
        buscarMatch: async () => ({
          metadata: { matchId: "BR1_9999999999" },
          info: {
            tournamentCode: "BR-TEST-COD-0001",
            gameCreation: Date.now(),
            endOfGameResult: "GameComplete",
            participants: [{ puuid: "PUUID_A", teamId: 100 }, { puuid: "PUUID_C", teamId: 200 }],
            teams: [{ teamId: 100, win: true }, { teamId: 200, win: false }],
          },
        }),
      });

      assert.equal(r.ok, true);
      assert.equal(r.estado, "encerrada");
      // shape legado que o front consome
      const body = { ok: true, estado: r.estado, vencedor: r.winnerSide === "blue" ? "A" : "B", matchIdRiot: r.matchIdRiot };
      assert.equal(body.vencedor, "A");
    } finally {
      await client.close();
    }
  });
});
