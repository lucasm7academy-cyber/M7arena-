/**
 * Migra o project-state.json da v1 para a v2, adicionando o campo `phase`
 * a cada componente. As dependências vivem em lib/plan.js, não no estado.
 *
 * Preserva todo o progresso: status, notas, evidências, decisões, sessões e log.
 *
 *   node mcp/status-server/scripts/migrate-v1-to-v2.js
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../lib/render.js";
import { PLAN, phaseOf } from "../lib/plan.js";
import { SCHEMA_VERSION } from "../lib/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.M7_PROJECT_ROOT || path.resolve(__dirname, "..", "..", "..");
const STATE_PATH = path.join(ROOT, "docs", "project-state.json");
const MD_PATH = path.join(ROOT, "statusdoprojeto.md");
const LOG_PATH = path.join(ROOT, "docs", "status-log.jsonl");

const state = JSON.parse(await fs.readFile(STATE_PATH, "utf8"));

if (state.schemaVersion === SCHEMA_VERSION) {
  console.log(`Estado já está na v${SCHEMA_VERSION}. Nada a fazer.`);
  process.exit(0);
}
if (state.schemaVersion !== 1) {
  console.error(`Esperava a v1, encontrei a v${state.schemaVersion}. Abortando.`);
  process.exit(1);
}

// Backup antes de mexer.
const backup = `${STATE_PATH}.v1.bak`;
await fs.copyFile(STATE_PATH, backup);

const semFase = [];
for (const c of state.components) {
  const p = phaseOf(c.id);
  if (!p) {
    semFase.push(c.id);
    continue;
  }
  c.phase = p;
}

// Reordena as chaves para phase vir logo depois de id, por legibilidade do JSON.
state.components = state.components.map((c) => ({
  id: c.id,
  phase: c.phase,
  area: c.area,
  name: c.name,
  status: c.status,
  notes: c.notes,
  evidence: c.evidence,
  owner: c.owner,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
}));

// Ordena por fase, preservando a ordem original dentro de cada uma.
const ordem = Object.keys(PLAN);
state.components.sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));

state.schemaVersion = SCHEMA_VERSION;
state.updatedAt = new Date().toISOString();
state.updatedBy = "claude";

await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
await fs.writeFile(MD_PATH, render(state), "utf8");
await fs.appendFile(
  LOG_PATH,
  JSON.stringify({
    at: state.updatedAt,
    agent: "claude",
    event: "migrate_schema",
    from: 1,
    to: SCHEMA_VERSION,
    components: state.components.length,
  }) + "\n",
  "utf8"
);

console.log(`Migrado para a v${SCHEMA_VERSION}. Backup em ${path.basename(backup)}.`);
console.log(`  ${state.components.length} componentes com fase atribuída.`);
if (semFase.length) {
  console.error(`  ATENÇÃO — sem fase (faltam em lib/plan.js): ${semFase.join(", ")}`);
  process.exit(1);
}
