<!--
  ============================================================================
  ARQUIVO GERADO AUTOMATICAMENTE — NÃO EDITE À MÃO.
  Qualquer edição manual é perdida na próxima escrita via MCP.

  Para alterar o status do projeto use as tools do MCP "m7-status":
    status_brief          → ler (primeira coisa de toda sessão)
    set_component_status  → mudar o status de um componente
    add_decision          → registrar uma decisão (ADR)
    add_blocker           → registrar um impedimento
    log_session           → registrar o que você fez (última coisa da sessão)

  Fonte da verdade: docs/project-state.json
  Histórico:        docs/status-log.jsonl
  ============================================================================
-->

# Status do Projeto M7Arena

**Última atualização:** 06/11/2026 00:33 — por `deepseek`

**Objetivo:** M7Arena em produção (m7arena.pro): front React + Vite em web/, API Node + Drizzle em api/, PostgreSQL/Docker/Nginx na VPS. Projeto atual, sem migração pendente e sem Supabase no runtime.

## Panorama

`██████████████████░░░░░░░░░░ 9/14` concluído

| Fase | Progresso | Em andamento | Bloqueado |
|---|---|---|---|
| Fase 0 — Governança multi-agente | ████████████ 3/3 | — | — |
| Fase 1 — Schema do banco | ████████████ 1/1 | — | — |
| Fase 2 — Infraestrutura (VPS/Docker/Nginx) | ██████░░░░░░ 1/2 | — | 1 |
| Fase 3 — Aplicação (React + Vite + API) | ███████░░░░░ 4/7 | — | 2 |
| Fase 4 — Operações da VPS (MCP) | ░░░░░░░░░░░░ 0/1 | — | 1 |

<details><summary>Progresso por área</summary>

| Área | Progresso | Em andamento | Bloqueado |
|---|---|---|---|
| Governança & Agentes | ████████████ 3/3 | — | — |
| Banco de Dados | ████████████ 1/1 | — | — |
| Infraestrutura (VPS/Docker/Nginx) | ██████░░░░░░ 1/2 | — | 1 |
| Aplicação (React + Vite) | ███████░░░░░ 3/5 | — | 2 |
| MCP de Operações | ░░░░░░░░░░░░ 0/1 | — | 1 |
| Segurança | ██████░░░░░░ 1/2 | — | — |

</details>

## Pode pegar agora

Componentes com todas as dependências satisfeitas. Marque como `doing` antes de começar.

- `sec.campeonato-permissoes` **Permissões das rotas de escrita do campeonato** — Fase 3 — Aplicação (React + Vite + API)

## ⚠️ Bloqueios abertos

- **BLK-005** (`app.payments`) — Mercado Pago 13253: a conta collector não tem chave PIX habilitada; o QR não é gerado.
  <br>_aberto por deepseek em 31/10/2026 03:35_
- **BLK-006** (`app.riot-proxy`) — RIOT_API_KEY na VPS é chave de desenvolvimento (expira em ~24h); renovar ou usar chave pessoal.
  <br>_aberto por deepseek em 31/10/2026 03:35_
- **BLK-008** (`infra.backup`) — Dumps automáticos diários vazios (20 bytes) desde 09/08/2026; corrigir PGPASSWORD/entrypoint. Dumps manuais existem.
  <br>_aberto por deepseek em 31/10/2026 03:35_
- **BLK-009** (`mcpops.server`) — Container m7arena_mcp_ops em restart loop; operações da VPS via MCP indisponíveis.
  <br>_aberto por deepseek em 31/10/2026 03:35_

## Componentes

Legenda: `[ ]` A fazer · `[~]` Em andamento · `[x]` Concluído · `[!]` Bloqueado · `[-]` Descartado

### Fase 0 — Governança multi-agente

- `[x]` **AGENTS.md — regras multi-agente, worktree e commit na main** `gov.agents`<br>  Fonte única. Cada agente em worktree próprio; toda mudança commitada e enviada à main antes de encerrar.<br>  _evidência:_ `AGENTS.md`
- `[x]` **MCP m7-status** `gov.mcp.status`<br>  Status tipado sobre docs/project-state.json; statusdoprojeto.md é gerado.<br>  _evidência:_ `mcp/status-server`
- `[x]` **Repositório git e main** `gov.repo`<br>  main é a fonte da verdade; não deixar trabalho só no worktree.<br>  _evidência:_ `origin/main`

### Fase 1 — Schema do banco

- `[x]` **PostgreSQL + Drizzle + migrations** `db.postgres`<br>  Banco próprio na VPS; migrations versionadas reconstroem o schema.<br>  _evidência:_ `db/migrations`

### Fase 2 — Infraestrutura (VPS/Docker/Nginx)

- `[x]` **VPS + Docker + Nginx em produção** `infra.vps`<br>  m7arena.pro no ar com app, realtime, nginx, postgres e pgbouncer.<br>  _evidência:_ `m7arena.pro /api/health`
- `[!]` **Backups automáticos** `infra.backup`<br>  BLK-008: dumps diários vazios; corrigir PGPASSWORD/entrypoint.

### Fase 3 — Aplicação (React + Vite + API)

**Aplicação (React + Vite)**

- `[x]` **Front React + Vite (web/)** `app.web`<br>  Design atual em produção; sem Next.js e sem Supabase no runtime.<br>  _evidência:_ `npm run build`
- `[x]` **API Node + Express + Drizzle (api/)** `app.api`<br>  Sessão própria, salas, campeonatos, carteira, uploads e pagamentos.<br>  _evidência:_ `npx tsc --noEmit`
- `[x]` **WebSocket + LISTEN/NOTIFY** `app.realtime`<br>  Serviço próprio de realtime; o socket só avisa que a sala mudou.<br>  _evidência:_ `m7arena_realtime`
- `[!]` **Pagamentos MC (Mercado Pago PIX)** `app.payments`<br>  BLK-005: chave PIX do collector não habilitada; QR não é gerado.
- `[!]` **Proxy Riot + vínculo de conta** `app.riot-proxy`<br>  BLK-006: RIOT_API_KEY de desenvolvimento expira em ~24h.

**Segurança**

- `[x]` **Supabase removido do runtime** `app.supabase.zero`<br>  Zero chamadas em web/src; package/lock/env/bundle e containers sem dependência.<br>  _evidência:_ `node scripts/verify-swap.js = 0`
- `[ ]` **Permissões das rotas de escrita do campeonato** `sec.campeonato-permissoes`<br>  Validar staff/dono em PUT, reabrir, aprovar, recalcular, merge e inscrições.<br>  _dependências satisfeitas — liberado_

### Fase 4 — Operações da VPS (MCP)

- `[!]` **MCP de operações da VPS** `mcpops.server`<br>  BLK-009: container m7arena_mcp_ops em restart loop.

## Decisões (ADR)

### ADR-010 — Front-end: React + Vite em web/ e API Node em api/

**Decisão:** O front é o app React + Vite em web/; a API é Node + Express + Drizzle em api/. Não há Next.js.

**Por quê:** O app atual é o SPA React/Vite em produção. O port para Next foi descartado e não volta.

_31/10/2026 03:35 — deepseek_

### ADR-011 — Auth: sessão própria por cookie httpOnly

**Decisão:** Login e sessão são da API própria, com cookie httpOnly e sessões persistidas no Postgres. Sem Auth.js e sem GoTrue.

**Por quê:** Uma única camada de auth, sem dependência de Supabase/Auth.js, com regra de sessão no servidor.

_31/10/2026 03:35 — deepseek_

### ADR-031 — Pagamento MC: Mercado Pago PIX na API própria

**Decisão:** A compra de MC usa Mercado Pago PIX direto na API; o cliente envia só o packageId e o servidor resolve preço, bônus e crédito.

**Por quê:** Nenhuma regra de negócio no cliente e nenhum segredo no bundle. Webhook valida o status no MP antes de creditar.

_31/10/2026 03:35 — deepseek_

### ADR-068 — Sorteio semanal das copas

**Decisão:** Cada copa tem 2 adversários inéditos por time (8 jogos), inseridos em transação, pendentes de fase de grupos (A COMBINAR).

**Por quê:** Evita repetição de confrontos e mantém o calendário das copas previsível; o script valida 0 pares repetidos.

_31/10/2026 03:35 — deepseek_

### ADR-091 — Draft aprovado: ícone Riot, pulso da vez, prévia e pick duplo

**Decisão:** O draft usa ícone da Riot nos picks, pulsos nas luzes da vez, prévia nos slots e pick duplo com restantes_no_turno no estado.

**Por quê:** É a versão aprovada e que está em produção; não redesenhar sem pedido.

_31/10/2026 03:35 — deepseek_

### ADR-092 — Multi-agente: worktree próprio + commit/push na main

**Decisão:** Cada agente/terminal trabalha em seu próprio git worktree. Toda mudança é commitada e enviada à main antes de encerrar a tarefa; deploy só da main commitada.

**Por quê:** Evita que um agente sobrescreva o trabalho de outro e que a VPS fique diferente do Git.

_31/10/2026 03:35 — deepseek_

### ADR-093 — Supabase removido do runtime

**Decisão:** O M7Arena não fala mais com o Supabase: zero chamadas em web/src, sem @supabase em package/lock/env, e verify-swap = 0. O histórico antigo fica no Git.

**Por quê:** O projeto atual usa API própria e banco na VPS; manter o client antigo era dívida e risco de regressão.

_31/10/2026 03:35 — deepseek_

### ADR-094 — Modo local vs VPS

**Decisão:** Padrao: implementar, validar, commitar/pushar na main e subir na VPS quando a tarefa mudar o runtime. Em modo local explicito, editar/validar/commitar, mas nao subir ate o usuario pedir; avisar no inicio/fim do bloco se a main estiver a frente do commit da VPS.

**Por quê:** O usuario quer editar em lote localmente e subir de uma vez; o aviso evita esquecer mudancas fora da VPS. O commit/push continua obrigatorio para nao perder trabalho.

_31/10/2026 03:40 — deepseek_

### ADR-095 — Pasta principal sempre na main

**Decisão:** D:\Aplicativos\M7arenaSite e a pasta real do usuario e deve estar sempre na main e atualizada. Agentes podem usar worktrees para trabalho paralelo, mas no fim fazem fetch/merge --ff-only na pasta principal (se limpa); se o usuario pedir, editam nela.

**Por quê:** O usuario abre essa pasta para ver o estado real; deixa-la atras gera duvida e risco de trabalhar em versao antiga.

_31/10/2026 04:00 — deepseek_

## Histórico de sessões

| Quando | Agente | O que fez |
|---|---|---|
| 06/11/2026 00:33 | deepseek | COPA HALLOWEEN - 2026: troquei os grupos de AMATERASU E-SPORTS (AMS) e Chopp Squad (CHOP) a pedido do usuario. AMS: Grupo B -> Grupo D; CHOP: Grupo D -> Grupo B. Atualizei tournament_teams.group_id e os 6 confrontos ja sorteados (tags e ids), em transacao com verificacao. Nenhum jogo tinha resultado, sala, live ou serie vinculada. Confirmado pela API publica: Grupo B = CDC,PHE,CHOP,PTGN; Grupo D = LDL,AMS,VLD,EMPA; cronograma com CHOP x CDC/PTGN/PHE e AMS x EMPA/LDL/VLD. Sem mudanca de codigo e sem deploy. |
| 05/11/2026 23:24 | deepseek | Inscrevi e ja aprovei o Phantom E-Sports (PHE) na COPA HALLOWEEN - 2026 (9987c732-db06-4e51-8e39-e09c31fd9460): insert em tournament_teams como approved, discord soul_adc / whatsapp 44999094022. Camp. ficou 17 inscricoes, 16 aprovados (PHE entra como 16o aprovado) + Chidori pendente; condicao de inicio (aprovados == vagas) satisfeita. Confirmado pela API publica que PHE aparece na classificacao. Nenhum codigo alterado. |
| 05/11/2026 02:11 | deepseek | Inscrevi e ja aprovei o time flexqueue (FLEX) na COPA HALLOWEEN - 2026 (9987c732-db06-4e51-8e39-e09c31fd9460): insert direto em tournament_teams como approved, discord weedinchat / whatsapp 13974191151. Camp. ficou 16/16 inscritos (15 aprovados + Chidori pendente) e FLEX aparece na classificacao pela API publica. Nenhum codigo alterado. |
| 05/11/2026 00:21 | deepseek | Deploy da simplificacao aprovada em producao: merge --no-ff na main (8ee9e0a), backup novo do PostgreSQL validado por restore em DB temporario (48 tabelas; users 449/matches 58/wallets 324; mc 13622/reservado 0), uploads 304 arquivos preservados, imagens de rollback salvas. Deploy somente app/nginx; realtime (id 8f2710) e postgres preservados; sem migration. Health publico 200; login/sessao, OP.GG, salas/scrim/campeonato, PDL e privacidade Pix validados; 403 para funcoes admin por usuario comum. Pacote instalado: app sha256:56456f8..., nginx sha256:59a3c6b.... <br>_tocou: `api/src`, `web/src`, `infra`, `docs`, `main`, `deploy-vps`_ |
| 04/11/2026 23:41 | deepseek | Homologacao local da simplificacao: stack Docker local com banco isolado m7arena_homolog; navegador testou cadastro/login/perfil, catalogo com OP.GG, times, campeonatos, salas 5v5 e 1v1 completa ate iniciar partida, scrim, carteira E, admin. Corrigidos bugs de homologacao e seguranca: perfil publico sem Pix, saldo de terceiros so admin, escrita de campeonato por staff, inscricao sem autoaprovacao, lineup sem sequestro, tick autenticado, refresh-elo removido, convidado so por PUUID. Auditoria read-only de producao: 0 salas aguardando_revisao, 0 reservas, 13 prints e 2 disputas historicas encerradas. Evidencias: web lint/build, api tsc/build, 283 testes API passando, verify-swap 0. Sem deploy/migration; main intacta. <br>_tocou: `web/src`, `api/src`, `api/test`, `infra`, `docs`, `ESTRUTURA_ATUALIZADA_2026-11-04.md`, `docs/HOMOLOGACAO_SIMPLIFICACAO.md`_ |
| 04/11/2026 22:41 | deepseek | Simplificacao local da matriz 84 itens concluida na branch simplificacao-m7arena: removidos revisao/prints/disputas, noticias, player_stats, convites, dashboard financeiro, Time vs Time antigo e M7 Points; saldo MC renomeado para Essencia Azul (E); corrigidos lives de scrim (G04/G06), sino G07, cargo caster/H02 e H01 com reservas; novo ESTRUTURA_ATUALIZADA_2026-11-04.md. Evidencias: web lint/build, api tsc, 279 testes passando, verify-swap 0. Sem deploy, sem migration, main intacta. <br>_tocou: `web/src`, `api/src`, `db`, `docs`, `infra`, `scripts`, `plano_m7arena_atualizado.md`, `CATALOGO_FUNCIONALIDADES.md`, `ESTRUTURA_ATUALIZADA_2026-11-04.md`_ |
| 04/11/2026 22:39 | deepseek | Inscrevi e aprovei os times Valdreia (VLD) e Tokaman (TKM) na COPA HALLOWEEN - 2026 (9987c732-db06-4e51-8e39-e09c31fd9460): insert em tournament_teams como registered e update para approved. Camp. ficou com 15/16 vagas (14 aprovados + Chidori pendente); confirmado pela API publica que os dois aparecem na classificacao. Nenhum codigo alterado. |
| 04/11/2026 20:41 | deepseek | Catalogo funcional completo em CATALOGO_FUNCIONALIDADES.md: 84/84 funcionalidades detalhadas, 67 ativas, 5 incompletas, 4 legadas, 5 desconectadas, 3 duplicadas; dossies de M7 Points, Discord, recrutamento, VIP, Tierlist e Time vs Time legado; 16 endpoints sem tela, 17 tabelas/campos orfaos, 10 jobs, 10 integracoes e 10 capacidades de infra. Nenhum codigo alterado. |
| 04/11/2026 19:53 | deepseek | Mapeamento completo da estrutura atual do projeto em ESTRUTURA_ATUAL.md (arvore, rotas, API, banco, features, redundancias, 27 problemas confirmados, 14 suspeitas, 10 redundancias). Nenhum codigo alterado. |
| 02/11/2026 21:48 | deepseek | Sala 250/Scrim: adicionado Inserir Resultado manual para ADM/proprietario. API POST /api/matches/:id/sala-campeonato/resultado escolhe vencedor A/B, soma 1 e decide: serie aberta volta a camp_prontos; serie fechada encerra (Scrim encerrada; campeonato camp_finalizada). UI: botao no DraftRoom e na barra do adm, modal com os dois times. tsc API/web e build ok; rota 401 sem sessao; live index-CQ0si99s; health 200. <br>_tocou: `api/src/lib/serie-campeonato.ts`, `api/src/routes/matches-actions.ts`, `web/src/components/draft/DraftRoom.tsx`, `web/src/features/sala-campeonato/SalaCampeonato.tsx`, `web/src/features/sala-campeonato/ModalResultadoManual.tsx`_ |
| 02/11/2026 21:35 | deepseek | Sala 250: aplicado 1-0 manual para BKSR (AMS 0 x 1 BKSR, jogo 2, camp_prontos) apos a Riot nao fechar. Causa raiz: partida blind BR05116 estava na queue 3100 e o verificador buscava 3130; corrigido em verificar-partida/serie-campeonato. Tambem corrigida a troca de lado no DraftRoom/SalaCampeonato: vaga, jogador, logo, tag, picks, hub central, card Serie e placar ao vivo seguem o lado real. Live web index-B__aKqoy; health 200; tsc/build ok. <br>_tocou: `api/src/lib/verificar-partida.ts`, `api/src/lib/serie-campeonato.ts`, `api/test/riot-queues.test.ts`, `web/src/components/draft/DraftRoom.tsx`, `web/src/features/sala-campeonato/SalaCampeonato.tsx`_ |
| 01/11/2026 17:48 | deepseek | SalaCampeonato: header de partida finalizada trocado pela titlebar Anton com gradiente na cor do vencedor, igual à SalaMod1. Sem lista de games e sem migration (decisão do usuário). Live: index-D0tVwTiJ.js, SalaCampeonato-D1N5OQNH.js, health 200; chunk contém PARTIDA FINALIZADA/Anton. <br>_tocou: `web/src/features/sala-campeonato/SalaCampeonato.tsx`, `web/src/components/partidas/HeaderFinalizada.tsx`_ |
| 01/11/2026 16:36 | deepseek | Pool de codigos corrigido: 12 BR-SMOKE-SALA de teste removidos (backup no VPS); 5x5 ficou com os 6 BR04fa2 Tournament Draft reais (mode NULL), 1v1 com 2 e blind com 7. Riot API respondeu 403 (chave sem permissao Tournament API); classificacao confirmada pelos seeds 0007/0014/0020. 5x5 sem draft/placar na bola e Scrim/campeonato blind seguem no ar. <br>_tocou: `db/migrations/0007_matches_salas_swap.sql`, `db/migrations/0014_rodizio_codigos_lru.sql`, `db/migrations/0020_separar_fila_codigos_x1.sql`, `db/migrations/0034_blind_codes.sql`_ |
| 01/11/2026 16:30 | deepseek | 5x5 sem draft no site: confirmou -> iniciando_partida com o codigo Tournament Draft antigo (mode NULL) e placar 0x0/1x0 na bola; MD1/MD3/MD5 mantidos. Scrim/campeonato: draft no site + codigos blind BR05116 (mode='blind', migration 0034 aplicada, 7 no pool). Testes API ok; tsc/build; web/API deployados (index-BKTUEe0z, SalaMod1-BsVjmLXg). <br>_tocou: `api/src/lib/match-flow.ts`, `api/src/lib/serie-campeonato.ts`, `api/src/lib/sala-campeonato.ts`, `api/src/lib/draft/modos/5v5.ts`, `web/src/pages/SalaMod1.tsx`, `db/migrations/0034_blind_codes.sql`_ |
| 31/10/2026 16:39 | deepseek | Scrim: header preto em linha igual ao 5x5, sem moldura branca; titulo + numero da sala na mesma linha e card Serie (MD3 - BLUE x RED) no lugar do JOGO/MD3 empilhado. tsc/build ok; deploy web (SalaCampeonato-DhqY-VPe, index-DcDsj443). <br>_tocou: `web/src/features/sala-campeonato/SalaCampeonato.tsx`_ |

---

_Gerado pelo MCP `m7-status`. Regras para agentes: veja `AGENTS.md` na raiz._
