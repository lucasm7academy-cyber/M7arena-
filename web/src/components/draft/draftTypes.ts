// src/components/draft/draftTypes.ts
// Tipos do draft (ban/pick). O ESTADO real vem do servidor (sala.draft) e TODAS
// as regras por modo vivem no servidor (api/src/lib/draft/) — o shape publica
// `draft.regras` e o componente só desenha o que vier daqui.

export interface Champion {
  id: string;      // Nome interno (ex: "Aatrox")
  key: string;     // ID numérico (ex: "266")
  name: string;    // Nome display (ex: "Aatrox")
  title: string;
  image: {
    full: string;
    sprite: string;
    group: string;
  };
}

/**
 * Regras de apresentação do modo (subconjunto do registry do servidor).
 * O front NÃO decide nada por `modo`: slots, visibilidade e role "em turno"
 * chegam por aqui (api/src/lib/draft/modos/).
 */
export interface SalaDraftRegras {
  max_bans_por_lado: number;
  max_picks_por_lado: number;
  esconder_picks_adversario: boolean;
  role_controladora: string;
  /**
   * true = somente a role controladora (MID na sala 5v5 personalizada) pode
   * banir/escolher. Ausente/false = qualquer participante do lado da vez age.
   */
  apenas_role_controladora?: boolean;
}

/** Draft do shape legado da API (snake_case). */
export interface SalaDraft {
  blue_bans: (string | null)[];
  blue_picks: (string | null)[];
  red_bans: (string | null)[];
  red_picks: (string | null)[];
  current_turn: number;
  current_phase: 'ban' | 'pick';
  current_team: 'blue' | 'red';
  turn_deadline_at: string | null;
  status: 'ongoing' | 'finished';
  /** Duração de um turno em ms (regra geral do motor; barra de tempo). */
  duracao_turno_ms: number;
  /** Jogo da série a que este draft pertence (1 nas salas sem série). */
  jogo?: number;
  /** Regras do modo publicadas pelo servidor (registry por modo). */
  regras: SalaDraftRegras;
  /**
   * Quantas ações ainda cabem no turno ATUAL (1 ou 2). O 5v5 tem turnos de
   * pick duplo — o front marca os dois slots e pulsa só o que está aberto.
   * Ausente em payloads antigos: assume 1.
   */
  restantes_no_turno?: number;
  /**
   * FEARLESS (sala campeonato): picks de jogos anteriores da série — travados.
   * Publicado pelo servidor; o grid mostra esses campeões apagados.
   */
  campeoes_travados?: string[];
}
