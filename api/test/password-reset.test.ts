import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { users, userSessions, passwordResetTokens } from "../../db/schema/identidade.js";
import { setupDb } from "./helpers.js";
import {
  MIN_SENHA,
  VALIDADE_MS,
  podeGerarReset,
  gerarTokenReset,
  validarTokenReset,
  consumirTokenReset,
  mascararEmail,
} from "../src/lib/password-reset.js";

const USER = "11111111-1111-1111-1111-111111111111";
const OUTRO = "22222222-2222-2222-2222-222222222222";

async function seed(db: any, id: string, email: string) {
  await db.insert(users).values({ id, email, displayName: "Jogador" }).onConflictDoNothing();
}

describe("reset de senha pelo painel admin", () => {
  let ctx: any;

  before(async () => {
    ctx = await setupDb();
    await seed(ctx.db, USER, "macoinha07@gmail.com");
    await seed(ctx.db, OUTRO, "outro@gmail.com");
  });

  beforeEach(async () => {
    await ctx.db.delete(passwordResetTokens);
    await ctx.db.delete(userSessions);
  });

  after(async () => {
    await ctx.client.close();
  });

  test("só o cargo proprietario pode gerar link", () => {
    assert.equal(podeGerarReset(["proprietario"]), true);
    assert.equal(podeGerarReset(["proprietario", "admin"]), true);
    assert.equal(podeGerarReset(["admin", "user"]), false);
    assert.equal(podeGerarReset([]), false);
  });

  test("mascara o e-mail para a tela de confirmação", () => {
    assert.equal(mascararEmail("macoinha07@gmail.com"), "m***@gmail.com");
    assert.equal(mascararEmail("@dominio.com"), "***@dominio.com");
  });

  test("gerarTokenReset cria 1 linha com hash, nunca o token puro", async () => {
    const db = ctx.db;
    const agora = new Date("2026-10-20T12:00:00.000Z");
    const { token, expiresAt } = await gerarTokenReset(db, USER, agora);

    assert.equal(token.length, 43); // 32 bytes em base64url, sem padding
    assert.equal(expiresAt.getTime(), agora.getTime() + VALIDADE_MS);

    const linhas = await db.select().from(passwordResetTokens);
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0].userId, USER);
    assert.equal(linhas[0].usedAt, null);
    assert.equal(linhas[0].tokenHash.length, 64);
    assert.notEqual(linhas[0].tokenHash, token);
    assert.equal(
      linhas[0].tokenHash,
      crypto.createHash("sha256").update(token).digest("hex")
    );
  });

  test("validarTokenReset devolve o e-mail mascarado e recusa token inexistente", async () => {
    const db = ctx.db;
    const { token } = await gerarTokenReset(db, USER);

    const ok = await validarTokenReset(db, token);
    assert.deepEqual(ok, {
      ok: true,
      userId: USER,
      emailMascarado: "m***@gmail.com",
    });

    const invalido = await validarTokenReset(db, "token-que-nao-existe");
    assert.deepEqual(invalido, { ok: false, erro: "link_invalido_ou_expirado" });
  });

  test("consumirTokenReset grava bcrypt, derruba as sessões e recusa o segundo uso", async () => {
    const db = ctx.db;
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(userSessions).values([
      { sessionToken: "sessao-1", userId: USER, expires: expira },
      { sessionToken: "sessao-2", userId: USER, expires: expira },
      { sessionToken: "sessao-de-outro", userId: OUTRO, expires: expira },
    ]);

    const { token } = await gerarTokenReset(db, USER);
    const r = await consumirTokenReset(db, token, "nova-senha-123");
    assert.deepEqual(r, { ok: true });

    const [u] = await db.select().from(users).where(eq(users.id, USER));
    assert.ok(u.passwordHash);
    assert.equal(await bcrypt.compare("nova-senha-123", u.passwordHash), true);

    // As duas sessões do alvo caíram; a de outro usuário continua.
    const sessoes = await db.select().from(userSessions);
    assert.equal(sessoes.length, 1);
    assert.equal(sessoes[0].userId, OUTRO);

    const segundo = await consumirTokenReset(db, token, "outra-senha-123");
    assert.deepEqual(segundo, { ok: false, erro: "link_invalido_ou_expirado" });
  });

  test("token expirado recusa validação e consumo", async () => {
    const db = ctx.db;
    const agora = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h atrás
    const { token } = await gerarTokenReset(db, USER, agora);

    const validacao = await validarTokenReset(db, token);
    assert.deepEqual(validacao, { ok: false, erro: "link_invalido_ou_expirado" });

    const consumo = await consumirTokenReset(db, token, "nova-senha-123");
    assert.deepEqual(consumo, { ok: false, erro: "link_invalido_ou_expirado" });
  });

  test("gerar um segundo link invalida o primeiro", async () => {
    const db = ctx.db;
    const primeiro = await gerarTokenReset(db, USER);
    const segundo = await gerarTokenReset(db, USER);

    assert.equal((await validarTokenReset(db, primeiro.token)).ok, false);
    assert.equal((await validarTokenReset(db, segundo.token)).ok, true);

    const linhas = await db.select().from(passwordResetTokens);
    assert.equal(linhas.length, 1); // o anterior foi apagado
  });

  test("senha curta não queima o link", async () => {
    const db = ctx.db;
    const { token } = await gerarTokenReset(db, USER);

    const curta = "1234567"; // 7 caracteres
    assert.equal(curta.length, MIN_SENHA - 1);
    const r = await consumirTokenReset(db, token, curta);
    assert.deepEqual(r, { ok: false, erro: "senha_curta" });

    const [linha] = await db.select().from(passwordResetTokens);
    assert.equal(linha.usedAt, null); // não foi consumido
    assert.equal((await validarTokenReset(db, token)).ok, true);

    // O mesmo link ainda funciona com uma senha de 8 caracteres.
    assert.deepEqual(await consumirTokenReset(db, token, "12345678"), { ok: true });
  });
});
