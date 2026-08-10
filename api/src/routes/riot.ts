import { Router } from "express";

export const riotRouter = Router();

// Cache em memória simples para endpoints da Riot (10 minutos)
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
// O /stats agrega até 40 partidas (~80 chamadas à Riot); o resultado agregado
// fica cacheado 30min para que cada sync de perfil faça 1 chamada externa.
// O TTL dos proxies (/matches, /match, /stats) permanece 10min.
const STATS_TTL_MS = 30 * 60 * 1000;
const STATS_BATCH_SIZE = 5;
const STATS_BATCH_DELAY_MS = 600;

// Endpoints que o fork do front (web/src/api/riot.ts) já consome via proxy
// (sec.riot-key). A chave da Riot vive só aqui, nunca no bundle.
const PLATFORM_URL = "https://br1.api.riotgames.com"; // LoL BR
const REGIONAL_URL = "https://americas.api.riotgames.com"; // contas, match v5, challenges
const DDR_BASE = "https://ddragon.leagueoflegends.com";

function getCached(key: string) {
  const item = cache.get(key);
  if (item && item.expiresAt > Date.now()) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttlMs: number = CACHE_TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Proxy genérico para um endpoint da Riot: injeta a chave, usa cache de 10min
 * e repassa o status HTTP da Riot (404 sem dados de rank, 403 sem permissão,
 * 429 rate limit) — o front já trata cada um desses casos.
 */
async function riotFetch(res: any, cacheKey: string, url: string) {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RIOT_API_KEY não configurada no servidor" });
  }

  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const response = await fetch(url, {
    headers: { "X-Riot-Token": apiKey },
  });

  if (!response.ok) {
    return res.status(response.status).json({ error: `Riot API error ${response.status}` });
  }

  const data = await response.json();
  setCache(cacheKey, data);
  return res.json(data);
}

/**
 * Fetch cru para um endpoint da Riot, com o mesmo cache de 10min do proxy,
 * mas retornando o dado ao chamador em vez de escrever no res. Usado pelo
 * /stats, que precisa do JSON bruto (ids e detalhes) para agregar.
 * Retorna null em erro (403/404/429/5xx) e loga — nunca engole silencioso.
 */
async function riotRaw(cacheKey: string, url: string): Promise<any | null> {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    console.warn("[riot] RIOT_API_KEY não configurada no servidor");
    return null;
  }

  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(url, {
    headers: { "X-Riot-Token": apiKey },
  });

  if (!response.ok) {
    console.warn(`[riot] ${url} → Riot API error ${response.status}`);
    return null;
  }

  const data = await response.json();
  setCache(cacheKey, data);
  return data;
}

// GET /api/riot/version - Retorna a versão atual do DataDragon (DDragon)
riotRouter.get("/version", async (_req, res) => {
  try {
    const cachedVersion = getCached("ddr_version");
    if (cachedVersion) {
      return res.json({ version: cachedVersion });
    }

    const response = await fetch(`${DDR_BASE}/api/versions.json`);
    if (!response.ok) {
      throw new Error(`DDragon error: ${response.status}`);
    }
    const versions = (await response.json()) as string[];
    const latest = versions[0] || "15.1.1";

    setCache("ddr_version", latest);
    return res.json({ version: latest });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar versão do DDragon" });
  }
});

// GET /api/riot/account/:gameName/:tagLine - Busca conta Riot por GameName e TagLine
riotRouter.get("/account/:gameName/:tagLine", async (req, res) => {
  try {
    const { gameName, tagLine } = req.params;
    const cacheKey = `account:${gameName.toLowerCase()}:${tagLine.toLowerCase()}`;
    const riotUrl = `${REGIONAL_URL}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName
    )}/${encodeURIComponent(tagLine)}`;
    return await riotFetch(res, cacheKey, riotUrl);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao consultar conta na Riot API" });
  }
});

// GET /api/riot/summoner/:puuid - Invocador (nível, ícone, summonerId) por PUUID
riotRouter.get("/summoner/:puuid", async (req, res) => {
  try {
    const { puuid } = req.params;
    const riotUrl = `${PLATFORM_URL}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
    return await riotFetch(res, `summoner:${puuid}`, riotUrl);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar invocador na Riot API" });
  }
});

// GET /api/riot/league/:puuid - Entradas ranqueadas (solo/flex) por PUUID
riotRouter.get("/league/:puuid", async (req, res) => {
  try {
    const { puuid } = req.params;
    const riotUrl = `${PLATFORM_URL}/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
    return await riotFetch(res, `league:${puuid}`, riotUrl);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar elo na Riot API" });
  }
});

// GET /api/riot/matches/:puuid?count=N&queue=N&startTime=S - IDs de partidas por PUUID
riotRouter.get("/matches/:puuid", async (req, res) => {
  try {
    const { puuid } = req.params;
    const allowed = ["count", "queue", "startTime", "endTime"] as const;
    const params = new URLSearchParams();
    for (const key of allowed) {
      const value = req.query[key];
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    const riotUrl = `${REGIONAL_URL}/lol/match/v5/matches/by-puuid/${encodeURIComponent(
      puuid
    )}/ids${qs ? `?${qs}` : ""}`;
    return await riotFetch(res, `matches:${puuid}:${qs}`, riotUrl);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar histórico de partidas" });
  }
});

// GET /api/riot/match/:matchId - Detalhes de uma partida (match v5)
riotRouter.get("/match/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    const riotUrl = `${REGIONAL_URL}/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    return await riotFetch(res, `match:${matchId}`, riotUrl);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar detalhes da partida" });
  }
});

// ── Stats dos últimos N dias (server-side) ───────────────────────────────────

type RiotStatsResult = {
  topChampions: { championName: string; games: number; wins: number; winrate: number }[];
  roles: { role: string; games: number; percentage: number }[];
  totalGames: number;
};

const EMPTY_STATS: RiotStatsResult = { topChampions: [], roles: [], totalGames: 0 };

/**
 * Agrega detalhes de partidas exatamente como o cliente fazia em
 * web/src/api/riot.ts (buscarEstatisticasRecentes): champMap/roleMap,
 * topChampions top 10 por games desc, roles com percentage, totalGames =
 * total de partidas baixadas (não as que tinham o participante).
 */
function aggregateStats(matches: any[], puuid: string): RiotStatsResult {
  const champMap: Record<string, { games: number; wins: number }> = {};
  const roleMap: Record<string, number> = {};

  for (const match of matches) {
    const me = match?.info?.participants?.find((p: any) => p.puuid === puuid);
    if (!me) continue;
    const name = me.championName;
    if (!champMap[name]) champMap[name] = { games: 0, wins: 0 };
    champMap[name].games++;
    if (me.win) champMap[name].wins++;
    const pos = me.teamPosition || me.individualPosition || "";
    if (pos) roleMap[pos] = (roleMap[pos] || 0) + 1;
  }

  const totalGames = matches.length;
  const topChampions = Object.entries(champMap)
    .map(([championName, s]) => ({
      championName,
      games: s.games,
      wins: s.wins,
      winrate: Math.round((s.wins / s.games) * 100),
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10);
  const roles = Object.entries(roleMap)
    .map(([role, games]) => ({
      role,
      games,
      percentage: totalGames > 0 ? Math.round((games / totalGames) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games);

  return { topChampions, roles, totalGames };
}

// GET /api/riot/stats/:puuid?days=90&count=40 - Estatísticas dos últimos N dias
// Agrega no servidor (40 ids + detalhes em lotes de 5) e cacheia 30min por puuid.
riotRouter.get("/stats/:puuid", async (req, res) => {
  try {
    const { puuid } = req.params;

    const daysParam = Number(req.query.days);
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 90;

    const countParam = Number(req.query.count);
    const count = Number.isFinite(countParam) && countParam > 0 ? Math.min(countParam, 100) : 40;

    const cacheKey = `stats:${puuid}:${days}:${count}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const startTime = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    const idsUrl = `${REGIONAL_URL}/lol/match/v5/matches/by-puuid/${encodeURIComponent(
      puuid
    )}/ids?count=${count}&startTime=${startTime}`;
    const ids = (await riotRaw(`matches:${puuid}:count=${count}&startTime=${startTime}`, idsUrl)) as
      | string[]
      | null;

    if (ids === null) {
      // Falha na busca de ids (403/404/429 etc.), já logada em riotRaw.
      // Não cacheia: erro transiente não deve servir 30min de resultado vazio.
      return res.json(EMPTY_STATS);
    }
    if (ids.length === 0) {
      const empty: RiotStatsResult = { ...EMPTY_STATS };
      setCache(cacheKey, empty, STATS_TTL_MS);
      return res.json(empty);
    }

    const allResults: any[] = [];
    for (let i = 0; i < ids.length; i += STATS_BATCH_SIZE) {
      const batch = ids.slice(i, i + STATS_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((id: string) =>
          riotRaw(`match:${id}`, `${REGIONAL_URL}/lol/match/v5/matches/${encodeURIComponent(id)}`)
        )
      );
      allResults.push(...results);
      if (i + STATS_BATCH_SIZE < ids.length) {
        await new Promise((r) => setTimeout(r, STATS_BATCH_DELAY_MS));
      }
    }

    const stats = aggregateStats(allResults.filter(Boolean), puuid);
    setCache(cacheKey, stats, STATS_TTL_MS);
    return res.json(stats);
  } catch (error: any) {
    console.warn("[riot] /stats: erro ao agregar:", error?.message || error);
    return res.json(EMPTY_STATS);
  }
});
