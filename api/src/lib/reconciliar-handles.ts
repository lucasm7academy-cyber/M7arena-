import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "../../../db/schema/identidade.js";
import { gameAccounts } from "../../../db/schema/games.js";
import { riotRaw } from "../routes/riot.js";

/**
 * Reconciliação do Riot ID (game_accounts.handle) — spec
 * 2026-08-17-reconciliar-handle-riot-design.md.
 *
 * O handle é um retrato gravado na hora do vínculo (profiles.ts /me/riot).
 * Quando o jogador renomeia no LoL o PUUID (externalId) continua o mesmo, então
 * a validação de partida passa mas o nome exibido no site fica velho. Este job
 * busca o nome atual por PUUID na Riot (fonte da verdade) e atualiza handle +
 * espelho users.riot_id quando mudou. Falha da Riot preserva o handle velho.
 */
export const RECONCILIACAO_CONCURRENCY = 3;

export type BuscarNomePorPuuid = (puuid: string) => Promise<{ gameName: string; tagLine: string } | null>;

/** Busca real na Riot (account v1 by puuid) com o cache de 10min do riotRaw. */
async function buscaNomeRiot(puuid: string): Promise<{ gameName: string; tagLine: string } | null> {
  const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;
  const data = await riotRaw(`handles:${puuid}`, url);
  if (!data?.gameName || !data?.tagLine) return null;
  return { gameName: data.gameName, tagLine: data.tagLine };
}

export async function runReconciliacaoHandles(
  d: any = db,
  opts: { buscarNome?: BuscarNomePorPuuid } = {}
): Promise<{ total: number; atualizadas: number; erros: number }> {
  const buscarNome = opts.buscarNome ?? buscaNomeRiot;

  const contas: any[] = await d
    .select()
    .from(gameAccounts)
    .where(and(eq(gameAccounts.gameId, "lol")));

  let atualizadas = 0;
  let erros = 0;

  for (let i = 0; i < contas.length; i += RECONCILIACAO_CONCURRENCY) {
    const fatia = contas.slice(i, i + RECONCILIACAO_CONCURRENCY);
    await Promise.all(
      fatia.map(async (conta: any) => {
        try {
          const nome = await buscarNome(conta.externalId);
          if (!nome) {
            erros++;
            console.warn(`[handles] falha ao buscar nome de ${conta.handle ?? conta.externalId}`);
            return;
          }
          const novo = `${nome.gameName}#${nome.tagLine}`;
          if (novo === conta.handle) return;
          await d
            .update(gameAccounts)
            .set({ handle: novo, syncedAt: new Date(), updatedAt: new Date() })
            .where(eq(gameAccounts.id, conta.id));
          await d
            .update(users)
            .set({ riotId: novo, updatedAt: new Date() })
            .where(eq(users.id, conta.userId));
          atualizadas++;
        } catch (error: any) {
          erros++;
          console.warn(`[handles] falha para ${conta.handle ?? conta.externalId}:`, error?.message || error);
        }
      })
    );
  }

  return { total: contas.length, atualizadas, erros };
}