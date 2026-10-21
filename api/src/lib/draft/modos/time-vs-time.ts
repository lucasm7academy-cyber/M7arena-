/**
 * time_vs_time — hoje joga EXATAMENTE como o 5v5 (mesmo draft de 20 turnos).
 *
 * Este arquivo existe para a sala de campeonato evoluir sem tocar no 5v5:
 * qualquer diferencial futuro (ordem de turnos, slots, visibilidade) entra
 * AQUI, e só aqui.
 */
import type { DraftRules } from "../tipos.js";
import { RULES_5V5 } from "./5v5.js";

/**
 * Diferença proposital para o 5v5: aqui a role é só vitrine (JG) e QUALQUER
 * participante do lado da vez pode agir — a restrição ao MID vale apenas na
 * sala 5v5 personalizada (decisão de 2026-10-19).
 */
export const RULES_TIME_VS_TIME: DraftRules = {
  ...RULES_5V5,
  roleControladora: "JG",
  apenasRoleControladora: false,
};
