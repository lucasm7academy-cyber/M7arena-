/**
 * src/api/player.ts
 * 
 * ✅ VERSÃO OTIMIZADA
 * - Promise.all para operações paralelas
 * - .in() para evitar N+1 queries
 * - Uso do PerfilContext quando disponível
 */

import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { buscarElo, buscarTopChampions, buscarEstatisticasRecentes, buscarInvocadorPorPUUID } from './riot';
import { ajustarMP, ajustarMC, buscarWallet, buscarWalletsEmLote } from './wallet';

const IS_DEV = import.meta.env.DEV;

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

export interface CampeaoMaestria {
  championKey: string;
  championId: number;
  points: number;
  level: number;
}

export interface PerfilCompleto {
  userId: string;
  riotId: string;
  nome: string;
  puuid: string;
  iconeId: number;
  nivel: number;
  lane: string | null;
  lane2: string | null;
  balance: number;
  soloQ: EloInfo | null;
  flexQ: EloInfo | null;
  topChampions: CampeaoMaestria[];
  timeTag: string | undefined;
  timeColor: string | undefined;
}

export interface StatsCache {
  soloQ: EloInfo | null;
  flexQ: EloInfo | null;
  topChampions: { championName: string; games: number; wins: number; winrate: number }[];
  roles: any[];
  totalGames: number;
}

export interface SyncResult {
  iconeId: number | null;
  nivel: number | null;
  soloQ: EloInfo | null;
  flexQ: EloInfo | null;
  topChampions: StatsCache['topChampions'];
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

// ── Função principal ──────────────────────────────────────────────────────────

export async function buscarPerfilCompleto(userId: string): Promise<PerfilCompleto | null> {
  // ✅ Schema novo: balance vem de `wallets.mc`, lane/lane2 de `profiles.lane_primaria/secundaria`.
  const [{ data: conta }, { data: perfil }, userTeams, wallet] = await Promise.all([
    supabase.from('contas_riot').select('riot_id, puuid, profile_icon_id, level').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('lane_primaria, lane_secundaria').eq('id', userId).maybeSingle(),
    api.teams.byUser(userId),
    buscarWallet(userId),
  ]);

  if (!conta?.puuid) return null;

  const time = userTeams?.teams?.[0];
  const timeTag = time?.tag ?? undefined;
  const timeColor = time?.gradient_from ?? undefined;

  const [ranqueadas, topChampionsRaw] = await Promise.all([
    buscarElo(conta.puuid),
    buscarTopChampions(conta.puuid, 3),
  ]);

  const soloEntry = ranqueadas.find((r: any) => r.queueType === 'RANKED_SOLO_5x5');
  const flexEntry = ranqueadas.find((r: any) => r.queueType === 'RANKED_FLEX_SR');

  if (soloEntry || flexEntry) {
    // ✅ Schema novo: tier/rank/lp/wins/losses viram parte de elo_cache (jsonb).
    supabase
      .from('contas_riot')
      .update({
        elo_cache: {
          soloQ: soloEntry ? {
            tier:   soloEntry.tier ?? 'IRON',
            rank:   soloEntry.rank ?? 'IV',
            lp:     soloEntry.leaguePoints ?? 0,
            wins:   soloEntry.wins   ?? 0,
            losses: soloEntry.losses ?? 0,
          } : null,
          flexQ: flexEntry ? {
            tier:   flexEntry.tier ?? 'IRON',
            rank:   flexEntry.rank ?? 'IV',
            lp:     flexEntry.leaguePoints ?? 0,
            wins:   flexEntry.wins   ?? 0,
            losses: flexEntry.losses ?? 0,
          } : null,
        },
        stats_updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .then();
  }

  const topChampions: CampeaoMaestria[] = (topChampionsRaw ?? []).map((c: any) => ({
    championKey: c.championKey ?? 'Unknown',
    championId: c.championId,
    points: c.championPoints,
    level: c.championLevel,
  }));

  return {
    userId,
    riotId: conta.riot_id ?? 'Desconhecido',
    nome: (conta.riot_id ?? 'Desconhecido').split('#')[0],
    puuid: conta.puuid,
    iconeId: conta.profile_icon_id ?? 1,
    nivel: conta.level ?? 1,
    lane: perfil?.lane_primaria ?? null,
    lane2: perfil?.lane_secundaria ?? null,
    balance: wallet.mc,
    soloQ: buildEloInfo(soloEntry),
    flexQ: buildEloInfo(flexEntry),
    topChampions,
    timeTag,
    timeColor,
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

// ── Cache TTL ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000;

export async function buscarOuAtualizarStats(puuid: string): Promise<StatsCache> {
  const { data } = await supabase
    .from('contas_riot')
    .select('elo_cache, champions_cache, stats_updated_at')
    .eq('puuid', puuid)
    .maybeSingle();

  const updatedAt = data?.stats_updated_at ? new Date(data.stats_updated_at) : null;
  const isFresh = !!updatedAt && (Date.now() - updatedAt.getTime()) < CACHE_TTL_MS;

  if (isFresh && data?.elo_cache) {
    return {
      soloQ: data.elo_cache.soloQ ?? null,
      flexQ: data.elo_cache.flexQ ?? null,
      topChampions: data.champions_cache?.topChampions ?? [],
      roles: data.champions_cache?.roles ?? [],
      totalGames: data.champions_cache?.totalGames ?? 0,
    };
  }

  const [{ soloQ, flexQ }, statsRaw] = await Promise.all([
    buscarElosJogador(puuid),
    buscarEstatisticasRecentes(puuid),
  ]);

  const topChampions = statsRaw?.topChampions ?? [];
  const roles = statsRaw?.roles ?? [];
  const totalGames = statsRaw?.totalGames ?? 0;

  supabase
    .from('contas_riot')
    .update({
      elo_cache: { soloQ, flexQ },
      champions_cache: { topChampions, roles, totalGames },
      stats_updated_at: new Date().toISOString(),
    })
    .eq('puuid', puuid)
    .then();

  return { soloQ, flexQ, topChampions, roles, totalGames };
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

    supabase.from('contas_riot').update(update).eq('user_id', userId).then();
    return result;
  } catch {
    return null;
  }
}

// ── Perfil básico (sem Riot API) ─────────────────────────────────────────────

export async function buscarPerfilBasico(userId: string): Promise<Omit<PerfilCompleto, 'soloQ' | 'flexQ' | 'topChampions'> | null> {
  // ✅ Schema novo: balance via wallets.mc; lanes via lane_primaria/secundaria.
  const [{ data: conta }, { data: perfil }, userTeams, wallet] = await Promise.all([
    supabase.from('contas_riot').select('riot_id, puuid, profile_icon_id, level').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('lane_primaria, lane_secundaria').eq('id', userId).maybeSingle(),
    api.teams.byUser(userId),
    buscarWallet(userId),
  ]);

  if (!conta) return null;

  const time = userTeams?.teams?.[0];
  const timeTag = time?.tag ?? undefined;
  const timeColor = time?.gradient_from ?? undefined;

  return {
    userId,
    riotId: conta.riot_id ?? 'Desconhecido',
    nome: (conta.riot_id ?? 'Desconhecido').split('#')[0],
    puuid: conta.puuid ?? '',
    iconeId: conta.profile_icon_id ?? 1,
    nivel: conta.level ?? 1,
    lane: perfil?.lane_primaria ?? null,
    lane2: perfil?.lane_secundaria ?? null,
    balance: wallet.mc,
    timeTag,
    timeColor,
  };
}

// ── Sistema de Ranking (M7 Points) ───────────────────────────────────────────

export interface ResultadoPartida {
  salaId: number;
  modo: string;
  vencedor: 'time_a' | 'time_b' | 'empate';
  jogadores: { userId: string; isTimeA: boolean; nome: string }[];
}

const PONTOS_POR_MODO: Record<string, { vitoria: number; derrota: number }> = {
  '5v5': { vitoria: 15, derrota: 1 },
  'time_vs_time': { vitoria: 20, derrota: 2 },
  'aram': { vitoria: 8, derrota: 1 },
  '1v1': { vitoria: 5, derrota: 1 },
};

export async function atualizarPontosPartida(resultado: ResultadoPartida): Promise<void> {
  const pontos = PONTOS_POR_MODO[resultado.modo] ?? { vitoria: 0, derrota: 0 };

  // ⚠️ TODO Fase 2: MP vive em `wallets`, mas `ajustar_mp` virou exclusiva de
  // service_role na Fase 0 — `ajustarMP` é stub no cliente e devolve null.
  // Ou seja, a premiação de MP abaixo NÃO credita mais nada (a função já não era
  // chamada em lugar nenhum). A distribuição de MP por partida precisa migrar
  // para o servidor junto com o pagamento de aposta. `atualizarStatsPorModo`
  // continua funcionando normalmente.
  const ajustes = resultado.jogadores.map(jogador => {
    const ehVitoria =
      (resultado.vencedor === 'time_a' && jogador.isTimeA) ||
      (resultado.vencedor === 'time_b' && !jogador.isTimeA);
    const mpGanho = ehVitoria ? pontos.vitoria : pontos.derrota;
    return { userId: jogador.userId, delta: mpGanho, ehVitoria };
  });

  await Promise.all([
    ...ajustes.map(a =>
      ajustarMP(a.userId, a.delta, `partida ${resultado.modo}`, undefined, 'sala')
    ),
    ...resultado.jogadores.map((jogador, idx) =>
      atualizarStatsPorModo(jogador.userId, resultado.modo, ajustes[idx].ehVitoria)
    ),
  ]);
}

async function atualizarStatsPorModo(userId: string, modo: string, vitoria: boolean): Promise<void> {
  const { data: stats } = await supabase
    .from('player_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('modo', modo)
    .maybeSingle();

  if (!stats) {
    await supabase.from('player_stats').insert({
      user_id: userId,
      modo,
      vitories: vitoria ? 1 : 0,
      defeats: vitoria ? 0 : 1,
      total_games: 1,
      winrate: vitoria ? 100 : 0,
    });
  } else {
    const novasVitorias = stats.vitories + (vitoria ? 1 : 0);
    const novasDerrotas = stats.defeats + (vitoria ? 0 : 1);
    const totalJogos = novasVitorias + novasDerrotas;
    const novoWinrate = totalJogos > 0 ? (novasVitorias / totalJogos) * 100 : 0;

    await supabase
      .from('player_stats')
      .update({
        vitories: novasVitorias,
        defeats: novasDerrotas,
        total_games: totalJogos,
        winrate: novoWinrate,
      })
      .eq('user_id', userId)
      .eq('modo', modo);
  }
}

export async function buscarPontosJogador(userId: string): Promise<{ mp: number; mc: number } | null> {
  // ✅ Schema novo: MP/MC vivem em `wallets`.
  const w = await buscarWallet(userId);
  return { mp: w.mp, mc: w.mc };
}

export async function buscarStatsPorModo(userId: string): Promise<any[]> {
  const { data } = await supabase.from('player_stats').select('*').eq('user_id', userId).order('total_games', { ascending: false });
  return data ?? [];
}

// ── Apostas em M Coins ───────────────────────────────────────────────────────

const TAXA_MC_POR_PARTIDA = 30;

/**
 * ⚠️ TODO Fase 2 — NÃO REATIVAR COMO ESTÁ. Função morta hoje (nenhum chamador).
 *
 * Fase 0 fechou `incrementar_saldo` (SECURITY DEFINER, sem checagem de quem
 * chamava) para uso exclusivo de `service_role`, e `ajustarMC` virou stub no
 * cliente. Logo, as duas linhas abaixo não movem mais saldo nenhum.
 *
 * Isso é intencional: pagamento de aposta não pode ser decidido pelo navegador
 * — quem declara o vencedor, debita perdedores, credita vencedores e retém a
 * taxa da plataforma tem que ser o servidor (Edge Function / RPC com validação
 * de estado da sala), numa transação só. Na Fase 2 este corpo é substituído por
 * uma chamada única a essa rotina server-side.
 */
export async function processarApostaPartida(
  resultado: ResultadoPartida,
  apostaValor: number,
  salaId: number
): Promise<void> {
  if (apostaValor <= 0) return;

  if (IS_DEV) {
  }

  const vencedores = resultado.jogadores.filter(j =>
    (resultado.vencedor === 'time_a' && j.isTimeA) ||
    (resultado.vencedor === 'time_b' && !j.isTimeA)
  );
  const perdedores = resultado.jogadores.filter(j =>
    (resultado.vencedor === 'time_a' && !j.isTimeA) ||
    (resultado.vencedor === 'time_b' && j.isTimeA)
  );

  if (vencedores.length === 0 || perdedores.length === 0) return;

  const totalPrêmio = perdedores.length * apostaValor;
  const prêmioLíquido = totalPrêmio - TAXA_MC_POR_PARTIDA;
  const prêmioPorVencedor = Math.floor(prêmioLíquido / vencedores.length);

  if (IS_DEV) {
  }

  // ✅ Schema novo: ajustarMC chama RPC `incrementar_saldo` (que agora escreve em wallets.mc + transacoes).
  await Promise.all(perdedores.map(j => ajustarMC(j.userId, -apostaValor)));
  await Promise.all(vencedores.map(j => ajustarMC(j.userId, prêmioPorVencedor)));

  // 🔒 Regra de negócio no servidor: débito/crédito de aposta e a taxa da
  // plataforma (ganhos_plataforma) passam a ser decididos pela API de salas,
  // nunca pelo navegador. Esta função está morta (nenhum chamador) até lá.
}