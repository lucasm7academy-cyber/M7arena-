# Plano: arquitetura do módulo campeonatos

Data: 2026-08-20
Autor: deepseek (arquitetura)
Status: aguardando revisão do usuário

## 1. Contexto e problema

O domínio de campeonatos tem ~6.250 linhas espalhadas em 3 páginas + componentes, com acoplamento alto e regra de negócio no navegador:

| Arquivo | Linhas | Problema |
|---|---|---|
| `web/src/pages/CampeonatoDetalhes.tsx` | 3547 | Concentra ~15 `useState`, toda a lógica e 5 modais inline no `return` |
| `web/src/pages/createCampPage.tsx` | 2013 | Admin criar/gerenciar, com compressão de imagem inline |
| `web/src/pages/campeonatos.tsx` | 690 | Listagem |
| `web/src/components/campeonatos/Cronograma.tsx` | 854 | Recebe ~20 props (prop-drilling) |
| `web/src/components/campeonatos/DoubleEliminationBracket.tsx` | 590 | Chaveamento |

Achados concretos (verificados no código):

1. **Classificação duplicada e divergente.** A API já devolve `classificacao` (`api/src/lib/tournament-shape.ts:117` `buildClassificacao`), mas com lógica **mais simples** que a do navegador. O front ignora esse campo e recalcula em `getDynamicStandings` (`CampeonatoDetalhes.tsx:505`) com regra **mais avançada**: desempate por saldo de vitórias (V−D), depois menos derrotas, mais jogos, alfabético; filtra jogos `"MATA-MATA (CHAVEAMENTO)"`; conta `matches`. Servidor e navegador podem discordar.
2. **Código morto.** `localStorage m7_match_history` e `m7_team_stats` só são **escritos** (`syncMatchToHistory`, `updateGlobalTeamStats`) — nada os lê em lugar nenhum do repo (grep confirmou). São write-only.
3. **Regra de negócio no cliente.** `checkAndAddTiebreakers` (`CampeonatoDetalhes.tsx:609`) gera jogo de desempate mutando o campeonato no navegador. Viola o invariante 3.3.
4. **Tipos `any` generalizados** em todos os componentes e hooks.
5. **`catch {}` vazio** em `components/campeonatos/dates.ts`.

## 2. Objetivos e não-objetivos

**Objetivos**
- Servidor vira a fonte única e autoritativa da classificação de campeonato.
- Front organizado como módulo de domínio isolado e tipado, com peças independentes e sem prop-drilling.
- Suportar novas funcionalidades sem crescer um arquivo monólito.
- Remover código morto e lógica de negócio do cliente.

**Não-objetivos**
- Não é redesign visual. **Paridade 1:1 é obrigatória** — recorte verbatim de JSX/`className`, sem alterar um único `className`.
- Não é migração de dados (isso é Fase 5).
- Não toca em `m7academy.pro` nem em outras páginas fora do domínio campeonatos.

## 3. Decisões de arquitetura

| ID | Decisão | Motivo |
|---|---|---|
| D1 | Estado via **React Context + hooks** (sem lib nova) | Segue o padrão existente (`AuthContext`, `PerfilContext`, `RoleContext`); zero dependência nova no fork |
| D2 | **Classificação no servidor** | Cumpre o invariante 3.3; o servidor já calcula uma versão simples — basta consolidar a lógica avançada do front lá |
| D3 | Escopo = **módulo campeonatos inteiro** (3 páginas) | Decisão do usuário |
| D4 | Pasta de domínio **`web/src/features/campeonatos/`** | "Um domínio por pasta" (espírito do AGENTS.md §5); agrupa tipos, api, context, hooks, componentes e funções puras num só lugar |
| D5 | **Divisão por responsabilidade, não por contagem de linhas** | Um arquivo coeso (ex.: mapeador de shape) pode passar de 400 linhas; o que importa é fronteira clara e um propósito por peça. Corrige a regra rígida anterior de ~400 linhas |
| D6 | Base = branch `refactor/campeonatodetalhes` (911a58c, estado deployado) | O estado deployado na VPS; evita regressão e perda do trabalho já feito |

## 4. Arquitetura alvo

### 4.1 Servidor (`api/src`) — classificação única

- **`lib/tournament-shape.ts` → `buildClassificacao`** passa a implementar a regra completa (hoje no front):
  - Liga: conta partidas/mapas individuais (`2-1` = 2V + 1D); mata-mata: conta série vencida.
  - Filtra jogos com fase `"MATA-MATA (CHAVEAMENTO)"` (só cronograma conta).
  - Ordena por: saldo (V−D) → menos derrotas → mais jogos (`matches`) → alfabético.
  - Retorna `{ rank, nome, tag, logo, v, d, j, matches, cor, icone }`.
  - Mantém o fallback para `tournament_standings` (classificação manual) quando não há jogos finalizados.
- **`checkAndAddTiebreakers`** (geração de jogo de desempate) vira regra de servidor, acoplada ao caminho de escrita do cronograma (`PUT /:id/cronograma/merge` ou equivalente), nunca no navegador.
- O shape `classificacao` já sai no `toLegacyTournament` — o front passa a **só consumir**.

### 4.2 Front (`web/src`) — módulo de domínio

```
web/src/features/campeonatos/
  types.ts                      ← interfaces tipadas (Tournament, TeamRegistration, CronogramaJogo,
                                   ClassificacaoEntry, BracketData, ...)
  api.ts                        ← cliente tipado dos torneios (fino, reexporta/wrappa lib/api.ts)
  CampeonatoContext.tsx         ← Provider dono do estado + ações do detalhe
  useCampeonato.ts              ← hook tipado que expõe o contexto (lança fora do Provider)
  hooks/
    useClassificacao.ts         ← derivado de campeonato.classificacao (servidor)
    useInscricao.ts             ← fluxo de inscrição/aprovação
  components/
    tabs/                       ← VisaoGeral, Grupos, Cronograma, Chaves, Historico
    bracket/                    ← BracketMatch, GroupStage, DoubleSideBracket, DoubleEliminationBracket
    modals/                     ← BracketModal, InscricaoModal, RegrasModal, EditarJogoModal, AdminMatchModal
    shared/                     ← cut-edge, icons, dates (já existem)
  domain/
    imagem.ts                   ← compressão de imagem (hoje inline no createCampPage)
```

- `pages/CampeonatoDetalhes.tsx` → orquestrador fino: monta `<CampeonatoProvider>`, renderiza header + abas + modais, delega toda lógica.
- `pages/createCampPage.tsx` → admin; extrai compressão de imagem para `domain/imagem.ts` e usa `types.ts`/`api.ts`.
- `pages/campeonatos.tsx` → listagem; tipada.

### 4.3 Fluxo de dados (depois)

```
navegador                      servidor
  │                                │
  │ GET /tournaments/:id           │
  ├───────────────────────────────►│ loadTournamentData + buildClassificacao
  │◄── { ...campeonato,            │   (classificacao completa, ordenada)
  │      classificacao }           │
  │                                │
  │ VisaoGeral/Historico leem       │
  │ campeonato.classificacao       │
  │ (sem recalcular)               │
```

## 5. Estratégia de fatiamento (sem quebrar paridade)

1. **Consolidar servidor primeiro** (`buildClassificacao` + `checkAndAddTiebreakers`) — com testes, para ter a fonte única pronta.
2. **Tipar** (`types.ts`) antes de mover componentes.
3. **Extrair modais** (hoje inline no `return`) para `components/modals/` — recorte verbatim.
4. **Criar `CampeonatoContext`** absorvendo estado e ações; os componentes passam a consumir via `useCampeonato()` em vez de props.
5. **Substituir `getDynamicStandings`** por `campeonato.classificacao` no `VisaoGeral` e `Historico`.
6. **Remover código morto** (`syncMatchToHistory`, `updateGlobalTeamStats`, `localStorage`).
7. **Fatiar `Cronograma` e `DoubleEliminationBracket`** em subcomponentes coesos.
8. **Fatiar `createCampPage`** (extrair `domain/imagem.ts` e componentes de form).

Cada passo termina com `tsc --noEmit` + `vite build` verdes. Paridade visual é garantida por construção (recorte verbatim); confirmada por conferência no navegador ao final.

## 6. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Regressão visual | Recorte verbatim; nenhum `className` alterado; conferência no navegador antes/depois |
| Mudança de comportamento da classificação | Regra consolidada vira função pura com testes unitários (`tsx --test`), comparada com o comportamento atual |
| Branchs empilhados sem merge | Trabalhar numa branch nova a partir de `refactor/campeonatodetalhes` (911a58c); documentar a linha de base no log |
| `checkAndAddTiebreakers` depende do estado de escrita do cronograma | Disparo hoje no fluxo de salvar/editar jogo do cronograma quando `action === "finish"` (`CampeonatoDetalhes.tsx:1461`); mover mantendo o mesmo gatilho no servidor |

## 7. Verificação (entrega-verificada)

- `npx tsc --noEmit` em `api/` e `web/` → exit 0.
- `npx vite build` em `web/` → exit 0.
- `npx tsx --test` em `api/` → todos passam (inclui novos testes de `buildClassificacao`).
- Conferência visual no navegador de `/campeonatos`, `/campeonatos/:id` (abas: Visão Geral, Grupos, Cronograma, Chaves, Histórico) e `/criar-campeonato` (admin) — antes e depois, sem diferença.
- `node scripts/verify-swap.js campeonatos` permanece 0 (nenhuma chamada Supabase reintroduzida).

## 8. Fora de escopo

- Migração de dados / cutover (Fase 5).
- Outros domínios (SalaMod1, Jogar, times) — ficam para depois, seguindo o mesmo padrão se aprovado.
