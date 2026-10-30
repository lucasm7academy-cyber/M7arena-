/**
 * Módulo draft da sala.
 *
 *  - `modos/<modo>.ts` — as regras de CADA modo (fonte única; ajustou aqui,
 *    mudou no servidor);
 *  - `regras.ts` — o registry que amarra modo → regras;
 *  - `flow.ts` — o motor server-authoritative (timer, ban vazio, pick cancela,
 *    catch-up).
 */
export { DRAFT_RULES, getDraftRules, temDraft, getTurnOrder, regrasDraftParaShape, restantesNoTurno } from "./regras.js";
export { DRAFT_TURN_MS, DRAFT_GRACE_MS, criarDraft, avaliarDraft, aplicarAcaoDraft } from "./flow.js";
export type { DraftRules, DraftTeam, DraftPhase, TurnInfo } from "./tipos.js";
