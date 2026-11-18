import { Router } from "express";
import { db } from "../../db.js";
import { getAuthUser } from "../../lib/content.js";
import {
  AIM_MODES,
  ErroAim,
  LIMITE_MAX,
  LIMITE_PADRAO,
  rankingAim,
  registrarScore,
  type AimEscopo,
} from "./service.js";

export const aimRouter = Router();

/** `limit` 1..100 (default 25): fora da faixa/ausente cai no padrão ou no teto. */
function lerLimite(valor: unknown): number {
  const n = Number.parseInt(String(valor ?? ""), 10);
  if (!Number.isFinite(n)) return LIMITE_PADRAO;
  return Math.min(LIMITE_MAX, Math.max(1, n));
}

// GET /api/aim/leaderboard?mode=all|flick|track|precision&limit=25 — público.
// Um registro por jogador (o melhor score); ordena score desc e createdAt asc.
aimRouter.get("/leaderboard", async (req, res) => {
  try {
    const bruto = req.query.mode === undefined ? "" : String(req.query.mode).trim();
    const escopo = bruto || "all";
    if (escopo !== "all" && !AIM_MODES.includes(escopo as any)) {
      return res.status(400).json({ error: "modo_invalido" });
    }
    const rows = await rankingAim(db, escopo as AimEscopo, lerLimite(req.query.limit));
    return res.json({ rows });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao consultar o ranking" });
  }
});

// POST /api/aim/scores — autenticado. A nota é recalculada aqui; a do cliente
// é ignorada. Payload inválido responde 400 { error: "dados_invalidos" }.
aimRouter.post("/scores", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "nao_autenticado" });
    }
    const { row, position } = await registrarScore(db, user.id, req.body ?? {});
    return res.json({ ok: true, row, position });
  } catch (error: any) {
    if (error instanceof ErroAim) {
      return res.status(400).json({ error: error.code });
    }
    return res.status(500).json({ error: error?.message || "Erro ao registrar o score" });
  }
});
