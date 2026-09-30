// Tipos da agenda de transmissões (spec 2026-09-29). Shape snake_case da API.
export interface AgendaTime {
  id: string;
  tag: string;
  nome: string;
  logo: string | null;
  cor: string | null;
}

export interface AgendaStreamer {
  user_id: string;
  nome: string;
  twitch: string;
}

export interface AgendaJogo {
  match_id: string;
  tournament_id: string;
  campeonato: { id: string; titulo: string; cor: string };
  fase: string;
  time_a: AgendaTime | null;
  time_b: AgendaTime | null;
  data: string | null;
  hora: string | null;
  data_label: string | null;
  status: string;
  ao_vivo: boolean;
  streamer: AgendaStreamer | null;
  meu: boolean;
  codigo_partida: string | null;
  transmissao_id: string | null;
  pode_assumir: boolean;
  pode_entrar_no_ar: boolean;
}
