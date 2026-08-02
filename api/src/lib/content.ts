import { eq, and, gt } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userRoles } from "../../../db/schema/identidade.js";
import { news } from "../../../db/schema/conteudo.js";

/** Usuário autenticado pela sessão httpOnly (ADR-011) ou Bearer token. */
export async function getAuthUser(req: any) {
  const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;

  const [session] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
    .limit(1);

  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user || null;
}

/**
 * Requer usuário autenticado com um dos cargos permitidos em user_roles (regra
 * de negócio no servidor). Admin gerencia highlights; notícias também aceitam
 * organizer, que é o que a tela de Admin já permitia.
 */
export async function getAdminUser(req: any, res: any, allowed: string[]) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  if (!roles.some((r) => allowed.includes(r.role))) {
    res.status(403).json({ error: "Acesso negado: cargo insuficiente" });
    return null;
  }
  return user;
}

/** Slug no mesmo formato que a tela de Admin gera no navegador. */
export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/** Garante slug único (coluna UNIQUE do schema novo). Em conflito, anexa -1, -2… */
export async function generateUniqueSlug(base: string, ignoreId?: string): Promise<string> {
  let slug = base || "noticia";
  let i = 1;
  for (;;) {
    const cond = ignoreId ? and(eq(news.slug, slug), eq(news.id, ignoreId)) : undefined;
    const rows = cond
      ? await db.select({ id: news.id }).from(news).where(cond).limit(1)
      : await db.select({ id: news.id }).from(news).where(eq(news.slug, slug)).limit(1);
    if (rows.length === 0) return slug;
    slug = `${base}-${i}`;
    i++;
  }
}
