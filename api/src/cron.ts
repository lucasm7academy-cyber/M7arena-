import { lt, and, eq, inArray, isNull, not } from "drizzle-orm";
import { db } from "./db.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { users } from "../../db/schema/identidade.js";
import { walletTransactions } from "../../db/schema/economia.js";
import { userStrikes } from "../../db/schema/apostas.js";
import { devolverEntrada } from "./lib/escrow.js";
import { aplicarSuspensaoSeNecessario, notifyMatchChange } from "./lib/match-flow.js";
import { ESTADOS_ATIVOS } from "./lib/elegibilidade.js";

const KICK_OCIOSIDADE_MS = 30 * 60 * 1000;
const FANTASMA_MS = 3 * 60 * 60 * 1000;

/**
 * Job único a cada 10 min (design v3 §8): kick de ociosidade + partida
 * fantasma + strike de abandono + reativação de suspensões. Nunca escreve
 * estado por fora da máquina — cada ação reusa a lógica com FOR UPDATE.
 * Aviso ao usuário aos 25 min fica para a camada de realtime (P4).
 */
export async function runCron(d: any = db) {
  const agora = new Date();
  const kickLimite = new Date(agora.getTime() - KICK_OCIOSIDADE_MS);
  const fantasmaLimite = new Date(agora.getTime() - FANTASMA_MS);

  let kikados = 0;
  let fantasmas = 0;
  let abandonos = 0;
  let reativados = 0;
  let sanitizadas = 0;

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
        await aplicarSuspensaoSeNecessario(tx, vaga.userId, agora);
      });
      // Avisa os clientes na sala (o kikado vê o aviso de strike na hora,
      // design v3 §11) — o realtime refaz o GET e deriva a mensagem.
      notifyMatchChange(sala.id);
      kikados++;
    }
  }

  // 2. Partida fantasma: 'partida_iniciada' há 3h sem print. Vale para TODAS as
  //    salas (decisão de 2026-08-03: o resultado é sempre decidido pelo admin;
  //    casuais e apostadas sem print em 3h entram na fila de revisão).
  const fantasmasList = await d
    .select()
    .from(matches)
    .where(and(eq(matches.status, "partida_iniciada"), lt(matches.updatedAt, fantasmaLimite)));
  for (const sala of fantasmasList) {
    await d
      .update(matches)
      .set({ status: "aguardando_revisao", revisaoDesde: agora })
      .where(eq(matches.id, sala.id));
    notifyMatchChange(sala.id); // jogadores veem "em análise" sem refresh
    fantasmas++;
  }

  // 3. Abandono: jogador que pagou a reserva (escrow ativo) e sumiu do
  // match_players de uma sala apostada ativa SEM decisão → strike 'abandono'.
  // Depois de iniciar não se sai manualmente; se a vaga esvaziou, ou foi
  // remoção manual ou abandono — o resultado da partida decide o dinheiro.
  const salasApostadasAtivas = await d
    .select()
    .from(matches)
    .where(and(inArray(matches.status, ["partida_iniciada", "aguardando_revisao"]), isNull(matches.decisaoId)));
  for (const sala of salasApostadasAtivas) {
    if (!sala.apostaMc || sala.apostaMc <= 0) continue;
    const [reservas, devolucoes, presentes] = await Promise.all([
      d
        .select({ userId: walletTransactions.userId })
        .from(walletTransactions)
        .where(and(eq(walletTransactions.refId, sala.id), eq(walletTransactions.kind, "match_entry_reserve"))),
      d
        .select({ userId: walletTransactions.userId })
        .from(walletTransactions)
        .where(and(eq(walletTransactions.refId, sala.id), eq(walletTransactions.kind, "match_entry_refund"))),
      d.select({ userId: matchPlayers.userId }).from(matchPlayers).where(eq(matchPlayers.matchId, sala.id)),
    ]);
    const presentesSet = new Set(presentes.map((p: any) => p.userId));
    const devolvidosSet = new Set(devolucoes.map((s: any) => s.userId));
    for (const r of reservas) {
      if (presentesSet.has(r.userId) || devolvidosSet.has(r.userId)) continue; // ainda na sala ou saiu antes de iniciar
      const [jaExiste] = await d
        .select({ id: userStrikes.id })
        .from(userStrikes)
        .where(and(
          eq(userStrikes.matchId, sala.id),
          eq(userStrikes.userId, r.userId),
          eq(userStrikes.motivo, "abandono"),
        ))
        .limit(1);
      if (jaExiste) continue; // idempotente: 1 strike de abandono por partida
      await d.insert(userStrikes).values({ userId: r.userId, matchId: sala.id, motivo: "abandono" });
      await aplicarSuspensaoSeNecessario(d, r.userId, agora);
      abandonos++;
    }
  }

  // 4. Reativa suspensões expiradas: status 'suspensa' com suspensa_ate no passado.
  const suspensos = await d.select().from(users).where(and(eq(users.status, "suspensa"), lt(users.suspensaAte, agora)));
  for (const u of suspensos) {
    await d
      .update(users)
      .set({ status: "active", suspensaAte: null, updatedAt: agora })
      .where(eq(users.id, u.id));
    reativados++;
  }

  // 5. Saneamento (ajustarsala bug D): salas presas em estados mortos (ex.:
  //    'finalizacao', estado da votação removida pelo ADR-027) viram
  //    'encerrada', e o `linked` residual de salas não ativas é liberado.
  //    Sem isso, um jogador fica bloqueado para sempre com `ja_em_outra_sala`.
  const ESTADOS_MORTOS = ["finalizacao"];
  const mortas = await d
    .select({ id: matches.id, salaNum: matches.salaNum })
    .from(matches)
    .where(inArray(matches.status, ESTADOS_MORTOS));
  for (const morta of mortas) {
    await d
      .update(matches)
      .set({ status: "encerrada", endedAt: agora, updatedAt: agora, stateDeadlineAt: null })
      .where(eq(matches.id, morta.id));
    await d
      .update(matchPlayers)
      .set({ linked: false })
      .where(and(eq(matchPlayers.matchId, morta.id), eq(matchPlayers.linked, true)));
    sanitizadas++;
  }
  if (mortas.length > 0) console.log(`[cron] saneamento: ${mortas.length} sala(s) morta(s) encerrada(s)`);

  // Libera `linked` residual de jogadores em salas que não estão mais ativas
  // (encerrada/cancelada), para nenhum join ficar preso por dado órfão.
  const linkedOrfao: { matchId: string }[] = await d
    .select({ matchId: matchPlayers.matchId })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .where(and(eq(matchPlayers.linked, true), not(inArray(matches.status, ESTADOS_ATIVOS))));
  if (linkedOrfao.length > 0) {
    const idsOrfaos = [...new Set(linkedOrfao.map((p) => p.matchId))];
    for (const matchId of idsOrfaos) {
      await d
        .update(matchPlayers)
        .set({ linked: false })
        .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.linked, true)));
    }
    console.log(`[cron] saneamento: ${linkedOrfao.length} vinculo(s) orfao(s) liberado(s) em ${idsOrfaos.length} sala(s)`);
  }

  return { kikados, fantasmas, abandonos, reativados, sanitizadas };
}
