# Corte do CampeonatoDetalhes.tsx — Design

Data: 2026-08-20 · Agente: deepseek · Status: aprovado

## Contexto

`web/src/pages/CampeonatoDetalhes.tsx` tem ~6388 linhas / ~290 KB. É o maior
arquivo do front e viola o invariante 3.6 ("nenhum arquivo passa de ~400 linhas").
Ele herdou esse tamanho do fork (ADR-010), mas o usuário quer implementar novas
features e precisa do projeto **claro, leve e contextualizado** — por isso o corte
sai agora, antes do `app.swap.campeonatos`, como refatoração mecânica (recorte),
não como reescrita.

A regra que protege a paridade visual (AGENTS.md 3.1) é o risco nº 1: o corte só
preserva o visual 1:1 se for **recorte de JSX verbatim**, nunca "melhoria".

## Estado atual

O arquivo já contém 4 sub-componentes colados dentro dele, todos recebendo
`tournament` como prop e auto-contidos:

| Componente | Linhas | Responsabilidade |
|---|---|---|
| `BracketMatch` | 55–341 | Card de partida do chaveamento |
| `GroupStage` | 342–530 | Fase de grupos |
| `DoubleSideBracket` | 531–854 | Chaveamento duplo (winner/loser) |
| `DoubleEliminationBracket` | 855–1440 | Chaveamento eliminação dupla |

O componente principal `CampeonatoDetalhes` (1441–6387) concentra ~200 handlers,
estado global e um `return` gigante com 5 abas:

- `overview` (Visão Geral), `groups` (Grupos, só liga), `schedule` (Cronograma),
  `bracket` (Chaves), `history` (Histórico).

Há ainda helpers puros duplicados por todo o arquivo (e por outros 7 arquivos do
projeto): constantes `CUT_*`, `getIcon`, `logoOf`, `parseVagas`, e os formatadores
de data `formatDayOfWeek`/`formatFullDate`/`formatDate`.

## Estrutura alvo

```
web/src/pages/CampeonatoDetalhes.tsx          → orquestrador: fetch, estado,
                                                 handlers globais, tabs, roteia seções
web/src/components/campeonatos/
  BracketMatch.tsx          → move verbatim
  GroupStage.tsx            → move verbatim
  DoubleSideBracket.tsx     → move verbatim
  DoubleEliminationBracket.tsx → move verbatim
  VisaoGeral.tsx            → aba overview
  Grupos.tsx                → aba groups
  Cronograma.tsx            → aba schedule
  Chaves.tsx                → aba bracket
  Historico.tsx             → aba history
  cut-edge.ts               → constantes CUT_* (Fase 3, compartilhado)
  icons.ts                  → getIcon + logoOf (Fase 3)
  dates.ts                  → formatadores de data (Fase 3)
```

## Regras de paridade 1:1 (não negociável)

1. **Recorte, não reescrita.** Todo bloco de JSX move com `className`, `style`,
   condicionais e estrutura **idênticos**. Só muda o que é obrigatório para
   virar componente: props no lugar de acesso ao escopo local.
2. **Cada aba vira componente** recebendo por props o que precisa
   (`tournament`, `isAdmin`, `myTeams`, callbacks). O orquestrador mantém
   estado e handlers.
3. **Build a cada arquivo extraído** (`npm run build`). Falhou = a última
   extração quebrou algo; desfaz e refaz sem seguir adiante.
4. **Verificação visual do usuário no final**, comparando com o site antigo
   (que continua no ar).

## Fases

- **Fase 1** — extrair os 4 sub-componentes já existentes para
  `components/campeonatos/`. Risco ~zero. Build ao final.
- **Fase 2** — quebrar o `return` gigante em 5 componentes de aba. Build a cada
  aba extraída.
- **Fase 3** — extrair `cut-edge.ts` / `icons.ts` / `dates.ts` compartilhados,
  eliminando a duplicação nas 7 páginas.
- **Fase 4 (limpeza)** — apagar o que não é usado: imagens duplicadas entre
  `public/` e `public/images/`, imagens sem nenhuma referência no código, código
  morto e componentes órfãos. Metodologia e regras de segurança na seção abaixo.

## Fase 4 — limpeza (metodologia)

Objetivo: remover peso morto da VPS sem quebrar nada. O site está bom; aqui só se
remove o que **comprovadamente** não é usado.

1. **Imagens.** Levantar todos os arquivos de `public/` e `public/images/`, e
   buscar cada nome no código (`web/src`, `web/index.html`, `web/*.html`) via
   grep. Zero ocorrência = candidato a remoção. Imagens duplicadas (mesmo hash,
   nomes diferentes) também são consolidadas.
2. **Código/componentes mortos.** Exports de `web/src` sem nenhum import no
   projeto. Componentes em `web/src/components` não referenciados por nenhuma
   página. Funções/constantes órfãs dentro de arquivos.
3. **Regra de ouro:** só apaga o que o grep provar que não é referenciado. Na
   dúvida, não apaga — anota e pergunta. Nunca assumir "parece morto".
4. **Build após a limpeza** (`npm run build`) para garantir que nada importava o
   que foi removido.
5. Imagens servidas dinamicamente (ex.: URLs do Supabase em `logo_url`) NÃO
   entram aqui — só arquivos estáticos de `public/`.

## Fora de escopo

- Nenhuma mudança de visual, texto, espaçamento ou comportamento.
- Nenhuma troca de camada de dados (isso é do `app.swap.campeonatos`).
- Não cortar (refatorar estrutura de) outros arquivos grandes agora (Admin.tsx,
  api.ts, Lobby.tsx etc.) — a Fase 4 remove apenas código provadamente morto,
  não reestrutura arquivo.
- Fase 3 não refatora as outras 7 páginas para usar `cut-edge.ts` — só cria o
  módulo e o usa nos componentes de campeonatos.

## Critérios de sucesso

- `npm run build` passa após cada fase.
- O `return` gigante deixa de existir: cada aba vive num componente próprio.
  O orquestrador fica bem menor (deixa de carregar ~1400 linhas de chaveamento +
  o JSX das 5 abas), mas **ainda guarda os ~200 handlers** — chegar a <400 linhas
  exigiria extrair handlers para hooks, que é o "corte completo" e foi adiado.
- Renderização do `/campeonatos/:id` visualmente idêntica ao site atual.
- Nenhum `className` alterado (verificável por `git diff`).
