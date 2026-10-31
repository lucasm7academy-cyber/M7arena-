import { useState, type Dispatch, type SetStateAction } from "react";
import toast from "react-hot-toast";
import type { ChampionPoolEntry, PoolRole, PoolTier } from "../types";
import type { Champion } from "../data/champions";
import { ChampionPicker } from "./ChampionPicker";
import { TierlistBoard } from "./TierlistBoard";

const MAX_POOL = 60;

interface TierlistSectionProps {
  pool: ChampionPoolEntry[];
  setPool: Dispatch<SetStateAction<ChampionPoolEntry[]>>;
  primaryRole: PoolRole;
}

export function TierlistSection({ pool, setPool, primaryRole }: TierlistSectionProps) {
  const [pickerTier, setPickerTier] = useState<PoolTier | null>(null);

  function handlePick(champion: Champion) {
    if (!pickerTier) return;

    if (pool.some((entry) => entry.championId === champion.id)) {
      setPool((prev) =>
        prev.map((entry) =>
          entry.championId === champion.id ? { ...entry, role: primaryRole, tier: pickerTier } : entry,
        ),
      );
      toast.success(`${champion.name} movido para o tier ${pickerTier}.`);
      return;
    }

    if (pool.length >= MAX_POOL) {
      toast.error(`Máximo de ${MAX_POOL} campeões na tier list.`);
      return;
    }

    setPool((prev) => [
      ...prev,
      { championId: champion.id, championName: champion.name, role: primaryRole, tier: pickerTier },
    ]);
  }

  return (
    <section className="border-t border-white/10 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-white">Sua tier list</h2>
        <span className="text-[10px] font-bold text-white/30">
          {pool.length}/{MAX_POOL} campeões
        </span>
      </div>

      <p className="mt-1 text-[10px] font-medium text-white/25">
        Clique no + para adicionar. Clique no campeão para remover.
      </p>

      <div className="mt-4">
        <TierlistBoard
          entries={pool}
          onAdd={(tier) => setPickerTier(tier)}
          onRemove={(index) => setPool((prev) => prev.filter((_, i) => i !== index))}
        />
      </div>

      <ChampionPicker
        open={pickerTier !== null}
        tier={pickerTier}
        onClose={() => setPickerTier(null)}
        onPick={handlePick}
      />
    </section>
  );
}
