# Saque de M7 Coins (MC) via PIX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o jogador solicite saque de MC convertidos em reais para a chave PIX cadastrada, com o admin aprovando manualmente no painel (paga/rejeita), debitando o MC na solicitação.

**Architecture:** Nova tabela `withdrawals` em `db/schema/economia.ts`; regras de negócio puras em `api/src/lib/withdrawals.ts` (funções que recebem `tx`, testáveis com PGlite); rotas finas em `api/src/routes/withdrawals.ts`; o `DepositModal` vira checkout com abas **Depósito** (padrão) e **Saque**; nova aba **Saques** no painel admin. O admin paga o PIX fora do sistema e só confirma no painel.

**Tech Stack:** TypeScript strict, Drizzle ORM (pg), Express, React 19 + Vite, `node:test` + PGlite (migrations reais).

## Global Constraints

- Conversão **100 MC = R$1,00** (`MC_POR_REAL = 100`). O servidor converte; o cliente nunca envia a taxa.
- Valor mínimo de saque: **2.000 MC (R$20,00)**. Sem taxa.
- `mcAmount` sempre múltiplo de 100 (conversão exata).
- MC debitado **na solicitação** (`withdrawal_hold`); rejeição devolve (`withdrawal_refund`); pago consolida (sem mover MC).
- Snapshot do PIX (`pixType`, `pixKey`, `pixName`) no momento do pedido.
- Admin decide = role `admin` ou `proprietario` (`getAdminUser(req, res, ["admin"])`).
- Erros da API usam a chave `error` (o `request()` do front lê `data.error`).
- Invariante 3.6: nenhum arquivo passa de ~400 linhas.
- **Não commitar** (AGENTS.md: só commitar quando o usuário pedir). Cada "Commit" do template vira um checkpoint manual descrito no fim da task.
- Evidência de conclusão = comando rodado e saída colada (regra `entrega-verificada`).

---
---

## Task 1: Tabela `withdrawals` + migration

**Files:**
- Modify: `db/schema/economia.ts`
- Create: `db/migrations/0012_*.sql` (gerada pelo drizzle-kit)

**Interfaces:**
- Produces: export `withdrawals` (tabela Drizzle) com campos `id, userId, mcAmount, amountBrl, pixType, pixKey, pixName, status, adminId, decisionId, createdAt, decidedAt` e índices `withdrawals_user_idx`, `withdrawals_status_idx`. Novos kinds de ledger documentados: `withdrawal_hold`, `withdrawal_refund`.

- [ ] **Step 1: Atualizar o comentário de `kind` em `walletTransactions`**

Em `db/schema/economia.ts:24`, troque o comentário da coluna `kind` para:

```ts
    kind: varchar("kind", { length: 50 }).notNull(), // 'match_entry' | 'match_prize' | 'deposit' | 'payout' | 'vip_purchase' | 'referral_bonus' | 'admin_adjustment' | 'withdrawal_hold' | 'withdrawal_refund'
```

- [ ] **Step 2: Adicionar a tabela `withdrawals` no fim de `db/schema/economia.ts`**

Adicione após o bloco `mcPackages` (fim do arquivo):

```ts
/**
 * Solicitações de saque de MC via PIX (spec saque-mc-pix). Regras:
 * - `mc_amount` é debitado de `user_wallets.mc` NA SOLICITAÇÃO (ledger
 *   `withdrawal_hold`); `amount_brl` é calculado no servidor (100 MC = R$1).
 * - `pix_type`/`pix_key`/`pix_name` são SNAPSHOT do user_payout_info no momento
 *   do pedido — troca posterior da chave não afeta pedidos em aberto.
 * - `status`: 'pending' → 'paid' (admin pagou fora do sistema) | 'rejected'
 *   (devolve o MC). `decision_id` garante idempotência (dois cliques = 1 decisão).
 */
export const withdrawals = pgTable(
  "withdrawals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mcAmount: integer("mc_amount").notNull(),
    amountBrl: numeric("amount_brl", { precision: 10, scale: 2 }).notNull(),
    pixType: varchar("pix_type", { length: 50 }).notNull(),
    pixKey: text("pix_key").notNull(),
    pixName: text("pix_name").notNull(),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    adminId: uuid("admin_id").references(() => users.id),
    decisionId: uuid("decision_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { mode: "date" }),
  },
  (table) => [
    index("withdrawals_user_idx").on(table.userId),
    index("withdrawals_status_idx").on(table.status),
  ]
);
```

(O arquivo já importa `uuid, varchar, text, integer, numeric, timestamp, index` — confira o topo antes de salvar.)

- [ ] **Step 3: Gerar a migration**

Run (na raiz do repo): `npx drizzle-kit generate`
Expected: cria `db/migrations/0012_<nome>.sql` e atualiza `db/migrations/meta/_journal.json`. O SQL deve conter `CREATE TABLE IF NOT EXISTS "withdrawals"` com as colunas e os 2 índices. Se o comando listar alterações extras, NÃO aceite — o schema só mudou em `economia.ts` (adicione o `withdrawals` e nada mais).

- [ ] **Step 4: Validar que as migrations continuam aplicando num banco limpo**

Run: `npx tsx --test api/test/escrow.test.ts`
Expected: PASS (o `setupDb` do helper aplica TODAS as migrations, incluindo a 0012; se a 0012 estiver quebrada, este teste falha).

---

## Task 2: Regras de negócio `api/src/lib/withdrawals.ts` + testes

**Files:**
- Create: `api/src/lib/withdrawals.ts`
- Test: `api/test/withdrawals.test.ts`

**Interfaces:**
- Consumes: tabelas `userWallets`, `userPayoutInfo` (identidade), `withdrawals`, `walletTransactions` (economia).
- Produces:
  - `export const MC_POR_REAL = 100;`
  - `export const VALOR_MINIMO_MC = 2000;`
  - `export function mcParaBrl(mc: number): number`
  - `export async function solicitarSaque(tx, userId: string, mcAmount: number): Promise<Withdrawal>`
  - `export async function decidirSaque(tx, withdrawalId: string, adminId: string, action: 'paid' | 'rejected', decisionId: string): Promise<Withdrawal>`
  - Erros: `Error` com `.code` ∈ `valor_invalido | valor_minimo_nao_atingido | pix_nao_cadastrado | saldo_insuficiente | pedido_nao_encontrado | pedido_ja_decidido` (lowercase snake — convenção do resto da API e chaves que o front mapeia).

- [ ] **Step 1: Escrever o teste que falha**

Crie `api/test/withdrawals.test.ts`:

```ts
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets, userPayoutInfo } from "../../db/schema/identidade.js";
import { withdrawals, walletTransactions } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import { solicitarSaque, decidirSaque } from "../src/lib/withdrawals.js";

const ADMIN = "00000000-0000-0000-0000-0000000000aa";

async function criaJogador(db: any, id: string, mc: number, pixKey: string | null = "111.111.111-11") {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
  await db.insert(userWallets).values({ userId: id, mc });
  if (pixKey !== null) {
    await db.insert(userPayoutInfo).values({ userId: id, pixType: "cpf", pixKey, pixName: "Jogador Teste" });
  }
}

describe("saque de MC", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
    await ctx.db.insert(users).values({ id: ADMIN, email: "admin@x.com", displayName: "Admin" });
  });
  after(async () => {
    await ctx.client.close();
  });

  test("solicitarSaque debita MC, grava withdrawal_hold e cria pending com amountBrl", async () => {
    const db = ctx.db;
    await criaJogador(db, "11111111-1111-1111-1111-111111111111", 5000);
    const pedido = await solicitarSaque(db as any, "11111111-1111-1111-1111-111111111111", 2000);
    assert.equal(pedido.status, "pending");
    assert.equal(pedido.mcAmount, 2000);
    assert.equal(Number(pedido.amountBrl), 20);
    assert.equal(pedido.pixKey, "111.111.111-11");

    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "11111111-1111-1111-1111-111111111111"));
    assert.equal(w.mc, 3000);

    const [lanc] = await db.select().from(walletTransactions).where(eq(walletTransactions.kind, "withdrawal_hold")).limit(1);
    assert.equal(lanc.amount, -2000);
    assert.equal(lanc.balanceAfter, 3000);
  });

  test("rejeita valor não múltiplo de 100 e abaixo do mínimo", async () => {
    const db = ctx.db;
    await criaJogador(db, "22222222-2222-2222-2222-222222222222", 5000);
    await assert.rejects(
      () => solicitarSaque(db as any, "22222222-2222-2222-2222-222222222222", 1550),
      (e: any) => e.code === "valor_invalido"
    );
    await assert.rejects(
      () => solicitarSaque(db as any, "22222222-2222-2222-2222-222222222222", 1000),
      (e: any) => e.code === "valor_minimo_nao_atingido"
    );
  });

  test("rejeita sem chave PIX e sem saldo", async () => {
    const db = ctx.db;
    await criaJogador(db, "33333333-3333-3333-3333-333333333333", 5000, null);
    await assert.rejects(
      () => solicitarSaque(db as any, "33333333-3333-3333-3333-333333333333", 2000),
      (e: any) => e.code === "pix_nao_cadastrado"
    );
    await criaJogador(db, "44444444-4444-4444-4444-444444444444", 500, "222.222.222-22");
    await assert.rejects(
      () => solicitarSaque(db as any, "44444444-4444-4444-4444-444444444444", 2000),
      (e: any) => e.code === "saldo_insuficiente"
    );
  });

  test("decidirSaque paid consolida (MC não volta) e marca adminId", async () => {
    const db = ctx.db;
    await criaJogador(db, "55555555-5555-5555-5555-555555555555", 5000);
    const pedido = await solicitarSaque(db as any, "55555555-5555-5555-5555-555555555555", 2000);
    const pago = await decidirSaque(db as any, pedido.id, ADMIN, "paid", "a0000000-0000-0000-0000-000000000001");
    assert.equal(pago.status, "paid");
    assert.equal(pago.adminId, ADMIN);
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "55555555-5555-5555-5555-555555555555"));
    assert.equal(w.mc, 3000);
    const linhas = await db.select().from(walletTransactions).where(eq(walletTransactions.kind, "withdrawal_refund"));
    assert.equal(linhas.length, 0);
  });

  test("decidirSaque rejected devolve MC com ledger withdrawal_refund", async () => {
    const db = ctx.db;
    await criaJogador(db, "66666666-6666-6666-6666-666666666666", 5000);
    const pedido = await solicitarSaque(db as any, "66666666-6666-6666-6666-666666666666", 2000);
    const rejeitado = await decidirSaque(db as any, pedido.id, ADMIN, "rejected", "b0000000-0000-0000-0000-000000000002");
    assert.equal(rejeitado.status, "rejected");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "66666666-6666-6666-6666-666666666666"));
    assert.equal(w.mc, 5000);
    const [lanc] = await db.select().from(walletTransactions).where(eq(walletTransactions.kind, "withdrawal_refund")).limit(1);
    assert.equal(lanc.amount, 2000);
    assert.equal(lanc.balanceAfter, 5000);
  });

  test("decidirSaque é idempotente: segunda decisão lança PEDIDO_JA_DECIDIDO", async () => {
    const db = ctx.db;
    await criaJogador(db, "77777777-7777-7777-7777-777777777777", 5000);
    const pedido = await solicitarSaque(db as any, "77777777-7777-7777-7777-777777777777", 2000);
    await decidirSaque(db as any, pedido.id, ADMIN, "paid", "c0000000-0000-0000-0000-000000000003");
    await assert.rejects(
      () => decidirSaque(db as any, pedido.id, ADMIN, "rejected", "d0000000-0000-0000-0000-000000000004"),
      (e: any) => e.code === "pedido_ja_decidido"
    );
    await assert.rejects(
      () => decidirSaque(db as any, "00000000-0000-0000-0000-00000000dead", ADMIN, "paid", "e0000000-0000-0000-0000-000000000005"),
      (e: any) => e.code === "pedido_nao_encontrado"
    );
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx tsx --test api/test/withdrawals.test.ts`
Expected: FAIL com `Cannot find module '../src/lib/withdrawals.js'` (ou similar).

- [ ] **Step 3: Implementar `api/src/lib/withdrawals.ts`**

```ts
import { eq } from "drizzle-orm";
import { userWallets, userPayoutInfo } from "../../../db/schema/identidade.js";
import { withdrawals, walletTransactions } from "../../../db/schema/economia.js";

/**
 * Saque de MC via PIX (spec saque-mc-pix). Mesmo padrão do escrow: funções
 * recebem `tx` (transação Drizzle) — em produção a transação da rota, nos
 * testes o próprio `db`. Lock de linha (FOR UPDATE) impede concorrência.
 *
 * Invariantes:
 * - 100 MC = R$1 (MC_POR_REAL); mcAmount múltiplo de 100 para conversão exata.
 * - O MC sai da carteira NA SOLICITAÇÃO (withdrawal_hold). Pago consolida;
 *   rejeitado devolve (withdrawal_refund). Nenhuma taxa.
 */
export const MC_POR_REAL = 100;
export const VALOR_MINIMO_MC = 2000; // R$ 20,00

export function mcParaBrl(mc: number): number {
  return mc / MC_POR_REAL;
}

class ErroSaque extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/** Cria o pedido de saque: valida, debita o MC, grava ledger e snapshot do PIX. */
export async function solicitarSaque(tx: any, userId: string, mcAmount: number) {
  if (!Number.isInteger(mcAmount) || mcAmount <= 0 || mcAmount % MC_POR_REAL !== 0) {
    throw new ErroSaque("valor_invalido");
  }
  if (mcAmount < VALOR_MINIMO_MC) throw new ErroSaque("valor_minimo_nao_atingido");

  const [payout] = await tx.select().from(userPayoutInfo).where(eq(userPayoutInfo.userId, userId)).limit(1);
  if (!payout?.pixKey?.trim()) throw new ErroSaque("pix_nao_cadastrado");

  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  if (!w || w.mc < mcAmount) throw new ErroSaque("saldo_insuficiente");

  const [pedido] = await tx
    .insert(withdrawals)
    .values({
      userId,
      mcAmount,
      amountBrl: mcParaBrl(mcAmount).toString(),
      pixType: payout.pixType,
      pixKey: payout.pixKey,
      pixName: payout.pixName,
      status: "pending",
    })
    .returning();

  const novoMc = w.mc - mcAmount;
  await tx.update(userWallets).set({ mc: novoMc, updatedAt: new Date() }).where(eq(userWallets.userId, userId));
  await tx.insert(walletTransactions).values({
    userId,
    currency: "mc",
    amount: -mcAmount,
    kind: "withdrawal_hold",
    refType: "withdrawal",
    refId: pedido.id,
    balanceAfter: novoMc,
  });
  return pedido;
}

/**
 * Decide um saque como admin. `paid` consolida (MC já saiu na solicitação);
 * `rejected` devolve o MC e grava `withdrawal_refund`. Idempotente via lock
 * FOR UPDATE + checagem de status dentro da transação.
 */
export async function decidirSaque(tx: any, withdrawalId: string, adminId: string, action: "paid" | "rejected", decisionId: string) {
  const [pedido] = await tx.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).limit(1).for("update");
  if (!pedido) throw new ErroSaque("pedido_nao_encontrado");
  if (pedido.status !== "pending") throw new ErroSaque("pedido_ja_decidido");

  if (action === "rejected") {
    const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, pedido.userId)).limit(1).for("update");
    const novoMc = (w?.mc ?? 0) + pedido.mcAmount;
    await tx.update(userWallets).set({ mc: novoMc, updatedAt: new Date() }).where(eq(userWallets.userId, pedido.userId));
    await tx.insert(walletTransactions).values({
      userId: pedido.userId,
      currency: "mc",
      amount: pedido.mcAmount,
      kind: "withdrawal_refund",
      refType: "withdrawal",
      refId: pedido.id,
      balanceAfter: novoMc,
    });
  }

  const [atualizado] = await tx
    .update(withdrawals)
    .set({
      status: action === "paid" ? "paid" : "rejected",
      adminId,
      decisionId,
      decidedAt: new Date(),
    })
    .where(eq(withdrawals.id, withdrawalId))
    .returning();
  return atualizado;
}
```

- [ ] **Step 4: Rodar para passar**

Run: `npx tsx --test api/test/withdrawals.test.ts`
Expected: `pass 6`, `fail 0`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

---

## Task 3: Rotas `api/src/routes/withdrawals.ts` + registro

**Files:**
- Create: `api/src/routes/withdrawals.ts`
- Modify: `api/src/index.ts`

**Interfaces:**
- Consumes: `solicitarSaque`, `decidirSaque` (Task 2); `getAuthUser` de `../lib/match-flow.js`; `getAdminUser` de `../lib/content.js`; `db` de `../db.js`; `withdrawals`, `users`.
- Produces: rotas `POST /api/withdrawals`, `GET /api/withdrawals/mine`, `GET /api/withdrawals/admin`, `POST /api/withdrawals/:id/decide`. Erros sempre com chave `error`.

- [ ] **Step 1: Criar o arquivo de rotas**

```ts
import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "../../../db/schema/identidade.js";
import { withdrawals } from "../../../db/schema/economia.js";
import { getAuthUser } from "../lib/match-flow.js";
import { getAdminUser } from "../lib/content.js";
import { solicitarSaque, decidirSaque } from "../lib/withdrawals.js";

export const withdrawalsRouter = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape público de um pedido; admin recebe também dados do usuário. */
function shape(p: any, usuario: any = null) {
  return {
    id: p.id,
    mcAmount: p.mcAmount,
    amountBrl: Number(p.amountBrl),
    pixType: p.pixType,
    pixKey: p.pixKey,
    pixName: p.pixName,
    status: p.status,
    createdAt: p.createdAt,
    decidedAt: p.decidedAt,
    ...(usuario ? { userId: usuario.id, riotId: usuario.riotId, displayName: usuario.displayName } : {}),
  };
}

// POST /api/withdrawals — { mcAmount }. Autenticado. O servidor converte.
withdrawalsRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });
    const mcAmount = Number(req.body?.mcAmount);
    const criado = await db.transaction(async (tx: any) => solicitarSaque(tx, user.id, mcAmount));
    return res.status(201).json(shape(criado));
  } catch (e: any) {
    if (e?.code) {
      return res.status(400).json({ error: e.code });
    }
    return res.status(500).json({ error: "erro_interno" });
  }
});

// GET /api/withdrawals/mine — histórico do próprio jogador (mais recentes 50).
withdrawalsRouter.get("/mine", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });
    const rows = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.userId, user.id))
      .orderBy(desc(withdrawals.createdAt))
      .limit(50);
    return res.json(rows.map((p) => shape(p)));
  } catch (e: any) {
    return res.status(500).json({ error: "erro_interno" });
  }
});

// GET /api/withdrawals/admin — fila + histórico recente (admin). Chave PIX completa.
withdrawalsRouter.get("/admin", async (req, res) => {
  try {
    const admin = await getAdminUser(req, res, ["admin"]);
    if (!admin) return;
    const rows = await db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt)).limit(100);
    const comUsuario = await Promise.all(
      rows.map(async (p) => {
        const [u] = await db.select().from(users).where(eq(users.id, p.userId)).limit(1);
        return shape(p, u);
      })
    );
    return res.json(comUsuario);
  } catch (e: any) {
    return res.status(500).json({ error: "erro_interno" });
  }
});

// POST /api/withdrawals/:id/decide — { action: 'paid'|'rejected', decisionId }. Admin.
withdrawalsRouter.post("/:id/decide", async (req, res) => {
  try {
    const admin = await getAdminUser(req, res, ["admin"]);
    if (!admin) return;
    const { action, decisionId } = req.body ?? {};
    if (action !== "paid" && action !== "rejected") {
      return res.status(400).json({ error: "acao_invalida" });
    }
    if (!decisionId || typeof decisionId !== "string" || !UUID_REGEX.test(decisionId)) {
      return res.status(400).json({ error: "decision_id_invalido" });
    }
    if (!req.params.id || !UUID_REGEX.test(req.params.id)) {
      return res.status(404).json({ error: "pedido_nao_encontrado" });
    }
    const atualizado = await db.transaction(async (tx: any) =>
      decidirSaque(tx, req.params.id, admin.id, action, decisionId)
    );
    return res.json({ ok: true, ...shape(atualizado) });
  } catch (e: any) {
    if (e?.code) {
      const status = e.code === "pedido_nao_encontrado" ? 404 : e.code === "pedido_ja_decidido" ? 409 : 400;
      return res.status(status).json({ error: e.code });
    }
    return res.status(500).json({ error: "erro_interno" });
  }
});
```

- [ ] **Step 2: Registrar no `api/src/index.ts`**

Adicione o import (perto da linha 15, com os demais routers):

```ts
import { withdrawalsRouter } from "./routes/withdrawals.js";
```

E o registro (perto da linha 62, após o wallet):

```ts
app.use("/api/withdrawals", withdrawalsRouter);
```

- [ ] **Step 3: Rodar testes + typecheck**

Run: `npx tsx --test api/test/withdrawals.test.ts`
Expected: pass 6, fail 0.

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

---

## Task 4: SDK do front — `api.withdrawals`

**Files:**
- Modify: `web/src/lib/api.ts` (tipos perto de `ApiWalletAdjustMcResult` ~linha 205; bloco `withdrawals` no objeto `api` após o bloco `payments` ~linha 631)

**Interfaces:**
- Produces: `interface ApiWithdrawal` e o bloco `api.withdrawals.{create, mine, admin, decide}`.

- [ ] **Step 1: Adicionar o tipo `ApiWithdrawal`**

Após o bloco `ApiWalletAdjustMcResult` (linha ~209):

```ts
/** Pedido de saque de MC via PIX (spec saque-mc-pix). */
export interface ApiWithdrawal {
  id: string;
  mcAmount: number;
  amountBrl: number;
  pixType: string;
  pixKey: string;
  pixName: string;
  status: 'pending' | 'paid' | 'rejected';
  createdAt: string;
  decidedAt: string | null;
  /** Presente apenas em GET /withdrawals/admin. */
  userId?: string;
  riotId?: string | null;
  displayName?: string;
}
```

- [ ] **Step 2: Adicionar o bloco `withdrawals` no objeto `api`**

Após o bloco `payments` (linha ~631):

```ts
  withdrawals: {
    /** Cria solicitação de saque — cliente envia só o mcAmount (servidor converte). */
    create: (mcAmount: number) => api.post<ApiWithdrawal>('/withdrawals', { mcAmount }),
    /** Histórico do próprio jogador. */
    mine: () => api.get<ApiWithdrawal[]>('/withdrawals/mine'),
    /** Fila + histórico (admin). */
    admin: () => api.get<ApiWithdrawal[]>('/withdrawals/admin'),
    /** Admin decide: paid (paga fora e confirma) | rejected (devolve MC). */
    decide: (id: string, action: 'paid' | 'rejected', decisionId: string) =>
      api.post<{ ok: boolean } & ApiWithdrawal>(`/withdrawals/${id}/decide`, { action, decisionId }),
  },
```

- [ ] **Step 3: Typecheck do web**

Run: `npx tsc --noEmit -p web/tsconfig.json` (ou `npm run lint --prefix web`)
Expected: exit 0 (os 2 erros pré-existentes citados no `statusdoprojeto.md` podem continuar; não adicione erros novos).

---

## Task 5: Checkout com abas — extrair `DepositTab` + criar `SaqueTab`

**Files:**
- Create: `web/src/components/modals/deposit/DepositTab.tsx`
- Create: `web/src/components/modals/deposit/SaqueTab.tsx`
- Modify: `web/src/components/modals/deposit/DepositModal.tsx` (vira o shell com o toggle de abas)

**Interfaces:**
- Consumes: `useAuth` (AuthContext), `usePerfil` (PerfilContext → `profileData.chave_pix`), `api.wallet.balance()`, `api.withdrawals.*`.
- Produces: `DepositModal` com abas (Depósito padrão); `DepositTab` (props `{ onClose: () => void }`); `SaqueTab` (sem props).

- [ ] **Step 1: Criar `DepositTab.tsx` (recorte do conteúdo de depósito)**

Mova para `DepositTab.tsx` TODO o conteúdo de depósito do `DepositModal.tsx` atual: os estados `packages`, `selectedPackage`, `paymentData`, `verifying`, `loading`, os `useEffect`, `checkPayment`, `handleSelectPackage`, `handleBuyClick`, `handleReset`, e o JSX do grid de pacotes + resumo + tela de QR (linhas 229–456 do arquivo atual). As únicas mudanças:

- A função vira `export default function DepositTab({ onClose }: { onClose: () => void })`.
- Remove o `handleClose` local (o modal é quem fecha): o sucesso do pagamento chama `onClose()` no lugar de `handleClose()`; o botão "Voltar ao Início" também.
- Mantém `useAuth` (para o `user`), `toast`, `api`, ícones e o `GoldEssenceIcon`.
- NÃO altere nenhum `className` nem estrutura de JSX do depósito.

Cabeçalho do arquivo:

```tsx
// Depósito de MC (PIX) — aba do checkout. Recorte do DepositModal (spec
// saque-mc-pix): conteúdo visual idêntico, só o shell/toggle ficou no modal.
import React, { useState, useEffect } from 'react';
import { Loader, CheckCircle2, Copy, Zap } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import GoldEssenceIcon from '../../icons/GoldEssenceIcon';
```

- [ ] **Step 2: Criar `SaqueTab.tsx`**

```tsx
// Saque de MC via PIX — aba do checkout (spec saque-mc-pix). O jogador digita
// o valor em MC, vê ao vivo o equivalente em reais (100 MC = R$1) e solicita.
// O MC é debitado na solicitação; o admin paga o PIX fora do sistema e
// confirma no painel.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader, CheckCircle2, XCircle, Clock, ArrowUpCircle, PiggyBank } from 'lucide-react';
import { api, type ApiWithdrawal } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { usePerfil } from '../../../contexts/PerfilContext';
import toast from 'react-hot-toast';
import GoldEssenceIcon from '../../icons/GoldEssenceIcon';

const MC_POR_REAL = 100;
const VALOR_MINIMO_MC = 2000;

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mascararPix(chave: string): string {
  if (!chave) return '';
  if (chave.length <= 8) return '••••' + chave.slice(-4);
  return chave.slice(0, 4) + '••••••••' + chave.slice(-4);
}

const STATUS: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  pending: { label: 'Pendente', cls: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400', Icon: Clock },
  paid: { label: 'Pago', cls: 'bg-green-500/10 border-green-500/20 text-green-400', Icon: CheckCircle2 },
  rejected: { label: 'Rejeitado', cls: 'bg-red-500/10 border-red-500/20 text-red-400', Icon: XCircle },
};

export default function SaqueTab() {
  const { user } = useAuth();
  const { profileData } = usePerfil();
  const [saldoMc, setSaldoMc] = useState(0);
  const [mcInput, setMcInput] = useState('');
  const [pedidos, setPedidos] = useState<ApiWithdrawal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [solicitando, setSolicitando] = useState(false);

  const chavePix = (profileData?.chave_pix as string) || '';
  const nomePix = (profileData?.nome_pix as string) || '';
  const tipoPix = (profileData?.tipo_chave_pix as string) || '';

  useEffect(() => {
    if (!user) return;
    let ativo = true;
    Promise.all([api.wallet.balance(), api.withdrawals.mine()])
      .then(([bal, rows]) => {
        if (!ativo) return;
        setSaldoMc(bal?.mc ?? 0);
        setPedidos(rows ?? []);
      })
      .catch(() => {
        if (ativo) toast.error('Erro ao carregar dados de saque.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [user]);

  const mcValor = parseInt(mcInput, 10) || 0;
  const brlEquiv = brl(mcValor / MC_POR_REAL);
  const acimaMinimo = mcValor >= VALOR_MINIMO_MC;
  const podeSolicitar = !!user && !!chavePix && acimaMinimo && mcValor % MC_POR_REAL === 0 && !solicitando;

  const solicitar = async () => {
    if (!podeSolicitar) return;
    setSolicitando(true);
    try {
      await api.withdrawals.create(mcValor);
      toast.success('Saque solicitado! O admin vai pagar na sua chave PIX.');
      setMcInput('');
      const [bal, rows] = await Promise.all([api.wallet.balance(), api.withdrawals.mine()]);
      setSaldoMc(bal?.mc ?? 0);
      setPedidos(rows ?? []);
    } catch (e: any) {
      const mapa: Record<string, string> = {
        saldo_insuficiente: 'Saldo insuficiente.',
        pix_nao_cadastrado: 'Cadastre sua chave PIX no perfil antes de sacar.',
        valor_minimo_nao_atingido: `Mínimo de R$20,00 (${VALOR_MINIMO_MC.toLocaleString('pt-BR')} MC).`,
        valor_invalido: 'Valor inválido. Use múltiplos de 100 MC.',
      };
      toast.error(mapa[e?.message] || e?.message || 'Erro ao solicitar saque.');
    } finally {
      setSolicitando(false);
    }
  };

  if (!user) {
    return (
      <div className="py-10 text-center">
        <p className="text-white/30 text-sm font-bold uppercase tracking-widest">Entre para solicitar saque</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-6 items-start">
      {/* Coluna esquerda: formulário de saque */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold">Seu saldo</p>
            <div className="flex items-center gap-2">
              <GoldEssenceIcon size={18} />
              <span className="text-white font-black text-lg tabular-nums">
                {saldoMc.toLocaleString('pt-BR')} MC
              </span>
              <span className="text-white/40 text-xs font-bold">= {brl(saldoMc / MC_POR_REAL)}</span>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold">Chave PIX de destino</p>
            {chavePix ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                <div>
                  <p className="text-white font-black text-sm">{nomePix || 'Sem nome'}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {tipoPix && <span className="uppercase mr-1">[{tipoPix}]</span>}
                    {mascararPix(chavePix)}
                  </p>
                </div>
                <CheckCircle2 size={16} className="text-green-400 shrink-0" />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-yellow-300 text-xs font-bold">
                <PiggyBank size={16} className="shrink-0" />
                Cadastre sua chave PIX na página de perfil antes de solicitar o saque.
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold">Valor do saque</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <GoldEssenceIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min={VALOR_MINIMO_MC}
                  step={MC_POR_REAL}
                  value={mcInput}
                  onChange={(e) => setMcInput(e.target.value)}
                  placeholder={`Mínimo ${VALOR_MINIMO_MC.toLocaleString('pt-BR')} MC`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-[#FFD700]/40 placeholder:text-white/20"
                />
              </div>
              <div className="flex items-center gap-1.5 text-[#FFD700] font-black">
                <span className="text-xs uppercase tracking-widest">=</span>
                <span className="text-2xl tabular-nums">{brlEquiv}</span>
              </div>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${acimaMinimo ? 'text-white/30' : 'text-yellow-400/80'}`}>
              Mínimo de R$20,00 · Sem taxas · 100 MC = R$1,00
            </p>
          </div>

          <button
            onClick={solicitar}
            disabled={!podeSolicitar}
            className={`relative w-full py-4 rounded-xl font-black uppercase tracking-wider text-xs md:text-sm transition-all duration-300 ${
              podeSolicitar
                ? 'bg-gradient-to-r from-[#E6A600] via-[#FFD700] to-[#E6A600] text-black hover:brightness-110 shadow-[0_8px_25px_rgba(230,166,0,0.35)] cursor-pointer active:scale-95'
                : 'bg-white/10 text-white/20 cursor-not-allowed opacity-50'
            }`}
          >
            {solicitando ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size={16} className="animate-spin" />
                Solicitando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <ArrowUpCircle size={16} />
                Solicitar Saque
              </span>
            )}
          </button>
        </div>

        {/* Histórico */}
        <div>
          <p className="text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Solicitações recentes</p>
          {carregando ? (
            <div className="text-white/30 text-sm py-4 text-center">Carregando...</div>
          ) : pedidos.length === 0 ? (
            <div className="text-white/25 text-sm py-4 text-center rounded-xl border border-white/5 bg-white/[0.02]">
              Nenhum saque solicitado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {pedidos.map((p) => {
                const st = STATUS[p.status] || STATUS.pending;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                    <div>
                      <p className="text-white font-black text-sm">
                        {p.mcAmount.toLocaleString('pt-BR')} MC{' '}
                        <span className="text-white/40 text-xs font-bold">= {brl(p.amountBrl)}</span>
                      </p>
                      <p className="text-white/30 text-[10px] mt-0.5">
                        {new Date(p.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${st.cls}`}>
                      <st.Icon size={12} />
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Coluna direita: resumo fixo */}
      <div className="bg-black/60 border border-[#FFD700]/30 rounded-2xl p-5 backdrop-blur-lg space-y-4 shadow-xl lg:sticky lg:top-0">
        <p className="text-[#FFD700] text-[10px] uppercase tracking-widest font-black">Como funciona</p>
        <ul className="space-y-2.5 text-white/50 text-xs leading-relaxed">
          <li>O valor sai do seu saldo assim que você solicita.</li>
          <li>O admin paga o PIX fora do sistema e confirma no painel.</li>
          <li>Se o pedido for rejeitado, os MC voltam para o seu saldo.</li>
          <li>Conversão fixa: <span className="text-white/80 font-black">100 MC = R$1,00</span>.</li>
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Reescrever `DepositModal.tsx` como shell com toggle**

O modal mantém o overlay, o fundo dourado, a linha do topo, a imagem do Twisted Fate, o botão fechar e o cabeçalho — e passa a renderizar o toggle **Depósito | Saque** (Depósito padrão). O cabeçalho vira dinâmico por aba (texto no mesmo estilo). Exemplo do arquivo resultante:

```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import DepositTab from './DepositTab';
import SaqueTab from './SaqueTab';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Aba = 'deposito' | 'saque';

const TITULO: Record<Aba, { badge: string; title: string; desc: string }> = {
  deposito: {
    badge: 'Recarga Instantânea via PIX',
    title: 'Depositar M7 COINS',
    desc: 'Escolha um pacote e seus MCs caem na hora. Quanto maior o pacote, maior o bônus.',
  },
  saque: {
    badge: 'Saque via PIX',
    title: 'Sacar M7 COINS',
    desc: 'Converta seus MC em reais e receba na sua chave PIX. 100 MC = R$1,00.',
  },
};

export default function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [aba, setAba] = useState<Aba>('deposito');

  const handleClose = () => {
    setAba('deposito');
    onClose();
  };

  const info = TITULO[aba];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="deposit-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={handleClose}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
            <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-[#FFD700]/20 blur-[120px] rounded-full animate-pulse" />
          </div>

          <motion.div
            key="deposit-modal-content"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="relative w-full max-w-4xl mx-auto rounded-3xl bg-[#0a0a0d]/95 border border-white/10 backdrop-blur-xl shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFD700] to-transparent rounded-t-3xl" />

            <motion.img
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              src="/images/25947-5-twisted-fate-picture_800x800.png"
              alt="Twisted Fate"
              className="absolute -right-[240px] bottom-0 w-[640px] max-w-none z-0 pointer-events-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.9)] filter brightness-105 opacity-85 hidden md:block"
              referrerPolicy="no-referrer"
            />

            <div className="relative p-6 md:p-8 z-10">
              <button
                onClick={handleClose}
                className="absolute top-6 right-6 z-20 w-9 h-9 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/15 transition-all flex items-center justify-center backdrop-blur-sm"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>

              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 mb-3">
                  <Zap className="w-3 h-3 text-[#FFD700]" fill="currentColor" />
                  <span className="text-[#FFD700] font-black text-[10px] uppercase tracking-widest">{info.badge}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                  {info.title.split('M7 COINS')[0]}
                  <span className="text-[#FFD700]">M7 COINS</span>
                </h2>
                <p className="text-white/45 text-sm mt-1.5 leading-relaxed max-w-md">{info.desc}</p>
              </div>

              {/* Toggle Depósito | Saque (Depósito padrão) */}
              <div className="flex gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/5 mb-6 max-w-xs">
                {(['deposito', 'saque'] as Aba[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAba(a)}
                    className={`flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                      aba === a ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {a === 'deposito' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                    {a === 'deposito' ? 'Depósito' : 'Saque'}
                  </button>
                ))}
              </div>

              {aba === 'deposito' ? <DepositTab onClose={handleClose} /> : <SaqueTab />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

> Observação: o título usa `info.title.split('M7 COINS')[0]` para manter o mesmo espaçamento do h2 original ("Depositar **M7 COINS**"). Se o resultado renderizado ficar diferente do depósito original, ajuste para os mesmos `<span>` do arquivo antigo — o depósito deve renderizar 1:1.

- [ ] **Step 4: Typecheck do web**

Run: `npx tsc --noEmit -p web/tsconfig.json`
Expected: exit 0 (2 erros pré-existentes tolerados; nenhum erro novo).

---

## Task 6: Aba "Saques" no painel admin

**Files:**
- Create: `web/src/components/admin/SaquesPix.tsx`
- Modify: `web/src/pages/Admin.tsx`

**Interfaces:**
- Consumes: `api.withdrawals.admin()` e `api.withdrawals.decide(id, action, decisionId)` (Task 4).
- Produces: componente `SaquesPix`; aba `saques` no `Admin.tsx` + card no dashboard.

- [ ] **Step 1: Criar `SaquesPix.tsx`**

Seguindo o padrão visual da `RevisaoPartidas.tsx` (mesmo `CardStyle`, toasts, lightbox não é necessário aqui):

```tsx
// Painel admin "Saques PIX" (spec saque-mc-pix). Fila das solicitações por
// antiguidade (mais antigas primeiro) com a chave PIX completa para o admin
// pagar fora do sistema e confirmar. Decisão idempotente via decisionId.
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check, X, Loader2, AlertTriangle, RefreshCw, Clock, Coins, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react';
import { api, type ApiWithdrawal } from '../../lib/api';

function CardStyle() {
  return { border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)' };
}

function gerarUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'dec-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function horasDesde(iso?: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h${min % 60 ? ` ${min % 60}min` : ''}`;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' },
  paid: { label: 'Pago', cls: 'bg-green-500/10 border-green-500/20 text-green-400' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-500/10 border-red-500/20 text-red-400' },
};

export function SaquesPix() {
  const [pedidos, setPedidos] = useState<ApiWithdrawal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; msg: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPedidos(await api.withdrawals.admin());
    } catch (e: any) {
      setErro(e?.message === 'nao_autorizado' ? 'Sem permissão (admin/proprietário).' : e?.message || 'Erro ao carregar saques.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const decidir = useCallback(
    async (pedido: ApiWithdrawal, action: 'paid' | 'rejected') => {
      setProcessandoId(pedido.id);
      try {
        const r = await api.withdrawals.decide(pedido.id, action, gerarUuid());
        if (r.ok) {
          setPopup({
            tipo: 'sucesso',
            msg: action === 'paid'
              ? `Saque de ${brl(pedido.amountBrl)} marcado como pago.`
              : `Saque de ${brl(pedido.amountBrl)} rejeitado — MC devolvido.`,
          });
        }
      } catch (e: any) {
        if (e?.message === 'pedido_ja_decidido') {
          setPopup({ tipo: 'info', msg: 'Este saque já foi decidido por outro admin.' });
        } else {
          setPopup({ tipo: 'erro', msg: `Falha ao decidir: ${e?.message || 'erro'}` });
        }
      } finally {
        setProcessandoId(null);
        setTimeout(() => setPopup(null), 4000);
        carregar();
      }
    },
    [carregar]
  );

  const pendentes = pedidos.filter((p) => p.status === 'pending');
  const historico = pedidos.filter((p) => p.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white uppercase">Saques PIX</h2>
        <button
          onClick={carregar}
          disabled={carregando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <AnimatePresence>
        {popup && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold ${
              popup.tipo === 'sucesso' ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : popup.tipo === 'info' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {popup.tipo === 'sucesso' ? <Check className="w-4 h-4" /> : popup.tipo === 'info' ? <AlertTriangle className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {popup.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {carregando && pendentes.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={CardStyle()}>
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-white/40 text-sm font-bold">Carregando solicitações...</p>
        </div>
      )}

      {!carregando && erro && (
        <div className="rounded-2xl p-8 border border-red-500/20 bg-red-500/5 text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-red-300 text-sm font-bold">{erro}</p>
        </div>
      )}

      {/* Fila dos pendentes */}
      <div>
        <p className="text-white/40 text-xs font-black uppercase mb-3">
          Pendentes ({pendentes.length})
        </p>
        {pendentes.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={CardStyle()}>
            <Check className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-white/40 text-sm font-bold">Nenhum saque aguardando pagamento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendentes.map((p) => {
              const processando = processandoId === p.id;
              return (
                <div key={p.id} className="rounded-2xl p-5 space-y-4" style={CardStyle()}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center shrink-0">
                        <ArrowDownCircle className="w-5 h-5 text-[#FFD700]" />
                      </div>
                      <div>
                        <p className="text-white font-black text-sm">
                          {p.displayName || p.riotId || 'Jogador'}
                          {p.riotId && <span className="text-white/40 text-xs ml-2">{p.riotId}</span>}
                        </p>
                        <p className="text-white/40 text-xs flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Solicitado {horasDesde(p.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700] text-[10px] font-black uppercase tracking-widest">
                        <Coins className="w-3 h-3" />
                        {p.mcAmount.toLocaleString('pt-BR')} MC
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest">
                        {brl(p.amountBrl)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Chave PIX de destino</p>
                    <p className="text-white font-black text-sm">{p.pixName}</p>
                    <p className="text-white/60 text-xs mt-0.5">
                      [{p.pixType}] <span className="font-bold">{p.pixKey}</span>
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => decidir(p, 'paid')}
                      disabled={processando}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border bg-green-500/15 border-green-500/30 text-green-300 hover:bg-green-500/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Marcar como Pago
                    </button>
                    <button
                      onClick={() => decidir(p, 'rejected')}
                      disabled={processando}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border bg-red-500/5 border-red-500/20 text-red-400/80 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Rejeitar (devolve MC)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico recente */}
      {historico.length > 0 && (
        <div>
          <p className="text-white/40 text-xs font-black uppercase mb-3">Histórico recente</p>
          <div className="space-y-2">
            {historico.slice(0, 20).map((p) => {
              const st = STATUS[p.status] || STATUS.pending;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 border border-white/5 bg-white/[0.02]">
                  <div className="min-w-0">
                    <p className="text-white font-black text-sm truncate">
                      {p.displayName || p.riotId || 'Jogador'}
                      <span className="text-white/40 text-xs ml-2">{p.mcAmount.toLocaleString('pt-BR')} MC · {brl(p.amountBrl)}</span>
                    </p>
                    <p className="text-white/30 text-[10px] mt-0.5 truncate">{p.pixKey}</p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ligar no `Admin.tsx`**

Em `web/src/pages/Admin.tsx`:

1. Import: adicione `import { SaquesPix } from '../components/admin/SaquesPix';` junto aos imports de admin (~linha 22) e adicione `Banknote` ao import de ícones da lucide (linhas 5-10).
2. Tipo `Aba` (linha 42): adicione `'saques'` → `type Aba = 'dashboard' | 'saldos' | 'saldomc' | 'ranking' | 'highlights' | 'noticias' | 'cargos' | 'contatos' | 'revisao' | 'saques';`
3. Array `abas` (linhas 1216-1226): adicione `{ id: 'saques', label: 'Saques', icon: Banknote, bloqueada: !isAdminOuProprietario },`
4. Render (linha 1298): adicione `{abaAtiva === 'saques' && <SaquesPix />}`
5. **Card no dashboard** — em `AbaDashboard` (linha 1124), adicione estado e fetch da contagem de pendentes + um card no grid (mesmo padrão do card de Revisão de Partidas):

```tsx
const [filaSaques, setFilaSaques] = useState<number | null>(null);

useEffect(() => {
  if (!podeRevisar) return;
  let ativo = true;
  api.withdrawals
    .admin()
    .then((rows) => {
      if (ativo) setFilaSaques(Array.isArray(rows) ? rows.filter((r: any) => r.status === 'pending').length : 0);
    })
    .catch(() => { if (ativo) setFilaSaques(0); });
  return () => { ativo = false; };
}, [podeRevisar]);
```

E dentro do `<div className="grid grid-cols-1 md:grid-cols-2 gap-3">`, após o card de revisão, adicione:

```tsx
{podeRevisar && (
  <button
    onClick={() => onNavigate('saques')}
    className="group relative flex items-center gap-4 p-5 rounded-2xl text-left transition-all hover:scale-[1.01]"
    style={CardStyle()}
  >
    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.3)' }}>
      <Banknote className="w-5 h-5 text-[#FFD700]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white font-black text-sm uppercase tracking-wide">Saques PIX</p>
      <p className="text-white/40 text-xs mt-0.5">
        {filaSaques === null
          ? 'Carregando...'
          : filaSaques === 0
            ? 'Nenhum saque aguardando pagamento'
            : `${filaSaques} ${filaSaques === 1 ? 'saque aguardando' : 'saques aguardando'} pagamento`}
      </p>
    </div>
    <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
  </button>
)}
```

- [ ] **Step 3: Typecheck do web**

Run: `npx tsc --noEmit -p web/tsconfig.json`
Expected: exit 0 (2 erros pré-existentes tolerados; nenhum erro novo).

---

## Task 7: Verificação final (suíte completa)

**Files:** nenhum novo.

- [ ] **Step 1: Suíte de testes da API**

Run: `npx tsx --test "api/test/*.test.ts"`
Expected: todos PASS (a suíte atual deve continuar verde + os 6 novos de `withdrawals.test.ts`).

- [ ] **Step 2: Typechecks**

Run: `npx tsc --noEmit -p api/tsconfig.json` e `npx tsc --noEmit -p web/tsconfig.json`
Expected: api exit 0; web sem erros novos (2 pré-existentes tolerados).

- [ ] **Step 3: Build do front**

Run: `npm run build --prefix web`
Expected: Vite build conclui sem erro.

- [ ] **Step 4: Checkpoint de deploy (combinar com o usuário)**

O deploy na VPS (dev.m7arena.pro) segue o fluxo já usado nas sessões anteriores: `git pull` + `docker compose --env-file /root/m7arena/.env -f infra/docker-compose.yml up --build app nginx` + rodar a migration `0012` no Postgres da VPS. **Perguntar ao usuário antes** (AGENTS.md: não deploya por conta própria).
