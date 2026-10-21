/**
 * password-reset.ts — regras do reset de senha feito pelo painel admin
 * (spec 2026-10-20). O token puro só sai daqui uma vez; o banco guarda o
 * SHA-256. O consumo é atômico: UPDATE ... RETURNING dentro da mesma
 * transação que grava a senha e apaga as sessões.
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  passwordResetTokens,
  users,
  userSessions,
} from "../../../db/schema/identidade.js";

export type ResultadoReset =
  | { ok: true }
  | { ok: false; erro: "link_invalido_ou_expirado" | "senha_curta" };

export const MIN_SENHA = 8;
export const VALIDADE_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** true somente para o cargo proprietario. */
export function podeGerarReset(roles: string[]): boolean {
  return roles.includes("proprietario");
}

/**
 * Cria o token, apaga os anteriores do usuário e devolve o token puro +
 * expiração. O token puro não é gravado em lugar nenhum.
 */
export async function gerarTokenReset(
  d: any,
  userId: string,
  agora: Date = new Date()
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(agora.getTime() + VALIDADE_MS);

  await d.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await d.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

/** Valida sem consumir; devolve o e-mail mascarado para a tela confirmar a conta. */
export async function validarTokenReset(
  d: any,
  token: string,
  agora: Date = new Date()
): Promise<
  | { ok: true; userId: string; emailMascarado: string }
  | { ok: false; erro: "link_invalido_ou_expirado" }
> {
  if (!token) return { ok: false, erro: "link_invalido_ou_expirado" };

  const [row] = await d
    .select({
      userId: passwordResetTokens.userId,
      email: users.email,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, agora)
      )
    )
    .limit(1);

  if (!row) return { ok: false, erro: "link_invalido_ou_expirado" };
  return { ok: true, userId: row.userId, emailMascarado: mascararEmail(row.email) };
}

/** macoinha07@gmail.com → m***@gmail.com. Local vazio → ***@dominio. */
export function mascararEmail(email: string): string {
  const [local, dominio] = String(email || "").split("@");
  if (!dominio) return "***";
  return `${local ? local[0] : ""}***@${dominio}`;
}

/**
 * Consome o token, grava bcrypt(10) e apaga todas as sessões do usuário.
 * Senha curta é recusada ANTES de abrir a transação — não queima o link.
 */
export async function consumirTokenReset(
  d: any,
  token: string,
  senha: string,
  agora: Date = new Date()
): Promise<ResultadoReset> {
  if (!token || !senha) return { ok: false, erro: "link_invalido_ou_expirado" };
  if (senha.length < MIN_SENHA) return { ok: false, erro: "senha_curta" };

  return await d.transaction(async (tx: any) => {
    // Reserva atômica: só uma requisição consegue marcar used_at.
    const [reservado] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: agora })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, hashToken(token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, agora)
        )
      )
      .returning({ userId: passwordResetTokens.userId });

    if (!reservado) {
      return { ok: false as const, erro: "link_invalido_ou_expirado" as const };
    }

    const passwordHash = await bcrypt.hash(senha, 10);
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: agora })
      .where(eq(users.id, reservado.userId));

    // Conta comprometida perde o acesso; o proprietário que resetar a própria
    // conta também cai e precisa logar de novo.
    await tx.delete(userSessions).where(eq(userSessions.userId, reservado.userId));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, reservado.userId));

    return { ok: true as const };
  });
}
