/**
 * tipos.ts — contrato do registry de draft por modo de sala.
 *
 * As regras GERAIS do draft (timer de 30s por turno + 2s de graça, ban vencido
 * vira ban vazio, pick vencido cancela a sala) NÃO entram no registry: são
 * invariantes do motor (`flow.ts`) e valem para todo modo que tenha draft.
 * O registry guarda apenas o que MUDA de modo para modo.
 */

export type DraftTeam = "blue" | "red";
export type DraftPhase = "ban" | "pick";

/** Um turno do draft: de quem é e o que ele faz. */
export interface TurnInfo {
  team: DraftTeam;
  phase: DraftPhase;
}

/** Regras de draft de UM modo de sala. */
export interface DraftRules {
  /** false = o modo pula a fase de draft (confirmou → `iniciando_partida`). */
  ativo: boolean;
  /** Ordem completa dos turnos; vazia quando `ativo` é false. */
  turnOrder: TurnInfo[];
  /** Slots de ban desenhados por lado (a soma dos turnos de ban é o dobro). */
  maxBansPorLado: number;
  /** Slots de pick desenhados por lado (a soma dos turnos de pick é o dobro). */
  maxPicksPorLado: number;
  /** true = o cliente esconde os picks do adversário durante o draft. */
  esconderPicksAdversario: boolean;
  /**
   * Role cujo nick é exibido no "em turno" (vitrine). Qualquer participante
   * confirmado do lado da vez pode agir — a role NÃO restringe a ação.
   */
  roleControladora: string;
}
