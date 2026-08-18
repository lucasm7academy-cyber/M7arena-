# Reconciliação do handle Riot (cron 3 dias) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar automaticamente `game_accounts.handle` e o espelho `users.riot_id` com o nome atual do LoL (via PUUID) a cada 3 dias, sem tocar no front.

**Architecture:** Módulo novo `api/src/lib/reconciliar-handles.ts` no padrão DI de `verificar-partida.ts` (função testável que recebe `d` e opções injetáveis), varrendo todas as contas LoL vinculadas em lotes de 3 e atualizando apenas quando o Riot ID mudou. Disparado por `setInterval` próprio de 3 dias em `api/src/index.ts`, separado do `runCron` de 10min.

**Tech Stack:** TypeScript strict (ESM, imports com `.js`), Drizzle ORM, Node `node:test` + PGlite (`api/test/helpers.ts`), `riotRaw` já exportado de `api/src/routes/riot.ts`.

## Global Constraints

- Design 1:1 — **não tocar no front nem em `className`** (web/). Zero mudança no fork.
- Regra de negócio e segredo ficam no servidor; a chave Riot só vive em `api/src` (nunca no bundle).
- Nunca engolir erro: `catch {}` vazio é proibido; falha da Riot → `console.warn` + `erros++`, sem sobrescrever handle.
- Nenhum arquivo passa de ~400 linhas (módulo novo fica ~90).
- TypeScript `strict: true`. Imports ESM com extensão `.js`.
- Testes: `npx tsx --test api/test/<arquivo>.test.ts` (rodar da raiz do repo). Typecheck: `npx tsc --noEmit -p api/tsconfig.json`.
- Não commitar sem o usuário pedir.

---

### Task 1: Módulo `reconciliar-handles.ts` + testes

**Files:**
- Create: `api/src/lib/reconciliar-handles.ts`
- Test: `api/test/reconciliar-handles.test.ts`

**Interfaces:**
- Consumes: `db` (default de `api/src/db.js`), `gameAccounts` e `games` (`db/schema/games.js`), `users` (`db/schema/identidade.js`), `riotRaw` (`../routes/riot.js`).
- Produces: `runReconciliacaoHandles(d?: any, opts?: { buscarNome?: BuscarNomePorPuuid }) => Promise<{ total: number; atualizadas: number; erros: number }>` — consumido pela Task 2 e pelos testes.

- [ ] **Step 1: Escrever o teste que falha**

Criar `api/test/reconciliar-handles.test.ts`:

```ts
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/identidade.js";
import { gameAccounts, games } from "../../db/schema/games.js";
import { setupDb } from "./helpers.js";
import { runReconciliacaoHandles } from "../src/lib/reconciliar-handles.js";

async function criaConta(db: any, userId: string, puuid: string, handle: string) {
  await db.insert(users).values({ id: userId, email: userId + "@x.com", displayName: "Jogador" });
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(gameAccounts).values({ userId, gameId: "lol", externalId: puuid, handle, verified: true });
}

describe("runReconciliacaoHandles", () => {
  let ctx: any;
  before(async () => { ctx = await setupDb(); });
  after(async () => { await ctx.client.close(); });

  test("nome mudou na Riot → atualiza handle e espelho users.riot_id", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000001";
    await criaConta(db, u, "PUUID_REC_1", "CGM GUERRA#BR1");
    await db.update(users).set({ riotId: "CGM GUERRA#BR1" }).where(eq(users.id, u));

    const r = await runReconciliacaoHandles(db, {
      buscarNome: async (puuid) =>
        puuid === "PUUID_REC_1" ? { gameName: "GuerraNovo", tagLine: "BR1" } : null,
    });

    assert.equal(r.total, 1);
    assert.equal(r.atualizadas, 1);
    assert.equal(r.erros, 0);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "GuerraNovo#BR1");
    const [user] = await db.select().from(users).where(eq(users.id, u));
    assert.equal(user.riotId, "GuerraNovo#BR1");
  });

  test("nome igual → nenhuma escrita", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000002";
    await criaConta(db, u, "PUUID_REC_2", "MesmoNome#BR1");

    const r = await runReconciliacaoHandles(db, {
      buscarNome: async () => ({ gameName: "MesmoNome", tagLine: "BR1" }),
    });

    assert.equal(r.atualizadas, 0);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "MesmoNome#BR1");
  });

  test("Riot falha (null) → handle preservado e conta em erros", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000003";
    await criaConta(db, u, "PUUID_REC_3", "VelhoNome#BR1");

    const r = await runReconciliacaoHandles(db, { buscarNome: async () => null });

    assert.equal(r.erros, 1);
    assert.equal(r.atualizadas, 0);
    const [ga] = await db.select().from(gameAccounts).where(eq(gameAccounts.userId, u));
    assert.equal(ga.handle, "VelhoNome#BR1", "handle nunca deve ser zerado em falha");
  });

  test("contas de outro jogo são ignoradas", async () => {
    const db = ctx.db;
    const u = "aaaaaaa5-0000-0000-0000-000000000004";
    await db.insert(users).values({ id: u, email: u + "@x.com", displayName: "Jogador" });
    await db.insert(games).values({ id: "valorant", name: "Valorant" }).onConflictDoNothing();
    await db.insert(gameAccounts).values({ userId: u, gameId: "valorant", externalId: "VALO_1", handle: "x#x", verified: true });

    const r = await runReconciliacaoHandles(db, { buscarNome: async () => ({ gameName: "X", tagLine: "X" }) });

    assert.equal(r.total, 0, "só contas de lol entram no lote");
    assert.equal(r.atualizadas, 0);
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run (da raiz do repo): `npx tsx --test api/test/reconciliar-handles.test.ts`
Expected: FAIL com `Cannot find module '../src/lib/reconciliar-handles.js'`.

- [ ] **Step 3: Implementar o módulo**

Criar `api/src/lib/reconciliar-handles.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "../../../db/schema/identidade.js";
import { gameAccounts } from "../../../db/schema/games.js";
import { riotRaw } from "../routes/riot.js";

/**
 * Reconciliação do Riot ID (game_accounts.handle) — spec
 * 2026-08-17-reconciliar-handle-riot-design.md.
 *
 * O handle é um retrato gravado na hora do vínculo (profiles.ts /me/riot).
 * Quando o jogador renomeia no LoL o PUUID (externalId) continua o mesmo, então
 * a validação de partida passa mas o nome exibido no site fica velho. Este job
 * busca o nome atual por PUUID na Riot (fonte da verdade) e atualiza handle +
 * espelho users.riot_id quando mudou. Falha da Riot preserva o handle velho.
 */
export const RECONCILIACAO_CONCURRENCY = 3;

export type BuscarNomePorPuuid = (puuid: string) => Promise<{ gameName: string; tagLine: string } | null>;

/** Busca real na Riot (account v1 by puuid) com o cache de 10min do riotRaw. */
async function buscaNomeRiot(puuid: string): Promise<{ gameName: string; tagLine: string } | null> {
  const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;
  const data = await riotRaw(`handles:${puuid}`, url);
  if (!data?.gameName || !data?.tagLine) return null;
  return { gameName: data.gameName, tagLine: data.tagLine };
}

export async function runReconciliacaoHandles(
  d: any = db,
  opts: { buscarNome?: BuscarNomePorPuuid } = {}
): Promise<{ total: number; atualizadas: number; erros: number }> {
  const buscarNome = opts.buscarNome ?? buscaNomeRiot;

  const contas: any[] = await d
    .select()
    .from(gameAccounts)
    .where(and(eq(gameAccounts.gameId, "lol")));

  let atualizadas = 0;
  let erros = 0;

  for (let i = 0; i < contas.length; i += RECONCILIACAO_CONCURRENCY) {
    const fatia = contas.slice(i, i + RECONCILIACAO_CONCURRENCY);
    await Promise.all(
      fatia.map(async (conta: any) => {
        try {
          const nome = await buscarNome(conta.externalId);
          if (!nome) {
            erros++;
            console.warn(`[handles] falha ao buscar nome de ${conta.handle ?? conta.externalId}`);
            return;
          }
          const novo = `${nome.gameName}#${nome.tagLine}`;
          if (novo === conta.handle) return;
          await d
            .update(gameAccounts)
            .set({ handle: novo, syncedAt: new Date(), updatedAt: new Date() })
            .where(eq(gameAccounts.id, conta.id));
          await d
            .update(users)
            .set({ riotId: novo, updatedAt: new Date() })
            .where(eq(users.id, conta.userId));
          atualizadas++;
        } catch (error: any) {
          erros++;
          console.warn(`[handles] falha para ${conta.handle ?? conta.externalId}:`, error?.message || error);
        }
      })
    );
  }

  return { total: contas.length, atualizadas, erros };
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npx tsx --test api/test/reconciliar-handles.test.ts`
Expected: PASS — `pass 4, fail 0`.

- [ ] **Step 5: Typecheck da API**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0 (sem erro novo).

---

### Task 2: Disparo no `index.ts` (setInterval 3 dias)

**Files:**
- Modify: `api/src/index.ts:6` (import) e `api/src/index.ts:100-103` (timer)

**Interfaces:**
- Consumes: `runReconciliacaoHandles` exportada pela Task 1.
- Produces: n/a (rotina de boot do servidor).

- [ ] **Step 1: Adicionar o import**

Em `api/src/index.ts`, após `import { runCron } from "./cron.js";` (linha 6):

```ts
import { runReconciliacaoHandles } from "./lib/reconciliar-handles.js";
```

- [ ] **Step 2: Adicionar o timer de 3 dias**

Após o bloco `setInterval(...)`/`runCron()` do final (linhas 100-103), adicionar:

```ts
// Reconciliação do Riot ID (spec 2026-08-17): atualiza game_accounts.handle +
// users.riot_id com o nome atual do LoL a cada 3 dias. Timer próprio — o
// intervalo de 3 dias não cabe no runCron de 10min. 1 execução no boot para já
// resolver os handles stale assim que houver chave Riot válida (BLK-006).
const DIAS_MS = 3 * 24 * 60 * 60 * 1000;
setInterval(() => {
  runReconciliacaoHandles().catch((e) => console.error("[cron-handles] erro:", e?.message));
}, DIAS_MS);
runReconciliacaoHandles().catch((e) => console.error("[cron-handles] erro inicial:", e?.message));
```

- [ ] **Step 3: Typecheck da API**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

- [ ] **Step 4: Suíte completa de testes da API**

Run: `npx tsx --test "api/test/*.test.ts"`
Expected: `pass <N>, fail 0` (suíte existente + novo arquivo).

- [ ] **Step 5: Smoke de boot local**

Run: `cd api; npx tsx src/index.ts` (ou, se o compose local estiver de pé, subir o serviço `app`).
Expected: log `[m7arena-api] Servidor de API rodando na porta 3000` e, no boot, sem erro de módulo para `lib/reconciliar-handles.js`. Sem `RIOT_API_KEY` o job loga `[riot] RIOT_API_KEY não configurada` e sai inerte — comportamento esperado.
Observação: encerrar o processo após o smoke (Ctrl+C) para não segurar a porta.

---

## Self-Review

**1. Cobertura do spec:**
- Módulo novo `reconciliar-handles.ts` com DI → Task 1 ✓
- Varre todas as contas LoL vinculadas em lote de 3 → Task 1 Step 3 (loop + `RECONCILIACAO_CONCURRENCY`) ✓
- Atualiza `handle` + espelho `users.riot_id` quando mudou → Task 1 Step 3 (dois `update`) ✓
- Falha da Riot preserva handle e conta em `erros` → Task 1 Step 3 (`if (!nome)` + `catch`) ✓
- Timer separado de 3 dias + boot → Task 2 ✓
- Front intacto → nenhuma task toca `web/` ✓
- Testes PGlite + `riotRaw` mockado → Task 1 (DI `buscarNome` substitui o `riotRaw`) ✓

**2. Placeholder scan:** nenhum "TBD"/"TODO"; todos os steps têm código completo e comando exato.

**3. Consistência de tipos:** `runReconciliacaoHandles(d?, opts?) → { total, atualizadas, erros }` definida na Task 1 e consumida idêntica na Task 2 e nos testes. `BuscarNomePorPuuid` só aparece na Task 1.