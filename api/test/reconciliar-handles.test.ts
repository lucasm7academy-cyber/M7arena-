import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { gameAccounts, games } from "../../db/schema/games.js";
import { setupDb } from "./helpers.js";
import { runReconciliacaoHandles } from "../src/lib/reconciliar-handles.js";

async function criaConta(db: any, userId: string, puuid: string, handle: string, metadata: any = null) {
  await db.insert(users).values({ id: userId, email: userId + "@x.com", displayName: "Jogador" });
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(gameAccounts).values({ userId, gameId: "lol", externalId: puuid, handle, verified: true, metadata });
}

describe("runReconciliacaoHandles", () => {
  let ctx: any;
  beforeEach(async () => { ctx = await setupDb(); });
  afterEach(async () => { await ctx.client.close(); });

  test("nome, ícone e nível mudaram na Riot → atualiza handle, espelho e metadata", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000001";
    await criaConta(db, u, "PUUID_REC_1", "CGM GUERRA#BR1", { profile_icon_id: 1, level: 100, elo_cache: { soloQ: null } });
    await db.update(users).set({ riotId: "CGM GUERRA#BR1" }).where(eq(users.id, u));

    const r = await runReconciliacaoHandles(db, {
      buscarPerfil: async (puuid) =>
        puuid === "PUUID_REC_1"
          ? { gameName: "GuerraNovo", tagLine: "BR1", profileIconId: 7185, summonerLevel: 333 }
          : null,
    });

    assert.equal(r.total, 1);
    assert.equal(r.atualizadas, 1);
    assert.equal(r.erros, 0);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "GuerraNovo#BR1");
    assert.equal(ga.metadata.profile_icon_id, 7185);
    assert.equal(ga.metadata.level, 333);
    assert.deepEqual(ga.metadata.elo_cache, { soloQ: null }, "campos não tocados são preservados");
    const [user] = await db.select().from(users).where(eq(users.id, u));
    assert.equal(user.riotId, "GuerraNovo#BR1");
  });

  test("só o ícone mudou → atualiza metadata sem mexer no handle", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000005";
    await criaConta(db, u, "PUUID_REC_5", "MesmoNome#BR1", { profile_icon_id: 1, level: 100 });

    const r = await runReconciliacaoHandles(db, {
      buscarPerfil: async () => ({ gameName: "MesmoNome", tagLine: "BR1", profileIconId: 7185, summonerLevel: 100 }),
    });

    assert.equal(r.atualizadas, 1);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "MesmoNome#BR1");
    assert.equal(ga.metadata.profile_icon_id, 7185);
  });

  test("nada mudou → nenhuma escrita", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000002";
    await criaConta(db, u, "PUUID_REC_2", "MesmoNome#BR1", { profile_icon_id: 7185, level: 333 });

    const r = await runReconciliacaoHandles(db, {
      buscarPerfil: async () => ({ gameName: "MesmoNome", tagLine: "BR1", profileIconId: 7185, summonerLevel: 333 }),
    });

    assert.equal(r.atualizadas, 0);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "MesmoNome#BR1");
  });

  test("Riot falha (null) → handle e metadata preservados e conta em erros", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000003";
    await criaConta(db, u, "PUUID_REC_3", "VelhoNome#BR1", { profile_icon_id: 1, level: 100 });

    const r = await runReconciliacaoHandles(db, { buscarPerfil: async () => null });

    assert.equal(r.erros, 1);
    assert.equal(r.atualizadas, 0);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "VelhoNome#BR1", "handle nunca deve ser zerado em falha");
    assert.equal(ga.metadata.profile_icon_id, 1, "ícone nunca deve ser zerado em falha");
  });

  test("summoner indisponível (só o nome veio) → atualiza nome e preserva ícone", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000006";
    await criaConta(db, u, "PUUID_REC_6", "VelhoNome#BR1", { profile_icon_id: 1, level: 100 });

    const r = await runReconciliacaoHandles(db, {
      buscarPerfil: async () => ({ gameName: "NovoNome", tagLine: "BR1", profileIconId: null, summonerLevel: null }),
    });

    assert.equal(r.atualizadas, 1);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "NovoNome#BR1");
    assert.equal(ga.metadata.profile_icon_id, 1, "sem dado novo, ícone velho é preservado");
  });

  test("contas de outro jogo são ignoradas", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000004";
    await db.insert(users).values({ id: u, email: u + "@x.com", displayName: "Jogador" });
    await db.insert(games).values({ id: "valorant", name: "Valorant" }).onConflictDoNothing();
    await db.insert(gameAccounts).values({ userId: u, gameId: "valorant", externalId: "VALO_1", handle: "x#x", verified: true });

    const r = await runReconciliacaoHandles(db, {
      buscarPerfil: async () => ({ gameName: "X", tagLine: "X", profileIconId: null, summonerLevel: null }),
    });

    assert.equal(r.total, 0, "só contas de lol entram no lote");
    assert.equal(r.atualizadas, 0);
  });
});
