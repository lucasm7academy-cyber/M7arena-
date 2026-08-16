import { Router } from "express";
import { timingSafeEqual } from "crypto";
import { eq, and, gt, lt, asc, inArray, desc } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userWallets, userRoles } from "../../../db/schema/identidade.js";
import { matches, matchPlayers, matchResults, matchCodes, salaMensagens } from "../../../db/schema/matches.js";
import { gameAccounts } from "../../../db/schema/games.js";
import { matchPrints, matchDisputas, userAdvertencias } from "../../../db/schema/apostas.js";
import { platformRevenue } from "../../../db/schema/economia.js";
import { toLegacyMatch, resumoRiot } from "../lib/match-shape.js";
import {
  avaliarTransicoes,
  buscarSalaPorNumero,
  buscarSalaPorId,
  normalizarVaga,
  ESTADOS_ATIVOS,
  ESTADOS_BLOQUEIO_NOVA_APOSTA,
  getAuthUser,
  notifyMatchChange,
  validarElegibilidade,
} from "../lib/match-flow.js";
import { reservarEntrada, devolverEntrada } from "../lib/escrow.js";
import { matchesActionsRouter } from "./matches-actions.js";

export const matchesRouter = Router();
// Ações de sala (confirm/leave/recusar/tick/start/report-result) em
// rota própria para o arquivo não estourar ~400 linhas.
matchesRouter.use(matchesActionsRouter);

/** Comparação de strings em tempo constante (CWE-208) — para senhas de sala. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

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

  // Riot ID (game_accounts.handle, "Game#Tag") de cada usuário da sala — é dele
  // que o shape deriva `nome` (nick) e `tag`, como o legado gravava na RPC
  // sala_entrar. Sem vínculo, o fallback do shape usa displayName/email.
  // Também busca o metadata (profile_icon_id) para montar o avatar do jogador
  // a partir da conta LoL vinculada, não do avatar genérico do email.
  const accountsRows: any[] = userIds.length
    ? await ctx
        .select({
          userId: gameAccounts.userId,
          handle: gameAccounts.handle,
          metadata: gameAccounts.metadata,
          externalId: gameAccounts.externalId,
        })
        .from(gameAccounts)
        .where(and(eq(gameAccounts.gameId, "lol"), inArray(gameAccounts.userId, userIds)))
    : [];
  const riotMap = new Map<string, string>(accountsRows.map((a: any) => [a.userId, a.handle]));
  const riotIconMap = new Map<string, number>(
    accountsRows.map((a: any) => [a.userId, (a.metadata as any)?.profile_icon_id ?? null])
  );
  const riotPuuidMap = new Map<string, string>(accountsRows.map((a: any) => [a.userId, a.externalId]));
  usersRows.forEach((u: any) => {
    u.__riotHandle = riotMap.get(u.id) ?? null;
    u.__riotIconId = riotIconMap.get(u.id) ?? null;
    u.__riotPuuid = riotPuuidMap.get(u.id) ?? null;
  });

  const playersEnriched = players.map((p: any) => ({
    ...p,
    __user: userMap.get(p.userId),
    __isVip: userMap.get(p.userId)?.isVip ?? false,
  }));

  // Só salas em `aguardando_revisao` levam a contagem de prints (design v3 §6):
  // é o único estado que o front mostra "prints recebidos X/3". Evita query
  // extra na listagem pública (vitrine).
  let printsRecebidos = 0;
  if (m.status === "aguardando_revisao") {
    const printsRows = await ctx.select({ id: matchPrints.id }).from(matchPrints).where(eq(matchPrints.matchId, m.id));
    printsRecebidos = printsRows.length;
  }

  // Salas encerradas verificadas pela Riot levam o resumo da partida real
  // (matchResults.payload) para o front mostrar vencedor + stats.
  let resultadoRiot: any = null;
  if (m.status === "encerrada") {
    const [mr] = await ctx.select().from(matchResults).where(eq(matchResults.matchId, m.id)).limit(1);
    resultadoRiot = mr ? resumoRiot(mr.payload) : null;
  }

  return toLegacyMatch(m, playersEnriched, criadorNome, printsRecebidos, resultadoRiot);
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

// GET /api/matches/:id/mensagens - Histórico do chat (ADR-040). Qualquer
// usuário autenticado na sala lê (a sala é pública); enviar exige Riot
// vinculado (realtime). Faz purge preguiçoso das mensagens expiradas (>5min).
const CINCO_MINUTOS_MS = 5 * 60 * 1000;

matchesRouter.get("/:id/mensagens", async (req, res) => {
  try {
    const match = await resolverSala(req.params.id);
    if (!match) return res.status(404).json({ error: "Partida não encontrada" });

    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    // Purge preguiçoso: apaga o que já expirou antes de ler (tabela pequena).
    await db.delete(salaMensagens).where(lt(salaMensagens.createdAt, new Date(Date.now() - CINCO_MINUTOS_MS)));

    const after = Number(req.query.after);
    const condicoes = [eq(salaMensagens.matchId, match.id)];
    if (Number.isFinite(after) && after > 0) condicoes.push(gt(salaMensagens.id, after));
    const rows = await db
      .select()
      .from(salaMensagens)
      .where(and(...condicoes))
      .orderBy(asc(salaMensagens.id))
      .limit(200);

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const usersRows: any[] = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
    const userMap = new Map<string, any>(usersRows.map((u: any) => [u.id, u] as [string, any]));

    const msgs = rows.map((r) => {
      const u = userMap.get(r.userId);
      return {
        id: r.id,
        user_id: r.userId,
        nome: u?.displayName || "Jogador",
        avatar: u?.avatarUrl ?? null,
        body: r.body,
        cor: r.cor ?? null,
        created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
      };
    });
    return res.json(msgs);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar mensagens" });
  }
});

// POST /api/matches - Criar sala
matchesRouter.post("/", async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const { mode, entryMp, apostaMc, taxaPct, nome, descricao, temSenha, senha, eloMinimo, maxJogadores, timeANome, timeATag, timeALogo } = req.body;
  // apostaMc é o nome novo; entryMp é o alias legado (o fork envia entryMp).
  // Segurança (MORPH-002/004): clamp rigoroso dos valores vindos do body. Sem
  // isso, um cliente pode enviar `taxaPct: -100` (infla o payout e cria MC do
  // nada no calcularPayout) ou `maxJogadores: -1` (quebra a contagem de vagas).
  const apostaRaw = Number(apostaMc ?? entryMp ?? 0);
  const aposta = Number.isFinite(apostaRaw) ? Math.max(0, Math.min(Math.trunc(apostaRaw), 1_000_000)) : 0;
  // Taxa congelada na criação (design v3 §2: nunca muda no meio da sala).
  // O cliente NÃO escolhe a taxa — usa o padrão do servidor (8.99).
  const taxaRaw = Number(taxaPct);
  const taxa = Number.isFinite(taxaRaw) ? Math.max(0, Math.min(taxaRaw, 100)) : 8.99;
  // Máx. 10 vagas (5v5/ARAM/times); mín. 2 (1v1). Rejeita qualquer coisa fora.
  const maxRaw = Number(maxJogadores);
  const maxJogadoresSanitizado = Number.isFinite(maxRaw) ? Math.max(2, Math.min(Math.trunc(maxRaw), 10)) : 10;
  // Allowlist do modo (MORPH-002): mode do body não confiável — um valor
  // inventado quebraria o layout de vagas do front (SalaMod1 usa a lista fixa).
  const MODOS_VALIDOS = ["5v5", "1v1", "aram", "time_vs_time"];
  const modoSanitizado = MODOS_VALIDOS.includes(mode) ? mode : "5v5";
  const roomCode = `M7-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const r = await db.transaction(async (tx: any) => {
      // Criador não paga nem entra na vaga na criação: sala nasce VAZIA e a
      // reserva (escrow) só acontece quando alguém entra numa vaga (join) —
      // criar partida é grátis, custo é só para jogar. Quem cria pode nem
      // jogar. Elegibilidade checada com aposta 0 (só Riot ID/conta ativa).
      const eleg = await validarElegibilidade(tx, user.id, 0);
      if (!eleg.ok) return { ok: false as const, eleg };

      const [newMatch] = await tx
        .insert(matches)
        .values({
          gameId: "lol",
          mode: modoSanitizado,
          status: "preenchendo",
          createdBy: user.id,
          roomCode,
          entryMp: aposta,
          apostaMc: aposta,
          taxaPct: taxa,
          nome: nome || `Sala ${mode || "5v5"} de ${user.displayName || user.email?.split("@")[0]}`,
          descricao: descricao || "",
          maxJogadores: maxJogadoresSanitizado,
          temSenha: !!temSenha,
          senha: temSenha ? senha ?? null : null,
          eloMinimo: eloMinimo || null,
          timeANome: timeANome || null,
          timeATag: timeATag || null,
          timeALogo: timeALogo || null,
        })
        .returning();

      return { ok: true as const, sala: newMatch };
    });

    if (!r.ok) {
      return res.status(400).json({ error: r.eleg.erro, ...(r.eleg.faltam !== undefined ? { faltam: r.eleg.faltam } : {}), ...(r.eleg.extra ?? {}) });
    }

    notifyMatchChange(r.sala.id);
    return res.status(201).json(await shapeSala(r.sala));
  } catch (error: any) {
    if (error?.code === "SALDO_INSUFICIENTE") {
      const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, user.id)).limit(1);
      return res.status(400).json({ error: "saldo_insuficiente", faltam: aposta - (w?.mc ?? 0) });
    }
    return res.status(500).json({ error: error?.message || "Erro ao criar sala" });
  }
});

// POST /api/matches/:id/join - Entrar (ou trocar de vaga)
matchesRouter.post("/:id/join", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const { side, roleSlot, senha } = req.body;
    const isTimeA = side ? side !== "red" : req.body.is_time_a !== false;
    const vaga = normalizarVaga(roleSlot, isTimeA);

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };

      // Segurança (MORPH-001): a senha é validada NO SERVIDOR, nunca no
      // cliente. O shape não devolve a senha; quem entra em sala privada
      // precisa enviar a senha no body do join. Comparação em tempo
      // constante para não vazar informação por timing.
      if (match.temSenha) {
        const senhaOk = typeof senha === "string" && timingSafeEqualStr(senha, match.senha ?? "");
        if (!senhaOk) {
          return { ok: false, erro: "senha_incorreta", estado: match.status, mudou: false };
        }
      }

      const trans = await avaliarTransicoes(tx, match.id);
      if (match.status !== "preenchendo") return { ok: false, erro: "estado_invalido", estado: trans.estado, mudou: trans.mudou };

      // Elegibilidade re-checada aqui, dentro da transação com FOR UPDATE
      // (design v3 §2.1 — a fonte da verdade é o servidor).
      const eleg = await validarElegibilidade(tx, user.id, match.apostaMc ?? 0, match.id);
      if (!eleg.ok) {
        return {
          ok: false,
          erro: eleg.erro,
          faltam: eleg.faltam,
          estado: match.status,
          mudou: false,
          ...(eleg.extra ?? {}),
        };
      }

      const [existing] = await tx
        .select()
        .from(matchPlayers)
        .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id)))
        .limit(1);

      // Bloqueia quem está vinculado (em partida) em outra sala. Só salas
      // ATIVAS contam: uma sala em `finalizacao`/`encerrada`/`cancelada` com
      // `linked` residual não pode prender o jogador (ajustarsala bug D).
      // Salas em `aguardando_revisao` também NÃO prendem — o jogo acabou e só
      // falta o admin decidir; o jogador pode entrar em outra partida.
      const outrosVinculos = await tx
        .select({ matchId: matchPlayers.matchId })
        .from(matchPlayers)
        .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
        .where(and(
          eq(matchPlayers.userId, user.id),
          eq(matchPlayers.linked, true),
          inArray(matches.status, ESTADOS_BLOQUEIO_NOVA_APOSTA),
        ));
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
        // SÓ casuais (aposta 0): uma sala apostada tem MC reservado — soltar a
        // vaga de lá vazaria a reserva (design v3 §2.1, 1 sala apostada ativa).
        const outrasSalas = await tx
          .select({ matchId: matchPlayers.matchId })
          .from(matchPlayers)
          .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
          .where(and(
            eq(matchPlayers.userId, user.id),
            eq(matchPlayers.linked, false),
            eq(matches.status, "preenchendo"),
            eq(matches.apostaMc, 0)
          ));
        const idsOutras = outrasSalas
          .map((p: any) => p.matchId)
          .filter((mid: string) => mid !== match.id);
        if (idsOutras.length > 0) {
          await tx.delete(matchPlayers).where(and(eq(matchPlayers.userId, user.id), inArray(matchPlayers.matchId, idsOutras)));
        }

        try {
          await reservarEntrada(tx, user.id, match.apostaMc ?? match.entryMp ?? 0, match.id);
        } catch (e: any) {
          if (e?.code === "SALDO_INSUFICIENTE") {
            const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, user.id)).limit(1);
            return { ok: false, erro: "saldo_insuficiente", faltam: (match.apostaMc ?? 0) - (w?.mc ?? 0), estado: match.status, mudou: false };
          }
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

// DELETE /api/matches/:id - Excluir sala (somente admin/proprietário).
// A exclusão é administrativa e LIQUIDA tudo: devolve as reservas (escrow) ainda
// pendentes de cada jogador da sala apostada e remove a sala com todos os dados
// vinculados (players, prints, resultados, disputas, strikes, revenue, códigos).
// Não bloqueia por estado — em qualquer estado as reservas pendentes voltam para
// a carteira do jogador antes do DELETE. `devolverEntrada` é idempotente (no-op
// quando o jogador não tem mais nada reservado), então liquidar duas vezes é seguro.
matchesRouter.delete("/:id", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });

    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
    const eAdminOuProprietario = roles.some((r: any) => r.role === "admin" || r.role === "proprietario");
    if (!eAdminOuProprietario) {
      return res.status(403).json({ error: "Apenas admin/proprietário pode excluir sala" });
    }

    const match = await resolverSala(req.params.id);
    if (!match) return res.status(404).json({ error: "Sala não encontrada" });

    await db.transaction(async (tx: any) => {
      // Lock da linha para impedir join/transição concorrente no meio da liquidação.
      const [atual] = await tx.select().from(matches).where(eq(matches.id, match.id)).limit(1).for("update");
      if (!atual) return;

      // Devolve a reserva de cada jogador da sala apostada (mc_reservado -> mc).
      const aposta = atual.apostaMc ?? atual.entryMp ?? 0;
      if (aposta > 0) {
        const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, match.id));
        for (const p of players) {
          await devolverEntrada(tx, p.userId, aposta, match.id);
        }
      }

      // Libera o código de partida de volta para o pool (match_codes.match_id -> NULL).
      await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, match.id));
      // Remove os dados vinculados (FKs em matches.id; cascade cobriria, mas o
      // DELETE explícito deixa a liquidação clara e independente do schema).
      await tx.delete(matchPlayers).where(eq(matchPlayers.matchId, match.id));
      await tx.delete(matchResults).where(eq(matchResults.matchId, match.id));
      await tx.delete(matchPrints).where(eq(matchPrints.matchId, match.id));
      await tx.delete(matchDisputas).where(eq(matchDisputas.matchId, match.id));
      await tx.delete(userAdvertencias).where(eq(userAdvertencias.matchId, match.id));
      await tx.delete(platformRevenue).where(eq(platformRevenue.matchId, match.id));
      await tx.delete(matches).where(eq(matches.id, match.id));
    });

    notifyMatchChange(match.id);
    return res.json({ ok: true, id: match.id, salaNum: match.salaNum });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao excluir sala" });
  }
});
