import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { matches, matchPlayers, matchCodes, campeonatoSalaEstado, matchDrafts } from "../../../db/schema/matches.js";
import {
  avaliarTransicoes,
  reembolsarSeNecessario,
  entrarEmRevisao,
  getAuthUser,
  notifyMatchChange,
} from "../lib/match-flow.js";
import { aplicarAcaoDraft } from "../lib/draft/index.js";
import { verificarPartida } from "../lib/verificar-partida.js";
import { getRoles, eStaffSala } from "../lib/acesso-sala.js";
import { entrarNaVaga, sairDaVaga, marcarPronto, escolherLado, escolherPickOrder, iniciarLiveDaSala, criarSalaTimeVsTime } from "../lib/sala-campeonato.js";
import { garantirDraftSalaCampeonato, avaliarDraftSalaCampeonato, aplicarAcaoSalaCampeonato } from "../lib/sala-campeonato-draft.js";

export const matchesActionsRouter = Router();

/**
 * Ações do DRAFT (ban/pick). O servidor é a única autoridade: valida o turno
 * pelo `turn_deadline_at` (relógio do servidor), aplica e avança. O contrato é
 * o mesmo das demais ações de sala `{ ok, erro, estado, mudou }` — o front
 * traduz os códigos em ERROS_SALA.
 *
 * Fluxo da transação:
 *   1. lock da linha em `matches` (serializa ticks/ações concorrentes);
 *   2. `avaliarTransicoes` sanea prazos vencidos ANTES da ação (um ban vencido
 *      vira ban vazio; um pick vencido cancela o draft — a ação chega tarde e
 *      recebe estado_invalido);
 *   3. `aplicarAcaoDraft` valida e aplica o ban/pick;
 *   4. `avaliarTransicoes` de novo: se o draft fechou, atribui o código e leva
 *      a sala para `iniciando_partida` na MESMA transação.
 */
async function executarAcaoDraft(req: any, res: any, tipo: "ban" | "pick") {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx
        .select()
        .from(matches)
        .where(eq(matches.salaNum, Number(req.params.id)))
        .limit(1)
        .for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };

      const trans = await avaliarTransicoes(tx, match.id);
      if (trans.estado !== "draft") {
        return { ok: false, erro: "estado_invalido", estado: trans.estado, mudou: trans.mudou };
      }

      const acao = await aplicarAcaoDraft(tx, match, user.id, tipo, req.body?.championId);
      if (!acao.ok) return { ok: false, erro: acao.erro, estado: acao.estado, mudou: acao.mudou };

      const trans2 = await avaliarTransicoes(tx, match.id);
      return { ok: true, erro: null, estado: trans2.estado, mudou: true };
    });

    notifyMatchChange(String(req.params.id));
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
}

// POST /api/matches/:id/draft/ban - Banir campeão (turno do time no ban)
matchesActionsRouter.post("/:id/draft/ban", (req, res) => executarAcaoDraft(req, res, "ban"));

// POST /api/matches/:id/draft/pick - Escolher campeão (turno do time no pick)
matchesActionsRouter.post("/:id/draft/pick", (req, res) => executarAcaoDraft(req, res, "pick"));

/**
 * Sala Campeonato (ADR-085): vaga e PRONTO. Sem timer (ADR-083) — o servidor
 * decide as transições de fase; o front só desenha. Contrato `{ ok, erro, estado, mudou }`.
 */
function responderSalaCampeonato(res: any, r: any) {
  return res.json({
    ok: !!r?.ok,
    erro: r?.ok ? null : r?.erro ?? "rpc_falhou",
    estado: r?.estado ?? null,
    mudou: !!r?.ok,
  });
}

// POST /api/matches/:id/sala-campeonato/entrar  { side: 'blue' | 'red' }
matchesActionsRouter.post("/:id/sala-campeonato/entrar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });
    const side = req.body?.side === "red" ? "red" : req.body?.side === "blue" ? "blue" : null;
    if (!side) return res.status(400).json({ ok: false, erro: "lado_invalido", estado: null, mudou: false });
    const r = await entrarNaVaga(db, { salaNum: Number(req.params.id), userId: user.id, side });
    return responderSalaCampeonato(res, r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/sala-campeonato/sair
matchesActionsRouter.post("/:id/sala-campeonato/sair", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });
    const r = await sairDaVaga(db, { salaNum: Number(req.params.id), userId: user.id });
    return responderSalaCampeonato(res, r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/sala-campeonato/pronto
matchesActionsRouter.post("/:id/sala-campeonato/pronto", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });
    const r = await marcarPronto(db, { salaNum: Number(req.params.id), userId: user.id });
    return responderSalaCampeonato(res, r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/sala-campeonato/lado  { lado: 'blue' | 'red' }
matchesActionsRouter.post("/:id/sala-campeonato/lado", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });
    const lado = req.body?.lado === "red" ? "red" : req.body?.lado === "blue" ? "blue" : null;
    if (!lado) return res.status(400).json({ ok: false, erro: "lado_invalido", estado: null, mudou: false });
    const r = await escolherLado(db, { salaNum: Number(req.params.id), userId: user.id, lado });
    return responderSalaCampeonato(res, r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/sala-campeonato/pick-order  { ordem: 'first' | 'last' }
matchesActionsRouter.post("/:id/sala-campeonato/pick-order", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });
    const ordem = req.body?.ordem === "last" ? "last" : req.body?.ordem === "first" ? "first" : null;
    if (!ordem) return res.status(400).json({ ok: false, erro: "ordem_invalida", estado: null, mudou: false });
    const r = await escolherPickOrder(db, { salaNum: Number(req.params.id), userId: user.id, ordem });
    return responderSalaCampeonato(res, r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

/**
 * Passo 5 — Draft da sala campeonato: ban/pick com a vez pelo LADO do time e
 * FEARLESS (picks de jogos anteriores travados). Fluxo da transação: lock da
 * sala → garante o draft do jogo → sanidade do draft (bookkeeping) → aplica a ação.
 * Pick vencido CONTINUA valendo (o draft trava em vez de cancelar — ADR-083).
 */
async function executarAcaoDraftCampeonato(req: any, res: any, tipo: "ban" | "pick") {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const r = await db.transaction(async (tx: any) => {
      const [sala] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!sala) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      if (sala.mode !== "campeonato" && sala.mode !== "time_vs_time_livre") {
        return { ok: false, erro: "nao_e_sala_campeonato", estado: null, mudou: false };
      }
      if (sala.status !== "camp_draft") return { ok: false, erro: "estado_invalido", estado: sala.status, mudou: false };

      const [estado] = await tx
        .select()
        .from(campeonatoSalaEstado)
        .where(eq(campeonatoSalaEstado.matchId, sala.id))
        .limit(1);
      if (!estado) return { ok: false, erro: "estado_ausente", estado: sala.status, mudou: false };

      await garantirDraftSalaCampeonato(tx, sala, estado);
      await avaliarDraftSalaCampeonato(tx, sala);

      const acao = await aplicarAcaoSalaCampeonato(tx, sala, user.id, tipo, req.body?.championId);
      if (!acao.ok) return { ok: false, erro: acao.erro, estado: "camp_draft", mudou: false };
      return { ok: true, erro: null, estado: acao.finalizado ? "camp_jogo" : "camp_draft", mudou: true };
    });

    notifyMatchChange(String(req.params.id));
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
}

matchesActionsRouter.post("/:id/sala-campeonato/ban", (req, res) => executarAcaoDraftCampeonato(req, res, "ban"));
matchesActionsRouter.post("/:id/sala-campeonato/pick", (req, res) => executarAcaoDraftCampeonato(req, res, "pick"));

/**
 * POST /api/matches/:id/sala-campeonato/resetar — **TEMPORÁRIO** (admin/
 * proprietário): volta a sala de times para o PRONTO do MESMO jogo — prontos
 * zerados, escolhas (sorteio/lado/pick/primeira) limpas e o draft do jogo atual
 * apagado. Existe para o usuário corrigir a sala enquanto o fluxo novo está em
 * ajuste; remover quando os fluxos estiverem 100% (pedido 13/10).
 */
matchesActionsRouter.post("/:id/sala-campeonato/resetar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });
    const roles = await getRoles(db, user.id);
    if (!roles.includes("admin") && !roles.includes("proprietario")) {
      return res.status(403).json({ ok: false, erro: "sem_permissao", estado: null, mudou: false });
    }

    const r: any = await db.transaction(async (tx: any) => {
      const [sala] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!sala) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      if (sala.mode !== "campeonato" && sala.mode !== "time_vs_time_livre") {
        return { ok: false, erro: "nao_e_sala_campeonato", estado: null, mudou: false };
      }
      const [estado] = await tx
        .select()
        .from(campeonatoSalaEstado)
        .where(eq(campeonatoSalaEstado.matchId, sala.id))
        .limit(1);
      if (!estado) return { ok: false, erro: "estado_ausente", estado: null, mudou: false };

      await tx
        .update(campeonatoSalaEstado)
        .set({
          prontoBlue: false,
          prontoRed: false,
          sorteioVencedor: null,
          escolhaTime: null,
          ladoEscolhido: null,
          pickOrderEscolhido: null,
          primeiraEscolha: null,
          updatedAt: new Date(),
        })
        .where(eq(campeonatoSalaEstado.matchId, sala.id));
      await tx.delete(matchDrafts).where(and(eq(matchDrafts.matchId, sala.id), eq(matchDrafts.jogo, estado.jogo)));
      await tx.update(matches).set({ status: "camp_prontos", updatedAt: new Date() }).where(eq(matches.id, sala.id));
      return { ok: true, erro: null, estado: "camp_prontos", mudou: true, jogo: estado.jogo };
    });

    if (r?.ok) await notifyMatchChange(String(req.params.id));
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/:id/sala-campeonato/live — botão "Iniciar live" (só streamer)
matchesActionsRouter.post("/:id/sala-campeonato/live", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });
    const r = await iniciarLiveDaSala(db, { salaNum: Number(req.params.id), userId: user.id });
    if (!r.ok) return res.status(400).json({ ok: false, erro: r.erro, estado: null, mudou: false });
    await notifyMatchChange(String(req.params.id));
    return res.json({
      ok: true,
      erro: null,
      estado: "live",
      mudou: true,
      twitch: r.twitch,
      transmissao_id: r.transmissao.id,
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// POST /api/matches/time-vs-time — cria a sala TIME vs TIME LIVRE (ADR-086): o
// mesmo fluxo da sala de campeonato, sem campeonato — 2 vagas, PRONTO, lado e
// draft; no fim o código sai do pool e a sala segue o ciclo normal.
matchesActionsRouter.post("/time-vs-time", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });
    const r = await criarSalaTimeVsTime(db, { userId: user.id, formato: req.body?.formato });
    if (!r.ok) return res.status(400).json({ ok: false, erro: r.erro, estado: null, mudou: false });
    return res.json({
      ok: true,
      erro: null,
      estado: r.sala.status,
      mudou: true,
      sala_num: r.sala.salaNum,
      sala_id: r.sala.id,
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

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
    // Quando o tick avança algo (turno do draft vencido, timeout de confirmação),
    // avisa TODOS os clientes da sala — não só quem chamou o tick. Sem isso, um
    // ban vazio aplicado pelo tick de um cliente chegava nos demais só pelo
    // polling de 5s.
    if (r.mudou) notifyMatchChange(String(req.params.id));
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

    // Staff (streamer/organizador/admin/proprietário) também pode disparar a
    // verificação para auditar a partida, mesmo sem estar na vaga (pedido
    // 2026-08-17). O cargo vem de user_roles; resolve antes do lock para não
    // segurar a linha durante a query extra.
    const staff = eStaffSala(await getRoles(db, user.id));

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      if (match.status !== "partida_iniciada") return { ok: false, erro: "estado_invalido", estado: match.status, mudou: false };
      // Participante CONFIRMADO é o único caso permitido: quem confirmou a vaga
      // (ou a preencheu sem etapa de confirmação) pode disparar o acelerador.
      // Um pendente (unconfirmed) também é negado com nao_participante — a não
      // ser que seja staff, que audita mesmo fora da vaga.
      const [player] = await tx
        .select()
        .from(matchPlayers)
        .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id), eq(matchPlayers.confirmed, true)))
        .limit(1);
      if (!player && !staff) return { ok: false, erro: "nao_participante", estado: match.status, mudou: false };
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
