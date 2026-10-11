/**
 * ARAM — SEM draft.
 *
 * Igual ao 1v1: confirmou, vai direto para `iniciando_partida` com o código.
 * O ARAM não esconde nada porque não tem ban/pick para esconder.
 */
import type { DraftRules } from "../tipos.js";

export const RULES_ARAM: DraftRules = {
  ativo: false,
  turnOrder: [],
  maxBansPorLado: 0,
  maxPicksPorLado: 0,
  esconderPicksAdversario: false,
  roleControladora: "MID",
};
