// src/api/riot.ts
// ✅ VERSÃO OTIMIZADA - Comunicação via Server Proxy /api/riot (sem vazar chave da Riot)

const PLATFORM_URL = 'https://br1.api.riotgames.com';
const REGIONAL_URL = 'https://americas.api.riotgames.com';
const DDR_BASE = 'https://ddragon.leagueoflegends.com';

let ddrVersion: string | null = null;
const REQUEST_TIMEOUT = 8000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Timeout na requisição');
    throw err;
  }
}

function riotError(status: number, riotId?: string): Error {
  if (status === 404) return new Error(riotId ? `Conta "${riotId}" não encontrada` : 'Recurso não encontrado');
  if (status === 403) return new Error('API Key inválida ou sem permissão');
  if (status === 429) return new Error('Limite de requisições atingido. Aguarde um instante.');
  if (status === 503) return new Error('Serviço da Riot temporariamente indisponível');
  return new Error(`Erro ${status}`);
}

// Busca a versão via proxy do servidor
export async function getDDRVersion(): Promise<string> {
  if (ddrVersion) return ddrVersion;
  try {
    const res = await fetchWithTimeout("/api/riot/version");
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        ddrVersion = data.version;
        return ddrVersion;
      }
    }
  } catch {}
  ddrVersion = '15.8.1';
  return ddrVersion;
}

export function buildProfileIconUrl(iconId: number, version?: string): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${iconId}.jpg`;
}

export function buildChampionIconUrl(championKey: string, version?: string): string {
  const v = version ?? ddrVersion ?? '15.8.1';
  return `${DDR_BASE}/cdn/${v}/img/champion/${championKey}.png`;
}

// Busca conta via proxy do servidor /api/riot/account
export async function buscarContaRiot(riotId: string) {
  const [gameName, tagLine] = riotId.split('#');
  if (!gameName || !tagLine) throw new Error('Formato inválido. Use Nome#TAG');
  const url = `/api/riot/account/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw riotError(res.status, riotId);
  return await res.json();
}

export async function buscarInvocadorPorPUUID(puuid: string) {
  const res = await fetchWithTimeout(`/api/riot/summoner/${puuid}`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Essa conta não tem perfil de League of Legends no servidor BR.');
    }
    throw riotError(res.status);
  }
  return await res.json();
}

export async function buscarElo(puuid: string) {
  try {
    const res = await fetchWithTimeout(`/api/riot/league/${puuid}`);
    if (res.status === 429) throw new Error('RATE_LIMIT');
    if (!res.ok) return [];
    return await res.json();
  } catch (err: any) {
    if (err?.message === 'RATE_LIMIT') throw err;
    return [];
  }
}

export async function buscarJogadorCompleto(riotId: string) {
  try {
    const [conta, version] = await Promise.all([buscarContaRiot(riotId), getDDRVersion()]);
    const [invocador, eloData] = await Promise.all([buscarInvocadorPorPUUID(conta.puuid), buscarElo(conta.puuid)]);
    return {
      success: true as const,
      data: {
        riotId: `${conta.gameName}#${conta.tagLine}`,
        puuid: conta.puuid,
        summonerId: invocador.id,
        nivel: invocador.summonerLevel,
        iconeId: invocador.profileIconId,
        iconeUrl: buildProfileIconUrl(invocador.profileIconId, version),
        ranqueadas: eloData,
      },
    };
  } catch (error: any) {
    return { success: false as const, error: error.message };
  }
}

export async function buscarSugestoes(prefixo: string): Promise<Array<{ riotId: string; iconId: number; level: number }>> {
  if (!prefixo || prefixo.length < 2) return [];
  const jogadoresConhecidos = ['Kami#BR1', 'Jhin#BR2', 'Baiano#BR1', 'Mylon#BR1', 'TitaN#BR1', 'Faker#KR1', 'Tyler1#NA1', 'Caps#EUW1'];
  const matches = jogadoresConhecidos.filter(id => id.toLowerCase().startsWith(prefixo.toLowerCase()));
  const resultados = [];
  for (const riotId of matches.slice(0, 5)) {
    try {
      const resultado = await buscarJogadorCompleto(riotId);
      if (resultado.success) {
        resultados.push({ riotId: resultado.data.riotId, iconId: resultado.data.iconeId, level: resultado.data.nivel });
      }
    } catch {}
  }
  return resultados;
}

// Estatísticas dos últimos N dias agora são agregadas no servidor
// (GET /api/riot/stats/:puuid, com cache de 30min por puuid). O cliente faz
// 1 única chamada em vez de ~80 requests à Riot.
export async function buscarEstatisticasRecentes(puuid: string, days = 90) {
  try {
    const res = await fetchWithTimeout(`/api/riot/stats/${puuid}?days=${days}&count=40`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[riot] falha ao buscar estatísticas recentes:', err);
    return null;
  }
}