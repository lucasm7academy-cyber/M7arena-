/**
 * Vocabulário de rotas e elos dos times.
 *
 * Fica fora do page.tsx porque, no App Router, um arquivo de página só pode
 * exportar `default` e um conjunto fixo de configs (metadata, revalidate,
 * dynamic...). Qualquer export extra faz o build de produção falhar, mesmo
 * quando o `next dev` funciona normalmente.
 */

export type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | 'RES' | 'COACH';

export const ROLE_CONFIG: Record<Role, { label: string; img: string; color: string; bg: string }> = {
  TOP: { label: 'TOP', img: '/lanes_brancas/Top_iconB.png', color: 'text-red-400', bg: 'bg-red-400/10' },
  JG: { label: 'JG', img: '/lanes_brancas/Jungle_iconB.png', color: 'text-green-400', bg: 'bg-green-400/10' },
  MID: { label: 'MID', img: '/lanes_brancas/Middle_iconB.png', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  ADC: { label: 'ADC', img: '/lanes_brancas/Bottom_iconB.png', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  SUP: { label: 'SUP', img: '/lanes_brancas/Support_iconB.png', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  RES: { label: 'RES', img: '/lanes_brancas/icon-position-fillB.png', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  COACH: { label: 'COACH', img: '/lanes_brancas/coach_iconB.svg', color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

export const ROLE_ORDER: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP', 'RES', 'COACH'];

export const TIER_MAP: Record<string, string> = {
  IRON: 'Ferro', BRONZE: 'Bronze', SILVER: 'Prata', GOLD: 'Ouro',
  PLATINUM: 'Platina', EMERALD: 'Esmeralda', DIAMOND: 'Diamante',
  MASTER: 'Mestre', GRANDMASTER: 'Grão-Mestre', CHALLENGER: 'Desafiante',
};
