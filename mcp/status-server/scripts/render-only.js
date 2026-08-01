/**
 * Regenera o statusdoprojeto.md a partir do project-state.json, sem alterar o estado.
 * Útil se alguém editou o .md à mão por engano.
 *
 *   node mcp/status-server/scripts/render-only.js
 */

import fs from "node:fs/promises";
import { render } from "../lib/render.js";
import { loadState, MD_PATH } from "../lib/state.js";

const state = await loadState();
await fs.writeFile(MD_PATH, render(state), "utf8");
console.log(`statusdoprojeto.md regenerado a partir do estado (${state.components.length} componentes).`);
