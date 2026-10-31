import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import type { AvailabilityWindow, RiotPlayer } from "../types";
import { formatAvailability } from "../utils";

interface SuccessScreenProps {
  player: RiotPlayer;
  fullName: string;
  poolCount: number;
  availability: AvailabilityWindow[];
  onRestart: () => void;
}

export function SuccessScreen({ player, fullName, poolCount, availability, onRestart }: SuccessScreenProps) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />

      <p className="mt-5 text-[9px] font-black uppercase tracking-[0.28em] text-primary">M7 Academy</p>
      <h1 className="mt-1 text-2xl font-black uppercase tracking-wide text-white">Tier list enviada</h1>
      <p className="mt-3 text-sm font-medium leading-relaxed text-white/45">
        Valeu, <strong className="text-white">{fullName.split(" ")[0]}</strong>. Seus dados já estão com a comissão
        da M7 Academy.
      </p>

      <div className="mt-6 divide-y divide-white/10 border-y border-white/10 text-left">
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Riot ID</span>
          <span className="truncate text-xs font-black text-white">{player.riotId}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Pool</span>
          <span className="text-xs font-black text-white">{poolCount} campeões</span>
        </div>
        <div className="flex items-start justify-between gap-4 py-3">
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-white/30">Horários</span>
          <span className="text-right text-[11px] font-bold leading-relaxed text-white/70">
            {formatAvailability(availability)}
          </span>
        </div>
      </div>

      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          to="/lobby"
          className="flex items-center justify-center gap-2 border border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 transition-colors hover:border-primary/40 hover:text-primary"
        >
          Voltar para a M7 Arena <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={onRestart}
          className="flex items-center justify-center gap-2 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white/30 transition-colors hover:text-primary"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Enviar outra resposta
        </button>
      </div>
    </div>
  );
}
