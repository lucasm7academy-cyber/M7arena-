export type RoleRecrutamento = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | 'RES' | 'COACH';

export type EloTier = 'Ferro' | 'Bronze' | 'Prata' | 'Ouro' | 'Platina' | 'Esmeralda' | 'Diamante' | 'Mestre' | 'Grão-Mestre' | 'Desafiante';

export const TIER_LIST: EloTier[] = [
  'Ferro', 'Bronze', 'Prata', 'Ouro', 'Platina', 'Esmeralda', 'Diamante', 'Mestre', 'Grão-Mestre', 'Desafiante'
];

export const RECRUITMENT_ROLES: { value: RoleRecrutamento; label: string; img: string }[] = [
  { value: 'TOP', label: 'Top', img: '/lanes/Top_icon.png' },
  { value: 'JG', label: 'Jungle', img: '/lanes/Jungle_icon.png' },
  { value: 'MID', label: 'Mid', img: '/lanes/Middle_icon.png' },
  { value: 'ADC', label: 'ADC', img: '/lanes/Bottom_icon.png' },
  { value: 'SUP', label: 'Suporte', img: '/lanes/Support_icon.png' },
  { value: 'RES', label: 'Reserva', img: '/lanes/icon-position-fill.png' },
  { value: 'COACH', label: 'Coach', img: '/lanes/coach_icon.svg' },
];

export interface TimeRecrutamentoInfo {
  nome: string;
  tag: string;
  logo_url: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  ranking: number | null;
}

export interface Recrutamento {
  id: string;
  time_id: string;
  criado_por: string;
  role: RoleRecrutamento;
  elo_min: EloTier;
  elo_max: EloTier;
  discord?: string | null;
  descricao: string;
  horarios?: string | null;
  time?: TimeRecrutamentoInfo;
}

export interface RecrutamentoInput {
  time_id: string;
  role: RoleRecrutamento;
  elo_min: EloTier;
  elo_max: EloTier;
  discord?: string;
  descricao: string;
  horarios?: string;
}

export function maskWhatsapp(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function normalizeWhatsapp(val: string): string {
  return val.replace(/\D/g, '');
}
