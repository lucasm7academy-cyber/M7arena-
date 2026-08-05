// src/pages/equipes.tsx
// ✅ VERSÃO OTIMIZADA - SEM time_membros na lista principal

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Crown, TrendingUp, Trophy, ChevronRight, X,
  Flame, Plus, Search, Check, Upload, RefreshCw,
} from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { useSound } from '../hooks/useSound';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePerfilSafe, usePerfil } from '../contexts/PerfilContext';

const IS_DEV = import.meta.env.DEV;
const TEAMS_PAGE = 20;

interface TeamBasico {
  id: string | number;
  name: string;
  tag: string;
  logoUrl?: string;
  gradientFrom: string;
  gradientTo: string;
  pdl: number;
  winrate: number;
  ranking: number;
  wins: number;
  gamesPlayed: number;
  donoId?: string;
}

// ✅ Função para carregar times com paginação e busca no banco
async function carregarTimesBasico(
  page = 0,
  limit = TEAMS_PAGE,
  search = '',
): Promise<{ teams: TeamBasico[]; total: number }> {
  // ✅ A API devolve o mesmo shape que o Supabase entregava (nome, tag, logo_url,
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

// ✅ Componente TimeCard (SEM membros) - Versão Lista Horizontal
const TimeCard = ({ team, onClick, onLogoClick }: {
  team: TeamBasico;
  onClick: (t: TeamBasico) => void;
  onLogoClick?: (url: string) => void;
}) => {
  const { playSound } = useSound();
  const { user } = useAuth();

  const isOwner = user && team.donoId === user.id;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => { playSound('click'); onClick(team); }}
      className="rounded-2xl cursor-pointer overflow-hidden group transition-all duration-500 bg-[rgba(13,13,13,1)] border border-white/5 hover:border-white/10"
    >
      <div className="rounded-[13px] overflow-hidden relative p-4 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        {/* Logo + Nome/Tag no mobile, Apenas Logo no desktop */}
        <div className="flex items-center gap-4 md:block shrink-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="w-16 h-16 md:w-24 md:h-24 rounded-xl flex items-center justify-center relative overflow-hidden shrink-0"
            style={{ border: `2px solid ${team.gradientFrom}`, background: 'black', boxShadow: `0 8px 24px -6px ${team.gradientFrom}60` }}
            onClick={team.logoUrl ? (e) => { e.stopPropagation(); onLogoClick?.(team.logoUrl!); } : undefined}
          >
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover cursor-zoom-in" referrerPolicy="no-referrer" loading="lazy" width={96} height={96} />
            ) : (
              <span className="font-black text-base md:text-xl tracking-widest" style={{ color: team.gradientFrom }}>{team.tag}</span>
            )}
          </motion.div>

          {/* Nome e Tag do time do lado do logo APENAS no mobile */}
          <div className="md:hidden flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isOwner && (
                <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: team.gradientFrom }} />
              )}
              <h3 className="text-white font-black text-base tracking-tight truncate uppercase">
                {team.name}
              </h3>
              <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded-md tracking-wider shrink-0"
                style={{ color: team.gradientFrom, background: `${team.gradientFrom}18`, border: `1px solid ${team.gradientFrom}40` }}>
                #{team.tag}
              </span>
            </div>
            
            {/* Rank pequeno no topo do mobile */}
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: team.gradientFrom }}>
              RANK #{team.ranking}
            </span>
          </div>
        </div>

        {/* Informações e Dados no Meio */}
        <div className="flex-1 min-w-0 flex flex-col justify-between md:h-24 py-1">
          {/* Nome e Tag - Exibidos APENAS no desktop */}
          <div className="hidden md:flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {isOwner && (
                <Crown className="w-4 h-4 shrink-0" style={{ color: team.gradientFrom }} />
              )}
              <h3 className="text-white font-black text-xl tracking-tight leading-tight truncate uppercase">
                {team.name}
              </h3>
              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-md tracking-widest shrink-0"
                style={{ color: team.gradientFrom, background: `${team.gradientFrom}18`, border: `1px solid ${team.gradientFrom}40` }}>
                #{team.tag}
              </span>
            </div>
          </div>

          {/* Stats em Linha */}
          <div className="flex items-center justify-between md:justify-start gap-4 md:gap-8 w-full mt-2 bg-white/[0.02] md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border border-white/5 md:border-none">
            <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
              <div className="flex items-center gap-1 mb-0.5">
                <Flame className="w-3 h-3" style={{ color: team.gradientFrom }} />
                <span className="text-[8px] text-white/30 uppercase font-black tracking-tighter">PDL</span>
              </div>
              <span className="font-black text-xs md:text-sm text-white">{team.pdl.toLocaleString('pt-BR')}</span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
              <div className="flex items-center gap-1 mb-0.5">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <span className="text-[8px] text-white/30 uppercase font-black tracking-tighter">WIN%</span>
              </div>
              <span className="font-black text-xs md:text-sm text-green-400">{team.winrate}%</span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
              <div className="flex items-center gap-1 mb-0.5">
                <Trophy className="w-3 h-3 text-white/20" />
                <span className="text-[8px] text-white/30 uppercase font-black tracking-tighter">W/L</span>
              </div>
              <span className="font-black text-xs md:text-sm text-white">{team.wins}/{team.gamesPlayed - team.wins}</span>
            </div>
          </div>
        </div>

        {/* Ranking e Link à Direita (Desktop) */}
        <div className="hidden md:flex shrink-0 flex-col items-center justify-center border-l border-white/5 pl-8 pr-4 h-20 gap-1">
          <span className="text-xl font-black tracking-tighter uppercase" style={{ color: team.gradientFrom }}>
            RANK #{team.ranking}
          </span>
          <div className="flex items-center gap-1 group/card cursor-pointer">
            <span className="font-bold text-[9px] uppercase tracking-[0.15em]" style={{ color: team.gradientFrom }}>Ver página</span>
            <ChevronRight className="w-3 h-3 transition-transform group-hover/card:translate-x-1" style={{ color: team.gradientFrom }} />
          </div>
        </div>

        {/* Link de ação exclusivo no mobile */}
        <div className="md:hidden flex items-center justify-between border-t border-white/5 pt-3 mt-1">
          <div className="flex items-center gap-1 group/card cursor-pointer">
            <span className="font-bold text-[10px] uppercase tracking-[0.15em]" style={{ color: team.gradientFrom }}>Ver página do time</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/card:translate-x-1" style={{ color: team.gradientFrom }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

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
  const [discordTag, setDiscordTag] = useState('');

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

  // Busca discord vinculado do usuário para pré-preencher no modal
  useEffect(() => {
    if (!user) return;
    api.profiles.getDiscord()
      .then((data) => { if (data?.discord_tag) setDiscordTag(data.discord_tag); })
      .catch((err) => console.error('❌ Erro ao buscar Discord:', err));
  }, [user]);

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

  const handleCreateTeam = async (newTeamData: any) => {
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
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border backdrop-blur-md text-sm font-bold ${
              popup.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-green-500/10 border-green-500/30 text-green-300'
            }`}
          >
            {popup.type === 'error' ? <X className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            {popup.msg}
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

      <div className="max-w-7xl mx-auto space-y-12">
        {/* Banner Minha Equipe */}
        <div className="space-y-0 rounded-3xl overflow-hidden backdrop-blur-xl transition-all duration-500">
          <div className="relative overflow-hidden p-6 group transition-all duration-500">
            <div className="absolute inset-0 z-0">
              <img src="/images/fundo fanaticaaa.png" alt="Fundo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-white/0" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-white/60" /><span className="text-xs font-bold uppercase text-white/60">Minha Equipe</span></div>
                <h1 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase italic">Minha <span className="text-primary">Equipe</span></h1>
                <p className="text-white/50 text-sm max-w-lg">Gerencie sua equipe e lidere seus companheiros rumo à vitória.</p>
              </div>
            </div>
          </div>
          
          <div className="py-6 px-0 backdrop-blur-md">
            {loadingMyTeam ? (
              /* Skeleton do meu time */
              <div className="rounded-2xl overflow-hidden bg-[rgba(13,13,13,1)] border border-white/5 p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 animate-pulse">
                  <div className="flex items-center gap-4 md:block shrink-0">
                    <div className="w-16 h-16 md:w-24 md:h-24 rounded-xl bg-white/5 shrink-0" />
                    <div className="md:hidden flex-1 space-y-2">
                      <div className="h-4 bg-white/5 rounded-md w-32" />
                      <div className="h-3 bg-white/5 rounded w-16" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="hidden md:block h-5 bg-white/5 rounded-lg w-40" />
                    <div className="flex gap-4 md:gap-6 mt-3 bg-white/[0.02] md:bg-transparent p-3 md:p-0 rounded-xl border border-white/5 md:border-none">
                      <div className="h-4 bg-white/5 rounded w-12 flex-1 md:flex-initial" />
                      <div className="h-4 bg-white/5 rounded w-12 flex-1 md:flex-initial" />
                      <div className="h-4 bg-white/5 rounded w-12 flex-1 md:flex-initial" />
                    </div>
                  </div>
                  <div className="hidden md:block shrink-0 w-12 h-12 bg-white/5" />
                  <div className="hidden md:flex shrink-0 flex-col items-center pl-8 pr-4 w-24 h-12 bg-white/5 rounded-xl" />
                </div>
              </div>
            ) : myTeam ? (
              <motion.div 
                whileTap={{ scale: 0.98 }}
                onClick={() => { playSound('click'); navigate(`/times/${myTeam.id}`); }}
                className="rounded-2xl overflow-hidden bg-[rgba(13,13,13,1)] border border-white/5 cursor-pointer hover:border-white/10 transition-all duration-300"
              >
                <div className="p-4 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                  {/* Logo + Nome/Tag no mobile, Apenas Logo no desktop */}
                  <div className="flex items-center gap-4 md:block shrink-0">
                    <div
                      className="w-16 h-16 md:w-24 md:h-24 rounded-xl flex items-center justify-center relative overflow-hidden"
                      style={{ border: `2px solid ${myTeam.gradientFrom}`, background: 'black', boxShadow: `0 8px 24px -6px ${myTeam.gradientFrom}60` }}
                      onClick={myTeam.logo_url ? () => setLightboxUrl(myTeam.logo_url) : undefined}
                    >
                      {myTeam.logo_url ? (
                        <img src={myTeam.logo_url} loading="lazy" alt={myTeam.nome} className="w-full h-full object-cover cursor-zoom-in" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="font-black text-base md:text-xl tracking-widest" style={{ color: myTeam.gradientFrom }}>{myTeam.tag}</span>
                      )}
                    </div>

                    {/* Nome e Tag do time do lado do logo APENAS no mobile */}
                    <div className="md:hidden flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-white font-black text-base tracking-tight truncate uppercase">{myTeam.nome}</h3>
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md" style={{ color: myTeam.gradientFrom, background: `${myTeam.gradientFrom}18`, border: `1px solid ${myTeam.gradientFrom}40` }}>
                          #{myTeam.tag}
                        </span>
                        
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
                  <div className="flex-1 min-w-0 flex flex-col justify-between md:h-24 py-1">
                    {/* Nome e Tag - Exibidos APENAS no desktop */}
                    <div className="hidden md:flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-black text-xl tracking-tight truncate uppercase">{myTeam.nome}</h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md" style={{ color: myTeam.gradientFrom, background: `${myTeam.gradientFrom}18`, border: `1px solid ${myTeam.gradientFrom}40` }}>
                          #{myTeam.tag}
                        </span>
                      </div>
                    </div>

                    {/* Stats em Linha */}
                    <div className="flex items-center justify-between md:justify-start gap-4 md:gap-8 w-full mt-2 bg-white/[0.02] md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border border-white/5 md:border-none">
                      <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
                        <div className="flex items-center gap-1 mb-0.5"><Flame className="w-3 h-3" style={{ color: myTeam.gradientFrom }} /><span className="text-[8px] text-white/30 uppercase font-black">PDL</span></div>
                        <span className="font-black text-xs md:text-sm" style={{ color: myTeam.gradientFrom }}>{myTeam.pdl.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="w-px h-6 bg-white/5" />
                      <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
                        <div className="flex items-center gap-1 mb-0.5"><TrendingUp className="w-3 h-3 text-green-400" /><span className="text-[8px] text-white/30 uppercase font-black">WIN%</span></div>
                        <span className="font-black text-xs md:text-sm text-green-400">{myTeam.winrate}%</span>
                      </div>
                      <div className="w-px h-6 bg-white/5" />
                      <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
                        <div className="flex items-center gap-1 mb-0.5"><Trophy className="w-3 h-3 text-white/20" /><span className="text-[8px] text-white/30 uppercase font-black">W/L</span></div>
                        <span className="font-black text-xs md:text-sm text-white">{myTeam.wins}/{myTeam.gamesPlayed - myTeam.wins}</span>
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
                      <div className="hidden md:flex shrink-0 items-center justify-center px-6">
                        <img
                          src={`/lanes/${roleFile}`}
                          alt={myTeam.membro_role}
                          className="w-12 h-12 object-contain"
                          style={{ filter: 'drop-shadow(0 0 12px rgba(255,184,0,0.3))' }}
                        />
                      </div>
                    );
                  })()}

                  {/* Rank e Gerenciar (Depois do traço) - APENAS DESKTOP */}
                  <div className="hidden md:flex shrink-0 flex-col items-center justify-center border-l border-white/5 pl-8 pr-4 h-20 gap-1">
                    <span className="text-xl font-black tracking-tighter uppercase" style={{ color: myTeam.gradientFrom }}>
                      RANK #{myTeam.ranking}
                    </span>
                    <div className="flex items-center gap-1 group/link">
                      <span className="font-bold text-[9px] uppercase tracking-[0.15em]" style={{ color: myTeam.gradientFrom }}>Gerenciar</span>
                      <ChevronRight className="w-3 h-3 transition-transform group-hover/link:translate-x-1" style={{ color: myTeam.gradientFrom }} />
                    </div>
                  </div>

                  {/* Link de ação exclusivo no mobile */}
                  <div className="md:hidden flex items-center justify-between border-t border-white/5 pt-3 mt-1 w-full">
                    <div className="flex items-center gap-1 group/link cursor-pointer">
                      <span className="font-bold text-[10px] uppercase tracking-[0.15em]" style={{ color: myTeam.gradientFrom }}>Gerenciar equipe</span>
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1" style={{ color: myTeam.gradientFrom }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-8 bg-black/[0.1] rounded-2xl border border-dashed border-white/5 flex flex-col items-center gap-4">
                <p className="text-white/40 text-sm font-medium">
                  {user ? "Você não está em nenhuma equipe no momento." : "Faça login para criar ou entrar em uma equipe."}
                </p>
                {!user ? (
                  <button 
                    onClick={() => {
                      playSound('click');
                      navigate('/login');
                    }} 
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(255,183,0,0.4)]"
                  >
                    Criar Equipe
                  </button>
                ) : hasRiot ? (
                  <button 
                    onClick={() => setModalCriar(true)} 
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(255,183,0,0.4)]"
                  >
                    Criar Equipe
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      playSound('click');
                      navigate('/vincular');
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(255,183,0,0.4)]"
                  >
                    Vincular Conta Riot para Criar Equipe
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="py-6 px-0 border-t border-white/5 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase italic">Arena de <span className="text-primary">Times</span></h2>
                <p className="text-white/50 text-sm max-w-lg mt-1">Analise os times da comunidade e veja suas estatísticas.</p>
              </div>
              <div className="w-full md:w-64 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl flex items-center px-4 py-2.5 gap-3 focus-within:border-white/30">
                <Search className="w-4 h-4 text-white/30" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar times..." className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-white/20" />
              </div>
            </div>
            {loading ? (
              /* Skeleton da lista de times */
              <div className="grid grid-cols-1 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-[rgba(13,13,13,1)] border border-white/5 p-4 animate-pulse">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                      <div className="flex items-center gap-4 md:block shrink-0">
                        <div className="w-16 h-16 md:w-24 md:h-24 rounded-xl bg-white/5 shrink-0" />
                        <div className="md:hidden flex-1 space-y-2">
                          <div className="h-4 bg-white/5 rounded-md w-32" />
                          <div className="h-3 bg-white/5 rounded w-16" />
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="hidden md:block h-5 bg-white/5 rounded-lg w-40" />
                        <div className="flex gap-4 md:gap-6 mt-3 bg-white/[0.02] md:bg-transparent p-3 md:p-0 rounded-xl border border-white/5 md:border-none">
                          <div className="h-4 bg-white/5 rounded w-12 flex-1 md:flex-initial" />
                          <div className="h-4 bg-white/5 rounded w-12 flex-1 md:flex-initial" />
                          <div className="h-4 bg-white/5 rounded w-12 flex-1 md:flex-initial" />
                        </div>
                      </div>
                      <div className="hidden md:flex shrink-0 flex-col items-center pl-8 pr-4 w-24 h-12 bg-white/5 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : arenaTeams.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-4">
                  {arenaTeams.map(team => <TimeCard key={team.id} team={team} onClick={(t) => navigate(`/times/${t.id}`)} onLogoClick={setLightboxUrl} />)}
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-4 py-2 rounded-lg border border-white/10 text-white/50 font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      Anterior
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`w-9 h-9 rounded-lg font-black text-xs transition-all ${
                          page === i
                            ? 'bg-primary text-black'
                            : 'border border-white/10 text-white/40 hover:bg-white/5'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-4 py-2 rounded-lg border border-white/10 text-white/50 font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      Próximo
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white/[0.02] border border-dashed border-white/5 rounded-2xl p-16 text-center mx-6">
                <Search className="w-14 h-14 text-white/5 mx-auto mb-4" />
                <p className="text-white/30 font-medium text-lg">Nenhum time encontrado para "{searchQuery}"</p>
                <button onClick={() => setSearchQuery('')} className="mt-4 text-xs font-bold uppercase tracking-widest text-primary hover:underline">Limpar busca</button>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>{modalCriar && <CreateTeamModal onClose={() => setModalCriar(false)} onCreate={handleCreateTeam} hasRiot={hasRiot} discordPrefill={discordTag} />}</AnimatePresence>
      </div>
    </div>
  );
}

// ── Modal Criar Time (simplificado) ───────────────────────────────────────
const COLOR_THEMES = [
  { from: '#FFB700', to: '#FF6600', label: 'Gold' },
  { from: '#0044FF', to: '#00D4FF', label: 'Neon Blue' },
  { from: '#FF3300', to: '#FF9900', label: 'Fire' },
  { from: '#00FF88', to: '#00C3FF', label: 'Toxic Green' },
  { from: '#7B00FF', to: '#00AAFF', label: 'Storm Purple' },
  { from: '#FF00B8', to: '#7000FF', label: 'Pink' },
  { from: '#0cebeb', to: '#29ffc6', label: 'Aurora' },
  { from: '#f5af19', to: '#f12711', label: 'Sunrise' },
  { from: '#11998E', to: '#38EF7D', label: 'Emerald' },
  { from: '#00FF41', to: '#00A32A', label: 'Matrix Green' },
];

const compressImageFile = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpeg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const CreateTeamModal = ({ onClose, onCreate, hasRiot, discordPrefill = '' }: any) => {
  const { playSound } = useSound();
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [theme, setTheme] = useState({ from: COLOR_THEMES[0].from, to: COLOR_THEMES[0].to });
  const [logoPreview, setLogoPreview] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [discord, setDiscord] = useState(discordPrefill);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError('');
    if (!file.type.includes('image')) { setLogoError('Apenas imagens PNG ou JPEG'); return; }
    playSound('click');
    try {
      const compressedFile = await compressImageFile(file, 400, 400, 0.7);
      setLogoFile(compressedFile);
      setLogoPreview(URL.createObjectURL(compressedFile));
    } catch (err) {
      console.error('Error compressing logo:', err);
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleCreate = (): void => {
    if (!name || tag.length < 3 || !hasRiot || !whatsapp || !discord) return;
    playSound('success');
    onCreate({
      name,
      tag: tag.toUpperCase().slice(0, 3),
      gradientFrom: theme.from,
      gradientTo: theme.to,
      logoUrl: logoPreview || undefined,
      _logoFile: logoFile,
      whatsapp: whatsapp.replace(/\D/g, ''), // Remove caracteres não numéricos
      discord: discord
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-start justify-center p-4 bg-transparent overflow-y-auto" style={{ paddingTop: '100px' }} onClick={onClose}>
      <div className="relative w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="rounded-2xl overflow-hidden relative bg-black border border-white/10 shadow-2xl shadow-black/80">
          <div className="relative z-10">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${theme.from}25` }}>
                  <Plus className="w-4 h-4" style={{ color: theme.from }} />
                </div>
                <h2 className="text-white font-black text-lg">Monte sua Equipe</h2>
              </div>
              <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div><label className="text-white/40 text-xs uppercase tracking-widest">Nome do Time</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: M7 Esports" maxLength={24}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div><label className="text-white/40 text-xs uppercase tracking-widest">Tag (3 letras)</label>
                <input value={tag} onChange={e => setTag(e.target.value.toUpperCase().slice(0, 3))} placeholder="Ex: M7E" maxLength={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold tracking-widest focus:outline-none focus:border-white/30" />
                <p className="text-white/25 text-[10px] mt-1">Sua tag aparece em rankings, campeonatos e no Hall da Fama.</p>
              </div>
              <div><label className="text-white/40 text-xs uppercase tracking-widest">Logo do Time</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center relative overflow-hidden shrink-0" style={{ border: `2px solid ${theme.from}` }}>
                    {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Upload className="w-6 h-6 text-white/30" />}
                  </div>
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoUpload} />
                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed transition-all cursor-pointer" style={{ borderColor: `${theme.from}50`, background: `${theme.from}10`, color: theme.from }}>
                      <Upload className="w-4 h-4" /><span className="text-sm font-medium">Enviar Logo</span>
                    </div>
                  </label>
                </div>
                {logoError && <p className="text-red-400 text-[11px] mt-1">{logoError}</p>}
              </div>
              <div><label className="text-white/40 text-xs uppercase tracking-widest">Tema de Cor</label>
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_THEMES.map(t => (
                    <button key={t.label} onClick={() => setTheme({ from: t.from, to: t.to })}
                      className="relative h-10 rounded-xl overflow-hidden border-2 transition-all"
                      style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, borderColor: theme.from === t.from ? 'white' : 'transparent' }}>
                      {theme.from === t.from && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Check className="w-4 h-4 text-white" /></div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── CONTATO ── */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-3">Contato do Responsável</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-white/40 text-xs uppercase tracking-widest">WhatsApp</label>
                    <input
                      value={whatsapp}
                      onChange={e => setWhatsapp(e.target.value)}
                      placeholder="Ex: (11) 99999-9999"
                      type="tel"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30"
                    />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs uppercase tracking-widest flex items-center gap-1.5">
                      <FaDiscord className="w-3.5 h-3.5 text-[#5865F2]" /> Discord
                    </label>
                    <input
                      value={discord}
                      onChange={e => setDiscord(e.target.value)}
                      placeholder="Ex: usuario#1234"
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#5865F2]/50"
                    />
                  </div>
                </div>
              </div>

              <button onClick={handleCreate} disabled={!name || tag.length < 3 || !hasRiot || !whatsapp || !discord}
                className="w-full py-4 rounded-xl font-black text-white uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})`, boxShadow: `0 10px 20px -5px ${theme.from}50` }}>
                Criar Equipe
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
