import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ChevronRight, Award, Shield, Sparkles, Swords } from 'lucide-react';
import { api } from '../../lib/api';

interface TopTeam {
  id: string;
  nome: string;
  tag: string;
  logo_url?: string | null;
  gradient_from?: string;
  gradient_to?: string;
  pdl: number;
  winrate: number;
  wins?: number;
  games_played?: number;
}

interface RankedBorderConfig {
  rank: number;
  eloName: string;
  rankTitle: string;
  primaryColor: string;
  accentColor: string;
  darkColor: string;
  gemGlow: string;
  textColor: string;
  bgGlow: string;
}

const RANK_CONFIGS: Record<number, RankedBorderConfig> = {
  1: {
    rank: 1,
    eloName: 'GRÃO-MESTRE',
    rankTitle: 'TOP #1 GLOBAL',
    primaryColor: '#FFB700',
    accentColor: '#FF3B47',
    darkColor: '#5C080E',
    gemGlow: '#FF1E28',
    textColor: '#FFB700',
    bgGlow: 'rgba(231, 76, 60, 0.25)',
  },
  2: {
    rank: 2,
    eloName: 'MESTRE',
    rankTitle: 'TOP #2 GLOBAL',
    primaryColor: '#D946EF',
    accentColor: '#C084FC',
    darkColor: '#3B0764',
    gemGlow: '#A855F7',
    textColor: '#C084FC',
    bgGlow: 'rgba(168, 85, 247, 0.25)',
  },
  3: {
    rank: 3,
    eloName: 'DIAMANTE',
    rankTitle: 'TOP #3 GLOBAL',
    primaryColor: '#00E5FF',
    accentColor: '#38BDF8',
    darkColor: '#0C4A6E',
    gemGlow: '#00E5FF',
    textColor: '#38BDF8',
    bgGlow: 'rgba(0, 229, 255, 0.25)',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// SVG DECORATIVO: BORDA DE TELA DE CARREGAMENTO DO LEAGUE OF LEGENDS
// ════════════════════════════════════════════════════════════════════════════
const LolRankedBorderSVG: React.FC<{ rank: number }> = ({ rank }) => {
  const cfg = RANK_CONFIGS[rank] || RANK_CONFIGS[1];
  const uid = `lol-border-r${rank}`;

  return (
    <svg
      viewBox="0 0 320 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full pointer-events-none z-30"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Filtro de Glow Mágico nas Joias e Bordas */}
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <filter id={`${uid}-intense`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="blur2" />
          <feComposite in="SourceGraphic" in2="blur2" operator="over" />
        </filter>

        {/* Gradiente Metálico Primário (Armadura do Elo) */}
        <linearGradient id={`${uid}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="25%" stopColor={cfg.primaryColor} />
          <stop offset="65%" stopColor={cfg.accentColor} />
          <stop offset="100%" stopColor={cfg.darkColor} />
        </linearGradient>

        {/* Gradiente Escuro Metálico para chanfros e vincos */}
        <linearGradient id={`${uid}-bevel`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={cfg.primaryColor} />
          <stop offset="50%" stopColor={cfg.darkColor} />
          <stop offset="100%" stopColor="#08080C" />
        </linearGradient>

        {/* Gradiente da Joia Central (Gema de Elo) */}
        <radialGradient id={`${uid}-gem`} cx="40%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="35%" stopColor={cfg.gemGlow} />
          <stop offset="75%" stopColor={cfg.darkColor} />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>

        {/* Gradiente dos Trilhos Verticais */}
        <linearGradient id={`${uid}-rail-v`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={cfg.primaryColor} stopOpacity="0.9" />
          <stop offset="50%" stopColor={cfg.accentColor} stopOpacity="0.4" />
          <stop offset="100%" stopColor={cfg.primaryColor} stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* ────────────────────────────────────────────────────────────────
          1. TRILHOS / BORDAS EXTERNAS COM CANTO CHANFRADO
         ──────────────────────────────────────────────────────────────── */}
      {/* Moldura base externa com recortes chanfrados estilo loading screen */}
      <path
        d="M 32,16 L 288,16 L 306,34 L 306,446 L 288,464 L 32,464 L 14,446 L 14,34 Z"
        stroke={`url(#${uid}-metal)`}
        strokeWidth="2.5"
        fill="none"
        opacity="0.95"
      />

      {/* Trilho interno secundário com filete fino */}
      <path
        d="M 36,22 L 284,22 L 300,38 L 300,442 L 284,458 L 36,458 L 20,442 L 20,38 Z"
        stroke={`url(#${uid}-rail-v)`}
        strokeWidth="1.2"
        fill="none"
        opacity="0.6"
      />

      {/* ────────────────────────────────────────────────────────────────
          2. CANTONEIRAS SUPERIORES (CHEVRONS DE ARMADURA)
         ──────────────────────────────────────────────────────────────── */}
      {/* Canto Superior Esquerdo */}
      <g>
        <path
          d="M 12,38 L 12,65 L 24,53 L 24,34 L 48,22 L 36,12 L 18,28 Z"
          fill={`url(#${uid}-metal)`}
          stroke={cfg.darkColor}
          strokeWidth="0.8"
        />
        <polygon points="20,24 28,32 24,36 16,28" fill="#FFFFFF" opacity="0.6" />
      </g>

      {/* Canto Superior Direito */}
      <g>
        <path
          d="M 308,38 L 308,65 L 296,53 L 296,34 L 272,22 L 284,12 L 302,28 Z"
          fill={`url(#${uid}-metal)`}
          stroke={cfg.darkColor}
          strokeWidth="0.8"
        />
        <polygon points="300,24 292,32 296,36 304,28" fill="#FFFFFF" opacity="0.6" />
      </g>

      {/* ────────────────────────────────────────────────────────────────
          3. CANTONEIRAS INFERIORES (PEDESTAL DE ARMADURA)
         ──────────────────────────────────────────────────────────────── */}
      {/* Canto Inferior Esquerdo */}
      <g>
        <path
          d="M 12,442 L 12,415 L 24,427 L 24,446 L 48,458 L 36,468 L 18,452 Z"
          fill={`url(#${uid}-metal)`}
          stroke={cfg.darkColor}
          strokeWidth="0.8"
        />
      </g>

      {/* Canto Inferior Direito */}
      <g>
        <path
          d="M 308,442 L 308,415 L 296,427 L 296,446 L 272,458 L 284,468 L 302,452 Z"
          fill={`url(#${uid}-metal)`}
          stroke={cfg.darkColor}
          strokeWidth="0.8"
        />
      </g>

      {/* ────────────────────────────────────────────────────────────────
          4. MARCADORES LATERAIS DE MEIO DE TELA (SIDE BRACKETS)
         ──────────────────────────────────────────────────────────────── */}
      {/* Marcador Esquerdo */}
      <g transform="translate(14, 240)">
        <path d="M 0,-18 L 8,-6 L 8,6 L 0,18 L -6,0 Z" fill={`url(#${uid}-metal)`} />
        <polygon points="0,-6 6,0 0,6 -4,0" fill={`url(#${uid}-gem)`} filter={`url(#${uid}-glow)`} />
      </g>

      {/* Marcador Direito */}
      <g transform="translate(306, 240)">
        <path d="M 0,-18 L -8,-6 L -8,6 L 0,18 L 6,0 Z" fill={`url(#${uid}-metal)`} />
        <polygon points="0,-6 -6,0 0,6 4,0" fill={`url(#${uid}-gem)`} filter={`url(#${uid}-glow)`} />
      </g>

      {/* ────────────────────────────────────────────────────────────────
          5. TOPO: O COROAMENTO ALADO (TOP WINGED CREST)
         ──────────────────────────────────────────────────────────────── */}
      {/* Asa decorativa Esquerda (Estilo Chifres/Asas de Loading Screen do LoL) */}
      <path
        d="M 160,22 C 145,14 125,5 98,2 C 114,13 126,22 136,32 C 116,24 94,22 75,28 C 96,38 116,43 138,44 L 148,36 Z"
        fill={`url(#${uid}-metal)`}
        stroke={cfg.darkColor}
        strokeWidth="1"
        filter={`url(#${uid}-glow)`}
      />

      {/* Asa decorativa Direita (Espelhada) */}
      <path
        d="M 160,22 C 175,14 195,5 222,2 C 206,13 194,22 184,32 C 204,24 226,22 245,28 C 224,38 204,43 182,44 L 172,36 Z"
        fill={`url(#${uid}-metal)`}
        stroke={cfg.darkColor}
        strokeWidth="1"
        filter={`url(#${uid}-glow)`}
      />

      {/* Encaixe Central do Broche / Joia Superior */}
      <g>
        {/* Suporte de Armadura Dourada da Joia */}
        <polygon
          points="160,2 182,24 160,46 138,24"
          fill={`url(#${uid}-bevel)`}
          stroke={`url(#${uid}-metal)`}
          strokeWidth="2.5"
        />

        {/* Gema Central de Elo (Grão-Mestre: Rubi | Mestre: Ametista | Diamante: Safira) */}
        <polygon
          points="160,8 175,24 160,40 145,24"
          fill={`url(#${uid}-gem)`}
          filter={`url(#${uid}-intense)`}
        />

        {/* Ponto de Brilho Especular na Joia */}
        <circle cx="157" cy="18" r="2.5" fill="#FFFFFF" opacity="0.9" />
      </g>

      {/* ────────────────────────────────────────────────────────────────
          6. BASE: O PINGENTE / ÂNCORA INFERIOR (BOTTOM PENDANT)
         ──────────────────────────────────────────────────────────────── */}
      <g>
        {/* Asas pequenas inferiores */}
        <path
          d="M 160,458 L 138,444 L 118,454 L 142,464 Z"
          fill={`url(#${uid}-metal)`}
          stroke={cfg.darkColor}
          strokeWidth="0.8"
        />
        <path
          d="M 160,458 L 182,444 L 202,454 L 178,464 Z"
          fill={`url(#${uid}-metal)`}
          stroke={cfg.darkColor}
          strokeWidth="0.8"
        />

        {/* Pingente pontiagudo apontando para baixo */}
        <polygon
          points="160,442 174,456 160,474 146,456"
          fill={`url(#${uid}-bevel)`}
          stroke={`url(#${uid}-metal)`}
          strokeWidth="2"
        />

        {/* Joia Pequena da Base */}
        <polygon
          points="160,448 168,456 160,466 152,456"
          fill={`url(#${uid}-gem)`}
          filter={`url(#${uid}-glow)`}
        />
      </g>
    </svg>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// CARD DA FIGURINHA COM A BORDA DE CARREGAMENTO DO LEAGUE OF LEGENDS
// ════════════════════════════════════════════════════════════════════════════
const LolRankedStickerCard: React.FC<{
  team: TopTeam;
  rank: number;
  isCenter?: boolean;
}> = ({ team, rank, isCenter }) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const cfg = RANK_CONFIGS[rank] || RANK_CONFIGS[1];

  const teamGradFrom = team.gradient_from || cfg.primaryColor;
  const teamGradTo = team.gradient_to || cfg.darkColor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: rank * 0.1 }}
      whileHover={{ y: isCenter ? -14 : -8, scale: isCenter ? 1.05 : 1.03 }}
      onClick={() => navigate(`/times/${team.id}`)}
      className={`group relative cursor-pointer select-none transition-all duration-500 ${
        isCenter ? 'z-20 -translate-y-2 sm:-translate-y-4 md:-translate-y-6' : 'z-10'
      }`}
      style={{
        filter: `drop-shadow(0 15px 35px ${cfg.bgGlow})`,
      }}
    >
      {/* Dimensão do Card da Figurinha */}
      <div
        className={`relative transition-all duration-500 ${
          isCenter
            ? 'w-[280px] sm:w-[310px] md:w-[330px] h-[440px] sm:h-[470px]'
            : 'w-[245px] sm:w-[265px] md:w-[285px] h-[390px] sm:h-[420px]'
        }`}
      >
        {/* Fundo interno do Card (dentro da moldura) */}
        <div className="absolute inset-[8px] bg-gradient-to-b from-[#0c0d14] via-[#07070a] to-[#040406] rounded-[20px] overflow-hidden flex flex-col justify-between p-4 sm:p-5 shadow-2xl">
          {/* Efeito de Textura Hextech / Linhas Holográficas */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `radial-gradient(circle at 50% 30%, ${teamGradFrom}30 0%, transparent 60%), linear-gradient(135deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(225deg, rgba(255,255,255,0.06) 25%, transparent 25%)`,
                backgroundSize: '100% 100%, 20px 20px, 20px 20px',
              }}
            />
          </div>

          {/* Brilho Especular Diagonal no Hover */}
          <div
            className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-10"
            style={{
              background:
                'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.1) 55%, transparent 80%)',
            }}
          />

          {/* ════ CABEÇALHO DO CARD: TITULO DO ELO (GRÃO-MESTRE / MESTRE / DIAMANTE) ════ */}
          <div className="relative z-20 pt-6 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md shadow-lg">
              <span
                className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em]"
                style={{ color: cfg.primaryColor }}
              >
                {cfg.eloName}
              </span>
              <span className="text-[9px] font-mono text-white/50">• #{rank}</span>
            </div>
          </div>

          {/* ════ ÁREA CENTRAL: ESCUDO DO TIME COM HALO ════ */}
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center my-1">
            {/* Halo Atmosférico Circular */}
            <div
              className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full blur-2xl pointer-events-none transition-transform duration-700 group-hover:scale-125"
              style={{
                backgroundColor: teamGradFrom,
                opacity: 0.35,
              }}
            />

            {/* Moldura Hextech do Escudo */}
            <div
              className={`relative rounded-2xl p-[3px] shadow-2xl transition-transform duration-500 group-hover:scale-105 ${
                isCenter ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-20 h-20 sm:w-24 sm:h-24'
              }`}
              style={{
                background: `linear-gradient(135deg, ${cfg.primaryColor}, ${cfg.darkColor})`,
                boxShadow: `0 8px 24px -4px ${cfg.bgGlow}`,
              }}
            >
              <div className="w-full h-full bg-[#0a0a0f] rounded-[13px] overflow-hidden flex items-center justify-center p-2.5">
                {team.logo_url && !imgError ? (
                  <img
                    src={team.logo_url}
                    alt={team.nome}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
                  />
                ) : (
                  <div
                    className="w-full h-full rounded-lg flex items-center justify-center font-black text-xl text-white"
                    style={{
                      background: `linear-gradient(135deg, ${teamGradFrom}, ${teamGradTo})`,
                    }}
                  >
                    {team.tag || team.nome?.substring(0, 3) || 'M7'}
                  </div>
                )}
              </div>
            </div>

            {/* Tag e Nome do Time */}
            <div className="mt-3 text-center w-full px-2">
              <h4
                className="text-2xl sm:text-3xl font-black uppercase tracking-wider leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]"
                style={{
                  fontFamily: '"Anton", "Arial Narrow", Impact, sans-serif',
                  letterSpacing: '0.04em',
                }}
              >
                #{team.tag || 'TIME'}
              </h4>
              <p className="text-white/60 text-[11px] sm:text-xs font-semibold truncate mt-1 max-w-[190px] mx-auto">
                {team.nome}
              </p>
            </div>
          </div>

          {/* ════ RODAPÉ: ATRIBUTOS & STATS COMPETITIVAS ════ */}
          <div className="relative z-20 pb-4 space-y-2">
            <div className="grid grid-cols-3 gap-1 bg-black/40 border border-white/10 rounded-xl p-1.5 text-center backdrop-blur-md">
              <div>
                <span className="block text-[8px] font-black uppercase tracking-widest text-white/40">PDL</span>
                <span className="text-xs sm:text-sm font-black text-[#FFB700] tracking-tight">
                  {team.pdl ?? 0}
                </span>
              </div>
              <div className="border-x border-white/5">
                <span className="block text-[8px] font-black uppercase tracking-widest text-white/40">VITÓRIAS</span>
                <span className="text-xs sm:text-sm font-black text-white tracking-tight">
                  {team.wins ?? 0}V
                </span>
              </div>
              <div>
                <span className="block text-[8px] font-black uppercase tracking-widest text-white/40">WINRATE</span>
                <span className="text-xs sm:text-sm font-black text-[#00FF41] tracking-tight">
                  {team.winrate ?? 100}%
                </span>
              </div>
            </div>

            {/* Selo M7 de Verificação */}
            <div className="flex items-center justify-between text-[8px] text-white/30 font-mono tracking-widest px-1">
              <span>LOL EDITION</span>
              <span className="flex items-center gap-1" style={{ color: cfg.primaryColor }}>
                <Shield size={9} />
                RANK {rank}
              </span>
            </div>
          </div>
        </div>

        {/* ════ A BORDA DE CARREGAMENTO DO LEAGUE OF LEGENDS (SVG OVERLAY) ════ */}
        <LolRankedBorderSVG rank={rank} />
      </div>
    </motion.div>
  );
};

export const TopTeamsStickers: React.FC = () => {
  const navigate = useNavigate();
  const [topTeams, setTopTeams] = useState<TopTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api.teams
      .list({ page: 0, limit: 3, sort: 'pdl', dir: 'desc' })
      .then((res) => {
        if (cancelled) return;
        if (res && res.teams && Array.isArray(res.teams)) {
          setTopTeams(res.teams.slice(0, 3));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Erro ao carregar top times:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && topTeams.length === 0) {
    return null;
  }

  if (!loading && topTeams.length < 3) {
    return null;
  }

  const team1 = topTeams[0]; // 1º Lugar (Grão-Mestre / Gold)
  const team2 = topTeams[1]; // 2º Lugar (Mestre / Amethyst)
  const team3 = topTeams[2]; // 3º Lugar (Diamante / Sapphire)

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 max-w-[1400px] mx-auto relative select-none">
      {/* Título e Cabeçalho da Seção */}
      <div className="text-center mb-10 sm:mb-14 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#FFB700]/10 border border-[#FFB700]/30 rounded-full">
          <Award size={14} className="text-[#FFB700]" />
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-[#FFB700]">
            Bordas Competitivas • Hall da Glória
          </span>
        </div>

        <h2
          className="text-3xl sm:text-4xl md:text-6xl text-white uppercase tracking-wider leading-none select-none drop-shadow-[0_2px_15px_rgba(0,0,0,0.9)]"
          style={{
            fontFamily: '"Anton", "Arial Narrow", Impact, sans-serif',
            letterSpacing: '0.04em',
          }}
        >
          OS GIGANTES DO <span className="text-[#FFB700]">RANKING</span>
        </h2>

        <p className="text-white/50 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed font-medium">
          As 3 equipes líderes da temporada emolduradas com as prestigiosas bordas de Grão-Mestre, Mestre e Diamante.
        </p>
      </div>

      {/* Pódio de Cards com Bordas LoL: 2º Lugar à Esquerda (Mestre), 1º Lugar ao Centro (Grão-Mestre), 3º Lugar à Direita (Diamante) */}
      <div className="relative flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-4 md:gap-8 lg:gap-12 pt-4 pb-8">
        {/* Iluminação Atmosférica de Pódio */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
          <div className="w-[320px] sm:w-[500px] md:w-[680px] h-[300px] rounded-full bg-[#FFB700]/10 blur-[120px] pointer-events-none" />
        </div>

        {/* 2º LUGAR (Mestre - Esquerda) */}
        {team2 && (
          <div className="order-2 sm:order-1 flex justify-center">
            <LolRankedStickerCard team={team2} rank={2} isCenter={false} />
          </div>
        )}

        {/* 1º LUGAR (Grão-Mestre - Centro em Destaque) */}
        {team1 && (
          <div className="order-1 sm:order-2 flex justify-center">
            <LolRankedStickerCard team={team1} rank={1} isCenter={true} />
          </div>
        )}

        {/* 3º LUGAR (Diamante - Direita) */}
        {team3 && (
          <div className="order-3 sm:order-3 flex justify-center">
            <LolRankedStickerCard team={team3} rank={3} isCenter={false} />
          </div>
        )}
      </div>

      {/* Botão para ver tabela completa */}
      <div className="text-center mt-6">
        <button
          onClick={() => navigate('/times')}
          className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#FFB700]/40 rounded-xl text-xs font-black uppercase tracking-[0.2em] text-white/80 hover:text-[#FFB700] transition-all hover:scale-105 active:scale-95 shadow-lg group"
        >
          <span>Ver Ranking Completo de Equipes</span>
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </section>
  );
};

export default TopTeamsStickers;
