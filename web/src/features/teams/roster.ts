import { type Role, TIER_MAP } from '../../components/players/playerMeta';

export interface Membro {
  userId:   string;
  riotId:   string;
  role:     Role;
  cargo:    string;
  isLeader: boolean;
  elo:      string;
  balance:  number;
  // enriquecidos após busca
  iconeId?: number;
  nivel?:   number;
  puuid?:   string;
}

export const ROLE_ORDER: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP', 'RES', 'COACH'];

export function eloDisplay(elo: string): string {
  if (!elo) return 'Sem Rank';
  const tier = TIER_MAP[elo.toUpperCase()] ?? elo;
  return tier;
}

export interface TimeData {
  id:           string | number;
  nome:         string;
  tag:          string;
  logoUrl?:     string;
  gradientFrom: string;
  gradientTo:   string;
  pdl:          number;
  winrate:      number;
  ranking:      number;
  wins:         number;
  gamesPlayed:  number;
  donoId:       string;
  torneio?:     string;
  whatsapp?:    string;
  discord?:     string;
  membros:      Membro[];
}
