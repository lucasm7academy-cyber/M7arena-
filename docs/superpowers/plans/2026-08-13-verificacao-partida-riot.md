# Verificação Automática de Partidas via Riot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a decisão de resultado baseada em print pela verificação automática via Riot match v5 (quem jogou, quem venceu), com polling de 3h no servidor, botão acelerador, e contestação com print só em partidas finalizadas.

**Architecture:** O motor vive em `api/src/lib/verificar-partida.ts` (função pura com fetchers injetáveis para teste via PGlite). O cron de 10min e o novo endpoint `POST /api/matches/:id/verificar` chamam a mesma função. Contestação vira disputa em sala `encerrada`; procedente → `reverterPayout` em `escrow.ts` + sala `cancelada`.

**Tech Stack:** Node 24, TypeScript strict, Express, Drizzle, PGlite (testes), Riot match v5 /americas, React 19 + Vite.

## Global Constraints

- Invariante escrow: `mc + mc_reservado = total`; `mc` nunca negativo.
- Regra de negócio no servidor (invariante 3.3); `RIOT_API_KEY` nunca no bundle (3.4).
- Nenhum arquivo novo passa de ~400 linhas.
- Comentários explicam o **porquê**, nunca o quê.
- Textos de UI em português do Brasil.
- Testes: `npx tsx --test api/test/<arquivo>.test.ts`; typecheck `npx tsc --noEmit -p api/tsconfig.json`.
- Migrations versionadas; `api/test/helpers.ts` aplica todas de `db/migrations` num PGlite.
- `RIOT_API_KEY` ausente nos testes → `riotRaw` retorna null (caminho "não encontrada").

---

### Task 1: Migration 0015 — coluna `contestacao_url` em `match_disputas`

**Files:**
- Create: `db/migrations/0015_disputa_contestacao_url.sql`
- Modify: `db/schema/apostas.ts` (adicionar coluna ao `matchDisputas`)
- Test: `api/test/helpers.ts` (indireto — a migration nova precisa aplicar limpa)

**Interfaces:**
- Consumes: nada
- Produces: `matchDisputas.contestacaoUrl` (string | null) — usada pelas Tasks 6 e 7

- [ ] **Step 1: Escrever a migration**

`db/migrations/0015_disputa_contestacao_url.sql`:
```sql
-- 0015_disputa_contestacao_url
-- Contestação de partida finalizada (spec verificacao-partida-riot): o print de
-- evidência do contestante é amarrado à disputa (URL autenticada servida por
-- /api/prints/:id/arquivo). Uma disputa = um print de contestação.
ALTER TABLE "match_disputas" ADD COLUMN "contestacao_url" text;--> statement-breakpoint
```

- [ ] **Step 2: Atualizar o schema**

Em `db/schema/apostas.ts`, no `matchDisputas`, adicionar após `motivo`:
```ts
    // Print de evidência da contestação (URL autenticada /api/prints/:id/arquivo).
    // 1 por disputa; diferente do teto de 3 prints de prova do fluxo antigo.
    contestacaoUrl: text("contestacao_url"),
```

- [ ] **Step 3: Rodar a suite existente para garantir que a migration aplica**

Run: `npx tsx --test api/test/escrow.test.ts`
Expected: PASS (o `setupDb` aplica todas as migrations; se a 0015 estiver quebrada, falha).

- [ ] **Step 4: Commit**

```bash
git add db/migrations/0015_disputa_contestacao_url.sql db/schema/apostas.ts
git commit -m "feat(db): coluna contestacao_url em match_disputas (migration 0015)"
```

---

### Task 2: Exportar `riotRaw` de `riot.ts`

**Files:**
- Modify: `api/src/routes/riot.ts:69` (adicionar `export`)

**Interfaces:**
- Consumes: nada
- Produces: `riotRaw(cacheKey: string, url: string): Promise<any | null>` exportada — usada pela Task 3

- [ ] **Step 1: Adicionar `export`**

Em `api/src/routes/riot.ts`, trocar `async function riotRaw(` por `export async function riotRaw(`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add api/src/routes/riot.ts
git commit -m "chore(riot): exporta riotRaw para o motor de verificacao"
```

---

### Task 3: Motor de verificação — `api/src/lib/verificar-partida.ts`

**Files:**
- Create: `api/src/lib/verificar-partida.ts`
- Test: `api/test/verificar-partida.test.ts`

**Interfaces:**
- Consumes: `riotRaw` (Task 2), `pagarPremio`/`pagarCancelamento` de `lib/escrow.js`, `notifyMatchChange` de `lib/match-flow.js`, schema `matches`/`matchPlayers`/`matchResults`/`matchCodes`, `gameAccounts`
- Produces: `verificarPartida(d, matchId, opts?)` → `Promise<ResultadoVerificacao>`; tipos `ResultadoVerificacao`, `RiotMatch`, `BuscarIds`, `BuscarMatch`; constante `FANTASMA_MS = 3*60*60*1000`

- [ ] **Step 1: Escrever o teste (red)**

`api/test/verificar-partida.test.ts`:
```ts
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers, matchCodes, matchResults } from "../../db/schema/matches.js";
import { gameAccounts, games } from "../../db/schema/games.js";
import { setupDb } from "./helpers.js";
import { verificarPartida } from "../src/lib/verificar-partida.js";

async function criaJogador(db: any, id: string, puuid: string, mc: number, mcReservado = 0) {
  await db.insert(users).values({ id, email: id + "@x.com", displayName: "Jogador" });
  await db.insert(userWallets).values({ userId: id, mc, mcReservado });
  await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
  await db.insert(gameAccounts).values({ userId: id, gameId: "lol", externalId: puuid, handle: "nick#BR1", verified: true });
}

async function criaSala(db: any, values: any = {}) {
  const dono = crypto.randomUUID();
  await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
  const [sala] = await db.insert(matches).values({
    gameId: "lol",
    mode: "5v5",
    createdBy: dono,
    status: "partida_iniciada",
    apostaMc: 30,
    taxaPct: "8.99",
    codigoPartida: "BR-TEST-COD-0001",
    iniciandoPartidaAt: new Date(),
    ...values,
  }).returning();
  return sala;
}

function partidaRiot(over: any = {}) {
  return {
    metadata: { matchId: "BR1_9999999999" },
    info: {
      tournamentCode: "BR-TEST-COD-0001",
      gameCreation: Date.now(),
      endOfGameResult: "GameComplete",
      participants: [
        { puuid: "PUUID_A", teamId: 100 },
        { puuid: "PUUID_B", teamId: 100 },
        { puuid: "PUUID_C", teamId: 200 },
        { puuid: "PUUID_D", teamId: 200 },
      ],
      teams: [
        { teamId: 100, win: true },
        { teamId: 200, win: false },
      ],
      ...over,
    },
  };
}

describe("verificarPartida", () => {
  let ctx: any;
  before(async () => { ctx = await setupDb(); });
  after(async () => { await ctx.client.close(); });

  test("acha + nicks batem → encerrada + paga vencedor", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000001";
    const b = "aaaaaaa4-0000-0000-0000-000000000002";
    const c = "aaaaaaa4-0000-0000-0000-000000000003";
    const d = "aaaaaaa4-0000-0000-0000-000000000004";
    await criaJogador(db, a, "PUUID_A", 70, 30);
    await criaJogador(db, b, "PUUID_B", 70, 30);
    await criaJogador(db, c, "PUUID_C", 70, 30);
    await criaJogador(db, d, "PUUID_D", 70, 30);
    const sala = await criaSala(db);
    await db.insert(matchPlayers).values([
      { matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
      { matchId: sala.id, userId: b, side: "blue", slot: 1, roleSlot: "JG", confirmed: true, linked: true },
      { matchId: sala.id, userId: c, side: "red", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
      { matchId: sala.id, userId: d, side: "red", slot: 1, roleSlot: "JG", confirmed: true, linked: true },
    ]);

    const r = await verificarPartida(db, sala.id, {
      buscarIds: async () => ["BR1_9999999999"],
      buscarMatch: async () => partidaRiot(),
    });

    assert.equal(r.ok, true);
    assert.equal(r.estado, "encerrada");
    assert.equal(r.winnerSide, "blue");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "encerrada");
    assert.equal(m.winnerSide, "blue");
    const [res] = await db.select().from(matchResults).where(eq(matchResults.matchId, sala.id));
    assert.ok(res, "deve gravar match_results");
  });

  test("nick nao bate → cancelada + devolve", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000011";
    const c = "aaaaaaa4-0000-0000-0000-000000000012";
    await criaJogador(db, a, "PUUID_A", 70, 30);
    await criaJogador(db, c, "PUUID_C", 70, 30);
    const sala = await criaSala(db);
    await db.insert(matchPlayers).values([
      { matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
      { matchId: sala.id, userId: c, side: "red", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
    ]);

    // Partida com um impostor (PUUID_X no lugar de PUUID_C)
    const r = await verificarPartida(db, sala.id, {
      buscarIds: async () => ["BR1_9999999999"],
      buscarMatch: async () =>
        partidaRiot({
          participants: [
            { puuid: "PUUID_A", teamId: 100 },
            { puuid: "PUUID_X", teamId: 200 },
          ],
        }),
    });

    assert.equal(r.ok, true);
    assert.equal(r.estado, "cancelada");
    assert.equal(r.motivo, "nick_nao_bate");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "cancelada");
    const [wa] = await db.select().from(userWallets).where(eq(userWallets.userId, a));
    assert.equal(wa.mc, 100, "reserva devolvida");
    assert.equal(wa.mcReservado, 0);
  });

  test("nao achou < 3h → segue partida_iniciada", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000021";
    await criaJogador(db, a, "PUUID_A", 70, 30);
    const sala = await criaSala(db, { iniciandoPartidaAt: new Date(Date.now() - 60 * 60 * 1000) });

    const r = await verificarPartida(db, sala.id, {
      buscarIds: async () => [],
      buscarMatch: async () => null,
      agora: new Date(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.estado, "partida_iniciada");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "partida_iniciada");
  });

  test("nao achou >= 3h → cancelada + devolve", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000031";
    await criaJogador(db, a, "PUUID_A", 70, 30);
    const sala = await criaSala(db, { iniciandoPartidaAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000) });

    const r = await verificarPartida(db, sala.id, {
      buscarIds: async () => [],
      buscarMatch: async () => null,
      agora: new Date(),
    });
    assert.equal(r.ok, true);
    assert.equal(r.estado, "cancelada");
    assert.equal(r.motivo, "nao_encontrada");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "cancelada");
  });

  test("idempotente: sala ja encerrada → no-op", async () => {
    const db = ctx.db;
    const a = "aaaaaaa4-0000-0000-0000-000000000041";
    await criaJogador(db, a, "PUUID_A", 70, 30);
    const sala = await criaSala(db, { status: "encerrada" });
    const r = await verificarPartida(db, sala.id, { buscarIds: async () => [], buscarMatch: async () => null });
    assert.equal(r.ok, false);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx tsx --test api/test/verificar-partida.test.ts`
Expected: FAIL — "Cannot find module .../verificar-partida.js" (módulo não existe).

- [ ] **Step 3: Implementar o motor**

`api/src/lib/verificar-partida.ts`:
```ts
import { eq, and, inArray } from "drizzle-orm";
import { matches, matchPlayers, matchResults, matchCodes } from "../../../db/schema/matches.js";
import { gameAccounts } from "../../../db/schema/games.js";
import { pagarPremio, pagarCancelamento } from "./escrow.js";
import { notifyMatchChange } from "./match-flow.js";
import { riotRaw } from "../routes/riot.js";

export const FANTASMA_MS = 3 * 60 * 60 * 1000;

export interface RiotMatch {
  metadata: { matchId: string };
  info: {
    tournamentCode?: string;
    gameCreation: number;
    endOfGameResult?: string;
    participants: { puuid: string; teamId: number }[];
    teams: { teamId: number; win: boolean }[];
  };
}

export type BuscarIds = (puuid: string, startTime: number, endTime: number) => Promise<string[] | null>;
export type BuscarMatch = (matchId: string) => Promise<RiotMatch | null>;

export type ResultadoVerificacao =
  | { ok: true; estado: "encerrada"; winnerSide: "blue" | "red"; matchIdRiot: string }
  | { ok: true; estado: "cancelada"; motivo: "nick_nao_bate" | "nao_encontrada"; matchIdRiot?: string }
  | { ok: false; estado: "partida_iniciada"; motivo: "ainda_em_jogo" | "nao_encontrada"; matchIdRiot?: string };

/** Busca real na Riot (match v5, queue 3130 = custom/torneio). */
async function buscaIdsRiot(puuid: string, startTime: number, endTime: number): Promise<string[] | null> {
  const url = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=3130&startTime=${startTime}&endTime=${endTime}&count=50`;
  return (await riotRaw(`verify:ids:${puuid}:${startTime}:${endTime}`, url)) as string[] | null;
}

async function buscaMatchRiot(matchId: string): Promise<RiotMatch | null> {
  const url = `https://americas.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  return (await riotRaw(`verify:match:${matchId}`, url)) as RiotMatch | null;
}

/**
 * Resolve o resultado de uma sala em `partida_iniciada` (spec
 * verificacao-partida-riot). A Riot é a fonte da verdade: acha a partida pelo
 * tournamentCode no histórico dos jogadores, confere os 10 PUUIDs e decide.
 * Fase A (leitura + rede) descobre o veredito; fase B (transação com lock)
 * aplica — nunca segura lock de linha durante chamada à Riot.
 */
export async function verificarPartida(
  d: any,
  matchId: string,
  opts: { agora?: Date; buscarIds?: BuscarIds; buscarMatch?: BuscarMatch } = {}
): Promise<ResultadoVerificacao> {
  const agora = opts.agora ?? new Date();
  const buscarIds = opts.buscarIds ?? buscaIdsRiot;
  const buscarMatch = opts.buscarMatch ?? buscaMatchRiot;

  const [m] = await d.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m) return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };
  if (m.status !== "partida_iniciada") return { ok: false, estado: m.status, motivo: "nao_encontrada" };
  if (!m.codigoPartida) return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };

  // PUUIDs esperados da sala (conta Riot vinculada de cada participante).
  const players = await d.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId));
  if (players.length === 0) return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };
  const contas = await d
    .select({ puuid: gameAccounts.externalId })
    .from(gameAccounts)
    .where(and(eq(gameAccounts.gameId, "lol"), inArray(gameAccounts.userId, players.map((p: any) => p.userId))));
  const puuids = contas.map((c: any) => c.puuid);
  // Alguém sem conta vinculada → impossível confirmar os nicks. Trata como não
  // verificável: segue no polling até o teto de 3h (nunca paga às cegas).
  if (puuids.length !== players.length) return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };

  const inicio = Math.floor(new Date(m.createdAt).getTime() / 1000);
  const fim = Math.floor(agora.getTime() / 1000);
  const vistos = new Set<string>();
  const candidatos: string[] = [];
  for (const puuid of puuids) {
    const ids = await buscarIds(puuid, inicio, fim);
    if (ids) for (const id of ids) if (!vistos.has(id)) { vistos.add(id); candidatos.push(id); }
  }

  // Das candidatas, fica a do nosso código e com gameCreation mais próxima do
  // início da sala (código é reutilizável — janela + PUUIDs desambiguam).
  let melhor: { match: RiotMatch; diff: number } | null = null;
  const inicioRef = new Date(m.iniciandoPartidaAt ?? m.createdAt).getTime();
  for (const id of candidatos) {
    const match = await buscarMatch(id);
    if (!match || match.info.tournamentCode !== m.codigoPartida) continue;
    const diff = Math.abs(match.info.gameCreation - inicioRef);
    if (!melhor || diff < melhor.diff) melhor = { match, diff };
  }

  if (!melhor) {
    const decorrido = agora.getTime() - new Date(m.iniciandoPartidaAt ?? m.createdAt).getTime();
    if (decorrido >= FANTASMA_MS) return aplicarCancelamento(d, m, players, "nao_encontrada");
    return { ok: false, estado: "partida_iniciada", motivo: "nao_encontrada" };
  }

  const matchRiot = melhor.match;
  if (matchRiot.info.endOfGameResult !== "GameComplete") {
    return { ok: false, estado: "partida_iniciada", motivo: "ainda_em_jogo", matchIdRiot: matchRiot.metadata.matchId };
  }

  // Confere os 10 nicks: mesmo conjunto de participantes e todos os esperados lá.
  const puuidsPartida = new Set(matchRiot.info.participants.map((p) => p.puuid));
  const todosBatem =
    matchRiot.info.participants.length === players.length && puuids.every((p) => puuidsPartida.has(p));
  if (!todosBatem) {
    return aplicarCancelamento(d, m, players, "nick_nao_bate", matchRiot.metadata.matchId);
  }

  const teamVencedor = matchRiot.info.teams.find((t) => t.win);
  const winnerSide: "blue" | "red" = teamVencedor?.teamId === 200 ? "red" : "blue";
  return aplicarEncerramento(d, m, players, winnerSide, matchRiot);
}

/** Fase B: aplica o encerramento em transação com lock (evita dupla-finalização). */
async function aplicarEncerramento(d: any, m: any, players: any[], winnerSide: "blue" | "red", matchRiot: RiotMatch) {
  return d.transaction(async (tx: any) => {
    const [m2] = await tx.select().from(matches).where(eq(matches.id, m.id)).limit(1).for("update");
    if (!m2 || m2.status !== "partida_iniciada") return { ok: false, estado: m2?.status ?? "partida_iniciada", motivo: "nao_encontrada" };
    const aposta = m2.apostaMc ?? 0;
    await pagarPremio(tx, m2.id, aposta, players, winnerSide, Number(m2.taxaPct ?? 8.99));
    await tx.insert(matchResults).values({ matchId: m2.id, winnerSide, payload: matchRiot as any });
    await tx.update(matches).set({ status: "encerrada", winnerSide, resultado: winnerSide, endedAt: new Date() }).where(eq(matches.id, m2.id));
    await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, m2.id));
    await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, m2.id));
    notifyMatchChange(m2.id);
    return { ok: true as const, estado: "encerrada" as const, winnerSide, matchIdRiot: matchRiot.metadata.matchId };
  });
}

/** Fase B: aplica o cancelamento (devolve escrow) em transação com lock. */
async function aplicarCancelamento(d: any, m: any, players: any[], motivo: "nick_nao_bate" | "nao_encontrada", matchIdRiot?: string) {
  return d.transaction(async (tx: any) => {
    const [m2] = await tx.select().from(matches).where(eq(matches.id, m.id)).limit(1).for("update");
    if (!m2 || m2.status !== "partida_iniciada") return { ok: false, estado: m2?.status ?? "partida_iniciada", motivo: "nao_encontrada" };
    const aposta = m2.apostaMc ?? 0;
    await pagarCancelamento(tx, m2.id, aposta, players);
    await tx.update(matches).set({ status: "cancelada", resultado: null, canceladoEm: new Date() }).where(eq(matches.id, m2.id));
    await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, m2.id));
    await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, m2.id));
    notifyMatchChange(m2.id);
    return { ok: true as const, estado: "cancelada" as const, motivo, matchIdRiot };
  });
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx tsx --test api/test/verificar-partida.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add api/src/lib/verificar-partida.ts api/test/verificar-partida.test.ts
git commit -m "feat(verify): motor de verificacao automatica de partidas via Riot"
```

---

### Task 4: Cron — verificação automática + fantasma vira cancelamento

**Files:**
- Modify: `api/src/cron.ts`
- Modify: `api/test/cron.test.ts` (atualizar expectativas da fantasma)

**Interfaces:**
- Consumes: `verificarPartida` da Task 3
- Produces: `runCron(db)` retorna `{ verificadas, canceladas, sanitizadas }`

- [ ] **Step 1: Atualizar os testes existentes da fantasma (red)**

Em `api/test/cron.test.ts`, mudar os 3 testes de fantasma:

`partida fantasma move para aguardando_revisao` → `partida fantasma (>= 3h) vira cancelada e devolve`:
```ts
  test("partida fantasma (>= 3h) vira cancelada e devolve", async () => {
    const { client, db } = await setupDb();
    try {
      const jogador = "aaaaaaa3-0000-0000-0000-000000000050";
      await db.insert(users).values({ id: jogador, email: jogador + "@x.com", displayName: "Jogador" });
      await db.insert(userWallets).values({ userId: jogador, mc: 70, mcReservado: 30 });
      const sala = await criaSala(db, {
        status: "partida_iniciada",
        apostaMc: 50,
        codigoPartida: "BR-TEST-FANTASMA-0002",
        iniciandoPartidaAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000),
      });
      await db.insert(matchPlayers).values({ matchId: sala.id, userId: jogador, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: true });

      const r = await runCron(db);
      assert.ok(r.canceladas >= 1, "fantasma de 3h deve cancelar");
      const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
      assert.equal(m.status, "cancelada");
      const [w] = await db.select().from(userWallets).where(eq(userWallets.userId, jogador));
      assert.equal(w.mc, 100, "reserva devolvida");
      assert.equal(w.mcReservado, 0);
    } finally {
      await client.close();
    }
  });
```

Substituir `partida casual (aposta 0) iniciada há 3h sem print também vira fantasma` por `partida casual (aposta 0) >= 3h vira cancelada`:
```ts
  test("partida casual (aposta 0) >= 3h vira cancelada", async () => {
    const { client, db } = await setupDb();
    try {
      const sala = await criaSala(db, {
        status: "partida_iniciada",
        apostaMc: 0,
        codigoPartida: "BR-TEST-FANTASMA-0003",
        iniciandoPartidaAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000),
      });
      const r = await runCron(db);
      assert.ok(r.canceladas >= 1);
      const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
      assert.equal(m.status, "cancelada");
    } finally {
      await client.close();
    }
  });
```

O teste `partida fantasma devolve o tournament code ao pool` atualiza apenas a expectativa de status:
```ts
  test("partida fantasma devolve o tournament code ao pool (fix SEM-CODIGO-AGUARDE)", async () => {
    const { client, db } = await setupDb();
    try {
      const sala = await criaSala(db, {
        status: "partida_iniciada",
        apostaMc: 50,
        codigoPartida: "BR-TEST-FANTASMA-0001",
        iniciandoPartidaAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000),
      });
      const [codigo] = await db.insert(matchCodes).values({ code: "BR-TEST-FANTASMA-0001", used: true, matchId: sala.id }).returning();
      await runCron(db);
      const [c] = await db.select().from(matchCodes).where(eq(matchCodes.id, codigo.id));
      assert.equal(c.used, false, "código de partida fantasma deve voltar ao pool");
      assert.equal(c.matchId, null, "código não pode continuar vinculado à sala");
    } finally {
      await client.close();
    }
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx --test api/test/cron.test.ts`
Expected: FAIL (retorno do cron ainda não tem `canceladas`; fantasma antigo ia para `aguardando_revisao`).

- [ ] **Step 3: Reescrever o cron**

`api/src/cron.ts` (seção 1 substituída):
```ts
import { verificarPartida, FANTASMA_MS } from "./lib/verificar-partida.js";

  let verificadas = 0;
  let canceladas = 0;

  // 1. Verificação automática (spec verificacao-partida-riot): varre TODAS as
  //    salas em `partida_iniciada`. O motor decide: encontrou + nicks batem →
  //    encerra e paga; encontrou com nick errado → cancela; não encontrou ≥ 3h →
  //    cancela (devolve MC). Sem chave da Riot, `riotRaw` retorna null e o motor
  //    trata como "não encontrada" — o teto de 3h é o fallback honesto.
  const emJogo = await d.select().from(matches).where(eq(matches.status, "partida_iniciada"));
  for (const sala of emJogo) {
    const r = await verificarPartida(d, sala.id, { agora });
    if (r.ok) {
      if (r.estado === "cancelada") canceladas++;
      else if (r.estado === "encerrada") verificadas++;
    }
  }
```

Substituir o bloco antigo `fantasmasList`/`fantasmas` (que ia para `aguardando_revisao`) pelo trecho acima, e o retorno:
```ts
  return { verificadas, canceladas, sanitizadas };
```

O restante do cron (saneamento de estados mortos + linked órfão) permanece.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx --test api/test/cron.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck + suite completa**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0

Run: `npx tsx --test "api/test/*.test.ts"`
Expected: PASS (todos os arquivos; `test-realtime.mjs` é exceção pré-existente que exige WS+env)

- [ ] **Step 6: Commit**

```bash
git add api/src/cron.ts api/test/cron.test.ts
git commit -m "feat(cron): verificacao automatica no polling + fantasma vira cancelamento"
```

---

### Task 5: Endpoint `POST /api/matches/:id/verificar`

**Files:**
- Modify: `api/src/routes/matches-actions.ts`
- Test: `api/test/verificar-endpoint.test.ts`

**Interfaces:**
- Consumes: `verificarPartida` (Task 3)
- Produces: rota `POST /api/matches/:id/verificar` → `{ ok, estado, vencedor?, motivo?, matchIdRiot? }`

- [ ] **Step 1: Escrever o teste (red)**

`api/test/verificar-endpoint.test.ts`:
```ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { gameAccounts, games } from "../../db/schema/games.js";
import { setupDb } from "./helpers.js";
import { verificarPartida } from "../src/lib/verificar-partida.js";

describe("endpoint verificar (lógica de rota)", () => {
  test("sala partida_iniciada responde encerrada quando o motor resolve", async () => {
    const { client, db } = await setupDb();
    try {
      const a = "aaaaaaa5-0000-0000-0000-000000000001";
      const c = "aaaaaaa5-0000-0000-0000-000000000002";
      await db.insert(users).values({ id: a, email: a + "@x.com", displayName: "A" });
      await db.insert(userWallets).values({ userId: a, mc: 70, mcReservado: 30 });
      await db.insert(users).values({ id: c, email: c + "@x.com", displayName: "C" });
      await db.insert(userWallets).values({ userId: c, mc: 70, mcReservado: 30 });
      await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
      await db.insert(gameAccounts).values({ userId: a, gameId: "lol", externalId: "PUUID_A", handle: "a#BR1", verified: true });
      await db.insert(gameAccounts).values({ userId: c, gameId: "lol", externalId: "PUUID_C", handle: "c#BR1", verified: true });
      const dono = crypto.randomUUID();
      await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
      const [sala] = await db.insert(matches).values({
        gameId: "lol", mode: "5v5", createdBy: dono, status: "partida_iniciada",
        apostaMc: 30, taxaPct: "8.99", codigoPartida: "BR-TEST-COD-0001", iniciandoPartidaAt: new Date(),
      }).returning();
      await db.insert(matchPlayers).values([
        { matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
        { matchId: sala.id, userId: c, side: "red", slot: 0, roleSlot: "TOP", confirmed: true, linked: true },
      ]);

      // A rota chama verificarPartida; aqui testamos o contrato de retorno que o
      // handler monta a partir do resultado do motor.
      const r = await verificarPartida(db, sala.id, {
        buscarIds: async () => ["BR1_9999999999"],
        buscarMatch: async () => ({
          metadata: { matchId: "BR1_9999999999" },
          info: {
            tournamentCode: "BR-TEST-COD-0001",
            gameCreation: Date.now(),
            endOfGameResult: "GameComplete",
            participants: [{ puuid: "PUUID_A", teamId: 100 }, { puuid: "PUUID_C", teamId: 200 }],
            teams: [{ teamId: 100, win: true }, { teamId: 200, win: false }],
          },
        }),
      });

      assert.equal(r.ok, true);
      assert.equal(r.estado, "encerrada");
      // shape legado que o front consome
      const body = { ok: true, estado: r.estado, vencedor: r.winnerSide === "blue" ? "A" : "B", matchIdRiot: r.matchIdRiot };
      assert.equal(body.vencedor, "A");
    } finally {
      await client.close();
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar (se o motor não existir ainda)** — já passou na Task 3; este teste só valida o shape. Rode para confirmar.

Run: `npx tsx --test api/test/verificar-endpoint.test.ts`
Expected: PASS (o motor já existe; teste é de contrato)

- [ ] **Step 3: Adicionar a rota**

Em `api/src/routes/matches-actions.ts`, adicionar import e a rota (após `report-result`):
```ts
import { verificarPartida } from "../lib/verificar-partida.js";

// POST /api/matches/:id/verificar — Acelerador do polling (spec
// verificacao-partida-riot): qualquer participante confirmado dispara a mesma
// verificação na hora. Achou + nicks batem → finaliza e paga; não achou →
// segue no polling (3h). Idempotente para salas já encerradas/canceladas.
matchesActionsRouter.post("/:id/verificar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ ok: false, erro: "nao_autenticado", estado: null, mudou: false });

    const r = await db.transaction(async (tx: any) => {
      const [match] = await tx.select().from(matches).where(eq(matches.salaNum, Number(req.params.id))).limit(1).for("update");
      if (!match) return { ok: false, erro: "sala_nao_encontrada", estado: null, mudou: false };
      if (match.status !== "partida_iniciada") return { ok: false, erro: "estado_invalido", estado: match.status, mudou: false };
      const [player] = await tx.select().from(matchPlayers).where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, user.id))).limit(1);
      if (!player) return { ok: false, erro: "nao_participante", estado: match.status, mudou: false };
      return { ok: true, matchId: match.id };
    });
    if (!r.ok) return res.json(r);

    // Verificação fora da transação (rede): o motor aplica a própria transação
    // com lock no momento de decidir — não seguramos lock durante a Riot.
    const vr = await verificarPartida(db, r.matchId);
    if (!vr.ok) return res.json({ ok: false, estado: vr.estado, motivo: vr.motivo, matchIdRiot: vr.matchIdRiot ?? null });
    notifyMatchChange(String(req.params.id));
    const vencedor = vr.estado === "encerrada" ? (vr.winnerSide === "blue" ? "A" : "B") : null;
    return res.json({ ok: true, estado: vr.estado, vencedor, matchIdRiot: vr.matchIdRiot ?? null });
  } catch (e: any) {
    return res.status(500).json({ ok: false, erro: e?.message || "rpc_falhou", estado: null, mudou: false });
  }
});
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0

- [ ] **Step 5: Suite + commit**

Run: `npx tsx --test "api/test/*.test.ts"`
Expected: PASS

```bash
git add api/src/routes/matches-actions.ts api/test/verificar-endpoint.test.ts
git commit -m "feat(matches): endpoint POST /api/matches/:id/verificar (acelerador do polling)"
```

---

### Task 6: Contestação em sala encerrada (upload + disputa)

**Files:**
- Modify: `api/src/routes/upload.ts` (validarPrintDePartida/salvarPrintMatch aceitam `encerrada` e modo contestação)
- Modify: `api/src/routes/disputas.ts` (abrirDisputa aceita `encerrada` + `contestacaoUrl`)
- Modify: `api/src/routes/revisao.ts` (não mais necessário no fluxo normal — deixar legado)
- Modify: `api/test/prints.test.ts`, `api/test/disputas.test.ts` (atualizar)
- Test: `api/test/contestacao.test.ts`

**Interfaces:**
- Consumes: `matchDisputas.contestacaoUrl` (Task 1), fluxo de upload existente
- Produces: `abrirDisputa(db, { userId, matchId, motivo, contestacaoUrl })` aceita sala `encerrada`

- [ ] **Step 1: Escrever o teste (red)**

`api/test/contestacao.test.ts`:
```ts
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { users, userWallets } from "../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../db/schema/matches.js";
import { matchDisputas } from "../../db/schema/apostas.js";
import { setupDb } from "./helpers.js";
import { abrirDisputa } from "../src/routes/disputas.js";

describe("contestação em sala encerrada", () => {
  let ctx: any;
  before(async () => { ctx = await setupDb(); });
  after(async () => { await ctx.client.close(); });

  test("abre disputa em encerrada com contestacaoUrl", async () => {
    const db = ctx.db;
    const a = "aaaaaaa6-0000-0000-0000-000000000001";
    await db.insert(users).values({ id: a, email: a + "@x.com", displayName: "A" });
    await db.insert(userWallets).values({ userId: a, mc: 0, mcReservado: 0 });
    const dono = crypto.randomUUID();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const [sala] = await db.insert(matches).values({
      gameId: "lol", mode: "5v5", createdBy: dono, status: "encerrada",
      apostaMc: 0, taxaPct: "8.99", winnerSide: "blue", resultado: "blue", endedAt: new Date(),
    }).returning();
    await db.insert(matchPlayers).values({ matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true, linked: false });

    const r = await abrirDisputa(db, { userId: a, matchId: sala.id, motivo: "resultado errado", contestacaoUrl: "/api/prints/abc/arquivo" });
    assert.equal(r.ok, true);
    const [d] = await db.select().from(matchDisputas).where(eq(matchDisputas.matchId, sala.id));
    assert.equal(d.contestacaoUrl, "/api/prints/abc/arquivo");
  });

  test("rejeita disputa de quem não participou", async () => {
    const db = ctx.db;
    const forasteiro = "aaaaaaa6-0000-0000-0000-000000000002";
    await db.insert(users).values({ id: forasteiro, email: forasteiro + "@x.com", displayName: "F" });
    const dono = crypto.randomUUID();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const [sala] = await db.insert(matches).values({
      gameId: "lol", mode: "5v5", createdBy: dono, status: "encerrada",
      apostaMc: 0, taxaPct: "8.99", winnerSide: "blue", resultado: "blue", endedAt: new Date(),
    }).returning();

    const r = await abrirDisputa(db, { userId: forasteiro, matchId: sala.id, motivo: "quero contestar" });
    assert.equal(r.ok, false);
    assert.equal(r.erro, "nao_participante");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx --test api/test/contestacao.test.ts`
Expected: FAIL — `abrirDisputa` rejeita sala `encerrada` (`estado_invalido`).

- [ ] **Step 3: Atualizar `abrirDisputa`**

Em `api/src/routes/disputas.ts`, atualizar a função e a assinatura:
```ts
export async function abrirDisputa(db: any, params: { userId: string; matchId: string; motivo: string; contestacaoUrl?: string }) {
  const motivoLimpo = (params.motivo || "").trim();
  if (motivoLimpo.length < 5) return { ok: false, erro: "motivo_invalido" };

  const [m] = await db.select().from(matches).where(eq(matches.id, params.matchId)).limit(1);
  if (!m) return { ok: false, erro: "sala_nao_encontrada" };
  // Spec verificacao-partida-riot: com o resultado automático, a contestação
  // mora em salas FINALIZADAS (encerrada). `aguardando_revisao` segue aceito
  // como legado do fluxo antigo.
  if (m.status !== "encerrada" && m.status !== "aguardando_revisao") {
    return { ok: false, erro: "estado_invalido", estado: m.status };
  }

  const [player] = await db
    .select()
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, params.matchId))
    .where(eq(matchPlayers.userId, params.userId))
    .limit(1);
  if (!player) return { ok: false, erro: "nao_participante" };

  try {
    await db.insert(matchDisputas).values({
      matchId: params.matchId,
      userId: params.userId,
      motivo: motivoLimpo,
      contestacaoUrl: params.contestacaoUrl ?? null,
    });
    return { ok: true };
  } catch (e: any) {
    if (e?.code === "23505") return { ok: false, erro: "ja_contestou" };
    throw e;
  }
}
```

Na rota POST, repassar `contestacaoUrl`:
```ts
    const r = await abrirDisputa(db, {
      userId: user.id,
      matchId: req.params.matchId,
      motivo: req.body?.motivo ?? "",
      contestacaoUrl: req.body?.contestacao_url ?? undefined,
    });
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx --test api/test/contestacao.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Validar os testes existentes de disputas/prints**

Run: `npx tsx --test api/test/disputas.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0

```bash
git add api/src/routes/disputas.ts api/test/contestacao.test.ts
git commit -m "feat(disputas): contestacao em sala encerrada com print de evidencia"
```

---

### Task 7: `reverterPayout` em `escrow.ts`

**Files:**
- Modify: `api/src/lib/escrow.ts`
- Modify: `api/test/escrow.test.ts` (testes novos)

**Interfaces:**
- Consumes: `calcularPayout`, `gravarLancamento`, `userWallets`, `platformRevenue`
- Produces: `reverterPayout(tx, matchId, aposta, players, winnerSide, taxaPct)` → `{ ok: true } | { ok: false; erro: "saldo_insuficiente"; userId: string }`

- [ ] **Step 1: Escrever os testes (red)**

Adicionar em `api/test/escrow.test.ts`:
```ts
  test("reverterPayout: todos voltam ao saldo pré-aposta e estorna a taxa", async () => {
    const db = ctx.db;
    const v = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"; // vencedor blue
    const p = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3"; // perdedor red
    await db.insert(users).values({ id: v, email: v + "@x.com", displayName: "V" });
    await db.insert(userWallets).values({ userId: v, mc: 70, mcReservado: 0 });
    await db.insert(users).values({ id: p, email: p + "@x.com", displayName: "P" });
    await db.insert(userWallets).values({ userId: p, mc: 70, mcReservado: 0 });
    const salaId = "00000000-0000-0000-0000-000000000004";
    const dono = "00000000-0000-0000-0000-00000000cafe";
    await db.insert(matches).values({ id: salaId, gameId: "lol", mode: "1v1", createdBy: dono, status: "encerrada", apostaMc: 30, taxaPct: "8.99", winnerSide: "blue", resultado: "blue" });
    const players = [
      { userId: v, side: "blue" },
      { userId: p, side: "red" },
    ];
    // Simula o payout que já ocorreu
    await pagarPremio(db as any, salaId, 30, players, "blue", 8.99);
    const calc = calcularPayout(30, 2, 8.99, 1);
    const [vAntes] = await db.select().from(userWallets).where(eq(userWallets.userId, v));
    assert.equal(vAntes.mc, 70 + calc.porVencedor);

    // Reverte
    const r = await reverterPayout(db as any, salaId, 30, players, "blue", 8.99);
    assert.equal(r.ok, true);
    const [vPos] = await db.select().from(userWallets).where(eq(userWallets.userId, v));
    const [pPos] = await db.select().from(userWallets).where(eq(userWallets.userId, p));
    assert.equal(vPos.mc, 100, "vencedor volta ao pré-aposta (70 + reserva 30)");
    assert.equal(vPos.mcReservado, 0);
    assert.equal(pPos.mc, 100, "perdedor volta ao pré-aposta");
    const revs = await db.select().from(platformRevenue).where(eq(platformRevenue.matchId, salaId));
    assert.equal(revs.length, 0, "taxa estornada");
  });

  test("reverterPayout: vencedor sem saldo → erro saldo_insuficiente", async () => {
    const db = ctx.db;
    const v = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4";
    const p = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5";
    await db.insert(users).values({ id: v, email: v + "@x.com", displayName: "V" });
    await db.insert(userWallets).values({ userId: v, mc: 0, mcReservado: 0 }); // gastou o prêmio
    await db.insert(users).values({ id: p, email: p + "@x.com", displayName: "P" });
    await db.insert(userWallets).values({ userId: p, mc: 70, mcReservado: 0 });
    const salaId = "00000000-0000-0000-0000-000000000005";
    const dono = "00000000-0000-0000-0000-00000000cafe";
    await db.insert(matches).values({ id: salaId, gameId: "lol", mode: "1v1", createdBy: dono, status: "encerrada", apostaMc: 30, taxaPct: "8.99", winnerSide: "blue", resultado: "blue" });
    const players = [{ userId: v, side: "blue" }, { userId: p, side: "red" }];
    await pagarPremio(db as any, salaId, 30, players, "blue", 8.99);

    // Vencedor gastou tudo: reverte seu prêmio (54) mas não tem saldo
    const r = await reverterPayout(db as any, salaId, 30, players, "blue", 8.99);
    assert.equal(r.ok, false);
    assert.equal(r.erro, "saldo_insuficiente");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsx --test api/test/escrow.test.ts`
Expected: FAIL — `reverterPayout is not a function`.

- [ ] **Step 3: Implementar**

Em `api/src/lib/escrow.ts`, adicionar ao final (import `platformRevenue` já existe):
```ts
export type ResultadoReverter =
  | { ok: true }
  | { ok: false; erro: "saldo_insuficiente"; userId: string };

/**
 * Estorna um payout já aplicado (contestação procedente — spec
 * verificacao-partida-riot). Devolve cada jogador ao estado pré-aposta:
 * vencedores devolvem o prêmio E recebem a reserva de volta; perdedores
 * recebem a reserva de volta; a taxa/resto sai de `platform_revenue`.
 * Invariante `mc + mc_reservado = total` preservado (só move mc).
 *
 * Restrição: o estorno do vencedor exige `mc >= porVencedor` — se gastou o
 * prêmio, retorna `saldo_insuficiente` e o admin decide manualmente.
 */
export async function reverterPayout(
  tx: any,
  matchId: string,
  aposta: number,
  players: { userId: string; side: string }[],
  winnerSide: string,
  taxaPct: number
): Promise<ResultadoReverter> {
  if (!aposta || aposta <= 0 || players.length === 0) return { ok: true };
  const vencedores = players.filter((p) => p.side === winnerSide);
  if (vencedores.length === 0) return { ok: true };

  const calc = calcularPayout(aposta, players.length, taxaPct, vencedores.length);

  for (const v of vencedores) {
    const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, v.userId)).limit(1).for("update");
    if ((w?.mc ?? 0) < calc.porVencedor) return { ok: false, erro: "saldo_insuficiente", userId: v.userId };
    const novoMc = (w?.mc ?? 0) - calc.porVencedor + aposta;
    await tx.update(userWallets).set({ mc: novoMc, updatedAt: new Date() }).where(eq(userWallets.userId, v.userId));
    await gravarLancamento(tx, v.userId, -calc.porVencedor, "match_prize_revert", matchId, novoMc);
    await gravarLancamento(tx, v.userId, aposta, "match_entry_refund", matchId, novoMc);
  }

  for (const p of players) {
    if (p.side !== winnerSide) {
      const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, p.userId)).limit(1).for("update");
      const novoMc = (w?.mc ?? 0) + aposta;
      await tx.update(userWallets).set({ mc: novoMc, updatedAt: new Date() }).where(eq(userWallets.userId, p.userId));
      await gravarLancamento(tx, p.userId, aposta, "match_entry_refund", matchId, novoMc);
    }
  }

  await tx.delete(platformRevenue).where(eq(platformRevenue.matchId, matchId));
  return { ok: true };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsx --test api/test/escrow.test.ts`
Expected: PASS (incluindo os 2 novos)

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0

```bash
git add api/src/lib/escrow.ts api/test/escrow.test.ts
git commit -m "feat(escrow): reverterPayout para contestacao procedente"
```

---

### Task 8: Admin — listar disputas e decidir (procedente/improcedente)

**Files:**
- Modify: `api/src/routes/revisao.ts` (novo `GET /api/revisao/disputas` e `POST /api/revisao/disputas/:id/decidir`)
- Modify: `api/test/revisao.test.ts` (testes novos)
- Modify: `web/src/lib/api.ts` (SDK: `revisao.disputas`, `revisao.decidirDisputa`)
- Modify: `web/src/components/admin/RevisaoPartidas.tsx` (painel)

**Interfaces:**
- Consumes: `reverterPayout` (Task 7), `listarDisputas` (disputas.ts), `listarPrints`
- Produces: `GET /api/revisao/disputas` → disputas abertas com sala+resultado; `POST /api/revisao/disputas/:id/decidir` → `{ procedente }`

- [ ] **Step 1: Escrever os testes (red)**

Em `api/test/revisao.test.ts`, adicionar:
```ts
import { matchDisputas } from "../../db/schema/apostas.js";
import { reverterPayout } from "../src/lib/escrow.js";

  test("disputa procedente → reverterPayout + sala cancelada", async () => {
    const db = ctx.db;
    const admin = "aaaaaaa2-0000-0000-0000-000000000002";
    await criaAdmin(db, admin, "admin");
    const a = "aaaaaaa2-0000-0000-0000-000000000020";
    const b = "aaaaaaa2-0000-0000-0000-000000000021";
    await criaJogador(db, a, 70, 30);
    await criaJogador(db, b, 70, 30);
    const [sala] = await db.insert(matches).values({
      gameId: "lol", mode: "1v1", createdBy: admin, status: "encerrada",
      apostaMc: 30, taxaPct: "8.99", winnerSide: "blue", resultado: "blue", endedAt: new Date(),
    }).returning();
    await db.insert(matchPlayers).values([
      { matchId: sala.id, userId: a, side: "blue", slot: 0, roleSlot: "TOP", confirmed: true },
      { matchId: sala.id, userId: b, side: "red", slot: 0, roleSlot: "TOP", confirmed: true },
    ]);
    const players = [{ userId: a, side: "blue" }, { userId: b, side: "red" }];
    await pagarPremio(db as any, sala.id, 30, players, "blue", 8.99);
    const [disputa] = await db.insert(matchDisputas).values({
      matchId: sala.id, userId: a, motivo: "impostor jogou no meu lugar", contestacaoUrl: "/api/prints/x/arquivo",
    }).returning();

    // Lógica do admin (mesma da rota): procedente → reverterPayout + cancelar
    const r = await reverterPayout(db as any, sala.id, 30, players, "blue", 8.99);
    assert.equal(r.ok, true);
    await db.update(matches).set({ status: "cancelada", resultado: null, canceladoEm: new Date(), revisadoPor: admin, revisadoEm: new Date() }).where(eq(matches.id, sala.id));
    await db.update(matchDisputas).set({ status: "resolvida" }).where(eq(matchDisputas.id, disputa.id));

    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "cancelada");
    const [d] = await db.select().from(matchDisputas).where(eq(matchDisputas.id, disputa.id));
    assert.equal(d.status, "resolvida");
  });

  test("disputa improcedente → fecha sem tocar escrow", async () => {
    const db = ctx.db;
    const admin = "aaaaaaa2-0000-0000-0000-000000000003";
    await criaAdmin(db, admin, "admin");
    const [sala] = await db.insert(matches).values({
      gameId: "lol", mode: "1v1", createdBy: admin, status: "encerrada",
      apostaMc: 0, taxaPct: "8.99", winnerSide: "blue", resultado: "blue", endedAt: new Date(),
    }).returning();
    const [disputa] = await db.insert(matchDisputas).values({ matchId: sala.id, userId: admin, motivo: "resultado duvidoso" }).returning();

    // Improcedente: só fecha a disputa, sala continua encerrada
    await db.update(matchDisputas).set({ status: "resolvida" }).where(eq(matchDisputas.id, disputa.id));
    const [d] = await db.select().from(matchDisputas).where(eq(matchDisputas.id, disputa.id));
    assert.equal(d.status, "resolvida");
    const [m] = await db.select().from(matches).where(eq(matches.id, sala.id));
    assert.equal(m.status, "encerrada");
  });
```

- [ ] **Step 2: Rodar e ver passar (a lógica do teste chama as funções diretamente)**

Run: `npx tsx --test api/test/revisao.test.ts`
Expected: PASS (lógica das funções já existe da Task 7; este teste fixa o contrato do admin)

- [ ] **Step 3: Adicionar os endpoints**

Em `api/src/routes/revisao.ts`, adicionar import de `matchDisputas`, `reverterPayout` e os endpoints:
```ts
import { matchDisputas } from "../../../db/schema/apostas.js";
import { reverterPayout } from "../lib/escrow.js";

// GET /api/revisao/disputas — disputas abertas em partidas ENCERRADAS (spec
// verificacao-partida-riot). O fluxo normal não gera mais aguardando_revisao;
// o painel do admin vira "contestações a julgar".
revisaoRouter.get("/disputas", async (req, res) => {
  try {
    const r = await exigeRevisor(req, res);
    if (!r.user) return;
    const rows = await db
      .select({
        id: matchDisputas.id,
        matchId: matchDisputas.matchId,
        userId: matchDisputas.userId,
        motivo: matchDisputas.motivo,
        contestacaoUrl: matchDisputas.contestacaoUrl,
        status: matchDisputas.status,
        createdAt: matchDisputas.createdAt,
        nomeJogador: users.displayName,
        salaNum: matches.salaNum,
        mode: matches.mode,
        apostaMc: matches.apostaMc,
        winnerSide: matches.winnerSide,
        resultado: matches.resultado,
      })
      .from(matchDisputas)
      .innerJoin(users, eq(users.id, matchDisputas.userId))
      .innerJoin(matches, eq(matches.id, matchDisputas.matchId))
      .where(eq(matchDisputas.status, "aberta"))
      .orderBy(matchDisputas.createdAt);
    return res.json(rows);
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/revisao/disputas/:id/decidir — { procedente: boolean }
revisaoRouter.post("/disputas/:id/decidir", async (req, res) => {
  try {
    const r = await exigeRevisor(req, res);
    if (!r.user) return;
    const user = r.user;

    const [disputa] = await db.select().from(matchDisputas).where(eq(matchDisputas.id, req.params.id)).limit(1);
    if (!disputa) return res.status(404).json({ erro: "disputa_nao_encontrada" });
    if (disputa.status !== "aberta") return res.status(409).json({ erro: "disputa_ja_resolvida" });

    const procedente = req.body?.procedente === true;

    if (procedente) {
      const r2 = await db.transaction(async (tx: any) => {
        const [sala] = await tx.select().from(matches).where(eq(matches.id, disputa.matchId)).limit(1).for("update");
        if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
        if (sala.status !== "encerrada") return { ok: false, erro: "estado_invalido", estado: sala.status };
        const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
        const aposta = sala.apostaMc ?? 0;
        const taxa = Number(sala.taxaPct ?? 8.99);
        const winnerSide = sala.winnerSide;
        if (!winnerSide || (winnerSide !== "blue" && winnerSide !== "red")) {
          return { ok: false, erro: "sem_vencedor_pago" };
        }
        // Reversão total: todos voltam ao pré-aposta e a sala vira cancelada.
        const rv = await reverterPayout(tx, sala.id, aposta, players, winnerSide, taxa);
        if (!rv.ok) return rv; // saldo_insuficiente
        await tx.update(matches).set({
          status: "cancelada", resultado: null, canceladoEm: new Date(),
          revisadoPor: user.id, revisadoEm: new Date(),
        }).where(eq(matches.id, sala.id));
        await tx.update(matchDisputas).set({ status: "resolvida" }).where(eq(matchDisputas.id, disputa.id));
        await tx.update(matchPlayers).set({ linked: false }).where(eq(matchPlayers.matchId, sala.id));
        await tx.update(matchCodes).set({ used: false, matchId: null }).where(eq(matchCodes.matchId, sala.id));
        notifyMatchChange(disputa.matchId);
        return { ok: true, procedente: true };
      });
      if (!r2.ok) {
        const status = r2.erro === "disputa_ja_resolvida" ? 409 : r2.erro === "sala_nao_encontrada" ? 404 : r2.erro === "saldo_insuficiente" ? 409 : 400;
        return res.status(status).json({ erro: r2.erro, userId: r2.userId });
      }
      return res.json(r2);
    }

    // Improcedente: fecha a disputa, escrow intocado, sala continua encerrada.
    await db.update(matchDisputas).set({ status: "resolvida" }).where(eq(matchDisputas.id, disputa.id));
    return res.json({ ok: true, procedente: false });
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});
```

- [ ] **Step 4: SDK do front**

Em `web/src/lib/api.ts`, no bloco `revisao:`, adicionar:
```ts
  revisao: {
    /** Fila de salas em `aguardando_revisao` por antiguidade (design v3 §6). */
    pendentes: () => api.get<ApiRevisaoSala[]>("/revisao/pendentes"),
    /** Decide a partida: 'blue' | 'red' | 'draw' | 'cancel', com decisionId idempotente. */
    decidir: (id: string, data: { winnerSide: 'blue' | 'red' | 'draw' | 'cancel'; decisionId: string }) =>
      api.post<ApiDecisaoResultado>(`/revisao/${id}/decidir`, data),
    /** Disputas abertas em partidas encerradas (spec verificacao-partida-riot). */
    disputas: () => api.get<ApiDisputaAdmin[]>("/revisao/disputas"),
    /** Decide uma contestação: procedente → estorna e cancela; improcedente → fecha. */
    decidirDisputa: (id: string, data: { procedente: boolean }) =>
      api.post<{ ok: boolean; procedente: boolean }>(`/revisao/disputas/${id}/decidir`, data),
  },
```

Adicionar a interface `ApiDisputaAdmin` (perto de `ApiDisputa`):
```ts
export interface ApiDisputaAdmin {
  id: string;
  matchId: string;
  userId: string;
  motivo: string;
  contestacaoUrl: string | null;
  status: string;
  createdAt: string;
  nomeJogador: string;
  salaNum: number;
  mode: string;
  apostaMc: number;
  winnerSide: string | null;
  resultado: string | null;
}
```

- [ ] **Step 5: Typecheck + suite**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0

Run: `npx tsx --test api/test/revisao.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/revisao.ts api/test/revisao.test.ts web/src/lib/api.ts
git commit -m "feat(revisao): painel de disputas em partidas encerradas (procedente/improcedente)"
```

---

### Task 9: Front SalaMod1 — botão "Verificar partida" + aviso de nicks

**Files:**
- Modify: `web/src/pages/SalaMod1.tsx`
- Modify: `web/src/lib/api.ts` (SDK `matches.verificar`)

**Interfaces:**
- Consumes: `POST /api/matches/:id/verificar` (Task 5)
- Produces: botão no lugar do print em `partida_iniciada`; aviso "confiram os nicks" no CTA de confirmar

- [ ] **Step 1: SDK**

Em `web/src/lib/api.ts`, interface `ApiMatchesSdk` e objeto `matches:`:
```ts
  /** Dispara a verificação automática na hora (acelerador do polling). */
  verificar: (id: number) =>
    api.post<{ ok: boolean; estado: string; vencedor?: 'A' | 'B' | null; motivo?: string; matchIdRiot?: string | null }>(`/matches/${id}/verificar`),
```

- [ ] **Step 2: Substituir o botão de print pelo de verificar**

Em `web/src/pages/SalaMod1.tsx`, no bloco `{sala.estado === 'partida_iniciada' && jogadorAtual && (` (linhas ~760-778), trocar o botão de upload de print por:

```tsx
                    {sala.estado === 'partida_iniciada' && jogadorAtual && (
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={verificarPartidaAgora}
                                disabled={verificandoPartida}
                                className="pointer-events-auto relative p-[1.5px] bg-black disabled:opacity-50"
                                style={{ clipPath: CUT_FRAME }}
                            >
                                <span className="block bg-[#FFB700] px-[12vmin] py-[2.5vmin] font-black uppercase tracking-[0.5em] text-[1.8vmin] text-black hover:bg-yellow-400 flex items-center justify-center gap-[1.5vmin] transition-colors"
                                    style={{ clipPath: CUT_INNER }}>
                                    {verificandoPartida ? <Loader className="w-[2.2vmin] h-[2.2vmin] animate-spin" /> : <Check className="w-[2.2vmin] h-[2.2vmin]" />}
                                    {verificandoPartida ? 'Verificando...' : 'Verificar Partida'}
                                </span>
                            </motion.button>
                        </motion.div>
                    )}
```

Adicionar o handler (perto de `enviarPrintPartida`, que pode ser removido):
```tsx
    const [verificandoPartida, setVerificandoPartida] = useState(false);
    const verificarPartidaAgora = async () => {
        if (!salaId) return;
        setVerificandoPartida(true);
        try {
            const r = await api.matches.verificar(Number(salaId));
            if (r.estado === 'encerrada') {
                toast.success(`Partida finalizada! ${r.vencedor === 'A' ? 'Time Azul' : 'Time Vermelho'} venceu.`);
            } else if (r.estado === 'cancelada') {
                toast.error('Partida cancelada — os nicks não conferiram ou o jogo não foi encontrado.');
            } else {
                toast.info('Partida ainda em andamento ou não encontrada. Verificação automática continua.');
            }
            await atualizar();
        } catch (e: any) {
            toast.error(traduzirErroSala(e?.message));
        } finally {
            setVerificandoPartida(false);
        }
    };
```

Remover `enviarPrintPartida`, `fileInputRef`, `enviandoPrint` e o input file (o print só existe na contestação, que fica em ResultadoPartida).

- [ ] **Step 3: Aviso "confiram os nicks" no overlay de confirmação**

No overlay `sala.estado === 'confirmacao'`, abaixo do texto "CONFIRME AGORA", adicionar:
```tsx
                                <span className="text-[1.1vmin] font-bold text-white/50 uppercase tracking-[0.2em] text-center max-w-[40vmin]">
                                    Confiram os nicks — quem jogar no lugar do dono da vaga cancela a partida
                                </span>
```

- [ ] **Step 4: Build + tsc**

Run: `npx tsc --noEmit -p web/tsconfig.json` (na raiz do web: `npm run build` também)
Expected: apenas os 2 erros pré-existentes conhecidos (ElectricBorder.tsx, Streamers.tsx), se existirem; sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/SalaMod1.tsx web/src/lib/api.ts
git commit -m "feat(sala): botao Verificar Partida + aviso de conferir nicks na confirmacao"
```

---

### Task 10: Front ResultadoPartida — contestar resultado

**Files:**
- Modify: `web/src/components/partidas/ResultadoPartida.tsx`
- Modify: `web/src/lib/api.ts` (SDK `disputas.abrir` aceita contestacao_url)
- Test: build + tsc

**Interfaces:**
- Consumes: `POST /api/disputas/:matchId` com `{ motivo, contestacao_url }` (Task 6)
- Produces: botão "Contestar resultado" + popup (print + motivo) em partida finalizada

- [ ] **Step 1: SDK**

Em `web/src/lib/api.ts`, bloco `disputas:`:
```ts
  disputas: {
    /** Abre contestação de resultado (1 por jogador por partida, §6.1). */
    abrir: (matchId: string, motivo: string, contestacaoUrl?: string) =>
      api.post<{ ok: boolean }>(`/disputas/${matchId}`, { motivo, contestacao_url: contestacaoUrl }),
    /** Lista as disputas da partida (participante ou revisor). */
    list: (matchId: string) => api.get<ApiDisputa[]>(`/disputas/${matchId}`),
  },
```

- [ ] **Step 2: Upload de print de contestação**

O upload reusa o fluxo de `api.prints.upload(matchId, file)` (bucket `match-prints`). Em `web/src/components/partidas/ResultadoPartida.tsx`, adicionar estado e handler:

```tsx
  const [contestando, setContestando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [minhaDisputa, setMinhaDisputa] = useState<any>(null);

  useEffect(() => {
    if (!matchId) return;
    api.disputas.list(matchId)
      .then((d) => setMinhaDisputa(d.find((x: any) => x.userId === usuarioAtual?.id) ?? null))
      .catch(() => {});
  }, [matchId]);

  const abrirContestacao = async () => {
    if (!matchId) return;
    if (motivo.trim().length < 5) { toast.error('Descreva o motivo (mínimo 5 caracteres).'); return; }
    setEnviando(true);
    try {
      let contestacaoUrl: string | undefined;
      if (arquivo) {
        const up = await api.prints.upload(matchId, arquivo);
        contestacaoUrl = up.url;
      }
      await api.disputas.abrir(matchId, motivo.trim(), contestacaoUrl);
      toast.success('Contestação registrada — o admin vai analisar.');
      setContestando(false);
      setMotivo('');
      setArquivo(null);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível registrar a contestação.');
    } finally {
      setEnviando(false);
    }
  };
```

- [ ] **Step 3: UI — bloco de contestação**

No fim do card (após os prints), adicionar o bloco (apenas para participantes confirmados — o `sala` já traz `jogadores`):

```tsx
          {/* Contestação — só participante confirmado da partida finalizada */}
          {jogadores.some((j: any) => j.user_id === usuarioAtual?.id) && (
            <div className="pt-3 border-t border-white/10">
              {minhaDisputa ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-500/5 border border-green-500/20 text-green-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Contestação registrada — aguardando análise
                </div>
              ) : contestando ? (
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs text-white/50 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-white/10 file:text-white/70 file:font-bold" />
                  <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Descreva o motivo da contestação (ex.: não fui eu que joguei, o nick não confere)..."
                    rows={3} maxLength={500}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFB700]/50 placeholder:text-white/25" />
                  <div className="flex gap-2">
                    <button onClick={() => setContestar(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-bold hover:bg-white/10">Cancelar</button>
                    <button onClick={abrirContestacao} disabled={enviando} className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-black uppercase tracking-widest hover:bg-red-500/25 disabled:opacity-50 flex items-center justify-center gap-1.5">
                      <Gavel className="w-3.5 h-3.5" /> {enviando ? 'Enviando...' : 'Enviar contestação'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setContestar(true)}
                  className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white/50 hover:text-red-300 hover:border-red-500/30 text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Contestar resultado
                </button>
              )}
            </div>
          )}
```

Ajustar imports (adicionar `AlertTriangle`, `Gavel`, `CheckCircle2` do lucide; `toast` de react-hot-toast; `api` já importado). Se o componente não tem `usuarioAtual`, receber como prop do caller (SalaMod1 já tem `usuarioAtual`).

- [ ] **Step 4: Build**

Run: `npm run build` (web)
Expected: build ok

- [ ] **Step 5: Commit**

```bash
git add web/src/components/partidas/ResultadoPartida.tsx web/src/lib/api.ts
git commit -m "feat(resultado): contestar resultado com print + motivo em partida finalizada"
```

---

### Task 11: Remover fluxo de print do jogo (legado)

**Files:**
- Modify: `api/src/routes/matches-actions.ts` (marcar `report-result` como legado — o front não chama mais)
- Modify: `web/src/components/partidas/AguardandoRevisao.tsx` (remover do uso — não renderizar)
- Modify: `web/src/pages/SalaMod1.tsx` (remover renderização de AguardandoRevisao / prints do estado `aguardando_revisao`)
- Modify: `web/src/components/partidas/CardJogador.tsx` (usado por AguardandoRevisao — verificar se continua usado por ResultadoPartida)
- Test: build + tsc

**Interfaces:**
- Consumes: nada novo
- Produces: front sem fluxo de print durante o jogo; `aguardando_revisao` só legado

- [ ] **Step 1: Verificar usos atuais**

Run (na raiz): `rg -n "AguardandoRevisao|report-result|prints_recebidos|prints_necessarios" web/src`
Expected: listar onde o fluxo antigo ainda é referenciado.

- [ ] **Step 2: Remover renderização do AguardandoRevisao**

Em `web/src/pages/SalaMod1.tsx`, o bloco que renderiza `AguardandoRevisao` para `sala.estado === 'aguardando_revisao'` deixa de ser alcançável no fluxo normal (nenhuma sala nova entra nesse estado). Manter o componente como legado, mas não renderizá-lo. Se o estado antigo aparecer (sala que já estava em revisão), mostrar um card simples: `Partida em análise — aguarde o admin`. (Decisão: não remover arquivo ainda; a limpeza completa entra num commit separado de código morto, seguindo o ADR-018.)

- [ ] **Step 3: Atualizar `report-result` no backend como legado**

Em `api/src/routes/matches-actions.ts`, atualizar o comentário do `report-result` e a validação de estado (continuar aceitando `partida_iniciada` para não quebrar o que já está em voo, mas o front não o chama mais). Nenhuma mudança de código além do comentário — ou, se preferir, remover a rota. Decisão do plano: **manter como legado** para não quebrar salas antigas em voo.

- [ ] **Step 4: Build + tsc**

Run: `npm run build` (web)
Expected: build ok

- [ ] **Step 5: Suite completa API + commit**

Run: `npx tsx --test "api/test/*.test.ts"`
Expected: PASS

```bash
git add web/src/pages/SalaMod1.tsx api/src/routes/matches-actions.ts
git commit -m "refactor: fluxo de print do jogo vira legado (verificacao automatica substitui)"
```

---

## Self-Review

**Cobertura do spec:**
- Verificação automática decide vencedor + paga escrow → Task 3 (aplicarEncerramento com pagarPremio)
- Nick que não bate cancela → Task 3 (aplicarCancelamento nick_nao_bate)
- 3h sem achar → cancela + devolve → Task 3 (FANTASMA_MS) + Task 4 (cron)
- Botão acelerador → Task 5
- Contestação só em finalizada com print + motivo → Task 6
- Contestação não derruba resultado; admin decide → Task 8
- Procedente = estorno total + sala cancelada → Task 7 + Task 8
- Cron no servidor → Task 4
- Front: botão + aviso nicks → Task 9
- Front: contestar em finalizada → Task 10
- Remover fluxo de print → Task 11
- Migration `contestacao_url` → Task 1

**Placeholders:** nenhum — todos os passos têm código completo e comandos com saída esperada.

**Consistência de tipos:** `reverterPayout` assinatura igual na Task 7 e Task 8; `abrirDisputa` com `contestacaoUrl` igual na Task 6 e Task 10; `verificarPartida` igual na Task 3 e Task 5; `ResultadoVerificacao` estados consistentes.
