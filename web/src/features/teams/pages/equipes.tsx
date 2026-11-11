// src/features/teams/pages/equipes.tsx
// ✅ VERSÃO OTIMIZADA - SEM time_membros na lista principal

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, ChevronRight, X,
  Plus, Search, Check, RefreshCw,
  Flame, TrendingUp, Trophy,
} from 'lucide-react';
import { useSound } from '../../../hooks/useSound';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { usePerfilSafe, usePerfil } from '../../../contexts/PerfilContext';
import { TeamCard } from '../components/TeamCard';
import { CreateTeamModal } from '../components/modals/CreateTeamModal';
import type { CreateTeamData, TeamBasico } from '../types';

const IS_DEV = import.meta.env.DEV;
const TEAMS_PAGE = 20;

// Polígonos Oficiais Cut-Edge
const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
const CUT_FRAME_INNER = 'polygon(13.8px 0, 100% 0, 100% calc(100% - 13.8px), calc(100% - 13.8px) 100%, 0 100%, 0 13.8px)';
const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';
const CUT_BUTTON_INNER = 'polygon(8.8px 0, 100% 0, 100% calc(100% - 8.8px), calc(100% - 8.8px) 100%, 0 100%, 0 8.8px)';
const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CUT_BADGE_INNER = 'polygon(5.8px 0, 100% 0, 100% calc(100% - 5.8px), calc(100% - 5.8px) 100%, 0 100%, 0 5.8px)';

// ✅ Função para carregar times com paginação e busca no banco
async function carregarTimesBasico(
  page = 0,
  limit = TEAMS_PAGE,
  search = '',
): Promise<{ teams: TeamBasico[]; total: number }> {
  // ✅ A API devolve o mesmo shape legado (nome, tag, logo_url,
  // gradient_from, ...), então o mapeamento abaixo não muda uma linha.
  const { teams: timesRaw, total } = await api.teams.list({
    page,
    limit,
    search: search.trim() || undefined,
    sort: 'pdl',
    dir: 'desc',
  });

  const teams: TeamBasico[] = timesRaw.map((t: any, index: number) => ({
    id: t.id,
    name: t.nome,
    tag: t.tag,
    logoUrl: t.logo_url ?? undefined,
    gradientFrom: t.gradient_from || '#FFB700',
    gradientTo: t.gradient_to || '#FF6600',
    pdl: t.pdl || 0,
    winrate: t.winrate || 0,
    ranking: index + 1 + (page * limit),
    wins: t.wins || 0,
    gamesPlayed: t.games_played || 0,
    donoId: t.dono_id,
  }));

  return { teams, total };
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────
export default function Equipes() {
  const { playSound } = useSound();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { perfil: perfilContext } = usePerfilSafe();
  const { myTeam, loading: loadingMyTeam, refetch: refetchMyTeam } = usePerfil();

  const [arenaTeams, setArenaTeams] = useState<TeamBasico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [modalCriar, setModalCriar] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const totalPages = Math.ceil(total / TEAMS_PAGE);
  const [popup, setPopup] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const hasRiot = !!perfilContext?.contaVinculada;

  // Se a navegação pediu abertura do modal de criação (ex: vinda do modal de inscrição)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.state?.openCreateModal || params.get('criar') === 'true') {
      if (user) {
        setModalCriar(true);
      } else {
        navigate('/login');
      }
    }
  }, [location, user, navigate]);

  // ── Scroll ao topo quando a página carrega ─────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Carregar times com paginação e busca no banco
  useEffect(() => {
    let active = true;
    setLoading(true);
    carregarTimesBasico(page, TEAMS_PAGE, searchDebounce).then(({ teams, total: t }) => {
      if (!active) return;
      setArenaTeams(teams);
      setTotal(t);
      setLoading(false);
    });
    return () => { active = false; };
  }, [page, searchDebounce]);

  // Debounce da busca (reseta para página 0)
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchDebounce(searchQuery);
      setPage(0);
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  const handleCreateTeam = async (newTeamData: CreateTeamData) => {
    if (!user) return;

    // ✅ A API cria o time, zera stats e já grava o criador como capitão numa
    // transação só (POST /api/teams). O cliente não insere mais time_membros
    // nem atualiza capitao_id — regra de negócio no servidor.
    let novoTime: any;
    try {
      novoTime = await api.teams.create({
        nome: newTeamData.name,
        tag: newTeamData.tag,
        logo_url: newTeamData.logoUrl ?? null,
        gradient_from: newTeamData.gradientFrom,
        gradient_to: newTeamData.gradientTo,
        whatsapp: newTeamData.whatsapp || null,
        discord: newTeamData.discord || null,
      });
    } catch (err: any) {
      playSound('click');
      // A API devolve mensagem específica para conflito de tag/unicidade
      const msg = err?.message || 'Erro ao criar time. Tente novamente.';
      setPopup({ type: 'error', msg });
      return;
    }

    if (newTeamData._logoFile) {
      // Envia o logo para /api/upload (disco local, ADR-007). O nome preserva o
      // padrão antigo (<timeId>-<timestamp>.ext) para não quebrar URLs antigas.
      const ext = newTeamData._logoFile.type === 'image/png' ? 'png' : 'jpg';
      const name = `${novoTime.id}-${Date.now()}.${ext}`;
      const file = new File([newTeamData._logoFile], name, { type: newTeamData._logoFile.type });
      try {
        const { url } = await api.upload(file, 'team-logos', novoTime.id);
        await api.teams.update(novoTime.id, { logo_url: url });
      } catch (err) {
        // logo é acessório; falha não deve impedir o time criado
        console.error('Falha ao enviar/atualizar logo do time:', err);
      }
    }

    await refetchMyTeam();
    setPage(0);
    setSearchQuery('');
    setSearchDebounce('');
    const { teams, total: t } = await carregarTimesBasico(0, TEAMS_PAGE);
    setArenaTeams(teams);
    setTotal(t);
    setPopup({ type: 'success', msg: `Time "${newTeamData.name}" criado com sucesso!` });
    playSound('success');
  };

  // Auto-dismiss popup
  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(null), 4000);
    return () => clearTimeout(t);
  }, [popup]);

  return (
    <div className="min-h-screen text-white p-4 md:p-8 font-sans">
      {/* Popup de erro/sucesso */}
      <AnimatePresence>
        {popup && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] p-[1px] shadow-2xl text-sm font-bold ${
              popup.type === 'error'
                ? 'bg-red-500/30'
                : 'bg-green-500/30'
            }`}
            style={{ clipPath: CUT_BADGE }}
          >
            <div
              className={`px-6 py-3 flex items-center gap-3 backdrop-blur-md ${
                popup.type === 'error'
                  ? 'bg-[#170a0c] text-red-300'
                  : 'bg-[#0a150e] text-green-300'
              }`}
              style={{ clipPath: CUT_BADGE_INNER }}
            >
              {popup.type === 'error' ? <X className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
              {popup.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox de Logo */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center cursor-zoom-out p-4"
          >
            <div
              className="p-[1.5px] rounded-2xl max-w-[min(480px,90vw)] max-h-[80vh] shadow-2xl overflow-hidden"
              style={{
                background: '#FFB700'
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] rounded-[14.5px] flex items-center justify-center overflow-hidden"
              >
                <motion.img
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  src={lightboxUrl}
                  alt="Logo do time"
                  className="max-w-full max-h-[75vh] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Banner Minha Equipe */}
        <div
          className="relative p-[1.5px] shadow-2xl overflow-hidden"
          style={{
            clipPath: CUT_FRAME,
            background: 'rgba(255,183,0,0.5)'
          }}
        >
          <div
            className="w-full bg-[#08080a] relative overflow-hidden"
            style={{ clipPath: CUT_FRAME_INNER }}
          >
            {/* Fundo com Imagem e Gradiente */}
            <div className="relative overflow-hidden p-6 md:p-8">
              <div className="absolute inset-0 z-0">
                <img src="/images/fundo fanaticaaa.webp" alt="Fundo" className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#08080a] via-[#08080a]/80 to-transparent" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Minha Equipe</span>
                  </div>
                  <h1 className="text-2xl md:text-4xl font-black text-white mb-2 uppercase tracking-tight">
                    Minha <span className="text-primary">Equipe</span>
                  </h1>
                  <p className="text-white/50 text-xs md:text-sm max-w-lg leading-relaxed">
                    Gerencie sua equipe, monte sua estratégia e lidere seus companheiros rumo à vitória.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card do meu time — card único, separado do banner */}
        <div>
          {loadingMyTeam ? (
            /* Skeleton do meu time */
            <div
              className="relative p-[1.5px]"
              style={{ clipPath: CUT_FRAME, background: 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="w-full bg-[#08080a] flex flex-col md:flex-row md:items-center gap-5 md:gap-6 px-5 md:px-7 py-5 md:py-6 animate-pulse"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <div className="flex items-center gap-4 md:block shrink-0">
                  <div className="w-20 h-20 md:w-28 md:h-28 bg-white/5 shrink-0 rounded-xl" />
                  <div className="md:hidden flex-1 space-y-2">
                    <div className="h-4 bg-white/5 w-32" />
                    <div className="h-3 bg-white/5 w-16" />
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="hidden md:block h-6 bg-white/5 w-48" />
                  <div className="flex gap-4 md:gap-6 mt-3 bg-white/[0.02] md:bg-transparent p-3 md:p-0 border border-white/5 md:border-none">
                    <div className="h-4 bg-white/5 w-12 flex-1 md:flex-initial" />
                    <div className="h-4 bg-white/5 w-12 flex-1 md:flex-initial" />
                    <div className="h-4 bg-white/5 w-12 flex-1 md:flex-initial" />
                  </div>
                </div>
                <div className="hidden md:flex shrink-0 flex-col items-center pl-8 pr-4 w-24 h-14 bg-white/5" />
              </div>
            </div>
          ) : myTeam ? (
                <motion.div
                  whileTap={{ scale: 0.998 }}
                  onClick={() => { playSound('click'); navigate(`/times/${myTeam.id}`); }}
                  className="relative p-[1.5px] shadow-2xl overflow-hidden cursor-pointer group/card"
                  style={{
                    clipPath: CUT_FRAME,
                    background: `linear-gradient(135deg, ${myTeam.gradientFrom}, ${myTeam.gradientTo})`
                  }}
                >
                  <div
                    className="w-full bg-[#08080a] flex flex-col md:flex-row md:items-center gap-5 md:gap-6 px-5 md:px-7 py-5 md:py-6 transition-colors hover:bg-[#0c0c10]"
                    style={{ clipPath: CUT_FRAME_INNER }}
                  >
                    {/* Logo + Nome/Tag no mobile, Apenas Logo no desktop */}
                    <div className="flex items-center gap-4 md:block shrink-0">
                      <div
                        className="w-20 h-20 md:w-28 md:h-28 p-[2px] flex items-center justify-center relative shrink-0 shadow-xl"
                        style={{
                          borderRadius: '12px',
                          background: myTeam.gradientFrom,
                          boxShadow: `0 10px 30px -8px ${myTeam.gradientFrom}70`
                        }}
                        onClick={myTeam.logo_url ? (e) => { e.stopPropagation(); setLightboxUrl(myTeam.logo_url!); } : undefined}
                      >
                        <div
                          className="w-full h-full bg-[#08080a] flex items-center justify-center overflow-hidden"
                          style={{ borderRadius: '10px' }}
                        >
                          {myTeam.logo_url ? (
                            <img src={myTeam.logo_url} loading="lazy" alt={myTeam.nome} className="w-full h-full object-cover cursor-zoom-in" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="font-black text-xl md:text-3xl tracking-widest" style={{ color: myTeam.gradientFrom }}>{myTeam.tag}</span>
                          )}
                        </div>
                      </div>

                      {/* Nome e Tag do time do lado do logo APENAS no mobile */}
                      <div className="md:hidden flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-white font-black text-base tracking-tight truncate uppercase">{myTeam.nome}</h3>
                          <div
                            className="p-[1px] shrink-0"
                            style={{
                              clipPath: CUT_BADGE,
                              background: `${myTeam.gradientFrom}80`
                            }}
                          >
                            <div
                              className="text-[8px] font-black px-1.5 py-0.5 tracking-wider bg-[#08080a]"
                              style={{
                                clipPath: CUT_BADGE_INNER,
                                color: myTeam.gradientFrom,
                              }}
                            >
                              #{myTeam.tag}
                            </div>
                          </div>

                          {/* Rota Icon no mobile ao lado do nome/tag */}
                          {(() => {
                            const ROLE_TO_LANE: Record<string, string> = {
                              TOP: 'Top_icon.png', JG: 'Jungle_icon.png', MID: 'Middle_icon.png',
                              ADC: 'Bottom_icon.png', SUP: 'Support_icon.png',
                            };
                            const roleFile = ROLE_TO_LANE[(myTeam.membro_role || '').toUpperCase()];
                            if (!roleFile) return null;
                            return (
                              <img
                                src={`/lanes/${roleFile}`}
                                alt={myTeam.membro_role}
                                className="w-5 h-5 object-contain ml-1 shrink-0"
                                style={{ filter: 'drop-shadow(0 0 6px rgba(255,184,0,0.3))' }}
                              />
                            );
                          })()}
                        </div>

                        {/* Rank no mobile */}
                        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: myTeam.gradientFrom }}>
                          RANK #{myTeam.ranking}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between md:h-28 py-0.5">
                      {/* Nome e Tag - Exibidos APENAS no desktop */}
                      <div className="hidden md:flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-black text-xl md:text-2xl tracking-tight truncate uppercase">{myTeam.nome}</h3>
                          <div
                            className="p-[1px] shrink-0"
                            style={{
                              clipPath: CUT_BADGE,
                              background: `${myTeam.gradientFrom}80`
                            }}
                          >
                            <div
                              className="text-[10px] font-black px-2.5 py-1 tracking-widest bg-[#08080a]"
                              style={{
                                clipPath: CUT_BADGE_INNER,
                                color: myTeam.gradientFrom,
                              }}
                            >
                              #{myTeam.tag}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stats em Linha */}
                      <div className="flex items-center justify-between md:justify-start gap-4 md:gap-8 w-full mt-2 bg-white/[0.02] md:bg-transparent p-2.5 md:p-0 border border-white/5 md:border-none rounded-lg">
                        <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Flame className="w-3 h-3" style={{ color: myTeam.gradientFrom }} />
                            <span className="text-[8px] text-white/40 uppercase font-black">PDL</span>
                          </div>
                          <span className="font-black text-xs md:text-base" style={{ color: myTeam.gradientFrom }}>{myTeam.pdl.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="w-px h-5 bg-white/10" />
                        <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
                          <div className="flex items-center gap-1 mb-0.5">
                            <TrendingUp className="w-3 h-3 text-green-400" />
                            <span className="text-[8px] text-white/40 uppercase font-black">WIN%</span>
                          </div>
                          <span className="font-black text-xs md:text-base text-green-400">{myTeam.winrate}%</span>
                        </div>
                        <div className="w-px h-5 bg-white/10" />
                        <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Trophy className="w-3 h-3 text-white/30" />
                            <span className="text-[8px] text-white/40 uppercase font-black">W/L</span>
                          </div>
                          <span className="font-black text-xs md:text-base text-white">{myTeam.wins}/{myTeam.gamesPlayed - myTeam.wins}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rota Icon (Antes do traço) - APENAS DESKTOP */}
                    {(() => {
                      const ROLE_TO_LANE: Record<string, string> = {
                        TOP: 'Top_icon.png', JG: 'Jungle_icon.png', MID: 'Middle_icon.png',
                        ADC: 'Bottom_icon.png', SUP: 'Support_icon.png',
                      };
                      const roleFile = ROLE_TO_LANE[(myTeam.membro_role || '').toUpperCase()];
                      if (!roleFile) return null;
                      return (
                        <div className="hidden md:flex shrink-0 items-center justify-center px-4">
                          <img
                            src={`/lanes/${roleFile}`}
                            alt={myTeam.membro_role}
                            className="w-12 h-12 object-contain"
                            style={{ filter: 'drop-shadow(0 0 10px rgba(255,184,0,0.3))' }}
                          />
                        </div>
                      );
                    })()}

                    {/* Rank e Gerenciar (Depois do traço) - APENAS DESKTOP */}
                    <div className="hidden md:flex shrink-0 flex-col items-center justify-center border-l border-white/5 pl-6 pr-2 h-20 gap-1.5">
                      <span className="text-xl font-black tracking-tighter uppercase" style={{ color: myTeam.gradientFrom }}>
                        RANK #{myTeam.ranking}
                      </span>
                      <div className="flex items-center gap-1 cursor-pointer">
                        <span className="font-bold text-[9px] uppercase tracking-[0.15em]" style={{ color: myTeam.gradientFrom }}>Gerenciar</span>
                        <ChevronRight className="w-3 h-3 transition-transform group-hover/card:translate-x-1" style={{ color: myTeam.gradientFrom }} />
                      </div>
                    </div>

                    {/* Link de ação exclusivo no mobile */}
                    <div className="md:hidden flex items-center justify-between border-t border-white/5 pt-2.5 mt-1 w-full">
                      <div className="flex items-center gap-1 cursor-pointer">
                        <span className="font-bold text-[10px] uppercase tracking-[0.15em]" style={{ color: myTeam.gradientFrom }}>Gerenciar equipe</span>
                        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/card:translate-x-1" style={{ color: myTeam.gradientFrom }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div
                  className="relative p-[1px]"
                  style={{
                    clipPath: CUT_BUTTON,
                    background: 'rgba(255,255,255,0.06)'
                  }}
                >
                  <div
                    className="w-full bg-[#0c0c10] text-center py-8 px-4 flex flex-col items-center gap-4"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">
                      {user ? "Você não está em nenhuma equipe no momento." : "Faça login para criar ou entrar em uma equipe."}
                    </p>
                    {!user ? (
                      <button 
                        onClick={() => {
                          playSound('click');
                          navigate('/login');
                        }} 
                        className="flex items-center gap-2 px-6 py-3 font-black text-xs uppercase tracking-widest transition-all bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_25px_-5px_rgba(255,183,0,0.5)] cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Criar Equipe</span>
                      </button>
                    ) : hasRiot ? (
                      <button 
                        onClick={() => setModalCriar(true)} 
                        className="flex items-center gap-2 px-6 py-3 font-black text-xs uppercase tracking-widest transition-all bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_25px_-5px_rgba(255,183,0,0.5)] cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Criar Equipe</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          playSound('click');
                          navigate('/vincular');
                        }}
                        className="flex items-center gap-2 px-6 py-3 font-black text-xs uppercase tracking-widest transition-all bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_25px_-5px_rgba(255,183,0,0.5)] cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        <span>Vincular Conta Riot para Criar Equipe</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
        </div>

        {/* Seção Arena de Times */}
        <div className="rounded-2xl border border-white/10 bg-[#08080a] shadow-2xl overflow-hidden">
          {/* Cabeçalho do card */}
          <div className="px-6 py-4 border-b border-white/5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Trophy className="w-5 h-5 text-primary shrink-0 mt-0.5 md:mt-1" />
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                  Arena de <span className="text-primary">Times</span>
                </h2>
                <p className="text-white/40 text-xs mt-1">Analise as equipes cadastradas e acompanhe seus rendimentos na liga.</p>
              </div>
            </div>

            {/* Barra de Busca */}
            <div
              className="relative w-full md:w-72 bg-[#0c0c10] border border-white/10 rounded-xl flex items-center px-3.5 py-2.5 gap-2.5 focus-within:border-white/25 transition-colors shrink-0"
            >
              <Search className="w-4 h-4 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar times..."
                className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-white/20 font-medium"
              />
            </div>
          </div>

          {/* Cabeçalho de colunas — só desktop */}
          <div className="hidden md:flex items-center gap-5 px-6 py-2 border-b border-white/5 bg-white/[0.015]">
            <div className="w-20 shrink-0" />
            <span className="flex-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/30">Time</span>
            <div className="flex items-stretch shrink-0">
              <span className="flex items-center w-[76px] pl-5 border-l border-white/5 text-[9px] font-black uppercase tracking-[0.14em] text-white/30">Win%</span>
              <span className="flex items-center w-[76px] pl-5 border-l border-white/5 text-[9px] font-black uppercase tracking-[0.14em] text-white/30">W/L</span>
              <span className="flex items-center w-[76px] pl-5 border-l border-white/5 text-[9px] font-black uppercase tracking-[0.14em] text-white/30">PDL</span>
            </div>
            <span className="flex items-center justify-center w-[200px] border-l border-white/5 text-[9px] font-black uppercase tracking-[0.14em] text-white/30">Rank</span>
          </div>

          {loading ? (
            /* Skeleton da lista de times */
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col md:flex-row md:items-center gap-4 md:gap-5 px-4 md:px-6 py-4 md:py-3 animate-pulse border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-4 md:block shrink-0">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white/5 shrink-0 rounded-[10px]" />
                    <div className="md:hidden flex-1 space-y-2">
                      <div className="h-4 bg-white/5 w-32" />
                      <div className="h-3 bg-white/5 w-16" />
                    </div>
                  </div>
                  <div className="hidden md:block flex-1 h-5 bg-white/5 max-w-[240px]" />
                  <div className="hidden md:flex items-stretch shrink-0">
                    <div className="w-[76px] pl-5 border-l border-white/5"><div className="h-3 w-10 bg-white/5" /></div>
                    <div className="w-[76px] pl-5 border-l border-white/5"><div className="h-3 w-10 bg-white/5" /></div>
                    <div className="w-[76px] pl-5 border-l border-white/5"><div className="h-3 w-10 bg-white/5" /></div>
                  </div>
                  <div className="hidden md:block w-[200px] pl-5 border-l border-white/5"><div className="h-4 w-24 bg-white/5" /></div>
                  <div className="md:hidden flex items-center justify-between gap-4 w-full mt-2 bg-white/[0.02] p-2.5 border border-white/5 rounded-lg">
                    <div className="h-4 bg-white/5 w-10 flex-1" />
                    <div className="h-4 bg-white/5 w-10 flex-1" />
                    <div className="h-4 bg-white/5 w-10 flex-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : arenaTeams.length > 0 ? (
            <>
              <div className="divide-y divide-white/5">
                {arenaTeams.map(team => <TeamCard key={team.id} team={team} onClick={(t) => navigate(`/times/${t.id}`)} onLogoClick={setLightboxUrl} />)}
              </div>

              {/* Paginação Cut-Edge */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-white/5">
                  <div
                    className={`p-[1px] ${page === 0 ? 'opacity-30 pointer-events-none' : 'bg-white/15 hover:bg-white/30'}`}
                    style={{ clipPath: CUT_BUTTON }}
                  >
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-4 py-2 bg-[#0c0c10] text-white/50 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors cursor-pointer"
                      style={{ clipPath: CUT_BUTTON_INNER }}
                    >
                      Anterior
                    </button>
                  </div>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <div
                      key={i}
                      className={`p-[1px] ${page === i ? 'bg-primary' : 'bg-white/15 hover:bg-white/30'}`}
                      style={{ clipPath: CUT_BADGE }}
                    >
                      <button
                        onClick={() => setPage(i)}
                        className={`w-8 h-8 font-black text-xs transition-all cursor-pointer ${
                          page === i
                            ? 'bg-primary text-black'
                            : 'bg-[#0c0c10] text-white/40 hover:text-white'
                        }`}
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        {i + 1}
                      </button>
                    </div>
                  ))}
                  <div
                    className={`p-[1px] ${page >= totalPages - 1 ? 'opacity-30 pointer-events-none' : 'bg-white/15 hover:bg-white/30'}`}
                    style={{ clipPath: CUT_BUTTON }}
                  >
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-4 py-2 bg-[#0c0c10] text-white/50 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors cursor-pointer"
                      style={{ clipPath: CUT_BUTTON_INNER }}
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <Search className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-white/40 font-bold text-sm">Nenhum time encontrado para "{searchQuery}"</p>
              <button onClick={() => setSearchQuery('')} className="mt-3 text-[10px] font-black uppercase tracking-widest text-primary hover:underline cursor-pointer">Limpar busca</button>
            </div>
          )}
        </div>

        <AnimatePresence>{modalCriar && <CreateTeamModal onClose={() => setModalCriar(false)} onCreate={handleCreateTeam} hasRiot={hasRiot} />}</AnimatePresence>
      </div>
    </div>
  );
}
