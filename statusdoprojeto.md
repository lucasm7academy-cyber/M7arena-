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

**Última atualização:** 31/10/2026 04:19 — por `deepseek`

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
| 31/10/2026 04:19 | deepseek | Draft: bans subiram (top 2.5->1.4vmin) e ganharam mais respiro da barra do timer (container 152->158vmin); icones do topo andaram um pouco para o centro (right 1.5->8vmin), continuando abaixo da linha de bans. Commit f269f2d, deploy ok, health 200. <br>_tocou: `web/src/components/draft/DraftRoom.tsx`_ |
| 31/10/2026 04:15 | deepseek | Draft: ajuste fino do espacamento. Container dos bans 140->152vmin (max-w), criando ~4-5vmin de respiro entre o ultimo ban e a barra azul/vermelha do timer, mantendo os bans perto do bloco FASE. Icones do topo (resetar/verificar/twitch/mudo) descem para top-12vmin, logo abaixo da linha de bans (continuam no alto, sem colidir com o ultimo ban). tsc 0, build ok, commit 67507fe, deploy ok (DraftRoom-DMCiPsye.js, health 200). <br>_tocou: `web/src/components/draft/DraftRoom.tsx`_ |
| 31/10/2026 04:11 | deepseek | Draft: bans agora CENTRALIZADOS (container max-w-140vmin, left-1/2) — ficam encostados no bloco 'FASE DE BANS/PICKS' em vez de colados nas bordas; tamanho 7.2vmin e top 2.5vmin mantidos. Icones do topo (resetar/verificar/twitch/mudo) voltaram pro canto superior direito (top-1vmin right-1.5vmin) — com o container de 140vmin eles nao sobrepoem mais o ultimo ban. Commit 8b40961, deploy VPS ok, health 200. <br>_tocou: `web/src/components/draft/DraftRoom.tsx`_ |
| 31/10/2026 04:07 | deepseek | Draft: bans maiores e mais altos. BanSlot 6->7.2vmin, icone interno 3.6->4.3vmin, gap 1->0.9vmin, rotulo 1->1.1vmin; faixa de bans subiu de top-5vmin para top-2.5vmin (encostada na faixa do timer). Icones do topo (resetar/verificar/twitch/mudo) movidos do topo-direita para o canto inferior direito (bottom-2vmin right-4vmin) para nao cobrir o ultimo ban. tsc 0, check-cut-borders ok, commit 8687f6a na main, deploy VPS ok (/api/health 200, chunk DraftRoom-s2IbL3Mn.js com as classes novas). <br>_tocou: `web/src/components/draft/DraftRoom.tsx`_ |
| 31/10/2026 04:00 | deepseek | AGENTS.md: pasta principal D:\Aplicativos\M7arenaSite sempre na main e atualizada; agentes sincronizam no fim. ADR-095 registrada. <br>_tocou: `AGENTS.md`, `docs/project-state.json`, `statusdoprojeto.md`_ |
| 31/10/2026 03:40 | deepseek | Documenta modo local vs VPS no AGENTS.md: padrao sobe na VPS; modo local so sobe com 'pode subir'; aviso quando a main esta a frente da VPS. Registra ADR-094. <br>_tocou: `AGENTS.md`, `docs/project-state.json`, `statusdoprojeto.md`_ |
| 31/10/2026 03:36 | deepseek | Status enxugado: removido o histórico da migração antiga; ficaram só componentes, ADRs e blockers atuais do M7Arena em produção. AGENTS.md agora exige worktree próprio + commit/push na main; deploy só da main commitada. Supabase zero (verify-swap 0). <br>_tocou: `AGENTS.md`, `mcp/status-server/lib/plan.js`, `docs/project-state.json`, `web/src`, `api/src`_ |

---

_Gerado pelo MCP `m7-status`. Regras para agentes: veja `AGENTS.md` na raiz._
