import React from 'react';
import { motion } from 'motion/react';
import { Plus, Check } from 'lucide-react';
import type { ApiBetMarket } from '../../lib/api';

const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';
const CUT_BUTTON_INNER = 'polygon(8.8px 0, 100% 0, 100% calc(100% - 8.8px), calc(100% - 8.8px) 100%, 0 100%, 0 8.8px)';

interface ItemMercadoProps {
  market: ApiBetMarket;
  odd: string; // odd formatada (ex.: "1.35x")
  selecionado: boolean;
  onClick: () => void;
}

/**
 * Item de mercado do painel de aposta individual. Estilo cut-edge (recorte no
 * canto), com selo da odd e estado selecionado destacado — mesmo padrão visual
 * dos cards de sala em /jogar (ADR-005).
 */
export const ItemMercado: React.FC<ItemMercadoProps> = ({ market, odd, selecionado, onClick }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative p-[1px] w-full transition-all cursor-pointer"
      style={{
        clipPath: CUT_BUTTON,
        background: selecionado
          ? 'linear-gradient(135deg, #FFB700, #FFE082)'
          : 'rgba(255,255,255,0.1)',
      }}
    >
      <div
        className="w-full py-2 px-3 flex items-center justify-between gap-2 bg-[#111116]"
        style={{
          clipPath: CUT_BUTTON_INNER,
          background: selecionado ? 'rgba(255,183,0,0.10)' : '#111116',
        }}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-200 line-clamp-2 text-left">
          {market.label}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[11px] font-black shrink-0 ${selecionado ? 'text-[#FFB700]' : 'text-white/50'}`}
          >
            {odd}
          </span>
          <span
            className={`w-5 h-5 flex items-center justify-center border ${
              selecionado ? 'border-[#FFB700] bg-[#FFB700] text-black' : 'border-white/20 text-white/40'
            }`}
            style={{ clipPath: CUT_BUTTON }}
          >
            {selecionado ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          </span>
        </span>
      </div>
    </motion.button>
  );
};
