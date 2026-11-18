// Loja de essência do lobby: vitrine de itens cosméticos. A compra ainda não
// tem endpoint; o CTA fica desabilitado e nenhuma cobrança é simulada no cliente.
import { Lock, Store } from 'lucide-react';
import type { ShopItem } from '../domain/lobby-data';
import { formatChips } from '../domain/engine';
import { EssenceIcon } from './EssenceIcon';

const RARITY: Record<ShopItem['rarity'], { cor: string; label: string }> = {
  comum: { cor: '#9AA4AD', label: 'Comum' },
  raro: { cor: '#5B8DEF', label: 'Raro' },
  'épico': { cor: '#A855F7', label: 'Épico' },
  'lendário': { cor: '#FFB700', label: 'Lendário' },
};

export interface EssenceShopProps {
  items: ShopItem[];
  ea?: number | null;
}

export function EssenceShop({ items, ea }: EssenceShopProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const raridade = RARITY[item.rarity];
        const falta = typeof ea === 'number' ? Math.max(0, item.price - ea) : 0;

        return (
          <article
            key={item.id}
            className="group relative flex flex-col overflow-hidden rounded-[10px] border border-white/10 bg-[#0A0B0C] transition-colors hover:border-white/20"
          >
            <div
              className="relative flex h-28 items-center justify-center overflow-hidden"
              style={{
                background: `radial-gradient(circle at 50% 40%, ${item.previewTint}38 0%, rgba(6,7,8,0.9) 68%)`,
              }}
            >
              <span
                aria-hidden
                className="absolute inset-0 opacity-[0.16]"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 7px)',
                }}
              />
              <span
                aria-hidden
                className="relative select-none text-4xl drop-shadow-[0_6px_14px_rgba(0,0,0,0.7)]"
                style={{ color: item.previewTint }}
              >
                {item.preview}
              </span>
              <span
                className="absolute left-2 top-2 rounded-[2px] border px-1.5 py-[1px] text-[8px] font-black uppercase tracking-[0.14em]"
                style={{
                  color: raridade.cor,
                  borderColor: `${raridade.cor}55`,
                  background: `${raridade.cor}14`,
                }}
              >
                {raridade.label}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-1 p-3">
              <h4 className="text-[13px] font-black uppercase tracking-wide text-white">
                {item.name}
              </h4>
              <p className="flex-1 text-[11px] leading-snug text-white/45">{item.description}</p>

              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[13px] font-black tabular-nums text-[#6fe3d0]">
                  <EssenceIcon size={12} />
                  {item.price === 0 ? 'Incluso' : `${formatChips(item.price)} EA`}
                </span>
                <button
                  type="button"
                  disabled
                  title="A loja de essência ainda não está liberada"
                  aria-label={`Comprar ${item.name} — em breve`}
                  className="flex cursor-not-allowed items-center gap-1 rounded-[3px] border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/35"
                >
                  <Lock className="h-2.5 w-2.5" />
                  Em breve
                </button>
              </div>

              {falta > 0 && item.price > 0 && (
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/25">
                  Faltam {formatChips(falta)} EA
                </p>
              )}
            </div>
          </article>
        );
      })}

      <p className="col-span-full flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/25">
        <Store className="h-3 w-3" />
        Itens cosméticos da mesa. A compra com essência entra em uma próxima atualização.
      </p>
    </div>
  );
}
