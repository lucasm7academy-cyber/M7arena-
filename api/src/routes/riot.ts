import { Router } from "express";

export const riotRouter = Router();

// Cache em memória simples para endpoints da Riot (10 minutos)
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

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

// GET /api/riot/version - Retorna a versão atual do DataDragon (DDragon)
riotRouter.get("/version", async (_req, res) => {
  try {
    const cachedVersion = getCached("ddr_version");
    if (cachedVersion) {
      return res.json({ version: cachedVersion });
    }

    const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
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
    const apiKey = process.env.RIOT_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "RIOT_API_KEY não configurada no servidor" });
    }

    const cacheKey = `account:${gameName.toLowerCase()}:${tagLine.toLowerCase()}`;
    const cachedAccount = getCached(cacheKey);
    if (cachedAccount) {
      return res.json(cachedAccount);
    }

    const riotUrl = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName
    )}/${encodeURIComponent(tagLine)}`;

    const response = await fetch(riotUrl, {
      headers: {
        "X-Riot-Token": apiKey,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Riot API error ${response.status}` });
    }

    const account = await response.json();
    setCache(cacheKey, account);

    return res.json(account);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao consultar conta na Riot API" });
  }
});
