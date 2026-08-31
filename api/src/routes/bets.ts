import { Router } from "express";
import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "../db.js";
import { userWallets } from "../../../db/schema/identidade.js";
import { betTickets, betLegs } from "../../../db/schema/bets.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";
import { walletTransactions } from "../../../db/schema/economia.js";
import { getAuthUser } from "../lib/match-flow.js";
import { validarElegibilidade } from "../lib/elegibilidade.js";
import {
  getMarketsByGroup,
  validarBilhete,
  reservarStake,
  devolverStake,
  shapeTicket,
  BET_LOCK_MS,
  BET_MIN_STAKE,
} from "../lib/bets.js";
import { detectarPartida, jogadorEmJogo } from "../lib/live-bets.js";

export const betsRouter = Router();

// GET /api/bets/catalog - Catálogo de mercados agrupados (com odd vigente) +
// limites. O front monta os botões de aposta a partir daqui — a odd exibida é a
// da config; ao apostar, o snapshot é gravado no bilhete.
betsRouter.get("/catalog", async (_req, res) => {
  try {
    return res.json({
      markets: getMarketsByGroup(),
      minStake: BET_MIN_STAKE,
      // Teto de payout por bilhete (risco da casa).
      maxPayout: 5000,
      lockMinutes: Math.floor(BET_LOCK_MS / 60000),
      queues: [
        { id: "solo", label: "Solo Duo", queueId: 420 },
        { id: "flex", label: "Flex", queueId: 440 },
      ],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao carregar catálogo" });
  }
});

// GET /api/bets/me - Bilhetes do usuário autenticado (mais recentes primeiro).
betsRouter.get("/me", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const tickets = await db.select().from(betTickets).where(eq(betTickets.userId, user.id)).orderBy(betTickets.createdAt);
    const result = [];
    for (const t of tickets) {
      const ticketLegs = await db.select().from(betLegs).where(eq(betLegs.ticketId, t.id));
      result.push(shapeTicket(t, ticketLegs));
    }
    return res.json(result.reverse());
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao listar bilhetes" });
  }
});

// GET /api/bets/me/active - Bilhete ativo (aguardando/em_jogo) do usuário, ou
// null. Usado para mostrar o status da aposta no painel sem listar tudo.
betsRouter.get("/me/active", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const [t] = await db
      .select()
      .from(betTickets)
      .where(and(eq(betTickets.userId, user.id), eq(betTickets.status, "aguardando")))
      .limit(1);
    if (!t) return res.json(null);

    const [emJogo] = await db
      .select()
      .from(betTickets)
      .where(and(eq(betTickets.userId, user.id), eq(betTickets.status, "em_jogo")))
      .limit(1);
    const ativo = emJogo || t;
    const legs = await db.select().from(betLegs).where(eq(betLegs.ticketId, ativo.id));
    return res.json(shapeTicket(ativo, legs));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar bilhete ativo" });
  }
});

// GET /api/bets/:id - Detalhe do bilhete (dono vê; anônimo/não-dono não).
betsRouter.get("/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const [t] = await db.select().from(betTickets).where(eq(betTickets.id, req.params.id)).limit(1);
    if (!t) return res.status(404).json({ error: "bilhete_nao_encontrado" });
    if (t.userId !== user.id) return res.status(403).json({ error: "nao_autorizado" });

    const legs = await db.select().from(betLegs).where(eq(betLegs.ticketId, t.id));
    return res.json(shapeTicket(t, legs));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar bilhete" });
  }
});

// POST /api/bets - Cria o bilhete. Valida elegibilidade + mercado + stake, e
// reserva o MC no escrow (mc -> mc_reservado) dentro da mesma transação.
betsRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const { queue, legs: legsBody } = req.body ?? {};
    if (queue !== "solo" && queue !== "flex") return res.status(400).json({ error: "fila_invalida" });

    // Segurança: elegibilidade re-checada aqui (fonte da verdade = servidor).
    const eleg = await validarElegibilidade(db as any, user.id, 0);
    if (!eleg.ok) {
      return res.status(400).json({ error: eleg.erro, ...(eleg.extra ?? {}) });
    }

    const valid = validarBilhete(legsBody);
    if (!valid.ok) return res.status(400).json({ error: valid.erro });

    // [anti-fraude] Aposta é sobre a PRÓXIMA partida. Se o jogador JÁ está em
    // uma partida rolando, rejeita — só pode apostar estando fora de jogo.
    // Sem chave Riot (riotRaw null), não bloqueia; o fallback de timeout da
    // detecção é a rede de segurança.
    const emJogo = await jogadorEmJogo(db as any, user.id);
    if (emJogo) {
      const queueEsperada = queue === "flex" ? 440 : 420;
      // Já está em jogo NA MESMA fila ranqueada → rejeita com "precisa apostar
      // ANTES de entrar na fila". Em outra fila (ex.: normal) permite esperar.
      if (Number(emJogo.gameQueueConfigId) === queueEsperada) {
        return res.status(400).json({ error: "ja_em_jogo_ranqueada" });
      }
    }

    const r = await db.transaction(async (tx: any) => {
      // Um bilhete AGUARDANDO por usuário: evita apostar 2x na mesma janela.
      const [jaAguardando] = await tx
        .select({ id: betTickets.id })
        .from(betTickets)
        .where(and(eq(betTickets.userId, user.id), eq(betTickets.status, "aguardando")))
        .limit(1)
        .for("update");
      if (jaAguardando) return { ok: false as const, erro: "ja_tem_bilhete_aguardando" };

      // Saldo total necessário.
      const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, user.id)).limit(1).for("update");
      const saldo = w?.mc ?? 0;
      if (saldo < valid.stakeTotal) {
        return { ok: false as const, erro: "saldo_insuficiente", faltam: valid.stakeTotal - saldo };
      }

      const expiresAt = new Date(Date.now() + BET_LOCK_MS);
      const [ticket] = await tx
        .insert(betTickets)
        .values({ userId: user.id, queue, status: "aguardando", stakeTotal: valid.stakeTotal, expiresAt })
        .returning();

      for (const leg of valid.legs) {
        await tx.insert(betLegs).values({
          ticketId: ticket.id,
          marketKey: leg.marketKey,
          odd: String(leg.odd),
          stake: leg.stake,
          payout: leg.payout,
        });
        // Reserva o stake de cada leg (mc -> mc_reservado).
        await reservarStake(tx, user.id, leg.stake, ticket.id);
      }

      return { ok: true as const, ticket };
    });

    if (!r.ok) {
      if (r.erro === "saldo_insuficiente") return res.status(400).json({ error: r.erro, faltam: r.faltam });
      return res.status(400).json({ error: r.erro });
    }

    const legs = await db.select().from(betLegs).where(eq(betLegs.ticketId, r.ticket.id));
    return res.status(201).json(shapeTicket(r.ticket, legs));
  } catch (error: any) {
    if (error?.code === "SALDO_INSUFICIENTE") {
      return res.status(400).json({ error: "saldo_insuficiente" });
    }
    return res.status(500).json({ error: error?.message || "Erro ao criar bilhete" });
  }
});

// POST /api/bets/:id/sync - Força a checagem de detecção (ex.: o jogador clicou
// "já terminei de jogar"). No-op se não está mais aguardando. Reusa o motor da
// detecção com FOR UPDATE.
betsRouter.post("/:id/sync", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const [t] = await db.select().from(betTickets).where(eq(betTickets.id, req.params.id)).limit(1);
    if (!t) return res.status(404).json({ error: "bilhete_nao_encontrado" });
    if (t.userId !== user.id) return res.status(403).json({ error: "nao_autorizado" });
    if (t.status !== "aguardando") return res.json({ ok: true, status: t.status });

    const r = await detectarPartida(db, t.id);
    const syncLegs = await db.select().from(betLegs).where(eq(betLegs.ticketId, t.id));
    return res.json({ ok: true, status: r.estado, ticket: shapeTicket(t, syncLegs) });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao sincronizar bilhete" });
  }
});

// DELETE /api/bets/:id - Cancela manualmente um bilhete AINDA aguardando
// (o jogador desiste antes de entrar em jogo). Devolve o MC. Bilhete em
// `em_jogo` não pode ser cancelado (a partida começou, o MC está comprometido).
betsRouter.delete("/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const r = await db.transaction(async (tx: any) => {
      const [t] = await tx.select().from(betTickets).where(eq(betTickets.id, req.params.id)).limit(1).for("update");
      if (!t) return { ok: false as const, erro: "bilhete_nao_encontrado", status: 404 };
      if (t.userId !== user.id) return { ok: false as const, erro: "nao_autorizado", status: 403 };
      if (t.status !== "aguardando") return { ok: false as const, erro: "nao_pode_cancelar", status: 400 };

      const legs = await tx.select().from(betLegs).where(eq(betLegs.ticketId, t.id));
      for (const leg of legs) {
        await tx.update(betLegs).set({ status: "anulada" }).where(eq(betLegs.id, leg.id));
        await devolverStake(tx, user.id, leg.stake, t.id);
      }
      await tx
        .update(betTickets)
        .set({ status: "cancelada", resultado: "anulada", endedAt: new Date(), updatedAt: new Date() })
        .where(eq(betTickets.id, t.id));
      return { ok: true as const, status: 200 };
    });

    if (!r.ok) return res.status(r.status).json({ error: r.erro });
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao cancelar bilhete" });
  }
});

// GET /api/bets/history - Histórico unificado de movimentação de MC em apostas
// do jogador: apostas individuais (self-bet) + salas apostadas/modo desafio.
// Cada item expõe o resultado (ganhou/perdeu/anulada e o delta de MC real do
// ledger), para o jogador saber exatamente quanto ganhou ou perdeu.
betsRouter.get("/history", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    // ── Apostas individuais (bet_tickets + bet_legs) ──
    const tickets = await db.select().from(betTickets).where(eq(betTickets.userId, user.id));
    const individuais = [];
    for (const t of tickets) {
      const legs = await db.select().from(betLegs).where(eq(betLegs.ticketId, t.id));
      const ganho = legs.reduce((a, l) => a + (l.status === "ganha" ? (l.payout ?? 0) : 0), 0);
      const stake = legs.reduce((a, l) => a + (l.status === "anulada" ? 0 : l.stake), 0);
      // Anulada/cancelada = devolve o stake (delta 0). Ganha = payout. Perdida = -stake.
      let delta = 0;
      if (t.status === "finalizada") {
        delta = t.resultado === "ganha" ? ganho : t.resultado === "perdida" ? -stake : 0;
      }
      individuais.push({
        tipo: "aposta_individual",
        id: t.id,
        fila: t.queue,
        status: t.status,
        resultado: t.resultado ?? null,
        stakeTotal: t.stakeTotal ?? 0,
        legs: legs.map((l) => ({ marketKey: l.marketKey, label: l.marketKey, odd: String(l.odd), stake: l.stake, payout: l.payout ?? 0, status: l.status })),
        deltaMc: delta,
        criadoEm: t.createdAt instanceof Date ? t.createdAt.toISOString() : new Date(t.createdAt).toISOString(),
        encerradoEm: t.endedAt ? (t.endedAt instanceof Date ? t.endedAt.toISOString() : new Date(t.endedAt).toISOString()) : null,
      });
    }

    // ── Salas apostadas (matches com apostaMc > 0 onde o jogador jogou) ──
    // O delta real vem do ledger (match_prize +, match_loss -, match_entry_refund +),
    // agregado por refId (uuid do match). Assim o histórico é exato ao que o
    // banco registrou, sem duplicar a lógica de payout no cliente.
    const salasApostadas = await db
      .select({
        matchId: matchPlayers.matchId,
        salaNum: matches.salaNum,
        nome: matches.nome,
        mode: matches.mode,
        apostaMc: matches.apostaMc,
        status: matches.status,
        winnerSide: matches.winnerSide,
        resultado: matches.resultado,
        createdAt: matches.createdAt,
        endedAt: matches.endedAt,
      })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .where(and(eq(matchPlayers.userId, user.id), gt(matches.apostaMc, 0)))
      .orderBy(desc(matches.createdAt));

    // Busca o delta por match no ledger (kinds relevantes para o jogador).
    const salas = [];
    for (const s of salasApostadas) {
      const txs = await db
        .select()
        .from(walletTransactions)
        .where(and(eq(walletTransactions.refType, "match"), eq(walletTransactions.refId, s.matchId), eq(walletTransactions.userId, user.id)));
      const delta = txs.reduce((a, t) => a + (t.amount ?? 0), 0);
      salas.push({
        tipo: "sala_apostada",
        id: s.matchId,
        salaNum: s.salaNum,
        nome: s.nome,
        modo: s.mode,
        status: s.status,
        resultado: s.resultado ?? s.winnerSide ?? null,
        apostaMc: s.apostaMc ?? 0,
        deltaMc: delta,
        criadoEm: s.createdAt instanceof Date ? s.createdAt.toISOString() : new Date(s.createdAt).toISOString(),
        encerradoEm: s.endedAt ? (s.endedAt instanceof Date ? s.endedAt.toISOString() : new Date(s.endedAt).toISOString()) : null,
      });
    }

    // Ordena por data (mais recente primeiro) e devolve.
    const tudo = [...individuais, ...salas].sort((a: any, b: any) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
    return res.json(tudo);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao carregar histórico" });
  }
});
