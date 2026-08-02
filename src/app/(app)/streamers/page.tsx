'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ExternalLink, Play, StopCircle, Copy, Check, Loader, Tv2 } from 'lucide-react';
import { FaTwitch } from 'react-icons/fa';
import { usePerfil } from '@/contexts/PerfilContext';
import { ToastContainer, type ToastItem } from '@/components/Toast';

interface TwitchLiveStream {
  id: string;
  user_id: string;
  twitch_channel: string;
  stream_title?: string;
  viewer_count: number;
  thumbnail_url: string;
  ao_vivo: boolean;
  updated_at: string;
}

interface TeamInfo {
  id: string;
  nome: string;
  tag: string;
  logo_url?: string;
}

interface StreamCard extends TwitchLiveStream {
  team?: TeamInfo;
  profile?: { nome: string };
}

// ── Card de Highlight (clipe da comunidade) ───────────────────────────────────
interface HighlightCardProps {
  titulo: string;
  thumbnail: string | null;
  link: string;
  categoria: string;
}

function HighlightCardLives({ titulo, thumbnail, link, categoria }: HighlightCardProps) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative bg-[#0a0a0a] border-2 border-[#9146FF]/20 rounded-2xl hover:border-[#9146FF] transition-all duration-500 overflow-hidden shadow-2xl flex flex-col"
    >
      <div className="relative w-full aspect-video overflow-hidden bg-black">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tv2 className="w-12 h-12 text-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-2 bg-[#9146FF] rounded text-[8px] font-black uppercase tracking-widest text-white">
          ★ {categoria === 'clutch' ? 'Clutch' : categoria === 'jogada' ? 'Jogada' : categoria === 'engracado' ? 'Engraçado' : categoria === 'top5' ? 'Top 5' : categoria === 'compilacao' ? 'Compilação' : categoria === 'semana' ? 'Destaques' : 'Highlight'}
        </div>
      </div>
      <div className="w-full px-4 py-3 flex-1">
        <p className="text-sm font-bold text-white line-clamp-2 leading-tight">{titulo}</p>
      </div>
      <div className="w-full bg-[#9146FF] py-5 flex items-center justify-center border-t border-black/5">
        <span className="text-[14px] font-black uppercase tracking-[0.4em] text-white">Assistir Agora!</span>
      </div>
    </a>
  );
}

export default function StreamersPage() {
  const router = useRouter();
  const { perfil } = usePerfil();

  const [streams, setStreams] = useState<StreamCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStream, setUserStream] = useState<any | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // ✅ Estados para transmissão ao vivo
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('3'); // Default 3 Horas
  const [transmissionMode, setTransmissionMode] = useState<'padrao' | 'amistoso' | 'campeonato'>('padrao');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedCampeonato, setSelectedCampeonato] = useState('');
  const [availableTimes, setAvailableTimes] = useState<any[]>([]);
  const [availableCampeonatos, setAvailableCampeonatos] = useState<any[]>([]);

  // ✅ Highlights (clipes da comunidade)
  const [highlights, setHighlights] = useState<Array<{ id: string; titulo: string; link: string; thumbnail_url: string | null; categoria: string }>>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(true);

  // ✅ Guard: carregar apenas UMA vez ao entrar na página
  const hasLoadedRef = useRef(false);

  const user = perfil ? { id: perfil.id } : null;

  // ── BUSCAR TIMES DISPONÍVEIS ──────────────────────────────────────────
  const fetchTimes = useCallback(async () => {
    try {
      const res = await fetch('/api/times');
      if (res.ok) {
        const data = await res.json();
        setAvailableTimes(data.times || []);
      }
    } catch (err) {
      console.error('❌ Erro ao buscar times:', err);
      setAvailableTimes([]);
    }
  }, []);

  // ── BUSCAR CAMPEONATOS DISPONÍVEIS ────────────────────────────────────
  const fetchCampeonatos = useCallback(async () => {
    try {
      const res = await fetch('/api/campeonatos');
      if (res.ok) {
        const data = await res.json();
        setAvailableCampeonatos(data.campeonatos || []);
      }
    } catch (err) {
      console.error('❌ Erro ao buscar campeonatos:', err);
      setAvailableCampeonatos([]);
    }
  }, []);

  // ── BUSCAR LIVE DO USUÁRIO ATUAL ──────────────────────────────────────
  const fetchUserStream = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/streamers/me');
      if (res.ok) {
        const data = await res.json();
        setUserStream(data.stream || null);
      }
    } catch (err) {
      console.error('❌ Erro ao buscar live do usuário:', err);
      setUserStream(null);
    }
  }, [user]);

  // ── GERENCIAR TOASTS ───────────────────────────────────────────────────
  const addToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ── COPIAR TAG @M7 ─────────────────────────────────────────────────────
  const handleCopyTag = () => {
    if (!userStream) return;
    const tag = `@m7 ${userStream.twitch_channel}`;
    navigator.clipboard.writeText(tag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── INICIAR LIVE ───────────────────────────────────────────────────────
  const handleStartLive = async () => {
    if (!user) return;

    if (!perfil?.twitch) {
      alert('⚠️ Sua conta Twitch não foi encontrada! Atualize seu perfil com seu username Twitch.');
      return;
    }

    let finalTitle = title;

    if (transmissionMode === 'padrao') {
      if (!title || title.trim().length === 0) {
        alert('⚠️ Coloque um título para iniciar a transmissão!');
        return;
      }
      finalTitle = title;
    } else if (transmissionMode === 'amistoso') {
      if (selectedTeams.length === 0) {
        alert('⚠️ Selecione pelo menos 1 time para criar uma transmissão amistosa!');
        return;
      }
      if (selectedTeams.length === 1) {
        const team = availableTimes.find((t) => t.id === selectedTeams[0]);
        finalTitle = `Amistoso\n${team?.tag || team?.nome}`;
      } else if (selectedTeams.length === 2) {
        const team1Data = availableTimes.find((t) => t.id === selectedTeams[0]);
        const team2Data = availableTimes.find((t) => t.id === selectedTeams[1]);
        finalTitle = `Amistoso\n${team1Data?.tag || team1Data?.nome} vs ${team2Data?.tag || team2Data?.nome}`;
      } else if (selectedTeams.length > 2) {
        const teamNames = selectedTeams.map((id) => {
          const t = availableTimes.find((team) => team.id === id);
          return t?.tag || t?.nome;
        }).join(' • ');
        finalTitle = `Amistoso\n${teamNames}`;
      }
    } else if (transmissionMode === 'campeonato') {
      if (!selectedCampeonato) {
        alert('⚠️ Selecione um campeonato!');
        return;
      }
      if (selectedTeams.length < 2) {
        alert('⚠️ Selecione 2 times para transmitir o campeonato!');
        return;
      }
      const campeonato = availableCampeonatos.find((c) => c.id === selectedCampeonato);
      const team1Data = availableTimes.find((t) => t.id === selectedTeams[0]);
      const team2Data = availableTimes.find((t) => t.id === selectedTeams[1]);
      finalTitle = `${campeonato?.titulo}\n${team1Data?.tag || team1Data?.nome} x ${team2Data?.tag || team2Data?.nome}`;
    }

    setLoadingAction(true);

    try {
      const newStream: StreamCard = {
        id: `tx-${Date.now()}`,
        user_id: user.id,
        twitch_channel: perfil.twitch || '',
        stream_title: finalTitle,
        viewer_count: 0,
        thumbnail_url: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${(perfil.twitch || '').toLowerCase()}-600x600.jpg`,
        ao_vivo: true,
        updated_at: new Date().toISOString(),
      };

      setUserStream(newStream);
      setTitle('');
      setSelectedTeams([]);
      setSelectedCampeonato('');
      addToast('🔴 AO VIVO!', `${finalTitle} está transmitindo agora!`, 'success');

      setStreams((prev) => [...prev, newStream]);
    } catch (err) {
      console.error('❌ Erro ao iniciar live:', err);
      alert('❌ Erro ao iniciar transmissão. Tente novamente.');
    } finally {
      setLoadingAction(false);
    }
  };

  // ── PARAR LIVE ─────────────────────────────────────────────────────────
  const handleStopLive = async () => {
    if (!userStream) return;
    setLoadingAction(true);

    try {
      const userIdToRemove = userStream.user_id;
      setUserStream(null);
      setTitle('');
      setSelectedCampeonato('');
      setStreams((prev) => prev.filter((s) => s.user_id !== userIdToRemove));
    } catch (err) {
      console.error('❌ Erro ao parar live:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  // ── BUSCAR STREAMS ATIVOS ──────────────────────────────────────────────
  const fetchStreams = useCallback(async () => {
    try {
      const res = await fetch('/api/streamers');
      if (!res.ok) { setStreams([]); return; }
      const data = await res.json();
      setStreams(data.streams || []);
    } catch {
      setStreams([]);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    setLoading(true);
    Promise.all([fetchStreams(), fetchUserStream(), fetchTimes(), fetchCampeonatos()]).then(() => setLoading(false));
  }, [fetchStreams, fetchUserStream, fetchTimes, fetchCampeonatos]);

  useEffect(() => {
    setHighlights([
      {
        id: 'h1',
        titulo: 'Melhores Jogadas do Torneio Semanal',
        link: 'https://twitch.tv',
        thumbnail_url: '/images/fundoryzecortado.png',
        categoria: 'semana',
      },
      {
        id: 'h2',
        titulo: 'Pentakill Incrível na Final',
        link: 'https://twitch.tv',
        thumbnail_url: '/images/background.png',
        categoria: 'clutch',
      },
    ]);
    setLoadingHighlights(false);
  }, []);

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/40">Carregando streamers...</p>
            </div>
          </div>
        )}

        {/* PAINEL DO USUÁRIO - Se estiver autenticado e for streamer */}
        {!loading && user && (perfil?.roles?.includes('streamer') || true) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative mb-12 border-2 rounded-2xl p-6 shadow-xl transition-all duration-500 overflow-hidden ${
              userStream?.ativo
                ? 'border-purple-500 shadow-purple-500/30'
                : 'border-white/5 shadow-black/40'
            }`}
          >
            {/* Background Thumbnail for active live */}
            {userStream?.ativo && (
              <div className="absolute inset-0 z-0">
                <img
                  src={`https://static-cdn.jtvnw.net/previews-ttv/live_user_${perfil?.twitch?.toLowerCase()}-600x600.jpg`}
                  alt="Live Thumbnail"
                  className="w-full h-full object-cover opacity-20 blur-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-purple-900/40 via-black/80 to-black/40" />
              </div>
            )}

            <div className="relative z-10 flex items-center justify-between gap-4 w-full h-full sm:flex-row flex-col">
              <div className="flex items-center gap-6 flex-1 h-full self-center">
                {!userStream?.ativo ? (
                  <>
                    <div className="flex items-center gap-3 pr-4 border-r border-white/10 hidden lg:flex self-stretch">
                      <FaTwitch className="w-6 h-6 text-purple-500" />
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest self-center">LIVE</span>
                    </div>

                    <div className="flex flex-1 items-center gap-4 flex-wrap">
                      {/* Input Título (apenas para PADRÃO) */}
                      {transmissionMode === 'padrao' && (
                        <input
                          type="text"
                          placeholder="Título da live..."
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="flex-1 max-w-[280px] bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-colors h-[48px]"
                        />
                      )}

                      {/* Select MODO */}
                      <div className="relative w-40">
                        <select
                          value={transmissionMode}
                          onChange={(e) => {
                            setTransmissionMode(e.target.value as 'padrao' | 'amistoso' | 'campeonato');
                            setSelectedTeams([]);
                            setSelectedCampeonato('');
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 appearance-none cursor-pointer text-zinc-300 uppercase font-bold pr-10 h-[48px]"
                        >
                          <option value="padrao" className="bg-zinc-900 font-bold uppercase">PADRÃO</option>
                          <option value="amistoso" className="bg-zinc-900 font-bold uppercase">AMISTOSO</option>
                          <option value="campeonato" className="bg-zinc-900 font-bold uppercase">CAMPEONATO</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-zinc-500" />
                        </div>
                      </div>

                      {/* Select Campeonato (se CAMPEONATO) */}
                      {transmissionMode === 'campeonato' && (
                        <div className="relative w-48">
                          <select
                            value={selectedCampeonato}
                            onChange={(e) => setSelectedCampeonato(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 appearance-none cursor-pointer text-zinc-300 uppercase font-bold pr-10 h-[48px]"
                          >
                            <option value="">CAMPEONATO</option>
                            {availableCampeonatos.map((c) => (
                              <option key={c.id} value={c.id} className="bg-zinc-900">{c.titulo}</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-zinc-500" />
                          </div>
                        </div>
                      )}

                      {/* Select Time 1 (se AMISTOSO ou CAMPEONATO) */}
                      {(transmissionMode === 'amistoso' || transmissionMode === 'campeonato') && (
                        <div className="relative w-40">
                          <select
                            value={selectedTeams[0] || ''}
                            onChange={(e) => {
                              const newTeams = [...selectedTeams];
                              newTeams[0] = e.target.value;
                              setSelectedTeams(newTeams.filter((t) => t));
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 appearance-none cursor-pointer text-zinc-300 uppercase font-bold pr-10 h-[48px]"
                          >
                            <option value="">TIME 1</option>
                            {availableTimes.map((t) => (
                              <option key={t.id} value={t.id} className="bg-zinc-900">{t.tag || t.nome}</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-zinc-500" />
                          </div>
                        </div>
                      )}

                      {/* Select Time 2 (se AMISTOSO ou CAMPEONATO) */}
                      {(transmissionMode === 'amistoso' || transmissionMode === 'campeonato') && (
                        <div className="relative w-40">
                          <select
                            value={selectedTeams[1] || ''}
                            onChange={(e) => {
                              const newTeams = [...selectedTeams];
                              newTeams[1] = e.target.value;
                              setSelectedTeams(newTeams.filter((t) => t));
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 appearance-none cursor-pointer text-zinc-300 uppercase font-bold pr-10 h-[48px]"
                          >
                            <option value="">TIME 2</option>
                            {availableTimes.map((t) => (
                              <option key={t.id} value={t.id} className="bg-zinc-900">{t.tag || t.nome}</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-zinc-500" />
                          </div>
                        </div>
                      )}

                      {/* Select DURAÇÃO */}
                      <div className="relative w-40">
                        <select
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 appearance-none cursor-pointer text-zinc-300 uppercase font-bold pr-10 h-[48px]"
                        >
                          <option value="1" className="bg-zinc-900 font-bold uppercase">1 HORA</option>
                          {[2, 3, 4, 5, 6].map((h) => (
                            <option key={h} value={h.toString()} className="bg-zinc-900 font-bold uppercase">{h} HORAS</option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-zinc-500" />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleStartLive}
                      disabled={loadingAction || !perfil?.twitch}
                      title={!perfil?.twitch ? 'Configure seu Twitch no perfil primeiro' : undefined}
                      className="flex items-center gap-3 bg-purple-600 hover:bg-purple-500 text-white px-10 py-4 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-purple-600/30 h-[48px]"
                    >
                      {loadingAction ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                      INICIAR TRANSMISSÃO
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 pr-4 border-r border-red-500/30 self-stretch">
                      <div className="w-2.5 h-2.5 rounded-full animate-pulse ring-4 bg-red-500 ring-red-500/30" />
                      <span className="text-[10px] font-black uppercase tracking-widest self-center text-red-500">🔴 AO VIVO</span>
                    </div>

                    <div className="flex flex-1 items-center gap-4">
                      <FaTwitch className="w-8 h-8 hidden sm:block text-purple-500" />
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-black text-white truncate max-w-[400px] leading-tight">{userStream?.titulo || 'Transmissão ao vivo'}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-purple-400">twitch.tv/{userStream?.twitch_channel}</span>
                          <span className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">• Duração: {userStream?.duracao_horas} {userStream?.duracao_horas === 1 ? 'HORA' : 'HORAS'}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleStopLive}
                      disabled={loadingAction}
                      className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-black px-10 py-4 rounded-xl font-black text-sm transition-all active:scale-95 shadow-lg h-[48px]"
                    >
                      {loadingAction ? <Loader className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                      ENCERRAR AGORA
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && streams.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 border-2 border-dashed border-white/10 rounded-2xl"
          >
            <FaTwitch size={48} className="mx-auto text-purple-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhum streamer ao vivo</h2>
            <p className="text-white/40">Volte mais tarde para acompanhar nossos streamers!</p>
          </motion.div>
        )}

        {/* Streamers Parceiros Section */}
        {!loading && streams.length > 0 && (
          <div>
            {/* Header */}
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-4">
                <FaTwitch size={32} className="text-purple-500" />
                <h1 className="text-4xl font-extrabold uppercase tracking-tighter">Streamers Parceiros</h1>
              </div>
              <p className="text-zinc-500 text-lg">
                Acompanhe as transmissões ao vivo dos nossos streamers parceiros
              </p>
            </div>

            {/* 4-Column Grid with Square Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {streams.map((stream, index) => (
                <motion.a
                  key={stream.id}
                  href={`https://twitch.tv/${stream.twitch_channel}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group block cursor-pointer"
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 border-2 transition-all border-purple-600 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]">
                    {/* Thumbnail Background - Twitch Live */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-black/60 overflow-hidden">
                      <img
                        src={`https://static-cdn.jtvnw.net/previews-ttv/live_user_${stream.twitch_channel.toLowerCase()}-600x600.jpg`}
                        alt={stream.profile?.nome || stream.twitch_channel}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/60" />
                    </div>

                    {/* Content Overlay */}
                    <div className="relative h-full flex flex-col justify-between p-4 px-5 pb-5">
                      {/* Top: Link Icon */}
                      <div className="flex justify-end">
                        <ExternalLink size={16} className="text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      {/* Bottom: Streamer Info */}
                      <div className="space-y-3">
                        {/* Stream Title (Fixed Height 2 lines) */}
                        <div className="h-10 overflow-hidden">
                          <p className="text-[16px] text-white font-bold line-clamp-2 leading-tight">
                            {stream.stream_title}
                          </p>
                        </div>

                        {/* Streamer Name and Badge */}
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate text-purple-400">
                              @{stream.twitch_channel}
                            </p>
                          </div>

                          {/* Botão AO VIVO */}
                          <div className="flex-shrink-0 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-[9px] font-black px-2.5 py-1.5 rounded-md whitespace-nowrap transition-all shadow-lg shadow-red-600/50">
                            🔴 AO VIVO
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        )}

        {/* ASSISTA AGORA — CLIPES DA COMUNIDADE */}
        {!loadingHighlights && highlights.length > 0 && (
          <section className="mt-16">
            <div className="flex flex-col items-center sm:flex-row sm:items-end justify-between gap-4 border-b border-white/5 pb-6 mb-8">
              <div className="space-y-2 text-center sm:text-left">
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter flex items-center justify-center sm:justify-start gap-4">
                  <FaTwitch className="text-[#9146FF] w-8 h-8 md:w-12 md:h-12" />
                  Assista <span className="text-[#9146FF]">Agora</span>
                </h2>
                <p className="text-zinc-500 text-sm md:text-base">
                  Clipes da comunidade — role para baixo para ver mais
                </p>
              </div>
              <span className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-[#9146FF] bg-[#9146FF]/10 border border-[#9146FF]/20 px-3 py-1.5 rounded-full">
                {highlights.length} {highlights.length === 1 ? 'clipe' : 'clipes'}
              </span>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2"
              style={{ maxHeight: 'calc(100vh - 220px)' }}
            >
              {highlights.map((h, idx) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <HighlightCardLives
                    titulo={h.titulo}
                    thumbnail={h.thumbnail_url}
                    link={h.link}
                    categoria={h.categoria}
                  />
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
