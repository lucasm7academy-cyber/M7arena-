# ESTRUTURA ATUALIZADA — M7Arena pós-simplificação

> **Documento novo.** O `ESTRUTURA_ATUAL.md` foi preservado intacto como
> fotografia do estado anterior (`8e498dc`). Este arquivo descreve o repositório
> **depois** da execução local da matriz de 84 decisões.
>
> **Data:** 04/11/2026
> **Branch:** `simplificacao-m7arena` (partiu de `8e848f6`; primeiro pacote em
> `23c7901`, com a limpeza final no mesmo branch)
> **Produção:** intocada. `main` continua em `8e848f6`. Nenhum deploy foi feito.
> **Baseline de produção:** tag `baseline-producao-2026-11-04` (`8e498dc`) e
> backup em `/root/backups/baseline-2026-11-04/`.

**Legenda:**

- **ATIVO** — tem tela/rota/API e uso real no runtime.
- **HISTÓRICO** — tabela/arquivo mantido por dados ou compatibilidade, sem fluxo
  novo de produto.
- **REMOVIDO** — saiu do runtime; pode restar tabela/dado histórico.
- **PENDENTE** — fora do escopo autorizado ou depende de decisão/migração.

---

## 0. Resumo executivo

A matriz aprovada tinha **61 itens MANTER, 8 SIMPLIFICAR e 15 REMOVER**. A
execução local removeu os fluxos duplicados/legados sem apagar dados e sem
alterar a lógica financeira:

| Área | Resultado |
|---|---|
| Revisão/prints/disputas de partida | **REMOVIDO** do runtime; tabelas e arquivos históricos preservados |
| Notícias | **REMOVIDO**; highlights preservados |
| `player_stats` antigo | **REMOVIDO**; dados Riot/PDL/card de jogador preservados |
| Convites/solicitações de time | **REMOVIDO**; lineup direto pelo capitão preservado |
| Dashboard financeiro duplicado | **REMOVIDO**; H01 (visão geral) preservado e corrigido para contar reservas |
| Time vs Time antigo | **REMOVIDO**; scrim novo `time_vs_time_livre` preservado |
| M7 Points (MP) | **REMOVIDO** da UI/API; coluna e aliases internos preservados |
| M7 Coins (MC) | **RENOMEADO visualmente** para **Essência Azul (E)**; valores e lógica intactos |
| Ajuste de saldo admin | **SIMPLIFICADO** para uma única aba/endpoint de E |
| Cargos/contatos admin | **SIMPLIFICADO** para uma única aba de cada; `caster` corrigido |
| Uploads | **SIMPLIFICADO** para `team-logos` e `public-images`; print antigo bloqueado por 403 |
| Lives de scrim | **CORRIGIDO** (G04/G06): aparecem na vitrine e não são desativadas por `expira_em` nulo |
| Sino | **SIMPLIFICADO** para notificações de apostas, com lido/não lido persistido |

O que **não** foi feito: deploy, merge na `main`, migration, remoção de tabelas,
limpeza de dados históricos e correções de segurança fora das 84 decisões.

---

## 1. Runtime atual

| Camada | O que roda | Entrada |
|---|---|---|
| Front | React 19 + Vite 6 + Tailwind 4 + React Router 7 (SPA) | `web/src/main.tsx` → `web/src/App.tsx` |
| API | Node + Express 4 + Drizzle ORM | `api/src/index.ts` |
| Realtime | Processo Node separado (`ws` + `pg` LISTEN/NOTIFY) | `api/src/realtime/index.ts` |
| Banco | PostgreSQL 16 + PgBouncer (transaction mode) | `db/schema/*` + `db/migrations/*` |
| Infra | Docker Compose + Nginx + TLS | `infra/docker-compose.yml` |
| Governança | MCP `m7-status` + CLI | `mcp/status-server/` |
| Operações | MCP `mcp-ops` | `mcp/ops-server/` |
| Browser | MCP `browser` (Playwright) | `mcp/browser-server/` |

Fluxo: o Nginx serve o SPA e faz proxy de `/api/*` para o container `app`; `/ws`
vai para o `realtime`. O realtime escuta o Postgres direto (fora do PgBouncer) e
transporta o id da sala; o cliente refaz `GET /api/matches/:id`.

---

## 2. Decisões executadas

### 2.1 Remoções (15 itens)

| ID | O que saiu | O que ficou |
|---|---|---|
| A06 | Rotas antigas `AuthCallback`, `ResetHandler` e `ResetPassword` | `/login`, `/redefinir-senha`, Google OAuth e recuperação A05/H05 |
| B03 | Endpoints/UI de convite e solicitação de entrada em time | Edição direta do lineup pelo capitão; `team_invites` como tabela histórica |
| B07 | Anúncio/rotas de recrutamento (LFT/LFP) | `recruitment_posts` como tabela histórica |
| C12/C13/C14/H06 | Revisão manual, prints, disputas e contestação | Verificação automática Riot, escrow, empate/cancelamento e D04 manual de campeonato |
| C16 | Sala antiga `/time_vs_time/:id`, `SalaTimeVsTime` e criação do modo antigo | Scrim `time_vs_time_livre`, `/sala-time/:id`, OG atualizado e redirect de links antigos para `/jogar` |
| F11/H07 | Dashboard financeiro duplicado | H01 (visão geral) e fila de saques H08 |
| F12 | Venda/assinatura VIP | Selo e status VIP existentes (A10), sem sistema de assinatura |
| F13 | Referral | Tabela `referral_events` e `users.referred_by` históricos |
| G01 | Notícias no Lobby e CRUD do Admin | Highlights (G02) |
| G03 | API/código de `player_stats` | Dados Riot, PDL e card A09 |
| G08 | `broadcasts` no código | `transmissoes`/`escalas_transmissao` ativos |
| H02 | Páginas standalone duplicadas de cargos | Aba única em `/admin` |
| H03 | Páginas standalone duplicadas de contatos | Aba única em `/admin` |
| H09 | Upload de novos prints de partida | Logos de time e imagens públicas; pasta antiga de prints com 403 |
| A09 (simplificação) | Popup/modal de detalhe do jogador, ranking fictício e estatísticas zeradas | Card inteiro abre OP.GG em nova aba; sem Riot ID, mostra aviso |

### 2.2 Simplificações (8 itens)

| ID | Como ficou |
|---|---|
| A09 | Card do diretório abre OP.GG; `PlayerDetailModal` foi substituído por `playerMeta.ts`; estatísticas sem ranqueada aparecem como “—”; ranking de página removido |
| F01 | Toda apresentação pública usa **Essência Azul (E)**; `MC`/`MP` não aparecem na UI; saldos, taxas, reservas e valores não mudaram |
| F05 | Uma aba “Saldo E” e um endpoint `/wallet/admin/adjust-mc`; `/wallet/admin/adjust` e o helper antigo foram removidos |
| G04 | Vitrine e painel reconhecem live de scrim (`sala_id`) enquanto a sala está ativa; lazy cleanup ao encerrar |
| G06 | Live avulsa em modo campeonato envia o `campeonatoId` selecionado |
| G07 | Sino só de apostas; notificações mantêm lido/não lido e usam `markRead`/`markAllRead` |
| H02 | Uma única tela de cargos; `caster` passou a existir no front com permissões de streamer; flags inertes removidas |
| H03 | Uma única tela de contatos, com cópia/CSV preservados |

### 2.3 Manutenções relevantes

- **H01:** “Essência Azul em Circulação” agora soma `mc + mcReservado`; o endpoint
  de saldos admin devolve `mcReservado`.
- **H09:** o Nginx mantém `location /uploads/match-prints/ { return 403; }` para
  não expor arquivos históricos; nenhum fluxo novo grava nessa pasta.
- **C15:** o delete administrativo de sala continua apagando prints/disputas
  históricos junto com a sala, para não deixar órfãos.
- **D04:** resultado manual de campeonato permanece.
- **D08/G09:** `/sala-time/:id` e `/campeonato/sala/:id` continuam com OG.

---

## 3. O que saiu do runtime

### 3.1 Arquivos removidos

| Arquivo | Motivo |
|---|---|
| `api/src/routes/revisao.ts` | C12 |
| `api/src/routes/prints.ts` | C13 |
| `api/src/routes/disputas.ts` | C14 |
| `api/src/lib/discord.ts` | H06 (webhook de revisão) |
| `api/src/routes/content-news.ts` | G01 |
| `api/test/revisao.test.ts` | C12 |
| `api/test/prints.test.ts` | C13 |
| `api/test/disputas.test.ts` | C14 |
| `api/test/contestacao.test.ts` | C14 |
| `api/test/contestacao-print.test.ts` | C13/C14 |
| `web/src/components/admin/RevisaoPartidas.tsx` | C12 |
| `web/src/components/admin/FinanceiroDashboard.tsx` | F11/H07 |
| `web/src/features/sala-time-vs-time/SalaTimeVsTime.tsx` | C16 |
| `web/src/pages/AuthCallback.tsx` | A06 |
| `web/src/pages/ResetHandler.tsx` | A06 |
| `web/src/pages/ResetPassword.tsx` | A06 |
| `web/src/components/players/PlayerDetailModal.tsx` | A09 (substituído por `playerMeta.ts`) |
| `web/src/api/wallet.ts` | F05 (helper de ajuste MP/MC morto) |
| `scripts/smoke-apostas.mjs` | Testava `/revisao/*` e `report-result` removidos |
| `scripts/smoke-casual-revisao.mjs` | Fluxo de revisão removido |
| `scripts/smoke-vps-revisao.mjs` | Fluxo de revisão/print removido |

### 3.2 Rotas e endpoints removidos

- Front: `/admin/cargos` e `/admin/contatos`. A rota `/time_vs_time/:id` não abre
  mais a sala antiga: redireciona para `/jogar`.
- API: `/api/revisao/*`, `/api/prints/*`, `/api/disputas/*`, `/api/content/news*`,
  `POST /api/matches/:id/report-result`, `POST /api/wallet/deposit`,
  `POST /api/wallet/admin/adjust`.
- Nginx: locations OG do modo antigo `time_vs_time`; as locations atuais são
  `/5v5`, `/aram`, `/1v1`, `/sala-time` e `/campeonato/sala`.

### 3.3 Arquivos novos

| Arquivo | Papel |
|---|---|
| `web/src/lib/opgg.ts` | Monta a URL correta do OP.GG a partir de `gameName#tagLine` (região BR) |
| `web/src/components/players/playerMeta.ts` | Tipos/configurações visuais compartilhados por `players.tsx` e `TimePage.tsx` |
| `ESTRUTURA_ATUALIZADA_2026-11-04.md` | Este documento |

---

## 4. Árvore real (resumida)

```
M7arenaSite/
├── AGENTS.md
├── CATALOGO_FUNCIONALIDADES.md
├── ESTRUTURA_ATUAL.md                    # fotografia anterior, preservada
├── ESTRUTURA_ATUALIZADA_2026-11-04.md    # este documento
├── PLANO_BASELINE_GIT.md
├── plano_m7arena_atualizado.md
├── statusdoprojeto.md                    # gerado
├── api/
│   ├── src/
│   │   ├── index.ts                      # 21 mounts /api
│   │   ├── cron.ts
│   │   ├── db.ts
│   │   ├── lib/                          # 41 arquivos
│   │   ├── realtime/index.ts
│   │   └── routes/                       # 23 arquivos
│   ├── test/                             # 37 *.test.ts
│   └── scripts/
├── db/
│   ├── schema/                           # 13 arquivos, 48 tabelas
│   └── migrations/                       # 35 SQL + meta
├── docs/
│   ├── ARQUITETURA.md
│   ├── DESIGN_SYSTEM.md
│   ├── CANTOS_RECORTADOS.md
│   ├── SALAS_APOSTADAS.md                # marcado como histórico
│   └── ...
├── infra/                                # compose, nginx, pgbouncer, postgres
├── mcp/                                  # status-server, ops-server, browser-server
├── scripts/                              # smokes, sorteio, verify-swap
├── web/
│   ├── public/                           # 95 assets
│   └── src/
│       ├── App.tsx                       # 28 rotas com path
│       ├── api/                          # riot, salamod1, player
│       ├── components/                   # 41 tsx + utilitários
│       ├── config/
│       ├── contexts/                     # 4
│       ├── features/                     # 4 pastas / 33 arquivos
│       ├── hooks/                        # 5
│       ├── lib/                          # 8
│       ├── pages/                        # 25 tsx
│       └── main.tsx
├── Dockerfile
├── package.json
└── ...
```

### 4.1 Pastas de feature

- `web/src/features/sala-campeonato/` — sala de série de campeonato e scrim livre.
- `web/src/features/campeonatos/` — seções e contexto do detalhe de campeonato.
- `web/src/features/streams/` — componentes de transmissão.
- `web/src/features/m7-academy-tierlist/` — feature de tierlist desconectada.
- O draft Fearless/ban-pick fica em `web/src/components/draft/` (`DraftRoom.tsx` e
  componentes auxiliares), não em `features/`.

### 4.2 Páginas

Há **25 arquivos** em `web/src/pages`:

- **20 páginas roteadas** em `App.tsx`.
- **4 abas internas do Admin:** `AdminCargos`, `AdminContatos`, `AdminPunicoes`,
  `AdminSenhas` (não têm mais rota standalone).
- **1 órfã:** `tierlist.tsx` (não é importada por `App.tsx` nem por outro arquivo;
  a API `tierlists` também não está montada). Fora das 84 decisões; não removida.

---

## 5. Rotas do front

`web/src/App.tsx` declara **28 rotas com path** (incluindo o wildcard final).

| Rota | Componente | Acesso | Observação |
|---|---|---|---|
| `/` | `RootRedirect` | público | Redireciona para `/lobby`, preservando callback OAuth |
| `/login` | `Login` | público | E-mail/senha + Google |
| `/redefinir-senha` | `RedefinirSenha` | público | Token gerado pelo admin |
| `/admin` | `Admin` | privado | Tela cheia, sidebar própria |
| `/lobby` | `Lobby` | público | Home |
| `/times` | `equipes` | público | Lista de times |
| `/times/:id` | `TimePage` | público | Página do time |
| `/players` | `players` | público | Catálogo; card abre OP.GG |
| `/streamers` | `Streamers` | público | Vitrine/painel de lives |
| `/quem-somos` | `QuemSomos` | público | Institucional |
| `/politicas` | `Politicas` | público | Políticas |
| `/campeonatos` | `campeonatos` | público | Lista |
| `/campeonato/:id` | `CampeonatoDetalhes` | público | Detalhe |
| `/tutorial` | `Tutorial` | público | Tutorial |
| `/jogar` | `Jogar` | público | Vitrine de salas |
| `/aposta-individual` | `ApostaIndividualPage` | privado | Aposta individual |
| `/perfil` | `perfil` | privado | Perfil |
| `/partidas` | `MinhasPartidas` | privado | Histórico |
| `/vincular` | `Vincular` | privado | Vínculo Riot |
| `/admin/criar-campeonato` | `createCampPage` | privado | Criação |
| `/5v5/:id` | `SalaMod1` | público | Sala 5v5 |
| `/aram/:id` | `SalaMod1` | público | Sala ARAM |
| `/1v1/:id` | `SalaMod1` | público | Sala 1v1 |
| `/campeonato/sala/:id` | `SalaCampeonato` | público | Série de campeonato |
| `/sala-time/:id` | `SalaCampeonato` | público | Scrim livre |
| `/time_vs_time_livre/:id` | `RedirecionaSalaLivre` | público | Compat: redireciona para `/sala-time/:id` |
| `/time_vs_time/:id` | `Navigate` | público | C16: redireciona para `/jogar` |
| `*` | `Navigate` | público | Fallback para `/lobby` |

**Removidas:** `/admin/cargos`, `/admin/contatos`, `/reset-password`,
`/resetpassword`, `/auth/callback`. A sala antiga de `/time_vs_time/:id` não
existe mais, mas o path permanece como redirect para `/jogar` (linha acima).

---

## 6. API — routers e mounts

`api/src/index.ts` registra **21 chamadas `app.use`** em **18 prefixos distintos**
(`/api/auth` aparece 3x e `/api/admin` 2x), a partir de **23 arquivos de route**.
Dois arquivos são sub-routers (`matches-actions` e `content-highlights`);
`tierlists.ts` existe mas não está montado. `/api/health` é `app.get` inline, não
um mount — a tabela abaixo lista 19 endpoints-base.

| Mount | Arquivo(s) | Domínio |
|---|---|---|
| `/api/auth` | `auth.ts`, `password-reset.ts`, `auth-google.ts` | login, sessão, senha, Google |
| `/api/terms` | `auth.ts` (`termsRouter`) | aceite de termos |
| `/api/riot` | `riot.ts` | proxy Riot |
| `/api/upload` | `upload.ts` | logos e imagens públicas |
| `/api/profiles` | `profiles.ts` | perfil e Riot ID |
| `/api/players` | `players.ts` | catálogo |
| `/api/teams` | `teams.ts` | times, lineup, estatísticas |
| `/api/wallet` | `wallet.ts` | saldo E, reservas, ajuste admin |
| `/api/payments` | `payments.ts` | PIX de E |
| `/api/withdrawals` | `withdrawals.ts` | saques PIX |
| `/api/matches` | `matches.ts` + `matches-actions.ts` | salas, estados, draft, série |
| `/api/tournaments` | `tournaments.ts` | campeonatos |
| `/api/content` | `content.ts` + `content-highlights.ts` | highlights |
| `/api/streams` | `streams.ts` | agenda/lives |
| `/api/admin` | `admin-password-reset.ts`, `admin.ts` | cargos, punições, senhas |
| `/api/bets` | `bets.ts` | apostas individuais |
| `/api/notifications` | `notifications.ts` | notificações de apostas |
| `/api/og` | `og.ts` | preview social das salas |
| `/api/health` | inline em `index.ts` | health check |

**Não montado:** `api/src/routes/tierlists.ts` (fora das 84 decisões).

**Removidos:** `/api/revisao`, `/api/prints`, `/api/disputas`,
`/api/content/news*`, `report-result`, `/api/wallet/deposit`,
`/api/wallet/admin/adjust`.

---

## 7. Banco de dados

**48 tabelas Drizzle** e **35 migrations SQL**. Nenhuma migration foi executada
neste trabalho; o schema não foi alterado.

### 7.1 Ativas

| Domínio | Tabelas |
|---|---|
| Identidade | `users`, `user_identities`, `user_sessions`, `password_reset_tokens`, `user_roles`, `user_wallets`, `user_payout_info` |
| Jogos | `games`, `game_accounts` |
| Times | `teams`, `team_members`, `team_stats` |
| Campeonatos | `tournaments`, `tournament_groups`, `tournament_teams`, `tournament_matches`, `bracket_matches`, `tournament_standings`, `tournament_series_games` |
| Salas | `matches`, `match_players`, `match_results`, `match_codes`, `match_drafts`, `campeonato_sala_estado`, `sala_mensagens` |
| Economia | `wallet_transactions`, `payments`, `mc_packages`, `withdrawals` |
| Apostas | `bet_tickets`, `bet_legs` |
| Conteúdo/live | `highlights`, `transmissoes`, `escalas_transmissao`, `notifications` |
| Punições | `user_advertencias` |
| Retenção | `audit_logs` |

### 7.2 Históricas / sem fluxo novo

| Tabela | Situação |
|---|---|
| `team_invites` | B03 removido; dados preservados |
| `match_prints` | C13 removido; leitura/escrita não existem; C15 ainda apaga junto da sala |
| `match_disputas` | C14 removido; C15 ainda apaga junto da sala |
| `news` | G01 removido; dados editoriais preservados |
| `player_stats` | G03 removido; dados históricos preservados |
| `broadcasts` | G08; sem código ativo |
| `recruitment_posts` | B07; sem código ativo |
| `referral_events` | F13; sem código ativo |
| `tierlist_submissions` | feature desconectada; fora das 84 |
| `platform_revenue` | histórico financeiro; usado pelo delete C15 e relatórios antigos |

Campos/aliases mantidos de propósito:

- `user_wallets.mp` — coluna legada; não é mais exposta na API nem na UI.
- `matches.entry_mp`, `entryMp` e `mpoints` — aliases históricos que representam
  **Essência Azul (E)**, não M7 Points; não renomeados para não quebrar dados.
- `matches.revisao_desde`, `revisado_por`, `decisao_id` — estado histórico de
  revisão; nenhuma sala nova entra em `aguardando_revisao`.
- `users.referred_by` — histórico de referral.

---

## 8. Features — estado atual

### 8.1 Ativas

- Autenticação própria (cookie httpOnly), Google OAuth, recuperação de senha.
- Perfil, vínculo Riot, selo VIP existente.
- Times: criar/editar, lineup direto, titular/reserva/coach/convidado,
  transferência de liderança, PDL.
- Salas 5v5 (MD1/MD3/MD5), ARAM e 1v1: presença, confirmação, código,
  verificação Riot, escrow, empate/cancelamento e reembolso.
- Campeonatos: inscrições, grupos, chaves, agenda, WO, classificação, PDL,
  draft Fearless, resultado automático e manual D04.
- Scrim `time_vs_time_livre` e sala de campeonato (`SalaCampeonato`).
- Carteira em Essência Azul (E), depósito PIX via `/payments`, saques, reservas,
  ledger, apostas individuais.
- Streams: agenda, live avulsa, live de campeonato e live de scrim na vitrine.
- Highlights, notificações de apostas, contatos/cargos/punições admin, senhas.
- Catálogo de jogadores com abertura do OP.GG.

### 8.2 Removidas do produto

- Notícias, player_stats antigo, broadcasts.
- Revisão manual, prints, disputas/contestação.
- Convites/solicitações de time e LFT/LFP.
- Dashboard financeiro duplicado.
- Time vs Time antigo.
- M7 Points (MP) como sistema de pontos/ranking de jogador.
- Páginas standalone duplicadas de cargos/contatos.
- Rotas antigas de callback/reset.

### 8.3 Pendentes / fora de escopo

- **Tierlist M7 Academy:** página, API e tabela desconectadas; não foi removida
  porque o plano não autorizou.
- **Dados históricos:** linhas em `aguardando_revisao`, prints/disputas, notícias,
  player_stats, broadcasts, recruitment, team_invites e referral só podem ser
  apagadas em migração separada, com decisão de retenção.
- **Sala histórica em `aguardando_revisao`:** a UI mostra “Sala em revisão legada
  — fale com o suporte”; não há mais painel de revisão. Salas antigas nesse
  estado precisam de tratamento operacional/administrativo.
- **Segurança:** a auditoria da Etapa 3 (Pix em endpoint público, autorização de
  campeonato, saldo de terceiros) não foi executada. Apenas endpoints mortos
  foram removidos; não trate este documento como certificação de segurança.
- **Arquivos grandes:** `TimePage.tsx` (~1.817 linhas), `SalaCampeonato.tsx`
  (~1.657), `Lobby.tsx` (~1.596), `createCampPage.tsx` (~1.572),
  `CampeonatoContext.tsx` (~1.483), `Admin.tsx` (~951) e
  `api/src/routes/matches.ts` (~630) ainda violam a meta de ~400 linhas. O
  recorte deve ser feito dentro do domínio, sem misturar com mudança de
  comportamento. (`CampeonatoDetalhes.tsx` tem ~456 linhas e **não** entra nessa
  lista.)
- **Testes da API sem script:** continuam soltos em `api/test`; o comando manual
  é `npx tsx --test --test-concurrency=1 api/test/*.test.ts`.
- **Backup automático:** os backups antigos de 20 bytes continuam inválidos; o
  dump bom está apenas na VPS. Não execute migration contra produção.

---

## 9. Compatibilidade e decisões de borda

| Situação | Decisão atual |
|---|---|
| Link antigo `/time_vs_time/:id` | Redireciona para `/jogar`; não há sala legada nova |
| Link `/time_vs_time_livre/:id` | Redireciona para `/sala-time/:id` |
| `time_vs_time` no front | Ainda é usado como **chave de UI** do card de scrim em `Jogar.tsx` e no registry de draft; a API bloqueia a criação do modo antigo |
| Live de scrim | `match_id` e `expira_em` nulos; o fim é o status da sala (`sala_id`) |
| Live avulsa de campeonato | Envia `campeonatoId` selecionado no painel |
| Notificação lida | Persistida via `/notifications/:id/read`; “Marcar lidas” usa `/read-all` |
| Ajuste admin | Só `/wallet/admin/adjust-mc`, exclusivo do proprietário; ledger `admin_adjustment` |
| Moeda | UI “Essência Azul (E)”; contratos internos `mc`, `entry_mp`, `mpoints` preservados |
| Print antigo | Upload não existe; pasta `match-prints` responde 403 |
| Exclusão de sala | C15 apaga prints/disputas históricos e devolve reservas |

---

## 10. Números do estado atual

Medição no worktree pós-simplificação, sem `node_modules`, `.git`, `dist`,
`uploads` e `.env`:

| Métrica | Valor |
|---|---:|
| Arquivos | **~495** (incluindo este documento) |
| Diretórios | **71** |
| Arquivos TS/TSX em `web/src` | **130** |
| Linhas TS/TSX em `web/src` | **~37.951** |
| Arquivos TS em `api/src` | **68** |
| Linhas TS em `api/src` | **~14.040** |
| Arquivos de teste da API | **37** (`*.test.ts`) |
| Páginas em `web/src/pages` | **25** |
| Páginas roteadas | **20** |
| Rotas com path | **28** |
| Componentes TSX | **41** |
| Features (pastas) | **4** (33 arquivos) |
| Hooks | **5** |
| Routers de API (arquivos) | **23** |
| Caminhos `/api` montados | **21** |
| Routers não montados | **1** (`tierlists`) |
| Tabelas Drizzle | **48** |
| Migrations SQL | **35** |

Comparação com a fotografia antiga (`ESTRUTURA_ATUAL.md`, 509 arquivos):
a redução veio principalmente de rotas/componentes/telas duplicadas, não de
dados.

---

## 11. Evidências de execução

Executado neste branch, sem deploy:

```text
web/  npm run lint (tsc --noEmit)                         exit 0
web/  npm run build (vite)                                exit 0 — 2203 módulos
api/  npx tsc --noEmit                                    exit 0
api/  npx tsx --test --test-concurrency=1 api/test/*.test.ts
      tests 279 | pass 279 | fail 0
api/  npx tsx --test --test-concurrency=1 api/test/streams.test.ts
      tests 12 | pass 12 | fail 0  (inclui o caso G04 de scrim)
root  node scripts/verify-swap.js                         0 ocorrências
```

Baseline anterior (para comparação): 304 testes passando; 5 arquivos de teste
dos fluxos removidos foram apagados. A diferença de 25 testes é esperada.

Não houve:

- merge na `main`;
- deploy ou restart na VPS;
- migration ou alteração de schema;
- remoção de dados/tabelas;
- alteração de saldos, taxas ou reservas.

---

## 12. Resumo em uma página

O M7Arena pós-simplificação continua sendo um monorepo React/Vite + Express +
Postgres/Drizzle + realtime, com autenticação, times, salas, campeonatos, draft,
carteira em Essência Azul, apostas, streams, highlights, notificações e admin
funcionando de ponta a ponta.

O que mudou é a **superfície**: saíram os fluxos que duplicavam ou contradiziam
o produto atual — revisão/prints/disputas, notícias, player_stats antigo,
convites de time, recrutamento, dashboard financeiro, Time vs Time antigo,
M7 Points, páginas admin duplicadas e rotas antigas de auth. O que era dinheiro
ou histórico ficou: saldos, reservas, ledger, pagamentos, saques, prints antigos,
tabelas editoriais e dados de referral.

Os riscos restantes não são de código quebrado; são de **decisão e migração**:
dados históricos em estados removidos, tabelas dormentes, feature tierlist
desconectada, arquivos grandes, testes sem script, backup automático inválido e
a auditoria de segurança da Etapa 3 ainda não executada. Nada disso foi
“resolvido” por engano: está listado para o próximo ciclo.
