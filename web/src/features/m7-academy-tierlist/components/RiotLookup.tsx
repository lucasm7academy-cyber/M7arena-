import { Loader2, RefreshCw, Search } from "lucide-react";
import { buildProfileIconUrl } from "../../../api/riot";
import type { RiotPlayer } from "../types";

interface RiotLookupProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  loading: boolean;
  error: string;
  player: RiotPlayer | null;
}

export function RiotLookup({ input, onInputChange, onSubmit, onReset, loading, error, player }: RiotLookupProps) {
  if (player) {
    const iconSrc = player.profileIconUrl || (player.profileIconId ? buildProfileIconUrl(player.profileIconId) : "");

    return (
      <div className="mt-6 border-t border-white/10 pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#101116] text-sm font-black text-primary/60">
              {player.gameName.slice(0, 1).toUpperCase()}
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {player.gameName}
                <span className="text-white/30">#{player.tagLine}</span>
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-white/40">
                Nível {player.summonerLevel ?? "—"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onReset}
            className="flex shrink-0 items-center justify-center gap-1.5 border border-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white/45 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Trocar nick
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="tierlist-riot-id" className="text-[10px] font-black uppercase tracking-widest text-white/45">
          Seu Riot ID
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              id="tierlist-riot-id"
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="Seu nick#TAG — ex: Faker#BR1"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              aria-label="Riot ID"
              className="h-12 w-full border border-white/10 bg-[#0c0d12] pl-10 pr-3 text-sm font-bold text-white outline-none transition-colors placeholder:font-medium placeholder:text-white/25 focus:border-primary/70"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 items-center justify-center gap-2 bg-primary px-6 text-[10px] font-black uppercase tracking-widest text-black transition-colors hover:bg-[#e6a600] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Buscando" : "Buscar"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-2 text-[11px] font-medium text-red-400">{error}</p> : null}
    </div>
  );
}
