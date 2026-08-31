import React from 'react';
import { motion } from 'motion/react';
import { Plus, Check } from 'lucide-react';
import type { ApiBetMarket } from '../../lib/api';

interface ItemMercadoProps {
  market: ApiBetMarket;
  odd: string; // odd formatada (ex.: "1.35x")
  selecionado: boolean;
  onClick: () => void;
}

/**
 * Item de mercado do painel de aposta individual. Estilo redondo (cartões
 * arredondados), com selo da odd e estado selecionado destacado em dourado.
 */
export const ItemMercado: React.FC<ItemMercadoProps> = ({ market, odd, selecionado, onClick }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`rounded-xl py-2.5 px-3 flex items-center justify-between gap-2 transition-colors cursor-pointer border w-full ${
        selecionado
          ? 'bg-[#FFB700]/10 border-[#FFB700]/60'
          : 'bg-[#111116] border-white/10 hover:bg-white/10'
      }`}
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-200 line-clamp-2 text-left">
        {market.label}
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span className={`text-[11px] font-black shrink-0 ${selecionado ? 'text-[#FFB700]' : 'text-white/50'}`}>
          {odd}
        </span>
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center border ${
            selecionado ? 'border-[#FFB700] bg-[#FFB700] text-black' : 'border-white/20 text-white/40'
          }`}
        >
          {selecionado ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        </span>
      </span>
    </motion.button>
  );
};
