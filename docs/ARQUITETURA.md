# ARQUITETURA — M7Arena

Documento de referência técnica. Leia antes de escrever código.
As regras de trabalho estão em [`../AGENTS.md`](../AGENTS.md); o status atual, em [`../statusdoprojeto.md`](../statusdoprojeto.md).

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Front + API | Next.js 15 (App Router), React 19, TypeScript `strict` |
| Estilo | TailwindCSS 4 (CSS-first, `@theme`) |
| Banco | PostgreSQL 16 + PgBouncer |
| ORM | Drizzle (migrations SQL versionadas) |
| Auth | Auth.js v5 (Google OAuth + credenciais) |
| Realtime | Serviço Node separado (`ws` + `pg` LISTEN/NOTIFY) |
| Infra | Docker Compose + Nginx (proxy reverso, TLS) na VPS |
| Animação/ícones | `motion` v12, `lucide-react`, `react-icons` — **as mesmas do site atual** |

VPS: 2 vCPU, 8 GB RAM, 100 GB NVMe. **O gargalo é CPU, não disco** — o dump de dados atual tem ~3 MB. Por isso a imagem do Next.js é construída no CI, nunca na VPS.

---

## 2. Estrutura de pastas

```
src/
  app/
    (public)/         landing, campeonatos, notícias — SSR, indexável
    (app)/            área logada
    api/              route handlers
  features/<dominio>/
    domain/           regras puras, sem React, testáveis isoladamente
    server/           acesso a dados e ações (server-only)
    components/       JSX portado do site atual
    hooks/
  components/ui/      primitivos compartilhados
  lib/                db, auth, riot-client, storage
db/
  schema/             tabelas Drizzle
  migrations/         SQL versionado
infra/                docker-compose, postgresql.conf, pgbouncer.ini, nginx.conf
scripts/migrate/      extract / transform / load do Supabase
```

Domínios: `auth`, `perfil`, `times`, `campeonatos`, `partidas`, `carteira`, `recrutamento`, `streams`, `conteudo`, `admin`.

**Regra de tamanho:** nenhum arquivo passa de ~400 linhas.

---

## 3. Modelo de dados

O princípio: **uma identidade, satélites justificados**. O site atual espalha o mesmo usuário por 8 tabelas sem FK entre si; aqui há uma `users` central, e cada tabela separada existe por um motivo explícito.

### 3.1 Identidade

```sql
users                 id, email, email_verified, password_hash, display_name,
                      avatar_url, bio, socials jsonb, status,
                      is_vip, vip_expires_at,
                      referred_by → users.id,
                      created_at, updated_at, deleted_at

user_identities       user_id, provider ('google'|'discord'|'credentials'),
                      provider_account_id
                      -- padrão Auth.js; absorve o antigo discord_links

user_sessions         -- Auth.js

user_roles            user_id, role
                      -- N:N. Um usuário pode ser streamer E organizador.

user_wallets          user_id PK, mp, mc

user_payout_info      user_id PK, pix_type, pix_key, pix_name
```

Por que `user_wallets` e `user_payout_info` não estão dentro de `users`:

- **Carteira** é linha quente (escrita a cada partida). Separar evita bloat e vacuum constante na `users`, que é lida o tempo todo.
- **PIX** é dado financeiro pessoal. Merece grant e auditoria próprios, não deve vir junto num `SELECT *` de perfil.

Isso é normalização justificada, não a fragmentação do sistema antigo — todo o resto do perfil (nome, avatar, bio, lanes, redes sociais, VIP) vive em `users`.

### 3.2 Multi-jogo

```sql
games                 id (slug: 'lol'), name, active

game_accounts         user_id, game_id,
                      external_id,     -- puuid no caso do LoL
                      handle,          -- riot_id
                      verified, metadata jsonb, synced_at
                      UNIQUE(user_id, game_id)
                      UNIQUE(game_id, external_id)
```

Substitui `contas_riot`. O `metadata jsonb` guarda elo e campeões em cache. Um segundo jogo entra sem migration estrutural.

### 3.3 Times

```sql
teams                 id, game_id, name, tag, logo_url, owner_id, status,
                      contacts jsonb

team_members          team_id, user_id (nullable), guest_handle,
                      role_slot, is_captain, status

team_stats            team_id, season_id, pdl, wins, losses, ranking
```

`team_stats` é separada porque o recálculo global de ranking reescreve todas as linhas — misturar isso com os dados cadastrais do time faria cada recálculo invalidar cache de tudo. `season_id` é novo: hoje o ranking é eterno.

`team_members.user_id` é nullable para suportar convidados sem conta, que hoje existem como colunas `guest_*`.

### 3.4 Campeonatos — normalizado

```sql
tournaments           id, game_id, slug, name, format, status, organizer_id,
                      prize jsonb, registration_opens_at, starts_at, ends_at,
                      frase, logo_url, banner_url, org_photo_url, theme_color,
                      regulamento, vagas, times_por_grupo, classificados_por_grupo,
                      tier, data, premiacao, taxa, tem_outros_premios,
                      outros_premios, organizacao,
                      seed_order text[], grupos_sorteados bool, chaves_sorteados bool

tournament_teams      tournament_id, team_id, status ('registered'|'approved'|'rejected'),
                      paid, discord, whatsapp, group_id

tournament_groups     id, tournament_id, name

tournament_matches    id, tournament_id, phase, round, group_id,
                      team_a_id, team_b_id, score_a, score_b,
                      match_key, phase_label, team_a_tag, team_b_tag,
                      display_date, display_time, score_display, proposed_by,
                      scheduled_at, status, bracket_slot, next_match_id

bracket_matches       id, tournament_id, section, round, slot,
                      team_a_tag, team_b_tag, team_a_id, team_b_id,
                      score_a, score_b, winner_side

tournament_standings  id, tournament_id, team_id, rank, v, d, wo, j, cor, logo
```

Esta é a mudança mais importante do schema. No site atual, um campeonato inteiro (inscritos, grupos, cronograma, chaveamento e classificação) vive em **sete blobs JSONB numa única linha**, e um trigger de auditoria grava uma cópia de cinco desses blobs **a cada update**. Editar um placar reescreve o torneio inteiro duas vezes.

**ADR-016** eliminou de vez os 8 blobs JSONB (a ADR-014 os havia reintroduzido temporariamente para servir o fork do front). A API (`api/src/lib/tournament-shape.ts` + `tournament-store.ts`) reconstrói o shape legado 1:1 que as telas do fork consomem — o front não mudou uma linha. O que era blob vira:

- `times_inscritos` → `tournament_teams` (com `paid`/`discord`/`whatsapp`)
- `cronograma` → `tournament_matches` (com snapshots de tag e strings de exibição)
- `bracket_data` → `bracket_matches` (células da árvore double-elimination)
- `grupos` → `tournament_groups` + `tournament_teams.group_id`
- `classificacao` → `tournament_standings` (fallback manual; o shape deriva do cronograma)
- `times_ordem_sorteio` → `tournaments.seed_order` (text[])
- `grupos_sorteados`/`chaves_sorteados` → booleanos

**Ressalva documentada:** `bracket_matches` e `tournament_matches` guardam **snapshots de tag + strings de exibição** (shape de UI que o fork renderiza), com ids resolvidos quando a tag casa com um time. É "relacional com ressalva", não relacional puro — o preço da paridade 1:1 (ADR-005).

A classificação é **derivada** no servidor (shape) a partir dos jogos finalizados do cronograma, com fallback para `tournament_standings` quando não há jogos.

### 3.5 Partidas

```sql
matches               id, game_id, mode, status, created_by, room_code,
                      winner_side, entry_mp, state_deadline_at,
                      created_at, ended_at

match_players         match_id, user_id, side, slot, role_slot,
                      confirmed, linked

match_results         match_id, winner_side, payload jsonb, settled_at

match_codes           pool de tournament codes do LoL
```

`match_players` **não** guarda snapshot de nome, tag, elo ou avatar — faz join. No sistema atual esses campos são copiados no INSERT e nunca atualizados, então quem troca de nick aparece com o nome antigo em todo o histórico.

`match_results.payload` é a exceção: histórico imutável deve mesmo congelar o estado.

Estados da partida: `preenchendo → confirmacao → iniciando → em_andamento → finalizacao → encerrada`, mais `cancelada`. **A máquina de estados roda inteira no servidor.**

### 3.6 Economia — ledger

```sql
wallet_transactions   id, user_id, currency ('mp'|'mc'), amount (com sinal),
                      kind, ref_type, ref_id, balance_after, created_at
                      -- imutável, append-only

payments              id, user_id, gateway, gateway_ref, product,
                      amount_brl, status, created_at, paid_at

platform_revenue      match_id, mc_fee, created_at

referral_events       referrer_id, referred_id, event_type, value, created_at
```

`user_wallets` guarda o saldo corrente para leitura rápida; `wallet_transactions` é a verdade auditável. `balance_after` permite reconstruir e conferir. Toda escrita de saldo acontece na mesma transação do lançamento.

> **Sistema de moedas (MC/MP):** o plano consolidado está em
> [`planos/plano-m7coins.md`](./planos/plano-m7coins.md). O MC é moeda global
> (`user_wallets.mc` + `mc_reservado` para escrow das salas apostadas); o fluxo
> de aposta → reserva → payout/empate/cancelamento com taxa da plataforma está
> implementado em `api/src/lib/escrow.ts` + `api/src/routes/revisao.ts` (design
> v3). O `mp` (M7 Points) é moeda de pontos/ranking, sem fluxo de aposta.

### 3.7 Conteúdo

`news`, `highlights`, `broadcasts`, `recruitment_posts`, `notifications`.

### 3.8 Retenção

`audit_log` particionado por mês, com drop automático das partições antigas. Jobs de purge (`pg_cron`): estados de OAuth acima de 10 minutos, partidas encerradas há mais de 90 dias arquivadas.

O sistema atual prometeu retenção de 30 dias num comentário de migration e nunca a implementou. Aqui a retenção entra junto com a tabela, não depois.

---

## 4. Padrões da aplicação

### 4.1 Cache de perfil no cliente

O site atual tem um padrão que **funciona e deve ser preservado**:

1. Uma única consulta agregadora carrega perfil, conta do jogo, saldo, cargo e time de uma vez.
2. O Provider fica **acima do Router**, então não desmonta ao navegar — trocar de página não dispara refetch nenhum.
3. A invalidação é **por push explícito**: um `refetch` completo, e um refetch cirúrgico só do cargo.

O que falta e deve ser corrigido no port: tratamento de erro (hoje um `catch` vazio deixa o perfil nulo para sempre, sem retry) e persistência entre reloads.

### 4.2 Servidor como única autoridade

O padrão das salas de partida no site atual é o melhor código que existe lá, e vira o padrão geral:

- Toda ação é uma chamada ao servidor que retorna `{ ok, erro, estado }`.
- O cliente **nunca decide transição de estado**.
- Timers são **derivados** de timestamps do servidor, não contadores locais — dez clientes veem o mesmo relógio.
- O tick é idempotente, com proteção contra avalanche de chamadas.

### 4.3 Realtime

Um único serviço WebSocket, autenticado por sessão. O Postgres emite `NOTIFY` nas transições de estado; o serviço faz fan-out por sala.

**Escopo: salas e lobbies apenas.** Todo o resto é fetch-on-mount. O site atual tem exatamente um canal de realtime em todo o produto, e isso está correto.

### 4.4 Workers

Substituem as funções serverless atuais: sincronização de lives da Twitch (com renovação automática de token — o atual é estático e expira), webhook de pagamento (idempotente, com crédito atômico), sincronização de elo.

As duas rotas de criação de pagamento hoje são ~95% código duplicado; viram uma só, com catálogo de produtos no servidor.

---

## 5. Design — paridade visual

**O visual é cópia exata do site atual.** Detalhes em [`../AGENTS.md`](../AGENTS.md) seção 3.1.

Tokens (de `M7AcademySite/src/index.css:4-23`):

| Token | Valor | | Token | Valor |
|---|---|---|---|---|
| `--color-primary` | `#FFB800` | | `--color-background` | `#0A0A0A` |
| `--color-m7-orange` | `#FFB800` | | `--color-surface` | `#121212` |
| `--color-on-primary` | `#000000` | | `--color-surface-variant` | `#1A1A1A` |
| `--color-on-background` | `#FFFFFF` | | `--color-outline` | `#333333` |
| `--color-on-surface` | `#E0E0E0` | | `--color-success` | `#00E676` |
| `--color-on-surface-variant` | `#A0A0A0` | | `--color-secondary` | `#3B82F6` |
| | | | `--color-tertiary` | `#EF4444` |

Fontes: **Outfit** (títulos), **Inter** (corpo) — via `next/font/google`, mesma renderização sem request externo.

Utilities a portar literalmente: `m7-gradient`, `m7-success-gradient`, `m7-glow`, `blue-glow`, `red-glow`, `glass-panel`, `hide-scrollbar`/`no-scrollbar`. Mais os keyframes `vip-border-rotate` e `heartbeat-swipe` (com o bloco `prefers-reduced-motion`) e a scrollbar dourada de 4px.

Assets: `public/` inteiro (40 imagens, `lanes/`, `lanes_brancas/`, `ranks/`, `sounds/`), mesmos arquivos e mesmos caminhos. `next/image` entrega WebP/AVIF a partir dos mesmos PNGs — o visual não muda, o peso sim.

---

## 6. Segurança — o que o sistema atual erra

Uma auditoria de julho/2026 classificou o site atual como risco alto. Parte foi corrigida; o que segue **não pode se repetir**:

| Problema no site atual | Regra aqui |
|---|---|
| Chave da Riot API no bundle do cliente | Chave de API só em código de servidor |
| O navegador conta os votos e decide o vencedor da partida | Resultado é decidido no servidor |
| Payout de aposta e taxa calculados no cliente | Servidor, dentro de transação |
| Chave PIX pessoal como fallback quando o pagamento falha | Falha de pagamento mostra erro, não rota alternativa |
| Crédito de saldo por ler-modificar-escrever | `UPDATE ... SET x = x + n` na mesma transação do lançamento |
| Upload sem restrição de dono (qualquer um sobrescreve a logo de qualquer time) | Autorização por dono, com limite de tamanho e MIME |
| Função pública que aceita `updates` arbitrário com credencial de serviço e sem auth | Toda rota valida sessão e faz allowlist de campos |
| Ownership conferido em JavaScript no navegador | Autorização no servidor |
| Cargo único por usuário | `user_roles` N:N |
| 17 blocos `catch {}` vazios | Erro nunca é engolido |

---

## 7. Armadilhas conhecidas de infra

1. **PgBouncer em transaction mode quebra prepared statements.** O client precisa de `prepare: false`.
2. **`LISTEN/NOTIFY` não funciona em transaction mode.** O serviço de realtime conecta direto no Postgres, fora do pooler.
3. **Build do Next.js em 2 vCPU é arriscado.** A imagem é construída no CI.
4. **Backup dentro da VPS morre com ela.** Cópia off-site obrigatória, e restore testado.

---

## 8. Orçamento de recursos da VPS

| Serviço | RAM |
|---|---|
| PostgreSQL (`shared_buffers` 2 GB) | ~2,0 GB |
| Next.js | ~1,0 GB |
| Realtime + Nginx + PgBouncer | ~0,4 GB |
| Sistema operacional | ~1,0 GB |
| **Livre para page cache e picos** | **~3,6 GB** |

`postgresql.conf`: `shared_buffers=2GB`, `effective_cache_size=4GB`, `work_mem=16MB`, `maintenance_work_mem=512MB`, `max_connections=100`, `max_worker_processes=2`, `max_parallel_workers=2`, `random_page_cost=1.1`, `effective_io_concurrency=200`, `wal_compression=on`, `checkpoint_completion_target=0.9`, `min_wal_size=1GB`, `max_wal_size=4GB`.
