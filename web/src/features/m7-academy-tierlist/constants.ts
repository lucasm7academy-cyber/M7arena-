import type { PoolRole, PoolTier } from "./types";

// ── Cantos recortados oficiais da M7 Arena ────────────────────────────────────
export const CUT_FRAME = "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)";
export const CUT_FRAME_INNER =
  "polygon(13.8px 0, 100% 0, 100% calc(100% - 13.8px), calc(100% - 13.8px) 100%, 0 100%, 0 13.8px)";
export const CUT_BUTTON = "polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)";
export const CUT_BUTTON_INNER =
  "polygon(8.8px 0, 100% 0, 100% calc(100% - 8.8px), calc(100% - 8.8px) 100%, 0 100%, 0 8.8px)";
export const CUT_BADGE = "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)";
export const CUT_BADGE_INNER =
  "polygon(5.8px 0, 100% 0, 100% calc(100% - 5.8px), calc(100% - 5.8px) 100%, 0 100%, 0 5.8px)";

export const ROLE_META: Record<PoolRole, { label: string; short: string; img: string }> = {
  TOP: { label: "Top", short: "TOP", img: "/lanes_brancas/Top_iconB.png" },
  JG: { label: "Jungle", short: "JG", img: "/lanes_brancas/Jungle_iconB.png" },
  MID: { label: "Mid", short: "MID", img: "/lanes_brancas/Middle_iconB.png" },
  ADC: { label: "ADC", short: "ADC", img: "/lanes_brancas/Bottom_iconB.png" },
  SUP: { label: "Suporte", short: "SUP", img: "/lanes_brancas/Support_iconB.png" },
};

export const TIER_STYLES: Record<PoolTier, { block: string; rail: string; border: string }> = {
  S: { block: "bg-red-500/10 text-red-300", rail: "bg-red-500/80", border: "rgba(248,113,113,0.55)" },
  A: { block: "bg-amber-500/10 text-amber-300", rail: "bg-amber-500/80", border: "rgba(251,191,36,0.55)" },
  B: { block: "bg-yellow-500/10 text-yellow-300", rail: "bg-yellow-500/80", border: "rgba(250,204,21,0.55)" },
  C: { block: "bg-emerald-500/10 text-emerald-300", rail: "bg-emerald-500/80", border: "rgba(52,211,153,0.55)" },
  D: { block: "bg-sky-500/10 text-sky-300", rail: "bg-sky-500/80", border: "rgba(56,189,248,0.55)" },
};

export const WEEK_DAYS = [
  { value: 1, label: "Seg", full: "Segunda" },
  { value: 2, label: "Ter", full: "Terça" },
  { value: 3, label: "Qua", full: "Quarta" },
  { value: 4, label: "Qui", full: "Quinta" },
  { value: 5, label: "Sex", full: "Sexta" },
  { value: 6, label: "Sáb", full: "Sábado" },
  { value: 7, label: "Dom", full: "Domingo" },
] as const;

export const RIOT_TIER_LABELS: Record<string, string> = {
  IRON: "Ferro",
  BRONZE: "Bronze",
  SILVER: "Prata",
  GOLD: "Ouro",
  PLATINUM: "Platina",
  EMERALD: "Esmeralda",
  DIAMOND: "Diamante",
  MASTER: "Mestre",
  GRANDMASTER: "Grão-Mestre",
  CHALLENGER: "Desafiante",
};

export const RIOT_TIER_COLORS: Record<string, string> = {
  IRON: "#8b8f98",
  BRONZE: "#b07a5a",
  SILVER: "#b8c2cc",
  GOLD: "#f0b73f",
  PLATINUM: "#59c7b5",
  EMERALD: "#4fd18b",
  DIAMOND: "#6aa8ff",
  MASTER: "#c071ff",
  GRANDMASTER: "#ff6d6d",
  CHALLENGER: "#ffd666",
};
