/**
 * Fixture mínima do estado do projeto, usada só pelo smoke test.
 *
 * Escreve em M7_PROJECT_ROOT (o smoke aponta para um diretório temporário),
 * nunca em docs/project-state.json de verdade. O estado canônico é versionado
 * e não deve ser recriado por script.
 *
 *   M7_PROJECT_ROOT=/tmp/algum node mcp/status-server/scripts/fixture.js
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_VERSION } from "../lib/schema.js";
import { render } from "../lib/render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.M7_PROJECT_ROOT || path.resolve(__dirname, "..", "..", "..");
const STATE_PATH = path.join(ROOT, "docs", "project-state.json");
const MD_PATH = path.join(ROOT, "statusdoprojeto.md");
const LOG_PATH = path.join(ROOT, "docs", "status-log.jsonl");

const NOW = new Date().toISOString();
const AGENT = "fixture";

const c = (id, phase, area, name, status = "todo") => ({
  id,
  phase,
  area,
  name,
  status,
  notes: "",
  evidence: "",
  owner: "",
  createdAt: NOW,
  updatedAt: NOW,
});

const components = [
  c("db.setup", "fase-1", "banco", "Drizzle + migrations versionadas"),
  c("db.identidade", "fase-1", "banco", "Núcleo de identidade unificado"),
  c("db.games", "fase-1", "banco", "Multi-jogo: games + game_accounts"),
  c("db.teams", "fase-1", "banco", "teams + team_members + team_stats"),
  c("db.tournaments", "fase-1", "banco", "tournaments normalizado"),
  c("db.matches", "fase-1", "banco", "matches + match_players + match_results"),
  c("db.economia", "fase-1", "banco", "Ledger de carteira"),
  c("db.conteudo", "fase-1", "banco", "news + highlights + broadcasts"),
];

const state = {
  schemaVersion: SCHEMA_VERSION,
  project: "M7Arena",
  goal:
    "Fixture do smoke test do MCP. O estado real fica em docs/project-state.json.",
  updatedAt: NOW,
  updatedBy: AGENT,
  invariants: [
    "DESIGN: o design atual é a referência. Nunca reescreva um className, nunca 'melhore' o layout sem o usuário pedir.",
    "Nenhuma regra de negócio no cliente: pagamento, resultado de partida, saldo e classificação são decididos no servidor.",
    "Nenhum segredo no bundle do cliente. Chave de API só em rota de servidor.",
    "Toda mudança de schema entra como migration versionada, e as migrations reconstroem o banco do zero.",
    "Nenhum arquivo passa de ~400 linhas. Se passou, é hora de recortar.",
    "Todo agente chama status_brief ao iniciar e log_session ao terminar.",
  ],
  components,
  decisions: [],
  blockers: [],
  sessions: [],
};

await fs.mkdir(path.join(ROOT, "docs"), { recursive: true });
await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
await fs.writeFile(MD_PATH, render(state), "utf8");
await fs.appendFile(
  LOG_PATH,
  JSON.stringify({ at: NOW, agent: AGENT, event: "fixture", components: components.length }) + "\n",
  "utf8"
);

console.log(`Fixture gerada em ${STATE_PATH} (${components.length} componentes)`);
