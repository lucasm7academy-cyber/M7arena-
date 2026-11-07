import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, Play, Users, Shield, Target,
  Crown, Swords, Star, ChevronRight, Globe,
  Cpu, MousePointer2, Medal, Tv2,
  Instagram, BookOpen, Megaphone, ArrowRight, UserPlus, Swords as SwordsIcon,
  HelpCircle, ChevronDown, CheckCircle2, Sparkles, TrendingUp, Gamepad2,
  X, Calendar, Clock, Share2
} from 'lucide-react';
import { FaDiscord, FaTwitch } from "react-icons/fa6";
import { ImWhatsapp } from "react-icons/im";
import { useTransmissoesAtivas } from '../hooks/useTransmissoesAtivas';
import { api } from '../lib/api';
import { UpcomingMatches } from '../components/home/UpcomingMatches';
import { TopTeamsStickers } from '../components/home/TopTeamsStickers';

// ── Peças do design da casa (canto recortado) ────────────────────────────────
const CUT_CARD = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const CUT_CARD_IN = 'polygon(11.8px 0, 100% 0, 100% calc(100% - 11.8px), calc(100% - 11.8px) 100%, 0 100%, 0 11.8px)';
const CUT_TAG = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CUT_TAG_IN = 'polygon(5.8px 0, 100% 0, 100% calc(100% - 5.8px), calc(100% - 5.8px) 100%, 0 100%, 0 5.8px)';

/** Card com o canto recortado do site: moldura 1px + fill opaco, tudo clipado. */
const CardCorte = ({
  children,
  className = '',
  border = 'rgba(255,255,255,0.10)',
  bg = '#08080a',
}: {
  children: React.ReactNode;
  className?: string;
  border?: string;
  bg?: string;
}) => (
  <div className={`relative p-[1px] ${className}`} style={{ clipPath: CUT_CARD, background: border }}>
    <div className="w-full h-full" style={{ clipPath: CUT_CARD_IN, background: bg }}>
      {children}
    </div>
  </div>
);

/** Etiqueta pequena no mesmo corte (categoria, passo, eyebrow). */
const TagCorte = ({ children, color = '#FFB700' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-block p-[1px]" style={{ clipPath: CUT_TAG, background: `${color}90` }}>
    <span
      className="block px-2.5 py-1 bg-[#08080a] text-[9px] font-black uppercase tracking-[0.18em] leading-none"
      style={{ clipPath: CUT_TAG_IN, color }}
    >
      {children}
    </span>
  </span>
);

/** Eyebrow de seção: régua dourada + texto (sem ícone genérico). */
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2.5">
    <span className="h-[2px] w-8 bg-[#FFB700]" />
    <span className="text-[#FFB700] text-[10px] font-black uppercase tracking-[0.3em]">{children}</span>
    <span className="h-[2px] w-8 bg-[#FFB700]/40" />
  </span>
);



// ── Hero do lobby: dois modelos prontos ─────────────────────────────────────
// Para VOLTAR ao hero padrão (texto antigo + vídeo do Lucian), troque
// `HERO_EDICAO` para 'padrao' — nada mais precisa ser mexido.
const HERO_PADRAO = {
  eyebrow: 'M7 ARENA • Campeonatos 2026',
  titulo: ['Seu Time está', 'pronto para vencer?'],
  texto: 'Campeonatos de LoL com premiação em Pix, ranking por PDL e transmissão ao vivo — a vitrine para o seu time brilhar.',
  primario: { label: 'Explorar Torneios', href: '/campeonatos' },
  secundario: { label: 'Crie seu Time', href: '/times' },
  selo: 'Temporada 2026',
  video: '/images/animated-highnoon-lucian.webm' as string | null,
  imagem: null as string | null,
};

const HERO_HALLOWEEN = {
  eyebrow: 'M7 ARENA • INSCRIÇÕES ABERTAS',
  titulo: ['Copa do Halloween', '2026'],
  texto: 'Torneio 5v5 em chaves, premiação em Pix e finais transmitidas ao vivo. Garanta a vaga do seu time.',
  primario: {
    label: 'Inscrever meu time',
    href: 'https://m7arena.pro/campeonato/9987c732-db06-4e51-8e39-e09c31fd9460',
  },
  secundario: { label: 'Ver campeonatos', href: '/campeonatos' },
  selo: 'Halloween 2026',
  video: null as string | null,
  imagem: '/images/hero-halloween-2026.webp' as string | null,
};

const HERO_EDICAO: 'padrao' | 'halloween' = 'halloween';
const HERO = HERO_EDICAO === 'halloween' ? HERO_HALLOWEEN : HERO_PADRAO;

const FeatureCard = ({ icon: Icon, title, description, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="group relative p-8 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-[#FFB700]/30 transition-all duration-500 overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
      <Icon size={120} />
    </div>
    <div className="relative z-10">
      <div className="w-12 h-12 bg-[#FFB700]/10 border border-[#FFB700]/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <Icon className="w-6 h-6 text-[#FFB700]" />
      </div>
      <h3 className="text-xl font-black uppercase tracking-tight mb-3">{title}</h3>
      <p className="text-white/40 text-sm leading-relaxed">{description}</p>
    </div>
  </motion.div>
);

const TournamentPreview = ({ title, prize, date, image, category }: any) => (
  <div className="relative group rounded-xl overflow-hidden border border-white/10 aspect-video">
    <div
      className="absolute inset-0 bg-cover bg-center group-hover:scale-110 transition-transform duration-700"
      style={{ backgroundImage: `url(${image || 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg'})` }}
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 p-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-0.5 bg-[#FFB700] text-black text-[10px] font-black uppercase tracking-widest rounded-sm">{category}</span>
        <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{date}</span>
      </div>
      <h4 className="text-lg font-black uppercase mb-1">{title}</h4>
      <p className="text-[#00FF41] text-xs font-black uppercase tracking-widest flex items-center gap-1">
        <Trophy className="w-3 h-3" /> {prize}
      </p>
    </div>
  </div>
);

const StreamerCard = ({ name, viewers, category, image }: any) => (
  <div className="group relative flex-none w-64 rounded-xl overflow-hidden border border-white/10 bg-black cursor-pointer">
    <div className="aspect-video relative overflow-hidden">
      <img src={image} alt={name} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80" />
      <div className="absolute top-3 left-3 px-2 py-1 bg-red-600 rounded flex items-center gap-1.5 shadow-lg">
        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <span className="text-[9px] font-black uppercase tracking-widest text-white">Live</span>
      </div>
      <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 backdrop-blur-md rounded border border-white/10">
        <span className="text-[9px] font-bold text-white/80 uppercase">{viewers} viewers</span>
      </div>
    </div>
    <div className="p-4 bg-white/[0.02] border-t border-white/5">
      <h4 className="text-sm font-black uppercase text-white group-hover:text-[#FFB700] transition-colors">{name}</h4>
      <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{category}</p>
    </div>
  </div>
);

const TeamRankItem = ({ rank, name, logo, color, points }: any) => (
  <div className="flex items-center justify-between p-4 bg-transparent border border-white/5 rounded-xl hover:border-[#FFB700]/50 hover:bg-[#FFB700]/5 transition-all group">
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-black text-white/20 uppercase leading-none mb-1">Rank</span>
        <span className="text-xl font-black w-8 text-center text-[#FFB700] leading-none">
          #{rank}
        </span>
      </div>
      <div className="w-12 h-12 rounded-lg bg-black border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-[#FFB700]/30 transition-colors">
        <img src={logo} alt={name} loading="lazy" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
      </div>
      <div>
        <h4 className="text-base font-black uppercase tracking-tight transition-colors" style={{ color: color }}>{name}</h4>
      </div>
    </div>
    <div className="text-right">
      <div className="text-[#FFB700] font-black text-sm">{points}</div>
      <div className="text-[8px] text-[#FFB700]/40 uppercase font-black tracking-widest">PDL</div>
    </div>
  </div>
);


const MatchHistoryItem = ({ tagA, tagB, logoA, logoB, scoreA, scoreB, date, colorA, colorB }: any) => (
  <div className="group flex flex-col md:flex-row items-center justify-center p-6 bg-[#0a0a0a] border border-white/5 rounded-xl hover:border-white/20 transition-all gap-8">
    <div className="flex items-center gap-6 md:gap-16 flex-1 justify-center">
      {/* Team A */}
      <div className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
        <div className="w-12 h-12 rounded-lg bg-black border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-white/20 transition-colors">
          <img src={logoA} alt={tagA} loading="lazy" className="w-full h-full object-cover opacity-80" />
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest text-center" style={{ color: colorA }}>{tagA}</span>
      </div>

      {/* Score & Time */}
      <div className="flex flex-col items-center gap-2 min-w-[140px]">
        <div className="flex items-center gap-4">
          <span className={`text-3xl font-black ${scoreA > scoreB ? 'text-[#00FF41]' : scoreA < scoreB ? 'text-red-500' : 'text-white'}`}>{scoreA}</span>
          <span className="text-white/10 font-bold text-2xl">:</span>
          <span className={`text-3xl font-black ${scoreB > scoreA ? 'text-[#00FF41]' : scoreB < scoreA ? 'text-red-500' : 'text-white'}`}>{scoreB}</span>
        </div>
        <span className="text-[10px] text-white/20 uppercase font-black tracking-widest whitespace-nowrap">{date}</span>
      </div>

      {/* Team B */}
      <div className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
        <div className="w-12 h-12 rounded-lg bg-black border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-white/20 transition-colors">
          <img src={logoB} alt={tagB} loading="lazy" className="w-full h-full object-cover opacity-80" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-center" style={{ color: colorB }}>{tagB}</span>
      </div>
    </div>
  </div>
);


const SocialCard = ({ icon: Icon, title, platform, color, link }: any) => (
  <a
    href={link}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-all flex items-center gap-4"
  >
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center transition-all group-hover:scale-110"
      style={{ backgroundColor: `${color}10`, border: `1px solid ${color}20` }}
    >
      <Icon className="w-5 h-5" style={{ color: color }} />
    </div>
    <div className="flex flex-col">
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">{platform}</span>
      <h4 className="text-xs font-black uppercase text-white group-hover:text-[#FFB700] transition-colors">{title}</h4>
    </div>
    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
      <ChevronRight className="w-4 h-4 text-white/20" />
    </div>
  </a>
);
const PadraoLiveCard = ({ titulo, streamer, thumbnail, link }: any) => (
  <a
    href={link}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative flex-none w-[calc(100vw-32px)] sm:w-[340px] md:w-[400px] snap-center bg-[#0a0a0a] border-2 border-[#9146FF]/20 rounded-2xl hover:border-[#9146FF] transition-all duration-500 overflow-hidden shadow-2xl flex flex-col"
  >
    {/* Badge "Ao Vivo" */}
    <div className="w-full px-4 pt-4 pb-2 absolute top-0 left-0 z-20">
      <div className="flex items-center gap-2 px-3 py-2 bg-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest text-white ring-1 ring-white/20 w-fit">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        Ao Vivo
      </div>
    </div>

    {/* Thumbnail */}
    <div className="relative w-full aspect-video overflow-hidden">
      <img
        src={thumbnail}
        alt={titulo}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
    </div>

    {/* Título + streamer */}
    <div className="w-full px-4 py-3 flex-1">
      <p className="text-sm font-bold text-white line-clamp-2 leading-tight">{titulo}</p>
      <span className="text-[12px] font-black text-[#9146FF] uppercase tracking-[0.15em] mt-1 block">@{streamer}</span>
    </div>

    {/* Bottom Button - colado */}
    <div className="w-full bg-white py-5 flex items-center justify-center border-t border-black/5">
      <span className="text-[14px] font-black uppercase tracking-[0.4em] text-[#9146FF]">
        ASSISTIR AGORA!
      </span>
    </div>
  </a>
);

const HighlightCard = ({ titulo, thumbnail, link, categoria }: any) => (
  <a
    href={link}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative flex-none w-[calc(100vw-32px)] sm:w-[340px] md:w-[400px] snap-center bg-[#0a0a0a] border-2 border-[#9146FF]/20 rounded-2xl hover:border-[#9146FF] transition-all duration-500 overflow-hidden shadow-2xl flex flex-col"
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
      {/* Badge roxo com estrela branca */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-2 bg-[#9146FF] rounded text-[8px] font-black uppercase tracking-widest text-white">
        ★ {categoria === 'clutch' ? 'Clutch' : categoria === 'jogada' ? 'Jogada' : categoria === 'engracado' ? 'Engraçado' : categoria === 'top5' ? 'Top 5' : categoria === 'compilacao' ? 'Compilação' : categoria === 'semana' ? 'Destaques' : 'Highlight'}
      </div>
    </div>
    <div className="w-full px-4 py-3 flex-1">
      <p className="text-sm font-bold text-white line-clamp-2 leading-tight">{titulo}</p>
    </div>
    {/* Botão roxo embaixo */}
    <div className="w-full bg-[#9146FF] py-5 flex items-center justify-center border-t border-black/5">
      <span className="text-[14px] font-black uppercase tracking-[0.4em] text-white">ASSISTIR AGORA!</span>
    </div>
  </a>
);

const LiveBroadcastCard = ({ teamA, teamB, logoA, logoB, tagA, tagB, streamer, link, colorA, colorB, titulo, modo, nomecamp }: any) => {
  // Gerar título automático baseado no modo
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
    className="group relative flex-none w-[calc(100vw-32px)] sm:w-[340px] md:w-[400px] snap-center bg-[#0a0a0a] border-2 border-[#9146FF]/20 rounded-2xl hover:border-[#9146FF] transition-all duration-500 overflow-hidden shadow-2xl flex flex-col"
  >
    {/* Badge "Ao Vivo" */}
    <div className="w-full px-4 pt-4 pb-2 absolute top-0 left-0 z-20">
      <div className="flex items-center gap-2 px-3 py-2 bg-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest text-white ring-1 ring-white/20 w-fit">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        Ao Vivo
      </div>
    </div>

    {/* Teams matchup (instead of thumbnail) */}
    <div className="relative w-full aspect-video overflow-hidden bg-black bg-gradient-to-br from-black/80 to-black/60 flex flex-col items-center">
      <div className="flex-1" />
      <div className="relative z-10 flex items-center justify-between w-full gap-4 px-4 pb-6">
        {/* Team A */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="w-20 h-20 md:w-28 md:h-28 flex items-center justify-center group-hover:scale-110 transition-transform duration-700 rounded-lg border border-white/10">
            <img src={logoA} alt={teamA} className="w-full h-full object-contain rounded-md" />
          </div>
          <span className="text-[14px] font-black uppercase tracking-widest block truncate mt-2" style={{ color: colorA || '#ffffff' }}>{tagA}</span>
        </div>

        {/* VS */}
        <div className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase leading-none group-hover:scale-110 transition-transform">VS</div>

        {/* Team B */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="w-20 h-20 md:w-28 md:h-28 flex items-center justify-center group-hover:scale-110 transition-transform duration-700 rounded-lg border border-white/10">
            <img src={logoB} alt={teamB} className="w-full h-full object-contain rounded-md" />
          </div>
          <span className="text-[14px] font-black uppercase tracking-widest block truncate mt-2" style={{ color: colorB || '#ffffff' }}>{tagB}</span>
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent pointer-events-none" />
    </div>

    {/* Título automático + Streamer name */}
    <div className="w-full px-4 py-3 flex-1 flex flex-col justify-between">
      <p className="text-sm font-bold text-white line-clamp-1 leading-tight">{tituloFinal}</p>
      <span className="text-[12px] font-black text-[#9146FF] uppercase tracking-[0.15em] mt-1 block">@{streamer}</span>
    </div>

    {/* Bottom Button - colado */}
    <div className="w-full bg-white py-5 flex items-center justify-center border-t border-black/5">
      <span className="text-[14px] font-black uppercase tracking-[0.4em] text-[#9146FF]">
        ASSISTIR AGORA!
      </span>
    </div>
  </a>
  );
};

// Evita refetch ao navegar Lobby ↔ outras páginas ↔ Lobby de novo.
const _HIGHLIGHTS_CACHE_TTL = 5 * 60 * 1000;
let _highlightsCache: { data: Array<{ id: string; titulo: string; link: string; thumbnail_url: string | null; categoria: string }>; ts: number } | null = null;

const Home = () => {
  const navigate = useNavigate();
  const liveScrollRef = React.useRef<HTMLDivElement>(null);
  const { transmissoes, loading: loadingLives } = useTransmissoesAtivas();

  const [highlights, setHighlights] = React.useState<Array<{ id: string; titulo: string; link: string; thumbnail_url: string | null; categoria: string }>>([]);
  const [openFaqId, setOpenFaqId] = React.useState<number | null>(null);
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

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const { current } = ref;
      // Scroll by one card width (responsive) + gap (24px)
      let cardWidth = 424; // Default md (400 + 24)
      if (window.innerWidth < 640) cardWidth = window.innerWidth - 8; // Small mobile (calc(100vw - 32px) + gap 24px)
      else if (window.innerWidth < 768) cardWidth = 364; // sm (340 + 24)

      current.scrollBy({
        left: direction === 'left' ? -cardWidth : cardWidth,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative overflow-x-hidden">
      {/* Scanline Effect */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,118,0.03))] bg-[length:100%_2px,3px_100%] z-[100] opacity-20" />

      {/* HERO SECTION - BANNER PRINCIPAL STYLE */}
      <section className="pt-10 pb-4 px-4 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative p-[1px] aspect-[4/5] sm:aspect-video md:aspect-[1.8/1] lg:aspect-[2.2/1] xl:aspect-[2.4/1] min-h-[380px] sm:min-h-[400px] w-full group bg-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          style={{ clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)' }}
        >
          <div
            className="relative w-full h-full bg-black overflow-hidden"
            style={{ clipPath: 'polygon(17.4px 0, 100% 0, 100% calc(100% - 17.4px), calc(100% - 17.4px) 100%, 0 100%, 0 17.4px)' }}
          >
          {/* Hero: modelo atual em HERO_EDICAO (topo do arquivo).
              - 'halloween' → arte da Copa do Halloween 2026
              - 'padrao'    → vídeo do Lucian (/images/animated-highnoon-lucian.webm)
              O vídeo do Lucian segue salvo no repositório. */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            {/* fades nas 4 bordas: a arte dissolve no card em vez de parecer cortada */}
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, #000 0%, rgba(0,0,0,0.72) 14%, rgba(0,0,0,0.28) 34%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.12) 74%, rgba(0,0,0,0.6) 92%, #000 100%)',
              }}
            />
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 16%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.18) 74%, rgba(0,0,0,0.8) 100%)',
              }}
            />
            {HERO.video ? (
              <video
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover object-[center_15%] opacity-80 transition-transform duration-700 group-hover:scale-105"
              >
                <source src={HERO.video} type="video/webm" />
              </video>
            ) : (
              <img
                src={HERO.imagem ?? ''}
                alt="Copa do Halloween 2026"
                className="w-full h-full object-cover object-center opacity-90 scale-[0.96] transition-transform duration-700 group-hover:scale-100"
              />
            )}
          </div>

          {/* Content Wrapper */}
          <div className="relative z-20 flex flex-col justify-end sm:justify-center px-5 sm:px-10 md:px-14 lg:px-16 xl:px-20 pb-8 pt-20 sm:py-8 lg:py-8 xl:py-10 max-w-4xl w-full h-full">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3 sm:space-y-4 lg:space-y-4 xl:space-y-6"
            >
              <div className="flex items-center gap-2">

                <span className="text-[#FFB700] text-[10px] md:text-xs xl:text-sm font-black uppercase tracking-[0.3em]">
                  {HERO.eyebrow}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-7xl font-black uppercase leading-[0.9] tracking-tighter break-words">
                {HERO.titulo[0]} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40">
                  {HERO.titulo[1]}
                </span>
              </h1>

              <p className="text-white/40 text-[10px] sm:text-xs md:text-sm xl:text-lg font-medium max-w-xs sm:max-w-xl leading-relaxed">
                {HERO.texto}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 md:gap-3 xl:gap-4 pt-2 sm:pt-3 xl:pt-4">
                <button
                  onClick={() => {
                    if (HERO.primario.href.startsWith('http')) {
                      window.open(HERO.primario.href, '_blank', 'noopener,noreferrer');
                    } else {
                      navigate(HERO.primario.href);
                    }
                  }}
                  className="group relative px-5 md:px-7 xl:px-10 py-3 md:py-3.5 xl:py-4 bg-[#FFB700] text-black font-black text-[10px] xl:text-xs uppercase tracking-[0.2em] overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,183,0,0.3)]"
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, 100% 70%, 90% 100%, 0 100%)'
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">{HERO.primario.label} <ChevronRight size={14} /></span>
                </button>

                <button
                  onClick={() => navigate(HERO.secundario.href)}
                  className="group relative px-5 md:px-7 xl:px-10 py-3 md:py-3.5 xl:py-4 border border-white/20 text-white font-black text-[10px] xl:text-xs uppercase tracking-[0.2em] overflow-hidden transition-all hover:bg-white/5 hover:border-white/40 active:scale-95 rounded-sm"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">{HERO.secundario.label} <ChevronRight size={14} /></span>
                </button>
              </div>
            </motion.div>
          </div>

          {/* Destaque Tag Floating */}
          <div className="hidden sm:block absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
            <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFB700] animate-pulse" />
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-[#FFB700]">{HERO.selo}</span>
            </div>
          </div>
          </div>
        </motion.div>
      </section>

      {/* AO VIVO AGORA - LIVE STREAMS */}
      {!loadingLives && transmissoes.length > 0 && (
        <section className="py-6 px-4 max-w-[1400px] mx-auto">
          <div className="space-y-8">
            <div className="flex flex-col items-center sm:flex-row sm:items-end justify-between gap-4 border-b border-white/5 pb-6">
              <div className="space-y-2 text-center sm:text-left">
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter flex items-center justify-center sm:justify-start gap-4">
                  <FaTwitch className="text-[#9146FF] w-8 h-8 md:w-12 md:h-12" />
                  Assista <span className="text-[#9146FF]">Agora</span>
                </h2>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={() => scroll(liveScrollRef, 'left')}
                  className="w-10 h-10 border border-white/10 rounded-full flex items-center justify-center hover:bg-[#9146FF] hover:border-[#9146FF] transition-all text-white/40 hover:text-white"
                >
                  <ChevronRight size={18} className="rotate-180" />
                </button>
                <button
                  onClick={() => scroll(liveScrollRef, 'right')}
                  className="w-10 h-10 border border-white/10 rounded-full flex items-center justify-center hover:bg-[#9146FF] hover:border-[#9146FF] transition-all text-white/40 hover:text-white"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="relative group/live-slider">
              <button
                onClick={() => scroll(liveScrollRef, 'left')}
                className="flex sm:hidden absolute left-0 top-1/2 -translate-y-[60%] -translate-x-2 z-30 w-10 h-10 items-center justify-center text-[#9146FF] active:scale-90 transition-all font-bold"
              >
                <ChevronRight className="rotate-180" size={20} />
              </button>

              <div
                ref={liveScrollRef}
                className="flex gap-6 overflow-x-auto hide-scrollbar pb-8 px-4 -mx-4 scroll-smooth snap-x snap-mandatory sm:snap-none"
              >
                {/* Lives ativas — sempre primeiro */}
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

                {/* Highlights — aparecem sempre após as lives */}
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
                className="flex sm:hidden absolute right-0 top-1/2 -translate-y-[60%] translate-x-2 z-30 w-10 h-10 items-center justify-center text-[#9146FF] active:scale-90 transition-all font-bold"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </section>
      )}

      <UpcomingMatches />

      {/* TOP 3 TIMES DA ARENA — FIGURINHAS COLECIONÁVEIS ESTILO COPA */}
      <TopTeamsStickers />


      {/* ════════════════════════════════════════════════════════════════
          COMO FUNCIONA — Linha do Tempo da Jornada com Banners de Imagem
         ════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 max-w-[1400px] mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">
            Do Cadastro ao <span className="text-[#FFB700]">Campeonato</span>
          </h2>
          <p className="text-white/40 text-sm md:text-base mt-3 max-w-xl mx-auto">
            Do cadastro à disputa por prêmios em Pix: 4 passos para colocar seu time na briga pela elite do eSports.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {[
            {
              n: '01',
              icone: '/images/icon-poro.png',
              title: 'Crie sua Conta',
              desc: 'Cadastro rápido e seguro. Vincule sua conta Riot Games para checagem de elo oficial.',
              bgImage: '/images/poro_step1.webp',
            },
            {
              n: '02',
              icone: '/lanes_brancas/icon-position-fillB.png',
              title: 'Monte seu Time',
              desc: 'Traga seu squad completo e organize o lineup do time — o capitão adiciona titulares, reservas e coach.',
              bgImage: '/images/poro_step2.webp',
            },
            {
              n: '03',
              icone: '/ranks/crests/gold.svg',
              title: 'Inscreva-se',
              desc: 'Escolha o campeonato ideal para o nível da sua equipe — do Bronze ao Desafiante — e garanta sua vaga nas chaves.',
              bgImage: '/images/poro_step3.webp',
            },
            {
              n: '04',
              icone: '/ranks/crests/challenger.svg',
              title: 'Compita e Suba',
              desc: 'Jogue partidas competitivas, acumule PDL no ranking global e dispute premiações em Pix.',
              bgImage: '/images/poro_step4.webp',
            },
          ].map((step, idx) => (
            <CardCorte
              key={step.n}
              className="group transition-transform duration-500 hover:scale-[1.02] shadow-2xl"
              border="rgba(255,255,255,0.10)"
            >
              <motion.div
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex flex-col h-full"
              >
                {/* banner do poro */}
                <div className="relative h-44 w-full overflow-hidden bg-[#151515]">
                  <img
                    src={step.bgImage}
                    alt={step.title}
                    className="w-full h-full object-cover block group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/25 to-black/40 pointer-events-none" />

                  {/* número do passo */}
                  <div className="absolute top-3 left-3 z-10">
                    <TagCorte>Passo {step.n}</TagCorte>
                  </div>

                  {/* ícone do League */}
                  <div
                    className="absolute top-3 right-3 z-10 w-11 h-11 p-[1px]"
                    style={{ clipPath: CUT_TAG, background: 'rgba(255,183,0,0.55)' }}
                  >
                    <div
                      className="w-full h-full bg-black/80 backdrop-blur-md flex items-center justify-center overflow-hidden"
                      style={{ clipPath: CUT_TAG_IN }}
                    >
                      <img src={step.icone} alt="" className="w-7 h-7 object-contain" />
                    </div>
                  </div>
                </div>

                {/* texto */}
                <div className="p-6 flex-1">
                  <h3 className="text-base font-black uppercase tracking-tight text-white group-hover:text-[#FFB700] transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-white/50 text-xs leading-relaxed mt-2">{step.desc}</p>
                </div>

                <div className="h-[2px] w-full bg-gradient-to-r from-[#FFB700] via-[#FFB700]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            </CardCorte>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          DEPOIMENTOS — Avatares Estilo Anime / Gamer Real
         ════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 max-w-[1400px] mx-auto border-t border-white/5">
        <div className="text-center mb-14">
          <span className="text-[#FFB700] text-[10px] md:text-xs font-black uppercase tracking-[0.3em] inline-flex items-center gap-2">
            Hall da Fama & Depoimentos
          </span>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mt-3">
            O que Dizem os <span className="text-[#FFB700]">Jogadores</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                'Encontrei meus parceiros de rotas pelos times da plataforma. Hoje jogamos torneios semanais da ACE e-Sports e lutamos pelo topo do Hall da Fama!',
              name: 'Blefy',
              role: 'Capitão • ACE e-Sports (ACE)',
              elo: 'DIAMANTE I',
              eloColor: '#D500FF',
              avatar: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&q=80&w=200',
            },
          ].map((t, idx) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="relative p-7 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-[#FFB700]/30 transition-all duration-500 flex flex-col justify-between overflow-hidden group"
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
                  {t.quote}
                </p>
              </div>

              <div className="flex items-center gap-3.5 pt-5 border-t border-white/5 relative z-10">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-11 h-11 rounded-full object-cover border-2 border-white/20 group-hover:border-[#FFB700] transition-colors"
                />
                <div>
                  <div className="font-black text-white text-sm uppercase tracking-tight group-hover:text-[#FFB700] transition-colors">
                    {t.name}
                  </div>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    {t.role}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          CENTRAL DE COMUNIDADE & REDES SOCIAIS — Clean sem marca d'água gigante
         ════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 max-w-[1400px] mx-auto border-t border-white/5">
        <div className="text-center mb-14">
          <Eyebrow>Nossa Comunidade</Eyebrow>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mt-4">
            Conecte-se com a <span className="text-[#FFB700]">M7 ARENA</span>
          </h2>
          <p className="text-white/40 text-sm md:text-base mt-3 max-w-xl mx-auto">
            Faça parte dos nossos canais oficiais para interagir com outros jogadores, receber suporte e acompanhar torneios.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Discord */}
          <motion.div
            whileHover={{ y: -5 }}
            className="group relative p-8 bg-gradient-to-b from-[#5865F2]/15 via-[#0a0a10] to-[#08080a] transition-all duration-500 flex flex-col justify-between overflow-hidden shadow-2xl"
            style={{ clipPath: CUT_CARD }}
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center text-[#5865F2] shadow-lg group-hover:scale-110 transition-transform">
                  <FaDiscord className="w-8 h-8" />
                </div>
                <span className="px-3 py-1 bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/40 text-[9px] font-black uppercase tracking-widest rounded-full">
                  ● 5.000+ Membros
                </span>
              </div>

              <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2 group-hover:text-[#5865F2] transition-colors">
                Servidor Oficial Discord
              </h3>
              <p className="text-white/50 text-xs md:text-sm leading-relaxed mb-6">
                Ache parceiros de duplas, agende treinos (scrims), tire dúvidas em tempo real com a staff e participe dos canais de voz durante as rodadas.
              </p>
            </div>

            <a
              href="https://discord.gg/hH9MHKMK9D"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-6 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#5865F2]/40"
            >
              <span>Entrar no Discord</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>

          {/* Card WhatsApp */}
          <motion.div
            whileHover={{ y: -5 }}
            className="group relative p-8 bg-gradient-to-b from-[#25D366]/15 via-[#0a0a10] to-[#08080a] transition-all duration-500 flex flex-col justify-between overflow-hidden shadow-2xl"
            style={{ clipPath: CUT_CARD }}
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center text-[#25D366] shadow-lg group-hover:scale-110 transition-transform">
                  <ImWhatsapp className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 text-[9px] font-black uppercase tracking-widest rounded-full">
                  ● Avisos Instantâneos
                </span>
              </div>

              <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2 group-hover:text-[#25D366] transition-colors">
                Grupo VIP no WhatsApp
              </h3>
              <p className="text-white/50 text-xs md:text-sm leading-relaxed mb-6">
                Receba alertas em primeira mão sobre inscrições abertas, sorteios de premiações, novidades de patch e avisos diretos no celular.
              </p>
            </div>

            <a
              href="https://chat.whatsapp.com/FldhhxNSCp6AP4G4wQWxad"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-6 rounded-xl bg-[#25D366] hover:bg-[#1EBE56] text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#25D366]/40"
            >
              <span>Entrar no Grupo</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>

          {/* Card Instagram */}
          <motion.div
            whileHover={{ y: -5 }}
            className="group relative p-8 bg-gradient-to-b from-[#E1306C]/15 via-[#0a0a10] to-[#08080a] transition-all duration-500 flex flex-col justify-between overflow-hidden shadow-2xl"
            style={{ clipPath: CUT_CARD }}
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-[#E1306C]/20 border border-[#E1306C]/40 flex items-center justify-center text-[#E1306C] shadow-lg group-hover:scale-110 transition-transform">
                  <Instagram className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 bg-[#E1306C]/20 text-[#E1306C] border border-[#E1306C]/40 text-[9px] font-black uppercase tracking-widest rounded-full">
                  ● Clips & Conteúdo
                </span>
              </div>

              <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2 group-hover:text-[#E1306C] transition-colors">
                Instagram @m7academy_
              </h3>
              <p className="text-white/50 text-xs md:text-sm leading-relaxed mb-6">
                Assista aos melhores momentos dos campeonatos, jogadas destacadas da semana, bastidores das finais e memes da nossa comunidade.
              </p>
            </div>

            <a
              href="https://www.instagram.com/m7academy_/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#E1306C] via-[#FD1D1D] to-[#F56040] hover:opacity-90 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#E1306C]/40"
            >
              <span>Seguir no Instagram</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FAQ INTERATIVO — Dúvidas Frequentes
         ════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 max-w-4xl mx-auto border-t border-white/5">
        <div className="text-center mb-14">
          <span className="text-[#FFB700] text-[10px] md:text-xs font-black uppercase tracking-[0.3em] inline-flex items-center gap-2 px-3 py-1 bg-[#FFB700]/10 border border-[#FFB700]/20 rounded-full">
            <HelpCircle className="w-3.5 h-3.5 text-[#FFB700]" />
            Dúvidas Frequentes
          </span>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mt-4">
            Tudo o que você <span className="text-[#FFB700]">Precisa Saber</span>
          </h2>
        </div>

        <div className="space-y-4">
          {[
            {
              id: 1,
              q: 'Como funcionam as premiações e saques dos torneios?',
              a: 'Todas as premiações são pagas via Pix para a conta cadastrada do capitão ou integrante do time em até 24 horas úteis após o encerramento do evento. Transparência total: você vê o valor da premiação antes de se inscrever.',
            },
            {
              id: 2,
              q: 'Preciso ter um time fechado de 5 jogadores para competir?',
              a: 'Não! Você pode entrar sozinho nas salas rápidas 1v1 ou entrar em um time pelo painel de Times — capitães procuram reforços lá todos os dias. Sem time? A M7 ajuda a montar o seu.',
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
                className={`relative bg-[#0b0b0f] border rounded-2xl overflow-hidden transition-all duration-300 ${
                  isOpen ? 'border-[#FFB700]/50' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <span
                  className={`absolute left-0 top-0 bottom-0 w-[3px] transition-opacity duration-300 ${
                    isOpen ? 'bg-[#FFB700] opacity-100' : 'bg-[#FFB700] opacity-0'
                  }`}
                />
                <button
                  onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-black uppercase tracking-tight text-sm md:text-base text-white hover:text-[#FFB700] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rotate-45 bg-[#FFB700] shrink-0" />
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 text-white/40 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#FFB700]' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-2 text-white/50 text-xs md:text-sm leading-relaxed border-t border-white/5">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          BANNER CTA FINAL — Call-to-Action Épico
         ════════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 max-w-[1400px] mx-auto">
        <div className="relative rounded-3xl p-8 md:p-14 bg-gradient-to-r from-black via-[#FFB700]/10 to-black border border-[#FFB700]/30 overflow-hidden shadow-2xl text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#FFB700]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl">
            <span className="px-3 py-1 bg-[#FFB700] text-black text-[10px] font-black uppercase tracking-widest rounded-full mb-4 inline-block">
              Arena Aberta
            </span>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white">
              Pronto para Dominar o <span className="text-[#FFB700]">Summoner's Rift?</span>
            </h2>
            <p className="text-white/60 text-sm md:text-base mt-3 leading-relaxed">
              Crie sua conta em menos de 1 minuto e entre na disputa por prêmios em Pix — sua vaga está esperando.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <button
              onClick={() => navigate('/campeonatos')}
              className="px-8 py-4 bg-[#FFB700] hover:bg-[#FFA800] text-black font-black uppercase tracking-wider text-xs md:text-sm rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <Trophy className="w-4 h-4" />
              <span>Ver Campeonatos</span>
            </button>
            <button
              onClick={() => navigate('/vincular')}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/15 font-black uppercase tracking-wider text-xs md:text-sm rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Criar / Vincular Conta</span>
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
