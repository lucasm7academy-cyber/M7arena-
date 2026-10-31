export const POOL_TIERS = ["S", "A", "B", "C", "D"] as const;
export type PoolTier = (typeof POOL_TIERS)[number];

export const POOL_ROLES = ["TOP", "JG", "MID", "ADC", "SUP"] as const;
export type PoolRole = (typeof POOL_ROLES)[number];

export interface AvailabilityWindow {
  /** 1 = segunda ... 7 = domingo — mesmo contrato do app desktop. */
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
}

export interface ChampionPoolEntry {
  championId: string;
  championName: string;
  role: PoolRole;
  tier: PoolTier;
}

export interface RankSnapshot {
  tier: string;
  rank: string;
  lp: number;
  wins: number;
  losses: number;
}

export interface RiotPlayer {
  riotId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  summonerLevel: number | null;
  profileIconId: number | null;
  profileIconUrl: string;
  solo: RankSnapshot | null;
  flex: RankSnapshot | null;
}

export interface RecentChampion {
  championName: string;
  games: number;
  wins: number;
  winrate: number;
}

export interface TierlistPayload {
  riotId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  summonerLevel: number | null;
  profileIconId: number | null;
  solo: RankSnapshot | null;
  flex: RankSnapshot | null;
  fullName: string;
  contact: string;
  email: string;
  discord: string;
  primaryRole: PoolRole;
  secondaryRole: PoolRole | "";
  availability: AvailabilityWindow[];
  championPool: ChampionPoolEntry[];
  notes: string;
  acceptedTerms: boolean;
  website: string;
}
