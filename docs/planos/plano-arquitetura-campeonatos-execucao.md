# Plano de execucao — arquitetura do modulo campeonatos

> **Para agentes:** use `subagent-driven-development` (recomendado) ou `executing-plans`.
> Passos usam checkbox (`- [ ]`).

**Goal:** Transformar o dominio de campeonatos (3 paginas, ~6250 linhas) num modulo isolado e tipado, com a classificacao calculada no servidor, sem alterar o visual (paridade 1:1).

**Architecture:** Servidor vira fonte unica da classificacao (invariante 3.3) e do desempate automatico; o front vira `web/src/features/campeonatos/` (types, mappers, Context, hooks, componentes por aba/modal/bracket), com paginas reduzidas a orquestradores finos.

**Tech Stack:** React 19 + Vite, TypeScript strict, Express + Drizzle, testes `tsx --test` (Node).

## Global Constraints

- **Paridade visual 1:1 (invariante 3.1):** recorte verbatim de JSX/`className`. Nenhum `className`, `style`, `clipPath` ou texto de UI pode mudar.
- **Regra de negocio no servidor (invariante 3.3):** classificacao e desempate decididos no servidor; o cliente so exibe.
- **Nenhum segredo no bundle (3.4).**
- **Divisao por responsabilidade, nao por contagem de linhas (D5).**
- **Base de trabalho:** branch `arquitetura/campeonatos` (de `refactor/campeonatodetalhes` 911a58c). Ja contem o spec.
- **Verificacao por tarefa:** `npx tsc --noEmit` (api e web) e `npx vite build` (web) verdes antes de cada commit.
- **Nao commitar segredos; nao rodar migration no Supabase; nao tocar em m7academy.pro.**

---

## File Structure (alvo)

```
api/src/
  lib/tournament-shape.ts        [modificar] buildClassificacao consolidada + sortStandings
  lib/tournament-tiebreakers.ts  [criar]     appendTiebreakers (puro)
  routes/tournaments.ts          [modificar] cronograma/merge chama appendTiebreakers
  test/classificacao.test.ts     [criar]
  test/tiebreakers.test.ts       [criar]

web/src/features/campeonatos/
  types.ts                       [criar]  interfaces do dominio
  mappers.ts                     [criar]  mapFromDb / toDbPayload
  domain/bracket.ts              [criar]  INITIAL_BRACKET_DATA, migrateBracketData, advanceTeamsInBracket
  domain/imagem.ts               [criar]  compressImage* (de createCampPage)
  CampeonatoContext.tsx          [criar]  Provider (estado + acoes do detalhe)
  useCampeonato.ts               [criar]  hook tipado
  components/modals/*.tsx        [criar]  5 modais extraidos do return
  components/tabs/*.tsx          [mover]  VisaoGeral, Grupos, Cronograma, Chaves, Historico
  components/bracket/*.tsx       [mover]  BracketMatch, GroupStage, DoubleSideBracket, DoubleEliminationBracket
  components/shared/*.ts         [mover]  cut-edge, icons, dates (de components/campeonatos/)

web/src/pages/
  CampeonatoDetalhes.tsx         [modificar] orquestrador fino
  createCampPage.tsx             [modificar] tipado + domain/imagem
  campeonatos.tsx                [modificar] tipado
```

---

## Task 1: Consolidar classificacao no servidor

**Files:**
- Modify: `api/src/lib/tournament-shape.ts` (buildClassificacao, ~linhas 116-164)
- Create: `api/test/classificacao.test.ts`

**Interfaces:**
- Produces: `buildClassificacao(data)` retorna `Array<{ rank, nome, tag, logo, v, d, wo, j, matches, cor, icone }>` ordenado por saldo (V-D), menos derrotas, mais jogos, alfabetico.

- [ ] **Step 1: Escrever o teste**

Criar `api/test/classificacao.test.ts` com `node:test`. O `data` de entrada imita o retorno de `loadTournamentData` (puro, sem DB):

```ts
import { test } from "node:test";
import assert from "node:assert";
import { buildClassificacao } from "../src/lib/tournament-shape.js";

const team = (id: string, name: string, tag: string) => ({
  teams: { id, name, tag, logoUrl: null },
  tournament_teams: { status: "approved" },
});
const match = (a: string, b: string, score: string, phaseLabel: string, status = "finalizado") => ({
  teamATag: a, teamBTag: b, scoreDisplay: score, phaseLabel, status,
});

test("liga: desempate por saldo, depois menos derrotas", () => {
  const data: any = {
    t: { format: "groups" },
    teamRows: [team("1", "A", "TA"), team("2", "B", "TB"), team("3", "C", "TC")],
    matches: [
      match("TA", "TB", "2 - 1", "Grupo A"),
      match("TC", "TA", "1 - 2", "Grupo A"),
    ],
    brackets: [], standings: [],
  };
  // TA: v=4 d=2 (saldo +2); TB: v=1 d=2 (saldo -1); TC: v=1 d=2 (saldo -1)
  const c = buildClassificacao(data);
  assert.equal(c[0].tag, "TA");
  // TB vs TC empatam saldo; TB menos derrotas? iguais (2); mais jogos: TC j=3, TB j=3; alfabetico: B < C
  assert.equal(c[1].tag, "TB");
  assert.equal(c[2].tag, "TC");
});

test("mata-mata: filtra chaveamento e conta serie", () => {
  const data: any = {
    t: { format: "single_elimination" },
    teamRows: [team("1", "A", "TA"), team("2", "B", "TB")],
    matches: [
      match("TA", "TB", "2 - 1", "Final"),               // conta: TA 1V
      match("TA", "TB", "1 - 2", "MATA-MATA (CHAVEAMENTO)"), // ignorada
    ],
    brackets: [], standings: [],
  };
  const c = buildClassificacao(data);
  assert.equal(c[0].tag, "TA");
  assert.equal(c[0].v, 1);
  assert.equal(c[1].tag, "TB");
  assert.equal(c[1].d, 1);
});

test("fallback para classificacao manual sem jogos finalizados", () => {
  const data: any = {
    t: { format: "single_elimination" },
    teamRows: [team("1", "A", "TA")],
    matches: [], brackets: [],
    standings: [{ rank: 1, teamId: "1", v: 3, d: 0, wo: 0, j: 3, cor: "#FFB700", logo: null }],
  };
  const c = buildClassificacao(data);
  assert.equal(c[0].nome, "A");
  assert.equal(c[0].v, 3);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd api && npx tsx --test test/classificacao.test.ts`
Expected: o teste "liga" falha (ordenacao atual e por v bruto, nao por saldo; e falta o filtro de chaveamento/matches).

- [ ] **Step 3: Implementar**

Substituir `buildClassificacao` em `api/src/lib/tournament-shape.ts` pela versao consolidada:

```ts
function sortStandings(a: any, b: any) {
  const saldoA = (a.v || 0) - (a.d || 0);
  const saldoB = (b.v || 0) - (b.d || 0);
  if (saldoB !== saldoA) return saldoB - saldoA;
  if (a.d !== b.d) return a.d - b.d;
  if (b.matches !== a.matches) return b.matches - a.matches;
  return (a.nome || "").localeCompare(b.nome || "");
}

export function buildClassificacao(data: NonNullable<Awaited<ReturnType<typeof loadTournamentData>>>) {
  const { t, matches, teamRows, standings } = data;
  const approved = teamRows.filter((r) => r.tournament_teams.status === "approved");

  const finished = matches.filter((m) => {
    const fase = m.phaseLabel || m.phase;
    return m.status === "finalizado" && fase !== "MATA-MATA (CHAVEAMENTO)";
  });

  if (finished.length === 0 && standings.length > 0) {
    return standings.map((s) => ({
      rank: s.rank,
      nome: teamRows.find((r) => r.teams.id === s.teamId)?.teams.name || s.teamId,
      tag: teamRows.find((r) => r.teams.id === s.teamId)?.teams.tag || s.teamId,
      v: s.v, d: s.d, wo: s.wo, j: s.j, cor: s.cor, logo: s.logo,
      matches: 0, icone: "ShieldCheck",
    }));
  }

  const stats: any = {};
  approved.forEach((r) => {
    stats[r.teams.tag] = {
      rank: 0, nome: r.teams.name, tag: r.teams.tag, logo: r.teams.logoUrl,
      v: 0, d: 0, wo: 0, j: 0, matches: 0, cor: "#FFB700", icone: "ShieldCheck",
    };
  });

  const isLiga = t.format === "groups";
  finished.forEach((m) => {
    const scores = (m.scoreDisplay || "0 - 0").split(" - ");
    const s1 = parseInt(scores[0]) || 0;
    const s2 = parseInt(scores[1]) || 0;
    const a = m.teamATag, b = m.teamBTag;
    if (!a || !b) return;
    if (isLiga) {
      if (stats[a]) { stats[a].matches++; stats[a].v += s1; stats[a].d += s2; stats[a].j += s1 + s2; }
      if (stats[b]) { stats[b].matches++; stats[b].v += s2; stats[b].d += s1; stats[b].j += s1 + s2; }
    } else {
      if (stats[a]) { stats[a].matches++; stats[a].j++; if (s1 > s2) stats[a].v++; else if (s1 < s2) stats[a].d++; }
      if (stats[b]) { stats[b].matches++; stats[b].j++; if (s2 > s1) stats[b].v++; else if (s2 < s1) stats[b].d++; }
    }
  });

  return Object.values(stats)
    .sort(sortStandings)
    .map((t: any, i: number) => ({ ...t, rank: i + 1 }));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd api && npx tsx --test test/classificacao.test.ts`
Expected: 3/3 pass.

- [ ] **Step 5: typecheck e commit**

Run: `cd api && npx tsc --noEmit`
Commit: `git add api/src/lib/tournament-shape.ts api/test/classificacao.test.ts && git commit -m "refactor(api): consolidar classificacao de campeonato no servidor"`

---

## Task 2: Mover desempate automatico para o servidor

**Files:**
- Create: `api/src/lib/tournament-tiebreakers.ts`
- Modify: `api/src/routes/tournaments.ts` (rotas `PUT /:id/cronograma` e `/cronograma/merge`)
- Create: `api/test/tiebreakers.test.ts`

**Interfaces:**
- Produces: `appendTiebreakers(legacy: LegacyTournament, fase: string): LegacyTournament` — devolve o mesmo objeto (ou novo) com o jogo de desempate anexado ao `cronograma` se houver empate na fronteira de classificacao do grupo `fase`.

- [ ] **Step 1: Portar a logica pura**

Criar `api/src/lib/tournament-tiebreakers.ts` portando `checkAndAddTiebreakers` (front, `CampeonatoDetalhes.tsx:609-736`) para operar sobre o shape legado (`cronograma`, `grupos`, `times_inscritos`, `formato`). Mesma logica verbatim: ignora grupos sem nome / "Fase Final" / "Chaves" / "DESEMPATE"; exige todos os jogos da fase finalizados; monta `groupStats`; ordena por `b.v - a.v || a.d - b.d || a.matches - b.matches`; threshold `formato === "grupos_16_4_2" ? 2 : 1`; se houver empate no threshold e nao existir `DESEMPATE - {grupo}`, anexa:

```ts
export interface LegacyTournament {
  cronograma: any[];
  grupos: any;
  timesInscritos?: any[];
  times_inscritos?: any[];
  formato: string;
}

export function appendTiebreakers(campeonato: LegacyTournament, groupName: string): LegacyTournament {
  // portar checkAndAddTiebreakers verbatim; usar (campeonato.times_inscritos || campeonato.timesInscritos)
  // ... (mesmo corpo do front)
}
```

> Nota: o corpo completo e a copia literal de `checkAndAddTiebreakers` do front, substituindo `currentCampeonato.timesInscritos` por `(currentCampeonato.times_inscritos || currentCampeonato.timesInscritos || [])`.

- [ ] **Step 2: Teste**

Criar `api/test/tiebreakers.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert";
import { appendTiebreakers } from "../src/lib/tournament-tiebreakers.js";

test("gera desempate quando ha empate na fronteira", () => {
  const campeonato: any = {
    formato: "grupos_16_4_2",
    grupos: { "Grupo A": [{ tag: "TA" }, { tag: "TB" }, { tag: "TC" }] },
    times_inscritos: [{ tag: "TA", name: "A" }, { tag: "TB", name: "B" }, { tag: "TC", name: "C" }],
    cronograma: [
      { fase: "Grupo A", status: "finalizado", timeA: "TA", timeB: "TB", placar: "1 - 0" },
      { fase: "Grupo A", status: "finalizado", timeA: "TA", timeB: "TC", placar: "0 - 1" },
      { fase: "Grupo A", status: "finalizado", timeA: "TB", timeB: "TC", placar: "1 - 0" },
    ],
  };
  const out = appendTiebreakers(campeonato, "Grupo A");
  assert.ok(out.cronograma.some((j: any) => j.fase === "DESEMPATE - Grupo A"));
});

test("nao gera desempate para fase final", () => {
  const campeonato: any = {
    formato: "grupos_16_4_2", grupos: {}, times_inscritos: [], cronograma: [],
  };
  const out = appendTiebreakers(campeonato, "Fase Final");
  assert.equal(out.cronograma.length, 0);
});
```

- [ ] **Step 3: Rodar e ver passar**

Run: `cd api && npx tsx --test test/tiebreakers.test.ts`
Expected: 2/2 pass.

- [ ] **Step 4: Integrar na rota**

Em `api/src/routes/tournaments.ts`, nas rotas `PUT /:id/cronograma` e `PUT /:id/cronograma/merge`, apos `storeCronograma`, chamar `const legacy = await toLegacyTournament(id)` e, para cada jogo com status finalizado presente no corpo, rodar `appendTiebreakers(legacy, fase)`; se o cronograma resultante cresceu, persistir os novos jogos via `storeCronograma(id, novosJogos, true)` antes do `res.json`. Manter o `res.json(await toLegacyTournament(id))` final.

- [ ] **Step 5: typecheck + testes + commit**

Run: `cd api && npx tsc --noEmit && npx tsx --test`
Commit: `git add api/src/lib/tournament-tiebreakers.ts api/src/routes/tournaments.ts api/test/tiebreakers.test.ts && git commit -m "refactor(api): mover desempate automatico de campeonato para o servidor"`

---

## Task 3: Types do dominio

**Files:**
- Create: `web/src/features/campeonatos/types.ts`

- [ ] **Step 1: Criar interfaces** a partir dos usos atuais (mapFromDb, saveToSupabase, createCampPage):

```ts
export interface TeamRegistration { id: string; name: string; tag: string; status: string; paid?: boolean; discord?: string; whatsapp?: string; logo?: string | null; cor?: string; icone?: string; }
export interface CronogramaJogo { id?: string; fase: string; timeA: string; timeB: string; status: string; data: string; hora: string; placar: string; proposedBy?: string; iconeA?: string; iconeB?: string; lastActionBy?: string; }
export interface ClassificacaoEntry { rank: number; nome: string; tag: string; logo?: string | null; v: number; d: number; wo?: number; j: number; matches: number; cor: string; icone: string; }
export interface Tournament { id: string; titulo: string; nome?: string; frase?: string | null; formato: string; status: string; vagas: number; timesPorGrupo?: number | null; classificadosPorGrupo?: number | null; tier?: string | null; data?: string | null; premiacao?: string | null; taxa?: string | null; temOutrosPremios?: boolean; outrosPremios?: string | null; logoUrl?: string | null; bannerUrl?: string | null; orgPhotoUrl?: string | null; regulamento?: string | null; themeColor: string; organizacao?: string | null; grupos: any; cronograma: CronogramaJogo[]; gruposSorteados: boolean; chavesSorteados: boolean; timesInscritos: TeamRegistration[]; classificacao: ClassificacaoEntry[]; timesOrdemSorteio: string[]; criadoPor?: string | null; }
export interface BracketCell { t1: string; t2: string; s1: number; s2: number; winner: string | null; id?: string; }
export interface BracketData { upper: any; lower: any; preFinal: BracketCell; grandFinal: BracketCell; side: any; }
```

- [ ] **Step 2: typecheck** — `cd web && npx tsc --noEmit` (ainda sem usos, so compila o arquivo).
- [ ] **Step 3: Commit** — `git add web/src/features/campeonatos/types.ts && git commit -m "refactor(web): tipos do dominio campeonatos"`

---

## Task 4: Mappers puros (mapFromDb / toDbPayload)

**Files:**
- Create: `web/src/features/campeonatos/mappers.ts`

- [ ] **Step 1: Portar `mapFromDb`** (CampeonatoDetalhes.tsx:114-154) e `toDbPayload` (saveToSupabase payload, linhas 157-199) como funcoes puras tipadas:

```ts
import type { Tournament } from "./types";

export function mapFromDb(row: any): Tournament { /* corpo verbatim do front */ }

export function toDbPayload(updated: Tournament): Record<string, any> {
  /* corpo verbatim do payload de saveToSupabase, com os campos snake_case */
}
```

- [ ] **Step 2: typecheck** — `cd web && npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `git commit -m "refactor(web): mappers puros de campeonato"`

---

## Task 5: Extrair os 5 modais do return

**Files:**
- Create: `web/src/features/campeonatos/components/modals/BracketModal.tsx` (JSX 1775-1862)
- Create: `.../modals/InscricaoModal.tsx` (JSX 1864-2176)
- Create: `.../modals/RegrasModal.tsx` (JSX 2177-2274)
- Create: `.../modals/AgendamentoModal.tsx` (JSX 2635-3048)
- Create: `.../modals/AdminMatchModal.tsx` (JSX 3049-3243)
- Modify: `web/src/pages/CampeonatoDetalhes.tsx`

**Interfaces (props de cada modal):**
- `BracketModal`: `{ isOpen, onClose, campeonato, bracketData, onScoreChange, isAdmin, availableTeams }`
- `InscricaoModal`: `{ isOpen, onClose, campeonato, user, myTeams, registrationData, setRegistrationData, isRegistered, onSubmit }`
- `RegrasModal`: `{ isOpen, onClose, campeonato }`
- `AgendamentoModal`: `{ isOpen, onClose, campeonato, isAdmin, editingMatchIndex, editFormData, setEditFormData, jogoStatusAtStart, myTeams, onSubmit, onDelete }`
- `AdminMatchModal`: `{ isOpen, onClose, campeonato, adminMatchData, setAdminMatchData, onSubmit }`

- [ ] **Step 1: Recortar cada bloco** `<AnimatePresence>...{isXOpen && ...}</AnimatePresence>` para o arquivo do modal, envolvendo em `export const XModal = ({...}: Props) => { return ( ... ); }`; substituir `isXModalOpen` por `isOpen` e `setIsXModalOpen(false)` por `onClose()`.
- [ ] **Step 2: No orquestrador**, substituir os blocos por `<BracketModal isOpen={isBracketModalOpen} onClose={() => setIsBracketModalOpen(false)} ... />` etc.
- [ ] **Step 3: typecheck + build** — `cd web && npx tsc --noEmit && npx vite build`.
- [ ] **Step 4: Commit** — `git commit -m "refactor(web): extrair modais de campeonato em componentes"`

---

## Task 6: CampeonatoContext + useCampeonato

**Files:**
- Create: `web/src/features/campeonatos/CampeonatoContext.tsx`
- Create: `web/src/features/campeonatos/useCampeonato.ts`

- [ ] **Step 1: Definir o shape do Context** (estado + acoes hoje no orquestrador):

```ts
interface CampeonatoState {
  campeonato: Tournament | null;
  campeonatoLoading: boolean;
  bracketData: BracketData;
  activeTab: string;
  // modais
  isBracketModalOpen: boolean; isRegistrationModalOpen: boolean; isRulesModalOpen: boolean;
  isScheduleEditModalOpen: boolean; isAdminMatchModalOpen: boolean;
  // ... demais estados (editFormData, adminMatchData, registrationData, etc.)
}
interface CampeonatoActions {
  load: () => Promise<void>;
  save: (updated: Tournament) => void;
  saveBracket: (bracket: BracketData) => void;
  inscrever: (teamEntry: any) => Promise<void>;
  handleBracketScoreChange: (...args: any[]) => void;
  handleUpdateSchedule: (e: any) => Promise<void>;
  // ... demais acoes
}
```

- [ ] **Step 2: Criar o Provider** com `createContext`/`useContext`; mover para dentro dele todo o `useState`/`useRef`/`useEffect`/acoes do orquestrador (linhas 60-105, 981-1150, 1409-1674, etc.). Expor via `useCampeonato()` que lanca se usado fora do Provider.
- [ ] **Step 3: Reduzir o orquestrador** a: montar `<CampeonatoProvider id={id}>`, e internamente renderizar header + abas + modais lendo de `useCampeonato()`.
- [ ] **Step 4: typecheck + build** — `cd web && npx tsc --noEmit && npx vite build`.
- [ ] **Step 5: Commit** — `git commit -m "refactor(web): CampeonatoContext e useCampeonato"`

---

## Task 7: Abas passam a ler do contexto (mata prop-drilling)

**Files:**
- Modify: `web/src/features/campeonatos/components/tabs/*.tsx` (VisaoGeral, Historico, Cronograma, Chaves)
- Modify: `web/src/pages/CampeonatoDetalhes.tsx`

- [ ] **Step 1: Mover** os 5 componentes de aba de `components/campeonatos/` para `features/campeonatos/components/tabs/` e ajustar imports (`cut-edge`, `icons`, `dates` passam a viver em `components/shared/`).
- [ ] **Step 2: Substituir props** por chamadas a `useCampeonato()` dentro de cada aba (VisaoGeral/Historico/Cronograma/Chaves). Remover as props hoje passadas (ex.: `getDynamicStandings`, `myPendingMatches`, `allPendingMatches`, `filteredCronograma`, `getMyTeamInMatch`, setters).
- [ ] **Step 3: Trocar `getDynamicStandings()` por `campeonato.classificacao`** em VisaoGeral e Historico (o servidor agora devolve a classificacao pronta). Remover `getDynamicStandings`/`sortStandings` do front.
- [ ] **Step 4: typecheck + build** — `cd web && npx tsc --noEmit && npx vite build`.
- [ ] **Step 5: Commit** — `git commit -m "refactor(web): abas de campeonato consomem o contexto"`

---

## Task 8: Remover codigo morto (localStorage)

**Files:**
- Modify: `web/src/pages/CampeonatoDetalhes.tsx`

- [ ] **Step 1: Remover** `syncMatchToHistory` (389-439), `updateGlobalTeamStats` (441-487) e a chamada em `handleUpdateSchedule` (`syncMatchToHistory(match, "schedule")`).
- [ ] **Step 2: Confirmar** com grep que `m7_match_history`/`m7_team_stats` sumiram do repo.
- [ ] **Step 3: typecheck + build** — `cd web && npx tsc --noEmit && npx vite build`.
- [ ] **Step 4: Commit** — `git commit -m "refactor(web): remover codigo morto de historico em localStorage"`

---

## Task 9: Domain do bracket (funcoes puras)

**Files:**
- Create: `web/src/features/campeonatos/domain/bracket.ts`

- [ ] **Step 1: Mover** `INITIAL_BRACKET_DATA` (213-348), `migrateBracketData` (349-388) e `advanceTeamsInBracket` (738-820) para `domain/bracket.ts` como exportacoes tipadas (sem React).
- [ ] **Step 2: Importar** de volta no orquestrador/contexto.
- [ ] **Step 3: typecheck + build** — `cd web && npx tsc --noEmit && npx vite build`.
- [ ] **Step 4: Commit** — `git commit -m "refactor(web): logica pura de bracket para domain"`

---

## Task 10: Fatiar Cronograma e DoubleEliminationBracket

**Files:**
- Modify: `web/src/features/campeonatos/components/tabs/Cronograma.tsx` (854 linhas)
- Modify: `web/src/features/campeonatos/components/bracket/DoubleEliminationBracket.tsx` (590 linhas)

- [ ] **Step 1: Fatiar `Cronograma.tsx`** por responsabilidade (recorte verbatim, sem mudar className):
  - `MeusJogosPendentes.tsx` (bloco `myPendingMatches`, ~linhas 71-320)
  - `JogosPendentesAdmin.tsx` (bloco `allPendingMatches`, ~linhas 325-525)
  - `ListaCronograma.tsx` (bloco `filteredCronograma`, ~linhas 529-854)
  - `Cronograma.tsx` vira compositor dos tres.
- [ ] **Step 2: Fatiar `DoubleEliminationBracket.tsx`** extraindo sub-renderizadores (ex.: render de uma rodada, card de partida) para componentes menores quando coesos.
- [ ] **Step 3: typecheck + build** — `cd web && npx tsc --noEmit && npx vite build`.
- [ ] **Step 4: Commit** — `git commit -m "refactor(web): fatiar Cronograma e DoubleEliminationBracket por responsabilidade"`

---

## Task 11: Fatiar createCampPage + domain/imagem

**Files:**
- Create: `web/src/features/campeonatos/domain/imagem.ts`
- Modify: `web/src/pages/createCampPage.tsx` (2013 linhas)

- [ ] **Step 1: Mover** `compressImageFromBase64`, `compressImage`, `base64ToBlob`, `uploadBase64ToStorage`, `processTournamentImages` (createCampPage.tsx:64-158) para `domain/imagem.ts`.
- [ ] **Step 2: Usar** `types.ts`/`mappers.ts` em `createCampPage` (substituir `mapFromDb`/`toDbPayload` locais, linhas 170-260, pelos mappers).
- [ ] **Step 3: Extrair** componentes de form coesos se o arquivo seguir grande (lista de torneios, form de criacao) — recorte verbatim.
- [ ] **Step 4: typecheck + build** — `cd web && npx tsc --noEmit && npx vite build`.
- [ ] **Step 5: Commit** — `git commit -m "refactor(web): fatiar createCampPage e extrair domain/imagem"`

---

## Task 12: Tipar campeonatos.tsx (listagem)

**Files:**
- Modify: `web/src/pages/campeonatos.tsx` (690 linhas)

- [ ] **Step 1: Substituir** `any` por `Tournament`/`ClassificacaoEntry` e usar `mappers.mapFromDb`.
- [ ] **Step 2: typecheck + build** — `cd web && npx tsc --noEmit && npx vite build`.
- [ ] **Step 3: Commit** — `git commit -m "refactor(web): tipar listagem de campeonatos"`

---

## Task 13: Verificacao final + paridade visual

- [ ] **Step 1: Suite completa** — `cd api && npx tsc --noEmit && npx tsx --test` e `cd web && npx tsc --noEmit && npx vite build`. Tudo verde.
- [ ] **Step 2: verify-swap** — `node scripts/verify-swap.js campeonatos` deve continuar 0.
- [ ] **Step 3: Browser** — abrir `/campeonatos`, `/campeonatos/:id` (abas Visao Geral/Grupos/Cronograma/Chaves/Historico) e `/criar-campeonato`; conferir paridade visual contra o site atual e ausencia de erro no console.
- [ ] **Step 4: log_session + set_component_status** no MCP; registrar ADR da arquitetura.

---

## Self-review

- Spec coberto: classificacao no servidor (Task 1), desempate no servidor (Task 2), types (3), modais (5), Context (6), abas no contexto + classificacao server-side (7), codigo morto (8), bracket domain (9), fatiamento Cronograma/DoubleElimination (10), createCampPage/imagem (11), listagem tipada (12), verificacao (13).
- Sem placeholders: corpos de logica nova (classificacao, desempate) com codigo completo; recortes verbatim com faixas de linha exatas.
- Consistencia de tipos: `Tournament`, `ClassificacaoEntry`, `BracketData` definidos na Task 3 e usados nas demais; `buildClassificacao` retorna `matches`/`icone`/`cor` (Task 1) consumidos por VisaoGeral/Historico (Task 7).
