import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ChevronRight, Award, Shield, Flame, Sparkles } from 'lucide-react';
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

interface TierConfig {
  rank: number;
  rankLabel: string;
  badgeLabel: string;
  themeName: string;
  primaryColor: string;
  accentColor: string;
  darkBorder: string;
  glowColor: string;
  foilGradient: string;
  ribbonBg: string;
  ribbonText: string;
}

const TIERS: Record<number, TierConfig> = {
  1: {
    rank: 1,
    rankLabel: '1º',
    badgeLabel: 'LÍDER GLOBAL',
    themeName: 'GOLD EDITION',
    primaryColor: '#FFB700',
    accentColor: '#FFE57F',
    darkBorder: '#8A5D00',
    glowColor: 'rgba(255, 183, 0, 0.45)',
    foilGradient: 'linear-gradient(135deg, #FFF1B8 0%, #FFB700 35%, #D48806 70%, #FFE57F 100%)',
    ribbonBg: '#FFB700',
    ribbonText: '#000000',
  },
  2: {
    rank: 2,
    rankLabel: '2º',
    badgeLabel: 'VICE-LÍDER',
    themeName: 'SILVER EDITION',
    primaryColor: '#E2E8F0',
    accentColor: '#FFFFFF',
    darkBorder: '#475569',
    glowColor: 'rgba(226, 232, 240, 0.35)',
    foilGradient: 'linear-gradient(135deg, #FFFFFF 0%, #CBD5E1 35%, #64748B 70%, #F1F5F9 100%)',
    ribbonBg: '#E2E8F0',
    ribbonText: '#0F172A',
  },
  3: {
    rank: 3,
    rankLabel: '3º',
    badgeLabel: 'TERCEIRO LUGAR',
    themeName: 'BRONZE EDITION',
    primaryColor: '#CD7F32',
    accentColor: '#FDBA74',
    darkBorder: '#7C2D12',
    glowColor: 'rgba(205, 127, 50, 0.35)',
    foilGradient: 'linear-gradient(135deg, #FED7AA 0%, #CD7F32 35%, #9A3412 70%, #FDBA74 100%)',
    ribbonBg: '#CD7F32',
    ribbonText: '#FFFFFF',
  },
};

// Componente individual de Figurinha da Copa / Trading Sticker
const StickerCard: React.FC<{
  team: TopTeam;
  tier: TierConfig;
  isCenter?: boolean;
}> = ({ team, tier, isCenter }) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const teamGradFrom = team.gradient_from || tier.primaryColor;
  const teamGradTo = team.gradient_to || tier.darkBorder;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: tier.rank * 0.1 }}
      whileHover={{ y: isCenter ? -12 : -8, scale: isCenter ? 1.05 : 1.03 }}
      onClick={() => navigate(`/times/${team.id}`)}
      className={`group relative cursor-pointer select-none transition-all duration-500 ${
        isCenter ? 'z-20 -translate-y-2 sm:-translate-y-4 md:-translate-y-6' : 'z-10'
      }`}
      style={{
        filter: `drop-shadow(0 15px 30px ${tier.glowColor})`,
      }}
    >
      {/* Container Principal da Figurinha */}
      <div
        className={`relative rounded-3xl overflow-hidden p-[2px] transition-all duration-500 ${
          isCenter
            ? 'w-[280px] sm:w-[310px] md:w-[330px] min-h-[420px] sm:min-h-[450px]'
            : 'w-[245px] sm:w-[265px] md:w-[285px] min-h-[370px] sm:min-h-[400px]'
        }`}
        style={{
          background: tier.foilGradient,
        }}
      >
        {/* Corpo Interno da Figurinha */}
        <div className="relative w-full h-full bg-[#0a0a0f] rounded-[22px] overflow-hidden flex flex-col justify-between p-4 sm:p-5">
          {/* Fundo com efeito de linhas prismáticas holográficas (SVG Pattern) */}
          <div className="absolute inset-0 pointer-events-none opacity-25">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id={`hologram-${tier.rank}`}
                  width="24"
                  height="24"
                  patternTransform="rotate(45 0 0)"
                  patternUnits="userSpaceOnUse"
                >
                  <line x1="0" y1="0" x2="0" y2="24" stroke={tier.primaryColor} strokeWidth="1" opacity="0.4" />
                  <circle cx="12" cy="12" r="1.5" fill={tier.accentColor} opacity="0.3" />
                </pattern>
                <radialGradient id={`glow-${tier.rank}`} cx="50%" cy="35%" r="50%">
                  <stop offset="0%" stopColor={teamGradFrom} stopOpacity="0.45" />
                  <stop offset="60%" stopColor={tier.primaryColor} stopOpacity="0.15" />
                  <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="100%" height="100%" fill={`url(#glow-${tier.rank})`} />
              <rect width="100%" height="100%" fill={`url(#hologram-${tier.rank})`} />
            </svg>
          </div>

          {/* Brilho Especular Diagonal (Sweeping Specular Sheen no Hover) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            style={{
              background:
                'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.15) 55%, transparent 80%)',
            }}
          />

          {/* ════ CABEÇALHO DA FIGURINHA ════ */}
          <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-2.5">
            {/* Tag de Marca Oficial da Figurinha */}
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} style={{ color: tier.primaryColor }} />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/60">
                M7 STICKER • {tier.themeName}
              </span>
            </div>

            {/* Selo do Rank (1º / 2º / 3º) */}
            <div
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] tracking-wider shadow-md"
              style={{
                backgroundColor: tier.ribbonBg,
                color: tier.ribbonText,
              }}
            >
              <Trophy size={11} />
              <span>{tier.rankLabel}</span>
            </div>
          </div>

          {/* ════ ÁREA CENTRAL: ESCUDO DO TIME ════ */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-3 my-1">
            {/* Halo Atmosférico Circular */}
            <div
              className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full blur-2xl pointer-events-none transition-transform duration-700 group-hover:scale-125"
              style={{
                backgroundColor: teamGradFrom,
                opacity: 0.35,
              }}
            />

            {/* Moldura do Escudo da Figurinha */}
            <div
              className={`relative rounded-2xl p-[3px] shadow-2xl transition-transform duration-500 group-hover:scale-105 ${
                isCenter ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-20 h-20 sm:w-24 sm:h-24'
              }`}
              style={{
                background: tier.foilGradient,
                boxShadow: `0 8px 24px -4px ${tier.glowColor}`,
              }}
            >
              <div className="w-full h-full bg-[#121218] rounded-[13px] overflow-hidden flex items-center justify-center p-2">
                {team.logo_url && !imgError ? (
                  <img
                    src={team.logo_url}
                    alt={team.nome}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
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
              <p className="text-white/60 text-[11px] sm:text-xs font-semibold truncate mt-1 max-w-[200px] mx-auto">
                {team.nome}
              </p>
            </div>
          </div>

          {/* ════ RODAPÉ: ATRIBUTOS & STATS DA FIGURINHA ════ */}
          <div className="relative z-10 pt-2 border-t border-white/10 space-y-2">
            {/* Grid de Atributos Competitivos */}
            <div className="grid grid-cols-3 gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-1.5 text-center">
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

            {/* Selo Holográfico de Autenticidade M7 */}
            <div className="flex items-center justify-between text-[8px] text-white/30 font-mono tracking-widest px-1">
              <span>CARD #{tier.rank}</span>
              <span className="flex items-center gap-1 text-white/50">
                <Shield size={9} style={{ color: tier.primaryColor }} />
                VERIFICADO
              </span>
            </div>
          </div>
        </div>
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
    // Se ainda não houver ao menos 3 times ranqueados, não exibe o bloco incompleto
    return null;
  }

  const team1 = topTeams[0]; // 1º Lugar (Gold)
  const team2 = topTeams[1]; // 2º Lugar (Silver)
  const team3 = topTeams[2]; // 3º Lugar (Bronze)

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 max-w-[1400px] mx-auto relative select-none">
      {/* Título e Cabeçalho da Seção */}
      <div className="text-center mb-10 sm:mb-14 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#FFB700]/10 border border-[#FFB700]/30 rounded-full">
          <Award size={14} className="text-[#FFB700]" />
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-[#FFB700]">
            Cards Colecionáveis • Hall da Glória
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
          As 3 equipes líderes da temporada que dominam o cenário competitivo da M7 ARENA.
        </p>
      </div>

      {/* Pódio de Figurinhas: 2º Lugar à Esquerda, 1º Lugar ao Centro (Elevado e Maior), 3º Lugar à Direita */}
      <div className="relative flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-4 md:gap-8 lg:gap-12 pt-4 pb-8">
        {/* Fundo Atmosférico de Iluminação do Pódio */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
          <div className="w-[320px] sm:w-[500px] md:w-[680px] h-[300px] rounded-full bg-[#FFB700]/10 blur-[120px] pointer-events-none" />
        </div>

        {/* 2º LUGAR (Prata - Esquerda) */}
        {team2 && (
          <div className="order-2 sm:order-1 flex justify-center">
            <StickerCard team={team2} tier={TIERS[2]} isCenter={false} />
          </div>
        )}

        {/* 1º LUGAR (Ouro - Centro em Destaque) */}
        {team1 && (
          <div className="order-1 sm:order-2 flex justify-center">
            <StickerCard team={team1} tier={TIERS[1]} isCenter={true} />
          </div>
        )}

        {/* 3º LUGAR (Bronze - Direita) */}
        {team3 && (
          <div className="order-3 sm:order-3 flex justify-center">
            <StickerCard team={team3} tier={TIERS[3]} isCenter={false} />
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
