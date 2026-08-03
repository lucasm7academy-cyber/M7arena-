import crypto from "crypto";
import type { Response } from "express";
import { db } from "../db.js";
import { userSessions } from "../../../db/schema/identidade.js";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
export const SESSION_COOKIE = "m7_session";

/**
 * Sessão own por cookie httpOnly (ADR-011). O cliente nunca lê o token: quem
 * quer saber quem está logado pergunta a GET /api/auth/me.
 *
 * Vive aqui, e não em routes/auth.ts, porque o login por senha e o login por
 * Google precisam criar sessão exatamente igual — duplicar isso é como as duas
 * pontas acabam divergindo em tempo de expiração ou flag de cookie.
 */
export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS,
  });
}

/** Cria a sessão no banco e já devolve o token pronto para o cookie. */
export async function criarSessao(userId: string): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  await db.insert(userSessions).values({
    sessionToken,
    userId,
    expires: new Date(Date.now() + SESSION_DURATION_MS),
  });
  return sessionToken;
}
