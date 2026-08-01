/**
 * Persistência do estado do projeto.
 *
 * Regras que este módulo garante:
 *  - escrita atômica (arquivo temporário + rename), para nunca deixar o JSON pela metade
 *  - lock de arquivo, para dois agentes escrevendo ao mesmo tempo não se sobrescreverem
 *  - todo write vira uma linha no log append-only e regenera o statusdoprojeto.md
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_SESSIONS, SCHEMA_VERSION } from "./schema.js";
import { render } from "./render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do projeto: env var ou três níveis acima (mcp/status-server/lib → raiz). */
export const PROJECT_ROOT =
  process.env.M7_PROJECT_ROOT || path.resolve(__dirname, "..", "..", "..");

export const STATE_PATH = path.join(PROJECT_ROOT, "docs", "project-state.json");
export const LOG_PATH = path.join(PROJECT_ROOT, "docs", "status-log.jsonl");
export const MD_PATH = path.join(PROJECT_ROOT, "statusdoprojeto.md");
const LOCK_PATH = path.join(PROJECT_ROOT, "docs", ".status.lock");

const LOCK_TIMEOUT_MS = 10_000;
const LOCK_RETRY_MS = 100;
const LOCK_MAX_RETRIES = 100;

// ---------------------------------------------------------------- lock

async function acquireLock() {
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    try {
      // 'wx' falha se o arquivo já existe — é isso que torna o lock atômico.
      const fh = await fs.open(LOCK_PATH, "wx");
      await fh.writeFile(String(Date.now()));
      await fh.close();
      return;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;

      // Lock órfão de um processo que morreu no meio: expira e é retomado.
      try {
        const stat = await fs.stat(LOCK_PATH);
        if (Date.now() - stat.mtimeMs > LOCK_TIMEOUT_MS) {
          await fs.unlink(LOCK_PATH).catch(() => {});
          continue;
        }
      } catch {
        continue;
      }

      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
  throw new Error(
    "Não consegui obter o lock do estado após 10s. Outro agente pode estar escrevendo — tente de novo."
  );
}

async function releaseLock() {
  await fs.unlink(LOCK_PATH).catch(() => {});
}

// ---------------------------------------------------------------- io

async function writeAtomic(filePath, content) {
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, filePath);
}

export async function loadState() {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const state = JSON.parse(raw);
    if (state.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(
        `project-state.json está na versão ${state.schemaVersion}, mas este servidor espera ${SCHEMA_VERSION}.`
      );
    }
    return state;
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `Estado não encontrado em ${STATE_PATH}. Rode 'node mcp/status-server/scripts/seed.js' para criar.`
      );
    }
    throw err;
  }
}

/**
 * Aplica uma mutação sob lock e persiste tudo de uma vez:
 * estado → log → markdown renderizado.
 *
 * @param {string} agent quem está escrevendo (claude, gemini, deepseek...)
 * @param {(state: object) => {event: string, detail: object, result?: any}} mutate
 */
export async function mutateState(agent, mutate) {
  await acquireLock();
  try {
    const state = await loadState();
    const { event, detail, result } = mutate(state);

    const now = new Date().toISOString();
    state.updatedAt = now;
    state.updatedBy = agent;

    if (Array.isArray(state.sessions) && state.sessions.length > MAX_SESSIONS) {
      state.sessions = state.sessions.slice(-MAX_SESSIONS);
    }

    await writeAtomic(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
    await fs.appendFile(
      LOG_PATH,
      JSON.stringify({ at: now, agent, event, ...detail }) + "\n",
      "utf8"
    );
    await writeAtomic(MD_PATH, render(state));

    return { state, result };
  } finally {
    await releaseLock();
  }
}

export async function readLog(limit = 20) {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

/** Gera o próximo ID sequencial de uma coleção, ex.: ADR-001, BLK-002. */
export function nextId(collection, prefix) {
  const nums = (collection || [])
    .map((item) => Number.parseInt(String(item.id).replace(`${prefix}-`, ""), 10))
    .filter((n) => Number.isFinite(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}
