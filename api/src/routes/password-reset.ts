/**
 * Rotas públicas de reset de senha (spec 2026-10-20). O token puro chega pela
 * URL; o banco só conhece o SHA-256. Token inexistente, expirado e já usado
 * devolvem a MESMA resposta, para não revelar qual caso é.
 */
import { Router } from "express";
import { db } from "../db.js";
import { consumirTokenReset, validarTokenReset } from "../lib/password-reset.js";

export const passwordResetRouter = Router();

// GET /api/auth/reset-password/:token — valida sem consumir.
passwordResetRouter.get("/reset-password/:token", async (req, res) => {
  try {
    const r = await validarTokenReset(db, req.params.token);
    if (!r.ok) return res.status(410).json({ erro: r.erro });
    return res.json({ valido: true, email: r.emailMascarado });
  } catch (error: any) {
    console.error("[password-reset] erro ao validar:", error?.message);
    return res.status(500).json({ erro: "erro_interno" });
  }
});

// POST /api/auth/reset-password — consome o token e grava a nova senha.
passwordResetRouter.post("/reset-password", async (req, res) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || !password) return res.status(400).json({ erro: "token_ausente" });

    const r = await consumirTokenReset(db, token, password);
    if (!r.ok) {
      if (r.erro === "senha_curta") return res.status(400).json({ erro: r.erro });
      return res.status(410).json({ erro: r.erro });
    }
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("[password-reset] erro ao consumir:", error?.message);
    return res.status(500).json({ erro: "erro_interno" });
  }
});
