import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";
import { users } from "../../../db/schema/identidade.js";
import { pagarPremio, pagarEmpate, pagarCancelamento } from "../lib/escrow.js";
import { getAuthUser, notifyMatchChange } from "../lib/match-flow.js";
import { getRoles, eRevisor } from "../lib/acesso-sala.js";
import { listarPrints } from "./prints.js";
import { listarDisputas } from "./disputas.js";

export const revisaoRouter = Router();

/**
 * Revisão das salas apostadas (ADR-019 / design v3 §6). Só admin/moderador
 * decide; a fila é por antiguidade de `revisao_desde` (mais antiga primeiro).
 * A decisão roda em transação com lock de linha e verifica o status DENTRO da
 * transação — dois cliques simultâneos só pagam uma vez (§4.3).
 */

/** Só admin ou moderador revisa (design v3 §6: revisor por role, não por usuário fixo). */
async function exigeRevisor(req: any, res: any) {
  const user = await getAuthUser(req);
  if (!user) return { user: null, erro: res.status(401).json({ erro: "nao_autenticado" }) };
  const roles = await getRoles(db, user.id);
  if (!eRevisor(roles)) {
    return { user: null, erro: res.status(403).json({ erro: "sem_permissao" }) };
  }
  return { user };
}

/** Jogadores da sala (para o painel do revisor: quem está do lado azul/vermelho). */
async function listarJogadores(db: any, matchId: string) {
  return db
    .select({
      userId: matchPlayers.userId,
      nome: users.displayName,
      side: matchPlayers.side,
      confirmed: matchPlayers.confirmed,
    })
    .from(matchPlayers)
    .innerJoin(users, eq(users.id, matchPlayers.userId))
    .where(eq(matchPlayers.matchId, matchId))
    .orderBy(matchPlayers.side, matchPlayers.slot);
}

// GET /api/revisao/pendentes — fila por antiguidade, com jogadores, prints e
// disputas embutidos para o painel não precisar de N+1 requisições.
revisaoRouter.get("/pendentes", async (req, res) => {
  try {
    const r = await exigeRevisor(req, res);
    if (!r.user) return;
    const rows = await db
      .select()
      .from(matches)
      .where(eq(matches.status, "aguardando_revisao"))
      .orderBy(matches.revisaoDesde);
    const detalhadas = await Promise.all(
      rows.map(async (s) => ({
        ...s,
        jogadores: await listarJogadores(db, s.id),
        prints: await listarPrints(db, s.id),
        disputas: await listarDisputas(db, s.id),
      }))
    );
    return res.json(detalhadas);
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/revisao/:id/decidir — { winnerSide: 'blue'|'red'|'draw'|'cancel', decisionId }
revisaoRouter.post("/:id/decidir", async (req, res) => {
  try {
    const r = await exigeRevisor(req, res);
    if (!r.user) return;
    const user = r.user;

    const { winnerSide, decisionId } = req.body;
    const matchId = req.params.id;

    // `decision_id` é uma coluna uuid no banco (idempotência §4.3). Um valor
    // fora do formato estouraria o Postgres com 500 — valida aqui e responde
    // 400 amigável (o painel gera via crypto.randomUUID, então nunca chega aqui
    // no fluxo normal).
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!decisionId || typeof decisionId !== "string" || !uuidRegex.test(decisionId)) {
      return res.status(400).json({ erro: "decision_id_invalido" });
    }

    const r2 = await db.transaction(async (tx: any) => {
      const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
      if (!m) return { ok: false, erro: "sala_nao_encontrada" };
      // Idempotência de API: retry com o mesmo decision_id retorna o resultado
      // já aplicado sem duplicar o ledger (§4.3).
      if (m.status !== "aguardando_revisao" || m.decisaoId) {
        return { ok: false, erro: "partida_ja_decidida", estado: m.status };
      }

      const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, m.id));
      const aposta = m.apostaMc ?? 0;
      const taxa = Number(m.taxaPct ?? 8.99);

      if (winnerSide === "blue" || winnerSide === "red") {
        await pagarPremio(tx, m.id, aposta, players, winnerSide, taxa);
        await tx.update(matches).set({
          status: "encerrada",
          winnerSide,
          resultado: winnerSide,
          decisaoId: decisionId ?? null,
          revisadoPor: user.id,
          revisadoEm: new Date(),
          endedAt: new Date(),
        }).where(eq(matches.id, m.id));
      } else if (winnerSide === "draw") {
        await pagarEmpate(tx, m.id, aposta, players);
        await tx.update(matches).set({
          status: "encerrada",
          winnerSide: "draw",
          resultado: "draw",
          decisaoId: decisionId ?? null,
          revisadoPor: user.id,
          revisadoEm: new Date(),
          endedAt: new Date(),
        }).where(eq(matches.id, m.id));
      } else if (winnerSide === "cancel") {
        await pagarCancelamento(tx, m.id, aposta, players);
        await tx.update(matches).set({
          status: "cancelada",
          resultado: null,
          decisaoId: decisionId ?? null,
          canceladoEm: new Date(),
          revisadoPor: user.id,
          revisadoEm: new Date(),
        }).where(eq(matches.id, m.id));
      } else {
        return { ok: false, erro: "resultado_invalido" };
      }

      // LIBERA os vínculos dos jogadores: sem isso, após o admin decidir, eles
      // continuam `linked=true` e o join de outra sala bloqueia com
      // `ja_em_outra_sala` (matches.ts). A partida terminou — ninguém fica preso.
      await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, m.id));

      return { ok: true, estado: winnerSide === "cancel" ? "cancelada" : "encerrada" };
    });

    if (r2.ok) notifyMatchChange(matchId);
    return res.json(r2);
  } catch (e: any) {
    // constraint única do ledger estourou = já pago -> rollback já aconteceu
    if (e?.code === "23505") return res.status(409).json({ erro: "partida_ja_decidida" });
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});
