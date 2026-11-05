/**
 * Metadados visuais de jogador compartilhados entre a vitrine (`players.tsx`)
 * e a página do time. O modal antigo de detalhe foi removido: o card abre o
 * OP.GG direto (decisão A09).
 */

import { buildProfileIconUrl } from '../../api/riot';

export type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | 'RES' | 'COACH';
export type EloType = 'Sem Rank' | 'Ferro' | 'Bronze' | 'Prata' | 'Ouro' | 'Platina' | 'Esmeralda' | 'Diamante' | 'Mestre' | 'Grão-Mestre' | 'Desafiante';

export interface Jogador {
  id: string;
  riotId: string;
  nome: string;
  nivel: number;
  elo: EloType;
  eloPontos?: number;
  iconeId: number;
  partidas: number;
  winRate: number;
  rolePrincipal: Role;
  roleSecundaria: Role;
  isVIP: boolean;
  isVerified: boolean;
  timeTag?: string;
  timeColor?: string;
  timeId?: string | number;
}

export const ROLE_CONFIG: Record<Role, { label: string; img: string; color: string; bg: string }> = {
  TOP: { label: 'TOP', img: '/lanes_brancas/Top_iconB.png', color: 'text-red-400', bg: 'bg-red-400/10' },
  JG: { label: 'JG', img: '/lanes_brancas/Jungle_iconB.png', color: 'text-green-400', bg: 'bg-green-400/10' },
  MID: { label: 'MID', img: '/lanes_brancas/Middle_iconB.png', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  ADC: { label: 'ADC', img: '/lanes_brancas/Bottom_iconB.png', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  SUP: { label: 'SUP', img: '/lanes_brancas/Support_iconB.png', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  RES: { label: 'RES', img: '/lanes_brancas/icon-position-fillB.png', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  COACH: { label: 'COACH', img: '/lanes_brancas/coach_iconB.svg', color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

export const ELO_STYLES: Record<EloType, { border: string; glow: string; text: string; bg: string }> = {
  'Sem Rank': { border: '#54565f', glow: '#54565f40', text: 'text-zinc-500', bg: 'bg-zinc-500/10' },
  Ferro: { border: '#6c757d', glow: '#6c757d40', text: 'text-gray-500', bg: 'bg-gray-500/10' },
  Bronze: { border: '#cd7f32', glow: '#cd7f3240', text: 'text-amber-600', bg: 'bg-amber-600/10' },
  Prata: { border: '#c0c0c0', glow: '#c0c0c040', text: 'text-gray-300', bg: 'bg-gray-300/10' },
  Ouro: { border: '#ffd700', glow: '#ffd70040', text: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  Platina: { border: '#00e5ff', glow: '#00e5ff40', text: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  Esmeralda: { border: '#2ecc71', glow: '#2ecc7140', text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  Diamante: { border: '#3498db', glow: '#3498db60', text: 'text-blue-400', bg: 'bg-blue-400/10' },
  Mestre: { border: '#9b59b6', glow: '#9b59b680', text: 'text-purple-400', bg: 'bg-purple-400/10' },
  'Grão-Mestre': { border: '#e74c3c', glow: '#e74c3c80', text: 'text-red-400', bg: 'bg-red-400/10' },
  Desafiante: { border: '#f1c40f', glow: '#f1c40fa0', text: 'text-yellow-300', bg: 'bg-yellow-300/10' },
};

export const ELOS_ORDER: EloType[] = ['Ferro', 'Bronze', 'Prata', 'Ouro', 'Platina', 'Esmeralda', 'Diamante', 'Mestre', 'Grão-Mestre', 'Desafiante'];
export const ROLES_ORDER: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
export const TIER_MAP: Record<string, EloType> = {
  IRON: 'Ferro', BRONZE: 'Bronze', SILVER: 'Prata', GOLD: 'Ouro',
  PLATINUM: 'Platina', EMERALD: 'Esmeralda', DIAMOND: 'Diamante',
  MASTER: 'Mestre', GRANDMASTER: 'Grão-Mestre', CHALLENGER: 'Desafiante',
};

export const getIconeUrl = (iconeId: number) => buildProfileIconUrl(iconeId);
