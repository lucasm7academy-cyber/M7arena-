# ARQUITETURA — M7Arena

Documento de referência técnica. Leia antes de escrever código.
As regras de trabalho estão em [`../AGENTS.md`](../AGENTS.md); o status atual, em [`../statusdoprojeto.md`](../statusdoprojeto.md).

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Front | React 19 + Vite (SPA), React Router, Tailwind CSS 4 |
| API | Node 22 + Express, TypeScript `strict` |
| Banco | PostgreSQL 16 + PgBouncer (transaction mode) |
| ORM | Drizzle (`db/schema` + migrations SQL versionadas) |
| Auth | sessão própria em cookie httpOnly + Google OAuth (ADR-011) |
| Realtime | serviço Node separado (`ws` + `pg` LISTEN/NOTIFY) |
| Infra | Docker Compose + Nginx + TLS na VPS |
| Animação/ícones | `motion`, `lucide-react`, `react-icons` |

VPS: 2 vCPU, 8 GB RAM. O gargalo é CPU. A imagem é construída no CI ou na VPS
(ver seção 7), nunca com `npm install` manual em produção.

---

## 2. Estrutura de pastas

```
web/                      front React + Vite (o que o Nginx serve)
  src/pages/              telas (Jogar, Lobby, CampeonatoDetalhes, Perfil...)
  src/features/<dominio>/ componentes e hooks de um domínio (salas, draft...)
  src/components/         componentes compartilhados + ui/ (CutCard etc.)
  src/api/                chamadas HTTP por domínio
  src/lib/api.ts          cliente HTTP base (cookie de sessão)
  public/                 assets servidos em / (imagens, sons, ranks)

api/                      API Node + Express
  src/routes/             um router por domínio (/api/matches, /api/teams...)
  src/lib/                regras de negócio (escrow, draft, torneios, Riot...)
  src/realtime/           serviço WebSocket (container `realtime`)
  src/cron.ts             jobs periódicos
  src/index.ts            bootstrap do Express

db/
  schema/                 tabelas Drizzle por domínio
  migrations/             SQL versionado (fonte da verdade do banco)

infra/                    docker-compose.yml, nginx.conf, postgresql.conf, pgbouncer.ini
scripts/                  smokes, verify-swap, sorteio das copas
docs/                     documentação operacional e de produto
mcp/status-server/        MCP m7-status (governança multi-agente)
mcp/ops-server/           MCP de operações da VPS
```

Domínios principais: `auth`, `perfil`, `times`, `campeonatos`, `partidas`,
`carteira`, `apostas`, `recrutamento`, `streams`, `conteudo`, `admin`.

**Regra de tamanho:** nenhum arquivo novo passa de ~400 linhas. Arquivos herdados
grandes são recortados ao serem tocados, dentro do domínio (ver AGENTS.md 3.6).

---

## 3. Banco de dados

O schema é organizado por domínio em `db/schema/` e reconstruído inteiro pelas
migrations de `db/migrations/`. Um clone + migrations tem que produzir o banco
completo.

### 3.1 Identidade

- `users` — perfil central (nome, avatar, bio, VIP, status).
- `user_identities` — Google/Discord/credenciais.
- `user_sessions` — sessões próprias (cookie httpOnly).
- `user_roles` — N:N (um usuário pode ser streamer e organizador).
- `user_wallets` — saldo corrente de MP/MC (linha quente).
- `user_payout_info` — dados PIX (grant e auditoria próprios).

### 3.2 Times e campeonatos

- `teams`, `team_members`, `team_stats`, `team_invites`.
- `tournaments`, `tournament_teams`, `tournament_groups`,
  `tournament_matches`, `bracket_matches`, `tournament_standings`.
- O shape que o front consome é montado no servidor por
  `api/src/lib/tournament-shape.ts`; a classificação é derivada dos jogos
  finalizados, com fallback para `tournament_standings`.

### 3.3 Partidas e salas

- `matches` — 5v5, ARAM, 1v1 e Time vs Time.
- `match_players` — lado, slot, confirmação, vínculo.
- `match_codes` — pool de tournament codes da Riot.
- `match_results` — payload congelado do resultado.
- Estados da partida rodam **inteiros no servidor**:
  `preenchendo → confirmacao → iniciando → em_andamento → finalizacao → encerrada`
  (mais `cancelada`).

### 3.4 Economia e apostas

- `wallet_transactions` — ledger append-only, com `balance_after`.
- `user_wallets` — saldo corrente; toda escrita acontece na mesma transação do
  lançamento.
- `payments` — Mercado Pago (PIX), com webhook idempotente.
- `platform_revenue`, `referral_events`.
- Salas apostadas: escrow em `api/src/lib/escrow.ts` + revisão em
  `api/src/routes/revisao.ts`. Regras em [`SALAS_APOSTADAS.md`](./SALAS_APOSTADAS.md).
- Aposta individual: `bet_tickets`/`bet_legs` + `api/src/lib/bets.ts` e
  `api/src/lib/live-bets.ts`.

### 3.5 Conteúdo e retenção

- `news`, `highlights`, `broadcasts`, `recruitment_posts`, `notifications`.
- `audit_log` particionado por mês; jobs de purge para estados de OAuth e
  partidas antigas.

### 3.6 Armadilhas do banco

1. **PgBouncer em transaction mode quebra prepared statements.** O client
   precisa de `prepare: false` na URL (`?prepare=false`).
2. **`LISTEN/NOTIFY` não funciona em transaction mode.** O realtime conecta
   direto no Postgres, fora do pooler.
3. **Nunca altere produção à mão.** Gere a migration em `db/migrations/` e
   aplique pelo processo de deploy.

---

## 4. API

- Express com um router por domínio em `api/src/routes/`, montado em
  `api/src/index.ts` sob `/api/...`.
- Health check: `GET /api/health` (testa conexão com o banco).
- **O servidor é a única autoridade**: pagamento, resultado, saldo,
  classificação e permissão são decididos na API. O cliente só exibe.
- Sessão: cookie httpOnly; Google OAuth em `/api/auth/google`.
- Uploads: `POST /api/upload` grava em disco local; o Nginx serve
  `/uploads/` a partir de `/var/www/uploads/`.
- Pagamentos: Mercado Pago (PIX) em `api/src/routes/payments.ts`; webhook
  idempotente, crédito atômico.
- Cron: `api/src/cron.ts` (séries, salas pendentes, elos, lives, expirações).

---

## 5. Realtime

Um único serviço WebSocket (`api/src/realtime/index.ts`, container
`m7arena_realtime`), autenticado por sessão. O Postgres emite `NOTIFY` nas
transições; o serviço faz fan-out por sala.

- Visitante sem sessão entra como **espectador**: recebe `match_update`,
  prévia do draft e chat, mas não envia nada.
- Escopo: salas e lobbies. O resto do site é fetch-on-mount.
- A vitrine `/jogar` usa polling leve (`view=card`, 15s, pausado em aba oculta)
  em vez de WebSocket — decisão de performance (ADR-091).

---

## 6. Front

- SPA em `web/`, servida pelo Nginx com fallback para `index.html`.
- Rotas de sala: `/(5v5|aram|1v1|time_vs_time)/:id`.
- Acesso a dados por `web/src/lib/api.ts` e `web/src/api/*`; nunca espalhar
  `fetch` cru pelas telas.
- Cache de perfil: um Provider acima do Router carrega perfil, conta, saldo,
  cargo e time de uma vez; invalidação por push explícito.
- Timers são derivados de timestamps do servidor, não contadores locais.
- Design: tokens e padrões em [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md); cantos
  recortados com borda **sempre** via `CutCard` ([`CANTOS_RECORTADOS.md`](./CANTOS_RECORTADOS.md)).
- Assets em `web/public/` (o antigo `public/` da raiz foi removido).

---

## 7. Infra e deploy

Serviços do compose (`infra/docker-compose.yml`):

| Serviço | Container | Papel |
|---|---|---|
| `postgres` | `m7arena_postgres` | PostgreSQL 16, dados em volume |
| `pgbouncer` | `m7arena_pgbouncer` | pooler em transaction mode |
| `app` | `m7arena_app` | API Node (`dist/api/src/index.js`) |
| `realtime` | `m7arena_realtime` | WebSocket (`dist/api/src/realtime/index.js`) |
| `nginx` | `m7arena_nginx` | SPA + proxy `/api` e `/ws` + TLS + `/uploads` |
| `backup` | — | `pg_dump` diário com cópia off-site |
| `mcp-ops` | — | MCP de operações da VPS |

- Deploy na VPS em `/root/m7arena`; o código de produção é o branch
  `feat/redesign-modais` (origin).
- **Ao recriar o container `app`, rode `docker exec m7arena_nginx nginx -s reload`.**
  Sem isso o Nginx mantém o IP antigo e devolve 502 transitório.
- CI (`.github/workflows/ci.yml`) builda a imagem em `main`/`master`; o deploy
  real é feito na VPS.
- Backup dentro da VPS morre com ela: a cópia off-site e o restore testado são
  obrigatórios.

---

## 8. Dívida técnica conhecida (estado atual)

- O front não fala mais com o Supabase. `node scripts/verify-swap.js` deve
  sair com 0 ocorrências; se aparecer chamada nova, é regressão. O histórico
  da migração continua no status, mas o runtime é 100% da API própria.
- `CampeonatoDetalhes.tsx` e outros arquivos herdados passam de milhares de
  linhas; recorte ao tocar, sem misturar com mudança de comportamento.
- Auditoria de segurança das salas em [`auditoria-salas-morpheus.md`](./auditoria-salas-morpheus.md)
  (findings MORPH-001..004). Revalidar antes de considerar fechado.
