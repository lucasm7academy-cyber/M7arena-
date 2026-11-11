import { api } from '../../../lib/api';
import { getDDRVersion } from '../../../api/riot';
import { type Jogador, type Role, type EloType, TIER_MAP } from '../../../components/players/playerMeta';

export const PLAYERS_PAGE = 40;

// Mapa de roles
const LANE_MAP: Record<string, Role> = {
  Top: 'TOP', Jungle: 'JG', Middle: 'MID', Bottom: 'ADC', Support: 'SUP', Fill: 'RES',
};

// ✅ Calcula partidas/winRate da ranqueada (SoloQ com fallback FlexQ).
//    Os dados vêm direto da RPC (elo_cache.{soloQ,flexQ}.{wins,losses}),
//    espelhando o que o PerfilContext mostra para o próprio usuário.
function statsDeRanqueada(c: any): { partidas: number; winRate: number } {
  const soloWins   = Number(c.soloq_wins   ?? 0);
  const soloLosses = Number(c.soloq_losses ?? 0);
  const soloTotal  = soloWins + soloLosses;

  if (soloTotal > 0) {
    return {
      partidas: soloTotal,
      winRate:  Math.round((soloWins / soloTotal) * 100),
    };
  }

  const flexWins   = Number(c.flexq_wins   ?? 0);
  const flexLosses = Number(c.flexq_losses ?? 0);
  const flexTotal  = flexWins + flexLosses;

  if (flexTotal > 0) {
    return {
      partidas: flexTotal,
      winRate:  Math.round((flexWins / flexTotal) * 100),
    };
  }

  return { partidas: 0, winRate: 0 };
}

// ✅ Leitura do elo = só cache do banco (elo_cache). Nada de chamada à Riot
//    no load da página: o refresh de elo é feito por job agendado semanal
//    (cron) e pelo botão "Atualizar elos agora" no painel admin. O jogador
//    que não tem elo_cache gravado aparece como "Sem Rank", nunca "Ferro".

// Mapeamentos inversos para filtros server-side
const ELO_TO_TIER: Record<string, string> = {
  'Ferro': 'IRON', 'Bronze': 'BRONZE', 'Prata': 'SILVER', 'Ouro': 'GOLD',
  'Platina': 'PLATINUM', 'Esmeralda': 'EMERALD', 'Diamante': 'DIAMOND',
  'Mestre': 'MASTER', 'Grão-Mestre': 'GRANDMASTER', 'Desafiante': 'CHALLENGER',
};
const ROLE_TO_LANE: Record<string, string> = {
  TOP: 'Top', JG: 'Jungle', MID: 'Middle', ADC: 'Bottom', SUP: 'Support', RES: 'Fill',
};

// ✅ Carregar jogadores — todos os filtros server-side via API própria.
//    O elo vem do elo_cache gravado no banco (leitura leve, sem chamada Riot).
export async function carregarJogadores(
  offset = 0,
  limit = PLAYERS_PAGE,
  searchTerm = '',
  filtroElo: EloType | 'todos' = 'todos',
  filtroRole: Role | 'todos' = 'todos',
  filtroSemTime = false
): Promise<{ jogadores: Jogador[]; totalCount: number }> {
  const rows = await api.players.filtrados({
    p_offset:    offset,
    p_limit:     limit,
    p_search:    searchTerm.trim(),
    p_elo_tier:  filtroElo  !== 'todos' ? (ELO_TO_TIER[filtroElo]  ?? '') : '',
    p_role_lane: filtroRole !== 'todos' ? (ROLE_TO_LANE[filtroRole] ?? '') : '',
  }).catch(() => []);

  if (!rows?.length) return { jogadores: [], totalCount: 0 };

  // Garante a versão atual do ddragon antes de montar as URLs dos ícones.
  await getDDRVersion();

  const totalCount = Number(rows[0]?.total_count ?? 0);
  const userIds = rows.map((r: any) => r.user_id).filter(Boolean);

  // ✅ Partidas/winRate vêm do elo_cache (wins/losses das ranqueadas).
  //    O cálculo é feito por linha mais abaixo via statsDeRanqueada().

  // Buscar membros e times (incluindo convidados/guests).
  // O Riot ID é mandado para TODOS os jogadores, não só para quem não tem
  // conta: quem tem conta mas está no time como CONVIDADO (user_id NULL no
  // roster — metade dos times) ficava sem time no card enquanto a página do
  // time mostrava ele (ADR-087, caso macoinha07#fck13).
  const userIdsFilter: string[] = userIds.length ? userIds : [];
  const guestRiotIds = rows.map((r: any) => r.riot_id).filter(Boolean);

  let membros: any[] = [];
  if (userIdsFilter.length > 0 || guestRiotIds.length > 0) {
    const data = await api.teams.members({ user_ids: userIdsFilter, guest_riot_ids: guestRiotIds });
    membros = data || [];
  }

  const timeIds = [...new Set((membros ?? []).map(m => m.time_id))];
  const times = timeIds.length
    ? await api.teams.batch(timeIds)
    : [];

  // Vínculo real (user_id) vence a vaga de convidado do mesmo jogador. A API
  // já ordena user_id por último; aqui a preferência fica explícita.
  const membroMap: Record<string, any> = {};
  for (const m of membros ?? []) {
    if (m.status && m.status !== 'accepted') continue; // 'saiu'/'pendente' não é time
    if (m.user_id) membroMap[m.user_id] = m;
    const guestKey = (m.guest_riot_id ?? '').trim().toLowerCase();
    if (!m.user_id && guestKey && !membroMap[guestKey]) membroMap[guestKey] = m;
  }
  const timeMap   = Object.fromEntries((times   ?? []).map((t: any) => [t.id, t]));

  const jogadores: Jogador[] = rows.map((c: any) => {
    const membro =
      (c.user_id ? membroMap[c.user_id] : null) ??
      membroMap[(c.riot_id ?? '').trim().toLowerCase()] ??
      null;
    const time   = membro ? timeMap[membro.time_id] : null;
    const { partidas, winRate } = statsDeRanqueada(c);
    const eloType: EloType = c.tier ? (TIER_MAP[c.tier] ?? 'Sem Rank') : 'Sem Rank';

    return {
      id:       c.user_id || c.riot_id,
      riotId:   c.riot_id  ?? 'Jogador',
      nome:     (c.riot_id ?? 'Jogador').split('#')[0],
      nivel:    c.level    ?? 1,
      elo:      eloType,
      iconeId:  c.profile_icon_id ?? 1,
      partidas,
      winRate,
      rolePrincipal:  (LANE_MAP[c.lane]  ?? 'RES') as Role,
      roleSecundaria: (LANE_MAP[c.lane2] ?? 'RES') as Role,
      isVIP:       c.is_vip  ?? false,
      isVerified:  true,
      timeTag:   time?.tag           ?? undefined,
      timeColor: time?.gradient_from ?? undefined,
      timeId:    membro?.time_id     ?? undefined,
      _puuid: c.puuid ?? undefined,
    } as Jogador & { _puuid?: string };
  });

  return { jogadores, totalCount };
}
