import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "../../../db/schema/identidade.js";
import { gameAccounts } from "../../../db/schema/games.js";

/**
 * Reconciliação do perfil Riot cacheado (game_accounts.handle + metadata) —
 * spec 2026-08-17-reconciliar-handle-riot-design.md, estendida em 2026-09-21.
 *
 * O que sincroniza com a Riot (fonte da verdade, por PUUID):
 *  - handle + espelho users.riot_id (account-v1): o jogador renomeia no LoL e o
 *    PUUID continua o mesmo, então o nome exibido no site ficava velho.
 *  - metadata.profile_icon_id + metadata.level (summoner-v4): trocar o ícone no
 *    LoL não tinha NENHUM refresh automático — só o botão "Atualizar dados" do
 *    próprio usuário.
 *
 * A varredura é espaçada de propósito: a chave pessoal da Riot aceita 100
 * req/2min e a versão anterior disparava ~220 requisições de uma vez — os logs
 * mostravam 304 respostas 429, ou seja, a maioria das contas nunca sincronizava.
 * Falha da Riot preserva o dado velho; 429 respeita o Retry-After.
 */
export const RECONCILIACAO_LOTE = 3;
// 3 contas × 2 chamadas por lote = 6 req a cada 10s ≈ 72 req/2min (teto: 100),
// deixando folga para o proxy /api/riot e o refresh de elos, que usam a mesma chave.
export const RECONCILIACAO_INTERVALO_MS = 10_000;
const MAX_TENTATIVAS = 3;
const RETRY_429_PADRAO_MS = 15_000;

const RIOT_ACCOUNT_URL = "https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid";
const RIOT_SUMMONER_URL = "https://br1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid";

export type PerfilRiot = {
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
  summonerLevel: number | null;
};

export type BuscarPerfilPorPuuid = (puuid: string) => Promise<PerfilRiot | null>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET na Riot com o token do servidor. Nunca lança: erro de rede/HTTP → null
 * (o chamador preserva o dado velho). 404 (conta inexistente) não insiste;
 * 429 espera o Retry-After (ou 15s) e tenta de novo.
 */
async function fetchRiot(url: string): Promise<any | null> {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    console.warn("[handles] RIOT_API_KEY ausente — reconciliação inerte");
    return null;
  }

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { "X-Riot-Token": apiKey } });
    } catch (error: any) {
      console.warn(`[handles] rede falhou (${tentativa}/${MAX_TENTATIVAS}): ${error?.message || error}`);
      if (tentativa < MAX_TENTATIVAS) {
        await sleep(2_000);
        continue;
      }
      return null;
    }

    if (res.ok) return await res.json();
    if (res.status === 404) return null;
    if (res.status === 429 && tentativa < MAX_TENTATIVAS) {
      const retryAfterS = Number(res.headers.get("retry-after"));
      const espera = Number.isFinite(retryAfterS) && retryAfterS > 0 ? retryAfterS * 1000 : RETRY_429_PADRAO_MS;
      console.warn(
        `[handles] 429 da Riot — aguardando ${Math.round(espera / 1000)}s (tentativa ${tentativa}/${MAX_TENTATIVAS})`
      );
      await sleep(espera);
      continue;
    }
    console.warn(`[handles] Riot API error ${res.status} em ${url}`);
    return null;
  }
  return null;
}

/** Busca o perfil real na Riot (nome + ícone + nível). */
async function buscaPerfilRiot(puuid: string): Promise<PerfilRiot | null> {
  const conta = await fetchRiot(`${RIOT_ACCOUNT_URL}/${encodeURIComponent(puuid)}`);
  if (!conta?.gameName || !conta?.tagLine) return null;

  const summoner = await fetchRiot(`${RIOT_SUMMONER_URL}/${encodeURIComponent(puuid)}`);
  return {
    gameName: conta.gameName,
    tagLine: conta.tagLine,
    profileIconId: typeof summoner?.profileIconId === "number" ? summoner.profileIconId : null,
    summonerLevel: typeof summoner?.summonerLevel === "number" ? summoner.summonerLevel : null,
  };
}

export async function runReconciliacaoHandles(
  d: any = db,
  opts: { buscarPerfil?: BuscarPerfilPorPuuid } = {}
): Promise<{ total: number; atualizadas: number; erros: number }> {
  const buscarPerfil = opts.buscarPerfil ?? buscaPerfilRiot;

  const contas: any[] = await d
    .select()
    .from(gameAccounts)
    .where(and(eq(gameAccounts.gameId, "lol")));

  let atualizadas = 0;
  let erros = 0;

  for (let i = 0; i < contas.length; i += RECONCILIACAO_LOTE) {
    const fatia = contas.slice(i, i + RECONCILIACAO_LOTE);
    await Promise.all(
      fatia.map(async (conta: any) => {
        try {
          const perfil = await buscarPerfil(conta.externalId);
          if (!perfil) {
            erros++;
            console.warn(`[handles] falha ao buscar perfil de ${conta.handle ?? conta.externalId}`);
            return;
          }

          const nomeNovo = `${perfil.gameName}#${perfil.tagLine}`;
          const meta = (conta.metadata as Record<string, any>) || {};
          const mudouNome = nomeNovo !== conta.handle;
          const mudouIcone =
            perfil.profileIconId !== null && perfil.profileIconId !== meta.profile_icon_id;
          const mudouNivel = perfil.summonerLevel !== null && perfil.summonerLevel !== meta.level;
          if (!mudouNome && !mudouIcone && !mudouNivel) return;

          await d
            .update(gameAccounts)
            .set({
              ...(mudouNome ? { handle: nomeNovo } : {}),
              metadata: {
                ...meta,
                ...(perfil.profileIconId !== null ? { profile_icon_id: perfil.profileIconId } : {}),
                ...(perfil.summonerLevel !== null ? { level: perfil.summonerLevel } : {}),
              },
              syncedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(gameAccounts.id, conta.id));

          // Espelho do vínculo (ADR-023): users.riot_id acompanha o handle.
          if (mudouNome) {
            await d
              .update(users)
              .set({ riotId: nomeNovo, updatedAt: new Date() })
              .where(eq(users.id, conta.userId));
          }
          atualizadas++;
        } catch (error: any) {
          erros++;
          console.warn(`[handles] falha para ${conta.handle ?? conta.externalId}:`, error?.message || error);
        }
      })
    );

    if (i + RECONCILIACAO_LOTE < contas.length) await sleep(RECONCILIACAO_INTERVALO_MS);
  }

  return { total: contas.length, atualizadas, erros };
}
