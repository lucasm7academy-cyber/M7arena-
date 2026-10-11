/**
 * time_vs_time — hoje joga EXATAMENTE como o 5v5 (mesmo draft de 20 turnos).
 *
 * Este arquivo existe para a sala de campeonato evoluir sem tocar no 5v5:
 * qualquer diferencial futuro (ordem de turnos, slots, visibilidade) entra
 * AQUI, e só aqui.
 */
import type { DraftRules } from "../tipos.js";
import { RULES_5V5 } from "./5v5.js";

export const RULES_TIME_VS_TIME: DraftRules = { ...RULES_5V5 };
