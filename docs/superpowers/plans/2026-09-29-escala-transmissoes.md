# Escala de Transmissões Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jogos de campeonato confirmados viram uma agenda em `/streamers`; 1 streamer por jogo pega a vaga, entra no ar com um clique (recebendo o código da partida) e a plataforma desliga a live sozinha quando a série termina — com o streamer escalado visível no card do Lobby.

**Architecture:** Vínculo opcional `transmissoes.match_id` (FK cascade) + nova tabela `escalas_transmissao` (unique em `match_id` = 1 vaga por jogo). Regras no servidor em `api/src/lib/streams.ts` (agenda) e `api/src/lib/transmissoes.ts` (encerramento); desligamento em duas camadas: escrita (motor de série + save manual do ADM) e leitura (vitrine/painel fazem join com o status do jogo). Front novo em `web/src/features/streams/` + chip no card do Lobby.

**Tech Stack:** Node/Express + Drizzle + PostgreSQL (PGlite nos testes), React + Vite + Tailwind, `node:test` via `npx tsx --test`.

**Spec:** `docs/superpowers/specs/2026-09-29-escala-transmissoes-design.md`

## Global Constraints

- **Não commitar** sem o usuário pedir (regra do harness).
- **Não tocar em `D:\Aplicativos\M7AcademySite`** (somente leitura) e nada de Supabase.
- **Regra de negócio no servidor**: janela, vaga, título, desligamento e código — o cliente só exibe.
- **Código novo obedece ~400 linhas**; arquivos herdados (`Streamers.tsx`, `Lobby.tsx`) não crescem: a feature vai em módulo próprio.
- **Paridade visual**: `Streamers.tsx` e `Lobby.tsx` já são UI nova/1:1 — só a adição pedida (chip do streamer no card, seção de agenda), sem mexer no resto.
- Textos de interface em pt-BR; TypeScript strict; imports ESM com `.js` no backend.
- Nenhum segredo no bundle.
- Comandos de teste (raiz): `npx tsx --test api/test/<arquivo>.test.ts` · typecheck API: `npx tsc --noEmit -p api/tsconfig.json` · web (workdir `web`): `npx tsc --noEmit` e `npx vite build`.

---

### Task 1: Schema + migration 0024

**Files:**
- Modify: `db/schema/conteudo.ts`
- Generate: `db/migrations/0024_*.sql` (+ `db/migrations/meta/0024_snapshot.json`)

**Interfaces:**
- Produces: coluna `transmissoes.matchId` (uuid nullable, FK cascade) e tabela `escalasTransmissao` (`id`, `matchId` unique, `userId`, `createdAt`).

- [ ] **Step 1: Editar `db/schema/conteudo.ts`**

Adicionar o import no topo (depois do import de `users`):

```ts
import { tournamentMatches } from "./tournaments.js";
```

Em `transmissoes`, depois de `time2Id`:

```ts
    matchId: uuid("match_id").references(() => tournamentMatches.id, { onDelete: "cascade" }),
```

E no array de índices da tabela:

```ts
    index("transmissoes_match_idx").on(table.matchId),
```

Depois do bloco de `transmissoes`, adicionar a tabela nova:

```ts
// Escala de transmissões (spec 2026-09-29): 1 streamer por jogo de campeonato.
// O UNIQUE em match_id é a trava do banco; o servidor checa antes para devolver
// erro amigável. O vínculo da live é transmissoes.match_id; não existe
// expira_em para live de jogo — o fim dela é o fim da série.
export const escalasTransmissao = pgTable(
  "escalas_transmissao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .unique()
      .references(() => tournamentMatches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("escalas_transmissao_user_idx").on(table.userId)]
);
```

- [ ] **Step 2: Gerar a migration**

Run: `npm run db:generate`
Expected: cria `db/migrations/0024_<nome>.sql` contendo `ALTER TABLE "transmissoes" ADD COLUMN "match_id"`, a FK, o índice e o `CREATE TABLE "escalas_transmissao"`.

- [ ] **Step 3: Conferir o SQL contra o snapshot faltante da 0023**

Run: ler `db/migrations/0024_<nome>.sql` e `db/migrations/0023_bet_champion.sql`.
Expected: o 0024 contém **somente** o DDL desta feature. Se o diff re-emitir qualquer statement que a 0023 já aplica (o `0023_snapshot.json` não existe na pasta `meta/`), editar o SQL da 0024 à mão removendo a duplicata — mesmo tratamento da ADR-021. A cadeia `0000→0024` precisa aplicar limpa.

- [ ] **Step 4: Validar a cadeia num banco limpo (PGlite)**

Run: `npx tsx --test api/test/withdrawals.test.ts`
Expected: PASS — o harness (`api/test/helpers.ts`) aplica todas as migrations de `db/migrations/` num PGlite. Se a 0024 tiver SQL inválido/duplicado, este passo falha.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

---

### Task 2: Encerramento automático da live

**Files:**
- Create: `api/src/lib/transmissoes.ts`
- Modify: `api/src/lib/serie-campeonato.ts` (bloco `finalizada` de `verificarSerieMatch`)
- Modify: `api/src/lib/tournament-store.ts` (`storeCronograma`, save manual do ADM)
- Create: `api/test/streams.test.ts` (describe de encerramento)

**Interfaces:**
- Produces: `STATUS_JOGO_FINALIZADO: string[]`, `encerrarTransmissoesDoJogo(d, matchId): Promise<void>`.
- Consumes: `transmissoes.matchId` (Task 1).

- [ ] **Step 1: Criar `api/src/lib/transmissoes.ts`**

```ts
// api/src/lib/transmissoes.ts
// Fim automático das lives de jogo (spec 2026-09-29). Os pontos de finalização
// de jogo/série chamam `encerrarTransmissoesDoJogo`; a leitura (lib/streams.ts)
// também filtra pelo status do jogo, como segunda camada.
import { and, eq } from "drizzle-orm";
import { transmissoes } from "../../../db/schema/conteudo.js";

/** Status de jogo decidido — a transmissão vinculada não fica mais no ar. */
export const STATUS_JOGO_FINALIZADO = ["finalizado", "finalizada", "finished"];

/** Desliga todas as transmissões ativas vinculadas ao jogo. */
export async function encerrarTransmissoesDoJogo(d: any, matchId: string | null | undefined) {
  if (!matchId) return;
  await d
    .update(transmissoes)
    .set({ ativo: false })
    .where(and(eq(transmissoes.matchId, matchId), eq(transmissoes.ativo, true)));
}
```

- [ ] **Step 2: Chamar no motor de série**

Em `api/src/lib/serie-campeonato.ts`, adicionar o import:

```ts
import { encerrarTransmissoesDoJogo } from "./transmissoes.js";
```

No bloco `if (r.estado === "finalizada")` de `verificarSerieMatch` (depois de `await recalcularPdlGlobal(tx);`), adicionar:

```ts
    // A live do streamer escalado termina junto com a série (spec 2026-09-29).
    await encerrarTransmissoesDoJogo(tx, serie.id);
```

Não chamar em `verificarSerieBracket`: a agenda só escala `tournament_matches`.

- [ ] **Step 3: Chamar no save manual do ADM (`storeCronograma`)**

Em `api/src/lib/tournament-store.ts`, adicionar o import:

```ts
import { encerrarTransmissoesDoJogo } from "./transmissoes.js";
```

No select de `existingMatches`, incluir o `id`:

```ts
  const existingMatches = await d
    .select({
      id: tournamentMatches.id,
      key: tournamentMatches.matchKey,
      codigoPartida: tournamentMatches.codigoPartida,
      status: tournamentMatches.status,
    })
    .from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, tournamentId));
```

Dentro do `if (matchRow)`, logo depois do `await d.update(...)`, adicionar:

```ts
      // W.O. / resultado manual do ADM: desliga a live vinculada (spec 2026-09-29).
      if (isFinalizado) await encerrarTransmissoesDoJogo(d, matchRow.id);
```

- [ ] **Step 4: Criar `api/test/streams.test.ts` com o describe de encerramento**

```ts
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { games } from "../../db/schema/games.js";
import { users, userRoles } from "../../db/schema/identidade.js";
import { teams, teamMembers } from "../../db/schema/teams.js";
import { tournaments, tournamentMatches } from "../../db/schema/tournaments.js";
import { transmissoes, escalasTransmissao } from "../../db/schema/conteudo.js";
import { setupDb } from "./helpers.js";
import { encerrarTransmissoesDoJogo } from "../src/lib/transmissoes.js";

describe("transmissões — encerramento automático", () => {
  let ctx: any;
  let db: any;
  before(async () => { ctx = await setupDb(); db = ctx.db; });
  after(async () => { await ctx.client.close(); });

  test("encerrarTransmissoesDoJogo desliga só as ativas do jogo", async () => {
    const u = crypto.randomUUID();
    await db.insert(users).values({ id: u, email: u + "@x.com", displayName: "S" });
    const dono = crypto.randomUUID();
    await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const uid = Math.random().toString(36).slice(2, 8);
    const [camp] = await db.insert(tournaments).values({
      gameId: "lol", slug: `enc-${uid}`, name: "Camp", format: "groups", status: "in_progress", organizerId: dono,
    }).returning();
    const [jogo] = await db.insert(tournamentMatches).values({
      tournamentId: camp.id, phase: "group_stage", round: 0, status: "finalizado",
      matchKey: `enc-${uid}`, phaseLabel: "Grupo A",
    }).returning();
    const [tx] = await db.insert(transmissoes).values({
      userId: u, twitchChannel: "canal", matchId: jogo.id, ativo: true, modo: "campeonato",
    }).returning();
    await encerrarTransmissoesDoJogo(db, jogo.id);
    const [depois] = await db.select().from(transmissoes).where(eq(transmissoes.id, tx.id));
    assert.equal(depois.ativo, false);
  });

  test("storeCronograma finalizado (W.O. do ADM) desliga a live vinculada", async () => {
    const u = crypto.randomUUID();
    await db.insert(users).values({ id: u, email: u + "@x.com", displayName: "S" });
    const dono = crypto.randomUUID();
    await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const uid = Math.random().toString(36).slice(2, 8);
    const [camp] = await db.insert(tournaments).values({
      gameId: "lol", slug: `wo-${uid}`, name: "Camp", format: "groups", status: "in_progress", organizerId: dono,
    }).returning();
    const [jogo] = await db.insert(tournamentMatches).values({
      tournamentId: camp.id, phase: "group_stage", round: 0, status: "em_andamento",
      matchKey: `wo-${uid}`, phaseLabel: "Grupo A", teamATag: "AAA", teamBTag: "BBB",
    }).returning();
    const [tx] = await db.insert(transmissoes).values({
      userId: u, twitchChannel: "canal", matchId: jogo.id, ativo: true, modo: "campeonato",
    }).returning();
    const { storeCronograma } = await import("../src/lib/tournament-store.js");
    await storeCronograma(camp.id, [{
      id: jogo.matchKey, fase: "Grupo A", timeA: "AAA", timeB: "BBB",
      status: "finalizado", data: "2026-12-03", hora: "20:00", placar: "2 - 0",
    }], true);
    const [depois] = await db.select().from(transmissoes).where(eq(transmissoes.id, tx.id));
    assert.equal(depois.ativo, false, "W.O. do ADM desliga a transmissão");
  });
});
```

- [ ] **Step 5: Rodar o teste do encerramento**

Run: `npx tsx --test api/test/streams.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Rodar o teste do motor de série (não pode quebrar)**

Run: `npx tsx --test api/test/serie-campeonato.test.ts`
Expected: PASS em todos.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

---

### Task 3: API da agenda (lib + rotas + testes)

**Files:**
- Create: `api/src/lib/streams.ts`
- Modify: `api/src/routes/streams.ts`
- Modify: `api/test/streams.test.ts` (acrescentar describes da agenda/vitrine)

**Interfaces:**
- Consumes: `STATUS_JOGO_FINALIZADO` (Task 2), `transmissoes.matchId` e `escalasTransmissao` (Task 1).
- Produces (para as Tasks 4–6 e o shape da API):
  - `GET /api/streams/agenda` → array de `{ match_id, tournament_id, campeonato{id,titulo,cor}, fase, time_a{id,tag,nome,logo,cor}|null, time_b|null, data, hora, data_label, status, ao_vivo, streamer{user_id,nome,twitch}|null, meu, codigo_partida, transmissao_id, pode_assumir, pode_entrar_no_ar }`
  - `POST /api/streams/agenda/:matchId` → `{ ok: true }`
  - `DELETE /api/streams/agenda/:matchId` → `{ ok: true }`
  - `POST /api/streams/agenda/:matchId/no-ar` → `{ transmissao, codigo_partida }`
  - `GET /api/streams` → shape legado + `match_id`
  - `GET /api/streams/minha` → shape legado + `match_id` (ou `null`)
  - Erros: `sem_cargo_streamer`(403), `nao_e_o_streamer`(403), `sem_twitch_no_perfil`(400), `jogo_nao_encontrado`(404), `jogo_nao_confirmado`(409), `jogo_finalizado`(409), `vaga_ocupada`(409), `live_no_ar`(409), `fora_da_janela`(409).

- [ ] **Step 1: Criar `api/src/lib/streams.ts`**

```ts
// api/src/lib/streams.ts
// Regras das transmissões (spec 2026-09-29): agenda de jogos de campeonato
// (pegar vaga, entrar no ar) e consultas da vitrine/painel com o vínculo
// live ↔ jogo. As rotas só autenticam e mapeiam erro → HTTP; o que decide
// fica aqui, testável com PGlite (api/test/streams.test.ts).
import { and, eq, gt, inArray, isNotNull, isNull, not, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { users, userRoles } from "../../../db/schema/identidade.js";
import { teams } from "../../../db/schema/teams.js";
import { tournaments, tournamentMatches } from "../../../db/schema/tournaments.js";
import { escalasTransmissao, transmissoes } from "../../../db/schema/conteudo.js";
import { STATUS_JOGO_FINALIZADO } from "./transmissoes.js";

export const TZ_TRANSMISSAO = "America/Sao_Paulo";
export const JANELA_ANTES_MS = 30 * 60 * 1000;
const ATRASO_MAX_MS = 2 * 60 * 60 * 1000;
const LIMITE_AGENDA = 50;

export type Resultado<T = {}> = ({ ok: true } & T) | { ok: false; erro: string };

/** Shape legado do front + match_id (rotas antigas de /streams). */
export function toLegacyTransmissao(t: any) {
  return {
    id: t.id,
    user_id: t.userId,
    twitch_channel: t.twitchChannel,
    titulo: t.titulo,
    campeonato_id: t.campeonatoId,
    duracao_horas: t.duracaoHoras,
    ativo: t.ativo,
    criado_em: t.criadoEm ? new Date(t.criadoEm).toISOString() : null,
    expira_em: t.expiraEm ? new Date(t.expiraEm).toISOString() : null,
    modo: t.modo,
    time1_id: t.time1Id,
    time2_id: t.time2Id,
    match_id: t.matchId ?? null,
  };
}

/** Data "YYYY-MM-DD" no fuso de São Paulo. */
export function diaSP(dt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_TRANSMISSAO, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(dt);
}

/** Instante UTC do jogo: display_date/display_time são hora local de SP. */
export function instanteJogo(
  data: string | null | undefined,
  hora: string | null | undefined
): Date | null {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  if (!hora || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const d = new Date(`${data}T${hora}:00-03:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** Label do dia para exibição: HOJE | AMANHÃ | "30 SET". */
export function dataLabelSP(data: string, agora: Date = new Date()): string {
  const d = new Date(`${data}T12:00:00-03:00`);
  if (diaSP(d) === diaSP(agora)) return "HOJE";
  if (diaSP(d) === diaSP(new Date(agora.getTime() + 24 * 60 * 60 * 1000))) return "AMANHÃ";
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ_TRANSMISSAO, day: "2-digit" }).format(d);
  const mes = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ_TRANSMISSAO, month: "short" })
    .format(d).replace(".", "").toUpperCase();
  return `${dia} ${mes}`;
}

/** Título no formato do painel: "<campeonato>\n<TAG_A> x <TAG_B>". */
export function montarTituloJogo(
  campeonato: string | null | undefined,
  tagA: string | null | undefined,
  tagB: string | null | undefined
): string {
  const confronto = `${tagA || "TBD"} x ${tagB || "TBD"}`;
  return campeonato ? `${campeonato}\n${confronto}` : confronto;
}

/** Jogo entra na agenda? (confirmado com horário até 2h atrás, ou em andamento) */
export function jogoNaAgenda(jogo: any, agora: Date = new Date()): boolean {
  if (STATUS_JOGO_FINALIZADO.includes(jogo.status)) return false;
  if (jogo.status === "em_andamento") return true;
  if (jogo.status !== "confirmado") return false;
  const instante = instanteJogo(jogo.displayDate, jogo.displayTime);
  return !!instante && instante.getTime() >= agora.getTime() - ATRASO_MAX_MS;
}

/** Janela do "Estou no ar": em andamento ou 30 min antes do horário. */
export function dentroDaJanela(jogo: any, agora: Date = new Date()): boolean {
  if (jogo.status === "em_andamento") return true;
  const instante = instanteJogo(jogo.displayDate, jogo.displayTime);
  if (!instante) return false;
  return agora.getTime() >= instante.getTime() - JANELA_ANTES_MS;
}

/** Cargo streamer + twitch no perfil (mesma regra do POST /streams). */
export async function validarStreamer(d: any, userId: string): Promise<Resultado<{ twitch: string }>> {
  const roles = await d.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  if (!roles.some((r: any) => r.role === "streamer")) return { ok: false, erro: "sem_cargo_streamer" };
  const [u] = await d.select({ socials: users.socials }).from(users).where(eq(users.id, userId)).limit(1);
  const twitch = (u?.socials as Record<string, string> | null)?.["twitch"] ?? "";
  if (!twitch) return { ok: false, erro: "sem_twitch_no_perfil" };
  return { ok: true, twitch };
}

async function carregarJogoDaAgenda(d: any, matchId: string) {
  const [jogo] = await d.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId)).limit(1);
  if (!jogo) return null;
  const [camp] = await d
    .select({ id: tournaments.id, nome: tournaments.name })
    .from(tournaments).where(eq(tournaments.id, jogo.tournamentId)).limit(1);
  return { jogo, camp };
}

/** Jogos agendáveis + streamer escalado + flags da sessão. */
export async function listarAgenda(d: any, opts: { userId?: string | null; agora?: Date } = {}) {
  const agora = opts.agora ?? new Date();
  const timeA = alias(teams, "time_a");
  const timeB = alias(teams, "time_b");

  const rows = await d
    .select({
      m: tournamentMatches,
      campNome: tournaments.name,
      campCor: tournaments.themeColor,
      aId: timeA.id, aTag: timeA.tag, aNome: timeA.name, aLogo: timeA.logoUrl, aCor: timeA.gradientFrom,
      bId: timeB.id, bTag: timeB.tag, bNome: timeB.name, bLogo: timeB.logoUrl, bCor: timeB.gradientFrom,
      escalaUserId: escalasTransmissao.userId,
      streamerNome: users.displayName,
      streamerSocials: users.socials,
      txId: transmissoes.id,
      txUserId: transmissoes.userId,
    })
    .from(tournamentMatches)
    .innerJoin(tournaments, eq(tournamentMatches.tournamentId, tournaments.id))
    .leftJoin(timeA, eq(tournamentMatches.teamAId, timeA.id))
    .leftJoin(timeB, eq(tournamentMatches.teamBId, timeB.id))
    .leftJoin(escalasTransmissao, eq(escalasTransmissao.matchId, tournamentMatches.id))
    .leftJoin(users, eq(escalasTransmissao.userId, users.id))
    .leftJoin(transmissoes, and(eq(transmissoes.matchId, tournamentMatches.id), eq(transmissoes.ativo, true)))
    .where(or(eq(tournamentMatches.status, "em_andamento"), eq(tournamentMatches.status, "confirmado")));

  const agenda = rows
    .filter((r: any) => jogoNaAgenda(r.m, agora))
    .sort((a: any, b: any) => {
      const ia = instanteJogo(a.m.displayDate, a.m.displayTime)?.getTime() ?? Infinity;
      const ib = instanteJogo(b.m.displayDate, b.m.displayTime)?.getTime() ?? Infinity;
      return ia - ib;
    })
    .slice(0, LIMITE_AGENDA);

  let isStreamerComTwitch = false;
  let isStaff = false;
  if (opts.userId) {
    const roles = await d.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, opts.userId));
    const roleNames = roles.map((r: any) => r.role);
    isStaff = roleNames.some((r: string) => ["admin", "proprietario", "moderador", "organizer"].includes(r));
    if (roleNames.includes("streamer")) {
      const [u] = await d.select({ socials: users.socials }).from(users).where(eq(users.id, opts.userId)).limit(1);
      isStreamerComTwitch = !!(u?.socials as Record<string, string> | null)?.["twitch"];
    }
  }

  return agenda.map((r: any) => {
    const meu = !!opts.userId && r.escalaUserId === opts.userId;
    return {
      match_id: r.m.id,
      tournament_id: r.m.tournamentId,
      campeonato: { id: r.m.tournamentId, titulo: r.campNome, cor: r.campCor ?? "#FFB700" },
      fase: r.m.phaseLabel || r.m.phase,
      time_a: r.aId ? { id: r.aId, tag: r.aTag, nome: r.aNome, logo: r.aLogo, cor: r.aCor } : null,
      time_b: r.bId ? { id: r.bId, tag: r.bTag, nome: r.bNome, logo: r.bLogo, cor: r.bCor } : null,
      data: r.m.displayDate,
      hora: r.m.displayTime,
      data_label: r.m.displayDate ? dataLabelSP(r.m.displayDate, agora) : null,
      status: r.m.status,
      ao_vivo: !!r.txId,
      streamer: r.escalaUserId
        ? { user_id: r.escalaUserId, nome: r.streamerNome, twitch: (r.streamerSocials as Record<string, string> | null)?.["twitch"] ?? "" }
        : null,
      meu,
      codigo_partida: meu || isStaff ? (r.m.codigoPartida ?? null) : null,
      transmissao_id: r.txId && r.txUserId === opts.userId ? r.txId : null,
      pode_assumir: !r.escalaUserId && isStreamerComTwitch,
      pode_entrar_no_ar: meu && dentroDaJanela(r.m, agora),
    };
  });
}

/** Pega a vaga do jogo (1 por jogo; idempotente para o dono). */
export async function pegarVaga(d: any, matchId: string, userId: string): Promise<Resultado> {
  const carregado = await carregarJogoDaAgenda(d, matchId);
  if (!carregado) return { ok: false, erro: "jogo_nao_encontrado" };
  if (!jogoNaAgenda(carregado.jogo)) {
    return {
      ok: false,
      erro: STATUS_JOGO_FINALIZADO.includes(carregado.jogo.status) ? "jogo_finalizado" : "jogo_nao_confirmado",
    };
  }
  const [existente] = await d
    .select({ userId: escalasTransmissao.userId })
    .from(escalasTransmissao).where(eq(escalasTransmissao.matchId, matchId)).limit(1);
  if (existente && existente.userId !== userId) return { ok: false, erro: "vaga_ocupada" };
  if (!existente) await d.insert(escalasTransmissao).values({ matchId, userId });
  return { ok: true };
}

/** Solta a vaga (bloqueado com a live no ar — encerra primeiro). */
export async function soltarVaga(d: any, matchId: string, userId: string): Promise<Resultado> {
  const [escala] = await d
    .select({ userId: escalasTransmissao.userId })
    .from(escalasTransmissao).where(eq(escalasTransmissao.matchId, matchId)).limit(1);
  if (!escala || escala.userId !== userId) return { ok: false, erro: "nao_e_o_streamer" };
  const [live] = await d
    .select({ id: transmissoes.id })
    .from(transmissoes)
    .where(and(eq(transmissoes.matchId, matchId), eq(transmissoes.userId, userId), eq(transmissoes.ativo, true)))
    .limit(1);
  if (live) return { ok: false, erro: "live_no_ar" };
  await d.delete(escalasTransmissao).where(eq(escalasTransmissao.matchId, matchId));
  return { ok: true };
}

/** Entra no ar: cria a transmissão vinculada ao jogo (idempotente). */
export async function entrarNoAr(
  d: any,
  matchId: string,
  userId: string,
  opts: { agora?: Date } = {}
): Promise<Resultado<{ transmissao: any; codigo_partida: string | null }>> {
  const agora = opts.agora ?? new Date();
  const v = await validarStreamer(d, userId);
  if (!v.ok) return v;

  const [escala] = await d
    .select({ userId: escalasTransmissao.userId })
    .from(escalasTransmissao).where(eq(escalasTransmissao.matchId, matchId)).limit(1);
  if (!escala || escala.userId !== userId) return { ok: false, erro: "nao_e_o_streamer" };

  const carregado = await carregarJogoDaAgenda(d, matchId);
  if (!carregado) return { ok: false, erro: "jogo_nao_encontrado" };
  const { jogo, camp } = carregado;
  if (STATUS_JOGO_FINALIZADO.includes(jogo.status)) return { ok: false, erro: "jogo_finalizado" };

  const [jaAtiva] = await d
    .select()
    .from(transmissoes)
    .where(and(eq(transmissoes.matchId, matchId), eq(transmissoes.userId, userId), eq(transmissoes.ativo, true)))
    .limit(1);
  if (jaAtiva) return { ok: true, transmissao: jaAtiva, codigo_partida: jogo.codigoPartida ?? null };

  if (!dentroDaJanela(jogo, agora)) return { ok: false, erro: "fora_da_janela" };

  // Uma live por usuário: encerra as anteriores antes de abrir a do jogo.
  await d
    .update(transmissoes)
    .set({ ativo: false })
    .where(and(eq(transmissoes.userId, userId), eq(transmissoes.ativo, true)));

  const [row] = await d
    .insert(transmissoes)
    .values({
      userId,
      twitchChannel: v.twitch,
      titulo: montarTituloJogo(camp?.nome, jogo.teamATag, jogo.teamBTag),
      campeonatoId: jogo.tournamentId,
      duracaoHoras: 1,
      ativo: true,
      expiraEm: null,
      modo: "campeonato",
      time1Id: jogo.teamAId ?? null,
      time2Id: jogo.teamBId ?? null,
      matchId,
    })
    .returning();
  return { ok: true, transmissao: row, codigo_partida: jogo.codigoPartida ?? null };
}

/** Vitrine pública: live livre não expirada OU live de jogo não finalizado. */
export async function listarVitrine(d: any, agora: Date = new Date()) {
  const rows = await d
    .select({ t: transmissoes, jogoStatus: tournamentMatches.status })
    .from(transmissoes)
    .leftJoin(tournamentMatches, eq(transmissoes.matchId, tournamentMatches.id))
    .where(and(
      eq(transmissoes.ativo, true),
      or(
        and(isNull(transmissoes.matchId), isNotNull(transmissoes.expiraEm), gt(transmissoes.expiraEm, agora)),
        and(isNotNull(transmissoes.matchId), not(inArray(tournamentMatches.status, [...STATUS_JOGO_FINALIZADO])))
      )
    ));
  return rows.map((r: any) => r.t);
}

/** Live ativa do usuário; desativa lazy as mortas (expirada ou jogo finalizado). */
export async function minhaTransmissao(d: any, userId: string, agora: Date = new Date()) {
  const rows = await d
    .select({ t: transmissoes, jogoStatus: tournamentMatches.status })
    .from(transmissoes)
    .leftJoin(tournamentMatches, eq(transmissoes.matchId, tournamentMatches.id))
    .where(and(eq(transmissoes.userId, userId), eq(transmissoes.ativo, true)));
  const vivas = rows.filter((r: any) =>
    r.t.matchId
      ? !STATUS_JOGO_FINALIZADO.includes(r.jogoStatus)
      : r.t.expiraEm && new Date(r.t.expiraEm) > agora
  );
  const mortas = rows.filter((r: any) => !vivas.includes(r));
  if (mortas.length > 0) {
    await d
      .update(transmissoes)
      .set({ ativo: false })
      .where(inArray(transmissoes.id, mortas.map((m: any) => m.t.id)));
  }
  const viva = vivas.sort(
    (a: any, b: any) => new Date(b.t.criadoEm).getTime() - new Date(a.t.criadoEm).getTime()
  )[0];
  return viva?.t ?? null;
}
```

- [ ] **Step 2: Reescrever `api/src/routes/streams.ts`**

```ts
// api/src/routes/streams.ts
// Transmissões de streamer + agenda de jogos de campeonato (spec 2026-09-29).
// As regras vivem em lib/streams.ts; aqui só sessão/validação de cargo e o
// mapeamento erro → HTTP.
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { transmissoes } from "../../../db/schema/conteudo.js";
import { getAuthUser } from "../lib/match-flow.js";
import {
  toLegacyTransmissao,
  listarVitrine,
  minhaTransmissao,
  listarAgenda,
  pegarVaga,
  soltarVaga,
  entrarNoAr,
  validarStreamer,
} from "../lib/streams.js";

export const streamsRouter = Router();

const HTTP_ERRO: Record<string, number> = {
  sem_cargo_streamer: 403,
  nao_e_o_streamer: 403,
  sem_twitch_no_perfil: 400,
  jogo_nao_encontrado: 404,
  jogo_nao_confirmado: 409,
  jogo_finalizado: 409,
  vaga_ocupada: 409,
  live_no_ar: 409,
  fora_da_janela: 409,
};

function responderErro(res: any, resultado: { erro: string }) {
  return res.status(HTTP_ERRO[resultado.erro] ?? 400).json({ erro: resultado.erro });
}

// GET /api/streams — vitrine pública.
streamsRouter.get("/", async (_req, res) => {
  try {
    const rows = await listarVitrine(db);
    return res.json(rows.map(toLegacyTransmissao));
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// GET /api/streams/agenda — jogos agendáveis (público; enriquecido se logado).
streamsRouter.get("/agenda", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    return res.json(await listarAgenda(db, { userId: user?.id ?? null }));
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// GET /api/streams/minha — live ativa do usuário logado (painel do streamer).
streamsRouter.get("/minha", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const row = await minhaTransmissao(db, user.id);
    return res.json(row ? toLegacyTransmissao(row) : null);
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/streams/agenda/:matchId — pega a vaga do jogo.
streamsRouter.post("/agenda/:matchId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const v = await validarStreamer(db, user.id);
    if (!v.ok) return responderErro(res, v);
    const r = await pegarVaga(db, req.params.matchId, user.id);
    if (!r.ok) return responderErro(res, r);
    return res.status(201).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// DELETE /api/streams/agenda/:matchId — solta a vaga (sem live no ar).
streamsRouter.delete("/agenda/:matchId", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const r = await soltarVaga(db, req.params.matchId, user.id);
    if (!r.ok) return responderErro(res, r);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/streams/agenda/:matchId/no-ar — abre a live do jogo escalado.
streamsRouter.post("/agenda/:matchId/no-ar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const r = await entrarNoAr(db, req.params.matchId, user.id);
    if (!r.ok) return responderErro(res, r);
    return res.status(201).json({
      transmissao: toLegacyTransmissao(r.transmissao),
      codigo_partida: r.codigo_partida,
    });
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/streams — inicia transmissão livre (fluxo atual, sem jogo).
streamsRouter.post("/", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const v = await validarStreamer(db, user.id);
    if (!v.ok) return responderErro(res, v);

    const { titulo, campeonatoId, duracaoHoras, modo, time1Id, time2Id } = req.body ?? {};
    const duracao = Number(duracaoHoras) > 0 ? Number(duracaoHoras) : 1;
    const expiraEm = new Date(Date.now() + duracao * 60 * 60 * 1000);

    const [row] = await db
      .insert(transmissoes)
      .values({
        userId: user.id,
        twitchChannel: v.twitch,
        titulo: typeof titulo === "string" ? titulo : null,
        campeonatoId: campeonatoId ?? null,
        duracaoHoras: duracao,
        ativo: true,
        expiraEm,
        modo: modo === "amistoso" || modo === "campeonato" ? modo : "padrao",
        time1Id: time1Id ?? null,
        time2Id: time2Id ?? null,
      })
      .returning();
    return res.status(201).json(toLegacyTransmissao(row));
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});

// POST /api/streams/:id/parar — encerra a live (só o dono).
streamsRouter.post("/:id/parar", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ erro: "nao_autenticado" });
    const [row] = await db.select().from(transmissoes).where(eq(transmissoes.id, req.params.id)).limit(1);
    if (!row) return res.status(404).json({ erro: "transmissao_nao_encontrada" });
    if (row.userId !== user.id) return res.status(403).json({ erro: "sem_permissao" });
    await db.update(transmissoes).set({ ativo: false }).where(eq(transmissoes.id, req.params.id));
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ erro: e?.message || "erro_interno" });
  }
});
```

Atenção: as rotas `/agenda`, `/agenda/:matchId` etc. precisam vir **antes** de `POST /:id/parar`? Não conflita: `POST /:id/parar` tem path com subsegmento; `POST /agenda/:matchId` é distinto. `GET /minha` vs `GET /agenda`: sem conflito. Manter a ordem do arquivo acima.

- [ ] **Step 3: Acrescentar os describes da agenda em `api/test/streams.test.ts`**

Acrescentar imports no topo do arquivo (junto dos existentes):

```ts
import {
  listarAgenda, pegarVaga, soltarVaga, entrarNoAr, listarVitrine, minhaTransmissao,
  instanteJogo, dataLabelSP, montarTituloJogo, dentroDaJanela, diaSP,
} from "../src/lib/streams.js";
```

E no fim do arquivo:

```ts
describe("transmissões — agenda de jogos", () => {
  let ctx: any;
  let db: any;
  before(async () => { ctx = await setupDb(); db = ctx.db; });
  after(async () => { await ctx.client.close(); });

  async function criaStreamer() {
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id, email: id + "@x.com", displayName: "Streamer", socials: { twitch: "canal_teste" },
    });
    await db.insert(userRoles).values({ userId: id, role: "streamer" });
    return id;
  }

  async function criaJogo(opts: {
    status?: string; data?: string | null; hora?: string | null; codigo?: string | null;
  } = {}) {
    const dono = crypto.randomUUID();
    await db.insert(games).values({ id: "lol", name: "League of Legends" }).onConflictDoNothing();
    await db.insert(users).values({ id: dono, email: dono + "@x.com", displayName: "Dono" });
    const uid = Math.random().toString(36).slice(2, 8);
    const [camp] = await db.insert(tournaments).values({
      gameId: "lol", slug: `camp-streams-${uid}`, name: "Copa Teste",
      format: "groups", status: "in_progress", organizerId: dono,
    }).returning();
    const [jogo] = await db.insert(tournamentMatches).values({
      tournamentId: camp.id, phase: "group_stage", round: 0,
      status: opts.status ?? "confirmado",
      displayDate: opts.data ?? null, displayTime: opts.hora ?? null,
      phaseLabel: "Grupo A", matchKey: `streams-${uid}`,
      teamATag: "AAA", teamBTag: "BBB", codigoPartida: opts.codigo ?? null,
    }).returning();
    return { camp, jogo };
  }

  test("helpers: instante em SP, título e label", () => {
    assert.equal(instanteJogo("2026-12-01", "20:00")?.toISOString(), "2026-12-01T23:00:00.000Z");
    assert.equal(instanteJogo("A COMBINAR", "--:--"), null);
    assert.equal(montarTituloJogo("Copa Teste", "AAA", "BBB"), "Copa Teste\nAAA x BBB");
    assert.equal(diaSP(new Date("2026-12-01T23:30:00.000Z")), "2026-12-01");
    assert.equal(dataLabelSP("2026-12-01", new Date("2026-12-01T15:00:00.000Z")), "HOJE");
    assert.equal(dataLabelSP("2026-12-02", new Date("2026-12-01T15:00:00.000Z")), "AMANHÃ");
    assert.equal(
      dentroDaJanela({ status: "confirmado", displayDate: "2026-12-01", displayTime: "20:00" },
        new Date("2026-12-01T22:40:00.000Z")),
      true,
      "20 min antes abre a janela"
    );
  });

  test("pegarVaga: cria, bloqueia o segundo e é idempotente para o dono", async () => {
    const s1 = await criaStreamer();
    const s2 = await criaStreamer();
    const { jogo } = await criaJogo({ data: "2026-12-02", hora: "20:00" });
    assert.equal((await pegarVaga(db, jogo.id, s1)).ok, true);
    assert.deepEqual(await pegarVaga(db, jogo.id, s2), { ok: false, erro: "vaga_ocupada" });
    assert.equal((await pegarVaga(db, jogo.id, s1)).ok, true);
    const rows = await db.select().from(escalasTransmissao).where(eq(escalasTransmissao.matchId, jogo.id));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].userId, s1);
  });

  test("entrarNoAr: fora da janela recusa; na janela cria live vinculada; idempotente", async () => {
    const s = await criaStreamer();
    const { jogo } = await criaJogo({ data: "2026-12-03", hora: "20:00" });
    await pegarVaga(db, jogo.id, s);

    const fora = await entrarNoAr(db, jogo.id, s, { agora: new Date("2026-12-01T12:00:00.000Z") });
    assert.deepEqual(fora, { ok: false, erro: "fora_da_janela" });

    const agora = new Date("2026-12-03T23:00:00.000Z"); // 20:00 BRT
    const r = await entrarNoAr(db, jogo.id, s, { agora });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.transmissao.titulo, "Copa Teste\nAAA x BBB");
      assert.equal(r.transmissao.matchId, jogo.id);
      assert.equal(r.transmissao.modo, "campeonato");
      assert.equal(r.transmissao.expiraEm, null);
      assert.equal(r.codigo_partida, null);
    }
    const r2 = await entrarNoAr(db, jogo.id, s, { agora });
    assert.equal(r2.ok, true);
    if (r2.ok && r.ok) assert.equal(r2.transmissao.id, r.transmissao.id, "idempotente");

    const vitrine = await listarVitrine(db, agora);
    assert.equal(vitrine.length, 1);
    assert.equal((await minhaTransmissao(db, s, agora))?.matchId, jogo.id);

    const agenda = await listarAgenda(db, { userId: s, agora });
    assert.equal(agenda.length, 1);
    assert.equal(agenda[0].meu, true);
    assert.equal(agenda[0].ao_vivo, true);
    assert.equal(agenda[0].transmissao_id, r.ok ? r.transmissao.id : null);
    assert.equal(agenda[0].pode_entrar_no_ar, true);
  });

  test("entrarNoAr: não-dono da vaga recusa", async () => {
    const s1 = await criaStreamer();
    const s2 = await criaStreamer();
    const { jogo } = await criaJogo({ status: "em_andamento" });
    await pegarVaga(db, jogo.id, s1);
    assert.deepEqual(await entrarNoAr(db, jogo.id, s2), { ok: false, erro: "nao_e_o_streamer" });
  });

  test("entrarNoAr: sem twitch recusa", async () => {
    const id = crypto.randomUUID();
    await db.insert(users).values({ id, email: id + "@x.com", displayName: "Sem Twitch" });
    await db.insert(userRoles).values({ userId: id, role: "streamer" });
    const { jogo } = await criaJogo({ status: "em_andamento" });
    await pegarVaga(db, jogo.id, id);
    assert.deepEqual(await entrarNoAr(db, jogo.id, id), { ok: false, erro: "sem_twitch_no_perfil" });
  });

  test("soltarVaga: dono solta; com live no ar recusa; outro recusa", async () => {
    const s1 = await criaStreamer();
    const s2 = await criaStreamer();
    const { jogo } = await criaJogo({ status: "em_andamento" });
    await pegarVaga(db, jogo.id, s1);
    assert.deepEqual(await soltarVaga(db, jogo.id, s2), { ok: false, erro: "nao_e_o_streamer" });

    await entrarNoAr(db, jogo.id, s1);
    assert.deepEqual(await soltarVaga(db, jogo.id, s1), { ok: false, erro: "live_no_ar" });

    await db.update(transmissoes).set({ ativo: false }).where(eq(transmissoes.matchId, jogo.id));
    assert.equal((await soltarVaga(db, jogo.id, s1)).ok, true);
    const rows = await db.select().from(escalasTransmissao).where(eq(escalasTransmissao.matchId, jogo.id));
    assert.equal(rows.length, 0);
  });

  test("entrarNoAr encerra outra live ativa do mesmo streamer (uma live por vez)", async () => {
    const s = await criaStreamer();
    const { jogo } = await criaJogo({ status: "em_andamento" });
    const [livre] = await db.insert(transmissoes).values({
      userId: s, twitchChannel: "canal_teste", ativo: true, modo: "padrao",
      expiraEm: new Date(Date.now() + 3600_000),
    }).returning();
    await pegarVaga(db, jogo.id, s);
    const r = await entrarNoAr(db, jogo.id, s);
    assert.equal(r.ok, true);
    const [depois] = await db.select().from(transmissoes).where(eq(transmissoes.id, livre.id));
    assert.equal(depois.ativo, false);
  });

  test("vitrine/minha: live de jogo finalizado não aparece e é desativada na leitura", async () => {
    const s = await criaStreamer();
    const { jogo } = await criaJogo({ status: "em_andamento" });
    await pegarVaga(db, jogo.id, s);
    const r = await entrarNoAr(db, jogo.id, s);
    assert.equal(r.ok, true);
    // finaliza direto no banco (caminho que não passa pelo helper de escrita)
    await db.update(tournamentMatches).set({ status: "finalizado" }).where(eq(tournamentMatches.id, jogo.id));
    assert.equal((await listarVitrine(db)).length, 0);
    assert.equal(await minhaTransmissao(db, s), null);
    const [tx] = await db.select().from(transmissoes).where(eq(transmissoes.matchId, jogo.id));
    assert.equal(tx.ativo, false, "minhaTransmissao faz lazy cleanup");
  });

  test("agenda exclui 'A COMBINAR' e jogo finalizado; inclui confirmado futuro", async () => {
    const s = await criaStreamer();
    const { jogo: futuro } = await criaJogo({ data: "2026-12-10", hora: "20:00" });
    const { jogo: combinando } = await criaJogo({ status: "combinando" });
    const { jogo: antigo } = await criaJogo({ data: "2026-12-11", hora: "20:00", status: "finalizado" });
    const agenda = await listarAgenda(db, { userId: s, agora: new Date("2026-12-01T12:00:00.000Z") });
    const ids = agenda.map((a: any) => a.match_id);
    assert.ok(ids.includes(futuro.id));
    assert.ok(!ids.includes(combinando.id));
    assert.ok(!ids.includes(antigo.id));
  });
});
```

- [ ] **Step 4: Rodar os testes novos**

Run: `npx tsx --test api/test/streams.test.ts`
Expected: PASS em todos.

- [ ] **Step 5: Rodar a suíte de campeonatos (regressão do motor/store)**

Run: `npx tsx --test api/test/serie-campeonato.test.ts api/test/tournament-agendamento.test.ts api/test/tournament-pdl.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: exit 0.

---

### Task 4: SDK web + filtros de transmissões

**Files:**
- Create: `web/src/features/streams/types.ts`
- Modify: `web/src/lib/api.ts` (objeto `api.streams`)
- Modify: `web/src/hooks/useTransmissoesAtivas.ts` (filtro)
- Modify: `web/src/pages/Streamers.tsx` (filtro do `fetchStreams`, linhas ~303-310)

**Interfaces:**
- Consumes: contrato da Task 3.
- Produces: `api.streams.agenda()`, `.pegar(matchId)`, `.soltar(matchId)`, `.entrarNoAr(matchId)`; tipo `AgendaJogo`.

- [ ] **Step 1: Criar `web/src/features/streams/types.ts`**

```ts
// Tipos da agenda de transmissões (spec 2026-09-29). Shape snake_case da API.
export interface AgendaTime {
  id: string;
  tag: string;
  nome: string;
  logo: string | null;
  cor: string | null;
}

export interface AgendaStreamer {
  user_id: string;
  nome: string;
  twitch: string;
}

export interface AgendaJogo {
  match_id: string;
  tournament_id: string;
  campeonato: { id: string; titulo: string; cor: string };
  fase: string;
  time_a: AgendaTime | null;
  time_b: AgendaTime | null;
  data: string | null;
  hora: string | null;
  data_label: string | null;
  status: string;
  ao_vivo: boolean;
  streamer: AgendaStreamer | null;
  meu: boolean;
  codigo_partida: string | null;
  transmissao_id: string | null;
  pode_assumir: boolean;
  pode_entrar_no_ar: boolean;
}
```

- [ ] **Step 2: Estender `api.streams` em `web/src/lib/api.ts`**

Adicionar `import type { AgendaJogo } from "../features/streams/types";` no topo (junto dos imports existentes) e, dentro do objeto `streams`, depois de `parar`:

```ts
    /** Agenda de transmissões: jogos de campeonato agendáveis (público). */
    agenda: () => api.get<AgendaJogo[]>("/streams/agenda"),
    /** Pega a vaga de transmissão de um jogo (1 por jogo). */
    pegar: (matchId: string) => api.post<{ ok: boolean }>(`/streams/agenda/${matchId}`),
    /** Solta a vaga (bloqueado se a live está no ar). */
    soltar: (matchId: string) => api.delete<{ ok: boolean }>(`/streams/agenda/${matchId}`),
    /** Entra no ar no jogo escalado: cria a live vinculada e devolve o código. */
    entrarNoAr: (matchId: string) =>
      api.post<{ transmissao: any; codigo_partida: string | null }>(`/streams/agenda/${matchId}/no-ar`),
```

- [ ] **Step 3: Corrigir o filtro em `web/src/hooks/useTransmissoesAtivas.ts`**

Substituir a linha 41:

```ts
        const aindaAtivas = (txData || []).filter((tx: any) => tx.expira_em && tx.expira_em > now);
```

por:

```ts
        // Live de jogo (match_id) não usa expira_em: o servidor já filtra pelo
        // fim da série. As livres mantêm a expiração.
        const aindaAtivas = (txData || []).filter(
          (tx: any) => tx.match_id || (tx.expira_em && tx.expira_em > now)
        );
```

- [ ] **Step 4: Mesmo ajuste em `web/src/pages/Streamers.tsx` (linha ~309)**

Substituir:

```ts
      const aindaAtivas = (transmissoes || []).filter((tx: any) => tx.expira_em && tx.expira_em > now);
```

por:

```ts
      const aindaAtivas = (transmissoes || []).filter(
        (tx: any) => tx.match_id || (tx.expira_em && tx.expira_em > now)
      );
```

- [ ] **Step 5: Typecheck do web**

Run (workdir `web`): `npx tsc --noEmit`
Expected: exit 0.

---

### Task 5: UI da agenda em `/streamers`

**Files:**
- Create: `web/src/features/streams/components/AgendaTransmissoes.tsx`
- Modify: `web/src/pages/Streamers.tsx` (import + render + texto do painel ao vivo)

**Interfaces:**
- Consumes: `api.streams.*` (Task 4), `AgendaJogo` (Task 4).
- Produces: componente `AgendaTransmissoes` com props `{ isStreamer, temTwitch, onToast, onChange }`.

- [ ] **Step 1: Criar o componente**

```tsx
// Agenda de transmissões (spec 2026-09-29): o streamer pega um jogo confirmado,
// entra no ar (recebendo o código da partida) e a plataforma desliga a live no
// fim da série. Fica em componente próprio porque Streamers.tsx é herdado.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Check, Copy, Loader, Play, StopCircle } from 'lucide-react';
import { FaTwitch } from 'react-icons/fa';
import { api } from '../../../lib/api';
import type { AgendaJogo } from '../types';

interface Props {
  isStreamer: boolean;
  temTwitch: boolean;
  onToast: (title: string, message: string, type: 'success' | 'info') => void;
  onChange: () => void;
}

function tagDe(time: AgendaJogo['time_a']): string {
  return time?.tag ? `#${time.tag.replace(/^#/, '')}` : 'TBD';
}

export function AgendaTransmissoes({ isStreamer, temTwitch, onToast, onChange }: Props) {
  const [jogos, setJogos] = useState<AgendaJogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [acaoId, setAcaoId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const aoVivoRef = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const data = await api.streams.agenda();
      setJogos(data);
      const meuAoVivo = data.find((j) => j.meu && j.transmissao_id)?.transmissao_id ?? null;
      if (aoVivoRef.current !== null && aoVivoRef.current !== meuAoVivo) onChange();
      aoVivoRef.current = meuAoVivo;
    } catch (err) {
      console.error('Erro ao carregar agenda de transmissões:', err);
    } finally {
      setCarregando(false);
    }
  }, [onChange]);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 60000);
    return () => clearInterval(interval);
  }, [carregar]);

  const executar = async (matchId: string, fn: () => Promise<unknown>, mensagem: string) => {
    setAcaoId(matchId);
    try {
      await fn();
      onToast('✅', mensagem, 'success');
      await carregar();
      onChange();
    } catch (err: any) {
      onToast('⚠️', err?.message || 'Não foi possível concluir a ação.', 'info');
    } finally {
      setAcaoId(null);
    }
  };

  const copiarCodigo = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 2000);
  };

  if (carregando || jogos.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-5 h-5 text-[#FFB700]" />
        <h2 className="text-xl font-black uppercase tracking-widest">Agenda de Transmissões</h2>
        <span className="text-[10px] text-white/30 uppercase font-black tracking-widest hidden sm:inline">
          Jogos de campeonato agendados
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {jogos.map((jogo) => (
          <div
            key={jogo.match_id}
            className={`relative border-2 rounded-2xl p-5 transition-all duration-300 ${
              jogo.meu && jogo.transmissao_id
                ? 'border-purple-500 shadow-purple-500/20 shadow-xl'
                : 'border-white/5 hover:border-white/10'
            }`}
          >
            {jogo.meu && jogo.transmissao_id && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-900/20 via-transparent to-transparent pointer-events-none" />
            )}

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 bg-[#FFB700] text-black text-[9px] font-black uppercase tracking-widest">
                  {jogo.data_label || 'A COMBINAR'} • {jogo.hora || '--:--'}
                </span>
                {jogo.ao_vivo ? (
                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-red-500">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    AO VIVO
                  </span>
                ) : jogo.status === 'em_andamento' ? (
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#00FF41]">EM ANDAMENTO</span>
                ) : null}
              </div>

              <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">
                {jogo.campeonato.titulo} • {jogo.fase}
              </p>

              <div className="flex items-center gap-2 mt-2">
                <span className="text-base font-black uppercase text-white truncate max-w-[45%]">{tagDe(jogo.time_a)}</span>
                <span className="text-white/30 font-black">x</span>
                <span className="text-base font-black uppercase text-white truncate max-w-[45%]">{tagDe(jogo.time_b)}</span>
              </div>

              {jogo.streamer && !jogo.meu && (
                <p className="flex items-center gap-1.5 text-xs text-purple-400 font-bold mt-3">
                  <FaTwitch className="w-3 h-3" /> {jogo.streamer.nome} vai transmitir
                </p>
              )}

              {jogo.meu && jogo.transmissao_id && (
                <div className="mt-4 space-y-2">
                  {jogo.codigo_partida ? (
                    <button
                      onClick={() => copiarCodigo(jogo.codigo_partida!)}
                      title="Copiar código da partida"
                      className="w-full flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white/80 hover:border-purple-500/50 transition-colors"
                    >
                      <span className="truncate">{jogo.codigo_partida}</span>
                      {copiado === jogo.codigo_partida ? (
                        <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-white/50 shrink-0" />
                      )}
                    </button>
                  ) : (
                    <p className="text-[10px] text-white/30 uppercase font-black tracking-widest text-center py-2">
                      Aguardando o organizador iniciar a série
                    </p>
                  )}
                  <button
                    onClick={() =>
                      executar(jogo.match_id, () => api.streams.parar(jogo.transmissao_id!), 'Transmissão encerrada!')
                    }
                    disabled={acaoId === jogo.match_id}
                    className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-black rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                  >
                    {acaoId === jogo.match_id ? <Loader className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                    Encerrar
                  </button>
                </div>
              )}

              {jogo.meu && !jogo.transmissao_id && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => executar(jogo.match_id, () => api.streams.entrarNoAr(jogo.match_id), 'Você está no ar!')}
                    disabled={!jogo.pode_entrar_no_ar || acaoId === jogo.match_id}
                    title={jogo.pode_entrar_no_ar ? undefined : 'Disponível 30 min antes do horário'}
                    className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {acaoId === jogo.match_id ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    Estou no ar
                  </button>
                  <button
                    onClick={() => executar(jogo.match_id, () => api.streams.soltar(jogo.match_id), 'Vaga liberada.')}
                    disabled={acaoId === jogo.match_id}
                    className="px-4 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    Soltar
                  </button>
                </div>
              )}

              {!jogo.streamer && !jogo.meu && (
                <div className="mt-4">
                  {isStreamer && temTwitch && jogo.pode_assumir ? (
                    <button
                      onClick={() => executar(jogo.match_id, () => api.streams.pegar(jogo.match_id), 'Jogo reservado para você!')}
                      disabled={acaoId === jogo.match_id}
                      className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-purple-600 border border-white/10 hover:border-purple-500 text-white rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                    >
                      {acaoId === jogo.match_id ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Quero transmitir
                    </button>
                  ) : (
                    <p className="text-[10px] text-white/25 uppercase font-black tracking-widest text-center py-2">
                      Sem streamer definido
                    </p>
                  )}
                </div>
              )}

              {jogo.streamer && !jogo.meu && jogo.ao_vivo && (
                <a
                  href={`https://twitch.tv/${jogo.streamer.twitch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#9146FF] hover:text-white transition-colors"
                >
                  <FaTwitch className="w-3 h-3" /> Assistir agora
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Integrar em `web/src/pages/Streamers.tsx`**

Adicionar o import junto dos imports de componentes (linha ~12):

```tsx
import { AgendaTransmissoes } from '../features/streams/components/AgendaTransmissoes';
```

Renderizar depois do painel do streamer (fechamento do bloco na linha ~619, antes do `{/* Empty State */}`):

```tsx
        {/* AGENDA DE TRANSMISSÕES (spec 2026-09-29) */}
        <AgendaTransmissoes
          isStreamer={perfil?.cargo === 'streamer'}
          temTwitch={!!perfil?.twitch}
          onToast={addToast}
          onChange={() => {
            fetchUserStream();
            fetchStreams();
          }}
        />
```

- [ ] **Step 3: Ajustar o painel "AO VIVO" para live de jogo**

Na linha ~601, trocar o trecho da duração:

```tsx
                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">• Duração: {userStream?.duracao_horas} {userStream?.duracao_horas === 1 ? 'HORA' : 'HORAS'}</span>
```

por:

```tsx
                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">
                          {userStream?.match_id ? '• Até o fim da série' : `• Duração: ${userStream?.duracao_horas} ${userStream?.duracao_horas === 1 ? 'HORA' : 'HORAS'}`}
                        </span>
```

- [ ] **Step 4: Typecheck + build do web**

Run (workdir `web`): `npx tsc --noEmit`
Run (workdir `web`): `npx vite build`
Expected: exit 0 nos dois.

---

### Task 6: Lobby — streamer no card do próximo confronto

**Files:**
- Modify: `web/src/pages/Lobby.tsx` (tipo `UpcomingMatch`, fetch dos próximos, chip no card, bump do cache)

**Interfaces:**
- Consumes: `api.streams.agenda()` (Task 4); campo `match_id` do shape do cronograma (já existente na API, `tournament-shape.ts:122`).

- [ ] **Step 1: Estender o tipo e o fetch**

Na `interface UpcomingMatch` (linha ~301), adicionar:

```ts
  matchId?: string;
  streamer?: { nome: string; twitch: string } | null;
```

Bump do cache (linha ~322):

```ts
const _UPCOMING_CACHE_VER = 5; // bump ao mudar estrutura
```

No `fetchUpcoming` (linha ~586), incluir a agenda no `Promise.all`:

```ts
        const [camps, allTeams, agenda] = await Promise.all([
          api.tournaments.list(),
          api.teams.list().catch(() => [] as any[]),
          api.streams.agenda().catch(() => [] as any[]),
        ]);
```

Depois de montar o `teamMap` (linha ~599), montar o mapa de streamers:

```ts
        const streamerMap = new Map<string, { nome: string; twitch: string }>();
        for (const item of agenda as any[]) {
          if (item.match_id && item.streamer) streamerMap.set(item.match_id, item.streamer);
        }
```

No `mapped` (linha ~677), adicionar os dois campos ao objeto retornado:

```ts
            matchId: match.match_id,
            streamer: match.match_id ? streamerMap.get(match.match_id) ?? null : null,
```

- [ ] **Step 2: Chip do streamer no card**

No "Date & Time Hub" (depois do `<span>` do horário, linha ~1125), adicionar:

```tsx
                          {upcomingMatches[currentMatchIndex].streamer && (
                            <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#9146FF]/10 border border-[#9146FF]/30 backdrop-blur-sm">
                              <FaTwitch className="w-3 h-3 text-[#9146FF]" />
                              <span className="text-[10px] md:text-xs font-bold text-white/80 uppercase tracking-widest">
                                {upcomingMatches[currentMatchIndex].streamer!.nome}
                              </span>
                            </div>
                          )}
```

- [ ] **Step 3: Typecheck + build do web**

Run (workdir `web`): `npx tsc --noEmit`
Run (workdir `web`): `npx vite build`
Expected: exit 0 nos dois.

---

### Task 7: Verificação final + governança

**Files:**
- Modify: `mcp/status-server/lib/plan.js` (registro dos componentes novos)

- [ ] **Step 1: Suíte completa de testes da API**

Run: `npx tsx --test "api/test/*.test.ts"`
Expected: PASS em todos os arquivos (nenhum teste quebrado pela feature).

- [ ] **Step 2: Typechecks finais + build**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Run (workdir `web`): `npx tsc --noEmit`
Run (workdir `web`): `npx vite build`

- [ ] **Step 3: Registrar os componentes no MCP**

Via tool/CLI (`m7-status`), com agent `deepseek`:

```
add_component app.streams.agenda fase-3 app "Escala de transmissões: vínculo live↔jogo, desligamento automático, endpoints"
add_component app.streams.agenda-ui fase-3 app "Agenda de transmissões no /streamers + streamer no card do Lobby"
set_component_status app.streams.agenda doing
set_component_status app.streams.agenda-ui doing
```

E editar `mcp/status-server/lib/plan.js` adicionando ao bloco da Fase 3:

```js
  // Agenda de transmissões (spec 2026-09-29): escala jogo ↔ streamer com
  // desligamento automático no fim da série.
  "app.streams.agenda": ["fase-3", "app.swap.campeonatos", "app.swap.conteudo", "db.tournaments", "db.conteudo"],
  "app.streams.agenda-ui": ["fase-3", "app.streams.agenda", "app.sdk", "app.port.streamers"],
```

- [ ] **Step 4: Marcar done com evidência**

`set_component_status ... done` com `evidence` = o comando e o resultado observado (ex.: `npx tsx --test api/test/streams.test.ts → 13 testes PASS` e `npx vite build → built in Xs`). Nunca citar arquivo escrito sem executar.

- [ ] **Step 5: Registrar ADR + log da sessão**

`add_decision`: "Escala de transmissões: 1 streamer por jogo com desligamento automático em duas camadas" — decisão: vínculo `transmissoes.match_id` + `escalas_transmissao` unique; desligamento na escrita (motor/W.O.) e na leitura (join com status); janela de 30 min no servidor com fuso SP. Rationale: sem API da Twitch, o clique "Estou no ar" é a ignição e o fim do jogo é o desligamento; a checagem na leitura evita live fantasma se um caminho de escrita escapar.

`log_session` com resumo + arquivos tocados.

- [ ] **Step 6: Pedir teste ao usuário**

Não sair testando de novo no browser: informar que a feature está pronta para o teste dele (o gatilho é ação manual — pegar jogo, entrar no ar, finalizar série). Deploy na VPS fica para quando ele pedir.

---

## Notas de execução

- **Ordem obrigatória:** Tasks 1→3 antes das 4→6 (front depende do contrato da API); Task 2 depende da 1.
- **Não commitar** durante a execução (regra do projeto/harness); ao final, perguntar se ele quer commit + deploy.
- Se o `drizzle-kit generate` reclamar do snapshot 0023, seguir o Step 3 da Task 1 (editar o SQL à mão) — não criar snapshot manual.
- Se o PGlite não suportar algum construto do SQL gerado, o ajuste é no DDL (não no schema TS) e a cadeia precisa continuar aplicando limpa nos testes.
