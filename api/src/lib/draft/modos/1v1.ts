/**
 * 1v1 — SEM draft.
 *
 * Confirmados os dois lados, a sala pula a fase: `confirmacao` →
 * `iniciando_partida` com o código atribuído (match-flow.avaliarTransicoes).
 * `ativo: false` é o que faz o motor pular; `turnOrder` fica vazio.
 */
import type { DraftRules } from "../tipos.js";

export const RULES_1V1: DraftRules = {
  ativo: false,
  turnOrder: [],
  maxBansPorLado: 0,
  maxPicksPorLado: 0,
  esconderPicksAdversario: false,
  roleControladora: "MID",
};
