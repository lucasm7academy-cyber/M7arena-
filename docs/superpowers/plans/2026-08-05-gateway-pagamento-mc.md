# Gateway de Pagamento MC (Mercado Pago PIX) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Destravar a compra de M7 Coins (MC) com Mercado Pago PIX 100% na VPS: tabela `mc_packages` como fonte dos preços, rotas `/api/payments/*` na API própria, webhook idempotente que credita MC, e o `DepositModal` consumindo a API própria (sem Supabase).

**Architecture:** O `DepositModal` hoje chama a edge function `create-mercado-pago-order` do Supabase via `supabase.auth.getSession()` (sempre nula pós ADR-011 → BLK-003). Substitui-se por: pacotes em `mc_packages` no banco, `POST /api/payments/mc/order` cria o pedido PIX no Mercado Pago e grava em `payments` (`mc_credit` = base+bônus), `POST /api/payments/webhook` valida `x-signature` + confirma status no MP e credita `user_wallets.mc` + ledger `deposit` em transação com `FOR UPDATE` (idempotente). O front renderiza os pacotes da API e envia só `packageId`.

**Tech Stack:** Node 24 + Express + Drizzle + PostgreSQL (PGlite para testes) + node:test + fetch nativo (Node 24) + Vite/React (front). O webhook usa `node:crypto` HMAC-SHA256. **Sem** dependências novas — `fetch` e `crypto` são nativos.

## Global Constraints

- TypeScript `strict: true`. Nenhum `catch {}` vazio. Comentários explicam o porquê.
- Nenhum arquivo novo passa de ~400 linhas.
- Toda mudança de schema entra como migration versionada via `drizzle-kit generate` e o banco reconstroi do zero com as migrations.
- Regra de negócio e dinheiro decididos no servidor — o cliente envia só `packageId`, nunca valor/MC.
- Nenhum segredo no bundle: `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` vivem em `api/.env` e nas envs do compose, nunca em `NEXT_PUBLIC_*`/`VITE_*`.
- Idempotência: o webhook nunca credita 2x (transação `FOR UPDATE` + checagem de `status` dentro da transação).
- Webhook não confia no payload do MP: depois da assinatura, chama `GET /v1/payments/{id}` e só credita se `status === "approved"`.
- Paridade visual: o `DepositModal` mantém todos os `className` atuais; só a fonte de dados muda (ADR-005/ADR-010).
- O webhook precisa de URL pública HTTPS: `https://dev.m7arena.pro/api/payments/webhook`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `db/schema/economia.ts` | Nova tabela `mcPackages` + coluna `payments.mcCredit` |
| `db/migrations/0010_*.sql` | Migration gerada pelo drizzle-kit + seed dos 6 pacotes |
| `api/src/lib/mercado-pago.ts` | Cliente HTTP do MP: criar PIX, consultar status, validar assinatura |
| `api/src/lib/pagamentos.ts` | `creditarDeposito` (wallet+ledger) e `processarPagamentoAprovado` (idempotente) |
| `api/src/routes/payments.ts` | Rotas `packages`, `mc/order`, `webhook`, `:orderId/status` |
| `api/src/index.ts` | Monta `app.use("/api/payments", paymentsRouter)` |
| `api/test/payments.test.ts` | Testes PGlite: seed, assinatura, crédito, idempotência |
| `api/test/helpers.ts` | FIX do filtro de migrations (`/^000\d_/` não pega `0010_`) |
| `api/.env.example` + `api/.env` | Envs `MERCADO_PAGO_*` |
| `infra/docker-compose.yml` | Passa `MERCADO_PAGO_*` para o serviço `app` |
| `infra/docker-compose.local.yml` | Idem para o ambiente local |
| `web/src/lib/api.ts` | Namespace `payments` no SDK + tipos `ApiMcPackage`, `ApiMcOrderResult`, `ApiPaymentStatus` |
| `web/src/components/modals/deposit/DepositModal.tsx` | Busca pacotes da API, cria pedido via API, verifica via API; remove Supabase |

---

### Task 1: Schema — `mcPackages` + `payments.mc_credit` (migration 0010)

**Files:**
- Modify: `db/schema/economia.ts`
- Create (gerado): `db/migrations/0010_*.sql`
- Test: `db/migrations/` aplicando em PGlite

**Interfaces:**
- Consumes: nada (base do projeto).
- Produces: `mcPackages` (id, priceBrl, baseMc, bonusMc, isPopular, active, sortOrder, createdAt) e `payments.mcCredit` — usados por todas as tasks seguintes.

- [ ] **Step 1: Verifique que o projeto compila hoje**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

- [ ] **Step 2: Adicione a tabela `mc_packages` em `db/schema/economia.ts`**

Adicione `boolean` ao import do `drizzle-orm/pg-core` (hoje importa `pgTable, uuid, varchar, text, integer, numeric, timestamp, index`):

```ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
```

Ao final do arquivo `economia.ts`, adicione:

```ts
/**
 * Pacotes de compra de MC (ADR-031). Fonte da verdade dos preços: o cliente
 * nunca envia valor/MC, só o `packageId`; o servidor resolve base+bônus aqui.
 * R$1 = 100 MC de base; bônus promocional a partir de R$50 (R$50→+300,
 * R$100→+600, R$200→+1.200 — 6 MC por real). price_brl é único: dois pacotes
 * não podem custar o mesmo valor.
 */
export const mcPackages = pgTable(
  "mc_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priceBrl: numeric("price_brl", { precision: 10, scale: 2 }).notNull().unique(),
    baseMc: integer("base_mc").notNull(),
    bonusMc: integer("bonus_mc").default(0).notNull(),
    isPopular: boolean("is_popular").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("mc_packages_active_idx").on(table.active, table.sortOrder),
  ]
);
```

- [ ] **Step 3: Adicione `mcCredit` na tabela `payments`**

Na tabela `payments` de `economia.ts`, após `amountBrl`:

```ts
    amountBrl: numeric("amount_brl", { precision: 10, scale: 2 }).notNull(),
    // Total de MC (base + bônus) que este pagamento credita — o webhook usa
    // este valor para creditar a carteira. Definido no servidor a partir do
    // pacote, nunca enviado pelo cliente (ADR-031).
    mcCredit: integer("mc_credit").default(0).notNull(),
```

- [ ] **Step 4: Gere a migration e aplique o seed**

Run: `npm run db:generate`
Expected: `drizzle-kit` gera `db/migrations/0010_<nome>.sql` com `CREATE TABLE "mc_packages"` + `ALTER TABLE "payments" ADD COLUMN "mc_credit"`.

Abrir o arquivo `db/migrations/0010_*.sql` e **acrescentar no final** o seed (idempotente via `price_brl` único), seguindo o padrão do `0003_seed_games.sql`:

```sql
-- Seed dos pacotes de MC (ADR-031). R$1 = 100 MC base; bônus a partir de R$50
-- (6 MC por real). ON CONFLICT mantém a migration idempotente.
INSERT INTO "mc_packages" ("price_brl", "base_mc", "bonus_mc", "is_popular", "active", "sort_order")
VALUES
  ('5.00', 500, 0, false, true, 1),
  ('10.00', 1000, 0, false, true, 2),
  ('20.00', 2000, 0, false, true, 3),
  ('50.00', 5000, 300, true, true, 4),
  ('100.00', 10000, 600, false, true, 5),
  ('200.00', 20000, 1200, false, true, 6)
ON CONFLICT ("price_brl") DO NOTHING;
```

- [ ] **Step 5: FIX do filtro de migrations nos testes**

O `api/test/helpers.ts:20` filtra com `/^000\d_/`, que casa `0000_`…`0009_` mas **não** `0010_`. Sem o fix, a migration nova nunca é aplicada nos testes e a tabela não existe neles.

Modificar `api/test/helpers.ts`:

```ts
    .filter((f) => /^00\d{2}_/.test(f) && f.endsWith(".sql"))
```

- [ ] **Step 6: Verifique que a migration aplica num banco limpo**

Run: `npx tsx --test api/test/escrow.test.ts`
Expected: 8/8 pass (o `setupDb` aplica as migrations 0000–0010 reais; se algo quebrar, é regressão da migration).

---

### Task 2: Cliente Mercado Pago — `api/src/lib/mercado-pago.ts`

**Files:**
- Create: `api/src/lib/mercado-pago.ts`
- Test: `api/test/payments.test.ts` (assinatura)

**Interfaces:**
- Consumes: nada — este lib só fala com a API do MP.
- Produces:
  - `criarPagamentoPix(params): Promise<{ id: string; method: "pix"; qrCode: string | null; brCode: string | null }>`
  - `consultarStatusPagamento(accessToken, paymentId): Promise<string>`
  - `validarAssinatura({ secret, signature, requestId, dataId }): boolean`

- [ ] **Step 1: Escreva o arquivo**

Create `api/src/lib/mercado-pago.ts`:

```ts
/**
 * Cliente HTTP do Mercado Pago (ADR-031) — Checkout Transparente, PIX.
 *
 * Porta a edge function `create-mercado-pago-order` do Supabase (site antigo)
 * para a API própria. Segurança: o access token vive só no servidor, e o
 * webhook NÃO confia no payload do MP — confirma o status na API do MP antes
 * de qualquer crédito.
 */

import crypto from "node:crypto";

const MP_API = "https://api.mercadopago.com";

export interface MpPixOrder {
  id: string;
  method: "pix";
  qrCode: string | null;
  brCode: string | null;
}

/** Cria um pagamento PIX no Mercado Pago e devolve o QR code (base64 + copia-e-cola). */
export async function criarPagamentoPix(params: {
  accessToken: string;
  amountBrl: number;
  description: string;
  payerEmail: string;
  externalReference: string;
  notificationUrl: string;
  idempotencyKey: string;
}): Promise<MpPixOrder> {
  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: params.amountBrl,
      description: params.description,
      payment_method_id: "pix",
      payer: { email: params.payerEmail },
      external_reference: params.externalReference,
      notification_url: params.notificationUrl,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err: any = new Error(`mercadopago_erro_${res.status}`);
    err.status = res.status;
    err.mpBody = body;
    throw err;
  }

  const data = await res.json();
  const td = data.point_of_interaction?.transaction_data;
  return {
    id: String(data.id),
    method: "pix",
    qrCode: td?.qr_code_base64 ?? null,
    brCode: td?.qr_code ?? null,
  };
}

/** Consulta o status real de um pagamento no Mercado Pago (fonte da verdade do webhook). */
export async function consultarStatusPagamento(accessToken: string, paymentId: string): Promise<string> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    const err: any = new Error(`mercadopago_consulta_erro_${res.status}`);
    err.status = res.status;
    err.mpBody = body;
    throw err;
  }
  const data = await res.json();
  return String(data.status);
}

/**
 * Valida a assinatura do webhook do Mercado Pago (x-signature).
 * Formato do header: `ts=...,v1=...`. Assinatura HMAC-SHA256 sobre
 * `id:<dataId>;request-id:<requestId>;ts:<ts>;` com o webhook secret.
 * Porta a `parseSignature` da edge function `mercado-pago-webhook` (site antigo).
 */
export function validarAssinatura(params: {
  secret: string;
  signature: string;
  requestId: string;
  dataId: string;
}): boolean {
  const { secret, signature, requestId, dataId } = params;
  const parts: Record<string, string> = {};
  for (const part of signature.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts.ts || "";
  const v1 = parts.v1 || "";
  if (!ts || !v1) return false;

  const dataStr = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const calc = crypto.createHmac("sha256", secret).update(dataStr).digest("hex");
  return calc === v1;
}
```

- [ ] **Step 2: Escreva o teste de assinatura**

Create `api/test/payments.test.ts` (o arquivo será completado na Task 3):

```ts
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { mcPackages } from "../../db/schema/economia.js";
import { setupDb } from "./helpers.js";
import { validarAssinatura } from "../src/lib/mercado-pago.js";

describe("mercado-pago", () => {
  let ctx: any;
  before(async () => {
    ctx = await setupDb();
  });
  after(async () => {
    await ctx.client.close();
  });

  test("validarAssinatura aceita assinatura correta e rejeita errada", () => {
    const secret = "segredo_teste";
    const dataId = "1234567890";
    const requestId = "req-abc";
    const ts = "1700000000";
    const dataStr = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac("sha256", secret).update(dataStr).digest("hex");
    const signature = `ts=${ts},v1=${v1}`;

    assert.equal(validarAssinatura({ secret, signature, requestId, dataId }), true);
    assert.equal(validarAssinatura({ secret, signature: `ts=${ts},v1=0000000000`, requestId, dataId }), false);
    assert.equal(validarAssinatura({ secret, signature: "v1=sem-ts", requestId, dataId }), false);
  });

  test("seed de mc_packages tem 6 pacotes, bônus proporcional e popular no R$50", async () => {
    const rows = await ctx.db.select().from(mcPackages).orderBy(mcPackages.sortOrder);
    assert.equal(rows.length, 6);

    const popular = rows.find((p: any) => p.isPopular);
    assert.ok(popular);
    assert.equal(Number(popular.priceBrl), 50);

    for (const p of rows) {
      const price = Number(p.priceBrl);
      // R$1 = 100 MC base
      assert.equal(p.baseMc, price * 100);
      // bônus = 6 MC por real, só a partir de R$50
      const bonusEsperado = price >= 50 ? price * 6 : 0;
      assert.equal(p.bonusMc, bonusEsperado);
    }
  });
});
```

- [ ] **Step 3: Rode o teste**

Run: `npx tsx --test api/test/payments.test.ts`
Expected: 2/2 pass (assinatura + seed).

---

### Task 3: Lógica de crédito — `api/src/lib/pagamentos.ts`

**Files:**
- Create: `api/src/lib/pagamentos.ts`
- Modify: `api/test/payments.test.ts`

**Interfaces:**
- Consumes: `payments`/`walletTransactions`/`userWallets` (Task 1).
- Produces:
  - `creditarDeposito(tx, userId, mcCredit, paymentId)` — credita carteira + ledger deposit.
  - `processarPagamentoAprovado(db, gatewayRef): Promise<{ ok: boolean; code?: number; erro?: string; jaAprovado?: boolean }>` — idempotente.

- [ ] **Step 1: Escreva o arquivo**

Create `api/src/lib/pagamentos.ts`:

```ts
/**
 * Depósito de MC via Mercado Pago (ADR-031).
 *
 * `creditarDeposito` é a única forma de creditar MC comprado: upsert na carteira
 * + ledger `deposit` (kind `deposit`, refType `payment`) atômicos na mesma
 * transação. `processarPagamentoAprovado` garante idempotência: roda em
 * transação com `FOR UPDATE` na linha do pagamento e verifica o status DENTRO
 * da transação — dois webhooks simultâneos (ou retries do MP) creditam só uma vez.
 */

import { eq } from "drizzle-orm";
import { userWallets } from "../../../db/schema/identidade.js";
import { walletTransactions, payments } from "../../../db/schema/economia.js";

/** Credita MC comprado: upsert na carteira + ledger `deposit`, atômico. */
export async function creditarDeposito(tx: any, userId: string, mcCredit: number, paymentId: string) {
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  const novoMc = (w?.mc ?? 0) + mcCredit;

  if (w) {
    await tx
      .update(userWallets)
      .set({ mc: novoMc, updatedAt: new Date() })
      .where(eq(userWallets.userId, userId));
  } else {
    await tx.insert(userWallets).values({ userId, mc: novoMc });
  }

  await tx.insert(walletTransactions).values({
    userId,
    currency: "mc",
    amount: mcCredit,
    kind: "deposit",
    refType: "payment",
    refId: paymentId,
    balanceAfter: novoMc,
  });
}

/**
 * Aplica o pagamento aprovado pelo webhook. Idempotente: lock `FOR UPDATE` +
 * checagem de `status` dentro da transação → o segundo webhook (retry/duplicado)
 * vê `approved` e sai sem creditar de novo.
 */
export async function processarPagamentoAprovado(db: any, gatewayRef: string) {
  return db.transaction(async (tx: any) => {
    const [pag] = await tx
      .select()
      .from(payments)
      .where(eq(payments.gatewayRef, gatewayRef))
      .limit(1)
      .for("update");

    if (!pag) return { ok: false, code: 404, erro: "pagamento_nao_encontrado" };
    if (pag.status === "approved") return { ok: true, jaAprovado: true };

    await creditarDeposito(tx, pag.userId, pag.mcCredit ?? 0, pag.id);
    await tx
      .update(payments)
      .set({ status: "approved", paidAt: new Date() })
      .where(eq(payments.id, pag.id));

    return { ok: true, jaAprovado: false };
  });
}
```

- [ ] **Step 2: Estenda o teste**

No `api/test/payments.test.ts`, ajuste os imports e adicione os testes de crédito/idempotência dentro do `describe("mercado-pago", ...)`:

```ts
import { payments, walletTransactions } from "../../db/schema/economia.js";
import { users, userWallets } from "../../db/schema/identidade.js";
import { processarPagamentoAprovado } from "../src/lib/pagamentos.js";
```

E adicione (dentro do describe):

```ts
  async function criaUsuario(db: any, id: string) {
    await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
  }

  test("processarPagamentoAprovado credita MC + ledger deposit", async () => {
    const db = ctx.db;
    const uid = "11111111-1111-1111-1111-111111111111";
    const payId = "22222222-2222-2222-2222-222222222222";
    await criaUsuario(db, uid);
    await db.insert(payments).values({
      id: payId,
      userId: uid,
      gateway: "mercadopago",
      gatewayRef: "mp-1001",
      product: "mc_pack_00000000-0000-0000-0000-000000000001",
      amountBrl: "50.00",
      mcCredit: 5300,
      status: "pending",
    });

    const r = await processarPagamentoAprovado(db, "mp-1001");
    assert.deepEqual(r, { ok: true, jaAprovado: false });

    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mc, 5300);

    const [tx] = await db.select().from(walletTransactions).where(eq(walletTransactions.refId, payId));
    assert.equal(tx.kind, "deposit");
    assert.equal(tx.amount, 5300);
    assert.equal(tx.balanceAfter, 5300);

    const [pag] = await db.select().from(payments).where(eq(payments.id, payId));
    assert.equal(pag.status, "approved");
    assert.ok(pag.paidAt);
  });

  test("processarPagamentoAprovado é idempotente (webhook duplicado não credita 2x)", async () => {
    const db = ctx.db;
    const uid = "33333333-3333-3333-3333-333333333333";
    const payId = "44444444-4444-4444-4444-444444444444";
    await criaUsuario(db, uid);
    await db.insert(payments).values({
      id: payId,
      userId: uid,
      gateway: "mercadopago",
      gatewayRef: "mp-1002",
      product: "mc_pack_00000000-0000-0000-0000-000000000001",
      amountBrl: "100.00",
      mcCredit: 10600,
      status: "pending",
    });

    await processarPagamentoAprovado(db, "mp-1002");
    const r2 = await processarPagamentoAprovado(db, "mp-1002");
    assert.deepEqual(r2, { ok: true, jaAprovado: true });

    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, uid));
    assert.equal(w.mc, 10600); // não dobrou

    const txRows = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.refId, payId));
    assert.equal(txRows.length, 1); // 1 lançamento deposit, não 2
  });

  test("processarPagamentoAprovado retorna 404 para gatewayRef desconhecido", async () => {
    const r = await processarPagamentoAprovado(ctx.db, "mp-inexistente");
    assert.equal(r.ok, false);
    assert.equal(r.code, 404);
  });
```

- [ ] **Step 3: Rode o teste**

Run: `npx tsx --test api/test/payments.test.ts`
Expected: 5/5 pass.

---

### Task 4: Rotas — `api/src/routes/payments.ts` + mount

**Files:**
- Create: `api/src/routes/payments.ts`
- Modify: `api/src/index.ts`
- Test: `npx tsc --noEmit -p api/tsconfig.json`

**Interfaces:**
- Consumes: `mcPackages`, `payments` (Task 1), `criarPagamentoPix`/`consultarStatusPagamento`/`validarAssinatura` (Task 2), `processarPagamentoAprovado` (Task 3), `getAuthUser` de `api/src/lib/match-flow.ts`.
- Produces: rotas montadas em `/api/payments` que a Task 6 (front) consome.

- [ ] **Step 1: Escreva as rotas**

Create `api/src/routes/payments.ts`:

```ts
import { Router } from "express";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { mcPackages, payments } from "../../../db/schema/economia.js";
import { getAuthUser } from "../lib/match-flow.js";
import { criarPagamentoPix, consultarStatusPagamento, validarAssinatura } from "../lib/mercado-pago.js";
import { processarPagamentoAprovado } from "../lib/pagamentos.js";

export const paymentsRouter = Router();

/**
 * Gateway de pagamento de MC (ADR-031) — Mercado Pago, Checkout Transparente,
 * PIX. Substitui as edge functions `create-mercado-pago-order` e
 * `mercado-pago-webhook` do Supabase (BLK-003). O cliente só envia `packageId`;
 * preço, bônus e crédito são decididos no servidor (invariante 3.3).
 */

// GET /api/payments/packages — público. Devolve os pacotes ativos para o
// DepositModal renderizar. O preço vem do banco (fonte da verdade), nunca do
// cliente.
paymentsRouter.get("/packages", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(mcPackages)
      .where(eq(mcPackages.active, true))
      .orderBy(mcPackages.sortOrder);
    return res.json(
      rows.map((p) => ({
        id: p.id,
        priceBrl: Number(p.priceBrl),
        baseMc: p.baseMc,
        bonusMc: p.bonusMc,
        totalMc: p.baseMc + p.bonusMc,
        isPopular: p.isPopular,
      }))
    );
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "erro_interno" });
  }
});

// POST /api/payments/mc/order — autenticado. Cria pedido PIX no Mercado Pago e
// grava em `payments` com `mc_credit` (base+bônus) definido no servidor.
paymentsRouter.post("/mc/order", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const { packageId } = req.body ?? {};
    if (!packageId || typeof packageId !== "string") {
      return res.status(400).json({ error: "pacote_invalido" });
    }

    const [pkg] = await db
      .select()
      .from(mcPackages)
      .where(and(eq(mcPackages.id, packageId), eq(mcPackages.active, true)))
      .limit(1);
    if (!pkg) return res.status(400).json({ error: "pacote_invalido" });

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
    if (!accessToken) return res.status(500).json({ error: "mercadopago_nao_configurado" });

    const isTest = accessToken.startsWith("TEST-");
    const totalMc = pkg.baseMc + pkg.bonusMc;
    const amountBrl = Number(pkg.priceBrl);
    // external_reference = id do nosso registro (uuid) para o webhook poder
    // casar por gatewayRef depois.
    const paymentId = crypto.randomUUID();
    const notificationUrl =
      process.env.MERCADO_PAGO_NOTIFICATION_URL || `${process.env.APP_URL}/api/payments/webhook`;

    const pix = await criarPagamentoPix({
      accessToken,
      amountBrl,
      description: `M7 Arena - ${totalMc} MCs`,
      payerEmail: isTest
        ? "test_user_123456@testuser.com"
        : `user-${user.id.substring(0, 8)}@m7arena.pro`,
      externalReference: paymentId,
      notificationUrl,
      idempotencyKey: `${user.id}_${Date.now()}`,
    });

    await db.insert(payments).values({
      id: paymentId,
      userId: user.id,
      gateway: "mercadopago",
      gatewayRef: pix.id,
      product: `mc_pack_${pkg.id}`,
      amountBrl: amountBrl.toString(),
      mcCredit: totalMc,
      status: "pending",
    });

    return res.status(201).json({
      paymentId,
      orderId: pix.id,
      method: pix.method,
      qrCode: pix.qrCode,
      brCode: pix.brCode,
    });
  } catch (e: any) {
    // Erro do Mercado Pago: não vaza o corpo (pode conter detalhes da conta).
    if (e?.status && e?.mpBody) {
      return res.status(502).json({ error: "mercadopago_indisponivel" });
    }
    return res.status(500).json({ error: e?.message || "erro_interno" });
  }
});

// POST /api/payments/webhook — público (Mercado Pago). Valida assinatura,
// confirma o status na API do MP e credita MC (idempotente).
paymentsRouter.post("/webhook", async (req, res) => {
  try {
    const dataId = String(req.query["data.id"] ?? "");
    const type = String(req.query.type ?? "");
    if (!dataId || type !== "payment") {
      return res.json({ success: true }); // MP ignora — não é pagamento
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "";
    const isTest = accessToken.startsWith("TEST-");

    // Em produção valida a assinatura; em modo teste (TEST-) o MP não envia a
    // assinatura corretamente, igual à edge function antiga.
    if (!isTest && secret) {
      const signature = String(req.headers["x-signature"] ?? "");
      const requestId = String(req.headers["x-request-id"] ?? "");
      if (!validarAssinatura({ secret, signature, requestId, dataId })) {
        return res.status(401).json({ error: "assinatura_invalida" });
      }
    }

    // NÃO confia no payload: consulta o status real no Mercado Pago.
    const status = await consultarStatusPagamento(accessToken, dataId);
    if (status !== "approved") {
      return res.json({ success: true }); // pendente/rejeitado — nada a fazer
    }

    const r = await processarPagamentoAprovado(db, dataId);
    if (!r.ok) {
      return res.status(r.code || 500).json({ error: r.erro || "erro_interno" });
    }
    return res.json({ success: true });
  } catch (e: any) {
    // Falha ao consultar o MP ou erro interno → 500 para o MP reenviar o
    // webhook; a idempotência do processamento protege contra duplicação.
    if (e?.status && e?.mpBody) {
      return res.status(502).json({ error: "mercadopago_indisponivel" });
    }
    return res.status(500).json({ error: e?.message || "erro_interno" });
  }
});

// GET /api/payments/:orderId/status — autenticado. Lê o status do nosso
// registro (uuid nosso, o `paymentId` devolvido no create). Só o dono vê.
paymentsRouter.get("/:orderId/status", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "nao_autenticado" });

    const [pag] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, req.params.orderId), eq(payments.userId, user.id)))
      .limit(1);
    if (!pag) return res.status(404).json({ error: "pagamento_nao_encontrado" });

    return res.json({ orderId: pag.id, status: pag.status });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "erro_interno" });
  }
});
```

- [ ] **Step 2: Monte a rota no `api/src/index.ts`**

Adicione o import (na linha dos outros routers):

```ts
import { paymentsRouter } from "./routes/payments.js";
```

E monte (na lista de `app.use`, junto de `/api/wallet`):

```ts
app.use("/api/payments", paymentsRouter);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

---

### Task 5: SDK do front — `web/src/lib/api.ts`

**Files:**
- Modify: `web/src/lib/api.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: `api.payments.packages()`, `api.payments.createMcOrder(packageId)`, `api.payments.status(paymentId)` + tipos — consumidos pela Task 6.

- [ ] **Step 1: Adicione os tipos**

Após a interface `ApiWalletBalance` (linha ~169), adicione:

```ts
/** Pacote de compra de MC vindo de GET /api/payments/packages (ADR-031). */
export interface ApiMcPackage {
  id: string;
  priceBrl: number;
  baseMc: number;
  bonusMc: number;
  totalMc: number;
  isPopular: boolean;
}

/** Resposta de POST /api/payments/mc/order (QR code PIX). */
export interface ApiMcOrderResult {
  paymentId: string;
  orderId: string;
  method: string;
  qrCode: string | null;
  brCode: string | null;
}

/** Resposta de GET /api/payments/:orderId/status. */
export interface ApiPaymentStatus {
  orderId: string;
  status: string;
}
```

- [ ] **Step 2: Adicione o namespace `payments`**

Após o namespace `wallet` (linha ~595), adicione:

```ts
  payments: {
    /** Pacotes ativos de MC (fonte da verdade: servidor). */
    packages: () => api.get<ApiMcPackage[]>("/payments/packages"),
    /** Cria pedido PIX de MC (autenticado; cliente envia só o packageId). */
    createMcOrder: (packageId: string) =>
      api.post<ApiMcOrderResult>("/payments/mc/order", { packageId }),
    /** Status do pagamento pelo uuid nosso (paymentId). */
    status: (paymentId: string) =>
      api.get<ApiPaymentStatus>(`/payments/${paymentId}/status`),
  },
```

- [ ] **Step 3: Typecheck do web**

Run: `npx tsc --noEmit -p web/tsconfig.json`
Expected: só os erros pré-existentes do fork (2 em `ElectricBorder.tsx` e `Streamers.tsx`), nenhum novo em `api.ts`.

---

### Task 6: Front — `DepositModal.tsx` usa a API própria

**Files:**
- Modify: `web/src/components/modals/deposit/DepositModal.tsx`

**Interfaces:**
- Consumes: `api.payments.*` (Task 5).
- Produces: modal funcional que compra MC com PIX — verificação manual em produção via navegador.

- [ ] **Step 1: Troque o import do Supabase pela API**

Substitua:

```ts
import { supabase } from '../../../lib/supabase';
```

por:

```ts
import { api } from '../../../lib/api';
```

- [ ] **Step 2: Remova o array `PACKAGES` e o `productId`**

Remova a interface `PackageOption` antiga e o array `PACKAGES` (linhas ~9-64) e substitua por uma versão que mapeia o shape da API:

```ts
interface PackageOption {
  id: string;
  label: string;
  priceInReais: number;
  baseMc: number;
  bonusMc: number;
  mcs: number;
  popular?: boolean;
}

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

- [ ] **Step 3: Adicione estado e busca dos pacotes**

Dentro do componente, adicione após `selectedPackage`:

```ts
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
```

> **Importante (ordem de declaração):** o `useState` de `selectedPackage` (linha ~76) deve **mudar o inicializador de** `() => PACKAGES.find((pkg) => pkg.popular) || PACKAGES[0]` **para** `null` — `packages` ainda não existe naquele ponto (declaração vem depois; referenciá-lo daria TDZ/ReferenceError). O pacote inicial é escolhido no `useEffect` abaixo:

```ts
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);
```

Adicione um useEffect que busca os pacotes no mount (a lista vem do servidor, invariante 3.3):

```ts
  useEffect(() => {
    let active = true;
    api.payments
      .packages()
      .then((rows) => {
        if (!active) return;
        const lista = (rows || []).map((p) => ({
          id: p.id,
          label: `R$ ${p.priceBrl.toFixed(0)}`,
          priceInReais: p.priceBrl,
          baseMc: p.baseMc,
          bonusMc: p.bonusMc,
          mcs: p.totalMc,
          popular: p.isPopular,
        }));
        setPackages(lista);
        setSelectedPackage(lista.find((pkg) => pkg.popular) || lista[0] || null);
      })
      .catch(() => {
        if (active) toast.error('Erro ao carregar pacotes. Tente novamente.');
      })
      .finally(() => {
        if (active) setPackagesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
```

- [ ] **Step 4: Atualize `handleBuyClick` para usar a API própria**

Substitua o corpo de `handleBuyClick` (o bloco que chama `supabase.auth.getSession()` e a edge function) por:

```ts
  const handleBuyClick = async () => {
    if (!selectedPackage) return;
    if (!user) {
      toast.error('Você precisa estar logado para comprar MCs');
      return;
    }

    setLoading(true);
    console.log('[DepositModal] Iniciando pagamento...', {
      userId: user.id,
      packageId: selectedPackage.id,
    });

    try {
      const data = await api.payments.createMcOrder(selectedPackage.id);

      console.log('[DepositModal] Dados recebidos:', {
        paymentId: data.paymentId,
        orderId: data.orderId,
        hasQrCode: !!data.qrCode,
        hasBrCode: !!data.brCode,
      });

      if (data.method === 'pix' && !data.qrCode) {
        console.error('[DepositModal] PIX retornou sem QR Code!');
        toast.error('Erro: QR Code não foi gerado. Tente novamente.');
        setLoading(false);
        return;
      }

      setPaymentData({
        orderId: data.paymentId, // chave do nosso registro (uuid) p/ o checkPayment
        method: data.method,
        qrCode: data.qrCode,
        brCode: data.brCode,
        paymentUrl: '',
      });
      toast.success('QR Code gerado com sucesso!');
    } catch (error: any) {
      console.error('[DepositModal] Erro inesperado:', error);
      toast.error(error?.message || 'Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
```

> **Nota:** `orderId` recebe `data.paymentId` (uuid nosso) — é a chave que o `checkPayment` usa na API nova. O `orderId` do MP (pix.id) fica em `gatewayRef` no banco. O `PaymentData.paymentUrl` é mantido como `''` (obrigatório no tipo) porque o fluxo é PIX only — a tela de QR usa `qrCode`/`brCode`.

- [ ] **Step 5: Atualize `checkPayment` para usar a API própria**

Substitua o corpo de `checkPayment`:

```ts
  const checkPayment = async (silent = false) => {
    if (!paymentData?.orderId) return;
    if (!silent) setVerifying(true);
    try {
      const { status } = await api.payments.status(paymentData.orderId);

      if (status === 'approved') {
        toast.success('Pagamento aprovado! MCs creditados.');
        handleClose();
      } else if (!silent) {
        toast('Pagamento ainda não confirmado. Aguarde alguns instantes e tente novamente.');
      }
    } catch (err) {
      if (!silent) toast.error('Erro ao verificar pagamento.');
    } finally {
      if (!silent) setVerifying(false);
    }
  };
```

- [ ] **Step 6: Atualize as referências a `PACKAGES` e o cálculo de bônus**

O JSX ainda referencia `PACKAGES.map(...)`, `PACKAGES.find(...)` e o cálculo de `bonusPct` com `refRate` antigo. Substitua:

1. `PACKAGES.map((pkg, idx) =>` → `packages.map((pkg, idx) =>`
2. Dentro do map, substitua o cálculo de bônus:

```tsx
                        // Bônus relativo ao pacote R$10 (referência de 55 MC/R$)
                        const refRate = 550 / 10;
                        const rate = pkg.mcs / pkg.priceInReais;
                        const bonusPct = Math.round((rate / refRate - 1) * 100);
```

por:

```tsx
                        // Bônus promocional definido no servidor (ADR-031):
                        // % sobre o MC base (ex.: R$50 → 300/5000 = 6%).
                        const bonusPct = pkg.bonusMc > 0 ? Math.round((pkg.bonusMc / pkg.baseMc) * 100) : 0;
```

3. Todas as ocorrências de `PACKAGES.find((pkg) => pkg.popular) || PACKAGES[0]` (em `handleReset`, `useEffect` do `isOpen`) → `packages.find((pkg) => pkg.popular) || packages[0] || null`. (O `useState` inicial de `selectedPackage` já virou `null` no Step 3.)

4. O efeito de reset do `isOpen` (linha ~116) — mantenha a intenção, mas use a lista carregada:

```ts
  useEffect(() => {
    if (isOpen) {
      setSelectedPackage(packages.find((pkg) => pkg.popular) || packages[0] || null);
    }
  }, [isOpen, packages]);
```

5. No bloco de renderização da grade, quando `packagesLoading` e não há pacotes, mostre um placeholder simples **sem mudar o layout quando carregado** — adicione acima da grade:

```tsx
                      {packagesLoading && packages.length === 0 ? (
                        <div className="col-span-full text-white/40 text-sm py-8 text-center">
                          Carregando pacotes...
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
```

> **Atenção à paridade visual (ADR-005):** os `className` de cada pacote, do resumo e da tela de QR **não mudam**. Só a fonte de dados e o cálculo de bônus mudam.

- [ ] **Step 7: Typecheck + build do web**

Run: `npx tsc --noEmit -p web/tsconfig.json`
Expected: só os 2 erros pré-existentes do fork.

Run: `npm run build --prefix web`
Expected: build do Vite passa (comprova que o JSX continua válido e a paridade visual não quebrou).

---

### Task 7: Env e infra — `MERCADO_PAGO_*`

**Files:**
- Modify: `api/.env.example`
- Modify: `api/.env`
- Modify: `infra/docker-compose.yml`
- Modify: `infra/docker-compose.local.yml`

**Interfaces:**
- Consumes: nada.
- Produces: as envs que as rotas (Task 4) leem; sem elas o pedido responde `mercadopago_nao_configurado`.

- [ ] **Step 1: Documente no `api/.env.example`**

Acrescente no final:

```
# ── Mercado Pago (ADR-031) ───────────────────────────────────────────────────
# Checkout Transparente, PIX. NUNCA exponha no bundle do front.
# MODO TESTE: começa com "TEST-". Em produção é APP_USR-...
MERCADO_PAGO_ACCESS_TOKEN=""
# Secret da aba Webhooks do painel do Mercado Pago (valida x-signature).
MERCADO_PAGO_WEBHOOK_SECRET=""
# URL pública HTTPS que o MP notifica. Em produção: https://dev.m7arena.pro/api/payments/webhook
MERCADO_PAGO_NOTIFICATION_URL="https://dev.m7arena.pro/api/payments/webhook"
```

- [ ] **Step 2: Preencha o `api/.env`**

Adicione as credenciais de produção fornecidas pelo usuário (não vão para o git):

```
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-4743852098543095-041512-fcc3790257259c7b4cf0d927f97e5af2-3157267389"
MERCADO_PAGO_WEBHOOK_SECRET="82941e20a61499d1684b83779a117254f011fda03f4cf52b793880ec7cca8dc7"
MERCADO_PAGO_NOTIFICATION_URL="https://dev.m7arena.pro/api/payments/webhook"
```

> Verifique antes: `api/.env` está no `.gitignore`. Se não estiver, avise o usuário — NUNCA commitar segredo.

- [ ] **Step 3: Passe as envs no `infra/docker-compose.yml`**

No serviço `app`, dentro de `environment` (após `RIOT_API_KEY`), adicione:

```yaml
      MERCADO_PAGO_ACCESS_TOKEN: ${MERCADO_PAGO_ACCESS_TOKEN:-}
      MERCADO_PAGO_WEBHOOK_SECRET: ${MERCADO_PAGO_WEBHOOK_SECRET:-}
      MERCADO_PAGO_NOTIFICATION_URL: ${MERCADO_PAGO_NOTIFICATION_URL:-https://dev.m7arena.pro/api/payments/webhook}
```

- [ ] **Step 4: Passe as envs no `infra/docker-compose.local.yml`**

No serviço `app` local, dentro de `environment`, adicione o mesmo bloco (apontando para localhost no fallback):

```yaml
      MERCADO_PAGO_ACCESS_TOKEN: ${MERCADO_PAGO_ACCESS_TOKEN:-}
      MERCADO_PAGO_WEBHOOK_SECRET: ${MERCADO_PAGO_WEBHOOK_SECRET:-}
      MERCADO_PAGO_NOTIFICATION_URL: ${MERCADO_PAGO_NOTIFICATION_URL:-http://localhost:3000/api/payments/webhook}
```

- [ ] **Step 5: Valide o compose**

Run: `docker compose --env-file infra/.env.local -f infra/docker-compose.local.yml config`
Expected: configuração válida, envs `MERCADO_PAGO_*` presentes no serviço `app`.

---

### Task 8: Verificação final + regras do projeto

**Files:**
- todos os arquivos das tasks 1–7

- [ ] **Step 1: Suite de testes da API completa**

Run: `npx tsx --test api/test/payments.test.ts api/test/escrow.test.ts api/test/estados.test.ts api/test/revisao.test.ts api/test/elegibilidade.test.ts api/test/cron.test.ts api/test/disputas.test.ts api/test/prints.test.ts api/test/upload-permissao.test.ts`
Expected: todas passam exceto a falha pré-existente `test-realtime.mjs` (não incluída acima). Pelo menos `payments.test.ts` 5/5.

- [ ] **Step 2: Typechecks**

Run: `npx tsc --noEmit -p api/tsconfig.json` e `npx tsc --noEmit -p web/tsconfig.json`
Expected: api exit 0; web só os 2 erros pré-existentes do fork.

- [ ] **Step 3: Build do Vite**

Run: `npm run build --prefix web`
Expected: build ok.

- [ ] **Step 4: `verify-swap` — confirmar que o `supabase` saiu do DepositModal**

Run: `node scripts/verify-swap.js edge-functions`
Expected: contador de `functions/v1/` + `supabase.auth.getSession` no `web/src` = 0 (ou só ocorrências fora do DepositModal, com o `DepositModal` zerado).

- [ ] **Step 5: Teste ao vivo (precisa do usuário)**

Depois do deploy (`git push` + `git pull` + `docker compose --env-file /root/m7arena/.env -f infra/docker-compose.yml up -d --build app nginx`, seguindo a ADR-015), pedir ao usuário para:

1. Abrir `https://dev.m7arena.pro`, logar, abrir o modal de compra de MC e conferir os 6 pacotes (R$5 … R$200, "Mais Escolhido" no R$50, bônus de 6% a partir do R$50).
2. Selecionar um pacote, confirmar depósito e ver o QR Code PIX na tela.
3. Pagar pelo app do banco e conferir que os MCs caem na carteira (webhook credita sozinho; o botão "Já paguei — verificar agora" só relê o status).
4. No painel do Mercado Pago, trocar a "URL de produção" do webhook de `https://pgspcoclplcifigbtval.supabase.co/functions/v1/mercado-pago-webhook` para `https://dev.m7arena.pro/api/payments/webhook`.

- [ ] **Step 6: Atualize o MCP de status**

```bash
node mcp/status-server/scripts/cli.js set app.payments done --agent deepseek --evidence "tsx --test api/test/payments.test.ts → 5/5; npx tsc --noEmit -p api/tsconfig.json → exit 0; npm run build --prefix web → ok; verify-swap edge-functions → 0"
node mcp/status-server/scripts/cli.js session --agent deepseek --summary "Gateway MC Mercado Pago PIX implementado (ADR-031): mc_packages + payments.mc_credit, rotas /api/payments/*, webhook idempotente credita wallet+ledger, DepositModal na API própria sem Supabase. Pendente: teste ao vivo + trocar URL do webhook no painel MP." --touched db/schema/economia.ts,api/src/lib/mercado-pago.ts,api/src/lib/pagamentos.ts,api/src/routes/payments.ts,api/src/index.ts,api/test/payments.test.ts,api/test/helpers.ts,web/src/lib/api.ts,web/src/components/modals/deposit/DepositModal.tsx
```

> Se algo não puder ser verificado (ex.: webhook ao vivo sem pagamento real), deixar o componente como `doing` com nota, não marcar `done` — ver skill `entrega-verificada`.

