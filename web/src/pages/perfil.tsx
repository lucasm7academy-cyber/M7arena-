import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RefreshCw, CheckCircle, ChevronRight, LinkIcon, ChevronDown,
  Pencil, Check, X, Users, Wallet, LogOut, ShieldOff, ShieldCheck, Mail
} from 'lucide-react';
import { FaInstagram, FaTwitch, FaDiscord } from 'react-icons/fa6';
import { FaYoutube } from 'react-icons/fa';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePerfil } from '../contexts/PerfilContext';
import { getDDRVersion } from '../api/riot';
import { sincronizarContaRiot } from '../api/player';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { VipLabel } from '../components/ui/VipBadge';
import { CutCard, CUT_OUTER, CUT_INNER } from '../components/ui/CutCard';
import { CarteiraEStrikes } from '../components/perfil/CarteiraEStrikes';
import { HistoricoApostas } from '../components/perfil/HistoricoApostas';
import {
  ModalShell,
  CutCard as CutEdgeCard,
  CUT_FRAME,
  CUT_FRAME_INNER,
  CUT_BUTTON,
  CUT_BUTTON_INNER,
  CUT_BADGE,
  CUT_BADGE_INNER,
} from '../components/partidas/ModaisElegibilidade';

const DDR_FALLBACK = '14.24.1';

const ELO_COLORS: Record<string, string> = {
  IRON: '#51484a', BRONZE: '#8c513a', SILVER: '#80989d', GOLD: '#cd8837',
  PLATINUM: '#4e9996', EMERALD: '#2eb042', DIAMOND: '#576bcc',
  MASTER: '#9d5ca3', GRANDMASTER: '#cd4545', CHALLENGER: '#f4c874',
};

const LANES = [
  { id: 'Top', label: 'Top Laner', file: 'Top_icon.png' },
  { id: 'Jungle', label: 'Caçador', file: 'Jungle_icon.png' },
  { id: 'Middle', label: 'Mid Laner', file: 'Middle_icon.png' },
  { id: 'Bottom', label: 'Atirador', file: 'Bottom_icon.png' },
  { id: 'Support', label: 'Suporte', file: 'Support_icon.png' },
  { id: 'Fill', label: 'Reserva', file: 'icon-position-fill.png' },
];

const TIPOS_PIX = [
  { value: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
  { value: 'email', label: 'E-mail', placeholder: 'seu@email.com' },
  { value: 'telefone', label: 'Telefone', placeholder: '+55 (11) 99999-9999' },
  { value: 'aleatoria', label: 'Chave aleatória', placeholder: 'Cole sua chave aleatória' },
];

const getLaneUrl = (file: string) => `/lanes/${file}`;
const getEloUrl = (tier: string) => `/ranks/${tier.toLowerCase()}.png`;
const LABEL_CLASS = 'text-xs text-zinc-400 font-normal uppercase tracking-widest';

// Componente EloBlock (direto no arquivo com estilo angular)
function EloBlock({ elo, label }: any) {
  if (!elo) return null;
  const wr = Math.round((elo.wins / (elo.wins + elo.losses)) * 100) || 0;
  const total = elo.wins + elo.losses;

  return (
    <CutCard
      className="overflow-hidden group" contentClassName="p-5 sm:p-8">
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-primary/10 transition-colors" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <span className={LABEL_CLASS}>{label}</span>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative w-20 h-20 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 bg-primary/10 blur-2xl opacity-50" />
              <img src={getEloUrl(elo.tier)} alt={elo.tier} className="relative w-16 h-16 sm:w-28 sm:h-28 object-contain z-10"
                style={{ filter: `drop-shadow(0 0 12px ${ELO_COLORS[elo.tier] || 'rgba(255,255,255,0.2)'})` }} />
            </div>
            <div>
              <p className="font-headline font-black text-2xl sm:text-3xl uppercase tracking-tight leading-tight text-white">
                {elo.tier} <span className="text-primary">{elo.rank}</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="px-2.5 py-1 text-[10px] font-black text-zinc-300 uppercase tracking-widest bg-white/5 border border-white/10"
                  style={{ clipPath: CUT_BADGE }}
                >
                  {elo.lp} PDL
                </span>
                <span
                  className="px-2.5 py-1 text-[10px] font-black text-zinc-300 uppercase tracking-widest bg-white/5 border border-white/10"
                  style={{ clipPath: CUT_BADGE }}
                >
                  {total} Partidas
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-7 flex flex-col justify-center gap-6">
          <div className="flex items-center justify-between">
            <span className={LABEL_CLASS}>Performance Detalhada</span>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{wr}% Win Rate</span>
          </div>
          <div className="space-y-6">
            <div
              className="relative h-10 overflow-hidden bg-black/60 border border-white/10"
              style={{ clipPath: CUT_BUTTON }}
            >
              <motion.div initial={{ width: 0 }} animate={{ width: `${wr}%` }} transition={{ duration: 1, ease: 'circOut' }} className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-600 to-blue-400" />
              <motion.div initial={{ width: 0 }} animate={{ width: `${100 - wr}%` }} transition={{ duration: 1, ease: 'circOut', delay: 0.1 }} className="absolute right-0 top-0 h-full bg-gradient-to-l from-[#ff0033] to-[#ff4d4d]" />
              <div className="absolute inset-0 flex items-center justify-between px-6 z-10"><span className="text-white text-xs font-black">{elo.wins}V</span><span className="text-white text-xs font-black">{elo.losses}D</span></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Partidas', val: total, color: 'text-zinc-200' },
                { label: 'Vitórias', val: elo.wins, color: 'text-blue-400' },
                { label: 'Derrotas', val: elo.losses, color: 'text-red-400' },
                { label: 'Win Rate', val: `${wr}%`, color: wr >= 50 ? 'text-blue-400' : 'text-red-400' }
              ].map((item, i) => (
                <div
                  key={i}
                  className="relative p-[1px]"
                  style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="bg-[#0c0c10] p-4 text-center hover:bg-[#14141a] transition-colors"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <p className={`font-black text-lg ${item.color}`}>{item.val}</p>
                    <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mt-1">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </CutCard>
  );
}

// Componente PerformanceSection com estilo cut-edge
function PerformanceSection({ stats, ddrVer }: any) {
  if (!stats || stats.topChampions?.length === 0) return null;
  
  return (
    <CutCard
      className="overflow-hidden" contentClassName="p-5 sm:p-8 space-y-8">
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
      <div className="flex items-center justify-between relative z-10"><span className={LABEL_CLASS}>Análise de Performance</span></div>
      <div className="grid lg:grid-cols-2 gap-12 relative z-10">
        {stats.topChampions?.length > 0 && (
          <div className="space-y-6">
            <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">Campeões de Assinatura (Top 10)</p>
            <div className="grid grid-cols-1 gap-4">
              {stats.topChampions.slice(0, 10).map((champ: any, i: number) => (
                <div
                  key={champ.championName}
                  className="relative p-[1px]"
                  style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="group bg-[#0c0c10] p-4 hover:bg-[#14141c] transition-all"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative flex-shrink-0">
                        <div
                          className="relative w-16 h-16 overflow-hidden border border-white/10 bg-black/40"
                          style={{ clipPath: CUT_BADGE }}
                        >
                          <img src={`https://ddragon.leagueoflegends.com/cdn/${ddrVer}/img/champion/${champ.championName}.png`} loading="lazy" 
                            alt={champ.championName} className="w-full h-full object-cover" />
                        </div>
                        <div
                          className="absolute -top-2 -left-2 w-6 h-6 bg-black border border-white/10 flex items-center justify-center"
                          style={{ clipPath: CUT_BADGE }}
                        >
                          <span className="text-primary text-[10px] font-black">{i + 1}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-zinc-100 font-black text-lg uppercase tracking-tight truncate">{champ.championName}</p>
                          <span className={`text-xs font-black uppercase tracking-widest ${champ.winrate >= 50 ? 'text-blue-400' : 'text-red-400'}`}>{champ.winrate}% WR</span>
                        </div>
                        <div
                          className="relative h-2 bg-white/5 overflow-hidden mb-2"
                          style={{ clipPath: CUT_BADGE }}
                        >
                          <motion.div initial={{ width: 0 }} animate={{ width: `${champ.winrate}%` }} 
                            className={`h-full ${champ.winrate >= 50 ? 'bg-blue-500' : 'bg-red-500'}`} />
                        </div>
                        <div className="flex justify-between">
                          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{champ.games} Jogos</p>
                          <div className="flex gap-3">
                            <span className="text-blue-400 text-[10px] font-black uppercase">{champ.wins}V</span>
                            <span className="text-red-400/50 text-[10px] font-black uppercase">{champ.games - champ.wins}D</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CutCard>
  );
}

// ModalPix com o padrão oficial Cut-Edge da Arena
function ModalPix({ aberto, onFechar, onSalvar, inicial }: any) {
  const [tipo, setTipo] = useState(inicial.tipo || 'cpf');
  const [chave, setChave] = useState(inicial.chave || '');
  const [nome, setNome] = useState(inicial.nome || '');
  const tipoAtual = TIPOS_PIX.find(t => t.value === tipo) ?? TIPOS_PIX[0];
  
  if (!aberto) return null;
  
  return (
    <ModalShell
      titulo="Configurar PIX"
      badge="Carteira & Premiações"
      subtitulo="Para recebimento de prêmios e saques de MC"
      corBorda="#FFB700"
      icone={<Wallet className="w-6 h-6 text-[#FFB700]" />}
      onClose={onFechar}
    >
      <CutEdgeCard corBorda="#FFB700" corBg="#0d0d12" bordaOpacity={0.3} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-zinc-400 text-[10px] uppercase font-black tracking-widest block">Tipo de chave</label>
          <div className="relative p-[1px] w-full" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.15)' }}>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full bg-[#050508] p-3 text-zinc-100 text-sm font-bold focus:outline-none"
              style={{ clipPath: CUT_BADGE_INNER }}
            >
              {TIPOS_PIX.map(t => <option key={t.value} value={t.value} className="bg-[#09090c]">{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-zinc-400 text-[10px] uppercase font-black tracking-widest block">Chave PIX</label>
          <div className="relative p-[1px] w-full" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.15)' }}>
            <input
              type="text"
              value={chave}
              onChange={e => setChave(e.target.value)}
              placeholder={tipoAtual.placeholder}
              className="w-full bg-[#050508] p-3 text-zinc-100 text-sm font-mono focus:outline-none placeholder:text-zinc-600"
              style={{ clipPath: CUT_BADGE_INNER }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-zinc-400 text-[10px] uppercase font-black tracking-widest block">Nome completo do titular</label>
          <div className="relative p-[1px] w-full" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.15)' }}>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Como no documento de identidade"
              className="w-full bg-[#050508] p-3 text-zinc-100 text-sm font-bold focus:outline-none placeholder:text-zinc-600"
              style={{ clipPath: CUT_BADGE_INNER }}
            />
          </div>
        </div>

        <div
          className="relative p-[1px] w-full"
          style={{ clipPath: CUT_BADGE, background: 'rgba(234, 179, 8, 0.3)' }}
        >
          <div
            className="p-3 bg-[#171408] flex items-start gap-2.5"
            style={{ clipPath: CUT_BADGE_INNER }}
          >
            <ShieldCheck className="w-4 h-4 text-[#FFB700] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#FFB700]/90 leading-relaxed font-bold">
              A conta Pix deve estar no seu nome. Premiações e saques serão enviados exclusivamente para esta chave.
            </p>
          </div>
        </div>
      </CutEdgeCard>

      <div className="flex flex-col gap-2.5 pt-1">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { if (chave && nome) onSalvar(tipo, chave, nome); }}
          disabled={!chave || !nome}
          className="w-full relative p-[1px] cursor-pointer shadow-lg disabled:opacity-50"
          style={{
            clipPath: CUT_BUTTON,
            background: 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)',
          }}
        >
          <div
            className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            Salvar Configurações
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onFechar}
          className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
          style={{ clipPath: CUT_BUTTON }}
        >
          <div
            className="w-full py-3 px-5 flex items-center justify-center font-black text-xs uppercase tracking-widest text-zinc-400 hover:text-zinc-100 bg-[#121216] transition-colors"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            Cancelar
          </div>
        </motion.button>
      </div>
    </ModalShell>
  );
}

// PÁGINA PRINCIPAL OTIMIZADA
export default function Perfil() {
  const { user, logout } = useAuth();
  const { perfil: perfilContext, loading: perfilLoading, refetch: refetchPerfil, profileData, myTeam, eloCache, championsCache } = usePerfil();
  const navigate = useNavigate();

  // ✅ Estados para dados PESADOS (só carregam quando necessário)
  const [eloSolo, setEloSolo] = useState<any>(null);
  const [eloFlex, setEloFlex] = useState<any>(null);
  const [statsRecentes, setStatsRecentes] = useState<any>(null);
  const [ddrVer, setDdrVer] = useState(DDR_FALLBACK);
  const [equipe, setEquipe] = useState<any>(null);
  const [membroInfo, setMembroInfo] = useState<{ role: string } | null>(null);
  const [loadingDadosPesados, setLoadingDadosPesados] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  
  // ✅ Estados para dados EDITÁVEIS (vêm do banco, não do contexto)
  const [lane, setLane] = useState('Top');
  const [laneOpen, setLaneOpen] = useState(false);
  const [lane2, setLane2] = useState('Support');
  const [lane2Open, setLane2Open] = useState(false);
  const [bio, setBio] = useState('');
  const [editandoBio, setEditandoBio] = useState(false);
  const [bioTemp, setBioTemp] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [tipoChavePix, setTipoChavePix] = useState('');
  const [nomePix, setNomePix] = useState('');
  const [modalPixAberto, setModalPixAberto] = useState(false);
  const [instagram, setInstagram] = useState('');
  const [twitch, setTwitch] = useState('');
  const [youtube, setYoutube] = useState('');
  const [discord, setDiscord] = useState('');
  
  const laneRef = useRef<HTMLDivElement>(null);
  const lane2Ref = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ✅ Função única para salvar no banco (PUT /api/profiles/me)
  const salvarCampo = async (campos: Record<string, any>) => {
    if (!user) return;
    try {
      await api.profiles.update(campos);
    } catch (error) {
      console.error('❌ Erro ao salvar perfil:', error);
    }
  };

  // ── Scroll ao topo quando a página carrega ─────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ✅ useEffect 1: Inicializar dados do PerfilContext
  useEffect(() => {
    if (!profileData || !user) return;

    setBio(profileData.bio || '');
    setLane(profileData.lane_primaria || 'Fill');
    setLane2(profileData.lane_secundaria || 'Fill');
    setInstagram(profileData.instagram || '');
    setTwitch(profileData.twitch || '');
    setYoutube(profileData.youtube || '');
    setDiscord(profileData.discord || '');
    setChavePix(profileData.chave_pix || '');
    setTipoChavePix(profileData.tipo_chave_pix || '');
    setNomePix(profileData.nome_pix || '');

    if (myTeam) {
      setEquipe(myTeam);
      setMembroInfo({ role: myTeam.membro_role });
    }
  }, [profileData, myTeam, user]);

  // ✅ useEffect 2: Inicializar dados pesados que vêm da RPC (elo, champions)
  useEffect(() => {
    if (!eloCache) return;

    setEloSolo(eloCache.soloQ || null);
    setEloFlex(eloCache.flexQ || null);
    setStatsRecentes({
      topChampions: championsCache?.topChampions || [],
      roles: championsCache?.roles || [],
      totalGames: championsCache?.totalGames || 0,
    });

    getDDRVersion().then(setDdrVer);
    setLoadingDadosPesados(false);
  }, [eloCache, championsCache]);

  // ✅ Sem conta Riot vinculada não há elo_cache para mostrar — sai do loading
  useEffect(() => {
    if (perfilLoading || perfilContext === null) return;
    if (perfilContext.contaVinculada === false && !eloCache) {
      setLoadingDadosPesados(false);
    }
  }, [perfilLoading, perfilContext, eloCache]);

  // ✅ Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (laneRef.current && !laneRef.current.contains(e.target as Node)) setLaneOpen(false);
      if (lane2Ref.current && !lane2Ref.current.contains(e.target as Node)) setLane2Open(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLane = async (id: string, isSecondary = false) => {
    if (isSecondary) { setLane2(id); setLane2Open(false); await salvarCampo({ lane_secundaria: id }); }
    else { setLane(id); setLaneOpen(false); await salvarCampo({ lane_primaria: id }); }
  };
  
  const handleSalvarBio = async () => { setBio(bioTemp); setEditandoBio(false); await salvarCampo({ bio: bioTemp }); };
  
  const handleSalvarPix = async (tipo: string, chave: string, nome: string) => {
    setChavePix(chave); setTipoChavePix(tipo); setNomePix(nome); setModalPixAberto(false);
    await salvarCampo({ chave_pix: chave, tipo_chave_pix: tipo, nome_pix: nome });
  };
  
  const handleSair = async () => { await logout(); navigate('/lobby'); };
  
  const handleSyncRiot = async () => {
    if (!user || sincronizando) return;
    setSincronizando(true);
    try {
      const contaRiot = await api.profiles.getRiot();
      if (!contaRiot?.puuid) { setSincronizando(false); return; }
      await sincronizarContaRiot(contaRiot.puuid, user.id);
      refetchPerfil();
      setLoadingDadosPesados(true);
      const riotCompleto = await api.profiles.getRiot();
      if (riotCompleto) {
        setEloSolo(riotCompleto.elo_cache?.soloQ || null);
        setEloFlex(riotCompleto.elo_cache?.flexQ || null);
        setStatsRecentes({
          topChampions: riotCompleto.champions_cache?.topChampions || [],
          roles: riotCompleto.champions_cache?.roles || [],
          totalGames: riotCompleto.champions_cache?.totalGames || 0,
        });
      }
      setLoadingDadosPesados(false);
    } finally {
      setSincronizando(false);
    }
  };

  if (perfilLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const laneAtual = LANES.find(l => l.id === lane);
  const lane2Atual = LANES.find(l => l.id === lane2);
  
  const displayName = perfilContext?.nome || user?.email?.split('@')[0] || 'Jogador';
  const avatarUrl = perfilContext?.avatar;
  const isVip = perfilContext?.isVip || false;
  const saldo = perfilContext?.saldo || 0;
  const eloPrincipal = perfilContext?.elo || 'Unranked';

  return (
    <div className="relative min-h-screen w-full text-white font-sans overflow-x-hidden">
      <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-32">
        
        {/* HEADER */}
        <CutCard
          className="z-10" contentClassName="p-5 sm:p-10">
          <div className="relative flex flex-col gap-8 overflow-visible">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-primary/20 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000" />
                    <div className="relative w-32 h-32 rounded-full flex items-center justify-center overflow-hidden bg-black/40 shrink-0 border-2 border-white/10">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover scale-110" />
                      ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center"><Users className="w-12 h-12 text-white/10" /></div>
                      )}
                    </div>
                    {sincronizando && (
                      <div className="absolute -top-1 -right-1 w-7 h-7 bg-black rounded-full border border-white/10 flex items-center justify-center z-20">
                        <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-center sm:text-left flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-black tracking-tight text-white uppercase break-all">
                      {displayName}{perfilContext?.tag}
                    </h1>
                    {isVip && <VipLabel text="VIP" />}
                  </div>
                  
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <p className="font-headline font-black text-sm uppercase tracking-[0.2em] text-primary/80">
                      {eloPrincipal}
                    </p>
                    {perfilContext?.riotId && (
                      <button
                        onClick={handleSyncRiot}
                        className="flex items-center justify-center w-6 h-6 border border-white/10 hover:border-primary/40 bg-white/5 hover:bg-primary/10 transition-all cursor-pointer"
                        style={{ clipPath: CUT_BADGE }}
                        title="Sincronizar conta Riot"
                      >
                        <RefreshCw className={`w-3 h-3 text-zinc-400 hover:text-primary transition-colors ${sincronizando ? 'animate-spin text-primary' : ''}`} />
                      </button>
                    )}
                  </div>
                  
                  {/* BIO EDITÁVEL */}
                  <div className="mt-4">
                    <div className="max-w-md mx-auto sm:mx-0">
                      {editandoBio ? (
                        <div className="flex items-center gap-2">
                          <div className="relative p-[1px] flex-1" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.15)' }}>
                            <input autoFocus type="text" value={bioTemp} onChange={e => setBioTemp(e.target.value)} 
                              maxLength={100} placeholder="Sua bio..."
                              className="w-full bg-[#050508] px-4 py-2 text-zinc-100 text-sm focus:outline-none"
                              style={{ clipPath: CUT_BADGE_INNER }} />
                          </div>
                          <button onClick={handleSalvarBio} className="p-2.5 bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer" style={{ clipPath: CUT_BADGE }}><Check className="w-4 h-4" /></button>
                          <button onClick={() => { setEditandoBio(false); setBioTemp(bio); }} className="p-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors cursor-pointer" style={{ clipPath: CUT_BADGE }}><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center sm:justify-start gap-2 group cursor-pointer" onClick={() => { setBioTemp(bio); setEditandoBio(true); }}>
                          <p className={`text-sm leading-relaxed ${bio ? 'text-zinc-300' : 'text-zinc-500 italic'}`}>{bio || 'Clique para adicionar uma bio...'}</p>
                          <Pencil className="w-3.5 h-3.5 text-zinc-500 group-hover:text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* LANE SELECTORS */}
              <div className="flex items-center justify-center gap-6 sm:gap-8 overflow-visible">
                <div className="relative flex flex-col items-center gap-2 overflow-visible" ref={laneRef}>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Primária</p>
                  <button onClick={() => setLaneOpen(v => !v)} className="cursor-pointer">
                    {laneAtual ? <img src={getLaneUrl(laneAtual.file)} className="w-16 h-16 object-contain" style={{ filter: `drop-shadow(0 0 12px rgba(255,184,0,0.3))` }} /> 
                      : (
                        <div className="w-16 h-16 p-[1px] bg-white/15 hover:bg-white/30 transition-colors" style={{ clipPath: CUT_BUTTON }}>
                          <div className="w-full h-full bg-[#0c0c10] flex items-center justify-center" style={{ clipPath: CUT_BUTTON_INNER }}>
                            <ChevronDown className="w-6 h-6 text-zinc-500" />
                          </div>
                        </div>
                      )}
                  </button>
                  <AnimatePresence>{laneOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.08 }} 
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-48 p-[1px] bg-[#FFB700]/40 shadow-2xl overflow-hidden z-[9999]"
                    style={{ clipPath: CUT_FRAME }}>
                    <div className="w-full bg-[#0a0a0c]/98 backdrop-blur-2xl p-2 space-y-1" style={{ clipPath: CUT_FRAME_INNER }}>
                      {LANES.map(l => <button key={l.id} onClick={() => handleLane(l.id)} 
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer ${lane === l.id ? 'bg-primary/20 text-primary' : 'text-zinc-300 hover:bg-white/5'}`}
                        style={{ clipPath: CUT_BADGE }}>
                        <img src={getLaneUrl(l.file)} className="w-5 h-5 object-contain" /><span className="text-xs font-bold uppercase">{l.label}</span>
                      </button>)}
                    </div>
                  </motion.div>}</AnimatePresence>
                </div>
                
                <div className="relative flex flex-col items-center gap-2 overflow-visible" ref={lane2Ref}>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Secundária</p>
                  <button onClick={() => setLane2Open(v => !v)} className="cursor-pointer">
                    {lane2Atual ? <img src={getLaneUrl(lane2Atual.file)} className="w-16 h-16 object-contain" style={{ filter: `drop-shadow(0 0 12px rgba(255,184,0,0.3))` }} /> 
                      : (
                        <div className="w-16 h-16 p-[1px] bg-white/15 hover:bg-white/30 transition-colors" style={{ clipPath: CUT_BUTTON }}>
                          <div className="w-full h-full bg-[#0c0c10] flex items-center justify-center" style={{ clipPath: CUT_BUTTON_INNER }}>
                            <ChevronDown className="w-6 h-6 text-zinc-500" />
                          </div>
                        </div>
                      )}
                  </button>
                  <AnimatePresence>{lane2Open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.08 }} 
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-48 p-[1px] bg-[#FFB700]/40 shadow-2xl overflow-hidden z-[9999]"
                    style={{ clipPath: CUT_FRAME }}>
                    <div className="w-full bg-[#0a0a0c]/98 backdrop-blur-2xl p-2 space-y-1" style={{ clipPath: CUT_FRAME_INNER }}>
                      {LANES.map(l => <button key={l.id} onClick={() => handleLane(l.id, true)} 
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer ${lane2 === l.id ? 'bg-primary/20 text-primary' : 'text-zinc-300 hover:bg-white/5'}`}
                        style={{ clipPath: CUT_BADGE }}>
                        <img src={getLaneUrl(l.file)} className="w-5 h-5 object-contain" /><span className="text-xs font-bold uppercase">{l.label}</span>
                      </button>)}
                    </div>
                  </motion.div>}</AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </CutCard>

        {/* WALLET + ADVERTÊNCIAS (ADR-033) */}
        <CarteiraEStrikes
          saldoDisponivel={saldo}
          advertencias={perfilContext?.advertencias ?? 0}
          advertenciasMax={perfilContext?.advertenciasMax ?? 3}
          status={perfilContext?.status ?? 'active'}
          banMotivo={perfilContext?.banMotivo ?? null}
          suspensaAte={perfilContext?.suspensaAte ?? null}
        />

        {/* HISTÓRICO DE APOSTAS (MC ganho/perdido) */}
        <HistoricoApostas />

        {/* EQUIPE */}
        <CutCard
          contentClassName="p-5 sm:p-8">
          <div className="flex items-center justify-between mb-6"><span className={LABEL_CLASS}>Minha Equipe</span><Users className="w-5 h-5 text-primary/40" /></div>
          {equipe ? (
            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/times/${equipe.id}`)}
              className="relative p-[1px] cursor-pointer"
              style={{ clipPath: CUT_BUTTON, background: `${equipe.gradient_from || '#FFB700'}50` }}
            >
              <div
                className="bg-[#09090c] hover:bg-[#121217] transition-all p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                {/* Logo */}
                <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                  <div className="shrink-0">
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center relative overflow-hidden bg-black"
                      style={{
                        clipPath: CUT_BUTTON,
                        border: `2px solid ${equipe.gradient_from || '#FFB700'}`,
                        boxShadow: `0 8px 24px -6px ${equipe.gradient_from || '#FFB700'}60`
                      }}
                    >
                      {equipe.logo_url ? (
                        <img src={equipe.logo_url} loading="lazy" alt={equipe.nome} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-black text-base sm:text-lg tracking-widest" style={{ color: equipe.gradient_from || '#FFB700' }}>{equipe.tag}</span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                      <h3 className="text-white font-black text-lg sm:text-xl tracking-tight truncate uppercase">{equipe.nome}</h3>
                      {equipe.tag && (
                        <span
                          className="text-[10px] font-black px-2 py-0.5 shrink-0"
                          style={{
                            clipPath: CUT_BADGE,
                            color: equipe.gradient_from || '#FFB700',
                            background: `${equipe.gradient_from || '#FFB700'}18`,
                            border: `1px solid ${equipe.gradient_from || '#FFB700'}40`
                          }}
                        >
                          #{equipe.tag}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-zinc-500 uppercase font-black">PDL</span>
                        <span className="font-black text-xs sm:text-sm" style={{ color: equipe.gradient_from || '#FFB700' }}>{(equipe.pdl || 0).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="w-px h-4 sm:h-5 bg-white/5" />
                      <div className="flex flex-col">
                        <span className="text-[8px] text-zinc-500 uppercase font-black">WIN%</span>
                        <span className="font-black text-xs sm:text-sm text-green-400">{equipe.winrate || 0}%</span>
                      </div>
                      <div className="w-px h-4 sm:h-5 bg-white/5" />
                      <div className="flex flex-col">
                        <span className="text-[8px] text-zinc-500 uppercase font-black">W/L</span>
                        <span className="font-black text-xs sm:text-sm text-white">{equipe.wins || 0}/{(equipe.games_played || 0) - (equipe.wins || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 border-t border-white/5 pt-4 sm:border-t-0 sm:pt-0">
                  {/* Rota */}
                  {(() => {
                    const ROLE_TO_LANE: Record<string, string> = {
                      TOP: 'Top_icon.png', JG: 'Jungle_icon.png', MID: 'Middle_icon.png',
                      ADC: 'Bottom_icon.png', SUP: 'Support_icon.png',
                    };
                    const roleFile = membroInfo?.role ? ROLE_TO_LANE[membroInfo.role.toUpperCase()] : null;
                    if (!roleFile) return null;
                    return (
                      <div className="shrink-0 flex items-center justify-center sm:pl-4 sm:pr-1">
                        <img
                          src={`/lanes/${roleFile}`}
                          alt={membroInfo?.role}
                          className="w-10 h-10 sm:w-14 sm:h-14 object-contain"
                          style={{ filter: 'drop-shadow(0 0 12px rgba(255,184,0,0.3))' }}
                        />
                      </div>
                    );
                  })()}

                  {/* Rank */}
                  <div className="shrink-0 flex flex-col items-center justify-center sm:border-l sm:border-white/5 sm:pl-6 sm:pr-2 h-12 sm:h-16 gap-0.5">
                    <span className="text-sm sm:text-lg font-black tracking-tighter uppercase" style={{ color: equipe.gradient_from || '#FFB700' }}>
                      RANK #{equipe.ranking || '—'}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-[9px] uppercase tracking-[0.15em]" style={{ color: equipe.gradient_from || '#FFB700' }}>Ver Time</span>
                      <ChevronRight className="w-3 h-3" style={{ color: equipe.gradient_from || '#FFB700' }} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div
              className="relative p-[1px]"
              style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="text-center py-8 bg-[#09090c] flex flex-col items-center gap-4"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                <p className="text-zinc-400 text-sm font-medium">Você não está em nenhuma equipe no momento.</p>
                <button
                  onClick={() => navigate('/times')}
                  className="flex items-center gap-2 px-6 py-2.5 font-black text-sm uppercase tracking-widest transition-all bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(255,183,0,0.4)] cursor-pointer"
                  style={{ clipPath: CUT_BADGE }}
                >
                  Procurar Equipe
                </button>
              </div>
            </div>
          )}
        </CutCard>

        {/* E-mail de Acesso */}
        <div className="grid md:grid-cols-1 gap-8">
          <CutCard
            contentClassName="p-5 sm:p-8">
            <div className="flex items-center justify-between mb-8"><span className={LABEL_CLASS}>E-mail de Acesso</span><ShieldCheck className="w-5 h-5 text-primary/40" /></div>
            <div className="space-y-6">
              <div
                className="relative p-[1px]"
                style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#09090c] gap-3"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="w-5 h-5 text-primary/60 shrink-0" />
                    <span className="text-zinc-200 text-sm truncate font-mono">{user?.email}</span>
                  </div>
                  <div
                    className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-[9px] font-black text-green-400 self-start sm:self-auto shrink-0 uppercase tracking-wider"
                    style={{ clipPath: CUT_BADGE }}
                  >
                    Verificado
                  </div>
                </div>
              </div>
            </div>
          </CutCard>
        </div>

        {/* ELOS */}
        <div ref={sentinelRef} className="space-y-8">
          {loadingDadosPesados ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {eloSolo && <EloBlock elo={eloSolo} label="Ranqueada Solo/Duo" />}
              {eloFlex && <EloBlock elo={eloFlex} label="Ranqueada Flexível" />}
            </>
          )}
        </div>

        {/* REDES SOCIAIS */}
        <div className="grid md:grid-cols-1 gap-8">
          <CutCard contentClassName="p-5 sm:p-8 space-y-6">
            <div className="flex items-center justify-between"><span className={LABEL_CLASS}>Conexões Sociais</span></div>
            <div className="space-y-3">
              {[
                { icon: <FaInstagram className="w-5 h-5 text-zinc-400 shrink-0" />, key: 'instagram', placeholder: 'Link do Instagram', value: instagram, set: setInstagram },
                { icon: <FaTwitch className="w-5 h-5 text-zinc-400 shrink-0" />, key: 'twitch', placeholder: 'Ex: onelucks_', value: twitch, set: setTwitch },
                { icon: <FaYoutube className="w-5 h-5 text-zinc-400 shrink-0" />, key: 'youtube', placeholder: 'Link do YouTube', value: youtube, set: setYoutube },
                { icon: <FaDiscord className="w-5 h-5 text-zinc-400 shrink-0" />, key: 'discord', placeholder: 'Usuário (ex: nick#0000)', value: discord, set: setDiscord },
              ].map(({ icon, key, placeholder, value, set }) => (
                <div
                  key={key}
                  className="relative p-[1px]"
                  style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="flex items-center gap-4 bg-[#09090c] p-3 min-w-0"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    {icon}
                    <input
                      type="text"
                      value={value}
                      onChange={e => {
                        let v = e.target.value;
                        if (key === 'twitch') v = v.replace('https://www.twitch.tv/', '').replace('https://twitch.tv/', '').replace(/^@/, '').trim();
                        set(v);
                      }}
                      onBlur={() => salvarCampo({ [key]: value })}
                      placeholder={placeholder}
                      className="flex-1 bg-transparent px-0 py-1 text-zinc-100 text-sm focus:outline-none placeholder:text-zinc-600 min-w-0 font-medium"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CutCard>
        </div>

        {/* AÇÕES */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button onClick={() => navigate('/vincular')} className="group relative flex-1 cursor-pointer">
            <div className="absolute inset-0 bg-white/10 transition-colors group-hover:bg-white/25" style={{ clipPath: CUT_OUTER }} />
            <div className="absolute inset-0 bg-[#0A0A0A] transition-colors group-hover:bg-[#121212]" style={{ clipPath: CUT_INNER }} />
            <div className="relative flex items-center justify-center gap-3 py-4 text-[10px] font-black uppercase text-white"><LinkIcon className="w-4 h-4 text-primary" />Vincular Nova Conta</div>
          </button>
          <button onClick={handleSair} className="group relative flex-1 cursor-pointer">
            <div className="absolute inset-0 bg-red-500/20 transition-colors group-hover:bg-red-500/40" style={{ clipPath: CUT_OUTER }} />
            <div className="absolute inset-0 bg-[#0A0A0A] transition-colors group-hover:bg-[#151010]" style={{ clipPath: CUT_INNER }} />
            <div className="relative flex items-center justify-center gap-3 py-4 text-[10px] font-black uppercase text-red-400"><LogOut className="w-4 h-4" />Encerrar Sessão</div>
          </button>
        </div>
      </div>

      <ModalPix
        aberto={modalPixAberto}
        onFechar={() => setModalPixAberto(false)}
        onSalvar={handleSalvarPix}
        inicial={{ tipo: tipoChavePix, chave: chavePix, nome: nomePix }}
      />
    </div>
  );
}