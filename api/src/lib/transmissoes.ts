// api/src/lib/transmissoes.ts
// Fim automático das lives de jogo (spec 2026-09-29). Os pontos de finalização
// de jogo/série chamam `encerrarTransmissoesDoJogo`; a leitura (lib/streams.ts)
// também filtra pelo status do jogo, como segunda camada.
import { and, eq } from "drizzle-orm";
import { transmissoes } from "../../../db/schema/conteudo.js";

/** Status de jogo decidido — a transmissão vinculada não fica mais no ar. */
export const STATUS_JOGO_FINALIZADO = ["finalizado", "finalizada", "finished"];

/** Desliga todas as transmissões ativas vinculadas ao jogo. */
export async function encerrarTransmissoesDoJogo(d: any, matchId: string | null | undefined) {
  if (!matchId) return;
  await d
    .update(transmissoes)
    .set({ ativo: false })
    .where(and(eq(transmissoes.matchId, matchId), eq(transmissoes.ativo, true)));
}
