# Reset de Senha pelo Painel Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao cargo `proprietario` uma aba no painel admin que gera um link de uso único (24h) para um cliente definir a própria senha; ao definir, todas as sessões daquele usuário caem.

**Architecture:** Tabela `password_reset_tokens` guarda só o SHA-256 do token. Regras em `api/src/lib/password-reset.ts` (gerar, validar, consumir em transação). Duas rotas novas: uma no painel (`admin-password-reset.ts`, cargo proprietário) e uma pública (`password-reset.ts`). Front: aba `AdminSenhas.tsx`, página pública `RedefinirSenha.tsx`, namespace no `api.ts` e uma rota nova no `App.tsx`.

**Tech Stack:** Node/Express + Drizzle + PostgreSQL (PGlite nos testes), React + Vite + Tailwind, `node:test` via `npx tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-20-reset-senha-admin-design.md`

## Global Constraints

- **Não commitar** sem o usuário pedir (regra do harness).
- **Não tocar em `D:\Aplicativos\M7AcademySite`** (somente leitura) e nada de Supabase.
- **Regra de negócio no servidor**: validade, consumo, permissão e revogação de sessões são decididos na API; o cliente só exibe.
- **Código novo obedece ~400 linhas.** `api/src/routes/admin.ts` já tem 402 linhas — por isso as rotas novas vivem em arquivos próprios.
- **Paridade visual**: a página pública copia as classes do `Login.tsx` (fundo `#050505`, card `#0D0D0D`, inputs `rounded-2xl`, botão gradiente `#FFB800 → #FF5E00`). Nada de redesign.
- Textos de interface em pt-BR; TypeScript strict; imports ESM com `.js` no backend.
- Nenhum segredo no bundle; o token puro nunca é gravado nem logado.
- **Comandos de teste (raiz):** `npx tsx --test --test-concurrency=1 api/test/<arquivo>.test.ts` · typecheck API: `npx tsc --noEmit -p api/tsconfig.json` · web (workdir `web`): `npx tsc --noEmit` e `npx vite build`.
- **Baseline medido nesta máquina:** a suíte completa com o paralelismo padrão estoura a memória (`Fatal process out of memory`) em 4 arquivos; com `--test-concurrency=1` os mesmos 4 arquivos passam (42/42). Use sempre `--test-concurrency=1` na verificação final.
- **Worktree:** já criado em `D:\Aplicativos\M7arenaSite-worktrees\reset-senha-admin` (branch `feat/reset-senha-admin`), com `npm install` feito na raiz, `api/` e `web/`.

---

### Task 1: Schema + migration 0032

**Files:**
- Modify: `db/schema/identidade.ts`
- Generate: `db/migrations/0032_*.sql` (+ `db/migrations/meta/0032_snapshot.json`)
- Modify (gerado): `db/migrations/meta/_journal.json`

**Interfaces:**
- Produces: `passwordResetTokens` (`id`, `userId`, `tokenHash` unique, `expiresAt`, `usedAt`, `createdAt`) exportada por `db/schema/index.ts`.

- [ ] **Step 1: Editar `db/schema/identidade.ts`**

Adicionar `index` ao import de `drizzle-orm/pg-core` (hoje ele importa `uniqueIndex` e `primaryKey`, mas não `index`):

```ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
```

Depois do bloco de `userSessions` (e antes de `userRoles`), adicionar:

```ts
// Reset de senha pelo painel (spec 2026-10-20). O banco guarda só o SHA-256 do
// token; o token puro existe apenas na resposta que gera o link. Um link válido
// por usuário: gerar outro apaga os anteriores. O índice por user_id cobre a
// limpeza na geração e o delete no consumo.
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("password_reset_tokens_user_idx").on(table.userId)]
);
```

O barrel `db/schema/index.ts` já exporta `* from "./identidade.js"`; nada a mudar.

- [ ] **Step 2: Gerar a migration**

Run: `npm run db:generate`
Expected: cria `db/migrations/0032_<nome>.sql` e `db/migrations/meta/0032_snapshot.json`, e adiciona a entrada `0032` em `_journal.json`.

- [ ] **Step 3: Podar o SQL da 0032 (snapshot quebrado da cadeia)**

A pasta `db/migrations/meta/` só tem snapshots até `0028`. As migrations `0029`, `0030` e `0031` foram escritas à mão e **não** têm snapshot. Por isso o `drizzle-kit` vai re-emitir no SQL da 0032 o DDL delas:

```sql
-- NÃO PODE FICAR NA 0032 (já aplicado por 0029/0030/0031)
ALTER TABLE "campeonato_sala_estado" ADD COLUMN "formato" varchar(4) DEFAULT 'md3' NOT NULL;
ALTER TABLE "campeonato_sala_estado" ADD COLUMN "placar_a" integer DEFAULT 0 NOT NULL;
ALTER TABLE "campeonato_sala_estado" ADD COLUMN "placar_b" integer DEFAULT 0 NOT NULL;
ALTER TABLE "campeonato_sala_estado" ADD COLUMN "ultimo_vencedor" varchar(1);
ALTER TABLE "transmissoes" ADD COLUMN "sala_id" uuid REFERENCES "matches"("id") ON DELETE CASCADE;
```

Editar `db/migrations/0032_<nome>.sql` para conter **somente** o DDL desta feature (o `drizzle-kit` pode gerar `CREATE TABLE IF NOT EXISTS`; manter como veio):

```sql
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");
```

Não editar o `0032_snapshot.json`: ele representa o schema completo atual (inclui as colunas de 0029-0031) e é o que o próximo generate vai usar como base.

- [ ] **Step 4: Validar a cadeia num PGlite limpo**

Run: `npx tsx --test --test-concurrency=1 api/test/withdrawals.test.ts`
Expected: PASS, `# fail 0`. O `api/test/helpers.ts` aplica `0000→0032` num PGlite em memória; se a 0032 tiver DDL duplicado ou inválido, este passo falha.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

---

### Task 2: Regras do reset (`password-reset.ts`) + testes

**Files:**
- Create: `api/test/password-reset.test.ts`
- Create: `api/src/lib/password-reset.ts`

**Interfaces:**
- Produces: `MIN_SENHA`, `VALIDADE_MS`, `podeGerarReset`, `gerarTokenReset`, `validarTokenReset`, `mascararEmail`, `consumirTokenReset`, `ResultadoReset`.
- Consumes: `passwordResetTokens` (Task 1).

- [ ] **Step 1: Escrever o teste primeiro**

Criar `api/test/password-reset.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar o teste e confirmar que ele falha**

Run: `npx tsx --test --test-concurrency=1 api/test/password-reset.test.ts`
Expected: FAIL na importação (`Cannot find module .../lib/password-reset.js`) — a lib ainda não existe. É o red do TDD.

- [ ] **Step 3: Criar `api/src/lib/password-reset.ts`**

```ts
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
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx tsx --test --test-concurrency=1 api/test/password-reset.test.ts`
Expected: `# tests 8`, `# pass 8`, `# fail 0`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

---

### Task 3: Rota do painel (geração do link)

**Files:**
- Create: `api/src/routes/admin-password-reset.ts`
- Modify: `api/src/index.ts`

**Interfaces:**
- Produces: `adminPasswordResetRouter`.
- Consumes: `podeGerarReset`, `gerarTokenReset` (Task 2), `getAuthUser` de `api/src/lib/match-flow.ts`.

- [ ] **Step 1: Criar `api/src/routes/admin-password-reset.ts`**

```ts
/**
 * Rotas do reset de senha pelo painel (spec 2026-10-20). Router separado
 * porque admin.ts já passou de ~400 linhas. A permissão é checada aqui, no
 * servidor — a aba bloqueada no front é só a segunda camada.
 */
import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db.js";
import { users, userRoles } from "../../../db/schema/identidade.js";
import { getAuthUser } from "../lib/match-flow.js";
import { gerarTokenReset, podeGerarReset } from "../lib/password-reset.js";

export const adminPasswordResetRouter = Router();

/** Mesmo padrão do OAuth: host real da requisição, com APP_URL de fallback. */
function origem(req: any): string {
  const host = req.get("host");
  if (host) return `${req.protocol === "http" ? "http" : "https"}://${host}`;
  return (process.env.APP_URL || "https://m7arena.pro").replace(/\/$/, "");
}

async function getRoles(userId: string): Promise<string[]> {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

// POST /api/admin/usuarios/:userId/reset-link
adminPasswordResetRouter.post("/usuarios/:userId/reset-link", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });

    const roles = await getRoles(user.id);
    if (!podeGerarReset(roles)) {
      return res.status(403).json({ erro: "apenas_proprietario" });
    }

    // UUID malformado não é "erro interno": é alvo inexistente.
    const userId = req.params.userId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return res.status(404).json({ erro: "usuario_nao_encontrado" });
    }

    const [alvo] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    if (!alvo) return res.status(404).json({ erro: "usuario_nao_encontrado" });

    const { token, expiresAt } = await gerarTokenReset(db, alvo.id);
    const url = `${origem(req)}/redefinir-senha?token=${encodeURIComponent(token)}`;

    return res.json({ url, expira_em: expiresAt.toISOString() });
  } catch (error: any) {
    console.error("[admin-password-reset] erro:", error?.message);
    return res.status(500).json({ erro: "erro_interno" });
  }
});
```

- [ ] **Step 2: Montar em `api/src/index.ts`**

Adicionar o import junto dos outros routers de admin:

```ts
import { adminPasswordResetRouter } from "./routes/admin-password-reset.js";
```

E montar **antes** do `adminRouter` (a rota é mais específica; a ordem deixa isso explícito):

```ts
app.use("/api/admin", adminPasswordResetRouter);
app.use("/api/admin", adminRouter);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

- [ ] **Step 4: Smoke da permissão sem HTTP**

Run: `npx tsx --test --test-concurrency=1 api/test/password-reset.test.ts`
Expected: `# fail 0` (inclui `podeGerarReset` false para `admin`). A rota em si é fina: sessão → cargo → alvo → gerar; o manual do Task 7 confirma o caminho completo.

---

### Task 4: Rotas públicas + montagem

**Files:**
- Create: `api/src/routes/password-reset.ts`
- Modify: `api/src/index.ts`

**Interfaces:**
- Produces: `passwordResetRouter`.
- Consumes: `validarTokenReset`, `consumirTokenReset` (Task 2).

- [ ] **Step 1: Criar `api/src/routes/password-reset.ts`**

```ts
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
```

- [ ] **Step 2: Montar em `api/src/index.ts`**

Adicionar o import:

```ts
import { passwordResetRouter } from "./routes/password-reset.js";
```

E montar junto das rotas de auth (depois de `authRouter` e `googleAuthRouter`):

```ts
app.use("/api/auth", passwordResetRouter);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

---

### Task 5: SDK + aba Senhas no painel

**Files:**
- Modify: `web/src/lib/api.ts`
- Create: `web/src/pages/AdminSenhas.tsx`
- Modify: `web/src/pages/Admin.tsx`

**Interfaces:**
- Produces: `api.adminSenhas.buscarUsuarios`, `api.adminSenhas.gerarLink`, `AbaSenhas({ adminCargo })`.
- Consumes: rotas do Task 3 e o endpoint existente `/api/admin/usuarios?q=`.

- [ ] **Step 1: Adicionar os namespaces em `web/src/lib/api.ts`**

Depois do namespace `auth` (e antes de `terms`), adicionar:

```ts
  authReset: {
    /** Valida o token do link publico; 410 vira erro na promise. */
    validar: (token: string) =>
      api.get<{ valido: boolean; email: string }>(
        `/auth/reset-password/${encodeURIComponent(token)}`
      ),
    /** Consome o token e grava a nova senha (minimo 8, checado no servidor). */
    redefinir: (token: string, password: string) =>
      api.post<{ ok: boolean }>("/auth/reset-password", { token, password }),
  },
```

Depois do namespace `adminPunicoes` (ele termina com `desbanir`), adicionar:

```ts
  adminSenhas: {
    /** Busca usuários por email/nome/Riot ID (aba Senhas). */
    buscarUsuarios: (q: string) =>
      api.get<Array<{
        id: string;
        email: string;
        displayName: string;
        riotId: string | null;
        status: string;
        avatarUrl?: string | null;
      }>>(`/admin/usuarios?q=${encodeURIComponent(q)}`),
    /** Gera um link de uso único (24h). Só o proprietário recebe 200. */
    gerarLink: (userId: string) =>
      api.post<{ url: string; expira_em: string }>(
        `/admin/usuarios/${userId}/reset-link`
      ),
  },
```

- [ ] **Step 2: Criar `web/src/pages/AdminSenhas.tsx`**

```tsx
import React, { useState } from 'react';
import { api } from '../lib/api';
import { Search, KeyRound, Copy, Check, X, AlertTriangle } from 'lucide-react';
import type { CargoAdmin } from '../config/adminPermissoes';

interface UsuarioSenha {
  id: string;
  email: string;
  displayName: string;
  riotId: string | null;
  status: string;
  avatarUrl?: string | null;
}

interface LinkGerado {
  url: string;
  expira_em: string;
  usuario: UsuarioSenha;
}

function formatarValidade(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AbaSenhas({ adminCargo }: { adminCargo: CargoAdmin }) {
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioSenha[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [linkGerado, setLinkGerado] = useState<LinkGerado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const isProprietario = adminCargo === 'proprietario';

  const buscar = async () => {
    const q = busca.trim();
    if (!q) return;
    setBuscando(true);
    setErro(null);
    try {
      const rows = await api.adminSenhas.buscarUsuarios(q);
      setUsuarios(rows ?? []);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao buscar usuários.');
    } finally {
      setBuscando(false);
    }
  };

  const gerarLink = async (u: UsuarioSenha) => {
    setGerando(u.id);
    setErro(null);
    setLinkGerado(null);
    setCopiado(false);
    try {
      const r = await api.adminSenhas.gerarLink(u.id);
      setLinkGerado({ url: r.url, expira_em: r.expira_em, usuario: u });
    } catch (e: any) {
      const msg = e?.message || '';
      setErro(
        msg === 'apenas_proprietario'
          ? 'Apenas o proprietário pode gerar links de reset.'
          : msg === 'usuario_nao_encontrado'
            ? 'Usuário não encontrado.'
            : msg === 'nao_autenticado'
              ? 'Sua sessão expirou. Entre novamente.'
              : 'Erro ao gerar o link. Tente novamente.'
      );
    } finally {
      setGerando(null);
    }
  };

  const copiar = async () => {
    if (!linkGerado) return;
    try {
      await navigator.clipboard.writeText(linkGerado.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro('Não foi possível copiar automaticamente. Selecione o link e copie.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white uppercase">Senhas</h2>
        <p className="text-zinc-400 text-xs mt-1">
          Gere um link de uso único, válido por 24h, e envie ao cliente por WhatsApp/Discord.
          Ele define a nova senha — você nunca a vê.
        </p>
      </div>

      {erro && (
        <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-bold shadow-sm">
          {erro}
        </div>
      )}

      {!isProprietario ? (
        <div className="p-3.5 rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-sm font-bold shadow-sm">
          🔒 Apenas o proprietário pode redefinir senhas.
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por email, nome ou Riot ID..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                className="w-full pl-10 pr-4 py-3 bg-[#0e1320] border border-white/15 rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all shadow-sm"
              />
            </div>
            <button
              onClick={buscar}
              disabled={buscando || !busca.trim()}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-yellow-500 text-black font-black text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-40 transition-all shadow-md shadow-primary/20"
            >
              {buscando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {usuarios.length > 0 && (
            <div
              className="overflow-auto rounded-xl border border-white/10 shadow-xl"
              style={{
                background: 'linear-gradient(180deg, rgba(22, 28, 44, 0.8) 0%, rgba(15, 19, 30, 0.9) 100%)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0e1320] border-b border-white/10 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Usuário</th>
                    <th className="px-4 py-3 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Email</th>
                    <th className="px-4 py-3 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Status</th>
                    <th className="px-4 py-3 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Reset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="px-4 py-3 text-zinc-200 font-bold">
                        {u.displayName || u.email?.split('@')[0]}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.status === 'banida' ? (
                          <span className="px-2.5 py-1 rounded-lg font-bold text-xs border bg-red-500/20 border-red-500/40 text-red-400 inline-block">
                            Banido
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg font-bold text-xs border bg-green-500/15 border-green-500/30 text-green-400 inline-block">
                            Ativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => gerarLink(u)}
                          disabled={gerando === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 disabled:opacity-40 text-xs font-black uppercase tracking-widest transition-colors shadow-sm"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          {gerando === u.id ? 'Gerando...' : 'Gerar link'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {linkGerado && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl"
            style={{ background: 'linear-gradient(180deg, rgba(22, 28, 44, 0.98) 0%, rgba(15, 19, 30, 0.99) 100%)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-black text-lg flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" /> Link de reset
                </p>
                <p className="text-zinc-400 text-xs mt-1">{linkGerado.usuario.email}</p>
              </div>
              <button
                onClick={() => setLinkGerado(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                readOnly
                value={linkGerado.url}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-primary"
              />
              <button
                onClick={copiar}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all shrink-0"
              >
                {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
              <p className="text-yellow-200 text-xs font-semibold leading-relaxed">
                O link vale até <span className="font-black">{formatarValidade(linkGerado.expira_em)}</span> e só pode ser usado uma vez.
                Quem abrir define a nova senha. Envie por WhatsApp/Discord.
              </p>
            </div>

            <button
              onClick={() => setLinkGerado(null)}
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 font-black text-xs uppercase tracking-widest transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Ligar a aba em `web/src/pages/Admin.tsx`**

No import de `lucide-react`, adicionar `KeyRound` (junto de `Lock`, `Gamepad2`, …):

```tsx
  Pencil, Trash2, Eye, EyeOff, Star, ExternalLink, Swords, ArrowLeft, Banknote, KeyRound,
```

Adicionar o import da aba junto de `AbaPunicoes`:

```tsx
import { AbaSenhas } from './AdminSenhas';
```

Estender `type Aba`:

```tsx
type Aba = 'dashboard' | 'saldos' | 'saldomc' | 'ranking' | 'highlights' | 'noticias' | 'cargos' | 'contatos' | 'revisao' | 'punicoes' | 'saques' | 'senhas';
```

No array `abas`, depois de `punicoes` (antes de `saques`):

```tsx
    { id: 'senhas',    label: 'Senhas',    icon: KeyRound,      bloqueada: adminCargo !== 'proprietario' },
```

No render das abas, depois de `punicoes`:

```tsx
                {abaAtiva === 'senhas'     && <AbaSenhas adminCargo={adminCargo} />}
```

- [ ] **Step 4: Typecheck do web**

Run (workdir `web`): `npx tsc --noEmit`
Expected: exit 0.

---

### Task 6: Página pública + rota + mensagem no Login

**Files:**
- Create: `web/src/pages/RedefinirSenha.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/pages/Login.tsx`

**Interfaces:**
- Consumes: `api.authReset.validar` / `api.authReset.redefinir` (Task 5).
- Produces: rota `/redefinir-senha`; sucesso redireciona para `/login?senha_alterada=1`.

- [ ] **Step 1: Criar `web/src/pages/RedefinirSenha.tsx`**

```tsx
// src/pages/RedefinirSenha.tsx
// Página pública do reset feito pelo painel (spec 2026-10-20). Visual copiado
// do Login.tsx: mesmo fundo, card, inputs e botão — sem a coluna do Yasuo.
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, ArrowRight, ShieldAlert, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const LOGO_URL = '/uploads/public-images/logo-m7.png';
const MAPA_BACKGROUND = '/images/mapa2.webp';

type Estado = 'validando' | 'invalido' | 'form' | 'enviando';

export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [estado, setEstado] = useState<Estado>('validando');
  const [emailMascarado, setEmailMascarado] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!token) {
      setEstado('invalido');
      return () => { ativo = false; };
    }

    api.authReset.validar(token)
      .then((r) => {
        if (!ativo) return;
        setEmailMascarado(r.email);
        setEstado('form');
      })
      .catch(() => {
        if (ativo) setEstado('invalido');
      });

    return () => { ativo = false; };
  }, [token]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }

    setEstado('enviando');
    try {
      await api.authReset.redefinir(token, senha);
      // No auto-reset o servidor acabou de apagar a sessão do próprio
      // proprietário; sem isto o AuthContext ainda o veria logado e o Login
      // redirecionaria para /lobby antes de mostrar a mensagem de sucesso.
      await refresh();
      navigate('/login?senha_alterada=1', { replace: true });
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg === 'link_invalido_ou_expirado' || msg === 'token_ausente') {
        setEstado('invalido');
        return;
      }
      setErro(
        msg === 'senha_curta'
          ? 'A senha deve ter pelo menos 8 caracteres.'
          : 'Não foi possível redefinir a senha. Tente novamente.'
      );
      setEstado('form');
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-0 md:p-8 overflow-y-auto overflow-x-hidden font-sans bg-[#050505]">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-25 mix-blend-luminosity pointer-events-none"
        style={{ backgroundImage: `url(${MAPA_BACKGROUND})` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#050505] via-[#0A0A0A]/90 to-[#050505] backdrop-blur-sm pointer-events-none" />

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FFB800]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#FF5E00]/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md min-h-screen md:min-h-0 rounded-none md:rounded-3xl overflow-hidden bg-[#0D0D0D] border-0 md:border border-white/5 shadow-none md:shadow-[0_24px_80px_rgba(0,0,0,0.8)] mx-auto my-auto px-6 py-10 md:p-10">
        <div className="flex items-center gap-3.5 mb-8">
          <img src={LOGO_URL} alt="Logo" className="h-10 w-auto filter drop-shadow-[0_2px_8px_rgba(255,184,0,0.15)]" />
          <span className="text-sm font-black text-white uppercase tracking-widest font-headline">M7 Arena</span>
        </div>

        {estado === 'validando' && (
          <div className="py-16 flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[#FFB800] border-t-transparent rounded-full animate-spin" />
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-black">Validando link...</p>
          </div>
        )}

        {estado === 'invalido' && (
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-headline font-black text-white uppercase tracking-tight">
                Link inválido
              </h1>
              <p className="text-white/40 text-sm font-semibold mt-2 leading-relaxed">
                Este link expirou ou já foi usado. Peça um novo link ao suporte.
              </p>
            </div>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-4 bg-gradient-to-r from-[#FFB800] to-[#FF5E00] text-black font-headline font-black uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(255,184,0,0.25)] hover:shadow-[0_6px_32px_rgba(255,184,0,0.45)] transition-all duration-300"
            >
              Ir para o login <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {(estado === 'form' || estado === 'enviando') && (
          <>
            <h1 className="text-3xl md:text-4xl font-headline font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFB800] to-[#FF5E00] uppercase tracking-tight mb-2">
              Nova senha
            </h1>
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-black mb-6">
              Conta: {emailMascarado}
            </p>

            {erro && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/20 flex items-start gap-2.5">
                <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-200 text-xs font-semibold">{erro}</p>
              </div>
            )}

            <form onSubmit={enviar} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Nova senha</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    disabled={estado === 'enviando'}
                    minLength={8}
                    className="w-full pl-12 pr-12 py-3.5 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:bg-black focus:outline-none focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]/25 transition-all text-sm font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  >
                    {mostrarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-white/30 text-[10px] font-bold mt-1.5">Mínimo de 8 caracteres.</p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Confirmar nova senha</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type={mostrarConfirmar ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    disabled={estado === 'enviando'}
                    minLength={8}
                    className="w-full pl-12 pr-12 py-3.5 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:bg-black focus:outline-none focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]/25 transition-all text-sm font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  >
                    {mostrarConfirmar ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={estado === 'enviando'}
                className="w-full py-4 bg-gradient-to-r from-[#FFB800] to-[#FF5E00] text-black font-headline font-black uppercase tracking-widest rounded-full disabled:opacity-50 flex items-center justify-center gap-2 mt-6 cursor-pointer shadow-[0_6px_24px_rgba(255,184,0,0.25)] hover:shadow-[0_6px_32px_rgba(255,184,0,0.45)] transition-all duration-300"
              >
                {estado === 'enviando' ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Definir nova senha</span>
                    <ArrowRight className="w-5 h-5 shrink-0" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Adicionar a rota em `web/src/App.tsx`**

Junto dos lazy imports de páginas públicas (depois de `Login`):

```tsx
const RedefinirSenha = lazyWithRetry(() => import("./pages/RedefinirSenha"));
```

E junto das rotas públicas (depois de `/resetpassword`), mantendo as antigas:

```tsx
            <Route path="/redefinir-senha" element={<RouteWithSuspense element={<RedefinirSenha />} />} />
```

- [ ] **Step 3: Mensagem de sucesso no `Login.tsx`**

No `useEffect` que lê a query (o que já trata `?erro=`), adicionar depois do bloco do erro:

```ts
    const senhaAlterada = params.get('senha_alterada');
    if (senhaAlterada === '1') {
      setSuccessMessage('Senha redefinida. Entre com a nova senha.');
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setSuccessMessage(null), 6000);
    }
```

Nenhum `className` muda.

- [ ] **Step 4: Typecheck e build do web**

Run (workdir `web`): `npx tsc --noEmit`
Expected: exit 0.

Run (workdir `web`): `npx vite build`
Expected: build conclui com `✓ built in ...` e sem erro.

---

### Task 7: Verificação completa (é isto que conta como "done")

**Files:** nenhum novo.

- [ ] **Step 1: Migration + testes da feature**

Run: `npx tsx --test --test-concurrency=1 api/test/password-reset.test.ts`
Expected: `# tests 8`, `# pass 8`, `# fail 0`.

- [ ] **Step 2: Cadeia de migrations num PGlite limpo**

Run: `npx tsx --test --test-concurrency=1 api/test/withdrawals.test.ts`
Expected: `# fail 0` — prova que `0000→0032` aplica.

- [ ] **Step 3: Regressão da suíte inteira (serial, por causa do OOM do baseline)**

Run: `npx tsx --test --test-concurrency=1 "api/test/*.test.ts"`
Expected: `# fail 0` em todos os arquivos. Baseline conhecido: com paralelismo padrão, 4 arquivos estouram a memória; serial eles passam. Se algum teste falhar, **não** mascarar com `--test-skip`; investigar se a 0032/rotas causaram.

- [ ] **Step 4: Typechecks**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

Run (workdir `web`): `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Build do front**

Run (workdir `web`): `npx vite build`
Expected: sucesso.

- [ ] **Step 6: Manual no navegador (usuário)**

1. Logar como `proprietario` em `/admin`.
2. Abrir a aba **Senhas**, buscar um usuário de teste, clicar em **Gerar link**.
3. Copiar o link e abrir em uma aba anônima.
4. Conferir o e-mail mascarado, definir uma senha de 8+ caracteres.
5. Ser redirecionado para `/login?senha_alterada=1` e ver "Senha redefinida. Entre com a nova senha.".
6. Entrar com a senha nova.
7. Conferir que a sessão antiga daquele usuário caiu (recarregar a aba antiga → volta para login).
8. Repetir o link na aba anônima → "Link inválido".
9. Logar como `admin` comum (não proprietário) → a aba aparece bloqueada e a rota responde 403.

- [ ] **Step 7: Registrar a sessão no estado do projeto**

O MCP `m7-status` não está carregado nesta sessão; usar o CLI oficial (não editar `statusdoprojeto.md` à mão):

```powershell
node mcp/status-server/scripts/cli.js session --agent deepseek --summary "Reset de senha pelo painel admin: migration 0032, lib+rotas+tests, aba Senhas e pagina publica /redefinir-senha" --touched db/schema/identidade.ts,db/migrations,api/src/lib/password-reset.ts,api/src/routes/admin-password-reset.ts,api/src/routes/password-reset.ts,api/src/index.ts,api/test/password-reset.test.ts,web/src/lib/api.ts,web/src/pages/AdminSenhas.tsx,web/src/pages/Admin.tsx,web/src/pages/RedefinirSenha.tsx,web/src/App.tsx,web/src/pages/Login.tsx
```

Não commitar. Deploy só depois da validação do usuário.
