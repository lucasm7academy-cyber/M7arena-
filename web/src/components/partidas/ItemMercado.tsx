import React from 'react';
import { motion } from 'motion/react';
import { Plus, Check, Trophy, Zap, Target, Swords, ShieldAlert } from 'lucide-react';
import type { ApiBetMarket } from '../../lib/api';

interface ItemMercadoProps {
  market: ApiBetMarket;
  odd: string | number;
  selecionado: boolean;
  stake?: number;
  onClick: () => void;
}

/**
 * Retorna o ícone temático apropriado conforme a chave e o grupo do mercado.
 */
function getMarketIcon(market: ApiBetMarket) {
  const k = market.key.toLowerCase();
  if (k.includes('vitoria')) return <Trophy className="w-4 h-4 text-emerald-400" />;
  if (k.includes('derrota')) return <ShieldAlert className="w-4 h-4 text-rose-400" />;
  if (market.group === 'first_blood') return <Zap className="w-4 h-4 text-[#FFB700]" />;
  if (market.group === 'kills') return <Target className="w-4 h-4 text-amber-400" />;
  return <Swords className="w-4 h-4 text-white/70" />;
}

/**
 * Item de mercado do painel de desafio individual com design gamer e odds destacadas.
 */
export const ItemMercado: React.FC<ItemMercadoProps> = ({
  market,
  odd,
  selecionado,
  stake = 100,
  onClick,
}) => {
  const oddFormatada = typeof odd === 'number' ? `${odd.toFixed(2)}x` : odd;
  const oddNum = typeof odd === 'number' ? odd : parseFloat(odd) || 1;
  const retornoEstimado = Math.floor(stake * oddNum);

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer border w-full text-left overflow-hidden group ${
        selecionado
          ? 'bg-gradient-to-r from-[#FFB700]/15 via-[#FFB700]/10 to-[#FFB700]/5 border-[#FFB700] shadow-[0_0_20px_rgba(255,183,0,0.18)]'
          : 'bg-[#0d0d12] hover:bg-[#13131a] border-white/10 hover:border-white/20'
      }`}
    >
      {/* Brilho decorativo no canto quando selecionado */}
      {selecionado && (
        <div
          className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full blur-xl pointer-events-none opacity-25"
          style={{ background: '#FFB700' }}
        />
      )}

      {/* Lado esquerdo: Ícone + Título + Preview de Retorno */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            selecionado
              ? 'bg-[#FFB700]/20 border border-[#FFB700]/40 shadow-[0_0_10px_rgba(255,183,0,0.2)]'
              : 'bg-white/5 border border-white/10 group-hover:bg-white/10'
          }`}
        >
          {getMarketIcon(market)}
        </div>

        <div className="min-w-0 flex-1">
          <span className="text-xs sm:text-[13px] font-bold uppercase tracking-tight text-white block truncate">
            {market.label}
          </span>
          {selecionado ? (
            <span className="text-[10px] font-black uppercase tracking-wider text-[#FFB700] inline-flex items-center gap-1 mt-0.5">
              <span>Retorno:</span>
              <span className="text-white font-extrabold">{retornoEstimado} MC</span>
            </span>
          ) : (
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider block">
              Objetivo individual
            </span>
          )}
        </div>
      </div>

      {/* Lado direito: Badge da Odd + Indicador de Seleção */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider transition-all ${
            selecionado
              ? 'bg-[#FFB700] text-black shadow-[0_0_12px_rgba(255,183,0,0.4)]'
              : 'bg-black/60 border border-white/10 text-white/80 group-hover:border-white/25 group-hover:text-white'
          }`}
        >
          {oddFormatada}
        </div>

        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
            selecionado
              ? 'border-[#FFB700] bg-[#FFB700] text-black shadow-sm'
              : 'border-white/20 text-white/30 group-hover:border-[#FFB700]/50 group-hover:text-[#FFB700]'
          }`}
        >
          {selecionado ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5" />}
        </div>
      </div>
    </motion.button>
  );
};

export default ItemMercado;
