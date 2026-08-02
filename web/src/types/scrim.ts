// src/types/scrim.ts

export const MODOS_SCRIM = [
  'MD3 Fearless Draft',
  'MD5 Fearless Draft',
  'MD3 Normal Draft',
  'MD5 Normal Draft',
] as const;

export type ModoScrim = typeof MODOS_SCRIM[number];

export const ELOS_SCRIM = [
  'Qualquer',
  'Prata+',
  'Ouro+',
  'Platina+',
  'Esmeralda+',
  'Diamante+',
  'Mestre+',
] as const;

export type EloScrim = typeof ELOS_SCRIM[number];

export interface TimeResumoScrim {
  id: string;
  nome: string;
  tag: string;
  logo_url?: string | null;
  gradient_from?: string;
  gradient_to?: string;
}

export type ScrimStatus = 'aberta' | 'aceita' | 'cancelada' | 'fechada';

export interface Scrim {
  id: number;
  time_id: string;
  criado_por: string;
  data_horario: string;
  modo: ModoScrim;
  elo_desejado: EloScrim;
  ativo: boolean;
  created_at: string;
  discord?: string | null;
  aceito_por?: string | null;
  status: ScrimStatus;
  time?: TimeResumoScrim;
  time_aceitou?: TimeResumoScrim;
}

export interface ScrimInput {
  time_id: string;
  data_horario: string;
  modo: ModoScrim;
  elo_desejado: EloScrim;
  discord?: string;
}
