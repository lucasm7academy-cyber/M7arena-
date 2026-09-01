import { Router, type Request } from "express";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { users, userIdentities, userWallets } from "../../../db/schema/identidade.js";
import { criarSessao, setSessionCookie } from "../lib/session.js";

export const googleAuthRouter = Router();

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const STATE_COOKIE = "m7_oauth_state";
const PROVIDER = "google";

function origemHost(req: Request): string {
  // Deriva a origem do Host real da requisição (m7arena.pro, www, dev ou
  // localhost). O Google só aceita a redirect_uri que bater exatamente com o
  // que o app enviou, então ela precisa acompanhar o domínio de quem acessa —
  // em vez de fixar uma única no .env (que quebra os outros domínios).
  const proto = req.protocol === "http" ? "http" : "https";
  return `${proto}://${req.get("host")}`;
}

function config(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // Precisa bater EXATAMENTE com o "Authorized redirect URI" no Google Console.
  // Override explícito (GOOGLE_REDIRECT_URI) tem prioridade; senão usa o host.
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${origemHost(req)}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

function appUrl(req: Request) {
  return process.env.APP_URL || origemHost(req);
}

/**
 * GET /api/auth/google — manda o usuário para o consentimento do Google.
 *
 * O `state` é sorteado e guardado num cookie httpOnly: no callback ele tem que
 * voltar igual. Sem isso, qualquer um consegue induzir o navegador da vítima a
 * completar um login que não foi ela quem começou (CSRF de OAuth).
 */
googleAuthRouter.get("/google", (req, res) => {
  const { clientId, redirectUri } = config(req);
  if (!clientId) {
    return res.status(503).json({ error: "Login com Google não está configurado no servidor" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000, // 10 min: só precisa sobreviver ao round-trip
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

/**
 * GET /api/auth/google/callback — troca o code por perfil, resolve o usuário
 * e devolve o navegador para o app já com o cookie de sessão.
 *
 * Redireciona (em vez de responder JSON) porque quem chega aqui é o navegador
 * vindo do Google, não um fetch do app.
 */
googleAuthRouter.get("/google/callback", async (req, res) => {
  const { clientId, clientSecret, redirectUri } = config(req);
  const falhar = (motivo: string) =>
    res.redirect(`${appUrl(req)}/login?erro=${encodeURIComponent(motivo)}`);

  try {
    if (!clientId || !clientSecret) return falhar("google_nao_configurado");

    const { code, state } = req.query as { code?: string; state?: string };
    const stateEsperado = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: "/" });

    if (!code) return falhar("codigo_ausente");
    if (!state || !stateEsperado || state !== stateEsperado) return falhar("state_invalido");

    // 1. code → access_token
    const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResp.ok) return falhar("falha_token_google");
    const { access_token } = (await tokenResp.json()) as { access_token?: string };
    if (!access_token) return falhar("falha_token_google");

    // 2. access_token → perfil
    const userResp = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userResp.ok) return falhar("falha_perfil_google");
    const perfil = (await userResp.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!perfil.email) return falhar("google_sem_email");

    const email = perfil.email.toLowerCase().trim();
    const userId = await resolverUsuario(perfil.sub, email, perfil.name, perfil.picture);

    const token = await criarSessao(userId);
    setSessionCookie(res, token);

    return res.redirect(`${appUrl(req)}/lobby`);
  } catch {
    return falhar("erro_inesperado");
  }
});

/**
 * Encontra ou cria o usuário para uma conta Google.
 *
 * Ordem importa: primeiro a identidade (já logou com Google antes), depois o
 * e-mail (tem conta por senha e agora está entrando pelo Google — vincula em vez
 * de criar duplicata), e só então cria do zero.
 */
async function resolverUsuario(
  googleId: string,
  email: string,
  nome?: string,
  avatar?: string
): Promise<string> {
  const [identidade] = await db
    .select()
    .from(userIdentities)
    .where(
      and(eq(userIdentities.provider, PROVIDER), eq(userIdentities.providerAccountId, googleId))
    )
    .limit(1);

  if (identidade) return identidade.userId;

  const [existente] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existente) {
    await db.insert(userIdentities).values({
      userId: existente.id,
      provider: PROVIDER,
      providerAccountId: googleId,
    });
    return existente.id;
  }

  const [novo] = await db
    .insert(users)
    .values({
      email,
      displayName: nome?.trim() || email.split("@")[0],
      avatarUrl: avatar ?? null,
      emailVerified: new Date(),
    })
    .returning();

  await db.insert(userIdentities).values({
    userId: novo.id,
    provider: PROVIDER,
    providerAccountId: googleId,
  });

  await db.insert(userWallets).values({ userId: novo.id, mp: 0, mc: 0 });

  return novo.id;
}
