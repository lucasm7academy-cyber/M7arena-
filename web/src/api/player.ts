/**
 * src/api/player.ts
 *
 * Sincronização da conta Riot do usuário logado. O restante do fluxo de
 * perfil/elo/stats foi migrado para a API própria e vive em PerfilContext —
 * este arquivo só mantém a sincronização manual que o usuário dispara
 * (botão "Atualizar dados" no perfil e verificação de conta na Vincular).
 */

import { api } from '../lib/api';
import { buscarElo, buscarEstatisticasRecentes, buscarInvocadorPorPUUID } from './riot';

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface EloInfo {
  tier: string;
  rank: string;
  lp: number;
  wins: number;
  losses: number;
  winRate: number;
  partidas: number;
  display: string;
}

export interface SyncResult {
  iconeId: number | null;
  nivel: number | null;
  soloQ: EloInfo | null;
  flexQ: EloInfo | null;
  topChampions: { championName: string; games: number; wins: number; winrate: number }[];
  roles: any[];
  totalGames: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEloInfo(entry: any): EloInfo | null {
  if (!entry) return null;
  const partidas = (entry.wins ?? 0) + (entry.losses ?? 0);
  const winRate = partidas > 0 ? Math.round((entry.wins / partidas) * 100) : 0;
  return {
    tier: entry.tier ?? '',
    rank: entry.rank ?? '',
    lp: entry.leaguePoints ?? 0,
    wins: entry.wins ?? 0,
    losses: entry.losses ?? 0,
    winRate,
    partidas,
    display: entry.tier ? `${entry.tier} ${entry.rank} — ${entry.leaguePoints} LP` : 'Sem Rank',
  };
}

export async function buscarElosJogador(puuid: string): Promise<{ soloQ: EloInfo | null; flexQ: EloInfo | null }> {
  try {
    const ranqueadas = await buscarElo(puuid);
    return {
      soloQ: buildEloInfo(ranqueadas.find((r: any) => r.queueType === 'RANKED_SOLO_5x5')),
      flexQ: buildEloInfo(ranqueadas.find((r: any) => r.queueType === 'RANKED_FLEX_SR')),
    };
  } catch {
    return { soloQ: null, flexQ: null };
  }
}

// ── Sincronização completa ───────────────────────────────────────────────────

export async function sincronizarContaRiot(puuid: string, userId: string): Promise<SyncResult | null> {
  try {
    const [summoner, { soloQ, flexQ }, statsRaw] = await Promise.all([
      buscarInvocadorPorPUUID(puuid).catch(() => null),
      buscarElosJogador(puuid),
      buscarEstatisticasRecentes(puuid).catch(() => null),
    ]);

    const iconeId = (summoner as any)?.profileIconId ?? null;
    const nivel = (summoner as any)?.summonerLevel ?? null;
    const topChampions = statsRaw?.topChampions ?? [];
    const roles = statsRaw?.roles ?? [];
    const totalGames = statsRaw?.totalGames ?? 0;

    const result: SyncResult = { iconeId, nivel, soloQ, flexQ, topChampions, roles, totalGames };
    const update: Record<string, any> = {
      elo_cache: { soloQ, flexQ },
      champions_cache: { topChampions, roles, totalGames },
      stats_updated_at: new Date().toISOString(),
    };
    if (iconeId !== null) update.profile_icon_id = iconeId;
    if (nivel !== null) update.level = nivel;

    await api.profiles.updateRiot(update);
    return result;
  } catch {
    return null;
  }
}
