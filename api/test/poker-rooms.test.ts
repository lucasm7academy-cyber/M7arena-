import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import express from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users, userWallets, userSessions } from "../../db/schema/identidade.js";
import { walletTransactions } from "../../db/schema/economia.js";
import { pokerRooms, pokerSessions } from "../../db/schema/poker.js";
import { setupDb } from "./helpers.js";

const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const valid = { name: "Mesa dos amigos", sb: 10, bb: 20, seats: 6, isPrivate: false, valendoEssencia: true };

describe("mesas de poker — HTTP real e PGlite isolado", () => {
  let ctx: Awaited<ReturnType<typeof setupDb>>;
  let server: Server;
  let base: string;
  let pool: any;

  async function request(method: string, route: string, body?: any, userId?: string) {
    const res = await fetch(base + route, {
      method,
      headers: { "Content-Type": "application/json", ...(userId ? { Authorization: `Bearer ${userId}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, body: await res.json() as any };
  }
  async function create(overrides = {}) {
    const response = await request("POST", "/rooms", { ...valid, ...overrides }, OWNER);
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal("passwordHash" in response.body.room, false);
    return response.body.room;
  }
  before(async () => {
    ctx = await setupDb();
    for (const id of [OWNER, OTHER]) {
      await ctx.db.insert(users).values({ id, email: `${id}@test.invalid`, displayName: id === OWNER ? "Dono" : "Outro" });
      await ctx.db.insert(userWallets).values({ userId: id, ea: 100000, mc: 7000 });
      await ctx.db.insert(userSessions).values({ userId: id, sessionToken: id, expires: new Date(Date.now() + 60000) });
    }
    const runtime = await import("../src/db.js");
    pool = runtime.pool;
    mock.method(runtime.db, "select", (...args: any[]) => (ctx.db.select as any)(...args));
    mock.method(runtime.db, "transaction", (fn: any) => ctx.db.transaction(fn));
    for (const name of ["connect", "query"] as const) {
      mock.method(pool, name, () => { throw new Error("Banco externo proibido"); });
    }
    const { pokerRouter } = await import("../src/modules/poker/routes.js");
    const app = express();
    app.use(express.json());
    app.use("/api/poker", pokerRouter);
    server = await new Promise<Server>(resolve => {
      const running = app.listen(0, "127.0.0.1", () => resolve(running));
    });
    const address = server.address();
    assert(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}/api/poker`;
  });
  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
    mock.restoreAll();
    await pool?.end();
    await ctx?.client.close();
  });

  test("criação exige autenticação", async () => {
    assert.equal((await request("POST", "/rooms", valid)).status, 401);
    assert.equal((await ctx.db.select().from(pokerRooms)).length, 0);
  });

  test("pública aparece para todos; privada só para dono, sem hash ou classificação", async () => {
    const pub = await create({ name: "  Mesa pública  ", buyIn: 1 });
    assert.equal(pub.name, "Mesa pública");
    assert.equal(pub.buyIn, 2000, "valor é calculado pelo servidor, não pelo campo extra");
    assert.equal(pub.ownerName, "Dono");
    const priv = await create({ isPrivate: true, password: "segredo" });
    const [stored] = await ctx.db.select().from(pokerRooms).where(eq(pokerRooms.id, priv.id));
    assert.notEqual(stored.passwordHash, "segredo");
    assert.equal(await bcrypt.compare("segredo", stored.passwordHash!), true);
    for (const viewer of [undefined, OTHER, OWNER]) {
      const response = await request("GET", "/rooms", undefined, viewer);
      assert.equal(response.status, 200);
      const rooms = response.body.rooms;
      assert(rooms.some((r: any) => r.id === pub.id));
      assert.equal(rooms.some((r: any) => r.id === priv.id), viewer === OWNER);
      const house = rooms.find((r: any) => r.id === "m7");
      assert.equal(house.ownerName, "M7");
      assert.equal(house.isPrivate, false);
      assert.equal(rooms.filter((r: any) => r.ownerName === "M7").length, 1);
      for (const room of rooms) assert.deepEqual(Object.keys(room).sort(),
        ["id", "name", "sb", "bb", "buyIn", "seats", "seated", "isPrivate", "ownerName"].sort());
    }
    await ctx.db.update(pokerRooms).set({ status: "closed" }).where(eq(pokerRooms.id, pub.id));
    assert.equal((await request("GET", "/rooms", undefined, OWNER)).body.rooms.some((r: any) => r.id === pub.id), false);
    assert.equal((await request("POST", "/buyin", { roomId: pub.id, buyIn: 2000 }, OWNER)).status, 400);
  });

  test("nome/blinds/seats/senha/valendoEssencia inválidos retornam 400 sem gravação", async () => {
    const beforeRooms = await ctx.db.select().from(pokerRooms);
    const invalid = [
      { name: "" }, { name: "   " }, { name: "ab" }, { name: "a".repeat(41) },
      { sb: 1 }, { bb: 10 }, { sb: "10" }, { sb: 2, bb: 5 },
      { seats: 1 }, { seats: 7 }, { seats: 2.5 }, { seats: "6" },
      { valendoEssencia: undefined }, { valendoEssencia: "true" }, { isPrivate: "false" },
      { isPrivate: true }, { isPrivate: true, password: "123" },
      { isPrivate: true, password: "a".repeat(33) }, { isPrivate: true, password: 12345 },
    ];
    for (const overrides of invalid) {
      const res = await request("POST", "/rooms", { ...valid, ...overrides }, OWNER);
      assert.equal(res.status, 400, JSON.stringify(overrides));
      assert.equal(res.body.ok, false);
      assert.equal(res.body.erro, res.body.error);
      if ("sb" in overrides || "bb" in overrides) assert.equal(res.body.erro, "blinds_invalidos");
    }
    assert.deepEqual(await ctx.db.select().from(pokerRooms), beforeRooms);
  });

  test("todos os pares de blinds calculam buyIn; treino usa zero", async () => {
    for (const [sb, bb] of [[5, 10], [10, 20], [25, 50], [50, 100]]) {
      assert.equal((await create({ sb, bb, seats: 2 })).buyIn, 100 * bb);
      assert.equal((await create({ sb, bb, valendoEssencia: false })).buyIn, 0);
    }
  });

  test("buyin exato e senha: recusas não alteram saldo/sessões; entrada grava ledger e ocupação", async () => {
    const room = await create({ isPrivate: true, password: "segredo" });
    const [beforeWallet] = await ctx.db.select().from(userWallets).where(eq(userWallets.userId, OTHER));
    for (const body of [
      { roomId: room.id, buyIn: room.buyIn, password: "errada" },
      { roomId: room.id, buyIn: room.buyIn },
      { roomId: room.id, buyIn: 100, password: "segredo" },
    ]) {
      const res = await request("POST", "/buyin", body, OTHER);
      assert.equal(res.status, 400);
      assert.equal(res.body.erro, body.password === "segredo" ? "valor_invalido" : "senha_invalida");
    }
    assert.equal((await ctx.db.select().from(pokerSessions).where(eq(pokerSessions.userId, OTHER))).length, 0);
    const entered = await request("POST", "/buyin", { roomId: room.id, buyIn: room.buyIn, password: "segredo" }, OTHER);
    assert.equal(entered.status, 200);
    assert.equal(entered.body.ea, beforeWallet.ea - room.buyIn);
    const [ledger] = await ctx.db.select().from(walletTransactions).where(eq(walletTransactions.refId, entered.body.sessionId));
    assert.equal(ledger.kind, "poker_buyin");
    assert.equal(ledger.amount, -room.buyIn);
    assert.equal(ledger.balanceAfter, entered.body.ea);
    assert.equal(ledger.currency, "ea");
    const [session] = await ctx.db.select().from(pokerSessions).where(eq(pokerSessions.id, entered.body.sessionId));
    assert.equal(session.status, "open");
    assert.equal(session.buyIn, room.buyIn);
    const listed = (await request("GET", "/rooms", undefined, OWNER)).body.rooms.find((r: any) => r.id === room.id);
    assert.equal(listed.seated, 1);
  });

  test("treino abre sessão sem débito/ledger e encerra sem converter fichas em EA", async () => {
    const room = await create({ valendoEssencia: false });
    const [beforeWallet] = await ctx.db.select().from(userWallets).where(eq(userWallets.userId, OWNER));
    const beforeLedger = await ctx.db.select().from(walletTransactions);
    const entered = await request("POST", "/buyin", { roomId: room.id, buyIn: 0 }, OWNER);
    assert.equal(entered.status, 200);
    assert.equal(entered.body.ea, beforeWallet.ea);
    const [session] = await ctx.db.select().from(pokerSessions).where(eq(pokerSessions.id, entered.body.sessionId));
    assert.equal(session.buyIn, 0);
    assert.equal(session.status, "open");
    assert.deepEqual(await ctx.db.select().from(walletTransactions), beforeLedger);
    const closed = await request("POST", "/cashout", { sessionId: session.id, stack: 5000 }, OWNER);
    assert.equal(closed.status, 200);
    assert.equal(closed.body.payout, 0);
    assert.equal(closed.body.ea, beforeWallet.ea);
    assert.deepEqual(await ctx.db.select().from(walletTransactions), beforeLedger);
    assert.deepEqual((await ctx.db.select().from(userWallets).where(eq(userWallets.userId, OWNER)))[0], beforeWallet);
    assert.equal((await request("GET", "/rooms")).body.rooms.find((r: any) => r.id === room.id).seated, 0);
  });

  test("única mesa da casa mantém buyin e contagem de sessões abertas", async () => {
    const entered = await request("POST", "/buyin", { roomId: "m7", buyIn: 2000 }, OWNER);
    assert.equal(entered.status, 200);
    assert.equal((await request("GET", "/rooms")).body.rooms.find((r: any) => r.id === "m7").seated, 1);
    assert.equal((await request("POST", "/buyin", { roomId: "nao-existe", buyIn: 500 }, OWNER)).status, 400);
    assert.equal((await request("POST", "/cashout", { sessionId: entered.body.sessionId, stack: 1000 }, OWNER)).status, 200);
    assert.equal((await request("GET", "/rooms")).body.rooms.find((r: any) => r.id === "m7").seated, 0);
  });
});
