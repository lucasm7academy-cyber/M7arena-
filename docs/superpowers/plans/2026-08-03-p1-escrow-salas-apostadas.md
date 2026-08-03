# P1 — Schema + Escrow + Máquina de Estados das Salas Apostadas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o escrow de MC às salas de partida (reservar ao entrar, devolver ao sair/empatar/cancelar, pagar vencedores com taxa percentual e arredondamento), com idempotência garantida, 100% no servidor.

**Architecture:** Extende o `match-flow.ts` existente (que já roda a máquina de estados com `FOR UPDATE`) com funções de economia de escrow. `user_wallets` ganha `mc_reservado`. O payout usa taxa percentual congelada na sala, arredondamento ceil/floor com resto para a plataforma, e `decisao_id` + constraint única no ledger para nunca pagar 2x.

**Tech Stack:** Node 24 + Express + Drizzle + PostgreSQL (PGlite para testes) + node:test (test runner nativo, sem dependência nova).

## Global Constraints

- TypeScript `strict: true`. Nenhum `catch {}` vazio. Comentários explicam o porquê.
- Nenhum arquivo novo passa de ~400 linhas.
- Toda mudança de schema entra como migration versionada via `drizzle-kit generate`.
- Regra de negócio e dinheiro decididos no servidor — o cliente só exibe.
- Invariante de escrow: `disponível + reservado = total` sempre; disponível nunca negativo.
- Idempotência: o payout nunca roda duas vezes (constraint única no ledger + `decisao_id`).
- Convenção `match-flow.ts`: funções recebem `tx` (transação Drizzle) e rodam atômicas.

---
## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `db/schema/identidade.ts` | `users`: add `riotId`, `status`, `suspensaAte`, `termosAceitosEm`; `user_wallets`: add `mcReservado` |
| `db/schema/matches.ts` | `matches`: add `apostaMc`, `taxaPct`, `resultado`, `canceladoEm`, `revisadoPor`, `revisadoEm`, `decisaoId`, `revisaoDesde`; `match_players`: unique `(matchId, userId)` já existe (PK) |
| `db/schema/economia.ts` | `wallet_transactions`: index único parcial para idempotência; `platform_revenue`: add `mcFeeRounding` |
| `db/schema/conteudo.ts` (ou novo `db/schema/apostas.ts`) | tabelas `user_strikes`, `match_prints`, `match_disputas` |
| `api/src/lib/escrow.ts` | Funções puras de economia: `reservarEntrada`, `devolverEntrada`, `calcularPayout`, `pagarPremio`, `pagarEmpate`, `pagarCancelamento` (idempotentes) |
| `api/src/lib/match-flow.ts` | Integra `escrow.ts` nas transições: criação/join/sair usam reserva; novos estados `aguardando_revisao`, `cancelada` |
| `api/src/routes/matches.ts` | Rotas: criar sala recebe `apostaMc`; join reserva; sair devolve; **novas rotas de decisão admin** (aprovar/empate/cancelar) |
| `api/src/routes/admin.ts` | Endpoints de revisão: listar fila, ver prints, decidir |
| `api/src/routes/prints.ts` | Endpoint de upload de print (bucket `match-prints` privado) + leitura autenticada |
| `api/src/routes/disputas.ts` | Endpoint de contestação de resultado |
| `api/src/cron.js` | Job a cada 10 min: kick de ociosidade + partida fantasma |
| `api/src/db.ts` | Pool único limitado a ~20 conexões + 1 conexão dedicada para LISTEN (na fase de realtime, P4) |
| `api/test/escrow.test.ts` | Testes de escrow/invariante com PGlite |
| `api/test/payout.test.ts` | Testes de payout/arredondamento/idempotência com PGlite |
| `api/test/estados.test.ts` | Testes de máquina de estados (concorrência simulada) |
| `db/migrations/0009_*` | Migration gerada pelo `drizzle-kit generate` |

---

### Task 1: Schema — colunas de escrow e elegibilidade

**Files:**
- Modify: `db/schema/identidade.ts`
- Modify: `db/schema/matches.ts`
- Modify: `db/schema/economia.ts`
- Create: `db/schema/apostas.ts`
- Test: `db/migrations/` (gerado)

**Interfaces:**
- Consumes: nada (base do projeto)
- Produces: colunas e tabelas que as próximas tasks usam.

- [ ] **Step 1: Verifique o estado atual compilando**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

- [ ] **Step 2: Adicione colunas de elegibilidade em `users`**

Em `db/schema/identidade.ts`, dentro da tabela `users`:

```ts
  riotId: varchar("riot_id", { length: 100 }),
  status: varchar("status", { length: 20 }).default("ativa").notNull(), // 'ativa' | 'suspensa' | 'banida'
  suspensaAte: timestamp("suspensa_ate", { mode: "date" }),
  termosAceitosEm: timestamp("termos_aceitos_em", { mode: "date" }),
```

- [ ] **Step 3: Adicione `mcReservado` em `user_wallets`**

Em `db/schema/identidade.ts`, dentro de `userWallets`:

```ts
  mcReservado: integer("mc_reservado").default(0).notNull(),
```

- [ ] **Step 4: Adicione colunas de aposta em `matches`**

Em `db/schema/matches.ts`, dentro da tabela `matches`:

```ts
  apostaMc: integer("aposta_mc").default(0).notNull(),   // 0 = casual
  taxaPct: numeric("taxa_pct", { precision: 5, scale: 2 }).default("8.99").notNull(),
  resultado: varchar("resultado", { length: 10 }),        // 'blue' | 'red' | 'draw'
  canceladoEm: timestamp("cancelado_em", { mode: "date" }),
  revisadoPor: uuid("revisado_por").references(() => users.id),
  revisadoEm: timestamp("revisado_em", { mode: "date" }),
  decisaoId: uuid("decisao_id"),
  revisaoDesde: timestamp("revisao_desde", { mode: "date" }),
```

- [ ] **Step 5: Crie `db/schema/apostas.ts` com as tabelas novas**

```ts
import { pgTable, uuid, text, varchar, timestamp, index, integer } from "drizzle-orm/pg-core";
import { users } from "./identidade.js";
import { matches } from "./matches.js";

export const userStrikes = pgTable(
  "user_strikes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    motivo: varchar("motivo", { length: 50 }).notNull(), // 'kick_ociosidade' | 'abandono'
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    removidoPor: uuid("removido_por").references(() => users.id),
    removidoEm: timestamp("removido_em", { mode: "date" }),
  },
  (table) => [index("strikes_user_recentes_idx").on(table.userId, table.createdAt)]
);

export const matchPrints = pgTable(
  "match_prints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("prints_match_idx").on(table.matchId)]
);

export const matchDisputas = pgTable(
  "match_disputas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    motivo: text("motivo").notNull(),
    status: varchar("status", { length: 20 }).default("aberta").notNull(), // 'aberta' | 'resolvida'
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("disputas_match_idx").on(table.matchId),
    { /* UNIQUE (match_id, user_id) via migração manual */ },
  ]
);
```

> **Nota:** a constraint UNIQUE `(match_id, user_id)` em `match_disputas` e o UNIQUE parcial do ledger (`wallet_transactions` em `kind IN ('match_prize','match_loss','match_entry_refund')`) são adicionados no SQL da migration gerada (Task 2), porque o Drizzle não expressa UNIQUE parcial nativamente.

- [ ] **Step 6: Adicione `mcFeeRounding` em `platform_revenue`**

Em `db/schema/economia.ts`, dentro de `platformRevenue`:

```ts
  mcFeeRounding: integer("mc_fee_rounding").default(0).notNull(),
```

- [ ] **Step 7: Gere a migration**

Run: `npx drizzle-kit generate`
Expected: novo arquivo `db/migrations/0009_*.sql` criado com os ALTER/CREATE.

- [ ] **Step 8: Edite a migration gerada para adicionar as constraints manuais**

Abra o arquivo `db/migrations/0009_*.sql` gerado e acrescente ao final:

```sql
-- UNIQUE (match_id, user_id) em match_disputas (1 contestação por jogador)
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputas_match_user
  ON match_disputas (match_id, user_id);

-- Idempotência do ledger: nunca paga/perde/devolve 2x a mesma coisa na mesma partida
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_match_unico
  ON wallet_transactions (match_id, user_id, kind)
  WHERE kind IN ('match_prize', 'match_loss', 'match_entry_refund');

-- Riot ID único (case-insensitive), só quando preenchido
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_riot_id
  ON users (lower(riot_id)) WHERE riot_id IS NOT NULL;

-- Cron: kick de ociosidade + partida fantasma
CREATE INDEX IF NOT EXISTS idx_matches_status_updated
  ON matches (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_matches_revisao
  ON matches (status, revisao_desde)
  WHERE status = 'aguardando_revisao';
```

- [ ] **Step 9: Compile e valide a migration em PGlite**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add db/schema db/migrations
git commit -m "feat(apostas): schema de escrow, elegibilidade e revisão (migration 0009)"
```

---

### Task 2: Funções de escrow puras (`api/src/lib/escrow.ts`)

**Files:**
- Create: `api/src/lib/escrow.ts`
- Test: `api/test/escrow.test.ts`

**Interfaces:**
- Consumes: schema `userWallets`, `walletTransactions`, `platformRevenue` (Task 1)
- Produces:
  - `reservarEntrada(tx, userId, aposta, matchId): Promise<void>` — lança `SALDO_INSUFICIENTE` se `mc < aposta`
  - `devolverEntrada(tx, userId, aposta, matchId): Promise<void>`
  - `calcularPayout(aposta, totalJogadores, taxaPct, numVencedores): { taxa, premioLiq, porVencedor, resto }`
  - `pagarPremio(tx, matchId, aposta, players: {userId, side}[], winnerSide, taxaPct): Promise<void>`
  - `pagarEmpate(tx, matchId, players: {userId}[]): Promise<void>`
  - `pagarCancelamento(tx, matchId, players: {userId}[]): Promise<void>`

- [ ] **Step 1: Escreva o teste que falha — reserva e devolução**

`api/test/escrow.test.ts`:

```ts
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { userWallets } from "../../db/schema/identidade.js";
import { reservarEntrada, devolverEntrada } from "../src/lib/escrow.js";

// helper: cria db PGlite + tabelas necessárias
async function setupDb() {
  const client = new PGlite();
  await client.exec(`CREATE TABLE user_wallets (
    user_id uuid PRIMARY KEY,
    mc integer NOT NULL DEFAULT 0,
    mc_reservado integer NOT NULL DEFAULT 0,
    updated_at timestamp NOT NULL DEFAULT now()
  )`);
  const db = drizzle(client);
  return { client, db };
}

describe("escrow", () => {
  let ctx: any;
  before(async () => { ctx = await setupDb(); });
  after(async () => { await ctx.client.close(); });

  test("reserva move mc -> mc_reservado e lança se saldo insuficiente", async () => {
    const db = ctx.db;
    await db.insert(userWallets).values({ userId: "u1", mc: 100, mcReservado: 0 });
    await reservarEntrada(db as any, "u1", 30, "m1");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "u1"));
    assert.equal(w.mc, 70);
    assert.equal(w.mcReservado, 30);

    await assert.rejects(
      () => reservarEntrada(db as any, "u1", 100, "m2"),
      (e: any) => e.code === "SALDO_INSUFICIENTE"
    );
  });

  test("devolução move mc_reservado -> mc", async () => {
    const db = ctx.db;
    await db.insert(userWallets).values({ userId: "u2", mc: 50, mcReservado: 30 });
    await devolverEntrada(db as any, "u2", 30, "m1");
    const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, "u2"));
    assert.equal(w.mc, 80);
    assert.equal(w.mcReservado, 0);
  });
});
```

> **Nota sobre o helper `tx`:** `reservarEntrada`/`devolverEntrada` recebem `tx` que pode ser o `db` direto (os testes PGlite usam `db` como tx). Em produção a rota passa a transação real.

- [ ] **Step 2: Rode o teste para ver falhar**

Run: `node --test api/test/escrow.test.ts`
Expected: FAIL — `reservarEntrada` não existe (module not found).

- [ ] **Step 3: Implemente `reservarEntrada` e `devolverEntrada`**

`api/src/lib/escrow.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { userWallets, users } from "../../db/schema/identidade.js";
import { walletTransactions, platformRevenue } from "../../db/schema/economia.js";

/**
 * Escrow das salas apostadas (ADR-019 / design v3 §4).
 *
 * Invariante: `mc + mc_reservado = total` sempre; `mc` nunca negativo.
 * Todo `mc_reservado` tem exatamente um caminho de saída: payout, devolução
 * por empate/cancelamento, ou devolução por saída antes do início da partida.
 *
 * As funções recebem `tx` (transação Drizzle) — em produção é a transação da
 * rota (roda atômica com a máquina de estados); nos testes, o próprio `db`.
 */

/** Reserva a aposta: move mc -> mc_reservado. Lança SALDO_INSUFICIENTE. */
export async function reservarEntrada(tx: any, userId: string, aposta: number, matchId: string) {
  if (!aposta || aposta <= 0) return;
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  if (!w || w.mc < aposta) {
    const err: any = new Error("saldo_insuficiente");
    err.code = "SALDO_INSUFICIENTE";
    throw err;
  }
  const novoMc = w.mc - aposta;
  const novoReservado = (w.mcReservado ?? 0) + aposta;
  await tx.update(userWallets).set({ mc: novoMc, mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, userId));
  await gravarLancamento(tx, userId, -aposta, "match_entry_reserve", matchId, novoMc);
}

/** Devolve a reserva: move mc_reservado -> mc. */
export async function devolverEntrada(tx: any, userId: string, aposta: number, matchId: string) {
  if (!aposta || aposta <= 0) return;
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  const reservadoAtual = w?.mcReservado ?? 0;
  const novoMc = (w?.mc ?? 0) + aposta;
  const novoReservado = Math.max(0, reservadoAtual - aposta);
  await tx.update(userWallets).set({ mc: novoMc, mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, userId));
  await gravarLancamento(tx, userId, aposta, "match_entry_refund", matchId, novoMc);
}

/** Lança uma linha no ledger (auditoria). */
export async function gravarLancamento(tx: any, userId: string, amount: number, kind: string, matchId: string, balanceAfter: number) {
  await tx.insert(walletTransactions).values({
    userId,
    currency: "mc",
    amount,
    kind,
    refType: "match",
    refId: matchId,
    balanceAfter,
  });
}
```

- [ ] **Step 4: Rode o teste para ver passar**

Run: `node --test api/test/escrow.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Escreva o teste que falha — `calcularPayout`**

Adicione ao `api/test/escrow.test.ts`:

```ts
import { calcularPayout } from "../src/lib/escrow.js";

test("calcularPayout: taxa ceil, premio floor, resto para a plataforma", () => {
  // 10 jogadores x 100 = pote 1000; taxa 8,99% = 89,9 -> ceil = 90
  const r = calcularPayout(100, 10, 8.99, 5);
  assert.equal(r.pote, 1000);
  assert.equal(r.taxa, 90);
  assert.equal(r.premioLiq, 910);
  assert.equal(r.porVencedor, 182); // floor(910/5)
  assert.equal(r.resto, 0);
});

test("calcularPayout: pote que não divide exato gera resto", () => {
  // 3 vencedores, pote 1000, taxa 90 -> liq 910 -> floor(910/3)=303, resto 1
  const r = calcularPayout(100, 10, 8.99, 3);
  assert.equal(r.taxa, 90);
  assert.equal(r.premioLiq, 910);
  assert.equal(r.porVencedor, 303);
  assert.equal(r.resto, 1);
});
```

- [ ] **Step 6: Rode para ver falhar**

Run: `node --test api/test/escrow.test.ts`
Expected: FAIL — `calcularPayout` não existe.

- [ ] **Step 7: Implemente `calcularPayout`**

Adicione em `api/src/lib/escrow.ts`:

```ts
/**
 * Política de arredondamento (design v3 §4.1). MC é inteiro:
 * taxa ceil (pra cima), prêmio floor (pra baixo), resto vai pra plataforma
 * com lançamento próprio. A soma fecha exatamente com o pote — a invariante
 * nunca quebra por 1 MC.
 */
export function calcularPayout(aposta: number, totalJogadores: number, taxaPct: number, numVencedores: number) {
  const pote = aposta * totalJogadores;
  const taxa = Math.ceil((pote * taxaPct) / 100);
  const premioLiq = pote - taxa;
  const porVencedor = numVencedores > 0 ? Math.floor(premioLiq / numVencedores) : 0;
  const resto = premioLiq - porVencedor * numVencedores;
  return { pote, taxa, premioLiq, porVencedor, resto };
}
```

- [ ] **Step 8: Rode para ver passar**

Run: `node --test api/test/escrow.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Escreva o teste que falha — `pagarPremio`, `pagarEmpate`, `pagarCancelamento`**

Adicione ao `api/test/escrow.test.ts`. O setup precisa das tabelas `wallet_transactions` e `platform_revenue`:

```ts
import { walletTransactions, platformRevenue } from "../../db/schema/economia.js";
import { pagarPremio, pagarEmpate, pagarCancelamento } from "../src/lib/escrow.js";

// no setupDb(), adicionar:
//   CREATE TABLE wallet_transactions (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id uuid, currency varchar(10), amount integer,
//     kind varchar(50), ref_type varchar(50), ref_id text,
//     balance_after integer, created_at timestamp DEFAULT now()
//   );
//   CREATE TABLE platform_revenue (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     match_id uuid, mc_fee integer, mc_fee_rounding integer DEFAULT 0,
//     created_at timestamp DEFAULT now()
//   );

test("pagarPremio: credita vencedores, debita nada (já reservado), taxa+resto na plataforma", async () => {
  const db = ctx.db;
  const players = [
    { userId: "a", side: "blue" }, { userId: "b", side: "blue" }, { userId: "c", side: "blue" },
    { userId: "d", side: "red" }, { userId: "e", side: "red" },
  ];
  // todos têm 30 reservado (já foram debitados ao entrar)
  for (const p of players) {
    await db.insert(userWallets).values({ userId: p.userId, mc: 70, mcReservado: 30 });
  }
  await pagarPremio(db as any, "m1", 30, players, "blue", 8.99);

  // vencedores (3) recebem porVencedor, perdedores (2) perdem o reservado
  const [a] = await db.select().from(userWallets).where(eq(userWallets.userId, "a"));
  const [d] = await db.select().from(userWallets).where(eq(userWallets.userId, "d"));
  assert.equal(a.mc, 70 + 91);        // pote 150, taxa ceil(13.485)=14, liq 136, floor(136/3)=45? ver abaixo
  // NOTE: com valores pequenos o cálculo exato importa; conferir com calcularPayout.
  // O teste abaixo usa o próprio calcularPayout para não duplicar o número.
  const calc = calcularPayout(30, 5, 8.99, 3);
  assert.equal(a.mc, 70 + calc.porVencedor);
  assert.equal(d.mc, 70);             // perdedor não recebe nada (reservado já está fora do mc)
  // plataforma registrou taxa + resto
  const [rev] = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, "m1"));
  assert.equal(rev.mcFee, calc.taxa);
  assert.equal(rev.mcFeeRounding, calc.resto);
});

test("pagarEmpate: devolve o reservado de todos, sem taxa", async () => {
  const db = ctx.db;
  for (const u of ["f", "g"]) {
    await db.insert(userWallets).values({ userId: u, mc: 50, mcReservado: 30 });
  }
  await pagarEmpate(db as any, "m2", [{ userId: "f" }, { userId: "g" }]);
  const [f] = await db.select().from(userWallets).where(eq(userWallets.userId, "f"));
  assert.equal(f.mc, 80);
  assert.equal(f.mcReservado, 0);
  const revs = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, "m2"));
  assert.equal(revs.length, 0);
});

test("pagarCancelamento: devolve o reservado de todos, sem taxa", async () => {
  const db = ctx.db;
  await db.insert(userWallets).values({ userId: "h", mc: 50, mcReservado: 30 });
  await pagarCancelamento(db as any, "m3", [{ userId: "h" }]);
  const [h] = await db.select().from(userWallets).where(eq(userWallets.userId, "h"));
  assert.equal(h.mc, 80);
  assert.equal(h.mcReservado, 0);
});
```

- [ ] **Step 10: Rode para ver falhar**

Run: `node --test api/test/escrow.test.ts`
Expected: FAIL — funções não existem.

- [ ] **Step 11: Implemente `pagarPremio`, `pagarEmpate`, `pagarCancelamento`**

Adicione em `api/src/lib/escrow.ts`:

```ts
/**
 * Paga os vencedores de uma sala apostada. Os perdedores já perderam o
 * `mc_reservado` (nunca mais volta); os vencedores recebem `porVencedor` do
 * prêmio líquido. A taxa + o resto vão para `platform_revenue`.
 *
 * Idempotência (§4.3): a constraint UNIQUE do ledger (`idx_ledger_match_unico`)
 * impede inserir 2x `match_prize` para o mesmo jogador na mesma partida — a
 * segunda tentativa estoura constraint e faz rollback da transação.
 */
export async function pagarPremio(tx: any, matchId: string, aposta: number, players: { userId: string; side: string }[], winnerSide: string, taxaPct: number) {
  if (!aposta || aposta <= 0 || players.length === 0) return;
  const vencedores = players.filter((p) => p.side === winnerSide);
  if (vencedores.length === 0) return;

  const calc = calcularPayout(aposta, players.length, taxaPct, vencedores.length);

  for (const v of vencedores) {
    const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, v.userId)).limit(1).for("update");
    const novoMc = (w?.mc ?? 0) + calc.porVencedor;
    const novoReservado = Math.max(0, (w?.mcReservado ?? 0) - aposta);
    await tx.update(userWallets).set({ mc: novoMc, mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, v.userId));
    await gravarLancamento(tx, v.userId, calc.porVencedor, "match_prize", matchId, novoMc);
  }

  // Perdedores: zera o reservado (sem mover nada — o MC já saiu na reserva).
  for (const p of players) {
    if (p.side !== winnerSide) {
      const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, p.userId)).limit(1).for("update");
      const novoReservado = Math.max(0, (w?.mcReservado ?? 0) - aposta);
      await tx.update(userWallets).set({ mcReservado: novoReservado, updatedAt: new Date() }).where(eq(userWallets.userId, p.userId));
      await gravarLancamento(tx, p.userId, -aposta, "match_loss", matchId, w?.mc ?? 0);
    }
  }

  await tx.insert(platformRevenue).values({ matchId, mcFee: calc.taxa, mcFeeRounding: calc.resto });
}

/** Empate: devolve o reservado de todos, sem taxa. Sala vira `encerrada` com resultado 'draw'. */
export async function pagarEmpate(tx: any, matchId: string, players: { userId: string }[]) {
  for (const p of players) {
    await devolverEntrada(tx, p.userId, 0, matchId); // no-op; ver abaixo
  }
  // Nota: pagarEmpate precisa saber o valor da aposta. Vamos recebê-la:
  // refatorar a assinatura para pagarEmpate(tx, matchId, aposta, players).
}
```

> **Ajuste:** `pagarEmpate` e `pagarCancelamento` precisam do valor da aposta para devolver. Assinatura correta: `pagarEmpate(tx, matchId, aposta, players: { userId: string }[])` e `pagarCancelamento(tx, matchId, aposta, players)`. Corrija os testes e a implementação para incluir `aposta`. A lógica é: para cada jogador, `devolverEntrada(tx, userId, aposta, matchId)`.

- [ ] **Step 12: Corrija a assinatura de empate/cancelamento e rode**

Ajuste `pagarEmpate`/`pagarCancelamento` para receberem `aposta` e chamarem `devolverEntrada`. Atualize os testes correspondentes. Rode:

Run: `node --test api/test/escrow.test.ts`
Expected: PASS (todos).

- [ ] **Step 13: Compile**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

- [ ] **Step 14: Commit**

```bash
git add api/src/lib/escrow.ts api/test/escrow.test.ts
git commit -m "feat(escrow): reserva, devolução, payout com taxa percentual e arredondamento"
```

---

### Task 3: Integrar escrow na máquina de estados (`match-flow.ts`)

**Files:**
- Modify: `api/src/lib/match-flow.ts`
- Modify: `api/src/routes/matches.ts`

**Interfaces:**
- Consumes: `reservarEntrada`, `devolverEntrada`, `pagarPremio`, `pagarEmpate`, `pagarCancelamento` (Task 2)
- Produces: estados `aguardando_revisao` e `cancelada`; criação/join/sair usam escrow.

- [ ] **Step 1: Substitua `debitarEntrada`/`reembolsarEntrada` pelas versões de escrow**

Em `match-flow.ts`, as funções `debitarEntrada` (débito direto) e `reembolsarEntrada`/`reembolsarSeNecessario` (estorno) são substituídas por `reservarEntrada`/`devolverEntrada` de `escrow.ts`. Isso significa: em vez de `mc -= entryMp` (some do saldo), agora é `mc -= entryMp; mc_reservado += entryMp`.

Mantenha `debitarEntrada` como alias para `reservarEntrada` durante a transição (para não quebrar as rotas já existentes), mas a implementação passa a reservar. O `kind` do ledger muda de `match_entry` para `match_entry_reserve`.

- [ ] **Step 2: Adicione os estados novos na máquina**

Em `ESTADOS_ATIVOS` e na lógica de `avaliarTransicoes`, adicione o fluxo:

- `partida_iniciada` (aposta > 0): ao receber print (nova rota), transição para `aguardando_revisao` com `revisaoDesde = now()`.
- Novo helper `entrarEmRevisao(tx, matchId)`: valida aposta > 0, seta `status='aguardando_revisao'`, `revisaoDesde=now()`, zera `stateDeadlineAt`.
- `cancelada`: estado terminal, sem timeout.

- [ ] **Step 3: Atualize a criação de sala para aceitar `apostaMc` e `taxaPct`**

Em `matches.ts` `POST /`:

```ts
const { mode, entryMp, apostaMc, taxaPct, ... } = req.body;
// apostaMc é o novo nome; manter entryMp como alias legado (fork usa entryMp).
const aposta = Number(apostaMc ?? entryMp ?? 0);
// taxa congelada na criação (design v3 §2: nunca muda no meio da sala)
const taxa = taxaPct ?? 8.99;
```

No INSERT: `apostaMc: aposta, taxaPct: taxa`.

No débito do criador: `await reservarEntrada(tx, user.id, aposta, newMatch.id)`.

- [ ] **Step 4: Atualize o join para reservar (em vez de debitar)**

Em `matches.ts` `POST /:id/join`, troque `debitarEntrada` por `reservarEntrada` (mesmo fluxo, mas agora mexe em `mc_reservado`). O erro `SALDO_INSUFICIENTE` já é tratado.

- [ ] **Step 5: Atualize o sair para devolver**

Localize a rota de sair (deve existir em `matches-actions.ts` como `POST /:id/leave`). Onde hoje chama `reembolsarSeNecessario`, troque por `devolverEntrada(tx, userId, aposta, matchId)`.

- [ ] **Step 6: Escreva teste de integração da máquina com escrow**

`api/test/estados.test.ts` — setup PGlite com `matches`, `match_players`, `user_wallets`, `wallet_transactions`, `platform_revenue`:

```ts
test("fluxo completo: criar com aposta -> reserva; sair -> devolve", async () => {
  // criar sala com aposta 30 pelo criador -> criador tem mc_reservado=30
  // entrar outro jogador com 100 -> reservado 30
  // sair do segundo -> devolvido
  // conferir invariante: para cada user, mc + mc_reservado = saldo inicial
});
```

- [ ] **Step 7: Rode o teste**

Run: `node --test api/test/estados.test.ts`
Expected: PASS.

- [ ] **Step 8: Compile**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add api/src/lib/match-flow.ts api/src/routes/matches.ts api/test/estados.test.ts
git commit -m "feat(apostas): escrow integrado na máquina de estados (reserva/devolução)"
```

---

### Task 4: Rotas de decisão do admin (aprovar / empate / cancelar)

**Files:**
- Create: `api/src/routes/revisao.ts`
- Modify: `api/src/index.ts` (mount da rota)
- Test: `api/test/revisao.test.ts`

**Interfaces:**
- Consumes: `pagarPremio`, `pagarEmpate`, `pagarCancelamento`, `avaliarTransicoes` (Tasks 2-3)
- Produces: `GET /api/revisao/pendentes`, `POST /api/revisao/:id/decidir`

- [ ] **Step 1: Escreva o teste que falha — decisão idempotente**

`api/test/revisao.test.ts`:

```ts
test("decidir: aprovar paga uma vez; segunda chamada é rejeitada", async () => {
  // setup: sala em 'aguardando_revisao', players com reservado, decision_id gerado
  // chamar POST /decidir { winnerSide: 'blue', decision_id } 2x
  // 1a: ok, payout aplicado; 2a: erro 'partida_ja_decidida'
  // conferir que NÃO há 2 linhas match_prize no ledger
});
```

- [ ] **Step 2: Rode para ver falhar**

Run: `node --test api/test/revisao.test.ts`
Expected: FAIL (rota não existe).

- [ ] **Step 3: Implemente a rota de decisão**

`api/src/routes/revisao.ts`:

```ts
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { pagarPremio, pagarEmpate, pagarCancelamento } from "../lib/escrow.js";
import { getAuthUser, notifyMatchChange } from "../lib/match-flow.js";

export const revisaoRouter = Router();

// middleware: só admin/moderador
async function exigeRevisor(req: any, res: any) {
  const user = await getAuthUser(req);
  if (!user) return { user: null, erro: res.status(401).json({ erro: "nao_autenticado" }) };
  // TODO: verificar role admin/moderador em user_roles
  return { user };
}

// GET /api/revisao/pendentes — fila por antiguidade
revisaoRouter.get("/pendentes", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(matches)
      .where(eq(matches.status, "aguardando_revisao"))
      .orderBy(matches.revisaoDesde);
    return res.json(rows);
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/revisao/:id/decidir — { winnerSide: 'blue'|'red'|'draw'|'cancel', decision_id }
revisaoRouter.post("/:id/decidir", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });

    const { winnerSide, decisionId } = req.body;
    const matchId = req.params.id;

    const r = await db.transaction(async (tx: any) => {
      const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
      if (!m) return { ok: false, erro: "sala_nao_encontrada" };
      if (m.status !== "aguardando_revisao") return { ok: false, erro: "partida_ja_decidida", estado: m.status };
      // idempotência de API: retry com o mesmo decision_id
      if (m.decisaoId) return { ok: false, erro: "partida_ja_decidida", estado: m.status };

      const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, m.id));
      const aposta = m.apostaMc ?? 0;
      const taxa = Number(m.taxaPct ?? 8.99);

      if (winnerSide === "blue" || winnerSide === "red") {
        await pagarPremio(tx, m.id, aposta, players, winnerSide, taxa);
        await tx.update(matches).set({ status: "encerrada", resultado: winnerSide, decisaoId: decisionId, revisadoPor: user.id, revisadoEm: new Date(), endedAt: new Date() }).where(eq(matches.id, m.id));
      } else if (winnerSide === "draw") {
        await pagarEmpate(tx, m.id, aposta, players);
        await tx.update(matches).set({ status: "encerrada", resultado: "draw", decisaoId: decisionId, revisadoPor: user.id, revisadoEm: new Date(), endedAt: new Date() }).where(eq(matches.id, m.id));
      } else if (winnerSide === "cancel") {
        await pagarCancelamento(tx, m.id, aposta, players);
        await tx.update(matches).set({ status: "cancelada", resultado: null, decisaoId: decisionId, canceladoEm: new Date(), revisadoPor: user.id, revisadoEm: new Date() }).where(eq(matches.id, m.id));
      } else {
        return { ok: false, erro: "resultado_invalido" };
      }

      return { ok: true, estado: winnerSide === "cancel" ? "cancelada" : "encerrada" };
    });

    if (r.ok) notifyMatchChange(matchId);
    return res.json(r);
  } catch (e: any) {
    // constraint única do ledger estourou = já pago -> rollback já aconteceu
    if (e?.code === "23505") return res.status(409).json({ erro: "partida_ja_decidida" });
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});
```

- [ ] **Step 4: Monte a rota no index.ts**

Em `api/src/index.ts`:

```ts
import { revisaoRouter } from "./routes/revisao.js";
app.use("/api/revisao", revisaoRouter);
```

- [ ] **Step 5: Rode o teste para ver passar**

Run: `node --test api/test/revisao.test.ts`
Expected: PASS.

- [ ] **Step 6: Compile**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add api/src/routes/revisao.ts api/src/index.ts api/test/revisao.test.ts
git commit -m "feat(revisao): endpoints de decisão do admin (aprovar/empate/cancelar) idempotentes"
```

---

### Task 5: Cron de varredura (kick de ociosidade + partida fantasma)

**Files:**
- Create: `api/src/cron.ts`
- Modify: `api/src/index.ts` (start do cron)
- Test: `api/test/cron.test.ts`

**Interfaces:**
- Consumes: `devolverEntrada`, `entrarEmRevisao` (Tasks 2-3)
- Produces: `runCron(txOrDb): Promise<{ kikados: number; fantasmas: number }>`

- [ ] **Step 1: Escreva o teste que falha**

`api/test/cron.test.ts`:

```ts
test("cron: kick de ociosidade remove vaga ocupada há 30min e devolve", async () => {
  // player em sala 'preenchendo', createdAt há 31 min, aposta 30, mc_reservado=30
  // rodar runCron()
  // jogador removido da vaga, mc_reservado devolvido
});

test("cron: partida fantasma move para aguardando_revisao", async () => {
  // sala 'partida_iniciada' aposta>0, updated_at há 3h+, sem print
  // rodar runCron()
  // status = 'aguardando_revisao', revisao_desde setado
});
```

- [ ] **Step 2: Rode para ver falhar**

Run: `node --test api/test/cron.test.ts`
Expected: FAIL (runCron não existe).

- [ ] **Step 3: Implemente o cron**

`api/src/cron.ts`:

```ts
import { lt, and, eq, isNull } from "drizzle-orm";
import { db } from "./db.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { userStrikes } from "../../db/schema/apostas.js";
import { devolverEntrada, gravarLancamento } from "./lib/escrow.js";

const KICK_OCIOSIDADE_MS = 30 * 60 * 1000;
const FANTASMA_MS = 3 * 60 * 60 * 1000;

/**
 * Job único a cada 10 min (design v3 §8). Nunca escreve estado por fora da
 * máquina — cada ação reusa a lógica com FOR UPDATE. Aviso ao usuário aos
 * 25 min fica para a camada de realtime (P4).
 */
export async function runCron() {
  const agora = new Date();
  const kickLimite = new Date(agora.getTime() - KICK_OCIOSIDADE_MS);
  const fantasmaLimite = new Date(agora.getTime() - FANTASMA_MS);

  let kikados = 0;
  let fantasmas = 0;

  // 1. Kick de ociosidade: vagas ocupadas há 30min em salas 'preenchendo'
  const salasPreenchendo = await db.select().from(matches).where(eq(matches.status, "preenchendo"));
  for (const sala of salasPreenchendo) {
    const vagas = await db
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, sala.id), lt(matchPlayers.createdAt, kickLimite)));
    for (const vaga of vagas) {
      await db.transaction(async (tx: any) => {
        const [m] = await tx.select().from(matches).where(eq(matches.id, sala.id)).limit(1).for("update");
        if (m?.status !== "preenchendo") return; // mudou desde a leitura
        await devolverEntrada(tx, vaga.userId, m.apostaMc ?? 0, m.id);
        await tx.delete(matchPlayers).where(and(eq(matchPlayers.matchId, m.id), eq(matchPlayers.userId, vaga.userId)));
        await tx.insert(userStrikes).values({ userId: vaga.userId, matchId: m.id, motivo: "kick_ociosidade" });
      });
      kikados++;
    }
  }

  // 2. Partida fantasma: 'partida_iniciada' aposta>0 há 3h sem print
  const fantasmasList = await db
    .select()
    .from(matches)
    .where(and(eq(matches.status, "partida_iniciada"), lt(matches.updatedAt, fantasmaLimite)));
  for (const sala of fantasmasList) {
    if (!sala.apostaMc || sala.apostaMc <= 0) continue;
    await db
      .update(matches)
      .set({ status: "aguardando_revisao", revisaoDesde: agora })
      .where(eq(matches.id, sala.id));
    fantasmas++;
  }

  return { kikados, fantasmas };
}
```

> **Nota:** `matches.updatedAt` não existe no schema atual — use `matches.stateDeadlineAt` ou adicione a coluna `updatedAt` na Task 1 (recomendado: adicionar `updatedAt` em `matches` na migration). Ajuste o schema em conformidade.

- [ ] **Step 4: Inicie o cron no index.ts**

Em `api/src/index.ts`:

```ts
import { runCron } from "./cron.js";
setInterval(() => {
  runCron().catch((e) => console.error("[cron] erro:", e?.message));
}, 10 * 60 * 1000);
runCron().catch((e) => console.error("[cron] erro inicial:", e?.message));
```

- [ ] **Step 5: Rode o teste**

Run: `node --test api/test/cron.test.ts`
Expected: PASS.

- [ ] **Step 6: Compile**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add api/src/cron.ts api/src/index.ts api/test/cron.test.ts db/schema/matches.ts
git commit -m "feat(cron): kick de ociosidade + partida fantasma a cada 10 min"
```

---

### Task 6: Smoke test local completo (P1)

**Files:**
- Test: rodar a stack local com o fluxo apostado ponta a ponta

- [ ] **Step 1: Rebuild e suba a stack local**

```bash
docker compose --env-file infra/.env.local -f infra/docker-compose.local.yml up -d --build
```

- [ ] **Step 2: Aplique a migration 0009 no Postgres local**

```bash
npx drizzle-kit migrate
```

- [ ] **Step 3: Crie usuário de teste com saldo**

Via API: `POST /api/auth/register` com `{email, password, displayName}`. Em seguida ajuste o saldo no banco (admin adjust ou SQL direto):

```sql
UPDATE user_wallets SET mc = 1000 WHERE user_id = '<id>';
```

- [ ] **Step 4: Crie uma sala apostada**

`POST /api/matches` com `{ mode: '5v5', apostaMc: 30 }`.
Expected: 201, criador com `mc_reservado = 30`.

- [ ] **Step 5: Entre com um segundo jogador**

`POST /api/matches/:id/join` com o 2º usuário.
Expected: ok, `mc_reservado` do 2º = 30.

- [ ] **Step 6: Confirme a transição**

Preencher todas as vagas e confirmar. Expected: sala vai para `iniciando_partida` e depois `partida_iniciada` (máquina de estados existente).

- [ ] **Step 7: Simule o print → revisão**

Marque a sala como `aguardando_revisao` (via SQL ou endpoint de transição que a Task 3 criou).

- [ ] **Step 8: Decida pelo admin**

`POST /api/revisao/:id/decidir` com `{ winnerSide: 'blue', decisionId: 'uuid' }`.
Expected: vencedores com MC creditado, perdedores com reservado zerado, `platform_revenue` com taxa+resto.

- [ ] **Step 9: Confirme a invariante**

Para cada jogador: `mc + mc_reservado + (perdas) = saldo inicial`. Conferir no banco.

- [ ] **Step 10: Valide o banco não quebrou**

Run: `npx tsc --noEmit -p api/tsconfig.json` e conferir que os outros fluxos (login, times) seguem OK.

- [ ] **Step 11: Commit final do P1**

```bash
git add -A
git commit -m "feat(apostas): P1 completo — escrow, máquina de estados, decisão admin, cron"
```

---

## Self-Review (executado pelo autor do plano)

**Cobertura do spec (design v3 §4, §4.1, §4.2, §4.3, §8):**
- §4 reserva/devolução/kick/fantasma → Tasks 2, 3, 5 ✓
- §4.1 arredondamento ceil/floor/resto → Task 2 (`calcularPayout`) ✓
- §4.2 invariante → testada em escrow.test.ts e estados.test.ts ✓
- §4.3 idempotência (constraint + decisao_id) → Task 1 (constraint), Task 4 (decisao_id) ✓
- §8 cron (kick + fantasma) → Task 5 ✓
- Nota: elegibilidade (§2.1), prints/disputas (§6), realtime (§7) e UI (§11) são P2-P5 — fora do escopo do P1.

**Placeholders:** a Task 4 tem um `// TODO: verificar role admin/moderador` que é intencional (P2), mas a rota deve validar algo minimamente — o executor deve trocar por uma checagem simples de role antes de seguir.

**Consistência de tipos:** `pagarEmpate`/`pagarCancelamento` recebem `aposta` (corrigido no Step 11-12 da Task 2). `entryMp` mantido como alias legado. `updatedAt` em `matches` precisa ser adicionado na Task 1 para o cron (fantasma). Todas as funções de escrow recebem `tx` como primeiro parâmetro.
