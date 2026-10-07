/**
 * ddragon.ts — versão e URLs do Data Dragon (ddragon.leagueoflegends.com).
 *
 * O host antigo dos avatares (raw.communitydragon.org) respondia em ~20s por
 * imagem; o ddragon responde em menos de 1s e cobre todos os ícones do patch
 * atual. A versão muda a cada patch: é buscada uma vez e revalidada a cada 6h
 * em background, sem bloquear quem chamou (usa a última conhecida enquanto isso).
 */

const DDR_BASE = "https://ddragon.leagueoflegends.com";
const FALLBACK_VERSION = "16.20.1";
const REFRESH_TTL_MS = 6 * 60 * 60 * 1000;

let version = FALLBACK_VERSION;
let lastRefresh = 0;
let refreshing: Promise<void> | null = null;

function refresh(): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = fetch(`${DDR_BASE}/api/versions.json`)
    .then(async (res) => {
      if (!res.ok) return;
      const versions = (await res.json()) as string[];
      if (versions[0]) {
        version = versions[0];
        lastRefresh = Date.now();
      }
    })
    .catch((err) => {
      console.warn("[ddragon] falha ao buscar a versão atual:", err);
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Versão atual do ddragon; dispara o refresh em background quando vencida. */
export function ddrVersion(): string {
  if (Date.now() - lastRefresh > REFRESH_TTL_MS) void refresh();
  return version;
}

export function profileIconUrl(iconId: number, v?: string): string {
  return `${DDR_BASE}/cdn/${v ?? ddrVersion()}/img/profileicon/${iconId}.png`;
}
