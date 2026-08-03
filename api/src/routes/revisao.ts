import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";
import { userRoles } from "../../../db/schema/identidade.js";
import { pagarPremio, pagarEmpate, pagarCancelamento } from "../lib/escrow.js";
import { getAuthUser, notifyMatchChange } from "../lib/match-flow.js";

export const revisaoRouter = Router();

/**
 * Revisão das salas apostadas (ADR-019 / design v3 §6). Só admin/moderador
 * decide; a fila é por antiguidade de `revisao_desde` (mais antiga primeiro).
 * A decisão roda em transação com lock de linha e verifica o status DENTRO da
 * transação — dois cliques simultâneos só pagam uma vez (§4.3).
 */

async function getRoles(userId: string): Promise<string[]> {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

/** Só admin ou moderador revisa (design v3 §6: revisor por role, não por usuário fixo). */
async function exigeRevisor(req: any, res: any) {
  const user = await getAuthUser(req);
  if (!user) return { user: null, erro: res.status(401).json({ erro: "nao_autenticado" }) };
  const roles = await getRoles(user.id);
  if (!roles.includes("admin") && !roles.includes("moderador")) {
    return { user: null, erro: res.status(403).json({ erro: "sem_permissao" }) };
  }
  return { user };
}

// GET /api/revisao/pendentes — fila por antiguidade
revisaoRouter.get("/pendentes", async (req, res) => {
  try {
    const r = await exigeRevisor(req, res);
    if (!r.user) return;
    const rows = await db
      .select()
      .from(matches)
      .where(eq(matches.status, "aguardando_revisao"))
      .orderBy(matches.revisaoDesde);
    return res.json(rows);
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
