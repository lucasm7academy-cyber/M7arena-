/**
 * Vocabulário fechado do estado do projeto.
 *
 * Tudo aqui é enum de propósito: é o que impede que Claude, Gemini e DeepSeek
 * inventem cada um o seu formato. Se um valor não está nesta lista, a escrita falha.
 */

export const STATUS = ["todo", "doing", "done", "blocked", "deprecated"];

export const STATUS_LABEL = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Concluído",
  blocked: "Bloqueado",
  deprecated: "Descartado",
};

export const STATUS_ICON = {
  todo: "[ ]",
  doing: "[~]",
  done: "[x]",
  blocked: "[!]",
  deprecated: "[-]",
};

/**
 * Fases do plano. Um componente pertence a exatamente uma fase.
 * É o que faz "execute a Fase 1" ter significado preciso para qualquer agente.
 */
export const PHASES = ["fase-0", "fase-1", "fase-2", "fase-3", "fase-4"];

export const PHASE_LABEL = {
  "fase-0": "Fase 0 — Governança multi-agente",
  "fase-1": "Fase 1 — Schema do banco",
  "fase-2": "Fase 2 — Infraestrutura (VPS/Docker/Nginx)",
  "fase-3": "Fase 3 — Aplicação (React + Vite + API)",
  "fase-4": "Fase 4 — Operações da VPS (MCP)",
};

export const AREAS = [
  "governanca",
  "banco",
  "infra",
  "app",
  "design",
  "mcp-ops",
  "seguranca",
];

export const AREA_LABEL = {
  governanca: "Governança & Agentes",
  banco: "Banco de Dados",
  infra: "Infraestrutura (VPS/Docker/Nginx)",
  app: "Aplicação (React + Vite)",
  design: "Design & Interface",
  "mcp-ops": "MCP de Operações",
  seguranca: "Segurança",
};

/** Ordem em que as áreas aparecem no statusdoprojeto.md */
export const AREA_ORDER = AREAS;

/** Limite de caracteres em campos de texto livre — impede que virem dissertação. */
export const MAX_NOTES = 500;
export const MAX_SUMMARY = 1000;

/** Quantas sessões o estado guarda antes de descartar as mais antigas. */
export const MAX_SESSIONS = 30;

export const SCHEMA_VERSION = 2;
