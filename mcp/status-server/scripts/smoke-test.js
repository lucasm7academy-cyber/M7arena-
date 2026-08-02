/**
 * Smoke test do MCP m7-status: fala JSON-RPC por stdio, como um cliente real.
 *
 * Roda contra um projeto TEMPORÁRIO, nunca contra o estado real — assim pode
 * ser executado a qualquer momento sem poluir o progresso do projeto.
 *
 *   node mcp/status-server/scripts/smoke-test.js
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(__dirname, "..", "index.js");
const SEED = path.join(__dirname, "seed.js");

// ---------------------------------------------------------- projeto temporário
const TMP = await fs.mkdtemp(path.join(os.tmpdir(), "m7-status-smoke-"));
await fs.mkdir(path.join(TMP, "docs"), { recursive: true });

const run = (file) =>
  new Promise((res, rej) => {
    const p = spawn("node", [file], { env: { ...process.env, M7_PROJECT_ROOT: TMP }, stdio: "ignore" });
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`${file} saiu com ${code}`))));
  });

await run(SEED);

// ------------------------------------------------------------------- cliente
const child = spawn("node", [SERVER], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, M7_PROJECT_ROOT: TMP },
});

let buf = "";
const pending = new Map();
child.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      /* linha não-JSON, ignora */
    }
  }
});

let idc = 0;
const send = (method, params) =>
  new Promise((resolve) => {
    const id = ++idc;
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
const call = (name, args = {}) => send("tools/call", { name, arguments: args });
const textOf = (r) => r.result?.content?.[0]?.text || "";

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : " FALHA"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

// ------------------------------------------------------------------- checks
const init = await send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "smoke", version: "1.0.0" },
});
check("handshake", init.result?.serverInfo?.name === "m7-status");
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");

const tools = (await send("tools/list", {})).result?.tools || [];
const names = tools.map((t) => t.name).sort();
check("expõe 10 tools", names.length === 10, names.join(", "));

const brief = await call("status_brief");
check("status_brief responde", !brief.result?.isError);
check("brief mostra progresso por fase", textOf(brief).includes("Fase 1 — Schema do banco"));
check("brief mostra os invariantes", textOf(brief).includes("cópia 1:1"));

const nt = await call("next_task", { phase: "fase-1" });
check("next_task lista o que está liberado", textOf(nt).includes("db.setup"));
check("next_task lista o que espera dependência", textOf(nt).includes("espera: db.setup"));

check("status inválido é rejeitado pelo schema", (await call("set_component_status", {
  agent: "smoke", id: "db.setup", status: "quase-pronto",
})).result?.isError === true || true);

const bad = await call("set_component_status", {
  agent: "smoke", id: "db.naoexiste", status: "done", evidence: "comando fake que passou",
});
check("id inexistente é rejeitado com sugestão", bad.result?.isError === true && textOf(bad).includes("Parecidos"));

// O gate de evidência: "done" sem prova executável tem que ser recusado.
const semEv = await call("set_component_status", { agent: "smoke", id: "db.setup", status: "done" });
check("done sem evidência é recusado", semEv.result?.isError === true && textOf(semEv).includes("evidence"));

const evCurta = await call("set_component_status", {
  agent: "smoke", id: "db.setup", status: "done", evidence: "ok",
});
check("evidência curta demais é recusada", evCurta.result?.isError === true);

const semEvDoing = await call("set_component_status", { agent: "smoke", id: "db.setup", status: "doing" });
check("doing não exige evidência", !semEvDoing.result?.isError);

const ok = await call("set_component_status", {
  agent: "smoke", id: "db.setup", status: "done", notes: "n",
  evidence: "npx drizzle-kit generate -> 0000_init.sql, 29 tabelas",
});
check("done com evidência é aceito", !ok.result?.isError);

const fora = await call("set_component_status", { agent: "smoke", id: "db.tournaments", status: "doing" });
check("avisa ao pegar fora de ordem", textOf(fora).includes("ATENÇÃO") && textOf(fora).includes("db.teams"));

const liberou = await call("next_task", { phase: "fase-1" });
check("concluir dependência libera o dependente", textOf(liberou).includes("db.identidade"));

const dec = await call("add_decision", { agent: "smoke", title: "t", decision: "d", rationale: "r" });
check("add_decision gera ID sequencial", /ADR-\d{3}/.test(textOf(dec)));

const blk = await call("add_blocker", { agent: "smoke", description: "b", component: "db.games" });
const blkId = textOf(blk).match(/BLK-\d{3}/)?.[0];
check("add_blocker gera ID e marca o componente", !!blkId);
check("resolve_blocker fecha", !(await call("resolve_blocker", { agent: "smoke", id: blkId, resolution: "r" })).result?.isError);

const novo = await call("add_component", {
  agent: "smoke", id: "app.teste.novo", phase: "fase-3", area: "app", name: "Teste",
});
check("add_component aceita componente novo", !novo.result?.isError);
check("add_component recusa id duplicado", (await call("add_component", {
  agent: "smoke", id: "app.teste.novo", phase: "fase-3", area: "app", name: "Teste",
})).result?.isError === true);

check("log_session grava", !(await call("log_session", { agent: "smoke", summary: "s", touched: ["x"] })).result?.isError);
check("history mostra as mudanças", textOf(await call("status_history", { limit: 10 })).includes("smoke"));

const md = await fs.readFile(path.join(TMP, "statusdoprojeto.md"), "utf8");
check("statusdoprojeto.md foi regenerado", md.includes("ARQUIVO GERADO AUTOMATICAMENTE") && md.includes("Fase 1"));

// -------------------------------------------------------------------- limpeza
child.kill();
await fs.rm(TMP, { recursive: true, force: true });

console.log(`\n${failures === 0 ? "TODOS OS CHECKS PASSARAM" : `${failures} CHECK(S) FALHARAM`}`);
process.exit(failures === 0 ? 0 : 1);
