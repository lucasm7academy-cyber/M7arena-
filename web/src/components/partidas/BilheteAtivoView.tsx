import React from 'react';
import { Gamepad2, Clock, RefreshCw, Trophy, Swords, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ApiBetTicket, ApiBetCatalog } from '../../lib/api';

interface BilheteAtivoViewProps {
  ticket: ApiBetTicket;
  catalog: ApiBetCatalog | null;
  onSync: () => void;
  syncing?: boolean;
}

export const BilheteAtivoView: React.FC<BilheteAtivoViewProps> = ({
  ticket,
  catalog,
  onSync,
  syncing = false,
}) => {
  const isEmJogo = ticket.status === 'em_jogo';
  const totalPayoutAtivo = ticket.legs.reduce((acc, l) => acc + l.payout, 0);
  const filaNome = catalog?.queues.find((q) => q.id === ticket.queue)?.label ?? (ticket.queue === 'flex' ? 'Flexível' : 'Solo / Duo');
  const horaExpiracao = new Date(ticket.expiresAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-4">
      {/* Banner de Status com Efeito Radar */}
      <div
        className={`relative rounded-2xl p-4 sm:p-5 border overflow-hidden transition-all ${
          isEmJogo
            ? 'bg-gradient-to-r from-emerald-950/40 via-[#0a1510] to-[#080e0c] border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
            : 'bg-gradient-to-r from-amber-950/30 via-[#15120a] to-[#0d0b07] border-[#FFB700]/30 shadow-[0_0_30px_rgba(255,183,0,0.12)]'
        }`}
      >
        <div className="flex items-center gap-3.5 relative z-10">
          <div
            className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center relative ${
              isEmJogo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#FFB700]/20 text-[#FFB700]'
            }`}
          >
            {isEmJogo ? (
              <Gamepad2 className="w-6 h-6 animate-pulse" />
            ) : (
              <Clock className="w-6 h-6 animate-pulse" />
            )}
            {/* Onda de Radar animada */}
            <span
              className={`absolute inset-0 rounded-xl animate-ping opacity-30 ${
                isEmJogo ? 'bg-emerald-400' : 'bg-[#FFB700]'
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md ${
                  isEmJogo
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'bg-[#FFB700] text-black shadow-sm'
                }`}
              >
                {isEmJogo ? 'Partida Detectada' : 'Radar Ativo'}
              </span>
              <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
                {filaNome}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white mt-1">
              {isEmJogo ? 'Partida em Andamento no Rift!' : 'Aguardando Início da sua Partida'}
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              {isEmJogo
                ? 'Seu jogo está sendo acompanhado em tempo real. O resultado será validado ao término.'
                : `Inicie sua partida ranqueada até as ${horaExpiracao} para o desafio ser ativado.`}
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Objetivos Ativos (Legs) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-widest text-white/60">
            Seus Objetivos no Confronto
          </span>
          <span className="text-[11px] text-white/40">
            {ticket.legs.length} {ticket.legs.length === 1 ? 'meta' : 'metas'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {ticket.legs.map((leg) => (
            <div
              key={leg.id}
              className="p-3 sm:p-3.5 rounded-xl bg-[#0e0e14] border border-white/10 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Swords className="w-4 h-4 text-[#FFB700]" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-[13px] font-bold uppercase tracking-tight text-white block truncate">
                    {leg.label}
                  </span>
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">
                    Objetivo ativo
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-right">
                <div>
                  <span className="text-xs font-black text-white block">
                    {leg.stake} MC
                  </span>
                  <span className="text-[10px] font-bold text-[#FFB700] block">
                    @{leg.odd}
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-[#FFB700]/10 border border-[#FFB700]/30 text-[11px] font-black text-[#FFB700]">
                  +{leg.payout} MC
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo Financeiro do Bilhete */}
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-widest text-white/50">Valor Total do Desafio</span>
          <span className="font-black text-white">{ticket.stakeTotal} MC</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-black uppercase tracking-widest text-white/70">Recompensa Total em Caso de Sucesso</span>
          <span className="text-base sm:text-lg font-black text-[#FFB700] drop-shadow">
            {totalPayoutAtivo} MC
          </span>
        </div>
      </div>

      {/* Botão de Verificação Manual */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="w-full rounded-xl py-3 bg-[#FFB700]/10 hover:bg-[#FFB700]/20 border border-[#FFB700]/40 flex items-center justify-center gap-2 text-[#FFB700] text-xs font-black uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Verificando com a Riot API...' : 'Verificar Resultado Agora'}</span>
        </button>
      </div>

      {/* Nota Informativa */}
      <p className="text-[11px] text-white/40 text-center leading-relaxed px-2">
        {isEmJogo
          ? 'A partida está em andamento. O sistema valida seu desempenho automaticamente através da Riot API.'
          : 'O desafio perdura até você concluir sua partida ranqueada. Se nenhuma partida acontecer até o prazo, seu MC é estornado integralmente.'}
      </p>
    </div>
  );
};

export default BilheteAtivoView;
