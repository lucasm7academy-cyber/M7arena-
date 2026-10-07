import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { gameAccounts, games } from "../../db/schema/games.js";
import { setupDb } from "./helpers.js";
import { runRefreshElos, getRefreshElosStatus } from "../src/lib/atualizar-elos.js";

async function criaConta(db: any, userId: string, puuid: string, handle: string, metadata: any = null) {
  await db.insert(users).values({ id: userId, email: userId + "@x.com", displayName: "Jogador" });
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(gameAccounts).values({ userId, gameId: "lol", externalId: puuid, handle, verified: true, metadata });
}

const ELO_ANTERIOR = {
  soloQ: { tier: "DIAMOND", rank: "II", lp: 40, wins: 10, losses: 5 },
  flexQ: null,
};
const STALE = "2026-09-01T00:00:00.000Z";

describe("runRefreshElos (incidente 2026-10-07: falha da Riot não pode zerar o cache)", () => {
  let ctx: any;
  beforeEach(async () => { ctx = await setupDb(); });
  afterEach(async () => { await ctx.client.close(); });

  test("Riot falha (null) → elo_cache e stats_updated_at preservados, erro contado", async () => {
    const u = "bbbbbbb5-0000-0000-0000-000000000001";
    await criaConta(ctx.db, u, "PUUID_ELO_FALHA", "Falha#BR1", {
      elo_cache: ELO_ANTERIOR,
      stats_updated_at: STALE,
    });

    const r = await runRefreshElos(ctx.db, {
      force: true,
      paceMs: 0,
      buscarLeague: async () => null,
    });

    assert.equal(r.verificadas, 1);
    assert.equal(r.atualizadas, 0);
    assert.equal(r.erros, 1);
    const [ga] = await ctx.db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.deepEqual(ga.metadata.elo_cache, ELO_ANTERIOR, "elo anterior é preservado");
    assert.equal(
      ga.metadata.stats_updated_at,
      STALE,
      "stats_updated_at fica velho de propósito — a próxima rodada tenta de novo"
    );
  });

  test("conta genuinamente sem ranqueada ([]) → grava null e renova stats_updated_at", async () => {
    const u = "bbbbbbb5-0000-0000-0000-000000000002";
    await criaConta(ctx.db, u, "PUUID_ELO_VAZIO", "Casual#BR1", {
      elo_cache: ELO_ANTERIOR,
      stats_updated_at: STALE,
    });

    const r = await runRefreshElos(ctx.db, {
      force: true,
      paceMs: 0,
      buscarLeague: async () => [],
    });

    assert.equal(r.atualizadas, 1);
    assert.equal(r.erros, 0);
    const [ga] = await ctx.db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.metadata.elo_cache.soloQ, null);
    assert.equal(ga.metadata.elo_cache.flexQ, null);
    assert.notEqual(ga.metadata.stats_updated_at, STALE);
  });

  test("ranqueada válida → grava tier/rank/wins/losses das duas filas", async () => {
    const u = "bbbbbbb5-0000-0000-0000-000000000003";
    await criaConta(ctx.db, u, "PUUID_ELO_OK", "Ranqueado#BR1", null);

    const r = await runRefreshElos(ctx.db, {
      force: true,
      paceMs: 0,
      buscarLeague: async () => [
        { queueType: "RANKED_SOLO_5x5", tier: "MASTER", rank: "I", leaguePoints: 300, wins: 50, losses: 30 },
        { queueType: "RANKED_FLEX_SR", tier: "EMERALD", rank: "III", leaguePoints: 12, wins: 8, losses: 8 },
      ],
    });

    assert.equal(r.atualizadas, 1);
    const [ga] = await ctx.db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.metadata.elo_cache.soloQ.tier, "MASTER");
    assert.equal(ga.metadata.elo_cache.soloQ.wins, 50);
    assert.equal(ga.metadata.elo_cache.flexQ.tier, "EMERALD");
  });

  test("single-flight: chamada concorrente devolve a MESMA execução (uma varredura só)", async () => {
    const u = "bbbbbbb5-0000-0000-0000-000000000004";
    await criaConta(ctx.db, u, "PUUID_ELO_SINGLE", "Single#BR1", null);

    let libera!: () => void;
    const gate = new Promise<void>((ok) => { libera = ok; });
    let chamadas = 0;

    const p1 = runRefreshElos(ctx.db, {
      force: true,
      paceMs: 0,
      buscarLeague: async () => {
        chamadas++;
        await gate;
        return [];
      },
    });
    const p2 = runRefreshElos(ctx.db, {
      force: true,
      paceMs: 0,
      buscarLeague: async () => {
        chamadas++;
        return [];
      },
    });

    assert.equal(p1, p2, "a segunda chamada reaproveita a execução em andamento");
    libera();
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.deepEqual(r1, r2);
    assert.equal(chamadas, 1, "a Riot foi consultada uma única vez");
  });

  test("status pós-execução: emAndamento false, resultado preenchido", async () => {
    const u = "bbbbbbb5-0000-0000-0000-000000000005";
    await criaConta(ctx.db, u, "PUUID_ELO_STATUS", "Status#BR1", null);

    await runRefreshElos(ctx.db, { force: true, paceMs: 0, buscarLeague: async () => [] });

    const st = getRefreshElosStatus();
    assert.equal(st.emAndamento, false);
    assert.ok(st.iniciadoEm);
    assert.ok(st.finalizadoEm);
    assert.deepEqual(st.resultado, { verificadas: 1, atualizadas: 1, erros: 0 });
  });
});
