// src/components/draft/draftTypes.ts
// Tipos do draft (ban/pick). O ESTADO real vem do servidor (sala.draft) e a
// ordem dos turnos vive no servidor (api/src/lib/draft-flow.ts) — aqui ficam
// apenas os tipos de exibição e a lista de campeões do Data Dragon.

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
}
