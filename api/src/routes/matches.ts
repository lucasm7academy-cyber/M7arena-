import { Router } from "express";
import { eq, and, gt, inArray, desc } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions } from "../../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";
import { toLegacyMatch } from "../lib/match-shape.js";
import {
  avaliarTransicoes,
  buscarSalaPorNumero,
  buscarSalaPorId,
  debitarEntrada,
  normalizarVaga,
  ESTADOS_ATIVOS,
  getAuthUser,
  notifyMatchChange,
} from "../lib/match-flow.js";
import { matchesActionsRouter } from "./matches-actions.js";

export const matchesRouter = Router();
// Ações de sala (confirm/leave/recusar/tick/start/finalizar/report-result) em
// rota própria para o arquivo não estourar ~400 linhas.
matchesRouter.use(matchesActionsRouter);

/** Resolve `:id` como sala_num (número) ou uuid. */
async function resolverSala(param: string, ctx: any = db) {
  if (/^[0-9]+$/.test(param)) return buscarSalaPorNumero(ctx, Number(param));
  return buscarSalaPorId(ctx, param);
}

/** Monta o shape legado de `salas` para uma linha de `matches` (com joins). */
async function shapeSala(m: any, ctx: any = db) {
  const players = await ctx.select().from(matchPlayers).where(eq(matchPlayers.matchId, m.id));
  const userIds = [...new Set([m.createdBy, ...players.map((p: any) => p.userId)])];
  const usersRows: any[] = userIds.length ? await ctx.select().from(users).where(inArray(users.id, userIds)) : [];
  const userMap = new Map<string, any>(usersRows.map((u: any) => [u.id, u] as [string, any]));
  const criador = userMap.get(m.createdBy);
  const criadorNome = criador?.displayName || criador?.email?.split("@")[0] || "Desconhecido";
  const playersEnriched = players.map((p: any) => ({
    ...p,
    __user: userMap.get(p.userId),
    __isVip: userMap.get(p.userId)?.isVip ?? false,
  }));
  return toLegacyMatch(m, playersEnriched, criadorNome);
}

// GET /api/matches - Lista salas em shape legado
matchesRouter.get("/", async (req, res) => {
  try {
    const statusParam = String(req.query.status || "ativas").trim();
    const limit = Math.min(Number(req.query.limit) || 100, 200);

    let rows: any[];
    if (statusParam && statusParam !== "ativas" && statusParam !== "todas") {
      rows = await db.select().from(matches).where(eq(matches.status, statusParam)).orderBy(desc(matches.createdAt)).limit(limit);
    } else if (statusParam === "todas") {
      rows = await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit);
    } else {
      rows = await db
        .select()
        .from(matches)
        .where(inArray(matches.status, ESTADOS_ATIVOS))
        .orderBy(desc(matches.createdAt))
        .limit(limit);
    }

    const results = await Promise.all(rows.map((m) => shapeSala(m)));
    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar salas" });
  }
});

// GET /api/matches/:id - Detalhe (shape legado de salas + jogadores)
matchesRouter.get("/:id", async (req, res) => {
  try {
    const match = await resolverSala(req.params.id);
    if (!match) return res.status(404).json({ error: "Partida não encontrada" });
    return res.json(await shapeSala(match));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar sala" });
  }
});

// POST /api/matches - Criar sala
matchesRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const { mode, entryMp, nome, descricao, temSenha, senha, eloMinimo, maxJogadores, timeANome, timeATag, timeALogo } = req.body;
    const roomCode = `M7-${Math.floor(1000 + Math.random() * 9000)}`;

    const nova = await db.transaction(async (tx: any) => {
      const [newMatch] = await tx
        .insert(matches)
        .values({
          gameId: "lol",
          mode: mode || "5v5",
          status: "preenchendo",
          createdBy: user.id,
          roomCode,
          entryMp: entryMp || 0,
          nome: nome || `Sala ${mode || "5v5"} de ${user.displayName || user.email?.split("@")[0]}`,
          descricao: descricao || "",
          maxJogadores: maxJogadores || 10,
          temSenha: !!temSenha,
          senha: temSenha ? senha ?? null : null,
          eloMinimo: eloMinimo || null,
          timeANome: timeANome || null,
          timeATag: timeATag || null,
          timeALogo: timeALogo || null,
        })
        .returning();

      // Débito do entryMp do criador na criação (regra de negócio no servidor).
      await debitarEntrada(tx, user.id, newMatch.entryMp, newMatch.id);

      // Criador entra como primeiro jogador (blue slot 0 / TOP).
      await tx.insert(matchPlayers).values({
        matchId: newMatch.id,
        userId: user.id,
        side: "blue",
        slot: 0,
        roleSlot: "TOP",
        confirmed: true,
      });

      return newMatch;
    });

    notifyMatchChange(nova.id);
    return res.status(201).json(await shapeSala(nova));
  } catch (error: any) {
    if (error?.code === "SALDO_INSUFICIENTE") {
      return res.status(400).json({ error: "saldo_insuficiente" });
    }
    return res.status(500).json({ error: error?.message || "Erro ao criar sala" });
  }
});

// POST /api/matches/:id/join - Entrar (ou trocar de vaga)
matchesRouter.post("/:id/join", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const { side, roleSlot } = req.body;
    const isTimeA = side ? side !== "red" : req.body.is_time_a !== false;
    const vaga = normalizarVaga(roleSlot, isTimeA);

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };

      const trans = await avaliarTransicoes(tx, match.id);
      if (match.status !== "preenchendo") return { ok: false, erro: "estado_invalido", estado: trans.estado, mudou: trans.mudou };

      const [existing] = await tx
        .select()
        .from(matchPlayers)
        .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id)))
        .limit(1);

      // Bloqueia quem está vinculado (em partida) em outra sala.
      const outrosVinculos = await tx
        .select({ matchId: matchPlayers.matchId })
        .from(matchPlayers)
        .where(and(eq(matchPlayers.userId, user.id), eq(matchPlayers.linked, true)));
      if (outrosVinculos.some((p: any) => p.matchId !== match.id)) {
        return { ok: false, erro: "ja_em_outra_sala", estado: match.status, mudou: false };
      }

      // Vaga (role + lado) ocupada por OUTRO jogador.
      const ocupada = await tx
        .select({ userId: matchPlayers.userId })
        .from(matchPlayers)
        .where(and(
          eq(matchPlayers.matchId, match.id),
          eq(matchPlayers.roleSlot, vaga.roleSlot),
          eq(matchPlayers.side, vaga.side)
        ));
      if (ocupada.some((p: any) => p.userId !== user.id)) {
        return { ok: false, erro: "vaga_ocupada", estado: match.status, mudou: false };
      }

      if (existing) {
        // Troca de vaga: UPDATE atômico (nunca DELETE + INSERT).
        await tx
          .update(matchPlayers)
          .set({ side: vaga.side, slot: vaga.slot, roleSlot: vaga.roleSlot, confirmed: false })
          .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id)));
      } else {
        const total = await tx.select({ id: matchPlayers.userId }).from(matchPlayers).where(eq(matchPlayers.matchId, match.id));
        if (total.length >= (match.maxJogadores ?? 10)) {
          return { ok: false, erro: "vaga_ocupada", estado: match.status, mudou: false };
        }
        // Solta vagas em outras salas ainda em preenchimento (mesma regra da
        // RPC legada sala_entrar: só salas em `preenchendo`, nunca as travadas).
        const outrasSalas = await tx
          .select({ matchId: matchPlayers.matchId })
          .from(matchPlayers)
          .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
          .where(and(
            eq(matchPlayers.userId, user.id),
            eq(matchPlayers.linked, false),
            eq(matches.status, "preenchendo")
          ));
        const idsOutras = outrasSalas
          .map((p: any) => p.matchId)
          .filter((mid: string) => mid !== match.id);
        if (idsOutras.length > 0) {
          await tx.delete(matchPlayers).where(and(eq(matchPlayers.userId, user.id), inArray(matchPlayers.matchId, idsOutras)));
        }

        try {
          await debitarEntrada(tx, user.id, match.entryMp, match.id);
        } catch (e: any) {
          if (e?.code === "SALDO_INSUFICIENTE") return { ok: false, erro: "saldo_insuficiente", estado: match.status, mudou: false };
          throw e;
        }

        await tx.insert(matchPlayers).values({
          matchId: match.id,
          userId: user.id,
          side: vaga.side,
          slot: vaga.slot,
          roleSlot: vaga.roleSlot,
          confirmed: false,
        });
      }

      const trans2 = await avaliarTransicoes(tx, match.id);
      return { ok: true, erro: null, estado: trans2.estado, mudou: trans2.mudou };
    });

    notifyMatchChange(String(req.params.id));
    return res.json(r);
  } catch (error: any) {
    return res.status(500).json({ ok: false, erro: error?.message || "rpc_falhou", estado: null, mudou: false });
  }
});

// ── POST /api/matches/:id/vote — registra voto num jogo (ex.: enquete do Lobby) ─
// Substitui a RPC votar_jogo. A tabela votos_jogos foi descartada no schema novo
// (DISCARDED.md) e o front mantém a contagem em localStorage; aqui apenas
// validamos auth + partida existente e devolvemos ok (contrato preservado).
matchesRouter.post("/:id/vote", async (req, res) => {
  try {
    const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Não autenticado" });
    const [session] = await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
      .limit(1);
    if (!session) return res.status(401).json({ error: "Não autenticado" });

    const { id } = req.params;
    const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
    if (!match) return res.status(404).json({ error: "Partida não encontrada" });

    // O voto em si (p_team_tag) é agregado no cliente (localStorage); aqui é no-op.
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao votar" });
  }
});
