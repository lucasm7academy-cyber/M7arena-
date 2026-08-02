/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ VERSÃO OTIMIZADA - players.tsx
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
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { buscarElo } from '../api/riot';
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
import ElectricBorder from '../components/ui/ElectricBorder';

const IS_DEV = import.meta.env.DEV;
const PLAYERS_PAGE = 40;
const PRIMARY_COLOR = '#FFB700';

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

// ✅ Atualiza o elo_cache (tier/rank/lp/wins/losses) das contas listadas, em paralelo.
//
// Gatilho de atualização:
//   - TTL expirado (1h, acelerado de 24h pra ver wins/losses chegarem rápido); ou
//   - Não tem tier nenhum (jogador novo); ou
//   - Tem tier mas o cache antigo não tem `wins`/`losses` (campo só criado agora).
//
// `force=true` ignora TTL e atualiza tudo que tiver puuid (botão "Atualizar dados").
const TTL_MS = 60 * 60 * 1000; // 1h
async function atualizarElosNecessarios(contas: any[], force = false): Promise<number> {
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

  if (IS_DEV) console.log(`📡 atualizarElosNecessarios: ${contasParaAtualizar.length}/${contas.length} contas (force=${force})`);
  if (contasParaAtualizar.length === 0) return 0;

  let atualizadas = 0;
  await Promise.all(contasParaAtualizar.map(async (conta) => {
    try {
      const ranqueadas = await buscarElo(conta.puuid);
      const soloEntry = ranqueadas?.find((r: any) => r.queueType === 'RANKED_SOLO_5x5');
      const flexEntry = ranqueadas?.find((r: any) => r.queueType === 'RANKED_FLEX_SR');

      // Sempre grava (mesmo quando ambos null) pra registrar que já buscamos
      // — assim o TTL impede re-tentativa em loop. A escrita passa pela API
      // (POST /players/refresh-elo), que seta stats_updated_at no servidor.
      const eloCache = {
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
      };

      try {
        await api.players.refreshElo([{ userId: conta.user_id, eloCache }]);
        atualizadas++;
      } catch (err: any) {
        if (IS_DEV) console.warn('⚠️ refreshElo falhou:', conta.user_id, err?.message);
      }
    } catch (err: any) {
      if (IS_DEV) console.warn('⚠️ buscarElo falhou:', conta.user_id, err?.message);
    }
  }));

  if (IS_DEV) console.log(`✅ atualizarElosNecessarios: ${atualizadas} contas atualizadas`);
  return atualizadas;
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
  opts: { refreshElos?: boolean; forceRefresh?: boolean } = {}
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

  // ✅ Dispara refresh da Riot API em BACKGROUND (não bloqueia render).
  //    Critério: TTL expirado, sem tier, OU sem wins/losses no cache antigo.
  if (opts.refreshElos !== false && userIds.length > 0) {
    api.players.byIds(userIds)
      .then((contasFresh) => {
        if (!contasFresh) return;
        // Mescla com `rows` da RPC pra ter soloq_wins/losses + stats_updated_at
        const rowsMap = Object.fromEntries(rows.map((r: any) => [r.user_id, r]));
        const contasMerged = contasFresh.map((c: any) => ({
          ...c,
          tier:         rowsMap[c.user_id]?.tier,
          soloq_wins:   rowsMap[c.user_id]?.soloq_wins,
          soloq_losses: rowsMap[c.user_id]?.soloq_losses,
          flexq_wins:   rowsMap[c.user_id]?.flexq_wins,
          flexq_losses: rowsMap[c.user_id]?.flexq_losses,
        }));
        return atualizarElosNecessarios(contasMerged, opts.forceRefresh ?? false);
      })
      .catch((err) => { if (IS_DEV) console.warn('⚠️ players.byIds falhou:', err?.message); });
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

// ── Componente Paginação ────────────────────────────────────────────────────
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
          whileHover={{ scale: !loading && currentPage > 0 ? 1.1 : 1 }}
          whileTap={{ scale: !loading && currentPage > 0 ? 0.95 : 1 }}
          onClick={() => onChangePage(currentPage - 1)}
          disabled={currentPage === 0 || loading}
          className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center text-white/60 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-all"
        >
          ←
        </motion.button>

        {loading ? (
          <div className="w-12 h-10 flex items-center justify-center">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: PRIMARY_COLOR, borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1">
            {pages.map((page, i) =>
              page === '...' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-white/40 font-bold">
                  …
                </span>
              ) : (
                <motion.button
                  key={page}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onChangePage(page as number)}
                  className={`w-10 h-10 rounded-lg border font-bold text-sm transition-all ${
                    page === currentPage
                      ? 'bg-[#FFB700] text-black border-[#FFB700]'
                      : 'border-white/10 text-white/60 hover:bg-white/5'
                  }`}
                >
                  {(page as number) + 1}
                </motion.button>
              )
            )}
          </div>
        )}

        <motion.button
          whileHover={{ scale: !loading && currentPage < totalPages - 1 ? 1.1 : 1 }}
          whileTap={{ scale: !loading && currentPage < totalPages - 1 ? 0.95 : 1 }}
          onClick={() => onChangePage(currentPage + 1)}
          disabled={currentPage === totalPages - 1 || loading}
          className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center text-white/60 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-all"
        >
          →
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
  const [selectedPuuid, setSelectedPuuid] = useState<string | undefined>(undefined);

  const [refreshing, setRefreshing] = useState(false);
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
      { forceRefresh }
    );
    setJogadores(lista);
    setCurrentPage(page);
    setTotalCount(total);
    if (isPageNav) { setLoadingPage(false); listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else setLoading(false);
  };

  // Força atualização da Riot API agora (ignora TTL) e recarrega a página.
  const forcarAtualizacao = async () => {
    if (refreshing) return;
    setRefreshing(true);
    playSound('click');
    setPopup({ type: 'info', message: 'Atualizando dados da Riot... isso pode levar alguns segundos.' });
    try {
      // Dispara o refresh em background...
      await irParaPagina(currentPage, searchTerm, filtroElo, filtroRole, filtroSemTime, false, true);
      // ...espera 4s pra dar tempo das requisições paralelas voltarem,
      // depois recarrega pra mostrar os novos dados.
      setTimeout(async () => {
        await irParaPagina(currentPage, searchTerm, filtroElo, filtroRole, filtroSemTime);
        setRefreshing(false);
        setPopup({ type: 'success', message: 'Dados atualizados!' });
      }, 4000);
    } catch {
      setRefreshing(false);
      setPopup({ type: 'error', message: 'Falha ao atualizar. Tente novamente.' });
    }
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
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-[70] px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
              popup.type === 'error' ? 'bg-red-500/90' : popup.type === 'success' ? 'bg-green-500/90' : 'bg-blue-500/90'
            } text-white`}
          >
            {popup.type === 'error' && <X className="w-5 h-5" />}
            {popup.type === 'success' && <Check className="w-5 h-5" />}
            <span className="font-medium">{popup.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedJogador && (
          <PlayerDetailModal jogador={selectedJogador} onClose={() => { setSelectedJogador(null); setSelectedPuuid(undefined); }} />
        )}
      </AnimatePresence>

      {/* Banner */}
      <div className="space-y-0 rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a0a]/20 backdrop-blur-md mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden p-6">
          <div className="absolute inset-0 z-0">
            <img src="/images/fundoryzecortado.png" alt="Arena" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-white/0" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-white/60" />
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">Arena de Jogadores</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase tracking-tighter">
                Jogadores <span style={{ color: PRIMARY_COLOR }}>M7 </span>
              </h1>
              <p className="text-white/50 text-sm max-w-lg">Conheça os melhores invocadores da comunidade, suas estatísticas e conquistas.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/40 font-bold text-[10px] uppercase">
                <span className="text-white font-black">{totalCount}</span> Jogadores
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filtros */}
      <div className="w-full rounded-2xl border border-white/10 p-5 md:p-6 mb-12 bg-white/[0.02] backdrop-blur-md relative overflow-hidden group">
        {/* Glow de fundo sutil */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4 relative z-10">
          {/* Busca por Riot ID */}
          <div className="relative md:col-span-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Buscar por Riot ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none transition-all"
            />
          </div>

          {/* Filtro Elo */}
          <div className="relative md:col-span-3">
            <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
            <select
              value={filtroElo}
              onChange={e => setFiltroElo(e.target.value as EloType | 'todos')}
              className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary rounded-xl pl-10 pr-10 py-3 text-white/80 focus:outline-none appearance-none cursor-pointer transition-all"
            >
              <option value="todos" className="bg-[#0f0f12]">Todos os Elos</option>
              {ELOS_ORDER.map(elo => (
                <option key={elo} value={elo} className="bg-[#0f0f12]">{elo}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 pointer-events-none" />
          </div>

          {/* Filtro Role */}
          <div className="relative md:col-span-3">
            <Gamepad2 className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
            <select
              value={filtroRole}
              onChange={e => setFiltroRole(e.target.value as Role | 'todos')}
              className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary rounded-xl pl-10 pr-10 py-3 text-white/80 focus:outline-none appearance-none cursor-pointer transition-all"
            >
              <option value="todos" className="bg-[#0f0f12]">Todas as Roles</option>
              {ROLES_ORDER.map(role => (
                <option key={role} value={role} className="bg-[#0f0f12]">{ROLE_CONFIG[role].label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 pointer-events-none" />
          </div>

          {/* Sem Time */}
          <button
            onClick={() => setFiltroSemTime(v => !v)}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-sm transition-all md:col-span-2 ${
              filtroSemTime
                ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(255,183,0,0.15)]'
                : 'bg-black/40 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
            }`}
          >
            <Users className="w-4 h-4" /> Sem Time
          </button>
        </div>
      </div>

      {/* Lista de Jogadores — aparece quando pronto, sem skeleton */}
      {!loading && (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {jogadores.map((jogador, index) => {
            const roleConfig = ROLE_CONFIG[jogador.rolePrincipal];
            const roleSecConfig = ROLE_CONFIG[jogador.roleSecundaria];
            const eloStyle = ELO_STYLES[jogador.elo];
            const winRateColor = jogador.winRate >= 50 ? '#4ade80' : '#ef4444';

            const cardInner = (
              <div
                className={`relative rounded-[24px] p-5 overflow-hidden transition-all cursor-pointer w-full h-full ${
                  jogador.isVIP ? 'shadow-2xl' : ''
                }`}
                style={{ background: '#0d0d0d' }}
                onClick={() => handleVerPerfil(jogador)}>
                {jogador.isVIP && (
                  <>
                    {/* VIP Crown */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-30" style={{
                      color: PRIMARY_COLOR,
                      filter: `drop-shadow(0 0 8px rgba(255, 183, 0, 0.6))`,
                      animation: 'vip-crown-pulse 2s ease-in-out infinite'
                    }}>
                      <VipCrown />
                    </div>

                    {/* VIP Badge - Top right corner */}
                    <div className="absolute top-1 z-40" style={{ right: '12px' }}>
                      <div
                        className="px-2.5 py-1 font-black text-[10px] tracking-wider rounded"
                        style={{
                          background: `linear-gradient(135deg, ${PRIMARY_COLOR}, #ffd54f)`,
                          color: '#000',
                          whiteSpace: 'nowrap',
                          boxShadow: `0 4px 12px rgba(255, 183, 0, 0.5), 0 0 8px rgba(255, 183, 0, 0.3)`,
                          textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                        }}
                      >
                        VIP
                      </div>
                    </div>

                    {/* Shine Sweep Effect - Classic elegant shine */}
                    <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none z-20">
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

                <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full blur-[3px] opacity-40 group-hover:opacity-100 transition-opacity" style={{ background: jogador.isVIP ? PRIMARY_COLOR : eloStyle.border }} />
                      <img
                        src={getIconeUrl(jogador.iconeId)}
                        className="w-16 h-16 rounded-full border-2 relative z-10 shadow-xl"
                        style={{
                          borderColor: jogador.isVIP ? PRIMARY_COLOR : eloStyle.border,
                          borderRadius: '9999px',
                          filter: jogador.isVIP
                            ? `drop-shadow(0 0 12px rgba(255, 183, 0, 0.4)) drop-shadow(0 0 6px rgba(255, 183, 0, 0.2))`
                            : `drop-shadow(0 0 10px ${eloStyle.border}40) drop-shadow(0 0 4px ${eloStyle.border}20)`,
                        }}
                        alt={jogador.nome}
                      />
                      <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-black border-2 border-[#0a0a0a] z-20" style={{ background: PRIMARY_COLOR }}>{jogador.nivel}</div>
                    </div>
                    <div className="flex-1">
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
                              ? `drop-shadow(0 0 8px rgba(255, 183, 0, 0.4)) drop-shadow(0 0 12px rgba(255, 183, 0, 0.2))`
                              : 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.15))',
                          }}
                        >
                          {jogador.riotId}
                        </p>
                        {jogador.isVerified && <ShieldCheck className="w-3 h-3" style={{ color: jogador.isVIP ? PRIMARY_COLOR : eloStyle.border }} />}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${eloStyle.bg} ${eloStyle.text}`}>{jogador.elo}</span>
                        <span className="text-[9px] text-white/40 font-bold">Ranking #{index + 1}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 bg-white/[0.02] rounded-xl">
                      <p className="text-white font-black text-sm">{jogador.partidas.toLocaleString()}</p>
                      <p className="text-[8px] text-white/40 uppercase tracking-wider">Partidas</p>
                    </div>
                    <div className="text-center p-2 bg-white/[0.02] rounded-xl">
                      <p className="font-black text-sm" style={{ color: winRateColor }}>{jogador.winRate}%</p>
                      <p className="text-[8px] text-white/40 uppercase tracking-wider">Win Rate</p>
                    </div>
                    <div className="text-center p-2 bg-white/[0.02] rounded-xl">
                      <p className="text-white font-black text-sm">{(jogador.mp ?? 0).toLocaleString()}</p>
                      <p className="text-[8px] text-white/40 uppercase tracking-wider">M7 Points</p>
                    </div>
                  </div>

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
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter"
                        style={{ background: `${jogador.timeColor}20`, color: jogador.timeColor, border: `1px solid ${jogador.timeColor}40` }}>
                        #{jogador.timeTag.substring(0, 3)}
                      </span>
                    )}
                  </div>
                </div>
            );

            return (
              <motion.div
                key={jogador.id}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: (index % 8) * 0.05 }}
                className="group cursor-pointer"
              >
                {jogador.isVIP ? (
                  <div className="h-full p-1 rounded-[28px] cursor-pointer transition-all hover:-translate-y-1" style={{ background: PRIMARY_COLOR, filter: `drop-shadow(0 0 12px rgba(255, 183, 0, 0.3))` }}>
                    <ElectricBorder
                      color={PRIMARY_COLOR}
                      speed={1}
                      chaos={0.12}
                      borderRadius={28}
                      className="h-full rounded-[28px] w-full"
                    >
                      {cardInner}
                    </ElectricBorder>
                  </div>
                ) : (
                  <div
                    className="relative h-full p-1 rounded-[28px] cursor-pointer transition-all hover:-translate-y-1"
                    style={{ background: eloStyle.border, filter: `drop-shadow(0 0 8px rgba(${parseInt(eloStyle.border.slice(1,3), 16)}, ${parseInt(eloStyle.border.slice(3,5), 16)}, ${parseInt(eloStyle.border.slice(5,7), 16)}, 0.3))` }}
                  >
                    {cardInner}
                  </div>
                )}
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
        <div className="rounded-3xl border border-white/10 p-12 text-center bg-[#0d0d0d]">
          <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-lg">Nenhum jogador encontrado com os filtros selecionados.</p>
          <button onClick={() => { setSearchTerm(''); setFiltroElo('todos'); setFiltroRole('todos'); setFiltroSemTime(false); playSound('click'); }}
            className="mt-4 px-6 py-2 rounded-xl font-bold transition-all" style={{ background: `${PRIMARY_COLOR}20`, color: PRIMARY_COLOR, border: `1px solid ${PRIMARY_COLOR}40` }}>
            Limpar Filtros
          </button>
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