/**
 * regras.ts — REGISTRY ÚNICO de draft por modo de sala.
 *
 * Toda diferença entre modos mora em `modos/<modo>.ts`. O motor (`flow.ts`) e o
 * shape da sala (`match-shape.ts`) leem daqui; o front só desenha o que o
 * shape publica — não existe `if (modo === '1v1')` no JSX.
 *
 * Modo novo (3v3?) = 1 arquivo em `modos/` + 1 linha no `DRAFT_RULES`.
 *
 * Regras gerais (imutáveis, valem para todo modo com draft) continuam no
 * motor, não aqui: timer 30s + graça 2s, ban vencido = ban vazio, pick vencido
 * cancela.
 */
import type { DraftRules, TurnInfo } from "./tipos.js";
import { RULES_5V5 } from "./modos/5v5.js";
import { RULES_TIME_VS_TIME } from "./modos/time-vs-time.js";
import { RULES_1V1 } from "./modos/1v1.js";
import { RULES_ARAM } from "./modos/aram.js";

export const DRAFT_RULES: Record<string, DraftRules> = {
  "5v5": RULES_5V5,
  time_vs_time: RULES_TIME_VS_TIME,
  "1v1": RULES_1V1,
  aram: RULES_ARAM,
};

/** Fallback de modo desconhecido: mantém o comportamento histórico (5v5). */
export function getDraftRules(mode: string): DraftRules {
  return DRAFT_RULES[mode] ?? RULES_5V5;
}

/** O modo tem fase de draft? (false = confirmou, pula direto para o código.) */
export function temDraft(mode: string): boolean {
  return getDraftRules(mode).ativo;
}

/** Ordem dos turnos do modo (vazia se o modo não tem draft). */
export function getTurnOrder(mode: string): TurnInfo[] {
  return getDraftRules(mode).turnOrder;
}

/** Subconjunto de APRESENTAÇÃO publicado no shape da sala (snake_case legado). */
export function regrasDraftParaShape(mode: string) {
  const r = getDraftRules(mode);
  return {
    max_bans_por_lado: r.maxBansPorLado,
    max_picks_por_lado: r.maxPicksPorLado,
    esconder_picks_adversario: r.esconderPicksAdversario,
    role_controladora: r.roleControladora,
  };
}
