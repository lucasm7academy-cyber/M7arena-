import { motion } from 'motion/react';
import { Crown, ChevronRight, Flame, TrendingUp, Trophy } from 'lucide-react';
import { useSound } from '../../../hooks/useSound';
import { useAuth } from '../../../contexts/AuthContext';
import type { TeamBasico } from '../types';

const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CUT_BADGE_INNER = 'polygon(5.8px 0, 100% 0, 100% calc(100% - 5.8px), calc(100% - 5.8px) 100%, 0 100%, 0 5.8px)';

export const TeamCard = ({ team, onClick, onLogoClick }: {
  team: TeamBasico;
  onClick: (t: TeamBasico) => void;
  onLogoClick?: (url: string) => void;
}) => {
  const { playSound } = useSound();
  const { user } = useAuth();

  const isOwner = user && team.donoId === user.id;

  return (
    <motion.div
      whileTap={{ scale: 0.998 }}
      onClick={() => { playSound('click'); onClick(team); }}
      className="group/card flex flex-col md:flex-row md:items-center gap-4 md:gap-5 px-4 md:px-6 py-4 md:py-3 hover:bg-white/[0.035] transition-colors cursor-pointer"
    >
      {/* Logo + Nome/Tag no mobile, Apenas Logo no desktop */}
      <div className="flex items-center gap-4 md:block shrink-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          className="w-16 h-16 md:w-20 md:h-20 p-[2px] flex items-center justify-center relative shrink-0 shadow-xl"
          style={{
            borderRadius: '10px',
            background: team.gradientFrom,
            boxShadow: `0 8px 24px -6px ${team.gradientFrom}60`
          }}
          onClick={team.logoUrl ? (e) => { e.stopPropagation(); onLogoClick?.(team.logoUrl!); } : undefined}
        >
          <div
            className="w-full h-full bg-[#08080a] flex items-center justify-center overflow-hidden"
            style={{ borderRadius: '8px' }}
          >
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover cursor-zoom-in" referrerPolicy="no-referrer" loading="lazy" width={96} height={96} />
            ) : (
              <span className="font-black text-base md:text-lg tracking-widest" style={{ color: team.gradientFrom }}>{team.tag}</span>
            )}
          </div>
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
            <div
              className="p-[1px] shrink-0"
              style={{
                clipPath: CUT_BADGE,
                background: `${team.gradientFrom}80`
              }}
            >
              <div
                className="text-[8px] font-black px-1.5 py-0.5 tracking-wider bg-[#08080a]"
                style={{
                  clipPath: CUT_BADGE_INNER,
                  color: team.gradientFrom,
                }}
              >
                #{team.tag}
              </div>
            </div>
          </div>

          {/* Rank pequeno no topo do mobile */}
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: team.gradientFrom }}>
            RANK #{team.ranking}
          </span>
        </div>
      </div>

      {/* Nome e Tag (desktop) */}
      <div className="hidden md:flex flex-1 min-w-0 items-center gap-2">
        {isOwner && (
          <Crown className="w-4 h-4 shrink-0" style={{ color: team.gradientFrom }} />
        )}
        <h3 className="text-white font-black text-lg tracking-tight leading-tight truncate uppercase">
          {team.name}
        </h3>
        <div
          className="p-[1px] shrink-0"
          style={{
            clipPath: CUT_BADGE,
            background: `${team.gradientFrom}80`
          }}
        >
          <div
            className="text-[9px] font-black px-2 py-0.5 tracking-widest bg-[#08080a]"
            style={{
              clipPath: CUT_BADGE_INNER,
              color: team.gradientFrom,
            }}
          >
            #{team.tag}
          </div>
        </div>
      </div>

      {/* Stats (desktop) — divisórias verticais entre colunas */}
      <div className="hidden md:flex items-stretch shrink-0">
        <span className="flex items-center w-[76px] pl-5 border-l border-white/5 text-[13px] font-black text-green-400 tabular-nums">
          {team.winrate}%
        </span>
        <span className="flex items-center w-[76px] pl-5 border-l border-white/5 text-[13px] font-black text-white tabular-nums">
          {team.wins}/{team.gamesPlayed - team.wins}
        </span>
        <span className="flex items-center w-[76px] pl-5 border-l border-white/5 text-[13px] font-black text-white tabular-nums">
          {team.pdl.toLocaleString('pt-BR')}
        </span>
      </div>

      {/* Rank + Ver página (desktop) — empilhados como no card antigo */}
      <div className="hidden md:flex items-center justify-center w-[200px] pl-5 border-l border-white/5 shrink-0">
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-black tracking-tighter uppercase whitespace-nowrap" style={{ color: team.gradientFrom }}>
            RANK #{team.ranking}
          </span>
          <div className="flex items-center gap-1" style={{ color: team.gradientFrom }}>
            <span className="font-bold text-[9px] uppercase tracking-[0.15em] whitespace-nowrap">Ver página</span>
            <ChevronRight className="w-3 h-3 transition-transform group-hover/card:translate-x-1" />
          </div>
        </div>
      </div>

      {/* Stats (mobile) */}
      <div className="md:hidden flex items-center justify-between gap-4 w-full mt-2 bg-white/[0.02] p-2.5 border border-white/5 rounded-lg">
        <div className="flex flex-col items-center flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <Flame className="w-3 h-3" style={{ color: team.gradientFrom }} />
            <span className="text-[8px] text-white/40 uppercase font-black tracking-tighter">PDL</span>
          </div>
          <span className="font-black text-xs text-white">{team.pdl.toLocaleString('pt-BR')}</span>
        </div>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex flex-col items-center flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-[8px] text-white/40 uppercase font-black tracking-tighter">WIN%</span>
          </div>
          <span className="font-black text-xs text-green-400">{team.winrate}%</span>
        </div>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex flex-col items-center flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <Trophy className="w-3 h-3 text-white/30" />
            <span className="text-[8px] text-white/40 uppercase font-black tracking-tighter">W/L</span>
          </div>
          <span className="font-black text-xs text-white">{team.wins}/{team.gamesPlayed - team.wins}</span>
        </div>
      </div>

      {/* Link de ação exclusivo no mobile */}
      <div className="md:hidden flex items-center justify-between border-t border-white/5 pt-2.5 mt-1">
        <div className="flex items-center gap-1 cursor-pointer">
          <span className="font-bold text-[10px] uppercase tracking-[0.15em]" style={{ color: team.gradientFrom }}>Ver página do time</span>
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/card:translate-x-1" style={{ color: team.gradientFrom }} />
        </div>
      </div>
    </motion.div>
  );
};
