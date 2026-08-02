import crypto from "crypto";
import type { Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userRoles } from "../../../db/schema/identidade.js";

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

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
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

/** Formato único do usuário devolvido ao cliente — o SDK depende dele. */
export async function usuarioPublico(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isVip: user.isVip,
    roles: roles.map((r) => r.role),
  };
}
