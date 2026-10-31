import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { buildChampionIconUrl } from "../../../api/riot";
import { useSound } from "../../../hooks/useSound";
import { bestLane, CHAMPIONS, type Champion } from "../data/champions";
import { ROLE_META, TIER_STYLES } from "../constants";
import { POOL_ROLES, type PoolRole, type PoolTier } from "../types";
import { CutInput } from "./Field";

interface ChampionPickerProps {
  open: boolean;
  tier: PoolTier | null;
  onClose: () => void;
  onPick: (champion: Champion) => void;
}

export function ChampionPicker({ open, tier, onClose, onPick }: ChampionPickerProps) {
  const { playSound } = useSound();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<PoolRole | "ALL">("ALL");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setRoleFilter("ALL");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return CHAMPIONS.filter((champion) => {
      if (roleFilter !== "ALL" && bestLane(champion) !== roleFilter) return false;
      if (!normalized) return true;
      return (
        champion.name.toLowerCase().includes(normalized) || champion.id.toLowerCase().includes(normalized)
      );
    });
  }, [query, roleFilter]);

  if (!open || !tier) return null;

  const tierStyle = TIER_STYLES[tier];

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/80 p-3 pt-16 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl border border-white/15 bg-[#08080a] shadow-2xl shadow-black/60">
        <div className="flex max-h-[82vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#0c0d12] p-4 sm:p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-widest text-white sm:text-lg">
                  Adicionar campeão
                </h2>
                <span
                  className="px-2 py-1 text-[9px] font-black uppercase tracking-widest"
                  style={{ backgroundColor: tierStyle.border, color: "#08080a" }}
                >
                  Tier {tier}
                </span>
              </div>
              <p className="mt-1 text-[10px] font-medium text-white/35">
                {filtered.length} campeões no catálogo
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-white/5 text-white/50 transition-colors hover:border-primary/40 hover:text-primary"
              aria-label="Fechar seletor de campeão"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 border-b border-white/5 p-4 sm:p-5">
            <CutInput
              leftIcon={<Search className="h-4 w-4" />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar campeão por nome..."
              autoFocus
            />

            <div>
              <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-white/30">
                Filtrar por rota
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRoleFilter("ALL")}
                  className={`border px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${
                    roleFilter === "ALL"
                      ? "border-primary bg-primary text-black"
                      : "border-white/10 bg-[#0c0d12] text-white/50 hover:border-white/25 hover:text-white"
                  }`}
                >
                  Todas
                </button>
                {POOL_ROLES.map((value) => {
                  const meta = ROLE_META[value];
                  const active = roleFilter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRoleFilter(value)}
                      className={`flex items-center gap-1.5 border px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${
                        active
                          ? "border-primary bg-primary text-black"
                          : "border-white/10 bg-[#0c0d12] text-white/50 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      <img
                        src={meta.img}
                        alt={meta.label}
                        className={`h-3.5 w-3.5 object-contain ${active ? "brightness-0" : "opacity-60"}`}
                      />
                      {meta.short}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {filtered.length === 0 ? (
              <p className="py-16 text-center text-xs font-medium text-white/30">Nenhum campeão encontrado.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9">
                {filtered.map((champion) => (
                  <button
                    key={champion.id}
                    type="button"
                    title={champion.name}
                    onClick={() => {
                      playSound("click");
                      onPick(champion);
                      onClose();
                    }}
                    className="group flex min-w-0 flex-col items-center gap-1.5 border border-transparent p-1 transition-colors hover:border-primary/40 hover:bg-white/[0.03]"
                  >
                    <span className="relative block h-14 w-14 overflow-hidden rounded-full border border-white/15 bg-[#17181d] transition-transform group-hover:scale-105 group-hover:border-primary/70">
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-primary/60">
                        {champion.name.slice(0, 1).toUpperCase()}
                      </span>
                      <img
                        src={buildChampionIconUrl(champion.id)}
                        alt={champion.name}
                        loading="lazy"
                        draggable={false}
                        className="relative h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    </span>
                    <span className="w-full truncate text-center text-[9px] font-bold text-white/45 group-hover:text-white">
                      {champion.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <p className="text-[9px] font-medium text-white/25">Clique em um campeão para adicionar.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
