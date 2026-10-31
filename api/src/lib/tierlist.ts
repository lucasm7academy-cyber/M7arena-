import {
  TIERLIST_ROLES,
  TIERLIST_TIERS,
  type TierlistAvailabilityWindow,
  type TierlistChampionEntry,
  type TierlistRole,
  type TierlistTier,
} from "../../../db/schema/tierlist.js";

const RIOT_TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function horarioValido(inicio: string, fim: string): boolean {
  if (!TIME_RE.test(inicio) || !TIME_RE.test(fim)) return false;
  // 22:00–00:00 é uma janela válida (termina à meia-noite).
  if (fim === "00:00") return inicio !== "00:00";
  return inicio < fim;
}

export interface RankSnapshot {
  tier: string;
  rank: string;
  lp: number;
  wins: number;
  losses: number;
}

export interface TierlistValidatedPayload {
  riotId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  summonerLevel: number | null;
  profileIconId: number | null;
  soloTier: string | null;
  soloRank: string | null;
  soloLp: number | null;
  soloWins: number | null;
  soloLosses: number | null;
  flexTier: string | null;
  flexRank: string | null;
  flexLp: number | null;
  flexWins: number | null;
  flexLosses: number | null;
  fullName: string;
  contact: string;
  contactType: string;
  email: string | null;
  discord: string | null;
  primaryRole: TierlistRole;
  secondaryRole: TierlistRole | null;
  availability: TierlistAvailabilityWindow[];
  championPool: TierlistChampionEntry[];
  notes: string | null;
}

class PayloadError extends Error {}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requireText(value: unknown, label: string, min: number, max: number): string {
  const text = clean(value);
  if (text.length < min) throw new PayloadError(`${label} é obrigatório.`);
  if (text.length > max) throw new PayloadError(`${label} deve ter no máximo ${max} caracteres.`);
  return text;
}

function optionalText(value: unknown, label: string, max: number): string | null {
  const text = clean(value);
  if (!text) return null;
  if (text.length > max) throw new PayloadError(`${label} deve ter no máximo ${max} caracteres.`);
  return text;
}

function optionalInt(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function optionalRank(value: unknown): RankSnapshot | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") throw new PayloadError("Dados de elo inválidos.");

  const raw = value as Record<string, unknown>;
  const tier = clean(raw.tier).toUpperCase();
  if (!tier) return null;
  if (!RIOT_TIERS.includes(tier as (typeof RIOT_TIERS)[number])) {
    throw new PayloadError("Elo da Riot inválido.");
  }

  const rank = clean(raw.rank).toUpperCase().slice(0, 5);
  const lp = Number(raw.lp ?? raw.leaguePoints ?? 0);
  const wins = Number(raw.wins ?? 0);
  const losses = Number(raw.losses ?? 0);
  if (!Number.isInteger(lp) || lp < 0 || lp > 10000) throw new PayloadError("PDL inválido.");
  if (!Number.isInteger(wins) || wins < 0 || wins > 100000) throw new PayloadError("Vitórias inválidas.");
  if (!Number.isInteger(losses) || losses < 0 || losses > 100000) throw new PayloadError("Derrotas inválidas.");

  return { tier, rank, lp, wins, losses };
}

function parseAvailability(value: unknown): TierlistAvailabilityWindow[] {
  if (!Array.isArray(value)) throw new PayloadError("Disponibilidade inválida.");
  if (value.length === 0) throw new PayloadError("Adicione pelo menos um horário de disponibilidade.");
  if (value.length > 21) throw new PayloadError("Máximo de 21 janelas de disponibilidade.");

  const seen = new Set<string>();
  const windows: TierlistAvailabilityWindow[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") throw new PayloadError("Janela de disponibilidade inválida.");
    const raw = item as Record<string, unknown>;
    const diaSemana = Number(raw.diaSemana);
    const horaInicio = clean(raw.horaInicio);
    const horaFim = clean(raw.horaFim);

    if (!Number.isInteger(diaSemana) || diaSemana < 1 || diaSemana > 7) {
      throw new PayloadError("Dia da semana inválido.");
    }
    if (!horarioValido(horaInicio, horaFim)) {
      throw new PayloadError("Horário inválido.");
    }

    const key = `${diaSemana}:${horaInicio}:${horaFim}`;
    if (seen.has(key)) continue;
    seen.add(key);
    windows.push({ diaSemana, horaInicio, horaFim });
  }

  return windows.sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio));
}

function parseChampionPool(value: unknown): TierlistChampionEntry[] {
  if (!Array.isArray(value)) throw new PayloadError("Tier list inválida.");
  if (value.length < 3) throw new PayloadError("Adicione pelo menos 3 campeões na sua tier list.");
  if (value.length > 80) throw new PayloadError("Máximo de 80 campeões na tier list.");

  const seen = new Set<string>();
  const pool: TierlistChampionEntry[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") throw new PayloadError("Campeão inválido.");
    const raw = item as Record<string, unknown>;
    const championId = requireText(raw.championId, "Campeão", 1, 50);
    const championName = requireText(raw.championName, "Campeão", 1, 50);
    const role = clean(raw.role).toUpperCase() as TierlistRole;
    const tier = clean(raw.tier).toUpperCase() as TierlistTier;

    if (!TIERLIST_ROLES.includes(role)) throw new PayloadError("Rota do campeão inválida.");
    if (!TIERLIST_TIERS.includes(tier)) throw new PayloadError("Tier do campeão inválida.");

    const key = championId.toLowerCase();
    if (seen.has(key)) throw new PayloadError("Há campeões repetidos na tier list.");
    seen.add(key);

    pool.push({ championId, championName, role, tier });
  }

  return pool;
}

/**
 * Valida e normaliza o JSON vindo da página pública. O servidor é a fonte de
 * verdade dos limites: o cliente não decide quais campos entram no banco.
 */
export function validarTierlistPayload(
  body: unknown
): { ok: true; data: TierlistValidatedPayload } | { ok: false; error: string } {
  try {
    if (!body || typeof body !== "object") throw new PayloadError("Payload inválido.");
    const raw = body as Record<string, any>;

    const rawRiotId = requireText(raw.riotId, "Riot ID", 3, 100);
    const hashIndex = rawRiotId.lastIndexOf("#");
    if (hashIndex <= 0 || hashIndex === rawRiotId.length - 1) {
      throw new PayloadError("Riot ID inválido. Use o formato Nome#TAG.");
    }

    const gameName = requireText(raw.gameName ?? rawRiotId.slice(0, hashIndex), "Nome da Riot", 1, 100);
    const tagLine = requireText(raw.tagLine ?? rawRiotId.slice(hashIndex + 1), "TAG da Riot", 1, 20);
    const riotId = `${gameName}#${tagLine}`;
    const puuid = requireText(raw.puuid, "PUUID", 10, 100);

    const solo = optionalRank(raw.solo);
    const flex = optionalRank(raw.flex);

    const fullName = requireText(raw.fullName, "Nome completo", 2, 150);
    const contactDigits = clean(raw.contact).replace(/\D/g, "");
    if (contactDigits.length < 10 || contactDigits.length > 15) {
      throw new PayloadError("WhatsApp inválido. Informe DDD + número.");
    }

    const email = optionalText(raw.email, "E-mail", 255);
    if (email && !EMAIL_RE.test(email)) throw new PayloadError("E-mail inválido.");
    const discord = optionalText(raw.discord, "Discord", 100);

    const primaryRole = clean(raw.primaryRole).toUpperCase() as TierlistRole;
    if (!TIERLIST_ROLES.includes(primaryRole)) throw new PayloadError("Rota principal inválida.");
    const secondaryRaw = clean(raw.secondaryRole).toUpperCase();
    const secondaryRole = secondaryRaw && secondaryRaw !== primaryRole ? (secondaryRaw as TierlistRole) : null;
    if (secondaryRole && !TIERLIST_ROLES.includes(secondaryRole)) {
      throw new PayloadError("Rota secundária inválida.");
    }

    if (raw.acceptedTerms !== true) throw new PayloadError("É preciso autorizar o uso dos dados para enviar.");

    const notes = optionalText(raw.notes, "Observações", 1000);

    return {
      ok: true,
      data: {
        riotId,
        puuid,
        gameName,
        tagLine,
        summonerLevel: optionalInt(raw.summonerLevel, 0, 1000),
        profileIconId: optionalInt(raw.profileIconId, 0, 100000),
        soloTier: solo?.tier ?? null,
        soloRank: solo?.rank ?? null,
        soloLp: solo?.lp ?? null,
        soloWins: solo?.wins ?? null,
        soloLosses: solo?.losses ?? null,
        flexTier: flex?.tier ?? null,
        flexRank: flex?.rank ?? null,
        flexLp: flex?.lp ?? null,
        flexWins: flex?.wins ?? null,
        flexLosses: flex?.losses ?? null,
        fullName,
        contact: contactDigits,
        contactType: "whatsapp",
        email,
        discord,
        primaryRole,
        secondaryRole,
        availability: parseAvailability(raw.availability),
        championPool: parseChampionPool(raw.championPool),
        notes,
      },
    };
  } catch (error) {
    if (error instanceof PayloadError) return { ok: false, error: error.message };
    console.error("[tierlist] erro inesperado na validação:", error);
    return { ok: false, error: "Não foi possível validar os dados." };
  }
}
