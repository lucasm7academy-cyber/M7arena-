import React from 'react';
import { Medal, Zap, Swords, Trophy, Coins, Target, PlusCircle } from 'lucide-react';
import { buildProfileIconUrl } from '../../api/riot';
import type { ApiBetQueue } from '../../lib/api';

interface SummonerCardProps {
  nick: string;
  tag: string;
  iconId: number;
  elo?: string;
  saldo: number;
  queue: ApiBetQueue;
  selectedLegsCount: number;
  stakeTotal: number;
  payoutTotal: number;
}

export const SummonerCard: React.FC<SummonerCardProps> = ({
  nick,
  tag,
  iconId,
  elo,
  saldo,
  queue,
  selectedLegsCount,
  stakeTotal,
  payoutTotal,
}) => {
  const isFlex = queue === 'flex';

  const handleOpenDeposit = () => {
    window.dispatchEvent(new Event('m7:open-deposit'));
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#0e0e14] via-[#09090d] to-[#060608] border border-white/10 p-5 sm:p-6 flex flex-col items-center text-center shadow-2xl relative overflow-hidden h-fit">
      {/* Luz ambiente dourada de fundo */}
      <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-[#FFB700]/10 blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />

      {/* Badge topo */}
      <div className="relative z-10 w-full flex items-center justify-between mb-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-[#FFB700] bg-[#FFB700]/10 border border-[#FFB700]/30 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FFB700] animate-pulse" />
          Summoner Vinculado
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          LoL BR1
        </span>
      </div>

      {/* Avatar do Invocador com Aura Neon */}
      <div className="relative mb-3.5 z-10">
        <div className="absolute inset-0 rounded-full blur-xl opacity-50 bg-[#FFB700]" />
        {iconId ? (
          <img
            src={buildProfileIconUrl(iconId)}
            alt="Ícone do invocador"
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-[#FFB700] shadow-[0_0_25px_rgba(255,183,0,0.5)]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#121217] flex items-center justify-center border-2 border-white/15">
            <Zap className="w-10 h-10 text-white/30" />
          </div>
        )}

        {/* Badge de Elo sobreposto ao avatar */}
        {elo && (
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#0c0c10] border border-[#FFB700]/50 shadow-lg inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white whitespace-nowrap">
            <Medal className="w-3 h-3 text-[#FFB700]" />
            <span>{elo}</span>
          </div>
        )}
      </div>

      {/* Nickname e Tag */}
      <div className="mt-2 text-center z-10 max-w-full">
        <h2
          className="text-white font-black text-2xl sm:text-3xl uppercase tracking-tight truncate leading-tight drop-shadow"
          style={{ fontFamily: '"Anton","Arial Narrow","Bahnschrift Condensed",Impact,sans-serif' }}
        >
          {nick}
        </h2>
        {tag && (
          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/50 text-xs font-bold tracking-wider">
            #{tag}
          </span>
        )}
      </div>

      {/* Widget de Saldo com atalho para recarregar */}
      <div className="relative z-10 w-full mt-4 p-2.5 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#FFB700]/15 flex items-center justify-center">
            <Coins className="w-3.5 h-3.5 text-[#FFB700]" />
          </div>
          <div className="text-left">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Saldo</span>
            <span className="text-xs font-black text-white">{saldo} MC</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenDeposit}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-black bg-[#FFB700] hover:bg-[#e0a000] transition-colors cursor-pointer"
        >
          <PlusCircle className="w-3 h-3" />
          <span>Adicionar</span>
        </button>
      </div>

      {/* Grid de Métricas do Desafio */}
      <div className="relative z-10 w-full mt-4 grid grid-cols-2 gap-2 text-left">
        {/* Fila */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Fila</span>
            <Swords className={`w-3.5 h-3.5 ${isFlex ? 'text-purple-400' : 'text-blue-400'}`} />
          </div>
          <span className="text-xs font-black text-white uppercase truncate">
            {isFlex ? 'Flexível' : 'Solo / Duo'}
          </span>
        </div>

        {/* Objetivos Selecionados */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Objetivos</span>
            <Target className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-xs font-black text-white">
            {selectedLegsCount} {selectedLegsCount === 1 ? 'ativo' : 'ativos'}
          </span>
        </div>

        {/* Valor Total */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Em Jogo</span>
            <Coins className="w-3.5 h-3.5 text-white/40" />
          </div>
          <span className="text-xs font-black text-white">
            {stakeTotal} MC
          </span>
        </div>

        {/* Recompensa Potencial */}
        <div className="p-3 rounded-xl bg-[#FFB700]/10 border border-[#FFB700]/30 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#FFB700]">Retorno</span>
            <Trophy className="w-3.5 h-3.5 text-[#FFB700]" />
          </div>
          <span className="text-xs font-black text-[#FFB700]">
            {payoutTotal} MC
          </span>
        </div>
      </div>

      {/* Nota de Detecção */}
      <div className="relative z-10 w-full mt-4 pt-3.5 border-t border-white/5 text-center">
        <p className="text-[10px] text-white/40 leading-snug">
          O sistema detecta sua partida ranqueada automaticamente através da Riot API ao entrar em jogo.
        </p>
      </div>
    </div>
  );
};

export default SummonerCard;
