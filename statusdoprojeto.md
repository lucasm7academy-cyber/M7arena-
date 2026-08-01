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

**Última atualização:** 01/08/2026 00:41 — por `claude`

**Objetivo:** Migrar o M7Academy (React+Vite+Supabase+Vercel, m7academy.pro) para VPS própria com PostgreSQL e Next.js, sob o domínio m7arena.pro, mantendo o design idêntico e trocando só o motor.

## Panorama

`███░░░░░░░░░░░░░░░░░░░░░░░░░ 6/62` concluído

| Fase | Progresso | Em andamento | Bloqueado |
|---|---|---|---|
| Fase 0 — Governança multi-agente | ████████████ 6/6 | — | — |
| Fase 1 — Schema do banco | ░░░░░░░░░░░░ 0/11 | 1 | — |
| Fase 2 — Infraestrutura (Docker/VPS) | ░░░░░░░░░░░░ 0/7 | — | — |
| Fase 3 — Aplicação (port visual 1:1) | ░░░░░░░░░░░░ 0/29 | — | — |
| Fase 4 — MCP de operações da VPS | ░░░░░░░░░░░░ 0/2 | — | — |
| Fase 5 — Migração de dados e cutover | ░░░░░░░░░░░░ 0/7 | — | — |

<details><summary>Progresso por área</summary>

| Área | Progresso | Em andamento | Bloqueado |
|---|---|---|---|
| Governança & Agentes | ████████████ 6/6 | — | — |
| Banco de Dados | ░░░░░░░░░░░░ 0/11 | 1 | — |
| Infraestrutura (Docker/VPS) | ░░░░░░░░░░░░ 0/7 | — | — |
| Aplicação (Next.js) | ░░░░░░░░░░░░ 0/19 | — | — |
| Design & Paridade Visual | ░░░░░░░░░░░░ 0/6 | — | — |
| MCP de Operações | ░░░░░░░░░░░░ 0/2 | — | — |
| Migração de Dados | ░░░░░░░░░░░░ 0/6 | — | — |
| Segurança | ░░░░░░░░░░░░ 0/5 | — | — |

</details>

## Pode pegar agora

Componentes com todas as dependências satisfeitas. Marque como `doing` antes de começar.

- `db.descarte` **Não migrar as 15 tabelas mortas** — Fase 1 — Schema do banco
- `infra.vps` **VPS contratada e acessível** — Fase 2 — Infraestrutura (Docker/VPS)
- `infra.compose` **docker-compose.yml (7 serviços)** — Fase 2 — Infraestrutura (Docker/VPS)
- `infra.postgres` **postgresql.conf tunado para 8GB / 2 vCPU** — Fase 2 — Infraestrutura (Docker/VPS)
- `infra.ci` **Build da imagem no CI (não na VPS)** — Fase 2 — Infraestrutura (Docker/VPS)
- `app.setup` **Next.js 15 App Router + Tailwind 4** — Fase 3 — Aplicação (port visual 1:1)
- `mig.extract` **Extract do Supabase** — Fase 5 — Migração de dados e cutover
- `sec.rotacao` **Rotacionar segredos antes do cutover** — Fase 5 — Migração de dados e cutover

## Em andamento agora

- `db.setup` **Drizzle + migrations versionadas** — gemini · Iniciando configuracao do Drizzle ORM e infraestrutura de migrations versionadas

## Componentes

Legenda: `[ ]` A fazer · `[~]` Em andamento · `[x]` Concluído · `[!]` Bloqueado · `[-]` Descartado

### Fase 0 — Governança multi-agente

- `[x]` **MCP m7-status (este servidor)** `gov.mcp.status`<br>  Tools tipadas sobre project-state.json; statusdoprojeto.md é renderizado, nunca escrito à mão.<br>  _evidência:_ `mcp/status-server/index.js`<br>  _concluído 01/08/2026 00:18 por claude_
- `[x]` **AGENTS.md — regras vinculantes para todo agente** `gov.agents`<br>  Fonte única. CLAUDE.md e GEMINI.md são ponteiros de uma linha para ele.<br>  _evidência:_ `AGENTS.md`<br>  _concluído 01/08/2026 00:18 por claude_
- `[x]` **Registro do MCP nos clientes** `gov.mcp.registro`<br>  .mcp.json (Claude Code) + opencode.json + instruções para Gemini CLI.<br>  _evidência:_ `.mcp.json`<br>  _concluído 01/08/2026 00:18 por claude_
- `[x]` **ARQUITETURA.md** `gov.docs.arquitetura`<br>  Modelo de domínio, camadas, invariantes e o que preservar do app atual.<br>  _evidência:_ `docs/ARQUITETURA.md`<br>  _concluído 01/08/2026 00:18 por claude_
- `[x]` **PLANO_MIGRACAO.md** `gov.docs.plano`<br>  Documento central: fases, ordem de execução, mapeamento de dados e cutover.<br>  _evidência:_ `docs/PLANO_MIGRACAO.md`<br>  _concluído 01/08/2026 00:18 por claude_
- `[x]` **Repositório git inicializado** `gov.repo`<br>  Repo local + remoto github.com/lucasm7academy-cyber/M7arena- (branch main). .gitignore cobre .env, dumps de migracao, node_modules e o lock do MCP.<br>  _evidência:_ `git remote: origin/main`<br>  _concluído 01/08/2026 00:33 por claude_

### Fase 1 — Schema do banco

- `[~]` **Drizzle + migrations versionadas** `db.setup`<br>  Iniciando configuracao do Drizzle ORM e infraestrutura de migrations versionadas
- `[ ]` **Núcleo de identidade unificado** `db.identidade`<br>  users + user_identities + user_roles(N:N) + user_wallets + user_payout_info. Resolve a fragmentação em 8 tabelas sem FK entre si.<br>  _espera:_ `db.setup`
- `[ ]` **Multi-jogo: games + game_accounts** `db.games`<br>  Substitui contas_riot. Já aceita um 2º jogo sem migration grande depois.<br>  _espera:_ `db.setup`
- `[ ]` **teams + team_members + team_stats** `db.teams`<br>  team_stats separada porque recalcular_pdl_global hoje faz UPDATE na tabela times inteira. Ganha season_id.<br>  _espera:_ `db.identidade`, `db.games`
- `[ ]` **tournaments normalizado (mata o JSONB gigante)** `db.tournaments`<br>  tournament_teams/groups/matches substituem cronograma+bracket_data+classificacao+times_inscritos. Resolve o campeonatos_audit que duplica 5 blobs por update.<br>  _espera:_ `db.teams`
- `[ ]` **matches + match_players + match_results + match_codes** `db.matches`<br>  Sem snapshot desnormalizado em match_players — hoje quem troca de nick fica com o antigo em todo o histórico.<br>  _espera:_ `db.identidade`, `db.games`
- `[ ]` **Ledger: wallet_transactions + payments + referral_events** `db.economia`<br>  Saldo vira derivável e auditável (balance_after). Hoje wallets é um número solto sem rastro.<br>  _espera:_ `db.identidade`
- `[ ]` **news + highlights + broadcasts + recruitment_posts + notifications** `db.conteudo`<br>  _espera:_ `db.identidade`
- `[ ]` **Índices a partir das queries reais** `db.indices`<br>  Não especulativos: game_accounts(game_id,external_id), tournament_matches(tournament_id,phase,scheduled_at), wallet_transactions(user_id,created_at DESC), teams(game_id,LOWER(tag)) único.<br>  _espera:_ `db.identidade`, `db.games`, `db.teams`, `db.tournaments`, `db.matches`, `db.economia`, `db.conteudo`
- `[ ]` **Retenção: audit_log particionado + jobs de purge** `db.retencao`<br>  A limpeza de 30 dias prometida em 20260527000002:322 e nunca implementada.<br>  _espera:_ `db.setup`
- `[ ]` **Não migrar as 15 tabelas mortas** `db.descarte`<br>  drafts, scrims, sala_chat, transacoes, admin_logs, campeonato_times, campeonato_jogadores, vip_assinaturas, screens, campeonatos_audit, twitch_lives_ativas, votos_jogos, edge_function_logs, discord_oauth_state + 5 views.

### Fase 2 — Infraestrutura (Docker/VPS)

- `[ ]` **VPS contratada e acessível** `infra.vps`<br>  2 vCPU / 8GB / 100GB NVMe. Pendente do usuário. Bloqueia tudo que roda remoto.
- `[ ]` **docker-compose.yml (7 serviços)** `infra.compose`<br>  postgres, pgbouncer, app, realtime, nginx, backup, mcp-ops.
- `[ ]` **postgresql.conf tunado para 8GB / 2 vCPU** `infra.postgres`<br>  shared_buffers=2GB, effective_cache_size=4GB, work_mem=16MB, random_page_cost=1.1 (NVMe).
- `[ ]` **PgBouncer em transaction mode** `infra.pgbouncer`<br>  Duas armadilhas: quebra prepared statements (client precisa prepare:false) e mata LISTEN/NOTIFY (realtime conecta direto no Postgres).<br>  _espera:_ `infra.compose`, `infra.postgres`
- `[ ]` **Nginx: proxy reverso + TLS + estáticos** `infra.nginx`<br>  Headers de segurança portados de vercel.json:14-18, que já estão corretos.<br>  _espera:_ `infra.compose`
- `[ ]` **Backup com restore testado e cópia off-site** `infra.backup`<br>  Backup dentro da própria VPS morre junto com ela. Restore não testado não é backup.<br>  _espera:_ `infra.compose`, `infra.postgres`
- `[ ]` **Build da imagem no CI (não na VPS)** `infra.ci`<br>  2 vCPU não aguenta build de Next.js com folga.<br>  _dependências satisfeitas — liberado_

### Fase 3 — Aplicação (port visual 1:1)

**Aplicação (Next.js)**

- `[ ]` **Next.js 15 App Router + Tailwind 4** `app.setup`
- `[ ]` **Auth.js v5 (Google + credenciais)** `app.auth`<br>  Hashes bcrypt do GoTrue continuam válidos. Some o patch de OAuth espalhado em 4 arquivos + loop de retry de 15s.<br>  _espera:_ `app.setup`, `db.identidade`
- `[ ]` **Camada de dados (features/*/server)** `app.data`<br>  Hoje 18 dos 61 arquivos importam supabase direto dentro de componentes de UI.<br>  _espera:_ `app.setup`, `db.setup`
- `[ ]` **PerfilContext portado** `app.perfil-context`<br>  Preservar: query agregadora + Provider acima do Router + invalidação por push. Corrigir: catch vazio em PerfilContext.tsx:148 deixa o perfil null para sempre.<br>  _espera:_ `app.data`, `app.auth`
- `[ ]` **Serviço WebSocket + NOTIFY** `app.realtime`<br>  Escopo: salas/lobbies apenas, como hoje. Existe exatamente 1 canal realtime em todo o produto.<br>  _espera:_ `db.matches`, `infra.pgbouncer`
- `[ ]` **Workers: Twitch cron, webhook MP, sync Riot** `app.workers`<br>  Substituem as Edge Functions. update-sala-team NÃO é portada (sem auth, service role, updates arbitrário).<br>  _espera:_ `app.data`
- `[ ]` **Proxy /api/riot/* com cache** `app.riot-proxy`<br>  _espera:_ `app.data`
- `[ ]` **Port: Quem Somos, Políticas, Tutorial, Minhas Partidas** `app.port.institucional`<br>  _espera:_ `design.tokens`, `app.setup`
- `[ ]` **Port: Perfil** `app.port.perfil`<br>  713 linhas.<br>  _espera:_ `design.tokens`, `app.perfil-context`
- `[ ]` **Port: Players / ranking** `app.port.players`<br>  1.026 linhas.<br>  _espera:_ `design.tokens`, `app.data`, `db.games`
- `[ ]` **Port: Recrutamento** `app.port.recrutamento`<br>  Única feature com separação page/api/types limpa hoje.<br>  _espera:_ `design.tokens`, `app.data`
- `[ ]` **Port: Streamers / transmissões** `app.port.streamers`<br>  _espera:_ `design.tokens`, `app.data`
- `[ ]` **Port: Carteira, depósito e VIP** `app.port.carteira`<br>  _espera:_ `design.tokens`, `app.data`, `db.economia`
- `[ ]` **Port: Vincular Riot + Discord** `app.port.vincular`<br>  _espera:_ `design.tokens`, `app.riot-proxy`
- `[ ]` **Port: Times (listagem + página do time)** `app.port.times`<br>  TimePage 1.943 linhas com 40 useState e 5 modais embutidos. handleSairTime faz 6 writes não-transacionais.<br>  _espera:_ `design.tokens`, `app.data`, `db.teams`
- `[ ]` **Port: Admin (saldos, ranking, notícias, cargos)** `app.port.admin`<br>  1.940 linhas. Já é o melhor estruturado dos monstros — 6 abas separadas.<br>  _espera:_ `design.tokens`, `app.data`
- `[ ]` **Port: Lobby / home** `app.port.lobby`<br>  1.726 linhas, 10 cards inline, 4 caches manuais. fetchUpcoming baixa TODOS os campeonatos inteiros para montar um carrossel.<br>  _espera:_ `design.tokens`, `app.data`, `db.conteudo`
- `[ ]` **Port: Jogar / Sala / Lobby de partida** `app.port.salas`<br>  Preservar a arquitetura do useSalaSimples: servidor como única autoridade, timers derivados, tick idempotente. É o melhor código do projeto.<br>  _espera:_ `design.tokens`, `app.realtime`, `db.matches`
- `[ ]` **Port: Campeonatos** `app.port.campeonatos`<br>  CampeonatoDetalhes 5.856 linhas (4.482 num componente, 2.674 de JSX num return) + createCampPage 2.044. Recorte em ~15 arquivos, JSX movido como está.<br>  _espera:_ `design.tokens`, `app.data`, `db.tournaments`

**Design & Paridade Visual**

- `[ ]` **Tokens, utilities, keyframes e scrollbar** `design.tokens`<br>  Cópia literal de index.css:4-118 — 13 cores, 6 utilities, 2 keyframes, scrollbar dourada 4px.<br>  _espera:_ `app.setup`<br>  _evidência:_ `M7AcademySite/src/index.css:4-118`
- `[ ]` **Inter + Outfit via next/font** `design.fontes`<br>  Mesma renderização, sem request externo e sem FOUC.<br>  _espera:_ `app.setup`
- `[ ]` **motion v12 + lucide-react + react-icons** `design.libs`<br>  Mesmas libs e versões — 78 imports em 35 arquivos. Todas rodam em Next 15.<br>  _espera:_ `app.setup`
- `[ ]` **public/ portado (40 imagens, lanes, ranks, sounds)** `design.assets`<br>  45,7 MB. Mesmos arquivos e caminhos; next/image entrega WebP/AVIF a partir do mesmo PNG.<br>  _espera:_ `app.setup`
- `[ ]` **ElectricBorder + VipBadge/VipCrown** `design.ui`<br>  Copiados literais. VipBadge já tem 'use client'.<br>  _espera:_ `design.tokens`
- `[ ]` **Regressão visual antigo vs novo** `design.regressao`<br>  Reaproveitar o MCP de browser com Playwright do projeto atual para screenshot comparado, desktop e mobile.<br>  _espera:_ `design.tokens`

**Segurança**

- `[ ]` **Tirar a chave da Riot do bundle** `sec.riot-key`<br>  Hoje qualquer visitante extrai a key do JS.<br>  _espera:_ `app.riot-proxy`<br>  _evidência:_ `M7AcademySite/src/api/riot.ts:5`
- `[ ]` **Remover o PIX pessoal de fallback** `sec.pix`<br>  Se a função de pagamento cai, o usuário paga numa conta pessoal sem registro.<br>  _espera:_ `app.port.carteira`<br>  _evidência:_ `M7AcademySite/src/components/modals/vip/VipModal.tsx:143`
- `[ ]` **Mover regras de negócio para o servidor** `sec.regras-servidor`<br>  Payout de aposta, quórum que decide o vencedor da partida, classificação e desempate de campeonato.<br>  _espera:_ `app.data`
- `[ ]` **Upload restrito por dono** `sec.upload`<br>  Hoje qualquer usuário logado sobrescreve a logo de qualquer time.<br>  _espera:_ `app.data`

### Fase 4 — MCP de operações da VPS

- `[ ]` **MCP de operações da VPS** `mcpops.server`<br>  vps_health, logs_tail, db_query (read-only), http_check, migration_status, deploy/rollback, metrics.<br>  _espera:_ `infra.vps`
- `[ ]` **Blindagem do MCP de ops** `mcpops.seguranca`<br>  Bearer token + bind 127.0.0.1 + acesso por túnel SSH/Tailscale. Role Postgres read-only com statement_timeout. Isso é um shell remoto — nunca exposto na internet.<br>  _espera:_ `mcpops.server`

### Fase 5 — Migração de dados e cutover

**Migração de Dados**

- `[ ]` **Extract do Supabase** `mig.extract`
- `[ ]` **Transform: identidade** `mig.identidade`<br>  auth.users + profiles + contas_riot + wallets + platform_roles + discord_links → users e satélites.<br>  _espera:_ `mig.extract`, `db.identidade`
- `[ ]` **Transform: explodir o JSONB de campeonatos** `mig.campeonatos`<br>  cronograma/bracket_data/classificacao → tournament_matches. O passo mais difícil; exige relatório de divergências, não conversão cega.<br>  _espera:_ `mig.extract`, `db.tournaments`
- `[ ]` **Load no Postgres da VPS** `mig.load`<br>  _espera:_ `mig.identidade`, `mig.campeonatos`
- `[ ]` **verify-migration.sql** `mig.verify`<br>  Contagens e somas de controle origem vs destino. Só aceita com divergência zero.<br>  _espera:_ `mig.load`
- `[ ]` **Cutover: re-sync + DNS + TLS** `mig.cutover`<br>  Registro A de m7arena.pro na Hostinger. m7academy.pro fica no ar intacto como fallback.<br>  _espera:_ `mig.verify`, `infra.vps`, `sec.rotacao`

**Segurança**

- `[ ]` **Rotacionar segredos antes do cutover** `sec.rotacao`<br>  Chave Riot (exposta no bundle), token Mercado Livre (commitado em opencode.json:15), e confirmar rotação das credenciais Supabase compartilhadas na migração US→BR.

## Decisões (ADR)

### ADR-001 — Stack: Next.js 15 + serviço WS separado

**Decisão:** Next.js 15 App Router serve front e rotas de API; um processo Node separado cuida do WebSocket das salas e dos workers.

**Por quê:** Unifica front e back num deploy, resolve a chave Riot no cliente via route handlers e dá SSR/SEO. Next não hospeda WebSocket bem, por isso o segundo processo. Build roda no CI porque 2 vCPU não aguenta.

_01/08/2026 00:18 — claude_

### ADR-002 — Auth: Auth.js v5 no Postgres próprio

**Decisão:** Autenticação própria com Auth.js v5, sem GoTrue.

**Por quê:** Os hashes do GoTrue são bcrypt e continuam válidos, então nenhum dos 117 usuários precisa resetar senha; o Google OAuth reconecta pelo mesmo email. Sai 100% do Supabase e economiza um container.

_01/08/2026 00:18 — claude_

### ADR-003 — Migração: import inicial + re-sync no cutover

**Decisão:** Importar o snapshot agora para desenvolver com dados reais, e rodar re-sync incremental do delta na virada do DNS.

**Por quê:** Permite testar com os dados de verdade desde o dia 1, em vez de descobrir problemas na virada. m7academy.pro não é tocado.

_01/08/2026 00:18 — claude_

### ADR-004 — Extensibilidade: schema multi-jogo desde o v1

**Decisão:** Tabelas games e game_accounts, com game_id em campeonato, sala e time. Features continuam só de LoL. Afiliados entra como referred_by + referral_events, sem UI.

**Por quê:** O custo de generalizar agora é baixo; fazer retrofit disso depois, com dados em produção, é caro.

_01/08/2026 00:18 — claude_

### ADR-005 — Design: paridade visual total

**Decisão:** O site novo é visualmente indistinguível do atual. Mesmas cores, fontes, ícones, imagens, espaçamentos e layout. Só o motor muda.

**Por quê:** O produto visual já está pronto e validado. Redesenhar seria retrabalho e risco sem retorno. Quebrar arquivo grande é recorte de JSX, não redesign.

_01/08/2026 00:18 — claude_

### ADR-006 — ORM: Drizzle

**Decisão:** Drizzle ORM com migrations SQL versionadas.

**Por quê:** Leve, SQL-first e compatível com PgBouncer em transaction mode usando prepare:false.

_01/08/2026 00:18 — claude_

### ADR-007 — Storage: disco local servido pelo Nginx

**Decisão:** Uploads em volume Docker, servidos pelo Nginx. Sem MinIO.

**Por quê:** O volume de imagens de usuário é da ordem de 50 MB. MinIO seria um serviço a mais consumindo RAM em 2 vCPU sem ganho.

_01/08/2026 00:18 — claude_

### ADR-008 — Governança: MCP com operações tipadas, não markdown livre

**Decisão:** O statusdoprojeto.md é renderizado a partir de docs/project-state.json. Agentes só escrevem via tools tipadas.

**Por quê:** Markdown livre editado por vários agentes vira, em semanas, um arquivo com formatos divergentes e conflitos de escrita. Operações tipadas garantem formato idêntico entre Claude, Gemini e DeepSeek.

_01/08/2026 00:18 — claude_

## Histórico de sessões

| Quando | Agente | O que fez |
|---|---|---|
| 01/08/2026 00:21 | claude | Fase 0 concluída. Mapeei o M7AcademySite inteiro (48 migrations + dump + 29.420 linhas de front) e montei a governança: MCP m7-status com 9 tools tipadas, statusdoprojeto.md renderizado, AGENTS.md vinculante com CLAUDE.md/GEMINI.md como ponteiros, registro do MCP para Claude Code / Gemini CLI / OpenCode, ARQUITETURA.md e PLANO_MIGRACAO.md autossuficientes, estado inicial com 62 componentes e 8 ADRs, e git init. Smoke test do MCP passou em 11 checks. Próximo passo: Fase 1 (schema) e Fase 2 (infra) podem correr em paralelo; a VPS ainda não foi contratada (infra.vps). <br>_tocou: `mcp/status-server/`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `docs/ARQUITETURA.md`, `docs/PLANO_MIGRACAO.md`, `docs/project-state.json`, `.mcp.json`, `.gemini/settings.json`, `opencode.json`, `.gitignore`_ |

---

_Gerado pelo MCP `m7-status`. Regras para agentes: veja `AGENTS.md` na raiz._
