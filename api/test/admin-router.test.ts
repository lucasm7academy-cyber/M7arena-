import { after, before, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";

// O router real roda em HTTP local; toda consulta é simulada e escrita é proibida.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:9/m7arena_test";
const { db, pool } = await import("../src/db.js");
const endpoints = [
  ["POST", "/usuarios/00000000-0000-0000-0000-000000000002/reset-link"],
  ["GET", "/cargos"], ["PUT", "/cargos/00000000-0000-0000-0000-000000000002"],
  ["GET", "/usuarios?q=fixture"], ["GET", "/advertencias/fixture"],
  ["POST", "/advertencias"], ["DELETE", "/advertencias/fixture"],
  ["POST", "/usuarios/fixture/ban"], ["POST", "/usuarios/fixture/unban"],
] as const;

let server: Server;
let base = "";
let rowsQueue: unknown[][] = [];
let distinctRows: unknown[] = [];
let selectCalls = 0;
let writes = 0;
let connections = 0;
let routers: any[];

function query(rows: unknown[]) {
  const result: any = {
    from: () => result, where: () => result, limit: () => result,
    leftJoin: () => result, orderBy: () => result,
    then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
  };
  return result;
}

function identity(roles: string[]) {
  rowsQueue = [
    [{ userId: "00000000-0000-0000-0000-000000000001" }],
    [{ id: "00000000-0000-0000-0000-000000000001" }],
    roles.map(role => ({ role })),
  ];
}

async function request(method: string, path: string, authenticated = true) {
  const response = await fetch(base + path, {
    method, headers: { "Content-Type": "application/json", ...(authenticated ? { Cookie: "m7_session=fixture-only" } : {}) },
    ...(method === "GET" ? {} : { body: JSON.stringify({ cargo: "admin", userId: "fixture", motivo: "fixture" }) }),
  });
  return { status: response.status, body: await response.json() };
}

describe("fronteira HTTP administrativa (sem banco ou mutações)", () => {
  before(async () => {
    const forbiddenWrite = () => { writes++; throw new Error("Escrita proibida neste teste"); };
    for (const name of ["insert", "update", "delete", "transaction", "execute"] as const) mock.method(db as any, name, forbiddenWrite);
    for (const name of ["connect", "query"] as const) mock.method(pool as any, name, () => {
      connections++; throw new Error("Conexão com banco proibida neste teste");
    });
    mock.method(db, "select", () => {
      selectCalls++;
      if (!rowsQueue.length) throw new Error("Consulta não prevista pelo cenário");
      return query(rowsQueue.shift()!) as any;
    });
    mock.method(db, "selectDistinctOn", () => query(distinctRows) as any);
    const { adminRouter } = await import("../src/modules/admin/routes.js");
    const { adminPasswordResetRouter } = await import("../src/modules/admin/password-reset-routes.js");
    routers = [adminPasswordResetRouter, adminRouter];
    const app = express();
    app.use(express.json(), cookieParser());
    for (const router of routers) app.use("/api/admin", router);
    server = await new Promise<Server>(resolve => {
      const running = app.listen(0, "127.0.0.1", () => resolve(running));
    });
    const address = server.address();
    assert(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}/api/admin`;
  });

  beforeEach(() => { rowsQueue = []; distinctRows = []; selectCalls = 0; writes = 0; connections = 0; });
  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
    mock.restoreAll();
    await pool.end();
  });

  test("mantém os nove registros e o router de recuperação primeiro", () => {
    const actual = routers.flatMap(router => router.stack.filter((layer: any) => layer.route)
      .flatMap((layer: any) => Object.keys(layer.route.methods).map(method => `${method.toUpperCase()} ${layer.route.path}`)));
    assert.deepEqual(actual, ["POST /usuarios/:userId/reset-link", "GET /cargos", "PUT /cargos/:userId",
      "GET /usuarios", "GET /advertencias/:userId", "POST /advertencias", "DELETE /advertencias/:id",
      "POST /usuarios/:userId/ban", "POST /usuarios/:userId/unban"]);
  });

  test("anônimo recebe 401 em todas as operações, sem consultar nem escrever", async () => {
    for (const [method, path] of endpoints) {
      const response = await request(method, path, false);
      assert.equal(response.status, 401, path);
      assert.deepEqual(response.body, path.endsWith("/reset-link") ? { erro: "nao_autenticado" } : { error: "Não autenticado" });
    }
    assert.equal(selectCalls, 0); assert.equal(writes, 0); assert.equal(connections, 0);
  });

  test("usuário comum recebe 403 em todas as operações, antes de qualquer mutação", async () => {
    for (const [method, path] of endpoints) {
      identity(["user"]);
      assert.equal((await request(method, path)).status, 403, path);
      assert.equal(rowsQueue.length, 0);
    }
    assert.equal(writes, 0); assert.equal(connections, 0);
  });

  test("admin não altera cargos nem gera recuperação reservada ao proprietário", async () => {
    identity(["admin"]);
    assert.equal((await request(...endpoints[2])).status, 403);
    identity(["admin"]);
    assert.deepEqual(await request(...endpoints[0]), { status: 403, body: { erro: "apenas_proprietario" } });
    assert.equal(writes, 0); assert.equal(connections, 0);
  });

  test("admin lê cargos com o shape legado e a tradução existentes", async () => {
    identity(["admin"]);
    distinctRows = [{ id: "fixture", email: "fixture@example.test", displayName: "Fixture", role: "organizer" }];
    assert.deepEqual(await request("GET", "/cargos"), { status: 200, body: [{
      id: "fixture", user_id: "fixture", email: "fixture@example.test", display_name: "Fixture", cargo: "organizador",
    }] });
    assert.equal(writes, 0); assert.equal(connections, 0);
  });

  test("proprietário recebe 404 para UUID inválido no reset, sem consumir token", async () => {
    identity(["proprietario"]);
    assert.deepEqual(await request("POST", "/usuarios/invalid/reset-link"), {
      status: 404, body: { erro: "usuario_nao_encontrado" },
    });
    assert.equal(writes, 0); assert.equal(connections, 0);
  });

  test("proprietário recebe 404 para alvo ausente, sem gerar token", async () => {
    identity(["proprietario"]); rowsQueue.push([]);
    assert.deepEqual(await request(...endpoints[0]), { status: 404, body: { erro: "usuario_nao_encontrado" } });
    assert.equal(rowsQueue.length, 0); assert.equal(writes, 0); assert.equal(connections, 0);
  });
});
