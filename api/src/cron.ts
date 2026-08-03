import { lt, and, eq } from "drizzle-orm";
import { db } from "./db.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { userStrikes } from "../../db/schema/apostas.js";
import { devolverEntrada } from "./lib/escrow.js";

const KICK_OCIOSIDADE_MS = 30 * 60 * 1000;
const FANTASMA_MS = 3 * 60 * 60 * 1000;

/**
 * Job único a cada 10 min (design v3 §8): kick de ociosidade + partida
 * fantasma. Nunca escreve estado por fora da máquina — cada ação reusa a
 * lógica com FOR UPDATE. Aviso ao usuário aos 25 min fica para a camada de
 * realtime (P4).
 */
export async function runCron(d: any = db) {
  const agora = new Date();
  const kickLimite = new Date(agora.getTime() - KICK_OCIOSIDADE_MS);
  const fantasmaLimite = new Date(agora.getTime() - FANTASMA_MS);

  let kikados = 0;
  let fantasmas = 0;

  // 1. Kick de ociosidade: vagas ocupadas há 30min em salas 'preenchendo'
  const salasPreenchendo = await d.select().from(matches).where(eq(matches.status, "preenchendo"));
  for (const sala of salasPreenchendo) {
    const vagas = await d
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, sala.id), lt(matchPlayers.createdAt, kickLimite)));
    for (const vaga of vagas) {
      await d.transaction(async (tx: any) => {
        const [m] = await tx.select().from(matches).where(eq(matches.id, sala.id)).limit(1).for("update");
        if (m?.status !== "preenchendo") return; // mudou desde a leitura
        await devolverEntrada(tx, vaga.userId, m.apostaMc ?? 0, m.id);
        await tx.delete(matchPlayers).where(and(eq(matchPlayers.matchId, m.id), eq(matchPlayers.userId, vaga.userId)));
        await tx.insert(userStrikes).values({ userId: vaga.userId, matchId: m.id, motivo: "kick_ociosidade" });
      });
      kikados++;
    }
  }

  // 2. Partida fantasma: 'partida_iniciada' aposta>0 há 3h sem print
  const fantasmasList = await d
    .select()
    .from(matches)
    .where(and(eq(matches.status, "partida_iniciada"), lt(matches.updatedAt, fantasmaLimite)));
  for (const sala of fantasmasList) {
    if (!sala.apostaMc || sala.apostaMc <= 0) continue;
    await d
      .update(matches)
      .set({ status: "aguardando_revisao", revisaoDesde: agora })
      .where(eq(matches.id, sala.id));
    fantasmas++;
  }

  return { kikados, fantasmas };
}
