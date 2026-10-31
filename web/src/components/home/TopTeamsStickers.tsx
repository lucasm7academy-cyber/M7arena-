import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';

interface TopTeam {
  id: string;
  nome: string;
  tag: string;
  logo_url?: string | null;
  pdl: number;
  winrate: number;
  wins?: number;
  games_played?: number;
}

/**
 * Molduras oficiais do League (Community Dragon → ranked-emblem/wings).
 * Arte 2296×2976 com um círculo vazado em (49,9%, 59,9%) e ⌀ 33,2% da largura:
 * a logo do time entra ATRÁS e o anel dourado do emblema fica por cima.
 */
const MOLDURAS: Record<number, { src: string; cor: string; elo: string }> = {
  1: { src: '/ranks/molduras/challenger.webp', cor: '#3FBFDD', elo: 'Desafiante' },
  2: { src: '/ranks/molduras/grandmaster.webp', cor: '#CD4545', elo: 'Grão-Mestre' },
  3: { src: '/ranks/molduras/master.webp', cor: '#9D48E0', elo: 'Mestre' },
};

const LARGURA: Record<number, string> = {
  1: 'w-[230px] sm:w-[240px] lg:w-[276px]',
  2: 'w-[196px] sm:w-[204px] lg:w-[232px]',
  3: 'w-[196px] sm:w-[204px] lg:w-[232px]',
};

/** Buraco da moldura em % da própria arte. */
const FURO = { left: '33.4%', top: '47.0%', size: '33.2%' };

const TeamRankCard: React.FC<{ team: TopTeam; rank: number }> = ({ team, rank }) => {
  const m = MOLDURAS[rank] ?? MOLDURAS[3];
  const vitorias = team.wins ?? 0;
  const derrotas = Math.max(0, (team.games_played ?? 0) - vitorias);

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 w-full max-w-[320px]">
      {/* emblema + logo */}
      <div className={`relative ${LARGURA[rank]} shrink-0`} style={{ aspectRatio: '2296 / 2976' }}>
        {/* halo do elo atrás do anel */}
        <div
          className="absolute rounded-full blur-2xl opacity-30 pointer-events-none"
          style={{
            left: '20%',
            top: '45%',
            width: '60%',
            aspectRatio: '1 / 1',
            background: m.cor,
          }}
        />

        {/* logo do time ATRÁS do anel */}
        <div
          className="absolute overflow-hidden rounded-full bg-[#0a0a0d]"
          style={{ left: FURO.left, top: FURO.top, width: FURO.size, aspectRatio: '1 / 1' }}
        >
          {team.logo_url ? (
            <img
              src={team.logo_url}
              alt={team.nome}
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-black uppercase text-white/70" style={{ fontSize: '26cqw' }}>
                {team.tag}
              </span>
            </div>
          )}
        </div>

        {/* moldura por cima */}
        <img
          src={m.src}
          alt={m.elo}
          className="absolute inset-0 w-full h-full pointer-events-none"
          loading="lazy"
          draggable={false}
        />
      </div>

      {/* nome + elo */}
      <div className="text-center min-w-0 w-full -mt-2">
        <p className="text-white font-black uppercase tracking-tight truncate text-sm sm:text-base lg:text-lg leading-tight">
          {team.nome}
        </p>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] mt-1" style={{ color: m.cor }}>
          {m.elo}
        </p>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 w-full max-w-[260px] border border-white/10 bg-[#0b0b0f]/80 divide-x divide-white/10">
        {[
          { label: 'PDL', valor: team.pdl.toLocaleString('pt-BR') },
          { label: 'WIN%', valor: `${team.winrate}%` },
          { label: 'W/L', valor: `${vitorias}/${derrotas}` },
        ].map((s) => (
          <div key={s.label} className="py-2 px-1 text-center">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">{s.label}</p>
            <p className="text-white font-black text-xs sm:text-sm tabular-nums mt-0.5">{s.valor}</p>
          </div>
        ))}
      </div>
    </div>
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
        if (res && res.teams && Array.isArray(res.teams)) setTopTeams(res.teams.slice(0, 3));
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

  if (loading || topTeams.length < 3) return null;

  const [team1, team2, team3] = topTeams;

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 w-full max-w-[1400px] mx-auto relative select-none overflow-hidden">
      <div className="text-center mb-8 sm:mb-12 space-y-3">
        <h2
          className="text-3xl sm:text-4xl md:text-6xl text-white uppercase tracking-wider leading-none drop-shadow-[0_2px_15px_rgba(0,0,0,0.9)]"
          style={{ fontFamily: '"Anton", "Arial Narrow", Impact, sans-serif', letterSpacing: '0.04em' }}
        >
          OS GIGANTES DO <span className="text-[#FFB700]">RANKING</span>
        </h2>

        <p className="text-white/50 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed font-medium">
          As 3 equipes líderes da temporada, emolduradas com os emblemas mais altos do League of Legends.
        </p>
      </div>

      <div className="relative flex flex-col sm:flex-row items-center sm:items-start justify-center gap-8 sm:gap-4 md:gap-8 lg:gap-12 pb-6 w-full">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10 overflow-hidden">
          <div className="w-[320px] sm:w-[520px] md:w-[700px] h-[320px] rounded-full bg-[#FFB700]/10 blur-[120px]" />
        </div>

        {/* 2º lugar (esquerda) */}
        <div className="order-2 sm:order-1 flex justify-center w-full sm:w-auto">
          <TeamRankCard team={team2} rank={2} />
        </div>

        {/* 1º lugar (centro) */}
        <div className="order-1 sm:order-2 flex justify-center w-full sm:w-auto sm:-mt-1">
          <TeamRankCard team={team1} rank={1} />
        </div>

        {/* 3º lugar (direita) */}
        <div className="order-3 flex justify-center w-full sm:w-auto">
          <TeamRankCard team={team3} rank={3} />
        </div>
      </div>

      <div className="text-center mt-8">
        <button
          onClick={() => navigate('/times')}
          className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#FFB700]/40 rounded-xl text-xs font-black uppercase tracking-[0.2em] text-white/80 hover:text-[#FFB700] transition-all hover:scale-105 active:scale-95 shadow-lg group max-w-full cursor-pointer"
        >
          <span className="truncate">Ver Ranking Completo de Equipes</span>
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform shrink-0" />
        </button>
      </div>
    </section>
  );
};

export default TopTeamsStickers;
