import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db.js";
import { users, userSessions, userRoles, userWallets } from "../../../db/schema/identidade.js";

export const authRouter = Router();
export const termsRouter = Router();

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function setSessionCookie(res: any, token: string) {
  res.cookie("m7_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS,
  });
}

async function getAuthUser(req: any) {
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

// POST /api/terms/accept — registra o aceite dos Termos de Uso com declaração
// de 18+ (design v3 §2.1, requisito de elegibilidade para salas apostadas).
termsRouter.post("/accept", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Não autenticado" });
    if (!user.termosAceitosEm) {
      await db
        .update(users)
        .set({ termosAceitosEm: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }
    const [atual] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    return res.json({ ok: true, termos_aceitos_em: atual.termosAceitosEm });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao aceitar os termos" });
  }
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // Criar token e sessão no DB
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + SESSION_DURATION_MS);

    await db.insert(userSessions).values({
      sessionToken,
      userId: user.id,
      expires,
    });

    setSessionCookie(res, sessionToken);

    // Buscar roles
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVip: user.isVip,
        roles: roles.map((r) => r.role),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro no servidor ao realizar login" });
  }
});

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: "E-mail, senha e nome de exibição são obrigatórios" });
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: "E-mail já cadastrado" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase().trim(),
        passwordHash,
        displayName: displayName.trim(),
      })
      .returning();

    // Criar carteira padrão
    await db.insert(userWallets).values({
      userId: newUser.id,
      mp: 0,
      mc: 0,
    });

    // Criar sessão
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + SESSION_DURATION_MS);

    await db.insert(userSessions).values({
      sessionToken,
      userId: newUser.id,
      expires,
    });

    setSessionCookie(res, sessionToken);

    return res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        avatarUrl: newUser.avatarUrl,
        isVip: newUser.isVip,
        roles: ["user"],
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao registrar usuário" });
  }
});

// POST /api/auth/logout
authRouter.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.m7_session;
    if (token) {
      await db.delete(userSessions).where(eq(userSessions.sessionToken, token));
    }
    res.clearCookie("m7_session", { path: "/" });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao realizar logout" });
  }
});

// GET /api/auth/me
authRouter.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ user: null });
    }

    const [session] = await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
      .limit(1);

    if (!session) {
      res.clearCookie("m7_session", { path: "/" });
      return res.status(401).json({ user: null });
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) {
      return res.status(401).json({ user: null });
    }

    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVip: user.isVip,
        roles: roles.map((r) => r.role),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao buscar dados do usuário" });
  }
});
