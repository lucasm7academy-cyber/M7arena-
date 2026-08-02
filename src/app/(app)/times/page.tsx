'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Crown, TrendingUp, Trophy, ChevronRight, X,
  Flame, Plus, Search, Check, Upload, RefreshCw,
} from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { usePerfil } from '@/contexts/PerfilContext';

const TEAMS_PAGE = 20;

interface TeamBasico {
  id: string;
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
  membro_role?: string;
}

// ── Componente TimeCard (SEM membros) - Versão Lista Horizontal ────────────
const TimeCard = ({ team, onClick, onLogoClick }: {
  team: TeamBasico;
  onClick: (t: TeamBasico) => void;
  onLogoClick?: (url: string) => void;
}) => {
  const { perfil } = usePerfil();
  const isOwner = perfil && team.donoId === perfil.id;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(team)}
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
              <span className="font-black text-base md:text-xl tracking-widest font-headline" style={{ color: team.gradientFrom }}>{team.tag}</span>
            )}
          </motion.div>

          {/* Nome e Tag do time do lado do logo APENAS no mobile */}
          <div className="md:hidden flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isOwner && (
                <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: team.gradientFrom }} />
              )}
              <h3 className="text-white font-black text-base tracking-tight truncate uppercase font-headline">
                {team.name}
              </h3>
              <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded-md tracking-wider shrink-0 font-headline"
                style={{ color: team.gradientFrom, background: `${team.gradientFrom}18`, border: `1px solid ${team.gradientFrom}40` }}>
                #{team.tag}
              </span>
            </div>
            
            <span className="text-[10px] font-black uppercase tracking-wider font-headline" style={{ color: team.gradientFrom }}>
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
              <h3 className="text-white font-black text-xl tracking-tight leading-tight truncate uppercase font-headline">
                {team.name}
              </h3>
              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-md tracking-widest shrink-0 font-headline"
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
              <span className="font-black text-xs md:text-sm text-white font-headline">{team.pdl.toLocaleString('pt-BR')}</span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
              <div className="flex items-center gap-1 mb-0.5">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <span className="text-[8px] text-white/30 uppercase font-black tracking-tighter">WIN%</span>
              </div>
              <span className="font-black text-xs md:text-sm text-green-400 font-headline">{team.winrate}%</span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
              <div className="flex items-center gap-1 mb-0.5">
                <Trophy className="w-3 h-3 text-white/20" />
                <span className="text-[8px] text-white/30 uppercase font-black tracking-tighter">W/L</span>
              </div>
              <span className="font-black text-xs md:text-sm text-white font-headline">{team.wins}/{team.gamesPlayed - team.wins}</span>
            </div>
          </div>
        </div>

        {/* Ranking e Link à Direita (Desktop) */}
        <div className="hidden md:flex shrink-0 flex-col items-center justify-center border-l border-white/5 pl-8 pr-4 h-20 gap-1">
          <span className="text-xl font-black tracking-tighter uppercase font-headline" style={{ color: team.gradientFrom }}>
            RANK #{team.ranking}
          </span>
          <div className="flex items-center gap-1 group/card cursor-pointer">
            <span className="font-bold text-[9px] uppercase tracking-[0.15em] font-headline" style={{ color: team.gradientFrom }}>Ver página</span>
            <ChevronRight className="w-3 h-3 transition-transform group-hover/card:translate-x-1" style={{ color: team.gradientFrom }} />
          </div>
        </div>

        {/* Link de ação exclusivo no mobile */}
        <div className="md:hidden flex items-center justify-between border-t border-white/5 pt-3 mt-1">
          <div className="flex items-center gap-1 group/card cursor-pointer">
            <span className="font-bold text-[10px] uppercase tracking-[0.15em] font-headline" style={{ color: team.gradientFrom }}>Ver página do time</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/card:translate-x-1" style={{ color: team.gradientFrom }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────
export default function TimesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
      <TimesPageContent />
    </Suspense>
  );
}

function TimesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { perfil, refetchPerfil } = usePerfil();

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

  const myTeam = perfil?.meuTime || null;
  const hasRiot = !!(perfil?.gameAccounts && perfil.gameAccounts.length > 0);

  useEffect(() => {
    if (searchParams.get('criar') === 'true') {
      if (perfil) {
        setModalCriar(true);
      } else {
        router.push('/api/auth/signin');
      }
    }
  }, [searchParams, perfil, router]);

  useEffect(() => {
    if (perfil?.discord) {
      setDiscordTag(perfil.discord);
    }
  }, [perfil]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const fetchTimes = async (p = 0, q = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/times?page=${p}&limit=${TEAMS_PAGE}&q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setArenaTeams(data.teams || []);
        setTotal(data.total || 0);
      } else {
        setArenaTeams([]);
        setTotal(0);
      }
    } catch {
      setArenaTeams([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimes(page, searchDebounce);
  }, [page, searchDebounce]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchDebounce(searchQuery);
      setPage(0);
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  const handleCreateTeam = async (newTeamData: any) => {
    if (!perfil) return;

    try {
      const res = await fetch('/api/times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeamData),
      });

      if (!res.ok) {
        const err = await res.json();
        setPopup({ type: 'error', msg: err.message || 'Erro ao criar time. Tente novamente.' });
        return;
      }

      await refetchPerfil();
      setPage(0);
      setSearchQuery('');
      setSearchDebounce('');
      fetchTimes(0, '');
      setPopup({ type: 'success', msg: `Time "${newTeamData.name}" criado com sucesso!` });
    } catch {
      setPopup({ type: 'error', msg: 'Erro ao criar time. Tente novamente.' });
    }
  };

  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(null), 4000);
    return () => clearTimeout(t);
  }, [popup]);

  return (
    <div className="min-h-screen text-white p-4 md:p-8 font-sans">
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
                <h1 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase italic font-headline">Minha <span className="text-primary">Equipe</span></h1>
                <p className="text-white/50 text-sm max-w-lg">Gerencie sua equipe e lidere seus companheiros rumo à vitória.</p>
              </div>
            </div>
          </div>
          
          <div className="py-6 px-0 backdrop-blur-md">
            {myTeam ? (
              <motion.div 
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/times/${myTeam.id}`)}
                className="rounded-2xl overflow-hidden bg-[rgba(13,13,13,1)] border border-white/5 cursor-pointer hover:border-white/10 transition-all duration-300"
              >
                <div className="p-4 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                  <div className="flex items-center gap-4 md:block shrink-0">
                    <div
                      className="w-16 h-16 md:w-24 md:h-24 rounded-xl flex items-center justify-center relative overflow-hidden"
                      style={{ border: `2px solid ${myTeam.gradientFrom || '#FFB700'}`, background: 'black', boxShadow: `0 8px 24px -6px ${myTeam.gradientFrom || '#FFB700'}60` }}
                      onClick={myTeam.logoUrl ? () => setLightboxUrl(myTeam.logoUrl) : undefined}
                    >
                      {myTeam.logoUrl ? (
                        <img src={myTeam.logoUrl} alt={myTeam.nome} className="w-full h-full object-cover cursor-zoom-in" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="font-black text-base md:text-xl tracking-widest font-headline" style={{ color: myTeam.gradientFrom || '#FFB700' }}>{myTeam.tag}</span>
                      )}
                    </div>

                    <div className="md:hidden flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-white font-black text-base tracking-tight truncate uppercase font-headline">{myTeam.nome}</h3>
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md font-headline" style={{ color: myTeam.gradientFrom || '#FFB700', background: `${myTeam.gradientFrom || '#FFB700'}18`, border: `1px solid ${myTeam.gradientFrom || '#FFB700'}40` }}>
                          #{myTeam.tag}
                        </span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider font-headline" style={{ color: myTeam.gradientFrom || '#FFB700' }}>
                        RANK #{myTeam.ranking || 1}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between md:h-24 py-1">
                    <div className="hidden md:flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-black text-xl tracking-tight truncate uppercase font-headline">{myTeam.nome}</h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md font-headline" style={{ color: myTeam.gradientFrom || '#FFB700', background: `${myTeam.gradientFrom || '#FFB700'}18`, border: `1px solid ${myTeam.gradientFrom || '#FFB700'}40` }}>
                          #{myTeam.tag}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-start gap-4 md:gap-8 w-full mt-2 bg-white/[0.02] md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border border-white/5 md:border-none">
                      <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
                        <div className="flex items-center gap-1 mb-0.5"><Flame className="w-3 h-3" style={{ color: myTeam.gradientFrom || '#FFB700' }} /><span className="text-[8px] text-white/30 uppercase font-black">PDL</span></div>
                        <span className="font-black text-xs md:text-sm font-headline" style={{ color: myTeam.gradientFrom || '#FFB700' }}>{myTeam.pdl.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="w-px h-6 bg-white/5" />
                      <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
                        <div className="flex items-center gap-1 mb-0.5"><TrendingUp className="w-3 h-3 text-green-400" /><span className="text-[8px] text-white/30 uppercase font-black">WIN%</span></div>
                        <span className="font-black text-xs md:text-sm text-green-400 font-headline">{myTeam.winrate}%</span>
                      </div>
                      <div className="w-px h-6 bg-white/5" />
                      <div className="flex flex-col items-center md:items-start flex-1 md:flex-initial">
                        <div className="flex items-center gap-1 mb-0.5"><Trophy className="w-3 h-3 text-white/20" /><span className="text-[8px] text-white/30 uppercase font-black">W/L</span></div>
                        <span className="font-black text-xs md:text-sm text-white font-headline">{myTeam.wins}/{myTeam.gamesPlayed - myTeam.wins}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex shrink-0 flex-col items-center justify-center border-l border-white/5 pl-8 pr-4 h-20 gap-1">
                    <span className="text-xl font-black tracking-tighter uppercase font-headline" style={{ color: myTeam.gradientFrom || '#FFB700' }}>
                      RANK #{myTeam.ranking || 1}
                    </span>
                    <div className="flex items-center gap-1 group/link">
                      <span className="font-bold text-[9px] uppercase tracking-[0.15em] font-headline" style={{ color: myTeam.gradientFrom || '#FFB700' }}>Gerenciar</span>
                      <ChevronRight className="w-3 h-3 transition-transform group-hover/link:translate-x-1" style={{ color: myTeam.gradientFrom || '#FFB700' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-8 bg-black/[0.1] rounded-2xl border border-dashed border-white/5 flex flex-col items-center gap-4">
                <p className="text-white/40 text-sm font-medium">
                  {perfil ? "Você não está em nenhuma equipe no momento." : "Faça login para criar ou entrar em uma equipe."}
                </p>
                {!perfil ? (
                  <button 
                    onClick={() => router.push('/api/auth/signin')} 
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(255,183,0,0.4)] font-headline cursor-pointer"
                  >
                    Criar Equipe
                  </button>
                ) : hasRiot ? (
                  <button 
                    onClick={() => setModalCriar(true)} 
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(255,183,0,0.4)] font-headline cursor-pointer"
                  >
                    Criar Equipe
                  </button>
                ) : (
                  <button 
                    onClick={() => router.push('/vincular')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all bg-primary text-black hover:scale-105 active:scale-95 shadow-[0_0_20px_-5px_rgba(255,183,0,0.4)] font-headline cursor-pointer"
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
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase italic font-headline">Arena de <span className="text-primary">Times</span></h2>
                <p className="text-white/50 text-sm max-w-lg mt-1">Analise os times da comunidade e veja suas estatísticas.</p>
              </div>
              <div className="w-full md:w-64 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl flex items-center px-4 py-2.5 gap-3 focus-within:border-white/30">
                <Search className="w-4 h-4 text-white/30" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar times..." className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-white/20" />
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-[rgba(13,13,13,1)] border border-white/5 p-4 animate-pulse">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                      <div className="w-16 h-16 md:w-24 md:h-24 rounded-xl bg-white/5 shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-white/5 rounded-lg w-40" />
                        <div className="h-4 bg-white/5 rounded w-24" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : arenaTeams.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-4">
                  {arenaTeams.map((team) => (
                    <TimeCard key={team.id} team={team} onClick={(t) => router.push(`/times/${t.id}`)} onLogoClick={setLightboxUrl} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-4 py-2 rounded-lg border border-white/10 text-white/50 font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-30 disabled:pointer-events-none font-headline cursor-pointer"
                    >
                      Anterior
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`w-9 h-9 rounded-lg font-black text-xs transition-all font-headline cursor-pointer ${
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
                      className="px-4 py-2 rounded-lg border border-white/10 text-white/50 font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-30 disabled:pointer-events-none font-headline cursor-pointer"
                    >
                      Próximo
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white/[0.02] border border-dashed border-white/5 rounded-2xl p-16 text-center mx-6">
                <Search className="w-14 h-14 text-white/5 mx-auto mb-4" />
                <p className="text-white/30 font-medium text-lg font-headline">Nenhum time encontrado para "{searchQuery}"</p>
                <button onClick={() => setSearchQuery('')} className="mt-4 text-xs font-bold uppercase tracking-widest text-primary hover:underline font-headline cursor-pointer">Limpar busca</button>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>{modalCriar && <CreateTeamModal onClose={() => setModalCriar(false)} onCreate={handleCreateTeam} hasRiot={hasRiot} discordPrefill={discordTag} />}</AnimatePresence>
      </div>
    </div>
  );
}

// ── Modal Criar Time ───────────────────────────────────────────────────────
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
    onCreate({
      name,
      tag: tag.toUpperCase().slice(0, 3),
      gradientFrom: theme.from,
      gradientTo: theme.to,
      logoUrl: logoPreview || undefined,
      _logoFile: logoFile,
      whatsapp: whatsapp.replace(/\D/g, ''),
      discord: discord,
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
                <h2 className="text-white font-black text-lg font-headline">Criar Equipe</h2>
              </div>
              <button onClick={onClose} className="text-white/30 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div><label className="text-white/40 text-xs uppercase tracking-widest font-headline">Nome do Time</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: M7 Esports" maxLength={24}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div><label className="text-white/40 text-xs uppercase tracking-widest font-headline">Tag (3 letras)</label>
                <input value={tag} onChange={e => setTag(e.target.value.toUpperCase().slice(0, 3))} placeholder="Ex: M7E" maxLength={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold tracking-widest focus:outline-none focus:border-white/30" />
              </div>
              <div><label className="text-white/40 text-xs uppercase tracking-widest font-headline">Logo do Time</label>
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
              <div><label className="text-white/40 text-xs uppercase tracking-widest font-headline">Tema de Cor</label>
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_THEMES.map(t => (
                    <button key={t.label} onClick={() => setTheme({ from: t.from, to: t.to })}
                      className="relative h-10 rounded-xl overflow-hidden border-2 transition-all cursor-pointer"
                      style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, borderColor: theme.from === t.from ? 'white' : 'transparent' }}>
                      {theme.from === t.from && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Check className="w-4 h-4 text-white" /></div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* CONTATO */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-3 font-headline">Contato do Responsável</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-white/40 text-xs uppercase tracking-widest font-headline">WhatsApp</label>
                    <input
                      value={whatsapp}
                      onChange={e => setWhatsapp(e.target.value)}
                      placeholder="Ex: (11) 99999-9999"
                      type="tel"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30"
                    />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs uppercase tracking-widest flex items-center gap-1.5 font-headline">
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
                className="w-full py-4 rounded-xl font-black text-white uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 font-headline cursor-pointer"
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
