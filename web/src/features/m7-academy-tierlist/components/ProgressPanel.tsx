import { Check, ShieldCheck, UserRound } from "lucide-react";
import { CutCard } from "../../../components/ui/CutCard";
import { CUT_BADGE, CUT_BADGE_INNER, RIOT_TIER_LABELS } from "../constants";
import type { RiotPlayer } from "../types";

interface ProgressPanelProps {
  hasRiot: boolean;
  profileReady: boolean;
  poolReady: boolean;
  poolCount: number;
  player: RiotPlayer | null;
}

function Step({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 p-[1px]"
        style={{ clipPath: CUT_BADGE, background: done ? "#FFB800" : "rgba(255,255,255,0.15)" }}
      >
        <span
          className={`flex h-full w-full items-center justify-center text-[10px] font-black ${
            done ? "bg-primary text-black" : "bg-[#0c0d12] text-white/35"
          }`}
          style={{ clipPath: CUT_BADGE_INNER }}
        >
          {done ? <Check className="h-3.5 w-3.5" /> : ""}
        </span>
      </span>
      <div>
        <p className={`text-[11px] font-black uppercase tracking-wider ${done ? "text-white" : "text-white/55"}`}>
          {label}
        </p>
        <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-white/30">{detail}</p>
      </div>
    </div>
  );
}

export function ProgressPanel({ hasRiot, profileReady, poolReady, poolCount, player }: ProgressPanelProps) {
  return (
    <div className="space-y-3">
      <CutCard
        background="#08080a"
        borderColor="rgba(255,183,0,0.25)"
        contentClassName="p-5"
        className="shadow-2xl shadow-black/30"
      >
        <p className="mb-4 text-[9px] font-black uppercase tracking-[0.24em] text-primary">Seu progresso</p>
        <div className="space-y-4">
          <Step done={hasRiot} label="Riot ID" detail={hasRiot ? "Conta localizada no BR." : "Busque seu nick para começar."} />
          <Step
            done={profileReady}
            label="Seus dados"
            detail={profileReady ? "Contato e horários preenchidos." : "Nome, WhatsApp e disponibilidade."}
          />
          <Step
            done={poolReady}
            label="Tier list"
            detail={poolReady ? `${poolCount} campeões no pool.` : `Adicione pelo menos 3 campeões (${poolCount}/3).`}
          />
        </div>
      </CutCard>

      {player ? (
        <CutCard
          background="#08080a"
          borderColor="rgba(255,255,255,0.09)"
          contentClassName="p-4"
          className="shadow-2xl shadow-black/30"
        >
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-primary/40">
              <img src={player.profileIconUrl} alt={player.riotId} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-white">{player.riotId}</p>
              <p className="mt-0.5 text-[10px] font-bold text-white/35">
                {player.solo
                  ? `${RIOT_TIER_LABELS[player.solo.tier] ?? player.solo.tier} ${player.solo.rank} · ${player.solo.lp} PDL`
                  : "Sem Solo/Duo"}
              </p>
            </div>
          </div>
        </CutCard>
      ) : (
        <CutCard
          background="#070709"
          borderColor="rgba(255,255,255,0.06)"
          contentClassName="p-4"
          className="shadow-2xl shadow-black/30"
        >
          <div className="flex items-center gap-2 text-white/35">
            <UserRound className="h-4 w-4 text-primary/50" />
            <p className="text-[10px] font-bold leading-relaxed">
              O formulário abre depois que você encontra sua conta na Riot.
            </p>
          </div>
        </CutCard>
      )}

      <div className="border border-white/5 bg-white/[0.015] p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" />
          <p className="text-[10px] font-medium leading-relaxed text-white/30">
            Link privado da comissão da <strong className="text-white/55">M7 Academy</strong>. Seus dados não aparecem
            publicamente e não exigem cadastro.
          </p>
        </div>
      </div>
    </div>
  );
}
