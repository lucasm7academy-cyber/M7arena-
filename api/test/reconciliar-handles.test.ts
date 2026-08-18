import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { gameAccounts, games } from "../../db/schema/games.js";
import { setupDb } from "./helpers.js";
import { runReconciliacaoHandles } from "../src/lib/reconciliar-handles.js";

async function criaConta(db: any, userId: string, puuid: string, handle: string) {
  await db.insert(users).values({ id: userId, email: userId + "@x.com", displayName: "Jogador" });
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(gameAccounts).values({ userId, gameId: "lol", externalId: puuid, handle, verified: true });
}

describe("runReconciliacaoHandles", () => {
  let ctx: any;
  beforeEach(async () => { ctx = await setupDb(); });
  afterEach(async () => { await ctx.client.close(); });

  test("nome mudou na Riot → atualiza handle e espelho users.riot_id", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000001";
    await criaConta(db, u, "PUUID_REC_1", "CGM GUERRA#BR1");
    await db.update(users).set({ riotId: "CGM GUERRA#BR1" }).where(eq(users.id, u));

    const r = await runReconciliacaoHandles(db, {
      buscarNome: async (puuid) =>
        puuid === "PUUID_REC_1" ? { gameName: "GuerraNovo", tagLine: "BR1" } : null,
    });

    assert.equal(r.total, 1);
    assert.equal(r.atualizadas, 1);
    assert.equal(r.erros, 0);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "GuerraNovo#BR1");
    const [user] = await db.select().from(users).where(eq(users.id, u));
    assert.equal(user.riotId, "GuerraNovo#BR1");
  });

  test("nome igual → nenhuma escrita", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000002";
    await criaConta(db, u, "PUUID_REC_2", "MesmoNome#BR1");

    const r = await runReconciliacaoHandles(db, {
      buscarNome: async () => ({ gameName: "MesmoNome", tagLine: "BR1" }),
    });

    assert.equal(r.atualizadas, 0);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "MesmoNome#BR1");
  });

  test("Riot falha (null) → handle preservado e conta em erros", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000003";
    await criaConta(db, u, "PUUID_REC_3", "VelhoNome#BR1");

    const r = await runReconciliacaoHandles(db, { buscarNome: async () => null });

    assert.equal(r.erros, 1);
    assert.equal(r.atualizadas, 0);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "VelhoNome#BR1", "handle nunca deve ser zerado em falha");
  });

  test("contas de outro jogo são ignoradas", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000004";
    await db.insert(users).values({ id: u, email: u + "@x.com", displayName: "Jogador" });
    await db.insert(games).values({ id: "valorant", name: "Valorant" }).onConflictDoNothing();
    await db.insert(gameAccounts).values({ userId: u, gameId: "valorant", externalId: "VALO_1", handle: "x#x", verified: true });

    const r = await runReconciliacaoHandles(db, { buscarNome: async () => ({ gameName: "X", tagLine: "X" }) });

    assert.equal(r.total, 0, "só contas de lol entram no lote");
    assert.equal(r.atualizadas, 0);
  });
});