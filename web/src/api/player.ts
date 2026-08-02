/**
 * src/api/player.ts
 * 
 * ✅ VERSÃO OTIMIZADA
 * - Promise.all para operações paralelas
 * - .in() para evitar N+1 queries
 * - Uso do PerfilContext quando disponível
 */

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
  // ✅ Schema novo: balance vem de `wallets.mc`, lane/lane2 de users
  // (lanePrimary/laneSecondary) e a conta Riot de game_accounts — tudo via
  // GET /profiles/:id (shape legado).
  const [perfilPublico, userTeams, wallet] = await Promise.all([
    api.profiles.get(userId),
    api.teams.byUser(userId),
    buscarWallet(userId),
  ]);

  const conta = perfilPublico?.riotAccount ?? null;
  const perfil = perfilPublico?.profile ?? null;

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
    // ✅ Regra no servidor: elo_cache vive em metadata do game_account do dono.
    api.profiles
      .updateRiot({
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
      .catch((e: any) => { if (IS_DEV) console.warn('⚠️ updateRiot falhou:', e?.message); });
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
  const conta = await api.players.byPuuid(puuid);

  const updatedAt = conta?.stats_updated_at ? new Date(conta.stats_updated_at) : null;
  const isFresh = !!updatedAt && (Date.now() - updatedAt.getTime()) < CACHE_TTL_MS;

  if (isFresh && conta?.elo_cache) {
    return {
      soloQ: conta.elo_cache.soloQ ?? null,
      flexQ: conta.elo_cache.flexQ ?? null,
      topChampions: conta.champions_cache?.topChampions ?? [],
      roles: conta.champions_cache?.roles ?? [],
      totalGames: conta.champions_cache?.totalGames ?? 0,
    };
  }

  const [{ soloQ, flexQ }, statsRaw] = await Promise.all([
    buscarElosJogador(puuid),
    buscarEstatisticasRecentes(puuid),
  ]);

  const topChampions = statsRaw?.topChampions ?? [];
  const roles = statsRaw?.roles ?? [];
  const totalGames = statsRaw?.totalGames ?? 0;

  // Cache do dono da conta — a API só aceita a própria conta (PUT /me/riot).
  api.profiles
    .updateRiot({
      elo_cache: { soloQ, flexQ },
      champions_cache: { topChampions, roles, totalGames },
      stats_updated_at: new Date().toISOString(),
    })
    .catch((e: any) => { if (IS_DEV) console.warn('⚠️ updateRiot falhou:', e?.message); });

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

    await api.profiles.updateRiot(update);
    return result;
  } catch {
    return null;
  }
}

// ── Perfil básico (sem Riot API) ─────────────────────────────────────────────

export async function buscarPerfilBasico(userId: string): Promise<Omit<PerfilCompleto, 'soloQ' | 'flexQ' | 'topChampions'> | null> {
  // ✅ Schema novo: balance via wallets.mc; lanes via users (lanePrimary/laneSecondary).
  const [perfilPublico, userTeams, wallet] = await Promise.all([
    api.profiles.get(userId),
    api.teams.byUser(userId),
    buscarWallet(userId),
  ]);

  const conta = perfilPublico?.riotAccount ?? null;
  const perfil = perfilPublico?.profile ?? null;

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
  // Regra de negócio no servidor: a API recalcula o agregado (vitórias/
  // derrotas/total/winrate) de forma atômica; o cliente só informa o resultado.
  await api.content.recordPlayerStats({ userId, modo, vitoria });
}

export async function buscarPontosJogador(userId: string): Promise<{ mp: number; mc: number } | null> {
  // ✅ Schema novo: MP/MC vivem em `wallets`.
  const w = await buscarWallet(userId);
  return { mp: w.mp, mc: w.mc };
}

export async function buscarStatsPorModo(userId: string): Promise<any[]> {
  return api.content.playerStats(userId);
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