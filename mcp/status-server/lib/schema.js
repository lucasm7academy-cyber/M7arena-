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

export const AREAS = [
  "governanca",
  "banco",
  "infra",
  "app",
  "design",
  "mcp-ops",
  "migracao",
  "seguranca",
];

export const AREA_LABEL = {
  governanca: "Governança & Agentes",
  banco: "Banco de Dados",
  infra: "Infraestrutura (Docker/VPS)",
  app: "Aplicação (Next.js)",
  design: "Design & Paridade Visual",
  "mcp-ops": "MCP de Operações",
  migracao: "Migração de Dados",
  seguranca: "Segurança",
};

/** Ordem em que as áreas aparecem no statusdoprojeto.md */
export const AREA_ORDER = AREAS;

/** Limite de caracteres em campos de texto livre — impede que virem dissertação. */
export const MAX_NOTES = 500;
export const MAX_SUMMARY = 1000;

/** Quantas sessões o estado guarda antes de descartar as mais antigas. */
export const MAX_SESSIONS = 30;

export const SCHEMA_VERSION = 1;
