/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ VERSÃO OTIMIZADA - players.tsx
 * - Design System Cut-Edge Oficial M7 Arena
 * - Dual Container Cut-Edge nos Cards (VIP e não-VIP)
 * - Elo via cache do banco (sem Riot API)
 * - Contagem de partidas otimizada com mapa
 * - Logs removidos em produção
 * - Promise.all para atualizações paralelas
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Trophy, Search,
  ShieldCheck, Gamepad2, X, Check, ChevronDown
} from 'lucide-react';
import { useSound } from '../hooks/useSound';
import { api } from '../lib/api';
import {
  PlayerDetailModal,
  type Jogador,
  type Role,
  type EloType,
  ROLE_CONFIG,
  ELO_STYLES,
  ELOS_ORDER,
  ROLES_ORDER,
  TIER_MAP,
  getIconeUrl,
} from '../components/players/PlayerDetailModal';
import { VipCrown } from '../components/ui/VipBadge';

const IS_DEV = import.meta.env.DEV;
const PLAYERS_PAGE = 40;
const PRIMARY_COLOR = '#FFB700';

// ── Polígonos Cut-Edge Oficiais (com espessura uniforme de 1px) ──────────────
const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
const CUT_FRAME_INNER = 'polygon(10.6px 0, 100% 0, 100% calc(100% - 10.6px), calc(100% - 10.6px) 100%, 0 100%, 0 10.6px)';
const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';
const CUT_BUTTON_INNER = 'polygon(5.6px 0, 100% 0, 100% calc(100% - 5.6px), calc(100% - 5.6px) 100%, 0 100%, 0 5.6px)';
const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CUT_BADGE_INNER = 'polygon(2.6px 0, 100% 0, 100% calc(100% - 2.6px), calc(100% - 2.6px) 100%, 0 100%, 0 2.6px)';

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

// ✅ Atualiza o elo_cache das contas stale NO SERVIDOR, em uma única chamada.
//
// Gatilho de atualização (mantido o critério atual):
//   - TTL expirado (1h, acelerado de 24h pra ver wins/losses chegarem rápido); ou
//   - Não tem tier nenhum (jogador novo); ou
//   - Tem tier mas o cache antigo não tem `wins`/`losses` (campo só criado agora).
//
// `force=true` ignora TTL e atualiza tudo que tiver puuid (botão "Atualizar dados").
// O servidor decide as contas stale (TTL 30min), busca a Riot em lote serial
// (3 em paralelo) e grava elo_cache + stats_updated_at — o cliente NÃO chama
// mais buscarElo em massa.
const TTL_MS = 60 * 60 * 1000; // 1h
async function atualizarElosServerSide(contas: any[], force = false): Promise<number> {
  const agora = Date.now();
  const contasParaAtualizar = contas.filter(conta => {
    if (!conta.puuid) return false;
    if (force) return true;

    const updatedAt = conta.stats_updated_at ?? conta.last_elo_update;
    const eloAntigo = !updatedAt || (agora - new Date(updatedAt).getTime()) > TTL_MS;
    const semElo    = !conta.tier;
    // Cache antigo: tem tier mas wins/losses não foram gravados ainda.
    const semWinsLosses = !!conta.tier &&
      (conta.soloq_wins == null || conta.soloq_losses == null) &&
      (conta.flexq_wins == null || conta.flexq_losses == null);

    return eloAntigo || semElo || semWinsLosses;
  });

  if (IS_DEV) console.log(`📡 atualizarElosServerSide: ${contasParaAtualizar.length}/${contas.length} contas (force=${force})`);
  if (contasParaAtualizar.length === 0) return 0;

  try {
    const res = await fetch('/api/players/refresh-elos', { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      console.warn('⚠️ refresh-elos falhou:', res.status, res.statusText);
      return 0;
    }
    const data = await res.json();
    if (IS_DEV) console.log(`✅ refresh-elos: ${data?.atualizadas ?? 0} atualizadas / ${data?.total ?? 0} total / ${data?.erros ?? 0} erros`);
    return data?.atualizadas ?? 0;
  } catch (err: any) {
    console.warn('⚠️ refresh-elos falhou:', err?.message);
    return 0;
  }
}

// Mapeamentos inversos para filtros server-side
const ELO_TO_TIER: Record<string, string> = {
  'Ferro': 'IRON', 'Bronze': 'BRONZE', 'Prata': 'SILVER', 'Ouro': 'GOLD',
  'Platina': 'PLATINUM', 'Esmeralda': 'EMERALD', 'Diamante': 'DIAMOND',
  'Mestre': 'MASTER', 'Grão-Mestre': 'GRANDMASTER', 'Desafiante': 'CHALLENGER',
};
const ROLE_TO_LANE: Record<string, string> = {
  TOP: 'Top', JG: 'Jungle', MID: 'Middle', ADC: 'Bottom', SUP: 'Support', RES: 'Fill',
};

// ✅ Carregar jogadores — todos os filtros server-side via RPC
async function carregarJogadores(
  offset = 0,
  limit = PLAYERS_PAGE,
  searchTerm = '',
  filtroElo: EloType | 'todos' = 'todos',
  filtroRole: Role | 'todos' = 'todos',
  filtroSemTime = false,
  opts: { refreshElos?: boolean; forceRefresh?: boolean; onRefreshed?: () => void } = {}
): Promise<{ jogadores: Jogador[]; totalCount: number }> {
  const rows = await api.players.filtrados({
    p_offset:    offset,
    p_limit:     limit,
    p_search:    searchTerm.trim(),
    p_elo_tier:  filtroElo  !== 'todos' ? (ELO_TO_TIER[filtroElo]  ?? '') : '',
    p_role_lane: filtroRole !== 'todos' ? (ROLE_TO_LANE[filtroRole] ?? '') : '',
  }).catch(() => []);

  if (!rows?.length) return { jogadores: [], totalCount: 0 };

  const totalCount = Number(rows[0]?.total_count ?? 0);
  const userIds = rows.map((r: any) => r.user_id).filter(Boolean);

  // ✅ Dispara refresh SERVER-SIDE do elo_cache em BACKGROUND (não bloqueia render).
  //    O servidor decide as contas stale (TTL 30min) e busca a Riot em lote
  //    serial (3 em paralelo) — o cliente faz UMA chamada em vez de ~154
  //    buscarElo + ~154 escritas. Quando termina, refetch da página pra exibir o elo novo.
  if (opts.refreshElos !== false && userIds.length > 0) {
    atualizarElosServerSide(rows, opts.forceRefresh ?? false)
      .then(() => { if (opts.onRefreshed) opts.onRefreshed(); })
      .catch((err) => { if (IS_DEV) console.warn('⚠️ refresh-elos falhou:', err?.message); });
  }

  // ✅ Partidas/winRate agora vêm da ranqueada do LoL (RPC v3 entrega wins/losses).
  //    O cálculo é feito por linha mais abaixo via statsDeRanqueada().

  // ✅ Schema novo: MP/MC vêm de wallets (não mais de contas_riot.mp/mc).
  const walletMap: Record<string, { mp: number; mc: number }> = {};
  if (userIds.length > 0) {
    const walletsData = await api.wallet.adminBalances(userIds);
    (walletsData ?? []).forEach((w: any) => { walletMap[w.userId] = { mp: w.mp ?? 0, mc: w.mc ?? 0 }; });
  }

  // Buscar membros e times (incluindo convidados/guests)
  const userIdsFilter: string[] = userIds.length ? userIds : [];
  const guestRiotIds = rows.filter((r: any) => !r.user_id).map((r: any) => r.riot_id).filter(Boolean);

  let membros: any[] = [];
  if (userIdsFilter.length > 0 || guestRiotIds.length > 0) {
    const data = await api.teams.members({ user_ids: userIdsFilter, guest_riot_ids: guestRiotIds });
    membros = data || [];
  }

  const timeIds = [...new Set((membros ?? []).map(m => m.time_id))];
  const times = timeIds.length
    ? await api.teams.batch(timeIds)
    : [];

  const membroMap = Object.fromEntries((membros ?? []).map(m => [m.user_id || m.guest_riot_id, m]));
  const timeMap   = Object.fromEntries((times   ?? []).map((t: any) => [t.id, t]));

  const jogadores: Jogador[] = rows.map((c: any) => {
    const membro = membroMap[c.user_id || c.riot_id];
    const time   = membro ? timeMap[membro.time_id] : null;
    const { partidas, winRate } = statsDeRanqueada(c);
    const eloType: EloType = c.tier ? (TIER_MAP[c.tier] ?? 'Ferro') : 'Ferro';

    return {
      id:       c.user_id || c.riot_id,
      riotId:   c.riot_id  ?? 'Jogador',
      nome:     (c.riot_id ?? 'Jogador').split('#')[0],
      nivel:    c.level    ?? 1,
      elo:      eloType,
      iconeId:  c.profile_icon_id ?? 1,
      partidas,
      winRate,
      titulos:  0,
      rolePrincipal:  (LANE_MAP[c.lane]  ?? 'RES') as Role,
      roleSecundaria: (LANE_MAP[c.lane2] ?? 'RES') as Role,
      isVIP:       c.is_vip  ?? false,
      isVerified:  true,
      kda: 0, csPorMinuto: 0, participacaoKill: 0, conquistas: [],
      timeTag:   time?.tag           ?? undefined,
      timeColor: time?.gradient_from ?? undefined,
      timeLogo:  time?.logo_url      ?? undefined,
      timeId:    membro?.time_id     ?? undefined,
      mp: c.user_id ? (walletMap[c.user_id]?.mp ?? 0) : 0,
      mc: c.user_id ? (walletMap[c.user_id]?.mc ?? 0) : 0,
      _puuid: c.puuid ?? undefined,
    } as Jogador & { _puuid?: string };
  });

  return { jogadores, totalCount };
}

// ── Componente Paginação Cut-Edge ───────────────────────────────────────────
function Paginacao({
  currentPage,
  totalPages,
  onChangePage,
  loading
}: {
  currentPage: number;
  totalPages: number;
  onChangePage: (page: number) => void;
  loading: boolean;
}) {
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    if (currentPage <= 3) {
      return [0, 1, 2, 3, 4, '...', totalPages - 1];
    } else if (currentPage >= totalPages - 4) {
      return [0, '...', totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1];
    } else {
      return [0, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages - 1];
    }
  };

  if (totalPages <= 1) return null;

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col items-center gap-4 mt-12 pb-8">
      <p className="text-white/60 text-sm font-bold uppercase tracking-widest">
        Página <span className="text-[#FFB700]">{currentPage + 1}</span> de <span className="text-[#FFB700]">{totalPages}</span>
      </p>
      <div className="flex items-center justify-center gap-2">
        <motion.button
          whileHover={{ scale: !loading && currentPage > 0 ? 1.05 : 1 }}
          whileTap={{ scale: !loading && currentPage > 0 ? 0.95 : 1 }}
          onClick={() => onChangePage(currentPage - 1)}
          disabled={currentPage === 0 || loading}
          className="relative p-[1px] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white bg-[#0d0d12] hover:bg-white/5 transition-all font-bold"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            ←
          </div>
        </motion.button>

        {loading ? (
          <div className="w-12 h-10 flex items-center justify-center">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: PRIMARY_COLOR, borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5">
            {pages.map((page, i) =>
              page === '...' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-white/40 font-bold">
                  …
                </span>
              ) : (
                <motion.button
                  key={page}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onChangePage(page as number)}
                  className="relative p-[1px] cursor-pointer"
                  style={{
                    clipPath: CUT_BUTTON,
                    background: page === currentPage ? PRIMARY_COLOR : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <div
                    className={`w-10 h-10 flex items-center justify-center font-bold text-sm transition-all ${
                      page === currentPage
                        ? 'bg-[#FFB700] text-black font-black'
                        : 'bg-[#0d0d12] text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    {(page as number) + 1}
                  </div>
                </motion.button>
              )
            )}
          </div>
        )}

        <motion.button
          whileHover={{ scale: !loading && currentPage < totalPages - 1 ? 1.05 : 1 }}
          whileTap={{ scale: !loading && currentPage < totalPages - 1 ? 0.95 : 1 }}
          onClick={() => onChangePage(currentPage + 1)}
          disabled={currentPage === totalPages - 1 || loading}
          className="relative p-[1px] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white bg-[#0d0d12] hover:bg-white/5 transition-all font-bold"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            →
          </div>
        </motion.button>
      </div>
    </div>
  );
}

// ── Componente Principal ────────────────────────────────────────────────────
export default function App() {
  const { playSound } = useSound();
  const [searchTerm, setSearchTerm] = useState('');
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [filtroElo, setFiltroElo] = useState<EloType | 'todos'>('todos');
  const [filtroRole, setFiltroRole] = useState<Role | 'todos'>('todos');
  const [filtroSemTime, setFiltroSemTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedJogador, setSelectedJogador] = useState<Jogador | null>(null);
  const [popup, setPopup] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [_selectedPuuid, setSelectedPuuid] = useState<string | undefined>(undefined);

  const listTopRef = useRef<HTMLDivElement>(null);
  const filterTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Navegar para uma página específica (mantém filtros ativos)
  const irParaPagina = async (
    page: number,
    search: string,
    elo: EloType | 'todos',
    role: Role | 'todos',
    semTime: boolean,
    isPageNav = false,
    forceRefresh = false
  ) => {
    if (isPageNav) setLoadingPage(true); else setLoading(true);
    const { jogadores: lista, totalCount: total } = await carregarJogadores(
      page * PLAYERS_PAGE, PLAYERS_PAGE, search, elo, role, semTime,
      {
        forceRefresh,
        onRefreshed: () => {
          // Rebusca a página atual SEM spinner e SEM disparar outro refresh,
          // pra mostrar o elo que acabou de ser atualizado no servidor.
          carregarJogadores(page * PLAYERS_PAGE, PLAYERS_PAGE, search, elo, role, semTime, { refreshElos: false })
            .then(({ jogadores: novos }) => { if (novos.length) setJogadores(novos); })
            .catch((err: any) => { if (IS_DEV) console.warn('⚠️ refetch pós-refresh falhou:', err?.message); });
        },
      }
    );
    setJogadores(lista);
    setCurrentPage(page);
    setTotalCount(total);
    if (isPageNav) { setLoadingPage(false); listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else setLoading(false);
  };

  // Popup auto-dismiss
  useEffect(() => {
    if (popup) {
      const timer = setTimeout(() => setPopup(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [popup]);

  // Effect unificado: qualquer filtro ou busca → rebusca no banco (debounce 300ms)
  useEffect(() => {
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    filterTimeoutRef.current = setTimeout(() => {
      irParaPagina(0, searchTerm, filtroElo, filtroRole, filtroSemTime);
    }, 300);
    return () => { if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current); };
  }, [searchTerm, filtroElo, filtroRole, filtroSemTime]);

  const handleVerPerfil = (jogador: Jogador) => {
    playSound('click');
    setSelectedJogador(jogador);
    setSelectedPuuid((jogador as any)._puuid);
  };

  return (
    <div ref={listTopRef} className="w-full max-w-7xl mx-auto px-4 py-8 overflow-hidden">
      <AnimatePresence>
        {popup && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] p-[1px] shadow-2xl"
            style={{
              clipPath: CUT_BUTTON,
              background: popup.type === 'error' ? '#ef4444' : popup.type === 'success' ? '#22c55e' : PRIMARY_COLOR,
            }}
          >
            <div
              className={`px-6 py-3 flex items-center gap-3 text-white font-medium text-sm ${
                popup.type === 'error' ? 'bg-[#180505]' : popup.type === 'success' ? 'bg-[#05180a]' : 'bg-[#181405]'
              }`}
              style={{ clipPath: CUT_BUTTON_INNER }}
            >
              {popup.type === 'error' && <X className="w-5 h-5 text-red-400" />}
              {popup.type === 'success' && <Check className="w-5 h-5 text-green-400" />}
              {popup.type === 'info' && <Users className="w-5 h-5 text-[#FFB700]" />}
              <span>{popup.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedJogador && (
          <PlayerDetailModal jogador={selectedJogador} onClose={() => { setSelectedJogador(null); setSelectedPuuid(undefined); }} />
        )}
      </AnimatePresence>

      {/* Banner */}
      <div
        className="relative p-[1px] mb-8 w-full"
        style={{
          clipPath: CUT_FRAME,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.03))',
        }}
      >
        <div
          className="relative overflow-hidden bg-[#08080a]"
          style={{ clipPath: CUT_FRAME_INNER }}
        >
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden p-6 md:p-8">
            <div className="absolute inset-0 z-0">
              <img src="/images/fundoryzecortado.webp" alt="Arena" className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#08080a] via-[#08080a]/80 to-transparent" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center relative p-[1px] mb-2" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center gap-2 px-2.5 py-1 bg-[#0f0f14]" style={{ clipPath: CUT_BADGE_INNER }}>
                    <Users className="w-4 h-4 text-[#FFB700]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Arena de Jogadores</span>
                  </div>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase tracking-tighter">
                  Jogadores <span style={{ color: PRIMARY_COLOR }}>M7 </span>
                </h1>
                <p className="text-white/50 text-sm max-w-lg">Conheça os melhores invocadores da comunidade, suas estatísticas e conquistas.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative p-[1px]" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.12)' }}>
                  <div className="px-3 py-1.5 bg-[#0f0f14] flex items-center gap-1.5" style={{ clipPath: CUT_BADGE_INNER }}>
                    <span className="text-white font-black text-sm">{totalCount}</span>
                    <span className="text-white/40 font-bold text-[10px] uppercase tracking-wider">Jogadores</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Filtros */}
      <div
        className="relative p-[1px] mb-12 w-full"
        style={{
          clipPath: CUT_FRAME,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))',
        }}
      >
        <div
          className="w-full p-5 md:p-6 bg-[#08080a] relative overflow-hidden"
          style={{ clipPath: CUT_FRAME_INNER }}
        >
          {/* Glow de fundo sutil */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4 relative z-10">
            {/* Busca por Riot ID */}
            <div className="relative p-[1px] md:col-span-4" style={{ clipPath: CUT_BUTTON, background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))' }}>
              <div className="relative flex items-center bg-[#0d0d12] w-full h-full" style={{ clipPath: CUT_BUTTON_INNER }}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por Riot ID..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent pl-12 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none text-sm transition-all"
                />
              </div>
            </div>

            {/* Filtro Elo */}
            <div className="relative p-[1px] md:col-span-3" style={{ clipPath: CUT_BUTTON, background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))' }}>
              <div className="relative flex items-center bg-[#0d0d12] w-full h-full" style={{ clipPath: CUT_BUTTON_INNER }}>
                <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 pointer-events-none" />
                <select
                  value={filtroElo}
                  onChange={e => setFiltroElo(e.target.value as EloType | 'todos')}
                  className="w-full bg-transparent pl-10 pr-10 py-3 text-white/80 focus:outline-none appearance-none cursor-pointer text-sm transition-all"
                >
                  <option value="todos" className="bg-[#0f0f12] text-white">Todos os Elos</option>
                  {ELOS_ORDER.map(elo => (
                    <option key={elo} value={elo} className="bg-[#0f0f12] text-white">{elo}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 pointer-events-none" />
              </div>
            </div>

            {/* Filtro Role */}
            <div className="relative p-[1px] md:col-span-3" style={{ clipPath: CUT_BUTTON, background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))' }}>
              <div className="relative flex items-center bg-[#0d0d12] w-full h-full" style={{ clipPath: CUT_BUTTON_INNER }}>
                <Gamepad2 className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 pointer-events-none" />
                <select
                  value={filtroRole}
                  onChange={e => setFiltroRole(e.target.value as Role | 'todos')}
                  className="w-full bg-transparent pl-10 pr-10 py-3 text-white/80 focus:outline-none appearance-none cursor-pointer text-sm transition-all"
                >
                  <option value="todos" className="bg-[#0f0f12] text-white">Todas as Roles</option>
                  {ROLES_ORDER.map(role => (
                    <option key={role} value={role} className="bg-[#0f0f12] text-white">{ROLE_CONFIG[role].label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 pointer-events-none" />
              </div>
            </div>

            {/* Sem Time */}
            <button
              type="button"
              onClick={() => setFiltroSemTime(v => !v)}
              className="relative p-[1px] md:col-span-2 group/btn cursor-pointer transition-all"
              style={{
                clipPath: CUT_BUTTON,
                background: filtroSemTime ? PRIMARY_COLOR : 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
              }}
            >
              <div
                className={`w-full h-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold transition-all ${
                  filtroSemTime
                    ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(255,183,0,0.15)]'
                    : 'bg-[#0d0d12] text-white/40 group-hover/btn:text-white/70'
                }`}
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                <Users className="w-4 h-4" /> Sem Time
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Jogadores */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {jogadores.map((jogador, index) => {
              const roleConfig = ROLE_CONFIG[jogador.rolePrincipal];
              const roleSecConfig = ROLE_CONFIG[jogador.roleSecundaria];
              const eloStyle = ELO_STYLES[jogador.elo];
              const winRateColor = jogador.winRate >= 50 ? '#4ade80' : '#ef4444';

              const outerGradient = jogador.isVIP
                ? `linear-gradient(135deg, ${PRIMARY_COLOR}, #ffd54f 50%, rgba(255, 183, 0, 0.3) 100%)`
                : `linear-gradient(135deg, ${eloStyle.border}, ${eloStyle.border}80 50%, rgba(255, 255, 255, 0.05) 100%)`;

              const outerShadow = jogador.isVIP
                ? 'drop-shadow(0 0 12px rgba(255, 183, 0, 0.35))'
                : `drop-shadow(0 0 8px ${eloStyle.border}30)`;

              return (
                <motion.div
                  key={jogador.id}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: (index % 8) * 0.05 }}
                  className="group cursor-pointer h-full"
                  onClick={() => handleVerPerfil(jogador)}
                >
                  <div
                    className="relative p-[1px] h-full w-full transition-all duration-300 group-hover:-translate-y-1"
                    style={{
                      clipPath: CUT_FRAME,
                      background: outerGradient,
                      filter: outerShadow,
                    }}
                  >
                    <div
                      className="w-full h-full bg-[#08080a] group-hover:bg-[#0c0c10] p-5 relative overflow-hidden flex flex-col justify-between transition-colors"
                      style={{ clipPath: CUT_FRAME_INNER }}
                    >
                      {jogador.isVIP && (
                        <>
                          {/* VIP Crown */}
                          <div
                            className="absolute -top-2 left-1/2 -translate-x-1/2 z-30"
                            style={{
                              color: PRIMARY_COLOR,
                              filter: 'drop-shadow(0 0 8px rgba(255, 183, 0, 0.6))',
                              animation: 'vip-crown-pulse 2s ease-in-out infinite',
                            }}
                          >
                            <VipCrown />
                          </div>

                          {/* VIP Badge - Top right corner */}
                          <div className="absolute top-3 right-3 z-40">
                            <div
                              className="relative p-[1px]"
                              style={{
                                clipPath: CUT_BADGE,
                                background: `linear-gradient(135deg, ${PRIMARY_COLOR}, #ffd54f)`,
                              }}
                            >
                              <div
                                className="px-2.5 py-0.5 font-black text-[10px] tracking-wider text-black flex items-center justify-center"
                                style={{
                                  clipPath: CUT_BADGE_INNER,
                                  background: `linear-gradient(135deg, ${PRIMARY_COLOR}, #ffd54f)`,
                                  boxShadow: '0 4px 12px rgba(255, 183, 0, 0.5)',
                                  textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                }}
                              >
                                VIP
                              </div>
                            </div>
                          </div>

                          {/* Shine Sweep Effect */}
                          <div className="absolute inset-0 pointer-events-none z-20" style={{ clipPath: CUT_FRAME_INNER }}>
                            <div
                              style={{
                                position: 'absolute',
                                top: '-50%',
                                left: '-50%',
                                width: '200%',
                                height: '200%',
                                background: 'linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.6) 50%, transparent 55%)',
                                animation: 'shine-sweep 5s infinite',
                                pointerEvents: 'none',
                                transform: 'rotate(45deg)',
                              }}
                            />
                          </div>
                        </>
                      )}

                      {/* Header Info (Avatar, Name, Badges) */}
                      <div>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="relative">
                            <div
                              className="absolute inset-0 rounded-full blur-[3px] opacity-40 group-hover:opacity-100 transition-opacity"
                              style={{ background: jogador.isVIP ? PRIMARY_COLOR : eloStyle.border }}
                            />
                            <img
                              src={getIconeUrl(jogador.iconeId)}
                              loading="lazy"
                              className="w-16 h-16 rounded-full border-2 relative z-10 shadow-xl"
                              style={{
                                borderColor: jogador.isVIP ? PRIMARY_COLOR : eloStyle.border,
                                filter: jogador.isVIP
                                  ? 'drop-shadow(0 0 12px rgba(255, 183, 0, 0.4)) drop-shadow(0 0 6px rgba(255, 183, 0, 0.2))'
                                  : `drop-shadow(0 0 10px ${eloStyle.border}40) drop-shadow(0 0 4px ${eloStyle.border}20)`,
                              }}
                              alt={jogador.nome}
                            />
                            {/* Level Badge */}
                            <div className="absolute -bottom-1 -right-1 z-20" style={{ clipPath: CUT_BADGE, background: '#0a0a0a' }}>
                              <div
                                className="px-1.5 py-0.5 text-[10px] font-bold text-black flex items-center justify-center"
                                style={{
                                  clipPath: CUT_BADGE_INNER,
                                  background: PRIMARY_COLOR,
                                }}
                              >
                                {jogador.nivel}
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p
                                className="font-black text-lg tracking-tight truncate max-w-[150px]"
                                style={{
                                  background: jogador.isVIP ? `linear-gradient(135deg, ${PRIMARY_COLOR}, #ffd54f, ${PRIMARY_COLOR})` : undefined,
                                  backgroundClip: jogador.isVIP ? 'text' : undefined,
                                  WebkitBackgroundClip: jogador.isVIP ? 'text' : undefined,
                                  WebkitTextFillColor: jogador.isVIP ? 'transparent' : '#fff',
                                  color: jogador.isVIP ? undefined : '#fff',
                                  filter: jogador.isVIP
                                    ? 'drop-shadow(0 0 8px rgba(255, 183, 0, 0.4)) drop-shadow(0 0 12px rgba(255, 183, 0, 0.2))'
                                    : 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.15))',
                                }}
                              >
                                {jogador.riotId}
                              </p>
                              {jogador.isVerified && (
                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: jogador.isVIP ? PRIMARY_COLOR : eloStyle.border }} />
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {/* Elo Badge */}
                              <div className="relative p-[1px]" style={{ clipPath: CUT_BADGE, background: eloStyle.border }}>
                                <span
                                  className={`block px-2 py-0.5 text-[10px] font-bold ${eloStyle.bg} ${eloStyle.text}`}
                                  style={{ clipPath: CUT_BADGE_INNER }}
                                >
                                  {jogador.elo}
                                </span>
                              </div>

                              {/* Ranking Badge */}
                              <div className="relative p-[1px]" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.1)' }}>
                                <span
                                  className="block px-2 py-0.5 text-[9px] text-white/50 font-bold bg-[#141419]"
                                  style={{ clipPath: CUT_BADGE_INNER }}
                                >
                                  Ranking #{index + 1}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="relative p-[1px]" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.08)' }}>
                            <div className="text-center p-2 bg-white/[0.02]" style={{ clipPath: CUT_BADGE_INNER }}>
                              <p className="text-white font-black text-sm">{jogador.partidas.toLocaleString()}</p>
                              <p className="text-[8px] text-white/40 uppercase tracking-wider">Partidas</p>
                            </div>
                          </div>
                          <div className="relative p-[1px]" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.08)' }}>
                            <div className="text-center p-2 bg-white/[0.02]" style={{ clipPath: CUT_BADGE_INNER }}>
                              <p className="font-black text-sm" style={{ color: winRateColor }}>{jogador.winRate}%</p>
                              <p className="text-[8px] text-white/40 uppercase tracking-wider">Win Rate</p>
                            </div>
                          </div>
                          <div className="relative p-[1px]" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.08)' }}>
                            <div className="text-center p-2 bg-white/[0.02]" style={{ clipPath: CUT_BADGE_INNER }}>
                              <p className="text-white font-black text-sm">{(jogador.mp ?? 0).toLocaleString()}</p>
                              <p className="text-[8px] text-white/40 uppercase tracking-wider">M7 Points</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer (Roles & Team) */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <img src={roleConfig.img} alt={roleConfig.label} className="w-4 h-4 object-contain" />
                            <span className={`text-xs font-bold ${roleConfig.color}`}>{roleConfig.label}</span>
                          </div>
                          <span className="text-white/30 text-[10px]">/</span>
                          <div className="flex items-center gap-1">
                            <img src={roleSecConfig.img} alt={roleSecConfig.label} className="w-3 h-3 object-contain opacity-60" />
                            <span className="text-[10px] text-white/40">{roleSecConfig.label}</span>
                          </div>
                        </div>
                        {jogador.timeTag && (
                          <div className="relative p-[1px]" style={{ clipPath: CUT_BADGE, background: jogador.timeColor || PRIMARY_COLOR }}>
                            <span
                              className="block px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter"
                              style={{
                                clipPath: CUT_BADGE_INNER,
                                background: `${jogador.timeColor || PRIMARY_COLOR}20`,
                                color: jogador.timeColor || PRIMARY_COLOR,
                              }}
                            >
                              #{jogador.timeTag.substring(0, 3)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Paginação */}
      <Paginacao
        currentPage={currentPage}
        totalPages={Math.ceil(totalCount / PLAYERS_PAGE)}
        onChangePage={(page) => irParaPagina(page, searchTerm, filtroElo, filtroRole, filtroSemTime, true)}
        loading={loadingPage}
      />

      {/* Empty state */}
      {!loading && jogadores.length === 0 && (
        <div
          className="relative p-[1px] w-full my-8"
          style={{ clipPath: CUT_FRAME, background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))' }}
        >
          <div
            className="p-12 text-center bg-[#08080a] flex flex-col items-center justify-center"
            style={{ clipPath: CUT_FRAME_INNER }}
          >
            <Users className="w-16 h-16 text-white/20 mb-4" />
            <p className="text-white/40 text-lg font-medium">Nenhum jogador encontrado com os filtros selecionados.</p>
            <button
              onClick={() => { setSearchTerm(''); setFiltroElo('todos'); setFiltroRole('todos'); setFiltroSemTime(false); playSound('click'); }}
              className="mt-6 relative p-[1px] cursor-pointer group"
              style={{ clipPath: CUT_BUTTON, background: PRIMARY_COLOR }}
            >
              <div
                className="px-6 py-2.5 font-bold text-black uppercase tracking-wider text-sm transition-all"
                style={{
                  clipPath: CUT_BUTTON_INNER,
                  background: PRIMARY_COLOR,
                }}
              >
                Limpar Filtros
              </div>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes vip-crown-pulse {
          0%, 100% {
            transform: translateX(-50%) translateY(0px) scale(1);
            filter: drop-shadow(0 0 8px rgba(255, 183, 0, 0.6)) drop-shadow(0 0 4px rgba(255, 213, 79, 0.4));
          }
          50% {
            transform: translateX(-50%) translateY(-4px) scale(1.1);
            filter: drop-shadow(0 0 16px rgba(255, 183, 0, 0.9)) drop-shadow(0 0 8px rgba(255, 213, 79, 0.7));
          }
        }

        @keyframes shine-sweep {
          0% {
            transform: translate(-100%, -100%) rotate(45deg);
          }
          50% {
            transform: translate(100%, 100%) rotate(45deg);
          }
          100% {
            transform: translate(100%, 100%) rotate(45deg);
          }
        }
      `}</style>
    </div>
  );
}