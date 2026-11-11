export interface TeamBasico {
  id: string | number;
  name: string;
  tag: string;
  logoUrl?: string;
  gradientFrom: string;
  gradientTo: string;
  pdl: number;
  winrate: number;
  ranking: number;
  wins: number;
  gamesPlayed: number;
  donoId?: string;
}

export interface CreateTeamData {
  name: string;
  tag: string;
  gradientFrom: string;
  gradientTo: string;
  logoUrl?: string;
  _logoFile: File | null;
  whatsapp: string;
  discord: string;
}
