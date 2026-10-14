/**
 * SÉRIE LOCAL da sala LIVRE (TIME vs TIME personalizada — scrim): MD1/MD3/MD5.
 * ISOLADA por completo: só age quando `mode = time_vs_time_livre`. Salas de
 * campeonato continuam usando a série própria (tournament_series_games) e as
 * salas normais não têm série.
 *
 * Chamada quando um jogo da sala livre termina (verificação da Riot): grava o
 * placar local + o vencedor (para o PERDEDOR escolher o lado no próximo jogo) e
 * decide entre VOLTAR PRO PRONTO (ainda há jogo) ou FECHAR (alvo atingido — o
 * fluxo normal de encerramento assume).
 */
import { eq } from "drizzle-orm";
import { matches, campeonatoSalaEstado } from "../../db/schema/matches.js";

/** Vitórias necessárias pelo formato da sala (md3 é o padrão). */
export function alvoVitorias(formato: string | null | undefined): number {
  if (formato === "md1") return 1;
  if (formato === "md5") return 3;
  return 2;
}

/**
 * Aplica o fim do jogo atual. Retorna `true` quando a série CONTINUA (a sala
 * volta para `camp_prontos` no jogo+1) e `false` quando FECHOU (placar já
 * gravado; o encerramento normal segue). Transação própria com lock da sala.
 */
export async function avancarSerieLivre(d: any, matchId: string, winnerSide: "blue" | "red"): Promise<boolean> {
  return d.transaction(async (tx: any) => {
    const [sala] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
    if (!sala || sala.mode !== "time_vs_time_livre") return false;
    const [estado] = await tx
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, matchId))
      .limit(1);
    if (!estado) return false;

    const vencedor: "a" | "b" = winnerSide === "blue" ? "a" : "b";
    const placarA = (estado.placarA ?? 0) + (vencedor === "a" ? 1 : 0);
    const placarB = (estado.placarB ?? 0) + (vencedor === "b" ? 1 : 0);
    const alvo = alvoVitorias(estado.formato);

    if (placarA >= alvo || placarB >= alvo) {
      // Série fechou: grava o placar final e deixa o encerramento normal seguir.
      await tx
        .update(campeonatoSalaEstado)
        .set({ placarA, placarB, ultimoVencedor: vencedor, updatedAt: new Date() })
        .where(eq(campeonatoSalaEstado.matchId, matchId));
      return false;
    }

    // Continua: grava o jogo e volta pro PRONTO do próximo (mesmo código, como
    // o campeonato usa 1 código por série).
    await tx
      .update(campeonatoSalaEstado)
      .set({
        jogo: (estado.jogo ?? 1) + 1,
        prontoBlue: false,
        prontoRed: false,
        sorteioVencedor: null,
        escolhaTime: null,
        ladoEscolhido: null,
        pickOrderEscolhido: null,
        primeiraEscolha: null,
        placarA,
        placarB,
        ultimoVencedor: vencedor,
        updatedAt: new Date(),
      })
      .where(eq(campeonatoSalaEstado.matchId, matchId));
    await tx.update(matches).set({ status: "camp_prontos", updatedAt: new Date() }).where(eq(matches.id, matchId));
    return true;
  });
}
