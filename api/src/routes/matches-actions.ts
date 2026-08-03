import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { matches, matchPlayers, matchCodes } from "../../../db/schema/matches.js";
import { winnerLegacyToSide } from "../lib/match-shape.js";
import {
  avaliarTransicoes,
  reembolsarSeNecessario,
  entrarEmRevisao,
  getAuthUser,
  notifyMatchChange,
} from "../lib/match-flow.js";

export const matchesActionsRouter = Router();

/**
 * Ações de sala montadas em `/api/matches/:id/<acao>` (id público = sala_num).
 * Contrato de retorno comum `{ ok, erro, estado, mudou }` — o front traduz os
 * códigos de erro em ERROS_SALA. Regra de negócio (transição, débito, payout)
 * roda sempre dentro de transação com lock de linha em `matches`.
 */

// POST /api/matches/:id/leave - Sair da vaga (só antes de confirmar/vincular)
matchesActionsRouter.post("/:id/leave", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };

      const trans = await avaliarTransicoes(tx, match.id);
      if (match.status !== "preenchendo") return { ok: false, erro: "estado_invalido", estado: trans.estado, mudou: trans.mudou };

      const [jogador] = await tx
        .select()
        .from(matchPlayers)
        .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id)))
        .limit(1);
      if (!jogador) return { ok: false, erro: "nao_esta_na_sala", estado: match.status, mudou: false };
      if (jogador.confirmed || jogador.linked) return { ok: false, erro: "nao_pode_sair", estado: match.status, mudou: false };

      await reembolsarSeNecessario(tx, user.id, match.apostaMc ?? match.entryMp ?? 0, match.id);
      await tx.delete(matchPlayers).where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id)));

      const trans2 = await avaliarTransicoes(tx, match.id);
      return { ok: true, erro: null, estado: trans2.estado, mudou: trans2.mudou };
    });

    notifyMatchChange(String(req.params.id));
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/confirm - Confirmar presença
matchesActionsRouter.post("/:id/confirm", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      if (match.status !== "confirmacao") return { ok: false, erro: "estado_invalido", estado: match.status, mudou: false };

      const [jogador] = await tx
        .select()
        .from(matchPlayers)
        .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id)))
        .limit(1);
      if (!jogador) return { ok: false, erro: "nao_esta_na_sala", estado: match.status, mudou: false };

      if (!jogador.confirmed) {
        await tx
          .update(matchPlayers)
          .set({ confirmed: true })
          .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id)));
      }

      const trans = await avaliarTransicoes(tx, match.id);
      return { ok: true, erro: null, estado: trans.estado, mudou: trans.mudou };
    });

    notifyMatchChange(String(req.params.id));
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/recusar - Recusar na confirmação (sai e reabre a sala)
matchesActionsRouter.post("/:id/recusar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      if (match.status !== "confirmacao") return { ok: false, erro: "estado_invalido", estado: match.status, mudou: false };

      const [jogador] = await tx
        .select()
        .from(matchPlayers)
        .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id)))
        .limit(1);
      if (!jogador) return { ok: false, erro: "nao_esta_na_sala", estado: match.status, mudou: false };
      if (jogador.linked) return { ok: false, erro: "nao_pode_sair", estado: match.status, mudou: false };

      await reembolsarSeNecessario(tx, user.id, match.apostaMc ?? match.entryMp ?? 0, match.id);
      await tx.delete(matchPlayers).where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id)));

      await tx.update(matchPlayers).set({ confirmed: false }).where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.confirmed, true)));
      await tx.update(matches).set({
        status: "preenchendo",
        confirmacaoExpiresAt: null,
        iniciandoPartidaAt: null,
        stateDeadlineAt: null,
      }).where(eq(matches.id, match.id));

      const trans = await avaliarTransicoes(tx, match.id);
      return { ok: true, erro: null, estado: trans.estado, mudou: trans.mudou };
    });

    notifyMatchChange(String(req.params.id));
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/tick - Reavalia prazos (idempotente, tick preguiçoso)
matchesActionsRouter.post("/:id/tick", async (req, res) => {
  try {
    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      const trans = await avaliarTransicoes(tx, match.id);
      return { ok: true, erro: null, estado: trans.estado, mudou: trans.mudou };
    });
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/finalizar - Solicita finalização (vai para votação)
matchesActionsRouter.post("/:id/finalizar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      if (!["partida_iniciada", "iniciando_partida", "finalizacao"].includes(match.status)) {
        return { ok: false, erro: "estado_invalido", estado: match.status, mudou: false };
      }
      await tx.update(matches).set({ status: "finalizacao", stateDeadlineAt: null }).where(eq(matches.id, match.id));
      return { ok: true, erro: null, estado: "finalizacao", mudou: true };
    });

    notifyMatchChange(String(req.params.id));
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/report-result - Encerra e paga o prêmio
matchesActionsRouter.post("/:id/report-result", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const side = winnerLegacyToSide(req.body?.winnerSide);

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      if (!["finalizacao", "partida_iniciada", "iniciando_partida"].includes(match.status)) {
        return { ok: false, erro: "estado_invalido", estado: match.status, mudou: false };
      }

      // Salas apostadas (aposta > 0): não pagam direto — vão para revisão do
      // admin (design v3 §6). O print do vencedor é enviado pelo app e o admin
      // decide aprovar/empatar/cancelar na rota /api/revisao.
      if ((match.apostaMc ?? 0) > 0) {
        const rv = await entrarEmRevisao(tx, match.id);
        if (!rv.ok) return { ok: false, erro: rv.erro, estado: match.status, mudou: false };
        await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, match.id));
        await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, match.id));
        return { ok: true, erro: null, estado: "aguardando_revisao", mudou: true };
      }

      // Salas casuais (aposta 0): encerram no fluxo normal (resultado simples).
      await tx.update(matches).set({
        status: "encerrada",
        winnerSide: side,
        endedAt: new Date(),
        stateDeadlineAt: null,
      }).where(eq(matches.id, match.id));

      await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, match.id));
      await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, match.id));

      return { ok: true, erro: null, estado: "encerrada", mudou: true };
    });

    notifyMatchChange(String(req.params.id));
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});
