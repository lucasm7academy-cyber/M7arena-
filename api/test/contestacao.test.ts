import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { matchDisputas } from "../../db/schema/apostas.js";
import { setupDb } from "./helpers.js";
import { abrirDisputa } from "../src/routes/disputas.js";

describe("contestação em sala encerrada", () => {
  let ctx: any;
  before(async () => { ctx = await setupDb(); });
  after(async () => { await ctx.client.close(); });

  test("abre disputa em encerrada com contestacaoUrl", async () => {
    const db = ctx.db;
    const a = "aaaaaaa6-0000-0000-0000-000000000001";
    await db.insert(users).values({ id: a, email: a + "@x.com", displayName: "A" });
    await db.insert(userWallets).values({ userId: a, mc: 0, mcReservado: 0 });
    const dono = crypto.randomUUID();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const [sala] = await db.insert(matches).values({
      gameId: "lol", mode: "5v5", createdBy: dono, status: "encerrada",
      apostaMc: 0, taxaPct: "8.99", winnerSide: "blue", resultado: "blue", endedAt: new Date(),
    }).returning();
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: false });

    const r = await abrirDisputa(db, { userId: a, matchId: sala.id, motivo: "resultado errado", contestacaoUrl: "/api/prints/abc/arquivo" });
    assert.equal(r.ok, true);
    const [d] = await db.select().from(matchDisputas).where(eq(matchDisputas.matchId, sala.id));
    assert.equal(d.contestacaoUrl, "/api/prints/abc/arquivo");
  });

  test("rejeita disputa de quem não participou", async () => {
    const db = ctx.db;
    const forasteiro = "aaaaaaa6-0000-0000-0000-000000000002";
    await db.insert(users).values({ id: forasteiro, email: forasteiro + "@x.com", displayName: "F" });
    const dono = crypto.randomUUID();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const [sala] = await db.insert(matches).values({
      gameId: "lol", mode: "5v5", createdBy: dono, status: "encerrada",
      apostaMc: 0, taxaPct: "8.99", winnerSide: "blue", resultado: "blue", endedAt: new Date(),
    }).returning();

    const r = await abrirDisputa(db, { userId: forasteiro, matchId: sala.id, motivo: "quero contestar" });
    assert.equal(r.ok, false);
    assert.equal(r.erro, "nao_participante");
  });
});
