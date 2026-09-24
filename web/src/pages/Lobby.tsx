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
import { TopTeamsStickers } from '../components/home/TopTeamsStickers';



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
      style={{ backgroundImage: `url(${image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800'})` }}
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

interface UpcomingMatch {
  id: string;
  tagA: string;
  nameA?: string;
  colorA: string;
  colorA2?: string;
  logoA: string;
  tagB: string;
  nameB?: string;
  colorB: string;
  colorB2?: string;
  logoB: string;
  date: string;
  time: string;
  campId?: string;
  campTitle?: string;
  campColor?: string;
  fase?: string;
}

const _UPCOMING_CACHE_TTL = 5 * 60 * 1000;
const _UPCOMING_CACHE_VER = 4; // bump ao mudar estrutura
let _upcomingCache: { data: UpcomingMatch[]; ts: number; v: number } | null = null;

// Efeito dinâmico de pincelada de tinta acrílica (brush stroke) na cor do time
const TeamBrushStroke = ({ color, isLeft }: { color: string; isLeft: boolean }) => (
  <div
    className={`absolute pointer-events-none z-0 flex items-center justify-center transition-all duration-700 ${
      isLeft
        ? '-left-10 sm:-left-16 md:-left-24 -right-4 md:-right-8'
        : '-right-10 sm:-right-16 md:-right-24 -left-4 md:-left-8 scale-x-[-1]'
    }`}
  >
    {/* Fumaça / Vapor Atmosférico Difuso na Cor do Time */}
    <div
      className="absolute w-[240px] h-[160px] md:w-[380px] md:h-[220px] rounded-full blur-[45px] md:blur-[70px] opacity-45 pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at center, ${color} 0%, ${color}40 50%, transparent 75%)`,
      }}
    />

    {/* Halo Secundário com Iluminação Suave */}
    <div
      className="absolute w-[180px] h-[120px] md:w-[280px] md:h-[180px] rounded-full blur-[30px] opacity-35 pointer-events-none"
      style={{
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      }}
    />

    {/* Pincelada de Tinta Vetorial / Acrylic Brush Stroke */}
    <svg
      viewBox="0 0 530 220"
      className="w-[260px] sm:w-[340px] md:w-[440px] h-auto opacity-80 transition-transform duration-700 group-hover/crest:scale-105"
      style={{ color, filter: `drop-shadow(0 0 16px ${color}80)` }}
      fill="currentColor"
    >
      {/* 1. Traço Principal Largo com Textura e Variação de Pressão */}
      <path
        d="M 25 110 C 45 95, 75 102, 110 98 C 160 92, 215 88, 270 94 C 330 100, 395 106, 445 98 C 475 93, 502 96, 510 112 C 516 125, 498 138, 465 142 C 405 150, 335 146, 265 148 C 195 150, 125 154, 75 146 C 40 140, 15 132, 18 122 C 20 115, 22 112, 25 110 Z"
        opacity="0.85"
      />

      {/* 2. Cerdas Superiores Arrastadas (Dry Brush Superior) */}
      <path
        d="M 60 78 C 110 68, 175 66, 240 70 C 310 74, 385 78, 440 68 C 465 63, 485 66, 475 74 C 455 82, 400 84, 345 82 C 275 80, 205 78, 140 84 C 95 88, 65 86, 55 82 C 52 80, 56 79, 60 78 Z"
        opacity="0.65"
      />

      {/* 3. Cerdas Inferiores Arrastadas (Dry Brush Inferior) */}
      <path
        d="M 45 160 C 95 162, 150 166, 210 168 C 280 170, 350 174, 420 166 C 455 162, 480 168, 490 175 C 475 182, 430 180, 375 182 C 300 184, 225 182, 150 186 C 100 188, 55 182, 35 174 C 30 170, 38 162, 45 160 Z"
        opacity="0.6"
      />

      {/* 4. Núcleo Vigoroso da Pincelada */}
      <path
        d="M 12 128 C 30 118, 90 115, 160 118 C 240 121, 330 124, 420 120 C 470 118, 505 125, 515 132 C 495 140, 440 136, 360 138 C 270 140, 175 138, 95 142 C 45 144, 18 138, 10 132 C 8 130, 10 129, 12 128 Z"
        opacity="0.9"
      />

      {/* 5. Linhas Finas de Cerdas Secas (Bristle Trails) */}
      <path d="M 30 92 Q 120 82 230 84 T 430 80 Q 470 78 495 82" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5" />
      <path d="M 20 148 Q 110 154 220 152 T 440 156 Q 480 158 505 152" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.45" />
      <path d="M 50 102 Q 160 98 280 102 T 480 96" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4" />
      <path d="M 40 136 Q 150 138 270 136 T 470 140" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4" />

      {/* 6. Respingo e Pontas Angulares da Pincelada */}
      <path d="M 470 85 C 485 70, 505 65, 512 75 C 500 88, 485 92, 470 85 Z" opacity="0.75" />
      <path d="M 490 135 C 508 128, 522 135, 518 145 C 505 150, 492 145, 490 135 Z" opacity="0.8" />
      <path d="M 450 165 C 470 178, 485 185, 478 195 C 462 190, 452 178, 450 165 Z" opacity="0.7" />
      <path d="M 35 98 C 22 85, 12 88, 15 78 C 25 75, 38 85, 35 98 Z" opacity="0.7" />
      <path d="M 25 152 C 12 165, 5 160, 8 172 C 18 172, 26 162, 25 152 Z" opacity="0.75" />

      {/* 7. Gotículas e Partículas de Tinta */}
      <circle cx="505" cy="62" r="3.5" opacity="0.7" />
      <circle cx="518" cy="92" r="4.5" opacity="0.8" />
      <circle cx="525" cy="120" r="3" opacity="0.6" />
      <circle cx="512" cy="162" r="4" opacity="0.75" />
      <circle cx="488" cy="198" r="3.5" opacity="0.6" />
      <circle cx="15" cy="72" r="3" opacity="0.65" />
      <circle cx="8" cy="115" r="4" opacity="0.75" />
      <circle cx="12" cy="165" r="3.5" opacity="0.6" />
    </svg>
  </div>
);

// Escudo / Crest de Time em estilo eSports (chanfrado com tech brackets, sem quadrado genérico)
const TeamCrest = ({
  logo,
  tag,
  color,
  isLeft,
}: {
  logo: string;
  tag: string;
  color: string;
  isLeft: boolean;
}) => {
  const cutPolygon =
    'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)';

  return (
    <div className="relative group/crest flex items-center justify-center">
      {/* Pincelada de Tinta Expandindo no Fundo com a Cor do Time */}
      <TeamBrushStroke color={color} isLeft={isLeft} />

      {/* Tech Corner Brackets / Moldura Angular de eSports */}
      <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 p-1.5 flex items-center justify-center transition-transform duration-500 group-hover/crest:scale-105 z-10">
        {/* Cantoneiras Tech Brackets */}
        <span
          className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 transition-all duration-300 group-hover/crest:-translate-x-1 group-hover/crest:-translate-y-1 pointer-events-none"
          style={{ borderColor: color, filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <span
          className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 transition-all duration-300 group-hover/crest:translate-x-1 group-hover/crest:-translate-y-1 pointer-events-none"
          style={{ borderColor: color, filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <span
          className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 transition-all duration-300 group-hover/crest:-translate-x-1 group-hover/crest:translate-y-1 pointer-events-none"
          style={{ borderColor: color, filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <span
          className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 transition-all duration-300 group-hover/crest:translate-x-1 group-hover/crest:translate-y-1 pointer-events-none"
          style={{ borderColor: color, filter: `drop-shadow(0 0 6px ${color})` }}
        />

        {/* Linhas Laterais de Acento Luminoso */}
        <span
          className="absolute top-1/2 -left-1 -translate-y-1/2 w-[2px] h-8 rounded-full opacity-70 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, ${color}, transparent)` }}
        />
        <span
          className="absolute top-1/2 -right-1 -translate-y-1/2 w-[2px] h-8 rounded-full opacity-70 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, ${color}, transparent)` }}
        />

        {/* Camada Chanfrada Externa (Borda Angular) */}
        <div
          className="w-full h-full p-[2px] shadow-2xl relative"
          style={{
            clipPath: cutPolygon,
            background: `linear-gradient(135deg, ${color}95 0%, ${color}25 50%, ${color}80 100%)`,
            filter: `drop-shadow(0 0 25px ${color}35)`,
          }}
        >
          {/* Corpo Interno do Escudo / Base Metálica Dark */}
          <div
            className="w-full h-full bg-gradient-to-br from-[#161823] via-[#0E1016] to-[#07080B] flex items-center justify-center relative overflow-hidden"
            style={{ clipPath: cutPolygon }}
          >
            {/* Reflexo Diagonal no Vidro */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                background: `linear-gradient(120deg, transparent 30%, ${color} 50%, transparent 70%)`,
              }}
            />

            {/* Brilho Ambiente Central */}
            <div
              className="absolute w-24 h-24 rounded-full blur-xl opacity-30 pointer-events-none"
              style={{ backgroundColor: color }}
            />

            {/* Imagem do Logo Estendida no Card ou Letra Inicial */}
            {logo ? (
              <img
                src={logo}
                alt={tag}
                className="w-full h-full object-cover relative z-10 group-hover/crest:scale-105 transition-transform duration-500"
              />
            ) : (
              <span
                className="text-5xl md:text-7xl font-black font-display opacity-30 select-none relative z-10 transition-all duration-500 group-hover/crest:scale-110"
                style={{
                  color,
                  textShadow: `0 0 30px ${color}`,
                }}
              >
                {tag.replace(/^#/, '')[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Badge de Tag estilizado com efeito de pincelada/marca de tinta
const TeamTagBadge = ({ tag, color }: { tag: string; color: string }) => (
  <div className="relative inline-flex items-center justify-center px-4 py-1.5 group/tag mt-1">
    {/* Pincelada / Mancha de Fundo */}
    <div
      className="absolute inset-0 -skew-x-12 rounded-md opacity-25 transition-opacity group-hover/tag:opacity-40"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 25px ${color}50`,
      }}
    />
    <div
      className="absolute inset-x-0 bottom-0 h-[2px] rounded-full opacity-80"
      style={{
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        boxShadow: `0 0 12px ${color}`,
      }}
    />
    {/* Texto da Tag com Glow */}
    <span
      className="relative text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter font-display leading-none transition-all duration-300 drop-shadow-md"
      style={{
        color,
        textShadow: `0 0 25px ${color}70, 0 0 45px ${color}35`,
      }}
    >
      {tag}
    </span>
  </div>
);

// ⚡ OTIMIZAÇÃO: cache em memória de 5min para highlights e votos.
// Evita refetch ao navegar Lobby ↔ outras páginas ↔ Lobby de novo.
const _HIGHLIGHTS_CACHE_TTL = 5 * 60 * 1000;
let _highlightsCache: { data: Array<{ id: string; titulo: string; link: string; thumbnail_url: string | null; categoria: string }>; ts: number } | null = null;

// ⚡ Cache para notícias do blog (mesmo padrão)
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
        const [camps, allTeams] = await Promise.all([
          api.tournaments.list(),
          api.teams.list().catch(() => [] as any[]),
        ]);

        const teamMap = new Map<string, any>();
        if (Array.isArray(allTeams)) {
          for (const tm of allTeams) {
            if (tm.tag) teamMap.set(tm.tag.trim().toUpperCase(), tm);
            if (tm.nome) teamMap.set(tm.nome.trim().toUpperCase(), tm);
            if (tm.name) teamMap.set(tm.name.trim().toUpperCase(), tm);
            if (tm.id) teamMap.set(String(tm.id), tm);
          }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const raw: Array<{ sortKey: string; match: any; camp: any }> = [];

        for (const camp of camps) {
          const cron: any[] = camp.cronograma || [];
          const times: any[] = camp.times_inscritos || [];

          for (const match of cron) {
            // Apenas partidas confirmadas (times definiram a data/hora)
            if (match.status !== 'confirmado') continue;
            if (!match.timeA || !match.timeB) continue;
            if (!match.data || match.data === 'A COMBINAR') continue;
            const mDate = new Date(
              match.data.length === 10 ? match.data + 'T00:00:00' : match.data
            );
            if (isNaN(mDate.getTime())) continue;

            const resolveTeam = (tagOrName: string) => {
              if (!tagOrName) return null;
              const norm = tagOrName.trim().toUpperCase();
              const fromCamp = times.find((t: any) =>
                (t.tag && t.tag.trim().toUpperCase() === norm) ||
                (t.name && t.name.trim().toUpperCase() === norm) ||
                (t.nome && t.nome.trim().toUpperCase() === norm) ||
                (t.id && String(t.id) === norm)
              );
              const fromApi = teamMap.get(norm) || (fromCamp?.id ? teamMap.get(String(fromCamp.id)) : null);
              const color = fromApi?.gradient_from || fromApi?.gradientFrom || fromCamp?.cor || fromCamp?.gradient_from || fromCamp?.gradientFrom || null;
              const color2 = fromApi?.gradient_to || fromApi?.gradientTo || fromCamp?.gradient_to || fromCamp?.gradientTo || null;
              const logo = fromApi?.logo_url || fromApi?.logoUrl || fromCamp?.logo || fromCamp?.logo_url || '';
              const tag = fromApi?.tag || fromCamp?.tag || tagOrName;
              const name = fromApi?.nome || fromApi?.name || fromCamp?.name || fromCamp?.nome || tag;
              return {
                ...fromCamp,
                ...fromApi,
                color,
                color2,
                logo,
                tag,
                name,
              };
            };

            const tA = resolveTeam(match.timeA);
            const tB = resolveTeam(match.timeB);

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

        const mapped: UpcomingMatch[] = raw.map(({ match, camp: c }) => {
          const colorA = c._tA?.color || c._tA?.gradient_from || c._tA?.cor || '#00E5FF';
          const colorA2 = c._tA?.color2 || c._tA?.gradient_to || colorA;
          const colorB = c._tB?.color || c._tB?.gradient_from || c._tB?.cor || '#FF4655';
          const colorB2 = c._tB?.color2 || c._tB?.gradient_to || colorB;

          return {
            id: `${c.id}_${match.timeA}_${match.timeB}_${match.data}_${match.hora || match.horario || ''}`,
            campId: c.id,
            campTitle: c.titulo || c.nome || c.name || 'CAMPEONATO',
            campColor: c.theme_color || '#FFB700',
            fase: match.fase || match.phase_label || match.phase || 'Fase de Grupos',
            tagA: c._tA?.tag ? `#${c._tA.tag.replace(/^#/, '')}` : `#${match.timeA}`,
            nameA: c._tA?.name || match.timeA,
            colorA,
            colorA2,
            logoA: c._tA?.logo || '',
            tagB: c._tB?.tag ? `#${c._tB.tag.replace(/^#/, '')}` : `#${match.timeB}`,
            nameB: c._tB?.name || match.timeB,
            colorB,
            colorB2,
            logoB: c._tB?.logo || '',
            date: c._dateStr,
            time: match.hora || match.horario || '—',
          };
        });

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

  // Busca notícias do blog (cache 5min) — usado na seção "Notícias & Atualizações"
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

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 150 : -150,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.3 }
      }
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 150 : -150,
      opacity: 0,
      scale: 0.95,
      transition: {
        x: { duration: 0.2 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 }
      }
    })
  };

  return (
    <div className="relative">
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
          {/* Background Image/Art Placeholder */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-black/30 z-10" />
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover object-[center_15%] opacity-80 transition-transform duration-700 group-hover:scale-105"
            >
              <source src="/images/animated-highnoon-lucian.webm" type="video/webm" />
            </video>
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
                  M7 ARENA • Campeonatos 2026
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-7xl font-black uppercase leading-[0.9] tracking-tighter break-words">
                Seu Time está <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40">
                  pronto para vencer?
                </span>
              </h1>

              <p className="text-white/40 text-[10px] sm:text-xs md:text-sm xl:text-lg font-medium max-w-xs sm:max-w-xl leading-relaxed">
                Campeonatos de LoL com premiação em Pix, ranking por PDL e
                transmissão ao vivo — a vitrine para o seu time brilhar.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 md:gap-3 xl:gap-4 pt-2 sm:pt-3 xl:pt-4">
                <button
                  onClick={() => navigate('/campeonatos')}
                  className="group relative px-5 md:px-7 xl:px-10 py-3 md:py-3.5 xl:py-4 bg-[#FFB700] text-black font-black text-[10px] xl:text-xs uppercase tracking-[0.2em] overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,183,0,0.3)]"
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, 100% 70%, 90% 100%, 0 100%)'
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">Explorar Torneios <ChevronRight size={14} /></span>
                </button>

                <button
                  onClick={() => navigate('/times')}
                  className="group relative px-5 md:px-7 xl:px-10 py-3 md:py-3.5 xl:py-4 border border-white/20 text-white font-black text-[10px] xl:text-xs uppercase tracking-[0.2em] overflow-hidden transition-all hover:bg-white/5 hover:border-white/40 active:scale-95 rounded-sm"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">Crie seu Time <ChevronRight size={14} /></span>
                </button>
              </div>
            </motion.div>
          </div>

          {/* Destaque Tag Floating */}
          <div className="hidden sm:block absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
            <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFB700] animate-pulse" />
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-[#FFB700]">Temporada 2026</span>
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

      {/* UPCOMING MATCHES (direto no site, sem card de fora) */}
      {upcomingLoaded && upcomingMatches.length > 0 && (
      <section className="pt-12 sm:pt-16 md:pt-20 pb-8 md:pb-12 px-4 max-w-[1400px] mx-auto relative select-none">
        <div className="space-y-6 relative">
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative flex items-center justify-between min-h-[380px] md:min-h-[440px] w-full px-2 sm:px-6 md:px-14 py-4"
          >
            {/* Fumaça Atmosférica / Ambient Glows diretamente no fundo do site */}
            <div className="absolute inset-0 flex items-center justify-between pointer-events-none z-0">
              <div
                className="w-[280px] h-[280px] md:w-[480px] md:h-[480px] rounded-full blur-[100px] md:blur-[160px] opacity-20 absolute left-[0%] md:left-[5%] transition-all duration-700 pointer-events-none"
                style={{ backgroundColor: upcomingMatches[currentMatchIndex]?.colorA ?? '#00E5FF' }}
              />
              <div
                className="w-[280px] h-[280px] md:w-[480px] md:h-[480px] rounded-full blur-[100px] md:blur-[160px] opacity-20 absolute right-[0%] md:right-[5%] transition-all duration-700 pointer-events-none"
                style={{ backgroundColor: upcomingMatches[currentMatchIndex]?.colorB ?? '#FF4655' }}
              />
            </div>

            {/* Left Navigation Arrow */}
            <button
              onClick={handlePrev}
              aria-label="Jogo anterior"
              className="absolute left-0 sm:left-2 md:left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 md:w-13 md:h-13 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#FFB700]/40 text-white/40 hover:text-[#FFB700] hover:scale-110 active:scale-95 transition-all flex items-center justify-center backdrop-blur-md shadow-xl group"
            >
              <ChevronRight className="rotate-180 w-5 h-5 md:w-7 md:h-7 group-hover:-translate-x-0.5 transition-transform" />
            </button>

            {/* Center Animating Area */}
            <div className="w-full flex justify-center items-center z-10 overflow-visible py-2">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                {upcomingMatches[currentMatchIndex] && (
                  <motion.div
                    key={upcomingMatches[currentMatchIndex].id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="w-full max-w-4xl flex flex-col items-center gap-8 md:gap-12"
                  >
                    {/* Tournament Showcase Header - Estilo Partidas Personalizadas com Fonte Anton */}
                    {upcomingMatches[currentMatchIndex].campTitle && (
                      <div className="flex flex-col items-center gap-2 select-none text-center mb-2 md:mb-4">
                        {/* Badge da Fase com corte chanfrado e dourado */}
                        {upcomingMatches[currentMatchIndex].fase && (
                          <div
                            className="px-3.5 py-0.5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] bg-[#FFB700] text-black shadow-[0_0_12px_rgba(255,183,0,0.35)]"
                            style={{ clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}
                          >
                            {upcomingMatches[currentMatchIndex].fase}
                          </div>
                        )}

                        {/* Nome da Copa estilizado com Anton */}
                        <h3
                          className="text-2xl sm:text-3xl md:text-5xl text-white uppercase tracking-wider leading-none select-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] text-center"
                          style={{
                            fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {upcomingMatches[currentMatchIndex].campTitle}
                        </h3>

                        {/* Linha decorativa de gradiente abaixo do título */}
                        <div className="w-28 sm:w-48 h-[2px] bg-gradient-to-r from-transparent via-[#FFB700]/60 to-transparent mt-0.5" />
                      </div>
                    )}

                    {/* Main Matchup Arena */}
                    <div className="flex flex-wrap md:flex-nowrap md:flex-row items-center justify-center md:justify-between w-full gap-y-6 gap-x-2 md:gap-12 py-2">

                      {/* Team A Showcase */}
                      <div className="flex flex-col items-center gap-3 md:gap-4 order-1 w-[calc(50%-8px)] md:w-auto md:order-none flex-none md:flex-1 text-center md:items-end md:text-right">
                        <div className="flex flex-col items-center md:items-end gap-3">
                          {/* Crest angular do time com marca de tinta e fumaça */}
                          <TeamCrest
                            logo={upcomingMatches[currentMatchIndex].logoA}
                            tag={upcomingMatches[currentMatchIndex].tagA}
                            color={upcomingMatches[currentMatchIndex].colorA}
                            isLeft={true}
                          />

                          {/* Tag & Full Name */}
                          <div className="flex flex-col items-center md:items-end">
                            <TeamTagBadge
                              tag={upcomingMatches[currentMatchIndex].tagA}
                              color={upcomingMatches[currentMatchIndex].colorA}
                            />
                            {upcomingMatches[currentMatchIndex].nameA && upcomingMatches[currentMatchIndex].nameA !== upcomingMatches[currentMatchIndex].tagA && (
                              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-white/40 mt-1 max-w-[150px] md:max-w-[200px] truncate">
                                {upcomingMatches[currentMatchIndex].nameA}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* VS & Timing Area (Direto no layout, sem card fechado) */}
                      <div className="flex flex-col items-center gap-3 md:gap-4 order-3 w-full md:w-auto md:order-none min-w-[160px] relative select-none">
                        {/* VS Emblem com gradiente e clash */}
                        <div className="relative flex items-center justify-center">
                          <span
                            className="text-4xl sm:text-5xl md:text-6xl font-black italic tracking-widest uppercase leading-none select-none"
                            style={{
                              backgroundImage: `linear-gradient(135deg, ${upcomingMatches[currentMatchIndex].colorA} 0%, #FFFFFF 50%, ${upcomingMatches[currentMatchIndex].colorB} 100%)`,
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.25))',
                            }}
                          >
                            VS
                          </span>
                        </div>

                        {/* Date & Time Hub */}
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-sm shadow-sm">
                            <Calendar className="w-3 h-3 text-white/50" />
                            <span className="text-[10px] md:text-xs font-bold text-white/80 uppercase tracking-widest">
                              {upcomingMatches[currentMatchIndex].date}
                            </span>
                          </div>

                          <span className="text-2xl sm:text-3xl md:text-4xl font-black text-[#FFB700] tracking-widest font-display drop-shadow-[0_0_20px_rgba(255,183,0,0.55)]">
                            {upcomingMatches[currentMatchIndex].time}
                          </span>
                        </div>
                      </div>

                      {/* Team B Showcase */}
                      <div className="flex flex-col items-center gap-3 md:gap-4 order-2 w-[calc(50%-8px)] md:w-auto md:order-none flex-none md:flex-1 text-center md:items-start md:text-left">
                        <div className="flex flex-col items-center md:items-start gap-3">
                          {/* Crest angular do time com marca de tinta e fumaça */}
                          <TeamCrest
                            logo={upcomingMatches[currentMatchIndex].logoB}
                            tag={upcomingMatches[currentMatchIndex].tagB}
                            color={upcomingMatches[currentMatchIndex].colorB}
                            isLeft={false}
                          />

                          {/* Tag & Full Name */}
                          <div className="flex flex-col items-center md:items-start">
                            <TeamTagBadge
                              tag={upcomingMatches[currentMatchIndex].tagB}
                              color={upcomingMatches[currentMatchIndex].colorB}
                            />
                            {upcomingMatches[currentMatchIndex].nameB && upcomingMatches[currentMatchIndex].nameB !== upcomingMatches[currentMatchIndex].tagB && (
                              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-white/40 mt-1 max-w-[150px] md:max-w-[200px] truncate">
                                {upcomingMatches[currentMatchIndex].nameB}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Navigation Arrow */}
            <button
              onClick={handleNext}
              aria-label="Próximo jogo"
              className="absolute right-0 sm:right-2 md:right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 md:w-13 md:h-13 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#FFB700]/40 text-white/40 hover:text-[#FFB700] hover:scale-110 active:scale-95 transition-all flex items-center justify-center backdrop-blur-md shadow-xl group"
            >
              <ChevronRight className="w-5 h-5 md:w-7 md:h-7 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Match Pagination Dots / Indicators (Centralizado abaixo da arena de jogos) */}
          {upcomingMatches.length > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2 relative z-20">
              {upcomingMatches.map((m, idx) => {
                const isActive = idx === currentMatchIndex;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setDirection(idx > currentMatchIndex ? 1 : -1);
                      setCurrentMatchIndex(idx);
                    }}
                    aria-label={`Ver jogo ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isActive
                        ? 'w-7 bg-[#FFB700] shadow-[0_0_8px_#FFB700]'
                        : 'w-2 bg-white/20 hover:bg-white/40'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>
      )}

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
              desc: 'Traga seu squad completo ou encontre parceiros de rotas no painel de recrutamento — sem time, a gente ajuda a montar.',
              color: '#00F0FF',
              bgImage: '/images/poro_step2.webp',
            },
            {
              n: '03',
              icon: Trophy,
              title: 'Inscreva-se',
              desc: 'Escolha o campeonato ideal para o nível da sua equipe — do Bronze ao Desafiante — e garanta sua vaga nas chaves.',
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
          ].map((step, idx) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group relative bg-[#0d0d0d] border border-white/10 hover:border-[#FFB700]/60 rounded-2xl overflow-hidden transition-all duration-500 flex flex-col justify-between shadow-2xl hover:scale-[1.02]"
            >
              {/* Banner de Imagem em Destaque no Topo do Card com Altura Fixa */}
              <div className="relative h-48 w-full overflow-hidden bg-[#151515]">
                <img
                  src={step.bgImage}
                  alt={step.title}
                  className="w-full h-full object-cover block group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-transparent to-black/30 pointer-events-none" />

                {/* Badge do Passo */}
                <div className="absolute top-3 left-3 z-10">
                  <span
                    className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded shadow-md border backdrop-blur-md"
                    style={{
                      backgroundColor: `${step.color}25`,
                      borderColor: `${step.color}50`,
                      color: step.color,
                    }}
                  >
                    Passo {step.n}
                  </span>
                </div>

                {/* Número no Canto da Imagem */}
                <div
                  className="absolute bottom-2 right-3 text-5xl font-black opacity-30 select-none z-10"
                  style={{ color: step.color }}
                >
                  {step.n}
                </div>
              </div>

              {/* Conteúdo do Card */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-xl border flex items-center justify-center flex-none"
                      style={{
                        backgroundColor: `${step.color}15`,
                        borderColor: `${step.color}30`,
                        color: step.color,
                      }}
                    >
                      <step.icon className="w-4.5 h-4.5" />
                    </div>
                    <h3 className="text-base font-black uppercase tracking-tight text-white group-hover:text-[#FFB700] transition-colors">
                      {step.title}
                    </h3>
                  </div>

                  <p className="text-white/50 text-xs leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          NOTÍCIAS & ATUALIZAÇÕES — Clicáveis com Leitura Completa
         ════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 max-w-[1400px] mx-auto border-t border-white/5">
        <div className="flex flex-col items-center sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div className="text-center sm:text-left">
            <span className="text-[#FFB700] text-[10px] md:text-xs font-black uppercase tracking-[0.3em] inline-flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Informa e Esportes
            </span>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mt-3">
              Fique por <span className="text-[#FFB700]">Dentro</span>
            </h2>
          </div>
          <span className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
            Clique em qualquer matéria para ler na íntegra
          </span>
        </div>

        {noticias.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
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
            ].map((n, idx) => (
              <motion.article
                key={n.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                onClick={() => setSelectedNoticia(n)}
                className="group relative bg-white/[0.02] border border-white/5 hover:border-[#FFB700]/50 rounded-2xl overflow-hidden transition-all duration-500 cursor-pointer flex flex-col justify-between hover:scale-[1.02]"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-black">
                  <img
                    src={n.image}
                    alt={n.titulo}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 bg-[#FFB700] text-black text-[9px] font-black uppercase tracking-widest rounded shadow-md">
                      {n.categoria}
                    </span>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-white line-clamp-2 group-hover:text-[#FFB700] transition-colors leading-tight mb-2">
                      {n.titulo}
                    </h3>
                    <p className="text-white/40 text-xs leading-relaxed line-clamp-3 mb-4">
                      {n.resumo}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                      {n.date}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#FFB700] group-hover:translate-x-1 transition-transform">
                      Ler Matéria <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {noticias.slice(0, 6).map((n, idx) => (
              <motion.article
                key={n.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedNoticia(n)}
                className="group relative bg-white/[0.02] border border-white/5 hover:border-[#FFB700]/50 rounded-2xl overflow-hidden transition-all duration-500 cursor-pointer hover:scale-[1.02]"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-[#FFB700]/20 via-black to-black">
                  <img
                    src={n.thumbnail_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800'}
                    alt={n.titulo}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 bg-[#FFB700] text-black text-[9px] font-black uppercase tracking-widest rounded shadow-md">
                      {n.categoria}
                    </span>
                  </div>
                  {n.destaque && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-md">
                        Destaque
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="text-base font-black uppercase tracking-tight text-white line-clamp-2 group-hover:text-[#FFB700] transition-colors leading-tight mb-2">
                    {n.titulo}
                  </h3>
                  <p className="text-white/40 text-xs leading-relaxed line-clamp-3 mb-4">
                    {n.resumo}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                      {new Date(n.publicado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#FFB700] group-hover:translate-x-1 transition-transform">
                      Ler mais <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
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
                'Encontrei meus parceiros de rotas pelo recrutamento da plataforma. Hoje jogamos torneios semanais da ACE e-Sports e lutamos pelo topo do Hall da Fama!',
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
          <span className="text-[#FFB700] text-[10px] md:text-xs font-black uppercase tracking-[0.3em] inline-flex items-center gap-2 px-3 py-1 bg-[#FFB700]/10 border border-[#FFB700]/20 rounded-full">
            <Globe className="w-3.5 h-3.5 text-[#FFB700]" />
            Nossa Comunidade
          </span>
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
            className="group relative p-8 rounded-3xl bg-gradient-to-b from-[#5865F2]/10 via-black to-black border border-[#5865F2]/20 hover:border-[#5865F2] transition-all duration-500 flex flex-col justify-between overflow-hidden shadow-2xl"
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
            className="group relative p-8 rounded-3xl bg-gradient-to-b from-[#25D366]/10 via-black to-black border border-[#25D366]/20 hover:border-[#25D366] transition-all duration-500 flex flex-col justify-between overflow-hidden shadow-2xl"
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
            className="group relative p-8 rounded-3xl bg-gradient-to-b from-[#E1306C]/10 via-black to-black border border-[#E1306C]/20 hover:border-[#E1306C] transition-all duration-500 flex flex-col justify-between overflow-hidden shadow-2xl"
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
                className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/15"
              >
                <button
                  onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-black uppercase tracking-tight text-sm md:text-base text-white hover:text-[#FFB700] transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#FFB700]" />
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-white/40 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#FFB700]' : ''}`}
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

      {/* ════════════════════════════════════════════════════════════════
          MODAL DE NOTÍCIAS — Leitura Completa ao Clicar
         ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedNoticia && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedNoticia(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.25 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-[#0d0d0d] border border-white/15 rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              {/* Image Header */}
              <div className="relative aspect-[16/9] bg-black overflow-hidden flex-none">
                <img
                  src={selectedNoticia.image || selectedNoticia.thumbnail_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800'}
                  alt={selectedNoticia.titulo}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-transparent to-black/40" />

                <button
                  onClick={() => setSelectedNoticia(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="absolute bottom-4 left-6 flex items-center gap-2">
                  <span className="px-3 py-1 bg-[#FFB700] text-black text-[10px] font-black uppercase tracking-widest rounded-md shadow-md">
                    {selectedNoticia.categoria || 'Notícia'}
                  </span>
                  {selectedNoticia.date && (
                    <span className="px-3 py-1 bg-black/60 border border-white/10 text-white/70 text-[10px] font-bold uppercase tracking-widest rounded-md backdrop-blur-sm flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {selectedNoticia.date}
                    </span>
                  )}
                </div>
              </div>

              {/* Body Content */}
              <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-4">
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
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-[#00D8E6] text-black font-black text-xs uppercase tracking-wider transition-all shadow-md hover:scale-[1.02]"
                    >
                      <span>{selectedNoticia.link_texto || 'Acessar Link'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 bg-white/[0.02] border-t border-white/5 flex items-center justify-between gap-4">
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: selectedNoticia.titulo, url: window.location.href });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartilhar</span>
                </button>

                <button
                  onClick={() => setSelectedNoticia(null)}
                  className="px-6 py-2.5 rounded-xl bg-[#FFB700] hover:bg-[#FFA800] text-black font-black text-xs uppercase tracking-wider transition-all"
                >
                  Fechar Leitura
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
