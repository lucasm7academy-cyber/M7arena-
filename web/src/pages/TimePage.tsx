import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Crown, Trophy, Wallet, Users, Send,
  ChevronRight, ShieldCheck, LogOut, Paintbrush, Settings,
  UserPlus, UserX, Check, Plus, RefreshCw, X, Search, Upload,
  Copy, Phone, MessageCircle, MessageSquare,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { buildProfileIconUrl, buscarElo, buscarJogadorCompleto } from '../api/riot';
import { useSound } from '../hooks/useSound';
import { AnimatePresence as AP } from 'motion/react';
import {
  type Role,
  ROLE_CONFIG,
  TIER_MAP,
} from '../components/players/PlayerDetailModal';

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Membro {
  userId:   string;
  riotId:   string;
  role:     Role;
  cargo:    string;
  isLeader: boolean;
  elo:      string;
  balance:  number;
  // enriquecidos após busca
  iconeId?: number;
  nivel?:   number;
  puuid?:   string;
}

interface TimeData {
  id:           string | number;
  nome:         string;
  tag:          string;
  logoUrl?:     string;
  gradientFrom: string;
  gradientTo:   string;
  pdl:          number;
  winrate:      number;
  ranking:      number;
  wins:         number;
  gamesPlayed:  number;
  donoId:       string;
  torneio?:     string;
  whatsapp?:    string;
  discord?:     string;
  membros:      Membro[];
}

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ROLE_ORDER: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP', 'RES', 'COACH'];

const ELO_COLORS: Record<string, string> = {
  Ferro: 'text-gray-500', Bronze: 'text-amber-600', Prata: 'text-gray-300',
  Ouro: 'text-yellow-400', Platina: 'text-cyan-400', Esmeralda: 'text-emerald-400',
  Diamante: 'text-blue-400', Mestre: 'text-amber-500',
  'Grão-Mestre': 'text-red-400', Desafiante: 'text-yellow-300',
};

const getEloColor = (elo: string) => ELO_COLORS[elo.split(' ')[0]] ?? 'text-white/60';

const sortPlayers = (players: any[]) =>
  [...players].sort((a, b) => {
    const oa = ROLE_ORDER.indexOf(a.role);
    const ob = ROLE_ORDER.indexOf(b.role);
    return oa !== ob ? oa - ob : (a.riotId || a.name || '').localeCompare(b.riotId || b.name || '');
  });

// ── helpers ───────────────────────────────────────────────────────────────────
function eloDisplay(elo: string): string {
  if (!elo) return 'Sem Rank';
  const tier = TIER_MAP[elo.toUpperCase()] ?? elo;
  return tier;
}

// ── ModalBase ──────────────────────────────────────────────────────────────
const ModalBase = ({ onClose, children, gradientFrom, title, transparent = false }: {
  onClose: () => void;
  children: React.ReactNode;
  gradientFrom?: string;
  title?: string;
  transparent?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className={`fixed inset-0 z-[999] flex items-start justify-center pt-24 p-4 overflow-y-auto ${!transparent ? 'bg-black/80 backdrop-blur-sm' : ''}`}
    onClick={onClose}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 20 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="relative w-full max-w-md rounded-2xl overflow-y-auto max-h-[85vh]"
      style={gradientFrom ? {
        border: `3px solid ${gradientFrom}`,
        boxShadow: `0 0 45px -10px ${gradientFrom}60`,
        backdropFilter: 'blur(16px)'
      } : {
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(16px)'
      }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      {title && (
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h2 className="text-white font-black text-lg tracking-tight uppercase">{title}</h2>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {/* ✅ TROQUE p-6 por p-0 ou remova completamente */}
      <div className="p-0">{children}</div>
    </motion.div>
  </motion.div>
);

// ── Upload de logo para o disco local (ADR-007) ─────────────────────────────
async function uploadLogoTime(file: File, timeId: string): Promise<string | null> {
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const name = `${timeId}-${Date.now()}.${ext}`;
  const renamed = new File([file], name, { type: file.type });

  try {
    const { url } = await api.upload(renamed, 'team-logos');
    return `${url}?t=${Date.now()}`;
  } catch (err) {
    console.error('❌ Erro upload logo time:', err);
    return null;
  }
}

function validarImagem(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('O arquivo deve ser uma imagem.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      resolve('A imagem deve ter no máximo 2MB.');
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    const finish = (msg: string | null) => {
      URL.revokeObjectURL(objectUrl);
      resolve(msg);
    };
    img.onload = () => {
      finish(img.width > 1080 || img.height > 1080
        ? 'A imagem deve ter no máximo 1080x1080px.'
        : null);
    };
    // Sem onerror a Promise nunca resolve se a imagem falhar ao carregar
    // (arquivo corrompido, bloqueio de CSP), e o modal trava para sempre.
    img.onerror = () => finish('Não foi possível ler a imagem. Tente outro arquivo.');
    img.src = objectUrl;
  });
}

const COLOR_THEMES = [
  { from: '#FFB700', to: '#FF6600', label: 'Amarelo/Laranja' },
  { from: '#0044FF', to: '#00D4FF', label: 'Azul Escuro' },
  { from: '#FF3300', to: '#FF9900', label: 'Vermelho' },
  { from: '#00FF88', to: '#00C3FF', label: 'Verde Claro' },
  { from: '#7B00FF', to: '#00AAFF', label: 'Roxo' },
  { from: '#FF006E', to: '#FF9966', label: 'Rosa' },
  { from: '#00FF41', to: '#008F11', label: 'Verde' },
  { from: '#F953C6', to: '#B91D73', label: 'Pink' },
  { from: '#1CB5E0', to: '#000851', label: 'Azul Claro' },
  { from: '#FF416C', to: '#FF4B2B', label: 'Vermelho Vivo' },
  { from: '#11998e', to: '#38ef7d', label: 'Menta' },
  { from: '#00D9FF', to: '#0099CC', label: 'Turquesa' },
];

// ── Modais ──────────────────────────────────────────────────────────────────
const MODAL_ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP', 'R1', 'R2', 'COACH'] as const;
type ModalRole = typeof MODAL_ROLES[number];

const MODAL_ROLE_CONFIG: Record<ModalRole, { label: string; img: string; color: string; bg: string }> = {
  TOP: { label: 'TOP', img: '/lanes_brancas/Top_iconB.png', color: 'text-red-400', bg: 'bg-red-400/10' },
  JG: { label: 'JG', img: '/lanes_brancas/Jungle_iconB.png', color: 'text-green-400', bg: 'bg-green-400/10' },
  MID: { label: 'MID', img: '/lanes_brancas/Middle_iconB.png', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  ADC: { label: 'ADC', img: '/lanes_brancas/Bottom_iconB.png', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  SUP: { label: 'SUP', img: '/lanes_brancas/Support_iconB.png', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  R1: { label: 'R1', img: '/lanes_brancas/icon-position-fillB.png', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  R2: { label: 'R2', img: '/lanes_brancas/icon-position-fillB.png', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  COACH: { label: 'COACH', img: '/lanes_brancas/coach_iconB.svg', color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

const InvitePlayerModal = ({
  team,
  onClose,
  onAddPlayer,
}: {
  team: TimeData;
  onClose: () => void;
  onAddPlayer: (players: Membro[]) => Promise<boolean>;
}) => {
  const { playSound } = useSound();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [pendingPlayers, setPendingPlayers] = useState<any[]>([]);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); setNotFound(false); return; }
    setSearching(true); setNotFound(false);
    const timer = setTimeout(async () => {
      // Buscar localmente nas contas Riot via API própria (jogadores cadastrados)
      let data: any[] = [];
      try {
        data = await api.players.search(query);
      } catch (err) {
        console.error('❌ Erro ao buscar jogadores:', err);
      }

      if (data && data.length > 0) {
        setSearchResults(data.map(p => ({ ...p, is_guest: false })));
        setSearching(false);
        setNotFound(false);
      } else {
        // Se não achou local e tem hashtag, tenta API da Riot
        if (query.includes('#')) {
          try {
            const res = await buscarJogadorCompleto(query.trim());
            setSearching(false);
            if (res.success && res.data) {
              setSearchResults([{
                user_id: null,
                riot_id: res.data.riotId,
                profile_icon_id: res.data.iconeId,
                level: res.data.nivel,
                puuid: res.data.puuid,
                eloData: res.data.ranqueadas,
                is_guest: true
              }]);
              setNotFound(false);
            } else {
              setSearchResults([]);
              setNotFound(true);
            }
          } catch {
            setSearching(false);
            setSearchResults([]);
            setNotFound(true);
          }
        } else {
          setSearching(false);
          setSearchResults([]);
          setNotFound(true);
        }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectSearchResult = (p: any) => {
    playSound('click');
    const alreadyPending = pendingPlayers.some(item => item.riot_id === p.riot_id);
    if (alreadyPending) {
      setError('Jogador já está na lista de adições pendentes.');
      return;
    }

    const existingMember = team.membros.find(m => m.riotId === p.riot_id);
    let initialRole: ModalRole = 'R1';
    if (existingMember) {
      if (existingMember.role === 'RES') {
        const reserves = team.membros.filter(m => m.role === 'RES');
        const resIndex = reserves.findIndex(m => m.riotId === p.riot_id);
        initialRole = resIndex === 1 ? 'R2' : 'R1';
      } else {
        initialRole = existingMember.role as ModalRole;
      }
    }

    setPendingPlayers(prev => [...prev, {
      ...p,
      selectedRole: initialRole,
      isExisting: !!existingMember
    }]);

    setQuery('');
    setSearchResults([]);
    setError(null);
  };

  const handleRemovePending = (riotId: string) => {
    playSound('click');
    setPendingPlayers(prev => prev.filter(p => p.riot_id !== riotId));
    setError(null);
  };

  const handleRoleChange = (riotId: string, role: ModalRole) => {
    playSound('click');
    setPendingPlayers(prev => prev.map(p => {
      if (p.riot_id === riotId) {
        return { ...p, selectedRole: role };
      }
      return p;
    }));
    setError(null);
  };

  const handleAddDirectly = async () => {
    if (pendingPlayers.length === 0) return;
    setError(null);

    let finalMembers = [...team.membros];

    for (const pending of pendingPlayers) {
      const selectedRole = pending.selectedRole;
      const dbRole = (selectedRole === 'R1' || selectedRole === 'R2') ? 'RES' : selectedRole;

      let eloStr = '';
      if (pending.is_guest) {
        if (pending.eloData) {
          const soloRank = pending.eloData.find((e: any) => e.queueType === 'RANKED_SOLO_5x5');
          if (soloRank) eloStr = `${soloRank.tier} ${soloRank.rank ?? ''}`.trim();
        } else if (pending.elo_cache) {
          eloStr = pending.elo_cache;
        }
      } else {
        const solo = pending.elo_cache?.soloQ;
        if (solo?.tier) eloStr = `${solo.tier} ${solo.rank ?? ''}`.trim();
      }

      const existingIndex = finalMembers.findIndex(m => m.riotId === pending.riot_id);

      if (existingIndex !== -1) {
        finalMembers[existingIndex] = {
          ...finalMembers[existingIndex],
          role: dbRole,
          cargo: dbRole === 'COACH' ? 'coach' : 'jogador',
        };
      } else {
        const newMember: Membro = {
          userId:   pending.user_id,
          riotId:   pending.riot_id,
          role:     dbRole,
          cargo:    dbRole === 'COACH' ? 'coach' : 'jogador',
          isLeader: false,
          elo:      eloStr || 'UNRANKED',
          balance:  0,
          iconeId:  pending.profile_icon_id ?? 1,
          puuid:    pending.puuid ?? undefined,
        };
        finalMembers.push(newMember);
      }
    }

    const activePlayers = finalMembers.filter(m => m.role !== 'COACH');
    if (activePlayers.length > 8) {
      setError('O time não pode ter mais de 8 jogadores (incluindo titulares e reservas).');
      return;
    }

    const roleCounts: Record<Role, number> = {
      TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0, RES: 0, COACH: 0
    };
    for (const m of finalMembers) {
      roleCounts[m.role]++;
    }

    if (roleCounts.TOP > 1) { setError('Apenas 1 jogador pode ocupar a rota TOP.'); return; }
    if (roleCounts.JG > 1) { setError('Apenas 1 jogador pode ocupar a rota JG.'); return; }
    if (roleCounts.MID > 1) { setError('Apenas 1 jogador pode ocupar a rota MID.'); return; }
    if (roleCounts.ADC > 1) { setError('Apenas 1 jogador pode ocupar a rota ADC.'); return; }
    if (roleCounts.SUP > 1) { setError('Apenas 1 jogador pode ocupar a rota SUP.'); return; }
    if (roleCounts.RES > 3) { setError('Máximo de 3 reservas atingido.'); return; }
    if (roleCounts.COACH > 1) { setError('Apenas 1 coach é permitido.'); return; }

    setSending(true);

    const ok = await onAddPlayer(finalMembers);
    setSending(false);
    if (!ok) {
      setError('Erro ao salvar no banco de dados. Verifique a conexão.');
      return;
    }

    playSound('success');
    setSent(true);
    setTimeout(onClose, 1500);
  };

  const handleAddManualGuest = () => {
    playSound('click');
    const guestPlayer = {
      user_id: null,
      riot_id: query.trim(),
      profile_icon_id: 1,
      level: 1,
      is_guest: true,
      elo_cache: 'UNRANKED',
      is_manual: true
    };
    
    const alreadyPending = pendingPlayers.some(item => item.riot_id === guestPlayer.riot_id);
    if (alreadyPending) {
      setError('Jogador já está na lista de adições pendentes.');
      return;
    }

    const existingMember = team.membros.find(m => m.riotId === guestPlayer.riot_id);
    let initialRole: ModalRole = 'R1';
    if (existingMember) {
      if (existingMember.role === 'RES') {
        const reserves = team.membros.filter(m => m.role === 'RES');
        const resIndex = reserves.findIndex(m => m.riotId === guestPlayer.riot_id);
        initialRole = resIndex === 1 ? 'R2' : 'R1';
      } else {
        initialRole = existingMember.role as ModalRole;
      }
    }

    setPendingPlayers(prev => [...prev, {
      ...guestPlayer,
      selectedRole: initialRole,
      isExisting: !!existingMember
    }]);

    setQuery('');
    setError(null);
  };

  return (
    <ModalBase onClose={onClose}>
      <div className="rounded-2xl overflow-hidden relative max-w-2xl w-full mx-auto animate-scaleUp" style={{
        border: `3px solid ${team.gradientFrom}`,
        boxShadow: `0 0 35px -10px ${team.gradientFrom}70`,
        backdropFilter: 'blur(16px)',
        background: 'rgba(10, 10, 12, 0.92)'
      }}>
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[60px] opacity-15 pointer-events-none" style={{ background: team.gradientFrom }} />
        <div className="relative z-10">
          <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between" style={{ background: `${team.gradientFrom}08` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${team.gradientFrom}25` }}>
                <UserPlus className="w-4 h-4" style={{ color: team.gradientFrom }} />
              </div>
              <h2 className="text-white font-black text-lg">Adicionar Jogadores</h2>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-6">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0"><X className="w-4 h-4 text-red-400" /></div>
                <p className="text-red-400 text-xs font-medium">{error}</p>
              </motion.div>
            )}
            
            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold">1. Buscar Player</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input value={query} onChange={e => { setQuery(e.target.value); setError(null); }}
                  placeholder="Riot ID (ex: Kami#BR1)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/30" />
                {searching && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 animate-spin" />}
              </div>
              
              {query.length >= 2 && !searching && (
                <div className="mt-2">
                  {notFound ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center space-y-2">
                      <p className="text-white/40 text-xs font-medium">Jogador não encontrado na Riot</p>
                      {query.includes('#') && (
                        <button onClick={handleAddManualGuest} className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-lg transition-colors border border-white/5">
                          Adicionar como Convidado Manual
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {searchResults.map((p, idx) => {
                        const iconUrl = p.profile_icon_id ? buildProfileIconUrl(p.profile_icon_id) : null;
                        return (
                          <button key={p.user_id || idx} onClick={() => handleSelectSearchResult(p)}
                            className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl p-3 border border-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
                                {iconUrl ? <img src={iconUrl} alt="" className="w-full h-full object-cover" loading="lazy" width={32} height={32} /> : <span className="text-white/60 text-xs font-bold">{p.riot_id.charAt(0).toUpperCase()}</span>}
                              </div>
                              <div className="text-left">
                                <p className="text-white text-sm font-medium">{p.riot_id}</p>
                                <p className="text-[10px] text-white/40">
                                  {p.is_guest ? 'Riot API (Convidado)' : p.level ? `Nível ${p.level} (Cadastrado)` : 'Cadastrado'}
                                </p>
                              </div>
                            </div>
                            <Plus className="w-4 h-4 text-white/20" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {pendingPlayers.length > 0 && (
              <div className="space-y-3">
                <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold flex justify-between items-center">
                  <span>2. Jogadores Pendentes ({pendingPlayers.length})</span>
                  <button onClick={() => setPendingPlayers([])} className="text-red-400 hover:text-red-300 text-[10px] font-bold lowercase">Limpar todos</button>
                </label>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {pendingPlayers.map((p, idx) => {
                    const iconUrl = p.profile_icon_id ? buildProfileIconUrl(p.profile_icon_id) : null;
                    return (
                      <div key={p.riot_id || idx} className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                              {iconUrl ? <img src={iconUrl} alt="" className="w-full h-full object-cover" width={36} height={36} /> : <span className="text-white/60 text-xs font-bold">{p.riot_id.charAt(0).toUpperCase()}</span>}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-white text-sm font-bold leading-none">{p.riot_id}</p>
                                {p.isExisting && (
                                  <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                    Já no time
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-white/40 mt-1.5">
                                {p.is_manual ? 'Convidado Manual' : p.is_guest ? 'Convidado (Riot API)' : `Cadastrado (Nível ${p.level})`}
                              </p>
                            </div>
                          </div>
                          <button onClick={() => handleRemovePending(p.riot_id)} className="text-white/30 hover:text-red-400 p-1.5 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider">Definir Posição:</p>
                          <div className="grid grid-cols-4 gap-2">
                            {MODAL_ROLES.map(role => {
                              const cfg = MODAL_ROLE_CONFIG[role];
                              const isSelected = p.selectedRole === role;
                              return (
                                <button key={role} onClick={() => handleRoleChange(p.riot_id, role)}
                                  title={cfg.label}
                                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${isSelected ? 'bg-white/10 border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                  <img src={cfg.img} alt={cfg.label} className={`w-5 h-5 object-contain ${isSelected ? 'opacity-100' : 'opacity-30'}`} />
                                  <span className="text-[10px] font-bold mt-1.5" style={{ color: isSelected ? 'white' : 'rgba(255,255,255,0.3)' }}>{cfg.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm font-bold hover:bg-white/10 transition-all">Cancelar</button>
              <button onClick={handleAddDirectly} disabled={pendingPlayers.length === 0 || sent || sending}
                className="flex-[1.5] py-3 rounded-xl text-sm font-black transition-all disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
                style={{ background: team.gradientFrom, color: 'white' }}>
                {sending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</> : sent ? <><Check className="w-4 h-4" /> Salvo com sucesso!</> : <><Check className="w-4 h-4" /> Salvar Alterações</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalBase>
  );
};

const RequestEntryModal = ({ team, onClose }: { team: TimeData; onClose: () => void }) => {
  const { playSound } = useSound();
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myRiotAccount, setMyRiotAccount] = useState<any>(null);

  useEffect(() => {
    const fetchMyAccount = async () => {
      if (!user) return;
      try {
        const data = await api.profiles.getRiot();
        setMyRiotAccount(data);
      } catch (err) {
        console.error('❌ Erro ao buscar conta Riot:', err);
      }
    };
    fetchMyAccount();
  }, [user]);

  const handleRequest = async () => {
    if (!selectedRole) return;
    if (!myRiotAccount) {
      setError('Você precisa vincular uma conta Riot primeiro.');
      return;
    }
    
    setSending(true);
    if (!user) { setSending(false); return; }

    try {
      await api.teams.createInvite({
        time_id: String(team.id),
        para_user_id: team.donoId,
        riot_id: myRiotAccount.riot_id,
        role: selectedRole,
        mensagem: message || null,
        tipo: 'solicitacao',
      });
    } catch {
      setSending(false);
      setError('Erro ao enviar solicitação. Tente novamente.');
      return;
    }

    setSending(false);
    playSound('success');
    setSent(true);
    setTimeout(onClose, 1800);
  };

  return (
    <ModalBase onClose={onClose}>
      <div className="rounded-2xl overflow-hidden relative" style={{
        border: `3px solid ${team.gradientFrom}`,
        boxShadow: `0 0 35px -10px ${team.gradientFrom}70`,
        backdropFilter: 'blur(16px)'
      }}>
        <div className="relative z-10">
          <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between" style={{ background: `${team.gradientFrom}08` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${team.gradientFrom}25` }}>
                <Send className="w-4 h-4" style={{ color: team.gradientFrom }} />
              </div>
              <h2 className="text-white font-black text-lg">Solicitar Entrada</h2>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-6">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0"><X className="w-4 h-4 text-red-400" /></div>
                <p className="text-red-400 text-xs font-medium">{error}</p>
              </motion.div>
            )}
            
            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold">1. Selecionar Rota Desejada</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(ROLE_CONFIG) as Role[]).map(role => {
                  const cfg = ROLE_CONFIG[role]; const isSelected = selectedRole === role;
                  return (
                    <button key={role} onClick={() => { playSound('click'); setSelectedRole(role); setError(null); }}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${isSelected ? 'bg-white/10 border-white/40' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                      <img src={cfg.img} alt={cfg.label} className={`w-4 h-4 object-contain ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-white/40'}`}>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold">2. Mensagem (Opcional)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Conte por que você quer entrar no time..." rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm font-bold hover:bg-white/10 transition-all">Cancelar</button>
              <button onClick={handleRequest} disabled={!selectedRole || sent || sending}
                className="flex-[1.5] py-3 rounded-xl text-sm font-black transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                style={{ background: team.gradientFrom, color: 'white' }}>
                {sending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Enviando...</> : sent ? <><Check className="w-4 h-4" /> Enviado!</> : <><Send className="w-4 h-4" /> Enviar Solicitação</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalBase>
  );
};

const EditTeamModal = ({
  team, onClose, onSave,
}: {
  team: TimeData;
  onClose: () => void;
  onSave: (updated: Partial<TimeData>) => void;
}) => {
  const { playSound } = useSound();
  const [name, setName] = useState(team.nome);
  const [tag, setTag] = useState(team.tag);
  const [theme, setTheme] = useState({ from: team.gradientFrom, to: team.gradientTo });
  // Guarda contra blob corrompido que possa ter sido salvo no banco antes da correção
  const safeInitialLogo = (team.logoUrl && !String(team.logoUrl).startsWith('blob:')) ? team.logoUrl : '';
  const [logoPreview, setLogoPreview] = useState(safeInitialLogo); // só para exibição
  const [logoUrl, setLogoUrl] = useState(safeInitialLogo);          // URL persistível — NUNCA um blob
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [whatsapp, setWhatsapp] = useState(team.whatsapp || '');
  const [discord, setDiscord] = useState(team.discord || '');
  const [copiedField, setCopiedField] = useState<'whatsapp' | 'discord' | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError('');
    const err = await validarImagem(file);
    if (err) { setLogoError(err); return; }
    setLogoUploading(true);
    const blobPreview = URL.createObjectURL(file);
    setLogoPreview(blobPreview); // preview instantâneo enquanto sobe
    const url = await uploadLogoTime(file, String(team.id));
    setLogoUploading(false);
    URL.revokeObjectURL(blobPreview); // libera o blob temporário
    if (url) {
      playSound('click');
      setLogoPreview(url); // troca a prévia pela URL real do Supabase
      setLogoUrl(url);     // ESTA é a que será salva no banco
    } else {
      setLogoError('Falha no upload. Tente novamente.');
      setLogoPreview(logoUrl); // reverte para a última URL válida (nunca deixa blob)
    }
  };

  const handleCopyField = (text: string, field: 'whatsapp' | 'discord') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    playSound('success');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const cleanPhone = (phone: string) => phone.replace(/\D/g, '');

  const handleSave = () => {
    if (logoUploading) return;
    playSound('success');
    onSave({
      nome: name,
      tag: tag.toUpperCase().slice(0, 3),
      gradientFrom: theme.from,
      gradientTo: theme.to,
      logoUrl: (logoUrl && !logoUrl.startsWith('blob:')) ? logoUrl : undefined,
      whatsapp: whatsapp ? cleanPhone(whatsapp) : undefined,
      discord: discord || undefined,
    });
    onClose();
  };

  return (
    <ModalBase onClose={onClose}>
      <div
        className="rounded-2xl overflow-hidden relative py-[5px]"
        style={{
          border: `3px solid ${theme.from}`,
          boxShadow: `0 0 35px -10px ${theme.from}70`,
          backdropFilter: 'blur(16px)'
        }}
      >
        <div className="relative z-10">
          <div
            className="px-6 py-4 border-b border-white/8 flex items-center justify-between"
            style={{ background: `${theme.from}08` }}
          >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${theme.from}25` }}>
              <Paintbrush className="w-4 h-4" style={{ color: theme.from }} />
            </div>
            <h2 className="text-white font-black text-lg">Editar Time</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-white/40 text-xs uppercase tracking-widest">Nome do Time</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={24}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-white/40 text-xs uppercase tracking-widest">Tag (3 letras)</label>
            <input
              value={tag}
              onChange={e => setTag(e.target.value.toUpperCase().slice(0, 3))}
              maxLength={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold tracking-widest focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-white/40 text-xs uppercase tracking-widest">Logo do Time</label>
            <div className="flex items-center gap-3">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center relative overflow-hidden bg-white/5 shrink-0"
                style={{
                  border: '2px solid transparent',
                  background: `linear-gradient(rgba(13, 13, 13, 0.6), rgba(13, 13, 13, 0.6)) padding-box, linear-gradient(135deg, ${theme.from}, ${theme.to}) border-box`,
                  boxShadow: `0 0 12px -4px ${theme.from}80`,
                  backdropFilter: 'blur(8px)'
                }}
              >
                <div 
                  className="absolute inset-0 opacity-15 blur-lg pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${theme.from}, transparent)` }}
                />
                
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover relative z-10" />
                ) : (
                  <Upload className="w-6 h-6 text-white/30 relative z-10" />
                )}
              </div>
              
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <div
                  className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed transition-all cursor-pointer"
                  style={{
                    borderColor: `${theme.from}50`,
                    background: `${theme.from}10`,
                    color: theme.from,
                  }}
                >
                  {logoUploading
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <Upload className="w-4 h-4" />}
                  <span className="text-sm font-medium">{logoUploading ? 'Enviando...' : 'Enviar Logo'}</span>
                </div>
              </label>
            </div>
            <p className="text-white/20 text-[10px]">PNG ou JPEG · máx. 1080×1080px</p>
            {logoError && <p className="text-red-400 text-[11px] font-medium">{logoError}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-white/40 text-xs uppercase tracking-widest">WhatsApp</label>
            <div className="flex items-center gap-2">
              <input
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
                maxLength={20}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30"
              />
              {whatsapp && (
                <button
                  onClick={() => handleCopyField(whatsapp, 'whatsapp')}
                  className={`p-2.5 rounded-lg transition-all ${
                    copiedField === 'whatsapp'
                      ? 'bg-green-500/30 text-green-400'
                      : 'bg-white/5 hover:bg-white/10 text-white/50'
                  }`}
                  title="Copiar WhatsApp"
                >
                  {copiedField === 'whatsapp' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-white/40 text-xs uppercase tracking-widest flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Discord
            </label>
            <div className="flex items-center gap-2">
              <input
                value={discord}
                onChange={e => setDiscord(e.target.value)}
                placeholder="usuario#0000"
                maxLength={37}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30"
              />
              {discord && (
                <button
                  onClick={() => handleCopyField(discord, 'discord')}
                  className={`p-2.5 rounded-lg transition-all ${
                    copiedField === 'discord'
                      ? 'bg-blue-500/30 text-blue-400'
                      : 'bg-white/5 hover:bg-white/10 text-white/50'
                  }`}
                  title="Copiar Discord"
                >
                  {copiedField === 'discord' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-white/40 text-xs uppercase tracking-widest">Cor</label>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_THEMES.map(t => (
                <button
                  key={t.label}
                  onClick={() => setTheme({ from: t.from, to: t.to })}
                  className="relative h-10 rounded-xl overflow-hidden border-2 transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                    borderColor: theme.from === t.from ? 'white' : 'transparent',
                  }}
                  title={t.label}
                >
                  {theme.from === t.from && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl text-sm font-black transition-all"
              style={{ background: theme.from, color: 'white' }}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalBase>
  );
};

const ManageLineupModal = ({
  team, onClose, onUpdateTeam,
}: {
  team: TimeData;
  onClose: () => void;
  onUpdateTeam: (players: Membro[]) => Promise<boolean> | void;
}) => {
  const { playSound } = useSound();
  const [membros, setMembros] = useState<Membro[]>(sortPlayers(team.membros));
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePromote = (idKey: string) => {
    playSound('click');
    setMembros(m => m.map(mb => ({ ...mb, isLeader: (mb.userId || mb.riotId) === idKey })));
  };

  const handleRemove = (idKey: string) => {
    playSound('click');
    setMembros(m => m.filter(mb => (mb.userId || mb.riotId) !== idKey));
    setConfirmRemove(null);
  };

  const handleRoleChange = (idKey: string, newRole: Role) => {
    playSound('click');
    setError(null);
    if (newRole !== 'RES') {
      // Rotas principais (TOP/JG/MID/ADC/SUP) só podem ter 1 jogador
      const ocupada = membros.some(mb => (mb.userId || mb.riotId) !== idKey && mb.role === newRole);
      if (ocupada) {
        setError(`A rota ${ROLE_CONFIG[newRole].label} já está ocupada. Mova o jogador atual para a reserva antes.`);
        return;
      }
    } else {
      // Máximo de 3 reservas
      const reservas = membros.filter(mb => (mb.userId || mb.riotId) !== idKey && mb.role === 'RES').length;
      if (reservas >= 3) {
        setError('Máximo de 3 reservas atingido.');
        return;
      }
    }
    setMembros(m => sortPlayers(m.map(mb => (mb.userId || mb.riotId) === idKey ? { ...mb, role: newRole } : mb)));
  };

  const [salvando, setSalvando] = useState(false);

  const handleSave = async () => {
    setError(null);
    const roles = membros.map(m => m.role).filter(r => r !== 'RES');
    const hasDuplicates = new Set(roles).size !== roles.length;
    if (hasDuplicates) {
      setError('Posições duplicadas');
      playSound('click');
      return;
    }
    const reserves = membros.filter(m => m.role === 'RES');
    if (reserves.length > 3) {
      setError('Máximo de 3 reservas');
      playSound('click');
      return;
    }
    setSalvando(true);
    const ok = await onUpdateTeam(membros);
    setSalvando(false);
    if (ok === false) {
      setError('Não foi possível salvar o lineup. Tente novamente.');
      playSound('click');
      return;
    }
    playSound('success');
    onClose();
  };

  return (
    <ModalBase onClose={onClose}>
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{ 
          border: '3px solid transparent',
          backgroundImage: `linear-gradient(rgba(13, 13, 13, 0.6), rgba(13, 13, 13, 0.6)) padding-box, linear-gradient(135deg, ${team.gradientFrom}, ${team.gradientTo || team.gradientFrom}) border-box`,
          boxShadow: `0 0 35px -10px ${team.gradientFrom}70`,
          backdropFilter: 'blur(16px)'
        }}
      >
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[60px] opacity-15 pointer-events-none" style={{ background: team.gradientFrom }} />
        <div className="relative z-10">
          <div
            className="px-6 py-4 border-b border-white/8 flex items-center justify-between"
            style={{ background: `${team.gradientFrom}08` }}
          >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${team.gradientFrom}25` }}>
              <Users className="w-4 h-4" style={{ color: team.gradientFrom }} />
            </div>
            <h2 className="text-white font-black text-lg">Gerenciar Lineup</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0"><X className="w-4 h-4 text-red-400" /></div>
              <p className="text-red-400 text-xs font-medium">{error}</p>
            </motion.div>
          )}
          {membros.map(m => {
            const cfg = ROLE_CONFIG[m.role];
            const mId = m.userId || m.riotId;
            return (
              <div key={mId} className="flex items-center gap-3 bg-[rgba(13,13,13,0.6)] rounded-xl p-3 border border-white/10 hover:border-white/20 transition-all">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <img src={cfg.img} alt={cfg.label} className="w-5 h-5 object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm truncate">{m.riotId.split('#')[0]}</p>
                    {m.isLeader && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border flex-shrink-0"
                        style={{ color: team.gradientFrom, borderColor: `${team.gradientFrom}50`, background: `${team.gradientFrom}18` }}>
                        CAP
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${getEloColor(m.elo)} mt-1`}>{eloDisplay(m.elo)}</p>
                </div>
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(mId, e.target.value as Role)}
                  className="bg-black/40 text-white/70 text-sm font-bold px-3 py-2 rounded border border-white/20 focus:outline-none focus:border-white/40 cursor-pointer shrink-0"
                >
                  {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
                    <option key={r} value={r} className="bg-[#0d0d0d]/90">{ROLE_CONFIG[r].label}</option>
                  ))}
                </select>
                <div className="w-[88px] flex items-center gap-1.5 justify-end">
                  {confirmRemove === mId ? (
                    <>
                      <span className="text-white/40 text-xs">Confirmar?</span>
                      <button onClick={() => handleRemove(mId)} className="px-2 py-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30">Sim</button>
                      <button onClick={() => setConfirmRemove(null)} className="px-2 py-1 bg-white/5 text-white/40 rounded-lg text-xs hover:bg-white/10">Não</button>
                    </>
                  ) : (
                    <>
                      {!m.isLeader && (
                        <>
                          {m.userId && (
                            <button onClick={() => handlePromote(mId)} className="p-1.5 rounded-lg bg-white/5 hover:bg-yellow-400/20 text-white/30 hover:text-yellow-400 transition-all" title="Promover a Capitão"><Crown className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => setConfirmRemove(mId)} className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all" title="Expulsar"><UserX className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <button onClick={handleSave} disabled={salvando} className="w-full mt-2 py-3 rounded-xl font-black text-white text-sm transition-all flex items-center justify-center gap-2" style={{ background: team.gradientFrom }}>
            {salvando ? <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar Lineup'}
          </button>
        </div>
      </div>
    </div>
  </ModalBase>
);
};

const ConfirmLeaveModal = ({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) => {
  const { playSound } = useSound();
  return (
    <ModalBase onClose={onClose} title="Sair da Equipe">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto border border-red-500/20">
          <LogOut className="w-10 h-10 text-red-500" />
        </div>
        <div>
          <p className="text-white font-black text-xl">Tem certeza?</p>
          <p className="text-white/40 text-sm mt-2">Você perderá acesso ao chat e lineup da equipe.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm font-bold hover:bg-white/10 transition-all">Cancelar</button>
          <button onClick={() => { playSound('click'); onConfirm(); }} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-black hover:bg-red-600 transition-all">Sair do Time</button>
        </div>
      </div>
    </ModalBase>
  );
};

// ── componente ────────────────────────────────────────────────────────────────
export default function TimePage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { playSound } = useSound();
  const { user } = useAuth();

  const [time,    setTime]    = useState<TimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'leader' | 'member' | 'visitor'>('visitor');


  const [modalConvidar, setModalConvidar] = useState(false);
  const [modalSolicitar, setModalSolicitar] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalLineup, setModalLineup] = useState(false);
  const [modalSair, setModalSair] = useState(false);
  const [notCapSidebar, setNotCapSidebar] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ✅ Cache: evita requisições desnecessárias quando volta pra aba
  const lastLoadedIdRef = useRef<string | null>(null);

  // ── carregar ────────────────────────────────────────────────────────────────
  const load = async () => {
    if (!id) return;

    // ✅ Se já carregou esse time, não recarrega (evita requisições em Alt+Tab)
    if (lastLoadedIdRef.current === id) return;
    lastLoadedIdRef.current = id;

    const uid = user?.id ?? null;
    setCurrentUserId(uid);

    // ✅ Schema novo: time_membros enxuto (tipo, lane, is_capitao).
    // Dados pesados (riot_id, elo, balance, ícone) vêm via JOIN com contas_riot + wallets.
    // A API devolve o mesmo shape que o Supabase entregava (times + time_membros).
    let t: any;
    try {
      t = await api.teams.detail(id);
    } catch {
      setLoading(false);
      return;
    }

    if (!t) { setLoading(false); return; }

    const membrosRaw: Membro[] = ((t.time_membros ?? []) as any[])
      .filter((m: any) => m.status !== 'saiu')
      .map((m: any) => ({
        userId:   m.user_id,
        riotId:   m.guest_riot_id || 'Jogador',
        role:     (m.lane || 'TOP') as Role,
        cargo:    m.tipo || 'jogador',
        isLeader: !!m.is_capitao,
        elo:      m.guest_elo_cache || '',
        balance:  0,
        iconeId:  m.guest_profile_icon_id ?? 1,
        puuid:    m.guest_puuid ?? undefined,
      }));

    // Buscar dados Riot + wallet de todos os membros em paralelo
    const userIds = membrosRaw.map(m => m.userId).filter(Boolean);
    if (userIds.length > 0) {
      const [contas, wallets] = await Promise.all([
        api.players.byIds(userIds),
        api.wallet.adminBalances(userIds),
      ]);

      const contaMap: Record<string, any> = {};
      (contas ?? []).forEach((c: any) => { contaMap[c.user_id] = c; });
      const walletMap: Record<string, number> = {};
      (wallets ?? []).forEach((w: any) => { walletMap[w.userId] = w.mc; });

      membrosRaw.forEach(m => {
        if (m.userId) {
          const c = contaMap[m.userId];
          if (c) {
            m.riotId  = c.riot_id ?? 'Jogador';
            m.iconeId = c.profile_icon_id ?? 1;
            m.nivel   = c.level ?? 1;
            m.puuid   = c.puuid ?? undefined;
            const solo = c.elo_cache?.soloQ;
            if (solo?.tier) m.elo = `${solo.tier} ${solo.rank ?? ''}`.trim();
          }
          m.balance = walletMap[m.userId] ?? 0;
        }
      });
    }

    let role: 'leader' | 'member' | 'visitor' = 'visitor';
    if (uid) {
      // Líder = capitão (is_capitao) OU dono do time (dono_id).
      // O dono NUNCA perde acesso de edição, mesmo se não estiver como capitão
      // (ex: se colocou a si mesmo como reserva).
      const membro = membrosRaw.find(m => m.userId === uid);
      const isDono = t.dono_id === uid;
      if (membro?.isLeader || isDono) {
        role = 'leader';
      } else if (membro) {
        role = 'member';
      }
    }
    setUserRole(role);

    setTime({
      id:           t.id,
      nome:         t.nome,
      tag:          t.tag,
      logoUrl:      t.logo_url ?? undefined,
      gradientFrom: t.gradient_from || '#FFB700',
      gradientTo:   t.gradient_to   || '#FF6600',
      pdl:          t.pdl           || 0,
      winrate:      t.winrate       || 0,
      ranking:      t.ranking       || 999,
      wins:         t.wins          || 0,
      gamesPlayed:  t.games_played  || 0,
      donoId:       t.dono_id,
      whatsapp:     t.whatsapp      ?? undefined,
      discord:      t.discord       ?? undefined,
      membros:      membrosRaw,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id, user]);

  // Busca elo real dos membros em paralelo (otimização: antes era sequencial com 700ms entre cada)
  useEffect(() => {
    if (!time || time.membros.length === 0) return;
    let cancelado = false;

    const fetchElos = async () => {
      // Paralelizar: Promise.all em vez de for loop sequencial
      const promises = time.membros.map(async (membro) => {
        if (!membro.puuid) return { userId: membro.userId, elo: '' };

        let ranqueadas: any[] = [];
        try {
          ranqueadas = await buscarElo(membro.puuid);
        } catch {
          // Retry com delay apenas em caso de falha
          await new Promise(r => setTimeout(r, 1500));
          if (cancelado) return { userId: membro.userId, elo: '' };
          try {
            ranqueadas = await buscarElo(membro.puuid);
          } catch {
            ranqueadas = [];
          }
        }

        if (cancelado) return { userId: membro.userId, elo: '' };
        const solo = ranqueadas.find((r: any) => r.queueType === 'RANKED_SOLO_5x5');
        const eloStr = solo ? (TIER_MAP[solo.tier] ?? solo.tier) : '';
        return { userId: membro.userId, elo: eloStr };
      });

      const eloResults = await Promise.all(promises);

      if (!cancelado) {
        setTime((prev: TimeData | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            membros: prev.membros.map((m: Membro) => {
              const result = eloResults.find(r => r.userId === m.userId);
              return result ? { ...m, elo: result.elo } : m;
            }),
          };
        });
      }
    };

    fetchElos();
    return () => { cancelado = true; };
  }, [time?.id]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleUpdateTeam = async (updated: Partial<TimeData>) => {
    if (!time) return;
    try {
      await api.teams.update(String(time.id), {
        nome: updated.nome,
        tag: updated.tag,
        gradient_from: updated.gradientFrom,
        gradient_to: updated.gradientTo,
        logo_url: updated.logoUrl ?? null,
        whatsapp: updated.whatsapp ?? null,
        discord: updated.discord ?? null,
      });
    } catch {
      console.error('❌ Erro ao salvar time (teams.update):');
      return;
    }
    // Otimização: atualizar apenas os campos modificados no estado, sem recarregar tudo
    setTime((prev: TimeData | null) => {
      if (!prev) return prev;
      return {
        ...prev,
        nome: updated.nome ?? prev.nome,
        tag: updated.tag ?? prev.tag,
        gradientFrom: updated.gradientFrom ?? prev.gradientFrom,
        gradientTo: updated.gradientTo ?? prev.gradientTo,
        logoUrl: updated.logoUrl ?? prev.logoUrl,
        whatsapp: updated.whatsapp ?? prev.whatsapp,
        discord: updated.discord ?? prev.discord,
      };
    });
  };

  const handleUpdatePlayers = async (membros: Membro[]): Promise<boolean> => {
    if (!time) return false;

    // A API substitui o lineup inteiro numa ÚNICA transação (substitui a RPC).
    // Se qualquer insert falhar, ROLLBACK — o time NUNCA fica zerado.
    try {
      await api.teams.saveLineup(time.id, membros.map(m => ({
        user_id:               m.userId || null,
        lane:                  m.role,
        is_capitao:            m.isLeader || false,
        cargo:                 m.cargo || 'jogador',
        guest_riot_id:         m.userId ? null : m.riotId,
        guest_puuid:           m.userId ? null : m.puuid,
        guest_profile_icon_id: m.userId ? null : m.iconeId,
        guest_elo_cache:       m.userId ? null : m.elo,
      })));
    } catch (error: any) {
      console.error('❌ Erro ao salvar lineup:', error.message, error);
      return false;
    }

    // Atualiza apenas membros no estado, sem recarregar o time inteiro
    setTime((prev: TimeData | null) => {
      if (!prev) return prev;
      return { ...prev, membros };
    });
    return true;
  };

  const handleSairTime = async () => {
    if (!currentUserId || !time) return;
    // ✅ A saga inteira (promoção de capitão, dissolução do time, remoção do
    // membro) roda no servidor em POST /api/teams/:id/leave — regra de negócio
    // não mora no navegador.
    try {
      const result = await api.teams.leave(String(time.id));
      if (result?.deleted) {
        navigate('/times');
        return;
      }
    } catch (err: any) {
      console.error('❌ Erro ao sair do time:', err?.message, err);
    }
    navigate('/times');
  };

  const handleSidebarLineup = () => {
    if (userRole === 'leader') {
      playSound('click');
      setModalLineup(true);
    } else {
      playSound('click');
      setNotCapSidebar(true);
      setTimeout(() => setNotCapSidebar(false), 3000);
    }
  };

  // ── abrir OP.GG do jogador em nova aba ───────────────────────────────────────
  // Em vez do card padrão, leva direto pro perfil do player no OP.GG.
  // Ex: "One Lucks#BR1" -> https://op.gg/pt/lol/summoners/br/One%20Lucks-br1
  const handlePlayerClick = (m: Membro) => {
    if (!m.riotId || !m.riotId.includes('#')) return;
    playSound('click');
    const [gameName, tagLine] = m.riotId.split('#');
    const url = `https://op.gg/pt/lol/summoners/br/${encodeURIComponent(gameName.trim())}-${tagLine.trim().toLowerCase()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ── loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto">
        {/* Voltar skeleton */}
        <div className="h-6 w-20 bg-white/10 rounded animate-pulse mb-6" />

        {/* Hero Banner skeleton */}
        <div className="rounded-3xl border border-white/10 p-8 mb-6 animate-pulse" style={{ background: 'rgba(13,13,13,0.8)' }}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-24 h-24 rounded-2xl bg-white/10 shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-48 bg-white/10 rounded" />
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-3 w-64 bg-white/10 rounded" />
            </div>
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl p-4 border border-white/10 animate-pulse" style={{ background: 'rgba(13,13,13,0.8)' }}>
              <div className="h-3 w-16 bg-white/10 rounded mb-2" />
              <div className="h-8 w-12 bg-white/10 rounded" />
            </div>
          ))}
        </div>

        {/* Members skeleton */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl p-4 border border-white/10 flex items-center gap-4 animate-pulse" style={{ background: 'rgba(13,13,13,0.8)' }}>
              <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-white/10 rounded" />
                <div className="h-3 w-20 bg-white/10 rounded" />
              </div>
              <div className="h-6 w-16 bg-white/10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!time) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-white/40 font-bold uppercase tracking-widest">Time não encontrado</p>
        <button onClick={() => navigate('/times')} className="text-primary text-sm hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar para Equipes
        </button>
      </div>
    );
  }

  const totalSaldo = time.membros.reduce((s, m) => s + m.balance, 0);
  const lider = time.membros.find(m => m.isLeader);

  return (
    <>
      {/* Lightbox de Logo */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center cursor-zoom-out"
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              src={lightboxUrl}
              alt="Logo do time"
              className="max-w-[min(480px,90vw)] max-h-[80vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto">
        {/* Voltar */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/times')}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-semibold">Equipes</span>
        </motion.button>

        {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden mb-6 border border-white/10"
          style={{ background: `linear-gradient(135deg, ${time.gradientFrom}22, #0d0d0d 60%)` }}
        >
          {/* glow de fundo */}
          <div
            className="absolute -top-20 -left-20 w-96 h-96 rounded-full blur-[120px] opacity-30 pointer-events-none"

          />

          <div className="relative z-10 p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Logo */}
            <div
              className="w-28 h-28 rounded-3xl flex items-center justify-center shrink-0 relative overflow-hidden"
              style={{
                border: `3px solid transparent`,
                background: `linear-gradient(#0d0d0d, #0d0d0d) padding-box, linear-gradient(135deg, ${time.gradientFrom}, ${time.gradientTo}) border-box`,
                boxShadow: `0 0 40px -10px ${time.gradientFrom}`,
              }}
              onClick={time.logoUrl ? () => setLightboxUrl(time.logoUrl!) : undefined}
            >
              {time.logoUrl ? (
                <img src={time.logoUrl} alt={time.nome} className="w-full h-full object-cover cursor-zoom-in" loading="lazy" width={120} height={120} />
              ) : (
                <span className="font-black text-3xl tracking-widest" style={{ color: time.gradientFrom }}>
                  {time.tag}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-3 justify-center sm:justify-start mb-1">
                <h1 className="text-4xl font-black text-white uppercase tracking-tight">{time.nome}</h1>
                {userRole === 'leader' && <Crown className="w-5 h-5 shrink-0" style={{ color: time.gradientFrom }} />}
                {/* ✅ Botão de refresh discreto */}
                <button
                  onClick={() => window.location.reload()}
                  title="Atualizar dados do time"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all duration-200 ml-auto sm:ml-0"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-4">
                <span
                  className="text-[11px] font-black px-2 py-0.5 rounded-lg tracking-widest"
                  style={{ color: time.gradientFrom, background: `${time.gradientFrom}18`, border: `1px solid ${time.gradientFrom}40` }}
                >
                  #{time.tag}
                </span>
                <span className="text-white/30 text-[11px] font-black">Ranking #{time.ranking}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── GRID: LINEUP + INFO ─────────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* LINEUP */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="md:col-span-2 rounded-3xl border border-white/10 overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: time.gradientFrom }} />
              <h2 className="text-white font-black text-sm uppercase tracking-widest">Lineup</h2>
              <span className="ml-auto text-white/30 text-[11px]">{time.membros.filter(m => m.role !== 'COACH').length} jogadores</span>
            </div>

            <div className="p-4 space-y-2">
              {ROLE_ORDER.map(role => {
                const membrosRole = time.membros.filter(m => m.role === role);
                const cfg = ROLE_CONFIG[role];

                if (membrosRole.length === 0) {
                  return (
                    <div
                      key={role}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-dashed border-white/5 opacity-30"
                    >
                      <div className="flex items-center gap-2 w-16 shrink-0">
                        <img src={cfg.img} alt={cfg.label} className="w-5 h-5 object-contain opacity-40" />
                        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <span className="text-white/20 text-sm">Vaga aberta</span>
                    </div>
                  );
                }

                return membrosRole.map((m, idx) => (
                  <motion.div
                    key={m.userId || m.riotId}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => handlePlayerClick(m)}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.07] cursor-pointer transition-all"
                  >
                    {/* Role */}
                    <div className="flex items-center gap-2 w-16 shrink-0">
                      <img src={cfg.img} alt={cfg.label} className="w-5 h-5 object-contain" />
                      <span className={`text-xs font-bold ${cfg.color}`}>
                        {role === 'RES' ? `R${idx + 1}` : cfg.label}
                      </span>
                    </div>

                    {/* Avatar */}
                    {m.iconeId ? (
                      <img
                        src={buildProfileIconUrl(m.iconeId)}
                        alt={m.riotId}
                        className="w-9 h-9 rounded-xl border border-white/10 shrink-0"
                        loading="lazy"
                        width={36}
                        height={36}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 shrink-0 flex items-center justify-center">
                        <Users className="w-4 h-4 text-white/20" />
                      </div>
                    )}

                    {/* Nome + cargo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-bold text-sm truncate">{m.riotId.split('#')[0]}</span>
                        {m.isLeader && (
                          <span
                            className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 border"
                            style={{ color: time.gradientFrom, borderColor: `${time.gradientFrom}60`, background: `${time.gradientFrom}18` }}
                          >
                            CAP
                          </span>
                        )}
                        {m.puuid && <ShieldCheck className="w-3 h-3 text-green-400 shrink-0" />}
                      </div>
                      <span className="text-white/30 text-[11px]">{m.riotId.split('#')[1] ? `#${m.riotId.split('#')[1]}` : ''}</span>
                    </div>

                    {/* Elo */}
                    <span className="text-white/40 text-xs font-semibold shrink-0">{eloDisplay(m.elo)}</span>

                    <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
                  </motion.div>
                ));
              })}
            </div>
          </motion.div>

          {/* COLUNA DIREITA */}
          <div className="md:row-span-2 flex flex-col gap-4">
            {/* Capitão */}
            {lider && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-3xl border border-white/10 p-5 overflow-hidden"
                style={{ background: 'rgba(0,0,0,0.4)' }}
              >
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-3">Capitão</p>
                <div
                  className="flex items-center gap-3 p-3 rounded-2xl border cursor-pointer hover:brightness-110 transition-all"
                  style={{ background: `${time.gradientFrom}0e`, borderColor: `${time.gradientFrom}35` }}
                  onClick={() => handlePlayerClick(lider)}
                >
                  {lider.iconeId ? (
                    <img
                      src={buildProfileIconUrl(lider.iconeId)}
                      alt={lider.riotId}
                      className="w-10 h-10 rounded-xl border"
                      style={{ borderColor: `${time.gradientFrom}60` }}
                      loading="lazy"
                      width={40}
                      height={40}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                      <Crown className="w-5 h-5" style={{ color: time.gradientFrom }} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-white font-black text-sm truncate">{lider.riotId.split('#')[0]}</p>
                    <p className="text-xs font-bold" style={{ color: time.gradientFrom }}>Capitão</p>
                  </div>
                  <Crown className="w-4 h-4 ml-auto shrink-0" style={{ color: time.gradientFrom }} />
                </div>
              </motion.div>
            )}

            {/* Gerenciar */}
            {(userRole === 'leader' || userRole === 'member') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="rounded-3xl border border-white/10 p-5 overflow-hidden space-y-2"
                style={{ background: 'rgba(0,0,0,0.4)' }}
              >
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-3">Gerenciar</p>
                {[
                  { icon: UserPlus,    label: 'Adicionar Jogador', action: () => { playSound('click'); setModalConvidar(true); } },
                  { icon: Paintbrush, label: 'Editar Time',       action: () => { playSound('click'); setModalEditar(true); }   },
                  { icon: Users,      label: 'Gerenciar Lineup',  action: handleSidebarLineup },
                ].map(({ icon: Icon, label, action }) => (
                  <button
                    key={label} onClick={action}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-white/60 hover:text-white text-sm font-medium transition-all group"
                  >
                    <Icon className="w-4 h-4 transition-transform"
                      style={{ color: time.gradientFrom }} />
                    {label}
                  </button>
                ))}
                {notCapSidebar && (
                  <p className="text-yellow-400/80 text-[11px] font-semibold text-center py-1">
                    Apenas o capitão pode gerenciar o lineup
                  </p>
                )}
                <div className="pt-2 mt-2 border-t border-white/5" />
                <button
                  onClick={() => { playSound('click'); setModalSair(true); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 hover:border-red-500/30 text-red-400/70 hover:text-red-400 text-sm font-medium transition-all group"
                >
                  <LogOut className="w-4 h-4 transition-transform" />
                  Sair da Equipe
                </button>
              </motion.div>
            )}

            {/* Histórico */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex-1 rounded-3xl border border-white/10 p-5 flex flex-col"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-white/20" />
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Histórico</p>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center py-4">
                <p className="text-white/20 text-sm">Em breve</p>
                <span className="text-xs text-white/10 bg-white/5 px-2 py-0.5 rounded-full mt-2 inline-block">Campeonatos</span>
              </div>
            </motion.div>

            {/* Solicitar entrada (visitante) */}
            {userRole === 'visitor' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <button
                  onClick={() => {
                    playSound('click');
                    if (!user) {
                      navigate('/login');
                    } else {
                      setModalSolicitar(true);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: `${time.gradientFrom}18`,
                    border: `1px solid ${time.gradientFrom}50`,
                    color: time.gradientFrom,
                  }}
                >
                  <Send className="w-4 h-4" /> Solicitar Entrada
                </button>
              </motion.div>
            )}
          </div>

          {/* STATUS DO TIME */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="md:col-span-2 rounded-3xl border border-white/10 overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
              <Trophy className="w-4 h-4" style={{ color: time.gradientFrom }} />
              <h2 className="text-white font-black text-sm uppercase tracking-widest">Status do Time</h2>
            </div>

            <div className="p-6 grid grid-cols-2 sm:grid-cols-5 gap-6">
              {[
                { label: 'PDL',      val: time.pdl.toLocaleString('pt-BR'), icon: ShieldCheck },
                { label: 'Win Rate', val: `${time.winrate}%`, icon: RefreshCw },
                { label: 'Vitórias', val: `${time.wins}/${time.gamesPlayed}`, icon: Check },
                { label: 'Torneio',  val: time.torneio ?? 'Nenhum', icon: Trophy },
                { label: 'Rating',   val: `#${time.ranking}`, icon: Crown },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center sm:items-start">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className="w-3 h-3 text-white/20" />
                    <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">{s.label}</p>
                  </div>
                  <p className="font-black text-xl text-white leading-none">{s.val}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Player Detail Modal */}
        {modalConvidar && <InvitePlayerModal team={time} onClose={() => setModalConvidar(false)} onAddPlayer={handleUpdatePlayers} />}
        {modalSolicitar && <RequestEntryModal team={time} onClose={() => setModalSolicitar(false)} />}
        {modalEditar && (
          <EditTeamModal team={time} onClose={() => setModalEditar(false)} onSave={handleUpdateTeam} />
        )}
        {modalLineup && (
          <ManageLineupModal team={time} onClose={() => setModalLineup(false)} onUpdateTeam={handleUpdatePlayers} />
        )}
        {modalSair && (
          <ConfirmLeaveModal onClose={() => setModalSair(false)} onConfirm={handleSairTime} />
        )}

    </>
  );
}
