import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { matches, matchPlayers, matchCodes } from "../../../db/schema/matches.js";
import {
  avaliarTransicoes,
  reembolsarSeNecessario,
  entrarEmRevisao,
  getAuthUser,
  notifyMatchChange,
} from "../lib/match-flow.js";
import { verificarPartida } from "../lib/verificar-partida.js";

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

// LEGADO — POST /api/matches/:id/report-result. O front não chama mais esta
// rota: desde a verificação automática via Riot (tasks 3-10), o resultado é
// decidido no servidor pelo motor de verificação. Mantida apenas para não
// quebrar salas antigas que já estavam em voo no fluxo de print/revisão.
matchesActionsRouter.post("/:id/report-result", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      if (!["partida_iniciada", "iniciando_partida"].includes(match.status)) {
        return { ok: false, erro: "estado_invalido", estado: match.status, mudou: false };
      }

      // Decisão de 2026-08-03: TODAS as salas passam pela revisão do admin —
      // casuais e apostadas. A votação red/blue no cliente foi removida; o
      // resultado é decidido por print + aprovação no painel. `pagarPremio` é
      // no-op para aposta 0, então a decisão de uma casual só marca o resultado.
      const rv = await entrarEmRevisao(tx, match.id);
      if (!rv.ok) return { ok: false, erro: rv.erro, estado: match.status, mudou: false };
      await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, match.id));
      await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, match.id));
      return { ok: true, erro: null, estado: "aguardando_revisao", mudou: true };
    });

    notifyMatchChange(String(req.params.id));
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/verificar — Acelerador do polling (spec
// verificacao-partida-riot): qualquer participante confirmado dispara a mesma
// verificação na hora. Achou + nicks batem → finaliza e paga; não achou →
// segue no polling (3h). Idempotente para salas já encerradas/canceladas.
matchesActionsRouter.post("/:id/verificar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      if (match.status !== "partida_iniciada") return { ok: false, erro: "estado_invalido", estado: match.status, mudou: false };
      // Participante CONFIRMADO é o único caso permitido: quem confirmou a vaga
      // (ou a preencheu sem etapa de confirmação) pode disparar o acelerador.
      // Um pendente (unconfirmed) também é negado com nao_participante.
      const [player] = await tx
        .select()
        .from(matchPlayers)
        .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id), eq(matchPlayers.confirmed, true)))
        .limit(1);
      if (!player) return { ok: false, erro: "nao_participante", estado: match.status, mudou: false };
      return { ok: true, matchId: match.id };
    });
    if (!r.ok) {
      const status =
        r.erro === "sala_nao_encontrada" ? 404 : r.erro === "estado_invalido" ? 409 : r.erro === "nao_participante" ? 403 : 400;
      return res.status(status).json(r);
    }

    // Verificação fora da transação (rede): o motor aplica a própria transação
    // com lock no momento de decidir — não seguramos lock durante a Riot.
    const vr = await verificarPartida(db, r.matchId);
    // O cron pode ter resolvido a sala entre a checagem da rota (status
    // partida_iniciada) e a fase B do motor — nesse caso o motor responde
    // ok:false com estado "encerrada"/"cancelada", e o front precisa ver
    // sucesso (SalaMod1 mostra "Time venceu" para estado encerrada).
    if (vr.estado === "encerrada" || vr.estado === "cancelada") {
      notifyMatchChange(String(req.params.id));
      let vencedor: "A" | "B" | null = null;
      if (vr.estado === "encerrada") {
        const winnerSide = vr.ok ? vr.winnerSide : (await db.select().from(matches).where(eq(matches.id, r.matchId)).limit(1))[0]?.winnerSide;
        vencedor = winnerSide === "blue" ? "A" : "B";
      }
      return res.json({ ok: true, estado: vr.estado, vencedor, matchIdRiot: vr.ok ? vr.matchIdRiot ?? null : null });
    }
    return res.json({ ok: false, estado: vr.estado, motivo: vr.motivo, matchIdRiot: vr.matchIdRiot ?? null });
  } catch (e: any) {
    return res.status(500).json({ ok: false, erro: e?.message || "rpc_falhou", estado: null, mudou: false });
  }
});
