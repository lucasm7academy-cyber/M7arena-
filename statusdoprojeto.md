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

**Última atualização:** 07/11/2026 17:58 — por `codex`

**Objetivo:** M7Arena em produção (m7arena.pro): front React + Vite em web/, API Node + Drizzle em api/, PostgreSQL/Docker/Nginx na VPS. Projeto atual, sem migração pendente e sem Supabase no runtime.

## Panorama

`████████████████░░░░░░░░░░░░ 8/14` concluído

| Fase | Progresso | Em andamento | Bloqueado |
|---|---|---|---|
| Fase 0 — Governança multi-agente | ████████████ 3/3 | — | — |
| Fase 1 — Schema do banco | ████████████ 1/1 | — | — |
| Fase 2 — Infraestrutura (VPS/Docker/Nginx) | ██████░░░░░░ 1/2 | — | 1 |
| Fase 3 — Aplicação (React + Vite + API) | █████░░░░░░░ 3/7 | 1 | 2 |
| Fase 4 — Operações da VPS (MCP) | ░░░░░░░░░░░░ 0/1 | — | 1 |

<details><summary>Progresso por área</summary>

| Área | Progresso | Em andamento | Bloqueado |
|---|---|---|---|
| Governança & Agentes | ████████████ 3/3 | — | — |
| Banco de Dados | ████████████ 1/1 | — | — |
| Infraestrutura (VPS/Docker/Nginx) | ██████░░░░░░ 1/2 | — | 1 |
| Aplicação (React + Vite) | █████░░░░░░░ 2/5 | 1 | 2 |
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

## Em andamento agora

- `app.web` **Front React + Vite (web/)** — codex · Refinar arte Halloween conforme feedback: composicao sem fundo/moldura, titulo colorido, siglas melhores, horario laranja e cenografia mais viva.

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

- `[~]` **Front React + Vite (web/)** `app.web`<br>  Refinar arte Halloween conforme feedback: composicao sem fundo/moldura, titulo colorido, siglas melhores, horario laranja e cenografia mais viva.<br>  _evidência:_ `web: npx tsc --noEmit exit 0; npm run build exit 0 (2207 modulos); node scripts/verify-swap.js: 0 ocorrencias. VPS main 3b00358: compose --env-file /root/m7arena/.env build nginx e up -d --no-deps nginx exit 0; nginx -t successful; GET https://m7arena.pro/api/health status ok; home /, Lobby-BIRhq0ef.js e Lobby-AegqBmxy.css HTTP 200; JS publico contem CONFRONTO MARCADO.`
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

### ADR-096 — Regulamento do campeonato publicado em PDF no site

**Decisão:** O campo regulamento do campeonato e um link (o formulario admin usa type=url). O Regulamento Oficial da COPA HALLOWEEN 2026 fica em https://m7arena.pro/uploads/public-images/campeonatos/regulamento-copa-halloween-2026.pdf, com DOCX editavel no mesmo diretorio do volume de uploads. O botao Regulamento Oficial abre o PDF em nova aba.

**Por quê:** Manter o documento oficial em PDF preserva a formatacao e evita duplicar um texto longo no campo do banco; o DOCX fica como fonte editavel para a proxima versao.

_06/11/2026 00:48 — deepseek_

## Histórico de sessões

| Quando | Agente | O que fez |
|---|---|---|
| 07/11/2026 17:55 | codex | Criado e publicado poster Halloween para jogos agendados da home: portais nas cores dos times, logos sem moldura angular, lua, morcegos, teias, arvores e aboboras. Data/hora/campeonato e Twitch mantidos. Dominio extraido em componentes e hook menores que 400 linhas; carrossel pausa com hover/foco. Commit runtime 3b00358 na main e VPS. TypeScript/build/verify-swap passaram; health ok, home e chunks HTTP 200. Sem navegador conectado para revisao visual; usuario vera na live. <br>_tocou: `app.web`_ |
| 07/11/2026 14:55 | deepseek | Correção de permissões (pós-deploy 07/11): cronograma liberado para qualquer integrante aceito propor/contrapropor/aceitar o próprio jogo (estado derivado no servidor, aceite só pelo time que recebeu, confirmado trava p/ time); criar/finalizar/best_of/fase seguem só staff. Times: adicionar jogador e editar lineup liberados p/ qualquer integrante; remover e promover capitão só dono/capitão/proprietário; editar time liberado p/ integrante; transferência direta de jogador de outro time (coroa/dono anda no time de origem). Mensagens de erro reais nos modais. 286 testes ok; app/nginx publicados sem tocar realtime/postgres. <br>_tocou: `api/src/lib/team-membership.ts`, `api/src/lib/tournament-access.ts`, `api/src/routes/teams.ts`, `api/src/routes/tournaments.ts`, `api/test/tournament-access.test.ts`, `web/src/pages/TimePage.tsx`_ |
| 06/11/2026 20:24 | deepseek | Ajuste pos-deploy: atualizar resultado liberado para qualquer membro aceito dos times da serie (titular/reserva/coach), streamer e staff; endpoint de serie usa checagem direta de membership e permite streamer; sala time_vs_time livre valida membro pela tag do time; cron de series e salas livres reduzido de 3/10 min para 60 s com single-flight. 284 testes passando; app/nginx atualizados sem tocar realtime/postgres. <br>_tocou: `api/src/cron.ts`, `api/src/index.ts`, `api/src/lib/tournament-access.ts`, `api/src/routes/matches-actions.ts`, `api/src/routes/tournaments.ts`, `api/test/tournament-access.test.ts`, `web/src/features/sala-campeonato/SalaCampeonato.tsx`_ |
| 06/11/2026 18:43 | deepseek | COPA HALLOWEEN 2026: substitui CHOP (Chopp Squad) por CDR (Chidori e-Sports) no Grupo C. Chidori: registered -> approved, group_id C; CHOP removido de tournament_teams; os 3 jogos do Grupo C (BKSR x CHOP, CHOP x DLG, CHOP x BLM) viraram BKSR x CDR, CDR x DLG e CDR x BLM; a linha de standings de CHOP foi reaproveitada para CDR (rank 6). Verificado pela API: 16 inscritos/16 aprovados, Grupo C = BKSR, BLM, CDR, DLG, cronograma com CDR x BKSR/DLG/BLM e classificacao com CDR, sem CHOP. Logos: CDR foi para LOGOS GRUPO C e CHOP para LOGOS FORA. Planilha: linha 9 trocada para Chidori, totais e Resumo ajustados para 16 times. Nenhum codigo alterado. |
| 06/11/2026 02:48 | deepseek | Analise da partida 257 (sala livre MD3): AMATERASU 0x2 CDC. Dados Riot Match-V5 (BR1_3301116049 e BR1_3301147252): jogo 1 35:54 (13x21), jogo 2 31:17 (25x24). Serie: 38x45 abates, 5x20 torres, 0x4 barao, 100.550x199.419 dano a objetivos. Diagnostico: draft de janela curta (Lucian/Rakan vs Xayah/Karma; Olaf vs Darius) + execucao/macro (pick sem reset em 19:20 e 20:33-23:09; 4 baraos cedidos). Documento Word gerado em docs/analises/analise-partida-257-amaterasu-vs-cdc.docx. |
| 06/11/2026 01:49 | deepseek | COPA HALLOWEEN 2026: a pedido do usuario, troquei CHOP (Chopp Squad) por BLR (BLOOM RED) nos grupos. CHOP: Grupo B -> Grupo C; BLR: Grupo C -> Grupo B. Atualizei tournament_teams.group_id e os 6 confrontos ja sorteados (3 do Grupo B com CHOP -> BLR; 3 do Grupo C com BLR -> CHOP), em DO block com verificacoes. Nenhum jogo tinha sala/serie/resultado. Confirmado pela API: Grupo B = CDC,PHE,BLR,PTGN; Grupo C = BKSR,BLM,CHOP,DLG; cronograma BLR x CDC/PTGN/PHE e CHOP x BKSR/DLG/BLM. Tambem movi as logos BLR/CHOP entre as pastas e atualizei a coluna Grupo na planilha aberta no Excel. Sem mudanca de codigo. |
| 06/11/2026 01:36 | deepseek | Exportei as 17 logos dos times da COPA HALLOWEEN 2026 para C:\\Users\\78787\\Documents\\LOGOS, organizadas em LOGOS GRUPO A, B, C, D e LOGOS SEM GRUPO (Chidori). Baixei teams.logo_url do site e converti para PNG: 4+4+4+4+1 = 17/17 OK. Nenhum banner ou imagem extra foi salvo; nenhum codigo alterado. |
| 06/11/2026 01:24 | deepseek | Planilha Excel 'COPA HALLOWEEN 2026 - Pagamentos e Contratos.xlsx' criada em Downloads com os 17 inscritos (16 aprovados + Chidori pendente): responsavel, Discord, WhatsApp, time, sigla, grupo, status, Pago? e Contrato assinado? com listas suspensas, valores, datas e aba Resumo com totais automaticos. Pagamentos iniciam como pendentes porque o banco nao tem paid=true; aceites de termos de CDC e AMS preenchidos. Nenhum codigo alterado. |
| 06/11/2026 00:48 | deepseek | Regulamento da COPA HALLOWEEN 2026 reescrito a partir do modelo de 300 pontos e simplificado: 16 times em 4 grupos de 4, top 2 avancam, desempate em MD1, playoffs upper/lower, MD3 e final MD5; Free Elo; sala e draft gerados pela plataforma, sem Drafter.lol e sem X1; sem datas/confrontos fixos; esperar o streamer na sala; alteracoes do regulamento durante o campeonato. Gerados DOCX e PDF (Downloads) e publicados em /uploads/public-images/campeonatos/regulamento-copa-halloween-2026.pdf e .docx. Campo regulamento do torneio 9987c732-db06-4e51-8e39-e09c31fd9460 atualizado para a URL do PDF. Evidencia: HEAD do PDF 200 application/pdf (259239 bytes), HEAD do DOCX 200, e GET /api/tournaments/9987... retorna regulamento com a URL do PDF. |
| 06/11/2026 00:37 | deepseek | Campeonatos: troquei o fallback da foto do organizador no bloco Responsavel. Antes era uma imagem Unsplash (alt 'Logo Default'); agora, quando o campeonato nao tem orgPhotoUrl, exibe a logo oficial /uploads/public-images/logo-m7.png com object-contain. Validacao: tsc --noEmit exit 0 e vite build OK no web. Deploy do front na VPS a partir da main ab69030, rebuild apenas do container m7arena_nginx. Confirmado: /api/health 200; chunk CampeonatoDetalhes-CyBabsdh.js servido contem logo-m7.png e nao contem mais photo-1542751371. Sem mudanca de API, banco, rig ou export. |
| 06/11/2026 00:33 | deepseek | COPA HALLOWEEN - 2026: troquei os grupos de AMATERASU E-SPORTS (AMS) e Chopp Squad (CHOP) a pedido do usuario. AMS: Grupo B -> Grupo D; CHOP: Grupo D -> Grupo B. Atualizei tournament_teams.group_id e os 6 confrontos ja sorteados (tags e ids), em transacao com verificacao. Nenhum jogo tinha resultado, sala, live ou serie vinculada. Confirmado pela API publica: Grupo B = CDC,PHE,CHOP,PTGN; Grupo D = LDL,AMS,VLD,EMPA; cronograma com CHOP x CDC/PTGN/PHE e AMS x EMPA/LDL/VLD. Sem mudanca de codigo e sem deploy. |
| 05/11/2026 23:24 | deepseek | Inscrevi e ja aprovei o Phantom E-Sports (PHE) na COPA HALLOWEEN - 2026 (9987c732-db06-4e51-8e39-e09c31fd9460): insert em tournament_teams como approved, discord soul_adc / whatsapp 44999094022. Camp. ficou 17 inscricoes, 16 aprovados (PHE entra como 16o aprovado) + Chidori pendente; condicao de inicio (aprovados == vagas) satisfeita. Confirmado pela API publica que PHE aparece na classificacao. Nenhum codigo alterado. |
| 05/11/2026 02:11 | deepseek | Inscrevi e ja aprovei o time flexqueue (FLEX) na COPA HALLOWEEN - 2026 (9987c732-db06-4e51-8e39-e09c31fd9460): insert direto em tournament_teams como approved, discord weedinchat / whatsapp 13974191151. Camp. ficou 16/16 inscritos (15 aprovados + Chidori pendente) e FLEX aparece na classificacao pela API publica. Nenhum codigo alterado. |
| 05/11/2026 00:21 | deepseek | Deploy da simplificacao aprovada em producao: merge --no-ff na main (8ee9e0a), backup novo do PostgreSQL validado por restore em DB temporario (48 tabelas; users 449/matches 58/wallets 324; mc 13622/reservado 0), uploads 304 arquivos preservados, imagens de rollback salvas. Deploy somente app/nginx; realtime (id 8f2710) e postgres preservados; sem migration. Health publico 200; login/sessao, OP.GG, salas/scrim/campeonato, PDL e privacidade Pix validados; 403 para funcoes admin por usuario comum. Pacote instalado: app sha256:56456f8..., nginx sha256:59a3c6b.... <br>_tocou: `api/src`, `web/src`, `infra`, `docs`, `main`, `deploy-vps`_ |
| 04/11/2026 23:41 | deepseek | Homologacao local da simplificacao: stack Docker local com banco isolado m7arena_homolog; navegador testou cadastro/login/perfil, catalogo com OP.GG, times, campeonatos, salas 5v5 e 1v1 completa ate iniciar partida, scrim, carteira E, admin. Corrigidos bugs de homologacao e seguranca: perfil publico sem Pix, saldo de terceiros so admin, escrita de campeonato por staff, inscricao sem autoaprovacao, lineup sem sequestro, tick autenticado, refresh-elo removido, convidado so por PUUID. Auditoria read-only de producao: 0 salas aguardando_revisao, 0 reservas, 13 prints e 2 disputas historicas encerradas. Evidencias: web lint/build, api tsc/build, 283 testes API passando, verify-swap 0. Sem deploy/migration; main intacta. <br>_tocou: `web/src`, `api/src`, `api/test`, `infra`, `docs`, `ESTRUTURA_ATUALIZADA_2026-11-04.md`, `docs/HOMOLOGACAO_SIMPLIFICACAO.md`_ |

---

_Gerado pelo MCP `m7-status`. Regras para agentes: veja `AGENTS.md` na raiz._
