import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";
import { matchDisputas } from "../../../db/schema/apostas.js";
import { users } from "../../../db/schema/identidade.js";
import { getAuthUser } from "../lib/match-flow.js";
import { acessoSala } from "../lib/acesso-sala.js";

export const disputasRouter = Router();

/**
 * Contestação de resultado (design v3 §6.1). Enquanto a sala está em
 * `aguardando_revisao`, qualquer participante abre 1 disputa por partida
 * (constraint UNIQUE (match_id, user_id) na migration). A disputa NÃO bloqueia
 * a decisão do admin — só aparece destacada no painel para ele pesar antes de
 * decidir.
 */

/** Lista as disputas de uma partida com o nome do jogador. */
export async function listarDisputas(db: any, matchId: string) {
  return db
    .select({
      id: matchDisputas.id,
      matchId: matchDisputas.matchId,
      userId: matchDisputas.userId,
      motivo: matchDisputas.motivo,
      status: matchDisputas.status,
      createdAt: matchDisputas.createdAt,
      nomeJogador: users.displayName,
    })
    .from(matchDisputas)
    .innerJoin(users, eq(users.id, matchDisputas.userId))
    .where(eq(matchDisputas.matchId, matchId))
    .orderBy(matchDisputas.createdAt);
}

/**
 * Abre a contestação de um participante. Regras: sala em `aguardando_revisao`,
 * usuário na sala, 1 por jogador (a constraint única é a trava final — o catch
 * de 23505 devolve o erro amigável).
 */
export async function abrirDisputa(db: any, params: { userId: string; matchId: string; motivo: string }) {
  const motivoLimpo = (params.motivo || "").trim();
  if (motivoLimpo.length < 5) return { ok: false, erro: "motivo_invalido" };

  const [m] = await db.select().from(matches).where(eq(matches.id, params.matchId)).limit(1);
  if (!m) return { ok: false, erro: "sala_nao_encontrada" };
  if (m.status !== "aguardando_revisao") return { ok: false, erro: "estado_invalido", estado: m.status };

  const [player] = await db
    .select()
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, params.matchId))
    .where(eq(matchPlayers.userId, params.userId))
    .limit(1);
  if (!player) return { ok: false, erro: "nao_participante" };

  try {
    await db.insert(matchDisputas).values({ matchId: params.matchId, userId: params.userId, motivo: motivoLimpo });
    return { ok: true };
  } catch (e: any) {
    if (e?.code === "23505") return { ok: false, erro: "ja_contestou" };
    throw e;
  }
}

// POST /api/disputas/:matchId — abre contestação: { motivo }
disputasRouter.post("/:matchId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const r = await abrirDisputa(db, {
      userId: user.id,
      matchId: req.params.matchId,
      motivo: req.body?.motivo ?? "",
    });
    if (!r.ok) {
      const status = r.erro === "sala_nao_encontrada" ? 404 : r.erro === "nao_participante" ? 403 : 409;
      return res.status(status).json({ erro: r.erro, estado: r.estado });
    }
    return res.status(201).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// GET /api/disputas/:matchId — lista (participante ou revisor)
disputasRouter.get("/:matchId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const acesso = await acessoSala(db, user.id, req.params.matchId);
    if (acesso === "nenhum") return res.status(403).json({ erro: "sem_permissao" });
    const disputas = await listarDisputas(db, req.params.matchId);
    return res.json(disputas);
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});
