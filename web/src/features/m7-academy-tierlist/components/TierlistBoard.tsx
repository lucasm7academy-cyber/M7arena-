import { Plus, X } from "lucide-react";
import { buildChampionIconUrl } from "../../../api/riot";
import { TIER_STYLES } from "../constants";
import { POOL_TIERS, type ChampionPoolEntry, type PoolTier } from "../types";

interface TierlistBoardProps {
  entries: ChampionPoolEntry[];
  onAdd: (tier: PoolTier) => void;
  onRemove: (index: number) => void;
}

export function TierlistBoard({ entries, onAdd, onRemove }: TierlistBoardProps) {
  return (
    <div className="space-y-2">
      {POOL_TIERS.map((tier) => {
        const style = TIER_STYLES[tier];
        const items = entries
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.tier === tier);

        return (
          <div key={tier} className="border border-white/10 bg-[#08080a]">
            <div className="flex min-h-[72px]">
              <div className={`relative flex w-12 shrink-0 items-center justify-center ${style.block}`}>
                <span className={`absolute inset-y-0 left-0 w-[3px] ${style.rail}`} />
                <span className="font-headline text-xl font-black leading-none">{tier}</span>
              </div>

              <div className="flex flex-1 flex-wrap content-center items-center gap-2 p-2">
                {items.length === 0 ? (
                  <span className="px-1 text-[9px] font-bold uppercase tracking-widest text-white/20">
                    sem campeões
                  </span>
                ) : null}

                {items.map(({ entry, index }) => (
                  <button
                    key={`${entry.championId}-${index}`}
                    type="button"
                    onClick={() => onRemove(index)}
                    title={`${entry.championName} · tier ${tier} — clique para remover`}
                    className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/15 bg-[#17181d] transition-transform hover:scale-105 hover:border-red-400/60"
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-primary/60">
                      {entry.championName.slice(0, 1).toUpperCase()}
                    </span>
                    <img
                      src={buildChampionIconUrl(entry.championId)}
                      alt={entry.championName}
                      loading="lazy"
                      draggable={false}
                      className="relative z-10 h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 opacity-0 transition-opacity group-hover:opacity-100">
                      <X className="h-5 w-5 text-red-400" />
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => onAdd(tier)}
                  title={`Adicionar campeão no tier ${tier}`}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-white/15 text-white/30 transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
