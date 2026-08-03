import { Router } from "express";

export const riotRouter = Router();

// Cache em memória simples para endpoints da Riot (10 minutos)
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

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

function setCache(key: string, data: any) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
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
