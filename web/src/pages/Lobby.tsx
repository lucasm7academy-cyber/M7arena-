import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, Play, Users, Shield, Target,
  Crown, Swords, Star, ChevronRight, Globe,
  Cpu, MousePointer2, Medal, Tv2,
  Instagram, BookOpen, Megaphone, ArrowRight, UserPlus, Swords as SwordsIcon,
  HelpCircle, ChevronDown, CheckCircle2, Sparkles, TrendingUp, Gamepad2,
  X, Calendar, Share2
} from 'lucide-react';
import { FaDiscord, FaTwitch } from "react-icons/fa6";
import { ImWhatsapp } from "react-icons/im";
import { useTransmissoesAtivas } from '../hooks/useTransmissoesAtivas';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

// Constantes de polígonos chanfrados oficiais (M7 Arena Cut-Edge com borda uniforme)
const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
const CUT_FRAME_INNER = 'polygon(10.6px 0, 100% 0, 100% calc(100% - 10.6px), calc(100% - 10.6px) 100%, 0 100%, 0 10.6px)';

const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';
const CUT_BUTTON_INNER = 'polygon(5.6px 0, 100% 0, 100% calc(100% - 5.6px), calc(100% - 5.6px) 100%, 0 100%, 0 5.6px)';

const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CUT_BADGE_INNER = 'polygon(2.6px 0, 100% 0, 100% calc(100% - 2.6px), calc(100% - 2.6px) 100%, 0 100%, 0 2.6px)';

// Card de Live Padrão (Chanfrado)
const PadraoLiveCard = ({ titulo, streamer, thumbnail, link }: any) => (
  <a
    href={link}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative flex flex-col flex-none w-[calc(100vw-32px)] sm:w-[340px] md:w-[380px] snap-center cursor-pointer transition-all p-[1px]"
    style={{
      clipPath: CUT_FRAME,
      background: 'linear-gradient(135deg, rgba(145,70,255,0.35) 0%, rgba(145,70,255,0.12) 50%, rgba(255,255,255,0.04) 100%)',
      boxShadow: '0 8px 25px -8px rgba(145,70,255,0.15)'
    }}
  >
    <div
      className="w-full h-full bg-[#08080a] group-hover:bg-[#0c0c10] transition-colors relative overflow-hidden flex flex-col justify-between"
      style={{ clipPath: CUT_FRAME_INNER }}
    >
      {/* Badge "Ao Vivo" */}
      <div className="w-full px-4 pt-4 pb-2 absolute top-0 left-0 z-20">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600/90 text-[9px] font-black uppercase tracking-widest text-white border border-red-400/40 w-fit"
          style={{ clipPath: CUT_BADGE }}
        >
          <div className="w-1.5 h-1.5 bg-white animate-pulse" style={{ clipPath: CUT_BADGE }} />
          Ao Vivo
        </div>
      </div>

      {/* Thumbnail */}
      <div className="relative w-full aspect-video overflow-hidden bg-[#060608] flex-none">
        <img
          src={thumbnail}
          alt={titulo}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Título + streamer */}
      <div className="w-full px-4 py-3 flex-1">
        <p className="text-sm font-black uppercase tracking-tight text-white line-clamp-2 leading-tight group-hover:text-[#9146FF] transition-colors">{titulo}</p>
        <span className="text-[11px] font-bold text-[#9146FF] uppercase tracking-[0.15em] mt-1 block">@{streamer}</span>
      </div>

      {/* Bottom Button */}
      <div className="w-full p-2.5 pt-0">
        <div
          className="w-full py-3 bg-[#9146FF]/15 group-hover:bg-[#9146FF] border border-[#9146FF]/30 text-purple-300 group-hover:text-white flex items-center justify-center transition-all"
          style={{ clipPath: CUT_BUTTON }}
        >
          <span className="text-[11px] font-black uppercase tracking-[0.25em]">
            ASSISTIR AGORA!
          </span>
        </div>
      </div>
    </div>
  </a>
);

// Card de Highlight / Destaque (Chanfrado)
const HighlightCard = ({ titulo, thumbnail, link, categoria }: any) => (
  <a
    href={link}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative flex flex-col flex-none w-[calc(100vw-32px)] sm:w-[340px] md:w-[380px] snap-center cursor-pointer transition-all p-[1px]"
    style={{
      clipPath: CUT_FRAME,
      background: 'linear-gradient(135deg, rgba(145,70,255,0.35) 0%, rgba(145,70,255,0.12) 50%, rgba(255,255,255,0.04) 100%)',
      boxShadow: '0 8px 25px -8px rgba(145,70,255,0.15)'
    }}
  >
    <div
      className="w-full h-full bg-[#08080a] group-hover:bg-[#0c0c10] transition-colors relative overflow-hidden flex flex-col justify-between"
      style={{ clipPath: CUT_FRAME_INNER }}
    >
      <div className="relative w-full aspect-video overflow-hidden bg-[#060608] flex-none">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tv2 className="w-12 h-12 text-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-transparent pointer-events-none" />
        {/* Badge roxo */}
        <div className="absolute top-3 left-3 z-10">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#9146FF]/90 text-[8px] font-black uppercase tracking-widest text-white border border-[#9146FF]"
            style={{ clipPath: CUT_BADGE }}
          >
            ★ {categoria === 'clutch' ? 'Clutch' : categoria === 'jogada' ? 'Jogada' : categoria === 'engracado' ? 'Engraçado' : categoria === 'top5' ? 'Top 5' : categoria === 'compilacao' ? 'Compilação' : categoria === 'semana' ? 'Destaques' : 'Highlight'}
          </div>
        </div>
      </div>
      <div className="w-full px-4 py-3 flex-1">
        <p className="text-sm font-black uppercase tracking-tight text-white line-clamp-2 leading-tight group-hover:text-[#9146FF] transition-colors">{titulo}</p>
      </div>
      <div className="w-full p-2.5 pt-0">
        <div
          className="w-full py-3 bg-[#9146FF]/15 group-hover:bg-[#9146FF] border border-[#9146FF]/30 text-purple-300 group-hover:text-white flex items-center justify-center transition-all"
          style={{ clipPath: CUT_BUTTON }}
        >
          <span className="text-[11px] font-black uppercase tracking-[0.25em]">ASSISTIR AGORA!</span>
        </div>
      </div>
    </div>
  </a>
);

// Card de Partida ao Vivo (Chanfrado)
const LiveBroadcastCard = ({ teamA, teamB, logoA, logoB, tagA, tagB, streamer, link, colorA, colorB, titulo, modo, nomecamp }: any) => {
  const tituloFinal = modo === 'campeonato'
    ? nomecamp
    : modo === 'amistoso'
    ? `Amistoso - ${tagA.replace('#', '')} vs ${tagB.replace('#', '')}`
    : titulo || 'Transmissão ao vivo';

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col flex-none w-[calc(100vw-32px)] sm:w-[340px] md:w-[380px] snap-center cursor-pointer transition-all p-[1px]"
      style={{
        clipPath: CUT_FRAME,
        background: 'linear-gradient(135deg, rgba(145,70,255,0.35) 0%, rgba(145,70,255,0.12) 50%, rgba(255,255,255,0.04) 100%)',
        boxShadow: '0 8px 25px -8px rgba(145,70,255,0.15)'
      }}
    >
      <div
        className="w-full h-full bg-[#08080a] group-hover:bg-[#0c0c10] transition-colors relative overflow-hidden flex flex-col justify-between"
        style={{ clipPath: CUT_FRAME_INNER }}
      >
        {/* Badge "Ao Vivo" */}
        <div className="w-full px-4 pt-4 pb-2 absolute top-0 left-0 z-20">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600/90 text-[9px] font-black uppercase tracking-widest text-white border border-red-400/40 w-fit"
            style={{ clipPath: CUT_BADGE }}
          >
            <div className="w-1.5 h-1.5 bg-white animate-pulse" style={{ clipPath: CUT_BADGE }} />
            Ao Vivo
          </div>
        </div>

        {/* Teams matchup */}
        <div className="relative w-full aspect-video overflow-hidden bg-[#060608] flex flex-col items-center justify-center p-4 flex-none">
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 to-[#08080a]" />
          <div className="relative z-10 flex items-center justify-between w-full gap-3 pt-6">
            {/* Team A */}
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className="w-16 h-16 md:w-20 md:h-20 p-[1px] group-hover:scale-105 transition-transform duration-500"
                style={{
                  clipPath: CUT_BUTTON,
                  background: colorA ? `linear-gradient(135deg, ${colorA}80, rgba(255,255,255,0.1))` : 'rgba(255,255,255,0.15)'
                }}
              >
                <div
                  className="w-full h-full bg-black/80 flex items-center justify-center overflow-hidden"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <img src={logoA} alt={teamA} className="w-full h-full object-contain p-2" />
                </div>
              </div>
              <span className="text-[12px] font-black uppercase tracking-widest block truncate mt-1.5" style={{ color: colorA || '#ffffff' }}>{tagA}</span>
            </div>

            {/* VS */}
            <div className="text-xl md:text-2xl font-black text-white/80 tracking-tighter uppercase leading-none">VS</div>

            {/* Team B */}
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className="w-16 h-16 md:w-20 md:h-20 p-[1px] group-hover:scale-105 transition-transform duration-500"
                style={{
                  clipPath: CUT_BUTTON,
                  background: colorB ? `linear-gradient(135deg, ${colorB}80, rgba(255,255,255,0.1))` : 'rgba(255,255,255,0.15)'
                }}
              >
                <div
                  className="w-full h-full bg-black/80 flex items-center justify-center overflow-hidden"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <img src={logoB} alt={teamB} className="w-full h-full object-contain p-2" />
                </div>
              </div>
              <span className="text-[12px] font-black uppercase tracking-widest block truncate mt-1.5" style={{ color: colorB || '#ffffff' }}>{tagB}</span>
            </div>
          </div>
        </div>

        {/* Título automático + Streamer name */}
        <div className="w-full px-4 py-3 flex-1 flex flex-col justify-between">
          <p className="text-sm font-black uppercase tracking-tight text-white line-clamp-1 leading-tight">{tituloFinal}</p>
          <span className="text-[11px] font-bold text-[#9146FF] uppercase tracking-[0.15em] mt-1 block">@{streamer}</span>
        </div>

        {/* Bottom Button */}
        <div className="w-full p-2.5 pt-0">
          <div
            className="w-full py-3 bg-[#9146FF]/15 group-hover:bg-[#9146FF] border border-[#9146FF]/30 text-purple-300 group-hover:text-white flex items-center justify-center transition-all"
            style={{ clipPath: CUT_BUTTON }}
          >
            <span className="text-[11px] font-black uppercase tracking-[0.25em]">
              ASSISTIR AGORA!
            </span>
          </div>
        </div>
      </div>
    </a>
  );
};

interface UpcomingMatch {
  id: string;
  tagA: string;
  colorA: string;
  logoA: string;
  tagB: string;
  colorB: string;
  logoB: string;
  date: string;
  time: string;
}

const _UPCOMING_CACHE_TTL = 5 * 60 * 1000;
const _UPCOMING_CACHE_VER = 3;
let _upcomingCache: { data: UpcomingMatch[]; ts: number; v: number } | null = null;

const _HIGHLIGHTS_CACHE_TTL = 5 * 60 * 1000;
let _highlightsCache: { data: Array<{ id: string; titulo: string; link: string; thumbnail_url: string | null; categoria: string }>; ts: number } | null = null;

const _NOTICIAS_CACHE_TTL = 5 * 60 * 1000;
let _noticiasCache: { data: Noticia[]; ts: number } | null = null;

interface Noticia {
  id: string;
  titulo: string;
  slug: string;
  resumo: string;
  categoria: string;
  thumbnail_url: string | null;
  autor?: string;
  publicado_em: string;
  destaque: boolean;
}

const _VOTES_CACHE_TTL = 5 * 60 * 1000;
let _votesCache: { data: Record<string, { a: number; b: number }>; ts: number; matchKey: string } | null = null;

const Home = () => {
  const navigate = useNavigate();
  const liveScrollRef = React.useRef<HTMLDivElement>(null);
  const { transmissoes, loading: loadingLives } = useTransmissoesAtivas();

  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(0);
  const [direction, setDirection] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const [highlights, setHighlights] = React.useState<Array<{ id: string; titulo: string; link: string; thumbnail_url: string | null; categoria: string }>>([]);
  const [upcomingMatches, setUpcomingMatches] = React.useState<UpcomingMatch[]>([]);
  const [upcomingLoaded, setUpcomingLoaded] = React.useState(false);
  const [votes, setVotes] = React.useState<Record<string, { a: number; b: number }>>({});
  const [userVotes, setUserVotes] = React.useState<Record<string, 'a' | 'b'>>({});
  const [noticias, setNoticias] = React.useState<Noticia[]>([]);
  const [openFaqId, setOpenFaqId] = React.useState<number | null>(null);
  const [selectedNoticia, setSelectedNoticia] = React.useState<any>(null);

  // Fetch próximos jogos do cronograma (cache 5 min)
  React.useEffect(() => {
    const fetchUpcoming = async () => {
      if (_upcomingCache && _upcomingCache.v === _UPCOMING_CACHE_VER && Date.now() - _upcomingCache.ts < _UPCOMING_CACHE_TTL) {
        setUpcomingMatches(_upcomingCache.data);
        setUpcomingLoaded(true);
        return;
      }
      try {
        const camps = await api.tournaments.list();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const raw: Array<{ sortKey: string; match: any; camp: any }> = [];

        for (const camp of camps) {
          const cron: any[] = camp.cronograma || [];
          const times: any[] = camp.times_inscritos || [];

          for (const match of cron) {
            if (match.status === 'finalizado') continue;
            if (!match.timeA || !match.timeB) continue;
            if (!match.data || match.data === 'A COMBINAR') continue;
            const mDate = new Date(
              match.data.length === 10 ? match.data + 'T00:00:00' : match.data
            );
            if (isNaN(mDate.getTime())) continue;

            const findTeam = (tag: string) =>
              times.find((t: any) => t.tag === tag || t.name === tag || t.nome === tag);
            const tA = findTeam(match.timeA);
            const tB = findTeam(match.timeB);

            const diffDays = Math.round(
              (mDate.getTime() - today.getTime()) / 86400000
            );
            const dateStr =
              diffDays === 0
                ? 'HOJE'
                : diffDays === 1
                ? 'AMANHÃ'
                : mDate
                    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                    .toUpperCase();

            raw.push({
              sortKey: `${match.data}${match.hora || match.horario || '00:00'}`,
              match,
              camp: { ...camp, _times: times, _tA: tA, _tB: tB, _dateStr: dateStr },
            });
          }
        }

        raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        const mapped: UpcomingMatch[] = raw.map(({ match, camp: c }) => ({
          id: `${c.id}_${match.timeA}_${match.timeB}_${match.data}`,
          tagA: `#${match.timeA}`,
          colorA: c._tA?.cor || c.theme_color || '#FFB700',
          logoA: c._tA?.logo || '',
          tagB: `#${match.timeB}`,
          colorB: c._tB?.cor || c.theme_color || '#FFB700',
          logoB: c._tB?.logo || '',
          date: c._dateStr,
          time: match.hora || match.horario || '—',
        }));

        _upcomingCache = { data: mapped, ts: Date.now(), v: _UPCOMING_CACHE_VER };
        setUpcomingMatches(mapped);
        setCurrentMatchIndex(0);
        setUpcomingLoaded(true);
      } catch (err) {
        console.error('Erro ao buscar próximos jogos:', err);
        setUpcomingLoaded(true);
      }
    };
    fetchUpcoming();
  }, []);

  // Busca highlights ativos (cache 5min)
  React.useEffect(() => {
    if (_highlightsCache && Date.now() - _highlightsCache.ts < _HIGHLIGHTS_CACHE_TTL) {
      setHighlights(_highlightsCache.data);
      return;
    }
    api.content.highlights()
      .then((data) => {
        setHighlights(data);
        _highlightsCache = { data, ts: Date.now() };
      })
      .catch((err) => {
        console.error('Erro ao buscar highlights:', err);
      });
  }, []);

  // Busca notícias do blog (cache 5min)
  React.useEffect(() => {
    if (_noticiasCache && Date.now() - _noticiasCache.ts < _NOTICIAS_CACHE_TTL) {
      setNoticias(_noticiasCache.data);
      return;
    }
    api.content.news()
      .then((list) => {
        setNoticias(list);
        _noticiasCache = { data: list, ts: Date.now() };
      })
      .catch((err) => {
        console.error('Erro ao buscar notícias:', err);
      });
  }, []);

  // Carrega votos já dados pelo usuário (localStorage)
  React.useEffect(() => {
    const stored: Record<string, 'a' | 'b'> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vote_')) {
        const val = localStorage.getItem(key);
        if (val === 'a' || val === 'b') stored[key.slice(5)] = val;
      }
    }
    setUserVotes(stored);
  }, []);

  // Busca contagem de votos quando os jogos carregam
  React.useEffect(() => {
    if (!upcomingMatches.length) return;
    const ids = upcomingMatches.map((m) => m.id);
    const matchKey = ids.join('|');

    if (
      _votesCache &&
      _votesCache.matchKey === matchKey &&
      Date.now() - _votesCache.ts < _VOTES_CACHE_TTL
    ) {
      setVotes(_votesCache.data);
      return;
    }

    const fetchVotes = async () => {
      const { data, error } = await supabase
        .from('votos_jogos')
        .select('match_id, team_tag, votos')
        .in('match_id', ids);
      if (error || !data) return;
      const map: Record<string, { a: number; b: number }> = {};
      for (const row of data) {
        if (!map[row.match_id]) map[row.match_id] = { a: 0, b: 0 };
        const match = upcomingMatches.find((m) => m.id === row.match_id);
        if (!match) continue;
        const rawTagA = match.tagA.replace('#', '');
        if (row.team_tag === rawTagA) map[row.match_id].a = row.votos;
        else map[row.match_id].b = row.votos;
      }
      setVotes(map);
      _votesCache = { data: map, ts: Date.now(), matchKey };
    };
    fetchVotes();
  }, [upcomingMatches]);

  // Registra voto do usuário
  const handleVote = async (matchId: string, side: 'a' | 'b') => {
    if (userVotes[matchId]) return;
    const match = upcomingMatches.find((m) => m.id === matchId);
    if (!match) return;
    const teamTag = side === 'a' ? match.tagA.replace('#', '') : match.tagB.replace('#', '');
    setVotes((prev) => ({
      ...prev,
      [matchId]: {
        a: (prev[matchId]?.a || 0) + (side === 'a' ? 1 : 0),
        b: (prev[matchId]?.b || 0) + (side === 'b' ? 1 : 0),
      },
    }));
    setUserVotes((prev) => ({ ...prev, [matchId]: side }));
    localStorage.setItem(`vote_${matchId}`, side);
    _votesCache = null;
    await api.matches.vote(matchId, teamTag).catch((e: any) => console.error('Erro ao votar:', e.message));
  };

  const handlePrev = () => {
    if (!upcomingMatches.length) return;
    setDirection(-1);
    setCurrentMatchIndex((prev) => (prev === 0 ? upcomingMatches.length - 1 : prev - 1));
  };

  const handleNext = () => {
    if (!upcomingMatches.length) return;
    setDirection(1);
    setCurrentMatchIndex((prev) => (prev === upcomingMatches.length - 1 ? 0 : prev + 1));
  };

  React.useEffect(() => {
    if (isHovered || upcomingMatches.length === 0) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentMatchIndex((prev) =>
        prev === upcomingMatches.length - 1 ? 0 : prev + 1
      );
    }, 5000);
    return () => clearInterval(timer);
  }, [currentMatchIndex, isHovered, upcomingMatches.length]);

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const { current } = ref;
      let cardWidth = 404;
      if (window.innerWidth < 640) cardWidth = window.innerWidth - 8;
      else if (window.innerWidth < 768) cardWidth = 364;

      current.scrollBy({
        left: direction === 'left' ? -cardWidth : cardWidth,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative min-h-screen text-white selection:bg-[#FFB700] selection:text-black">
      <div className="relative z-10 space-y-12 pb-24">
        {/* HERO SECTION - BANNER PRINCIPAL STYLE */}
        <section className="pt-8 pb-2 px-4 max-w-7xl mx-auto">
          <div
            className="relative p-[1px] aspect-[4/5] sm:aspect-video lg:aspect-[2.4/1] w-full group transition-all"
            style={{
              clipPath: CUT_FRAME,
              background: 'linear-gradient(135deg, rgba(255,183,0,0.35) 0%, rgba(255,183,0,0.1) 50%, rgba(255,255,255,0.04) 100%)',
              boxShadow: '0 0 40px -10px rgba(255,183,0,0.15)'
            }}
          >
            <div
              className="w-full h-full bg-[#08080a] overflow-hidden relative"
              style={{ clipPath: CUT_FRAME_INNER }}
            >
              {/* Background Video */}
              <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#08080a] via-[#08080a]/70 to-transparent z-10" />
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover object-[center_15%] opacity-75 transition-transform duration-700 group-hover:scale-105"
                >
                  <source src="/images/animated-highnoon-lucian.webm" type="video/webm" />
                </video>
              </div>

              {/* Content Wrapper */}
              <div className="relative z-20 flex flex-col justify-end sm:justify-center px-5 sm:px-12 md:px-20 pb-8 pt-20 sm:py-10 max-w-4xl w-full h-full">
                <div className="space-y-4 md:space-y-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[#FFB700] text-[10px] md:text-sm font-black uppercase tracking-[0.3em]">
                      M7 ARENA • Campeonatos 2026
                    </span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl md:text-7xl font-black uppercase leading-[0.9] tracking-tighter break-words">
                    Seu Time está <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60">
                      pronto para vencer?
                    </span>
                  </h1>

                  <p className="text-white/60 text-xs sm:text-sm md:text-base font-medium max-w-xs sm:max-w-xl leading-relaxed">
                    Campeonatos de LoL com premiação em Pix, ranking por PDL e
                    transmissão ao vivo — a vitrine para o seu time brilhar.
                  </p>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 pt-4">
                    <button
                      onClick={() => navigate('/campeonatos')}
                      className="px-6 md:px-10 py-3.5 md:py-4 bg-[#FFB700] hover:bg-[#e0a000] text-black font-black text-[10px] md:text-xs uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[0_0_30px_-5px_rgba(255,183,0,0.5)] flex items-center justify-center gap-2"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      <span>Explorar Torneios</span>
                      <ChevronRight size={14} />
                    </button>

                    <button
                      onClick={() => navigate('/times')}
                      className="px-6 md:px-10 py-3.5 md:py-4 bg-white/5 hover:bg-white/10 text-white border border-white/20 hover:border-white/40 font-black text-[10px] md:text-xs uppercase tracking-[0.2em] transition-all cursor-pointer flex items-center justify-center gap-2"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      <span>Crie seu Time</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Destaque Tag Floating */}
              <div className="hidden sm:block absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-black/70 backdrop-blur-md border border-white/10"
                  style={{ clipPath: CUT_BADGE }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FFB700] animate-pulse" />
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#FFB700]">Temporada 2026</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AO VIVO AGORA - LIVE STREAMS */}
        <section className="py-6 px-4 max-w-7xl mx-auto">
          <div className="space-y-6">
            <div className="flex flex-col items-center sm:flex-row sm:items-end justify-between gap-4 border-b border-white/5 pb-4">
              <div className="space-y-1 text-center sm:text-left">
                <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter flex items-center justify-center sm:justify-start gap-3">
                  <FaTwitch className="text-[#9146FF] w-7 h-7 md:w-9 md:h-9" />
                  Assista <span className="text-[#9146FF]">Agora</span>
                </h2>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => scroll(liveScrollRef, 'left')}
                  className="w-9 h-9 bg-black border border-white/15 hover:border-[#9146FF] hover:bg-[#9146FF]/20 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  style={{ clipPath: CUT_BUTTON }}
                  title="Anterior"
                >
                  <ChevronRight size={16} className="rotate-180" />
                </button>
                <button
                  onClick={() => scroll(liveScrollRef, 'right')}
                  className="w-9 h-9 bg-black border border-white/15 hover:border-[#9146FF] hover:bg-[#9146FF]/20 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  style={{ clipPath: CUT_BUTTON }}
                  title="Próximo"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="relative group/live-slider">
              <button
                onClick={() => scroll(liveScrollRef, 'left')}
                className="flex sm:hidden absolute left-0 top-1/2 -translate-y-[60%] -translate-x-2 z-30 w-9 h-9 bg-black/80 border border-white/15 items-center justify-center text-[#9146FF] font-bold"
                style={{ clipPath: CUT_BUTTON }}
              >
                <ChevronRight className="rotate-180" size={18} />
              </button>

              <div
                ref={liveScrollRef}
                className="flex gap-5 overflow-x-auto hide-scrollbar pb-6 px-1 scroll-smooth snap-x snap-mandatory sm:snap-none"
              >
                {!loadingLives && transmissoes.length === 0 && highlights.length === 0 && (
                  <div
                    className="flex-none w-full py-12 text-center bg-white/[0.02] border border-dashed border-white/10 p-8"
                    style={{ clipPath: CUT_FRAME }}
                  >
                    <FaTwitch size={32} className="mx-auto text-purple-500/40 mb-3" />
                    <p className="text-white/40 text-sm font-black uppercase tracking-widest">Nenhuma live no momento — veja os destaques abaixo</p>
                  </div>
                )}

                {/* Lives ativas */}
                {transmissoes.map((tx) => {
                  if (tx.modo === 'padrao' || (!tx.time1 && !tx.time2)) {
                    return (
                      <PadraoLiveCard
                        key={tx.id}
                        titulo={tx.titulo}
                        streamer={tx.twitch_channel}
                        thumbnail={tx.thumbnail_url}
                        link={`https://twitch.tv/${tx.twitch_channel}`}
                      />
                    );
                  }
                  return (
                    <LiveBroadcastCard
                      key={tx.id}
                      teamA={tx.time1?.nome || 'Time 1'}
                      tagA={tx.time1?.tag ? `#${tx.time1.tag}` : '#T1'}
                      logoA={tx.time1?.logo_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e'}
                      colorA={tx.time1?.gradient_from || '#FFB700'}
                      teamB={tx.time2?.nome || 'Time 2'}
                      tagB={tx.time2?.tag ? `#${tx.time2.tag}` : '#T2'}
                      logoB={tx.time2?.logo_url || 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f'}
                      colorB={tx.time2?.gradient_from || '#FFB700'}
                      titulo={tx.titulo}
                      modo={tx.modo}
                      nomecamp={tx.nomecamp || 'Campeonato'}
                      streamer={tx.twitch_channel}
                      link={`https://twitch.tv/${tx.twitch_channel}`}
                    />
                  );
                })}

                {/* Aviso "não ao vivo" com Howling Abyss quando só há highlights */}
                {!loadingLives && transmissoes.length === 0 && highlights.length > 0 && (
                  <div
                    className="hidden sm:flex group relative flex flex-col flex-none w-[calc(100vw-32px)] sm:w-[300px] md:w-[340px] snap-center overflow-hidden min-h-[220px] shadow-2xl p-[1px]"
                    style={{
                      clipPath: CUT_FRAME,
                      background: 'linear-gradient(135deg, rgba(145,70,255,0.3) 0%, rgba(255,255,255,0.04) 100%)'
                    }}
                  >
                    <div className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col items-center justify-center p-6 text-center" style={{ clipPath: CUT_FRAME_INNER }}>
                      <img
                        src="/images/howling_abyss_night.webp"
                        alt="Howling Abyss Night"
                        className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/80 to-transparent pointer-events-none" />

                      <div className="relative z-10">
                        <FaTwitch size={32} className="mx-auto text-[#9146FF] mb-2 drop-shadow-lg" />
                        <p className="text-white font-black text-sm uppercase tracking-wider leading-snug drop-shadow">
                          Não estamos<br />ao vivo no momento
                        </p>
                        <p className="text-white/50 text-xs font-semibold mt-2 leading-relaxed drop-shadow">
                          Assista aos highlights<br />da nossa comunidade →
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Highlights */}
                {highlights.map((h) => (
                  <HighlightCard
                    key={h.id}
                    titulo={h.titulo}
                    thumbnail={h.thumbnail_url}
                    link={h.link}
                    categoria={h.categoria}
                  />
                ))}
              </div>

              <button
                onClick={() => scroll(liveScrollRef, 'right')}
                className="flex sm:hidden absolute right-0 top-1/2 -translate-y-[60%] translate-x-2 z-30 w-9 h-9 bg-black/80 border border-white/15 items-center justify-center text-[#9146FF] font-bold"
                style={{ clipPath: CUT_BUTTON }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* UPCOMING MATCHES - PRÓXIMOS JOGOS */}
        {upcomingLoaded && upcomingMatches.length > 0 && (
          <section className="py-6 px-4 max-w-7xl mx-auto overflow-hidden relative">
            <div className="space-y-6 relative">
              <div className="flex flex-col items-center text-center">
                <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter">
                  Próximos <span className="text-[#FFB700]">Jogos</span>
                </h2>
              </div>

              <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="relative p-[1px] w-full transition-all"
                style={{
                  clipPath: CUT_FRAME,
                  background: 'linear-gradient(135deg, rgba(255,183,0,0.3) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)',
                  boxShadow: '0 0 35px -10px rgba(255,183,0,0.12)'
                }}
              >
                <div
                  className="w-full bg-[#08080a] relative flex items-center justify-between min-h-[380px] md:min-h-[420px] px-2 md:px-14 py-8 overflow-hidden"
                  style={{ clipPath: CUT_FRAME_INNER }}
                >
                  {/* Ambient Background Glows */}
                  <div className="absolute inset-0 flex items-center justify-between pointer-events-none z-0">
                    <div
                      className="w-[200px] h-[200px] md:w-[350px] md:h-[350px] rounded-full blur-[90px] opacity-15 absolute left-[5%] md:left-[15%] transition-all duration-700"
                      style={{ backgroundColor: upcomingMatches[currentMatchIndex]?.colorA ?? '#FFB700' }}
                    />
                    <div
                      className="w-[200px] h-[200px] md:w-[350px] md:h-[350px] rounded-full blur-[90px] opacity-15 absolute right-[5%] md:right-[15%] transition-all duration-700"
                      style={{ backgroundColor: upcomingMatches[currentMatchIndex]?.colorB ?? '#FFB700' }}
                    />
                  </div>

                  {/* Left Navigation Arrow */}
                  <button
                    onClick={handlePrev}
                    className="w-10 h-10 bg-black/80 border border-white/20 hover:border-[#FFB700] text-white/50 hover:text-[#FFB700] transition-all flex items-center justify-center z-30 cursor-pointer"
                    style={{ clipPath: CUT_BUTTON }}
                    title="Jogo Anterior"
                  >
                    <ChevronRight className="rotate-180 w-5 h-5" />
                  </button>

                  {/* Center Animating Area */}
                  <div className="w-full flex justify-center items-center z-10 overflow-visible px-2">
                    <AnimatePresence initial={false} custom={direction} mode="wait">
                      {upcomingMatches[currentMatchIndex] && (
                        <div
                          key={upcomingMatches[currentMatchIndex].id}
                          className="w-full max-w-4xl flex flex-col items-center gap-6 md:gap-8"
                        >
                          {/* Main Matchup Arena */}
                          <div className="flex flex-wrap md:flex-nowrap md:flex-row items-center justify-center md:justify-between w-full gap-y-6 gap-x-2 md:gap-12 py-2">
                            {/* Team A */}
                            <div className="flex flex-col items-center gap-3 md:gap-4 order-1 w-[calc(50%-8px)] md:w-auto md:order-none flex-none md:flex-1 text-center md:items-end md:text-right">
                              <div className="flex flex-col items-center md:items-end gap-2 md:gap-3">
                                <div
                                  className="w-24 h-24 md:w-32 md:h-32 p-[1px] shadow-2xl relative group transition-all"
                                  style={{
                                    clipPath: CUT_FRAME,
                                    background: `linear-gradient(135deg, ${upcomingMatches[currentMatchIndex].colorA}80 0%, ${upcomingMatches[currentMatchIndex].colorA}20 50%, rgba(255,255,255,0.05) 100%)`,
                                    boxShadow: `0 0 25px ${upcomingMatches[currentMatchIndex].colorA}25`
                                  }}
                                >
                                  <div
                                    className="w-full h-full bg-[#0c0c10] flex items-center justify-center overflow-hidden relative"
                                    style={{ clipPath: CUT_FRAME_INNER }}
                                  >
                                    {upcomingMatches[currentMatchIndex].logoA ? (
                                      <img
                                        src={upcomingMatches[currentMatchIndex].logoA}
                                        alt={upcomingMatches[currentMatchIndex].tagA}
                                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                                      />
                                    ) : (
                                      <span
                                        className="text-4xl md:text-6xl font-black opacity-30 select-none"
                                        style={{ color: upcomingMatches[currentMatchIndex].colorA }}
                                      >
                                        {upcomingMatches[currentMatchIndex].tagA[1] ?? upcomingMatches[currentMatchIndex].tagA[0]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span
                                  className="text-xl sm:text-2xl md:text-4xl font-black uppercase tracking-tight leading-none"
                                  style={{ color: upcomingMatches[currentMatchIndex].colorA }}
                                >
                                  {upcomingMatches[currentMatchIndex].tagA}
                                </span>
                              </div>
                            </div>

                            {/* VS & Timing Area */}
                            <div className="flex flex-col items-center gap-2 md:gap-3 order-3 w-full md:w-auto md:order-none min-w-[160px] relative select-none">
                              <span className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white/80 to-white/20 tracking-widest uppercase leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                                VS
                              </span>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] md:text-xs font-bold text-white/40 uppercase tracking-[0.25em]">{upcomingMatches[currentMatchIndex].date}</span>
                                <span className="text-lg md:text-xl font-black text-[#FFB700] tracking-widest mt-0.5 drop-shadow-[0_0_15px_rgba(255,183,0,0.45)]">{upcomingMatches[currentMatchIndex].time}</span>
                              </div>
                            </div>

                            {/* Team B */}
                            <div className="flex flex-col items-center gap-3 md:gap-4 order-2 w-[calc(50%-8px)] md:w-auto md:order-none flex-none md:flex-1 text-center md:items-start md:text-left">
                              <div className="flex flex-col items-center md:items-start gap-2 md:gap-3">
                                <div
                                  className="w-24 h-24 md:w-32 md:h-32 p-[1px] shadow-2xl relative group transition-all"
                                  style={{
                                    clipPath: CUT_FRAME,
                                    background: `linear-gradient(135deg, ${upcomingMatches[currentMatchIndex].colorB}80 0%, ${upcomingMatches[currentMatchIndex].colorB}20 50%, rgba(255,255,255,0.05) 100%)`,
                                    boxShadow: `0 0 25px ${upcomingMatches[currentMatchIndex].colorB}25`
                                  }}
                                >
                                  <div
                                    className="w-full h-full bg-[#0c0c10] flex items-center justify-center overflow-hidden relative"
                                    style={{ clipPath: CUT_FRAME_INNER }}
                                  >
                                    {upcomingMatches[currentMatchIndex].logoB ? (
                                      <img
                                        src={upcomingMatches[currentMatchIndex].logoB}
                                        alt={upcomingMatches[currentMatchIndex].tagB}
                                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                                      />
                                    ) : (
                                      <span
                                        className="text-4xl md:text-6xl font-black opacity-30 select-none"
                                        style={{ color: upcomingMatches[currentMatchIndex].colorB }}
                                      >
                                        {upcomingMatches[currentMatchIndex].tagB[1] ?? upcomingMatches[currentMatchIndex].tagB[0]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span
                                  className="text-xl sm:text-2xl md:text-4xl font-black uppercase tracking-tight leading-none"
                                  style={{ color: upcomingMatches[currentMatchIndex].colorB }}
                                >
                                  {upcomingMatches[currentMatchIndex].tagB}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Votação da torcida */}
                          {(() => {
                            const m = upcomingMatches[currentMatchIndex];
                            if (!m) return null;
                            const v = votes[m.id] || { a: 0, b: 0 };
                            const total = v.a + v.b;
                            const pctA = total > 0 ? Math.round((v.a / total) * 100) : 50;
                            const pctB = 100 - pctA;
                            const voted = userVotes[m.id];
                            return (
                              <div className="w-full max-w-sm mx-auto flex flex-col gap-2.5">
                                {/* Barra de votos chanfrada */}
                                <div
                                  className="relative flex h-2.5 overflow-hidden bg-white/10 p-[1px]"
                                  style={{ clipPath: CUT_BADGE }}
                                >
                                  <div
                                    className="h-full transition-all duration-500 ease-out"
                                    style={{ width: `${pctA}%`, backgroundColor: m.colorA, opacity: 0.9 }}
                                  />
                                  <div
                                    className="h-full transition-all duration-500 ease-out"
                                    style={{ width: `${pctB}%`, backgroundColor: m.colorB, opacity: 0.9 }}
                                  />
                                </div>
                                {/* Botões GO */}
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    onClick={() => handleVote(m.id, 'a')}
                                    disabled={!!voted}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer
                                      ${voted === 'a' ? 'bg-[#FFB700]/20 text-[#FFB700] border-[#FFB700]' : voted ? 'opacity-30 cursor-not-allowed border-white/10 text-white/30' : 'border-white/15 bg-white/5 text-white/70 hover:border-white/40 hover:text-white'}`}
                                    style={{ clipPath: CUT_BADGE }}
                                  >
                                    {voted === 'a' && '✓ '}GO {m.tagA}
                                    <span className="opacity-60 font-mono">{pctA}%</span>
                                  </button>

                                  <span className="text-[9px] text-white/30 font-black uppercase tracking-widest whitespace-nowrap">
                                    {total > 0 ? `${total} voto${total !== 1 ? 's' : ''}` : 'Vote!'}
                                  </span>

                                  <button
                                    onClick={() => handleVote(m.id, 'b')}
                                    disabled={!!voted}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer
                                      ${voted === 'b' ? 'bg-[#FFB700]/20 text-[#FFB700] border-[#FFB700]' : voted ? 'opacity-30 cursor-not-allowed border-white/10 text-white/30' : 'border-white/15 bg-white/5 text-white/70 hover:border-white/40 hover:text-white'}`}
                                    style={{ clipPath: CUT_BADGE }}
                                  >
                                    GO {m.tagB}
                                    <span className="opacity-60 font-mono">{pctB}%</span>
                                    {voted === 'b' && ' ✓'}
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Right Navigation Arrow */}
                  <button
                    onClick={handleNext}
                    className="w-10 h-10 bg-black/80 border border-white/20 hover:border-[#FFB700] text-white/50 hover:text-[#FFB700] transition-all flex items-center justify-center z-30 cursor-pointer"
                    style={{ clipPath: CUT_BUTTON }}
                    title="Próximo Jogo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* COMO FUNCIONA — 4 Passos (Chanfrados) */}
        <section className="py-12 px-4 max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter">
              Do Cadastro ao <span className="text-[#FFB700]">Campeonato</span>
            </h2>
            <p className="text-white/40 text-xs md:text-sm mt-2 max-w-xl mx-auto">
              Do cadastro à disputa por prêmios em Pix: 4 passos para colocar seu time na briga pela elite do eSports.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
            {[
              {
                n: '01',
                icon: UserPlus,
                title: 'Crie sua Conta',
                desc: 'Cadastro rápido e seguro. Vincule sua conta Riot Games para checagem de elo oficial.',
                color: '#FFB700',
                bgImage: '/images/poro_step1.webp',
              },
              {
                n: '02',
                icon: Users,
                title: 'Monte seu Time',
                desc: 'Traga seu squad completo ou encontre parceiros de rotas no painel de recrutamento.',
                color: '#00F0FF',
                bgImage: '/images/poro_step2.webp',
              },
              {
                n: '03',
                icon: Trophy,
                title: 'Inscreva-se',
                desc: 'Escolha o campeonato ideal para o nível da sua equipe — do Bronze ao Desafiante.',
                color: '#00FF41',
                bgImage: '/images/poro_step3.webp',
              },
              {
                n: '04',
                icon: SwordsIcon,
                title: 'Compita e Suba',
                desc: 'Jogue partidas competitivas, acumule PDL no ranking global e dispute premiações em Pix.',
                color: '#D500FF',
                bgImage: '/images/poro_step4.webp',
              },
            ].map((step) => (
              <div
                key={step.n}
                className="group relative p-[1px] flex flex-col h-full transition-all"
                style={{
                  clipPath: CUT_FRAME,
                  background: `linear-gradient(135deg, ${step.color}35 0%, ${step.color}10 50%, rgba(255,255,255,0.03) 100%)`,
                }}
              >
                <div
                  className="w-full h-full bg-[#08080a] group-hover:bg-[#0c0c10] transition-colors relative overflow-hidden flex flex-col justify-between"
                  style={{ clipPath: CUT_FRAME_INNER }}
                >
                  {/* Banner de Imagem */}
                  <div className="relative h-44 w-full overflow-hidden bg-[#060608] flex-none">
                    <img
                      src={step.bgImage}
                      alt={step.title}
                      className="w-full h-full object-cover block group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-black/30 pointer-events-none" />

                    {/* Badge do Passo */}
                    <div className="absolute top-3 left-3 z-10">
                      <span
                        className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border"
                        style={{
                          clipPath: CUT_BADGE,
                          backgroundColor: `${step.color}20`,
                          borderColor: `${step.color}60`,
                          color: step.color,
                        }}
                      >
                        Passo {step.n}
                      </span>
                    </div>

                    {/* Número no Canto da Imagem */}
                    <div
                      className="absolute bottom-2 right-3 text-5xl font-black opacity-25 select-none z-10 font-headline"
                      style={{ color: step.color }}
                    >
                      {step.n}
                    </div>
                  </div>

                  {/* Conteúdo do Card */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div
                          className="w-8 h-8 flex items-center justify-center flex-none border"
                          style={{
                            clipPath: CUT_BUTTON,
                            backgroundColor: `${step.color}15`,
                            borderColor: `${step.color}40`,
                            color: step.color,
                          }}
                        >
                          <step.icon className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-white group-hover:text-[#FFB700] transition-colors">
                          {step.title}
                        </h3>
                      </div>

                      <p className="text-white/45 text-xs leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* NOTÍCIAS & ATUALIZAÇÕES */}
        <section className="py-12 px-4 max-w-7xl mx-auto border-t border-white/5">
          <div className="flex flex-col items-center sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div className="text-center sm:text-left">
              <span className="text-[#FFB700] text-[10px] md:text-xs font-black uppercase tracking-[0.3em] inline-flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Informa e Esportes
              </span>
              <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mt-2">
                Fique por <span className="text-[#FFB700]">Dentro</span>
              </h2>
            </div>
            <span className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
              Clique em qualquer matéria para ler na íntegra
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(noticias.length > 0 ? noticias.slice(0, 6) : [
              {
                id: 'demo-1',
                titulo: 'Nova Temporada de Torneios M7 ARENA Anunciada',
                resumo: 'Premiação recorde, novas categorias por tier e narração ao vivo das finais todas as semanas.',
                conteudo: 'A M7 ARENA tem o orgulho de anunciar a abertura oficial da nova temporada de torneios de eSports! Com premiação recorde distribuída em Pix, os campeonatos contarão com transmissões semanais ao vivo com narradores convidados na Twitch. Além disso, criamos novos tiers de entrada para que times iniciantes disputem em igualdade de condições com o mesmo suporte das equipes veteranas. Inscreva seu time hoje mesmo e venha fazer história na plataforma!',
                categoria: 'Torneios',
                date: 'Hoje',
                image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800',
              },
              {
                id: 'demo-2',
                titulo: 'Sistema de Ranking por PDL Atualizado',
                resumo: 'Agora cada vitória nas salas 1v1 e torneios oficiais garante pontos no ranking geral de equipes.',
                conteudo: 'Atualizamos o algoritmo do nosso ranking global! A partir deste patch, cada vitória em salas de enfrentamento 1v1 e em partidas de campeonatos oficiais gera pontuação PDL proporcional ao Elo do adversário. Equipes que mantiverem sequências de vitórias (Win Streak) receberão bônus adicionais de PDL para subir mais rapidamente na tabela do Hall da Fama. Confira seu saldo de PDL no seu perfil!',
                categoria: 'Patch Notes',
                date: 'Há 2 dias',
                image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=800',
              },
              {
                id: 'demo-3',
                titulo: 'Dicas para Capitães: Como Estruturar um Time Campeão',
                resumo: 'Aprenda a selecionar os integrantes, definir horários de treino e alinhar estratégias.',
                categoria: 'Dicas',
                conteudo: 'Liderar uma equipe de eSports exige muito mais do que boa mecânica individual no jogo. Um verdadeiro capitão precisa organizar a comunicação da equipe (Shotcall), alinhar os horários de scrims e treinos semanais, e manter o foco do grupo durante momentos difíceis na partida. Confira nosso guia completo com 5 passos fundamentais para transformar seu time amador em uma máquina de vitórias nos torneios M7!',
                date: 'Há 5 dias',
                image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=800',
              },
            ]).map((n: any) => (
              <div
                key={n.id}
                onClick={() => setSelectedNoticia(n)}
                className="group relative p-[1px] flex flex-col h-full cursor-pointer transition-all"
                style={{
                  clipPath: CUT_FRAME,
                  background: 'linear-gradient(135deg, rgba(255,183,0,0.3) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)',
                  boxShadow: '0 8px 25px -8px rgba(255,183,0,0.1)'
                }}
              >
                <div
                  className="w-full h-full bg-[#08080a] group-hover:bg-[#0c0c10] transition-colors relative overflow-hidden flex flex-col justify-between"
                  style={{ clipPath: CUT_FRAME_INNER }}
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#060608] flex-none">
                    <img
                      src={n.image || n.thumbnail_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800'}
                      alt={n.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-3 left-3">
                      <span
                        className="px-2.5 py-1 bg-[#FFB700] text-black text-[9px] font-black uppercase tracking-widest shadow-md"
                        style={{ clipPath: CUT_BADGE }}
                      >
                        {n.categoria}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-black uppercase tracking-tight text-white line-clamp-2 group-hover:text-[#FFB700] transition-colors leading-tight mb-2">
                        {n.titulo}
                      </h3>
                      <p className="text-white/40 text-xs leading-relaxed line-clamp-3 mb-4">
                        {n.resumo}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                        {n.date || (n.publicado_em ? new Date(n.publicado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Recente')}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#FFB700] group-hover:translate-x-1 transition-transform">
                        Ler Matéria <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DEPOIMENTOS / HALL DA FAMA */}
        <section className="py-12 px-4 max-w-7xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-[#FFB700] text-[10px] md:text-xs font-black uppercase tracking-[0.3em] inline-flex items-center gap-2">
              Hall da Fama & Depoimentos
            </span>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mt-2">
              O que Dizem os <span className="text-[#FFB700]">Jogadores</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                quote:
                  'A M7 ARENA mudou a rotina da BLACK SAILS. A organização das chaves 5v5, o suporte no Discord e a transparência do ranking por PDL são sensacionais!',
                name: 'Portugal',
                role: 'Capitão • BLACK SAILS (BKS)',
                elo: 'CHALLENGER',
                eloColor: '#FFB700',
                avatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80&w=200',
              },
              {
                quote:
                  'Montamos a CONFIDENT e entramos na liga oficial. As salas de enfrentamento 1v1 dão aquela adrenalina diária e a premiação em Pix cai na hora!',
                name: 'Xoxotone',
                role: 'Mid Laner • CONFIDENT (CNF)',
                elo: 'MESTRE',
                eloColor: '#00F0FF',
                avatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&q=80&w=200',
              },
              {
                quote:
                  'Encontrei meus parceiros de rotas pelo recrutamento da plataforma. Hoje jogamos torneios semanais da ACE e-Sports e lutamos pelo topo do Hall da Fama!',
                name: 'Blefy',
                role: 'Capitão • ACE e-Sports (ACE)',
                elo: 'DIAMANTE I',
                eloColor: '#D500FF',
                avatar: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&q=80&w=200',
              },
            ].map((t) => (
              <div
                key={t.name}
                className="group relative p-[1px] flex flex-col h-full transition-all"
                style={{
                  clipPath: CUT_FRAME,
                  background: 'linear-gradient(135deg, rgba(255,183,0,0.2) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)',
                  boxShadow: '0 8px 25px -8px rgba(255,183,0,0.08)'
                }}
              >
                <div
                  className="w-full h-full p-6 bg-[#08080a] group-hover:bg-[#0c0c10] transition-colors relative overflow-hidden flex flex-col justify-between"
                  style={{ clipPath: CUT_FRAME_INNER }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1 text-[#FFB700]">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-[#FFB700]" />
                        ))}
                      </div>
                    </div>

                    <p className="text-white/70 text-xs md:text-sm leading-relaxed italic relative z-10 mb-6">
                      "{t.quote}"
                    </p>
                  </div>

                  <div className="flex items-center gap-3.5 pt-4 border-t border-white/5 relative z-10">
                    <div
                      className="w-11 h-11 p-[1px] flex-none transition-colors"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: 'linear-gradient(135deg, rgba(255,183,0,0.4) 0%, rgba(255,255,255,0.15) 100%)'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] overflow-hidden"
                        style={{ clipPath: CUT_BUTTON_INNER }}
                      >
                        <img
                          src={t.avatar}
                          alt={t.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-black text-white text-sm uppercase tracking-tight group-hover:text-[#FFB700] transition-colors">
                        {t.name}
                      </div>
                      <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        {t.role}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CENTRAL DE COMUNIDADE & REDES SOCIAIS */}
        <section className="py-12 px-4 max-w-7xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span
              className="text-[#FFB700] text-[10px] md:text-xs font-black uppercase tracking-[0.3em] inline-flex items-center gap-2 px-3 py-1 bg-[#FFB700]/10 border border-[#FFB700]/20"
              style={{ clipPath: CUT_BADGE }}
            >
              <Globe className="w-3.5 h-3.5 text-[#FFB700]" />
              Nossa Comunidade
            </span>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mt-3">
              Conecte-se com a <span className="text-[#FFB700]">M7 ARENA</span>
            </h2>
            <p className="text-white/40 text-xs md:text-sm mt-2 max-w-xl mx-auto">
              Faça parte dos nossos canais oficiais para interagir com outros jogadores, receber suporte e acompanhar torneios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card Discord */}
            <div
              className="group relative p-[1px] flex flex-col h-full transition-all"
              style={{
                clipPath: CUT_FRAME,
                background: 'linear-gradient(135deg, rgba(88,101,242,0.35) 0%, rgba(88,101,242,0.12) 50%, rgba(255,255,255,0.03) 100%)',
                boxShadow: '0 8px 25px -8px rgba(88,101,242,0.15)'
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] group-hover:bg-[#0c0c10] transition-colors p-6 md:p-8 flex flex-col justify-between overflow-hidden"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className="w-12 h-12 p-[1px]"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: 'rgba(88,101,242,0.4)'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center text-[#5865F2]"
                        style={{ clipPath: CUT_BUTTON_INNER }}
                      >
                        <FaDiscord className="w-6 h-6" />
                      </div>
                    </div>
                    <span
                      className="px-2.5 py-1 bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/40 text-[9px] font-black uppercase tracking-widest"
                      style={{ clipPath: CUT_BADGE }}
                    >
                      ● 5.000+ Membros
                    </span>
                  </div>

                  <h3 className="text-lg font-black uppercase tracking-tight text-white mb-2 group-hover:text-[#5865F2] transition-colors">
                    Servidor Oficial Discord
                  </h3>
                  <p className="text-white/50 text-xs md:text-sm leading-relaxed mb-6">
                    Ache parceiros de duplas, agende treinos (scrims), tire dúvidas em tempo real com a staff e participe dos canais de voz.
                  </p>
                </div>

                <a
                  href="https://discord.gg/hH9MHKMK9D"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-6 bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(88,101,242,0.4)]"
                  style={{ clipPath: CUT_BUTTON }}
                >
                  <span>Entrar no Discord</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Card WhatsApp */}
            <div
              className="group relative p-[1px] flex flex-col h-full transition-all"
              style={{
                clipPath: CUT_FRAME,
                background: 'linear-gradient(135deg, rgba(37,211,102,0.35) 0%, rgba(37,211,102,0.12) 50%, rgba(255,255,255,0.03) 100%)',
                boxShadow: '0 8px 25px -8px rgba(37,211,102,0.15)'
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] group-hover:bg-[#0c0c10] transition-colors p-6 md:p-8 flex flex-col justify-between overflow-hidden"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className="w-12 h-12 p-[1px]"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: 'rgba(37,211,102,0.4)'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center text-[#25D366]"
                        style={{ clipPath: CUT_BUTTON_INNER }}
                      >
                        <ImWhatsapp className="w-6 h-6" />
                      </div>
                    </div>
                    <span
                      className="px-2.5 py-1 bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 text-[9px] font-black uppercase tracking-widest"
                      style={{ clipPath: CUT_BADGE }}
                    >
                      ● Avisos Instantâneos
                    </span>
                  </div>

                  <h3 className="text-lg font-black uppercase tracking-tight text-white mb-2 group-hover:text-[#25D366] transition-colors">
                    Grupo VIP no WhatsApp
                  </h3>
                  <p className="text-white/50 text-xs md:text-sm leading-relaxed mb-6">
                    Receba alertas em primeira mão sobre inscrições abertas, sorteios de premiações, novidades de patch e avisos diretos.
                  </p>
                </div>

                <a
                  href="https://chat.whatsapp.com/FldhhxNSCp6AP4G4wQWxad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-6 bg-[#25D366] hover:bg-[#1EBE56] text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(37,211,102,0.4)]"
                  style={{ clipPath: CUT_BUTTON }}
                >
                  <span>Entrar no Grupo</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Card Instagram */}
            <div
              className="group relative p-[1px] flex flex-col h-full transition-all"
              style={{
                clipPath: CUT_FRAME,
                background: 'linear-gradient(135deg, rgba(225,48,108,0.35) 0%, rgba(225,48,108,0.12) 50%, rgba(255,255,255,0.03) 100%)',
                boxShadow: '0 8px 25px -8px rgba(225,48,108,0.15)'
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] group-hover:bg-[#0c0c10] transition-colors p-6 md:p-8 flex flex-col justify-between overflow-hidden"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className="w-12 h-12 p-[1px]"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: 'rgba(225,48,108,0.4)'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center text-[#E1306C]"
                        style={{ clipPath: CUT_BUTTON_INNER }}
                      >
                        <Instagram className="w-6 h-6" />
                      </div>
                    </div>
                    <span
                      className="px-2.5 py-1 bg-[#E1306C]/20 text-[#E1306C] border border-[#E1306C]/40 text-[9px] font-black uppercase tracking-widest"
                      style={{ clipPath: CUT_BADGE }}
                    >
                      ● Clips & Conteúdo
                    </span>
                  </div>

                  <h3 className="text-lg font-black uppercase tracking-tight text-white mb-2 group-hover:text-[#E1306C] transition-colors">
                    Instagram @m7academy_
                  </h3>
                  <p className="text-white/50 text-xs md:text-sm leading-relaxed mb-6">
                    Assista aos melhores momentos dos campeonatos, jogadas destacadas da semana, bastidores das finais e memes da comunidade.
                  </p>
                </div>

                <a
                  href="https://www.instagram.com/m7academy_/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-[#E1306C] via-[#FD1D1D] to-[#F56040] hover:opacity-90 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(225,48,108,0.4)]"
                  style={{ clipPath: CUT_BUTTON }}
                >
                  <span>Seguir no Instagram</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ INTERATIVO */}
        <section className="py-12 px-4 max-w-4xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span
              className="text-[#FFB700] text-[10px] md:text-xs font-black uppercase tracking-[0.3em] inline-flex items-center gap-2 px-3 py-1 bg-[#FFB700]/10 border border-[#FFB700]/20"
              style={{ clipPath: CUT_BADGE }}
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#FFB700]" />
              Dúvidas Frequentes
            </span>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mt-3">
              Tudo o que você <span className="text-[#FFB700]">Precisa Saber</span>
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 1,
                q: 'Como funcionam as premiações e saques dos torneios?',
                a: 'Todas as premiações são pagas via Pix para a conta cadastrada do capitão ou integrante do time em até 24 horas úteis após o encerramento do evento. Transparência total: você vê o valor da premiação antes de se inscrever.',
              },
              {
                id: 2,
                q: 'Preciso ter um time fechado de 5 jogadores para competir?',
                a: 'Não! Você pode entrar sozinho nas salas rápidas 1v1 ou publicar seu perfil no nosso painel de Recrutamento — capitães procuram reforços lá todos os dias. Sem time? A M7 ajuda a montar o seu.',
              },
              {
                id: 3,
                q: 'Como é feita a verificação do Elo oficial da Riot Games?',
                a: 'Ao vincular seu Nick + Tag no perfil, o sistema M7 busca sua liga atual na API oficial da Riot Games. Assim, os campeonatos são divididos por tier e você compete contra quem está no mesmo nível — equilíbrio justo, do Bronze ao Desafiante.',
              },
              {
                id: 4,
                q: 'Posso fazer co-stream ou transmitir minhas partidas ao vivo?',
                a: 'Com certeza! Encorajamos todos os jogadores e times a realizarem suas próprias lives. Além disso, as fases finais dos campeonatos contam com transmissão oficial e narração nos canais da M7 ARENA.',
              },
            ].map((item) => {
              const isOpen = openFaqId === item.id;
              return (
                <div
                  key={item.id}
                  className="relative p-[1px] transition-all"
                  style={{
                    clipPath: CUT_BUTTON,
                    background: isOpen ? 'rgba(255,183,0,0.4)' : 'rgba(255,255,255,0.08)'
                  }}
                >
                  <div
                    className="w-full bg-[#08080a] overflow-hidden"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <button
                      onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 font-black uppercase tracking-tight text-sm md:text-base text-white hover:text-[#FFB700] transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-2 h-2 bg-[#FFB700]" style={{ clipPath: CUT_BADGE }} />
                        {item.q}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#FFB700]' : ''}`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 text-white/50 text-xs md:text-sm leading-relaxed border-t border-white/5">
                        {item.a}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* BANNER CTA FINAL */}
        <section className="py-8 px-4 max-w-7xl mx-auto">
          <div
            className="relative p-[1px] w-full shadow-2xl transition-all"
            style={{
              clipPath: CUT_FRAME,
              background: 'linear-gradient(135deg, rgba(255,183,0,0.35) 0%, rgba(255,183,0,0.1) 50%, rgba(255,255,255,0.04) 100%)',
              boxShadow: '0 0 40px -10px rgba(255,183,0,0.15)'
            }}
          >
            <div
              className="w-full bg-[#08080a] p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8"
              style={{ clipPath: CUT_FRAME_INNER }}
            >
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#FFB700]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl text-center md:text-left">
                <span
                  className="px-3 py-1 bg-[#FFB700] text-black text-[10px] font-black uppercase tracking-widest mb-3 inline-block"
                  style={{ clipPath: CUT_BADGE }}
                >
                  Arena Aberta
                </span>
                <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-white">
                  Pronto para Dominar o <span className="text-[#FFB700]">Summoner's Rift?</span>
                </h2>
                <p className="text-white/60 text-xs md:text-sm mt-2 leading-relaxed">
                  Crie sua conta em menos de 1 minuto e entre na disputa por prêmios em Pix — sua vaga está esperando.
                </p>
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button
                  onClick={() => navigate('/campeonatos')}
                  className="px-8 py-4 bg-[#FFB700] hover:bg-[#e0a000] text-black font-black uppercase tracking-wider text-xs transition-all shadow-[0_0_25px_-5px_rgba(255,183,0,0.5)] cursor-pointer flex items-center justify-center gap-2"
                  style={{ clipPath: CUT_BUTTON }}
                >
                  <Trophy className="w-4 h-4" />
                  <span>Ver Campeonatos</span>
                </button>
                <button
                  onClick={() => navigate('/vincular')}
                  className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/20 hover:border-white/40 font-black uppercase tracking-wider text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  style={{ clipPath: CUT_BUTTON }}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Criar / Vincular Conta</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* MODAL DE NOTÍCIAS — LEITURA COMPLETA */}
      <AnimatePresence>
        {selectedNoticia && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-sm"
            onClick={() => setSelectedNoticia(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="relative p-[1px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl transition-all"
              style={{
                clipPath: CUT_FRAME,
                background: 'linear-gradient(135deg, rgba(255,183,0,0.5) 0%, rgba(255,183,0,0.15) 60%, rgba(255,255,255,0.06) 100%)',
                boxShadow: '0 0 50px -10px rgba(255,183,0,0.25)'
              }}
            >
              <div
                className="w-full bg-[#08080a] relative overflow-hidden flex flex-col max-h-[88vh]"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                {/* Image Header */}
                <div className="relative aspect-[16/9] bg-[#060608] overflow-hidden flex-none">
                  <img
                    src={selectedNoticia.image || selectedNoticia.thumbnail_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800'}
                    alt={selectedNoticia.titulo}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-black/40 pointer-events-none" />

                  <button
                    onClick={() => setSelectedNoticia(null)}
                    className="absolute top-4 right-4 w-9 h-9 bg-black/80 border border-white/20 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
                    style={{ clipPath: CUT_BUTTON }}
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-4 left-6 flex items-center gap-2">
                    <span
                      className="px-3 py-1 bg-[#FFB700] text-black text-[10px] font-black uppercase tracking-widest shadow-md"
                      style={{ clipPath: CUT_BADGE }}
                    >
                      {selectedNoticia.categoria || 'Notícia'}
                    </span>
                    {selectedNoticia.date && (
                      <span
                        className="px-3 py-1 bg-black/70 border border-white/15 text-white/80 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm flex items-center gap-1"
                        style={{ clipPath: CUT_BADGE }}
                      >
                        <Calendar className="w-3 h-3 text-[#FFB700]" /> {selectedNoticia.date}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white leading-tight">
                    {selectedNoticia.titulo}
                  </h2>

                  <p className="text-[#FFB700] text-xs sm:text-sm font-bold leading-relaxed border-l-2 border-[#FFB700] pl-3 py-1 bg-[#FFB700]/5">
                    {selectedNoticia.resumo}
                  </p>

                  <div className="text-white/70 text-sm leading-relaxed space-y-3 pt-2 border-t border-white/5 whitespace-pre-line">
                    <p>
                      {selectedNoticia.conteudo || selectedNoticia.resumo || 'Conteúdo completo da matéria em breve. Fique atento às nossas redes sociais para mais informações.'}
                    </p>
                  </div>

                  {selectedNoticia.link_url && (
                    <div className="pt-2">
                      <a
                        href={selectedNoticia.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00F0FF] hover:bg-[#00D8E6] text-black font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        <span>{selectedNoticia.link_texto || 'Acessar Link'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 bg-[#0c0c10] border-t border-white/5 flex items-center justify-between gap-4">
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: selectedNoticia.titulo, url: window.location.href });
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                      }
                    }}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
                    style={{ clipPath: CUT_BUTTON }}
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Compartilhar</span>
                  </button>

                  <button
                    onClick={() => setSelectedNoticia(null)}
                    className="px-6 py-2.5 bg-[#FFB700] hover:bg-[#e0a000] text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                    style={{ clipPath: CUT_BUTTON }}
                  >
                    Fechar Leitura
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
