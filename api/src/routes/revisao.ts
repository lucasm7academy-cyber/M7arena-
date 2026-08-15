import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { matches, matchPlayers, matchCodes } from "../../../db/schema/matches.js";
import { users } from "../../../db/schema/identidade.js";
import { pagarPremio, pagarEmpate, pagarCancelamento, reverterPayout } from "../lib/escrow.js";
import { getAuthUser, notifyMatchChange } from "../lib/match-flow.js";
import { getRoles, eRevisor } from "../lib/acesso-sala.js";
import { listarPrints } from "./prints.js";
import { listarDisputas } from "./disputas.js";
import { matchDisputas } from "../../../db/schema/apostas.js";

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
        // Cancelamento já reverte tudo — disputas abertas da sala ficam órfãs
        // (painel de contestações tentaria reverter de novo → 400 eterno).
        await tx.update(matchDisputas).set({ status: "resolvida" }).where(eq(matchDisputas.matchId, m.id));
      } else {
        return { ok: false, erro: "resultado_invalido" };
      }

      // LIBERA os vínculos dos jogadores: sem isso, após o admin decidir, eles
      // continuam `linked=true` e o join de outra sala bloqueia com
      // `ja_em_outra_sala` (matches.ts). A partida terminou — ninguém fica preso.
      await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, m.id));

      // Garante o tournament code de volta ao pool (idempotente). O report-result
      // e o cron de partida fantasma já liberam; este é o fallback para qualquer
      // caminho que entre em revisão sem liberar — sem ele, o rodízio esgota e
      // a próxima sala recebe "SEM-CODIGO-AGUARDE".
      await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, m.id));

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

// GET /api/revisao/disputas — disputas abertas em partidas ENCERRADAS (spec
// verificacao-partida-riot). O fluxo normal não gera mais aguardando_revisao;
// o painel do admin vira "contestações a julgar".
revisaoRouter.get("/disputas", async (req, res) => {
  try {
    const r = await exigeRevisor(req, res);
    if (!r.user) return;
    const rows = await db
      .select({
        id: matchDisputas.id,
        matchId: matchDisputas.matchId,
        userId: matchDisputas.userId,
        motivo: matchDisputas.motivo,
        contestacaoUrl: matchDisputas.contestacaoUrl,
        status: matchDisputas.status,
        createdAt: matchDisputas.createdAt,
        nomeJogador: users.displayName,
        salaNum: matches.salaNum,
        mode: matches.mode,
        apostaMc: matches.apostaMc,
        winnerSide: matches.winnerSide,
        resultado: matches.resultado,
      })
      .from(matchDisputas)
      .innerJoin(users, eq(users.id, matchDisputas.userId))
      .innerJoin(matches, eq(matches.id, matchDisputas.matchId))
      .where(eq(matchDisputas.status, "aberta"))
      .orderBy(matchDisputas.createdAt);
    return res.json(rows);
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/revisao/disputas/:id/decidir — { procedente: boolean }
revisaoRouter.post("/disputas/:id/decidir", async (req, res) => {
  try {
    const r = await exigeRevisor(req, res);
    if (!r.user) return;
    const user = r.user;

    const [disputa] = await db.select().from(matchDisputas).where(eq(matchDisputas.id, req.params.id)).limit(1);
    if (!disputa) return res.status(404).json({ erro: "disputa_nao_encontrada" });
    if (disputa.status !== "aberta") return res.status(409).json({ erro: "disputa_ja_resolvida" });

    const procedente = req.body?.procedente === true;

    if (procedente) {
      const r2 = await db.transaction(async (tx: any) => {
        const [sala] = await tx.select().from(matches).where(eq(matches.id, disputa.matchId)).limit(1).for("update");
        if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
        // Sala já cancelada: a reversão total (escrow de volta, sala cancelada)
        // já foi aplicada pela decisão de cancelamento. Procedente aqui é no-op —
        // só fecha a disputa, sem tentar reverter de novo (estornaria saldo já
        // devolvido e devolveria 400 estado_invalido para sempre).
        if (sala.status === "cancelada") {
          await tx.update(matchDisputas).set({ status: "resolvida" }).where(eq(matchDisputas.id, disputa.id));
          return { ok: true, procedente: true };
        }
        if (sala.status !== "encerrada") return { ok: false, erro: "estado_invalido", estado: sala.status };
        const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
        const aposta = sala.apostaMc ?? 0;
        const taxa = Number(sala.taxaPct ?? 8.99);
        const winnerSide = sala.winnerSide;
        if (!winnerSide || (winnerSide !== "blue" && winnerSide !== "red")) {
          return { ok: false, erro: "sem_vencedor_pago" };
        }
        // Reversão total: todos voltam ao pré-aposta e a sala vira cancelada.
        const rv = await reverterPayout(tx, sala.id, aposta, players, winnerSide, taxa);
        // Saldo insuficiente precisa de ROLLBACK: em Drizzle/pg, RETURN de uma
        // transação COMMITA — e reverterPayout já escreveu os vencedores anteriores
        // antes de achar o sem saldo. THROW desfaz tudo e o 409 sai no catch.
        if (!rv.ok) {
          const err: any = new Error(rv.erro);
          err.userId = rv.userId;
          throw err;
        }
        await tx.update(matches).set({
          status: "cancelada", resultado: null, canceladoEm: new Date(),
          revisadoPor: user.id, revisadoEm: new Date(),
        }).where(eq(matches.id, sala.id));
        await tx.update(matchDisputas).set({ status: "resolvida" }).where(eq(matchDisputas.id, disputa.id));
        await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, sala.id));
        await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, sala.id));
        return { ok: true, procedente: true };
      });
      // Só notifica DEPOIS do commit: dentro da transação a notificação saía antes
      // do rollback (ex.: ledger 23505) — anunciava cancelamento de sala intacta.
      if (r2.ok) notifyMatchChange(disputa.matchId);
      if (!r2.ok) {
        const status = r2.erro === "disputa_ja_resolvida" ? 409 : r2.erro === "sala_nao_encontrada" ? 404 : r2.erro === "saldo_insuficiente" ? 409 : 400;
        const userId = "userId" in r2 ? r2.userId : undefined;
        return res.status(status).json({ erro: r2.erro, userId });
      }
      return res.json(r2);
    }

    // Improcedente: fecha a disputa, escrow intocado, sala continua encerrada.
    await db.update(matchDisputas).set({ status: "resolvida" }).where(eq(matchDisputas.id, disputa.id));
    return res.json({ ok: true, procedente: false });
  } catch (e: any) {
    // saldo_insuficiente: reverterPayout estourou no meio do loop — o throw
    // no callback já fez o rollback; aqui só devolve o 409 com quem travou.
    if (e?.message === "saldo_insuficiente") {
      return res.status(409).json({ erro: "saldo_insuficiente", userId: e?.userId });
    }
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});
