/**
 * serie-sala.ts — SÉRIE da SALA 5v5 PERSONALIZADA (MD1/MD3/MD5).
 *
 * A sala 5v5 de 10 vagas (TOP/JG/MID/ADC/SUP) passa a ser uma série, como o
 * usuário pediu em 2026-10-19: o draft se repete a cada jogo, o placar é
 * acumulado e o código Riot é UM só para a série inteira (mesmo mecanismo do
 * campeonato — ADR-048).
 *
 * Estados reusados de propósito (nada de máquina nova): a sala continua no
 * fluxo normal (`confirmacao` → `draft` → `iniciando_partida` → `partida_iniciada`).
 * Entre jogos ela volta para `confirmacao` com TODOS desconfirmados — isso dá
 * aos jogadores a janela para sair/entrar e trocar quem joga (o "Recusar" já
 * existe nesse estado e reabre a sala).
 *
 * O estado da série mora em `campeonato_sala_estado` (a mesma tabela da sala de
 * campeonato/livre): `formato`, `jogo` e `placar_a`/`placar_b`. Salas antigas
 * (sem linha) seguem como MD1 — `jogoAtualSerie` devolve 1 e `avancarSerie5v5`
 * não encontra estado, então o encerramento normal acontece.
 */
import { eq } from "drizzle-orm";
import { matches, matchPlayers, campeonatoSalaEstado } from "../../../db/schema/matches.js";
import { alvoVitorias } from "./serie-livre.js";

export const FORMATOS_SERIE = ["md1", "md3", "md5"] as const;
export type FormatoSerie = (typeof FORMATOS_SERIE)[number];

/**
 * Janela para confirmar presença entre jogos da série. Maior que os 75s do
 * primeiro jogo de propósito: dá tempo de trocar um jogador (sair/entrar)
 * sem a sala expulsar todo mundo no meio da troca.
 */
export const CONFIRMACAO_SERIE_MS = 5 * 60_000;

/** Formato vindo do cliente: só md1/md3/md5; qualquer outra coisa vira md3. */
export function normalizarFormato(formato: unknown): FormatoSerie {
  return typeof formato === "string" && (FORMATOS_SERIE as readonly string[]).includes(formato)
    ? (formato as FormatoSerie)
    : "md3";
}

/** Linha de estado da série da sala (null quando não há série/é sala antiga). */
export async function estadoSerie(d: any, matchId: string) {
  const [st] = await d
    .select()
    .from(campeonatoSalaEstado)
    .where(eq(campeonatoSalaEstado.matchId, matchId))
    .limit(1);
  return st ?? null;
}

/**
 * Jogo corrente da série. Apenas a sala 5v5 tem série aqui; os outros modos
 * (e salas antigas sem estado) respondem 1 — o draft e o encerramento seguem
 * como sempre.
 */
export async function jogoAtualSerie(d: any, match: any): Promise<number> {
  if (match?.mode !== "5v5") return 1;
  const st = await estadoSerie(d, match.id);
  return st?.jogo ?? 1;
}

/**
 * Aplica o fim do jogo atual da série.
 *
 * Retorna `true` quando a série CONTINUA: o placar é gravado, o jogo avança, os
 * jogadores são desconfirmados e a sala volta para `confirmacao` (janela de 5
 * min para trocar quem joga). Retorna `false` quando o alvo de vitórias foi
 * atingido (ou não há série) — nesse caso o encerramento normal da sala assume
 * (paga o pote uma única vez, no fim da série).
 *
 * Transação própria com lock da sala: chamada pelo motor de verificação da
 * Riot, que decide cada jogo no servidor.
 */
export async function avancarSerie5v5(
  d: any,
  matchId: string,
  winnerSide: "blue" | "red"
): Promise<boolean> {
  return d.transaction(async (tx: any) => {
    const [sala] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
    if (!sala || sala.mode !== "5v5") return false;

    const [st] = await tx
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, matchId))
      .limit(1);
    if (!st) return false; // sala antiga/sem série: encerra como sempre

    const placarA = (st.placarA ?? 0) + (winnerSide === "blue" ? 1 : 0);
    const placarB = (st.placarB ?? 0) + (winnerSide === "red" ? 1 : 0);
    const vencedor = winnerSide === "blue" ? "a" : "b";
    const alvo = alvoVitorias(st.formato);

    if (placarA >= alvo || placarB >= alvo) {
      // Série fechou: grava o placar final e o encerramento normal segue
      // (paga o pote com o vencedor do ÚLTIMO jogo = vencedor da série).
      await tx
        .update(campeonatoSalaEstado)
        .set({ placarA, placarB, ultimoVencedor: vencedor, updatedAt: new Date() })
        .where(eq(campeonatoSalaEstado.matchId, matchId));
      return false;
    }

    const agora = new Date();
    await tx
      .update(campeonatoSalaEstado)
      .set({
        jogo: (st.jogo ?? 1) + 1,
        placarA,
        placarB,
        ultimoVencedor: vencedor,
        prontoBlue: false,
        prontoRed: false,
        updatedAt: agora,
      })
      .where(eq(campeonatoSalaEstado.matchId, matchId));

    // Todos precisam confirmar de novo. Sem `linked=false` o "Recusar" (que é
    // como o jogador sai para trocar) seria recusado com `nao_pode_sair`.
    await tx
      .update(matchPlayers)
      .set({ confirmed: false, linked: false })
      .where(eq(matchPlayers.matchId, matchId));

    // O código da partida NÃO é limpo: a série inteira usa o mesmo tournament
    // code (como no campeonato), e o motor de verificação reencontra cada jogo
    // pela janela de `iniciando_partida_at` (reaberta no próximo draft).
    await tx
      .update(matches)
      .set({
        status: "confirmacao",
        confirmacaoExpiresAt: new Date(agora.getTime() + CONFIRMACAO_SERIE_MS),
        stateDeadlineAt: new Date(agora.getTime() + CONFIRMACAO_SERIE_MS),
        iniciandoPartidaAt: null,
        updatedAt: agora,
      })
      .where(eq(matches.id, matchId));

    return true;
  });
}
