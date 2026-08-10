import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { setupDb } from "./helpers.js";
import { avaliarTransicoes } from "../src/lib/match-flow.js";

async function criaJogador(db: any, id: string, mc: number, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador", riotId: "RIOT-" + id });
  await db.insert(userWallets).values({ userId: id, mc, mcReservado });
}

async function criaSalaApostada(db: any, values: any = {}) {
  const dono = crypto.randomUUID();
  await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
  const [sala] = await db.insert(matches).values({
    gameId: "lol",
    mode: "1v1",
    createdBy: dono,
    status: "confirmacao",
    apostaMc: 30,
    taxaPct: "8.99",
    confirmacaoExpiresAt: new Date(Date.now() - 10_000),
    maxJogadores: 2,
    ...values,
  }).returning();
  return sala;
}

describe("timeout de confirmacao: devolve o mc_reservado", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("jogador NAO confirmado removido pelo timeout recebe o mc_reservado de volta", async () => {
    const db = ctx.db;
    const a = "aaaaaaa1-0000-0000-0000-00000000000a";
    const b = "aaaaaaa1-0000-0000-0000-00000000000b";
    await criaJogador(db, a, 70, 30);
    await criaJogador(db, b, 70, 30);

    const sala = await criaSalaApostada(db);
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true });
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: b, side: "red", slot: 0, roleSlot: "MID", confirmed: false });

    // Timeout expira: B (não confirmado) deve ser removido E reembolsado.
    const r = await avaliarTransicoes(db as any, sala.id);
    assert.equal(r.estado, "preenchendo", "sala volta para preenchendo");

    const [bAntes] = await db.select().from(userWallets).where(eq(userWallets.userId, b));
    assert.equal(bAntes.mcReservado, 0, "B não pode ficar com MC preso após ser removido pelo timeout");
    assert.equal(bAntes.mc, 100, "B recebe de volta o stake de 30 (70 + 30)");

    const restantes = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    assert.equal(restantes.length, 1, "só A permanece na sala");
  });

  test("jogador CONFIRMADO que permanece na sala mantém o mc_reservado", async () => {
    const db = ctx.db;
    const a = "aaaaaaa1-0000-0000-0000-00000000001a";
    const b = "aaaaaaa1-0000-0000-0000-00000000001b";
    await criaJogador(db, a, 70, 30);
    await criaJogador(db, b, 70, 30);

    const sala = await criaSalaApostada(db);
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true });
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: b, side: "red", slot: 0, roleSlot: "MID", confirmed: false });

    await avaliarTransicoes(db as any, sala.id);

    const [aDepois] = await db.select().from(userWallets).where(eq(userWallets.userId, a));
    assert.equal(aDepois.mc, 70, "A (confirmado, ainda na sala) continua com o stake reservado");
    assert.equal(aDepois.mcReservado, 30);
  });

  test("admin exclui a sala: todo mc_reservado da sala volta para a carteira", async () => {
    const db = ctx.db;
    const a = "aaaaaaa1-0000-0000-0000-00000000002a";
    const b = "aaaaaaa1-0000-0000-0000-00000000002b";
    await criaJogador(db, a, 70, 30);
    await criaJogador(db, b, 70, 30);

    const sala = await criaSalaApostada(db);
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true });
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: b, side: "red", slot: 0, roleSlot: "MID", confirmed: false });

    // Simula o DELETE /api/matches/:id (matches.ts:390-415)
    const aposta = 30;
    const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    for (const p of players) {
      const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, p.userId));
      await db.update(userWallets)
        .set({ mc: w.mc + aposta, mcReservado: Math.max(0, w.mcReservado - aposta) })
        .where(eq(userWallets.userId, p.userId));
    }

    const [aDepois] = await db.select().from(userWallets).where(eq(userWallets.userId, a));
    const [bDepois] = await db.select().from(userWallets).where(eq(userWallets.userId, b));
    assert.equal(aDepois.mc, 100, "A recebe o stake de volta");
    assert.equal(aDepois.mcReservado, 0);
    assert.equal(bDepois.mc, 100, "B recebe o stake de volta");
    assert.equal(bDepois.mcReservado, 0);
  });
});
