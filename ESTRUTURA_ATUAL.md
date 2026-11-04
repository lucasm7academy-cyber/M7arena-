# ESTRUTURA ATUAL — M7Arena

> **Documento descritivo. Nada aqui foi alterado, removido ou reorganizado.**
> O objetivo é mostrar o que existe hoje, como as peças se ligam e onde estão
> as inconsistências, para que o usuário decida o que fazer depois.

**Levantamento:** 04/11/2026
**Base:** commit `8e498dc` (`main`)
**Método:** leitura do código real (`web/src`, `api/src`, `db/schema`,
`db/migrations`, `infra`, `mcp`, `scripts`) confrontada com os documentos.
Quando a conclusão depende de algo que não está no repositório (banco de
produção, logs da VPS, uso externo), o item está marcado como suspeita ou como
**PRECISA DE VERIFICAÇÃO**.

**Legenda usada no documento:**

- **Confirmado** — dá para provar só com o repositório (código, schema, config,
  migration, import, rota).
- **Suspeita** — o repositório indica, mas a prova depende de banco de produção,
  logs da VPS, uso externo ou decisão de produto.
- **PRECISA DE VERIFICAÇÃO** — não foi possível determinar com o que está no
  repositório; está explicitamente marcado no texto.

---

## 0. O que foi omitido da árvore

Para manter a árvore legível, foram omitidos — e **não** fazem parte da contagem
de arquivos do projeto:

- `node_modules/` (dependências instaladas)
- `.git/` (histórico)
- `dist/` e `build/` (artefatos de build)
- `uploads/` e volumes Docker (`postgres_data`, `uploads_data`, `backups_data`)
- caches, logs, `*.tsbuildinfo`, `.env` local
- os 95 assets binários de `web/public/` (imagens, sons, ranks) — resumidos por
  pasta no fim da árvore

Total de arquivos do projeto (sem os itens acima): **509**. Diretórios: **80**.

---

## 1. Visão geral do runtime

| Camada | O que roda hoje | Entrada |
|---|---|---|
| Front | React 19 + Vite 6 + Tailwind 4 + React Router 7 (SPA) | `web/src/main.tsx` → `web/src/App.tsx` |
| API | Node 22 + Express 4 + Drizzle ORM | `api/src/index.ts` |
| Realtime | Processo Node separado (`ws` + `pg` LISTEN/NOTIFY) | `api/src/realtime/index.ts` |
| Banco | PostgreSQL 16 + PgBouncer (transaction mode) | `db/schema/*` + `db/migrations/*` |
| Infra | Docker Compose + Nginx + TLS | `infra/docker-compose.yml` |
| Governança | MCP `m7-status` + CLI | `mcp/status-server/` |
| Operações | MCP `mcp-ops` | `mcp/ops-server/` |
| Browser | MCP `browser` (Playwright) | `mcp/browser-server/` |

**Fluxo de uma requisição:** Nginx serve o SPA e faz proxy de `/api/*` para o
container `app`; `/ws` vai para o container `realtime`. O realtime escuta o
Postgres direto (sem PgBouncer) e só transporta o id da sala — o cliente refaz
`GET /api/matches/:id` para obter o estado.

**Observação estrutural:** a API e o realtime são o mesmo código compilado
(`dist/api/src/...`), mas processos e containers diferentes.

---

## 2. Árvore real de pastas e arquivos

```
M7arenaSite/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .env                                  (local, ignorado pelo git)
├── .gitignore
├── .mcp.json
├── AGENTS.md
├── Dockerfile
├── drizzle.config.ts
├── iniciar-m7arena.bat
├── opencode.json
├── package.json
├── package-lock.json
├── statusdoprojeto.md                    (GERADO — não editar à mão)
├── tsconfig.json
│
├── api/
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── scripts/
│   │   ├── test-guest-recebe-previa.mjs
│   │   └── test-realtime.mjs
│   ├── src/
│   │   ├── index.ts                      (bootstrap Express + crons)
│   │   ├── db.ts                         (pool Drizzle)
│   │   ├── cron.ts                       (varreduras periódicas)
│   │   ├── lib/
│   │   │   ├── draft/
│   │   │   │   ├── index.ts
│   │   │   │   ├── flow.ts
│   │   │   │   ├── regras.ts
│   │   │   │   ├── tipos.ts
│   │   │   │   └── modos/
│   │   │   │       ├── 1v1.ts
│   │   │   │       ├── 5v5.ts
│   │   │   │       ├── aram.ts
│   │   │   │       └── time-vs-time.ts
│   │   │   ├── acesso-sala.ts
│   │   │   ├── atualizar-elos.ts
│   │   │   ├── bets.ts
│   │   │   ├── content.ts
│   │   │   ├── ddragon.ts
│   │   │   ├── discord.ts
│   │   │   ├── elegibilidade.ts
│   │   │   ├── escrow.ts
│   │   │   ├── live-bets.ts
│   │   │   ├── match-flow.ts
│   │   │   ├── match-shape.ts
│   │   │   ├── mercado-pago.ts
│   │   │   ├── notifications.ts
│   │   │   ├── pagamentos.ts
│   │   │   ├── password-reset.ts
│   │   │   ├── reconciliar-handles.ts
│   │   │   ├── sala-campeonato.ts
│   │   │   ├── sala-campeonato-draft.ts
│   │   │   ├── serie-campeonato.ts
│   │   │   ├── serie-livre.ts
│   │   │   ├── serie-sala.ts
│   │   │   ├── session.ts
│   │   │   ├── streams.ts
│   │   │   ├── team-membership.ts
│   │   │   ├── team-ownership.ts
│   │   │   ├── tierlist.ts
│   │   │   ├── tournament-access.ts
│   │   │   ├── tournament-pdl.ts
│   │   │   ├── tournament-shape.ts
│   │   │   ├── tournament-store.ts
│   │   │   ├── tournament-tiebreakers.ts
│   │   │   ├── transmissoes.ts
│   │   │   ├── verificar-partida.ts
│   │   │   └── withdrawals.ts
│   │   ├── realtime/
│   │   │   └── index.ts                  (entrada separada do container realtime)
│   │   └── routes/
│   │       ├── admin.ts
│   │       ├── admin-password-reset.ts
│   │       ├── auth.ts
│   │       ├── auth-google.ts
│   │       ├── bets.ts
│   │       ├── content.ts
│   │       ├── content-highlights.ts     (sub-router de content)
│   │       ├── content-news.ts           (sub-router de content)
│   │       ├── disputas.ts
│   │       ├── matches.ts
│   │       ├── matches-actions.ts        (montado dentro de matches)
│   │       ├── notifications.ts
│   │       ├── og.ts
│   │       ├── password-reset.ts
│   │       ├── payments.ts
│   │       ├── players.ts
│   │       ├── prints.ts
│   │       ├── profiles.ts
│   │       ├── revisao.ts
│   │       ├── riot.ts
│   │       ├── streams.ts
│   │       ├── teams.ts
│   │       ├── tierlists.ts              (NÃO montado em index.ts)
│   │       ├── tournaments.ts
│   │       ├── upload.ts
│   │       ├── wallet.ts
│   │       └── withdrawals.ts
│   └── test/                             (43 arquivos de teste)
│       ├── atualizar-elos.test.ts
│       ├── bets.test.ts
│       ├── classificacao.test.ts
│       ├── contestacao-print.test.ts
│       ├── contestacao.test.ts
│       ├── cron.test.ts
│       ├── disputas.test.ts
│       ├── draft-rules.test.ts
│       ├── draft.test.ts
│       ├── elegibilidade.test.ts
│       ├── escrow-timeout.test.ts
│       ├── escrow.test.ts
│       ├── estados.test.ts
│       ├── helpers.ts
│       ├── match-card.test.ts
│       ├── password-reset.test.ts
│       ├── payments.test.ts
│       ├── prints.test.ts
│       ├── reconciliar-handles.test.ts
│       ├── revisao.test.ts
│       ├── riot-queues.test.ts
│       ├── sala-campeonato-draft.test.ts
│       ├── sala-campeonato-schema.test.ts
│       ├── sala-campeonato.test.ts
│       ├── serie-5v5.test.ts
│       ├── serie-campeonato.test.ts
│       ├── smoke-serie-5v5.test.ts
│       ├── streams.test.ts
│       ├── team-membership.test.ts
│       ├── team-ownership.test.ts
│       ├── tiebreakers.test.ts
│       ├── tournament-access.test.ts
│       ├── tournament-agendamento.test.ts
│       ├── tournament-bracket.test.ts
│       ├── tournament-inscricao.test.ts
│       ├── tournament-pdl.test.ts
│       ├── tournament-shape.test.ts
│       ├── upload-otimizacao.test.ts
│       ├── upload-permissao.test.ts
│       ├── verificar-endpoint.test.ts
│       ├── verificar-partida.test.ts
│       ├── webhook.test.ts
│       └── withdrawals.test.ts
│
├── db/
│   ├── index.ts
│   ├── schema/
│   │   ├── index.ts
│   │   ├── DISCARDED.md
│   │   ├── identidade.ts
│   │   ├── games.ts
│   │   ├── retencao.ts
│   │   ├── teams.ts
│   │   ├── matches.ts
│   │   ├── economia.ts
│   │   ├── conteudo.ts
│   │   ├── tournaments.ts
│   │   ├── apostas.ts
│   │   ├── bets.ts
│   │   └── tierlist.ts                   (não exportado no index.ts)
│   └── migrations/
│       ├── 0000_brave_korg.sql
│       ├── 0001_robust_the_phantom.sql
│       ├── 0002_teams_swap.sql
│       ├── 0003_seed_games.sql
│       ├── 0004_shiny_sumo.sql
│       ├── 0005_campeonatos_normalize.sql
│       ├── 0006_content_swap.sql
│       ├── 0007_matches_salas_swap.sql
│       ├── 0008_matches_sala_num.sql
│       ├── 0009_white_wallflower.sql
│       ├── 0010_slimy_dragon_man.sql
│       ├── 0011_ledger_refund_repeat.sql
│       ├── 0012_magical_sharon_ventura.sql
│       ├── 0013_advertencias_ban.sql
│       ├── 0014_rodizio_codigos_lru.sql
│       ├── 0015_disputa_contestacao_url.sql
│       ├── 0016_transmissoes.sql
│       ├── 0017_vitoria_motivo_1v1.sql
│       ├── 0018_workable_clea.sql
│       ├── 0019_gifted_mac_gargan.sql
│       ├── 0020_separar_fila_codigos_x1.sql
│       ├── 0021_campeonato_verificacao_serie.sql
│       ├── 0022_bet_individual.sql
│       ├── 0023_bet_champion.sql
│       ├── 0024_gray_gressill.sql
│       ├── 0025_glamorous_dormammu.sql
│       ├── 0026_amused_king_cobra.sql
│       ├── 0027_quick_mesmero.sql
│       ├── 0028_sorteio_forcado.sql
│       ├── 0029_formato_sala_livre.sql
│       ├── 0030_serie_livre_placar.sql
│       ├── 0031_live_sala_id.sql
│       ├── 0032_amused_santa_claus.sql
│       ├── 0033_stiff_hemingway.sql
│       ├── 0034_blind_codes.sql
│       └── meta/                          (28 snapshots + _journal.json)
│
├── docs/
│   ├── ARQUITETURA.md
│   ├── CANTOS_RECORTADOS.md
│   ├── DESIGN_SYSTEM.md
│   ├── ROTINA_SORTEIO_COPAS.md
│   ├── SALAS_APOSTADAS.md
│   ├── auditoria-salas-morpheus.md
│   ├── project-state.json
│   ├── status-log.jsonl
│   ├── planos/
│   │   ├── performance-baseline.md
│   │   ├── plano-otimizacao-campeonatos.md
│   │   └── plano-otimizacao-performance.md
│   └── superpowers/
│       ├── plans/
│       │   └── 2026-10-20-reset-senha-admin.md
│       └── specs/
│           └── 2026-10-20-reset-senha-admin-design.md
│
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.local.yml
│   ├── Dockerfile.nginx
│   ├── nginx.conf
│   ├── nginx.local.conf
│   ├── pgbouncer.ini
│   ├── postgresql.conf
│   └── userlist.txt
│
├── mcp/
│   ├── browser-server/
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   └── server.js
│   ├── ops-server/
│   │   ├── index.js
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   └── security.js
│   └── status-server/
│       ├── index.js
│       ├── package.json
│       ├── package-lock.json
│       ├── lib/
│       │   ├── gates.js
│       │   ├── plan.js
│       │   ├── render.js
│       │   ├── schema.js
│       │   └── state.js
│       └── scripts/
│           ├── cli.js
│           ├── fixture.js
│           ├── migrate-v1-to-v2.js
│           ├── render-only.js
│           └── smoke-test.js
│
├── scripts/
│   ├── gerar-posicoes-campeoes.mjs
│   ├── smoke-apostas.mjs
│   ├── smoke-casual-revisao.mjs
│   ├── smoke-clock-sync-vps.mjs
│   ├── smoke-clock-sync.mjs
│   ├── smoke-confirmacao-concorrente.mjs
│   ├── smoke-draft.mjs
│   ├── smoke-vps-codigo.mjs
│   ├── smoke-vps-draft.mjs
│   ├── smoke-vps-revisao.mjs
│   ├── smoke-vps-sala-campeonato.mjs
│   ├── smoke-vps-salas.mjs
│   ├── verify-swap.js
│   └── campeonatos/
│       └── sortear-semana.mjs
│
└── web/
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── postcss.config.mjs
    ├── tsconfig.json
    ├── vite.config.ts
    ├── public/
    │   ├── (2 arquivos na raiz: favicon/robots)
    │   ├── images/          (31 arquivos)
    │   ├── lanes/           (6 arquivos)
    │   ├── lanes_brancas/   (7 arquivos)
    │   ├── ranks/           (32 arquivos)
    │   └── sounds/          (17 arquivos)
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── index.css
        ├── vite-env.d.ts
        ├── api/
        │   ├── player.ts
        │   ├── riot.ts
        │   ├── salamod1.ts
        │   └── wallet.ts
        ├── config/
        │   └── adminPermissoes.ts
        ├── contexts/
        │   ├── AuthContext.tsx
        │   ├── PerfilContext.tsx
        │   ├── RoleContext.tsx
        │   └── VerificacaoContext.tsx
        ├── hooks/
        │   ├── useSalaChat.ts
        │   ├── useSalaRealtime.ts
        │   ├── useSalaSimples.ts
        │   ├── useSound.ts
        │   └── useTransmissoesAtivas.ts
        ├── lib/
        │   ├── api-content.ts
        │   ├── api.ts
        │   ├── clockSync.ts
        │   ├── notification-sound.ts
        │   ├── rotas.ts
        │   ├── salaSenhaStore.ts
        │   └── somSala.ts
        ├── components/
        │   ├── ConviteScrim.tsx
        │   ├── Toast.tsx
        │   ├── admin/
        │   │   ├── FinanceiroDashboard.tsx
        │   │   ├── RevisaoPartidas.tsx
        │   │   └── SaquesPix.tsx
        │   ├── campeonatos/
        │   │   ├── AdminCriarJogo.tsx
        │   │   ├── BracketMatch.tsx
        │   │   ├── Chaves.tsx
        │   │   ├── Cronograma.tsx
        │   │   ├── DoubleEliminationBracket.tsx
        │   │   ├── DoubleSideBracket.tsx
        │   │   ├── GroupStage.tsx
        │   │   ├── Grupos.tsx
        │   │   ├── Historico.tsx
        │   │   ├── ListaCronograma.tsx
        │   │   ├── LowerRound.tsx
        │   │   ├── MeusJogosPendentes.tsx
        │   │   ├── TodosJogosPendentes.tsx
        │   │   ├── UpperRound.tsx
        │   │   ├── VisaoGeral.tsx
        │   │   ├── cut-edge.ts
        │   │   ├── dates.ts
        │   │   └── icons.ts
        │   ├── draft/
        │   │   ├── DraftRoom.tsx
        │   │   ├── championPositions.ts
        │   │   ├── draftSounds.ts
        │   │   └── draftTypes.ts
        │   ├── home/
        │   │   └── TopTeamsStickers.tsx
        │   ├── icons/
        │   │   └── GoldEssenceIcon.tsx
        │   ├── layout/
        │   │   └── LayoutWrapper.tsx
        │   ├── modals/
        │   │   └── deposit/
        │   │       ├── DepositModal.tsx
        │   │       ├── DepositTab.tsx
        │   │       └── SaqueTab.tsx
        │   ├── notifications/
        │   │   ├── NotificationBell.tsx
        │   │   └── VerificacaoStatus.tsx
        │   ├── partidas/
        │   │   ├── BilheteAtivoView.tsx
        │   │   ├── ChatDaSala.tsx
        │   │   ├── FilaSelector.tsx
        │   │   ├── HeaderFinalizada.tsx
        │   │   ├── ItemMercado.tsx
        │   │   ├── ModaisElegibilidade.tsx
        │   │   ├── ModalResultadoAposta.tsx
        │   │   ├── SummonerCard.tsx
        │   │   └── VagaSlot.tsx
        │   ├── perfil/
        │   │   ├── CarteiraEStrikes.tsx
        │   │   └── HistoricoApostas.tsx
        │   ├── players/
        │   │   └── PlayerDetailModal.tsx
        │   └── ui/
        │       ├── CutCard.tsx
        │       ├── MCIcon.tsx
        │       └── VipBadge.tsx
        ├── features/
        │   ├── campeonatos/
        │   │   ├── CampeonatoContext.tsx
        │   │   ├── mappers.ts
        │   │   ├── tournamentCache.ts
        │   │   ├── types.ts
        │   │   ├── components/
        │   │   │   ├── FormCriarCampeonato.tsx
        │   │   │   └── modals/
        │   │   │       ├── AdminMatchModal.tsx
        │   │   │       ├── AgendamentoModal.tsx
        │   │   │       ├── BracketModal.tsx
        │   │   │       ├── InscricaoModal.tsx
        │   │   │       └── RegrasModal.tsx
        │   │   └── domain/
        │   │       ├── bracket.ts
        │   │       ├── imagem.ts
        │   │       └── team-ref.ts
        │   ├── m7-academy-tierlist/
        │   │   ├── TierListExperience.tsx
        │   │   ├── api.ts
        │   │   ├── constants.ts
        │   │   ├── types.ts
        │   │   ├── utils.ts
        │   │   ├── data/
        │   │   │   └── champions.ts
        │   │   └── components/
        │   │       ├── AvailabilityEditor.tsx
        │   │       ├── ChampionPicker.tsx
        │   │       ├── Field.tsx
        │   │       ├── PlayerForm.tsx
        │   │       ├── ProgressPanel.tsx
        │   │       ├── RiotLookup.tsx
        │   │       ├── SubmitPanel.tsx
        │   │       ├── SuccessScreen.tsx
        │   │       ├── TierlistBoard.tsx
        │   │       └── TierlistSection.tsx
        │   ├── sala-campeonato/
        │   │   ├── SalaCampeonato.tsx
        │   │   └── ModalResultadoManual.tsx
        │   ├── sala-time-vs-time/
        │   │   └── SalaTimeVsTime.tsx
        │   └── streams/
        │       ├── types.ts
        │       └── components/
        │           └── AgendaTransmissoes.tsx
        └── pages/
            ├── Admin.tsx
            ├── AdminCargos.tsx
            ├── AdminContatos.tsx
            ├── AdminPunicoes.tsx
            ├── AdminSenhas.tsx
            ├── ApostaIndividualPage.tsx
            ├── AuthCallback.tsx
            ├── CampeonatoDetalhes.tsx
            ├── Login.tsx
            ├── Lobby.tsx
            ├── MinhasPartidas.tsx
            ├── Politicas.tsx
            ├── QuemSomos.tsx
            ├── RedefinirSenha.tsx
            ├── ResetHandler.tsx
            ├── ResetPassword.tsx
            ├── SalaMod1.tsx
            ├── Streamers.tsx
            ├── TimePage.tsx
            ├── Tutorial.tsx
            ├── Vincular.tsx
            ├── campeonatos.tsx
            ├── createCampPage.tsx
            ├── equipes.tsx
            ├── Jogar.tsx
            ├── perfil.tsx
            ├── players.tsx
            └── tierlist.tsx                 (não roteado)
```

---

## 3. Páginas e rotas do front

`web/src/App.tsx` declara **32 rotas com path** (mais o `<Route>` de layout sem
path). Há **28 arquivos de página**; 27 são renderizados em alguma rota. Dois
componentes são reaproveitados em mais de uma rota.

| Rota | Componente | Acesso | Observação |
|---|---|---|---|
| `/` | `RootRedirect` (inline) | público | Redireciona para `/lobby`, preservando callback OAuth |
| `/login` | `Login.tsx` | público | Login por e-mail/senha + Google |
| `/reset-password` | `ResetHandler.tsx` | público | **Stub**: só redireciona para `/login` |
| `/resetpassword` | `ResetPassword.tsx` | público | **Stub**: só redireciona para `/login` |
| `/redefinir-senha` | `RedefinirSenha.tsx` | público | Reset real, por token gerado no painel admin |
| `/auth/callback` | `AuthCallback.tsx` | público | Callback OAuth |
| `/admin` | `Admin.tsx` | privado | Tela cheia, fora do Layout; tem sidebar própria |
| `/lobby` | `Lobby.tsx` | público | Home logada/visitante |
| `/times` | `equipes.tsx` | público | Lista de times |
| `/times/:id` | `TimePage.tsx` | público | Página do time |
| `/players` | `players.tsx` | público | Diretório de jogadores |
| `/streamers` | `Streamers.tsx` | público | Painel/vitrine de streamers |
| `/quem-somos` | `QuemSomos.tsx` | público | Institucional |
| `/politicas` | `Politicas.tsx` | público | Políticas |
| `/campeonatos` | `campeonatos.tsx` | público | Lista de campeonatos |
| `/campeonato/:id` | `CampeonatoDetalhes.tsx` | público | Detalhe do campeonato |
| `/tutorial` | `Tutorial.tsx` | público | Tutorial |
| `/jogar` | `Jogar.tsx` | público | Vitrine de salas; ações abrem login/cadastro |
| `/aposta-individual` | `ApostaIndividualPage.tsx` | privado | Aposta individual |
| `/perfil` | `perfil.tsx` | privado | Perfil |
| `/partidas` | `MinhasPartidas.tsx` | privado | Histórico do jogador |
| `/vincular` | `Vincular.tsx` | privado | Vínculo Riot |
| `/admin/criar-campeonato` | `createCampPage.tsx` | privado | Criação de campeonato |
| `/5v5/:id` | `SalaMod1.tsx` | público | Sala 5v5 |
| `/aram/:id` | `SalaMod1.tsx` | público | Mesmo componente |
| `/1v1/:id` | `SalaMod1.tsx` | público | Mesmo componente |
| `/time_vs_time/:id` | `SalaTimeVsTime.tsx` | público | Sala legada de time vs time |
| `/campeonato/sala/:id` | `SalaCampeonato.tsx` | público | Sala de série de campeonato |
| `/sala-time/:id` | `SalaCampeonato.tsx` | público | Sala de time livre (scrim) |
| `/time_vs_time_livre/:id` | `RedirecionaSalaLivre` (inline) | público | Compat: redireciona para `/sala-time/:id` |
| `/admin/cargos` | `AdminCargos.tsx` | privado | Página inteira que duplica a aba de `/admin` |
| `/admin/contatos` | `AdminContatos.tsx` | privado | Página inteira que duplica a aba de `/admin` |

**Página sem rota:** `web/src/pages/tierlist.tsx` não é importada por `App.tsx`
nem por nenhum outro arquivo. Ela só existe para montar `TierListExperience`.

---

## 4. API — routers e mounts

`api/src/index.ts` monta **24 routers**. Existem **27 arquivos de rota**:
24 montados diretamente, 2 sub-routers de `content` e 1 não montado.

| Mount | Arquivo | Domínio | Observação |
|---|---|---|---|
| `/api/auth` | `auth.ts` | login, registro, logout, sessão | — |
| `/api/auth` | `password-reset.ts` | recuperação de senha | — |
| `/api/terms` | `auth.ts` (`termsRouter`) | aceite de termos | — |
| `/api/auth` | `auth-google.ts` | OAuth Google | — |
| `/api/riot` | `riot.ts` | proxy Riot (invocador, elos, partidas) | Depende de `RIOT_API_KEY` |
| `/api/upload` | `upload.ts` | upload de imagens | `multer` + `sharp` |
| `/api/profiles` | `profiles.ts` | perfil, Riot ID, preferências | — |
| `/api/players` | `players.ts` | diretório, elos, stats | — |
| `/api/teams` | `teams.ts` | times, membros, convites | — |
| `/api/wallet` | `wallet.ts` | saldo MP/MC, ajuste admin | — |
| `/api/payments` | `payments.ts` | pedido PIX + webhook | Bloqueado por BLK-005 |
| `/api/withdrawals` | `withdrawals.ts` | saque MC via PIX | — |
| `/api/matches` | `matches.ts` | salas, listagem, detalhe, chat | Monta `matches-actions` |
| `/api/matches` | `matches-actions.ts` | join/leave/confirm/draft/sala-campeonato | Sub-router |
| `/api/revisao` | `revisao.ts` | revisão de salas apostadas | Admin/moderador |
| `/api/prints` | `prints.ts` | leitura de prints de partida | Sem POST |
| `/api/disputas` | `disputas.ts` | abertura/consulta de disputa | Front não usa `POST` |
| `/api/tournaments` | `tournaments.ts` | campeonatos, inscrições, cronograma, séries | Ver gap de permissão |
| `/api/content` | `content.ts` | notícias, highlights, player stats | Sub-routers |
| `/api/content/news` | `content-news.ts` | CRUD de notícias | Sub-router |
| `/api/content/highlights` | `content-highlights.ts` | CRUD de highlights | Sub-router |
| `/api/streams` | `streams.ts` | agenda e transmissões | — |
| `/api/admin` | `admin-password-reset.ts` | reset de senha pelo admin | — |
| `/api/admin` | `admin.ts` | cargos, usuários, punições, financeiro | — |
| `/api/bets` | `bets.ts` | aposta individual | — |
| `/api/notifications` | `notifications.ts` | notificações | — |
| `/api/og` | `og.ts` | preview social para crawlers | Nginx desvia bots |
| — | `tierlists.ts` | tierlist M7 Academy | **NÃO montado** |

Além disso, `api/src/index.ts` registra **4 jobs periódicos**:

| Intervalo | Job | Arquivo |
|---|---|---|
| 10 min | kick de ociosidade + partida fantasma | `cron.ts` (`runCron`) |
| 1 min | criação de salas de campeonato pendentes | `lib/sala-campeonato.ts` |
| 3 min | verificação de séries de campeonato | `lib/serie-campeonato.ts` |
| 3 dias | reconciliação de Riot ID | `lib/reconciliar-handles.ts` |
| 7 dias | refresh de elos | `lib/atualizar-elos.ts` |

---

## 5. Banco de dados

**48 tabelas** Drizzle em 11 arquivos de schema; **35 migrations** SQL.

| Domínio | Tabelas | Uso no código |
|---|---|---|
| Identidade | `users`, `user_identities`, `user_sessions`, `password_reset_tokens`, `user_roles`, `user_wallets`, `user_payout_info` | Ativo |
| Games | `games`, `game_accounts` | Ativo |
| Times | `teams`, `team_members`, `team_invites`, `team_stats` | Ativo |
| Partidas/salas | `matches`, `match_players`, `match_results`, `match_codes`, `match_drafts`, `campeonato_sala_estado`, `sala_mensagens` | Ativo |
| Economia | `wallet_transactions`, `payments`, `platform_revenue`, `mc_packages`, `withdrawals` | Ativo |
| Economia | `referral_events` | **Sem referência no código** |
| Conteúdo | `news`, `highlights`, `transmissoes`, `escalas_transmissao`, `notifications` | Ativo |
| Conteúdo | `player_stats` | API ativa; front não consome |
| Conteúdo | `broadcasts`, `recruitment_posts` | **Sem referência no código** |
| Campeonatos | `tournaments`, `tournament_groups`, `tournament_teams`, `tournament_matches`, `bracket_matches`, `tournament_standings`, `tournament_series_games` | Ativo |
| Apostas/salas | `user_advertencias`, `match_prints`, `match_disputas` | Ativo (prints/disputas só no admin) |
| Bets | `bet_tickets`, `bet_legs` | Ativo |
| Retenção | `audit_logs` | **Sem referência no código** |
| Tierlist | `tierlist_submissions` | **Sem uso** (router não montado) |

**Observações confirmadas:**

- `audit_logs` não é particionado. É uma tabela comum com três índices
  (`db/schema/retencao.ts` e `0000_brave_korg.sql`).
- `db/schema/tierlist.ts` existe, mas **não é exportado** por
  `db/schema/index.ts`; é importado direto por `api/src/lib/tierlist.ts`.
- `referral_events`, `broadcasts`, `recruitment_posts` e `audit_logs` foram
  criados na migration inicial e nunca recebem `INSERT`/`SELECT` no código.
- `DISCARDED.md` lista `scrims` como "funcionalidade descontinuada", mas o fluxo
  de scrim (`time_vs_time_livre`) está ativo em `SalaCampeonato` e `Jogar`.

---

## 6. Features — o que está ativo, incompleto e inativo

### 6.1 Ativas (têm tela, rota e uso real)

| # | Feature | Onde vive | Evidência de uso |
|---|---|---|---|
| 1 | Autenticação e sessão | `api/routes/auth*.ts`, `web/src/contexts/AuthContext.tsx` | Login, registro, logout, `/auth/me` |
| 2 | Perfil e vínculo Riot | `api/routes/profiles.ts`, `players.ts`, `riot.ts`; `pages/perfil.tsx`, `Vincular.tsx` | Perfil, elo, ícone, Riot ID |
| 3 | Diretório de jogadores | `api/routes/players.ts`; `pages/players.tsx` | Lista, busca, detalhe |
| 4 | Times | `api/routes/teams.ts`; `pages/equipes.tsx`, `TimePage.tsx` | Criar time, convites, membros, logo |
| 5 | Salas casuais 5v5/ARAM/1v1 | `api/routes/matches.ts`, `matches-actions.ts`; `pages/Jogar.tsx`, `SalaMod1.tsx` | Criar, entrar, confirmar, draft, código |
| 6 | Salas apostadas + escrow | `api/lib/escrow.ts`, `routes/revisao.ts`; `components/admin/RevisaoPartidas.tsx` | Reserva, prêmio, revisão |
| 7 | Sala de campeonato / série | `api/lib/sala-campeonato*.ts`, `serie-campeonato.ts`; `features/sala-campeonato/` | Vagas de time, PRONTO, lado, draft, código |
| 8 | Sala Time vs Time livre (scrim) | `api/lib/serie-livre.ts`, `routes/matches-actions.ts`; `features/sala-campeonato/SalaCampeonato.tsx` | `/sala-time/:id` |
| 9 | Campeonatos | `api/routes/tournaments.ts`, `lib/tournament-*.ts`; `pages/campeonatos.tsx`, `CampeonatoDetalhes.tsx`, `createCampPage.tsx`, `features/campeonatos/` | Inscrição, grupos, chaves, cronograma, PDL |
| 10 | Draft | `api/lib/draft/**`; `components/draft/DraftRoom.tsx` | Ban/pick, Fearless, prévia |
| 11 | Carteira MP/MC | `api/routes/wallet.ts`, `lib/escrow.ts`; `components/modals/deposit/` | Saldo, extrato, ajuste admin |
| 12 | Saque PIX | `api/routes/withdrawals.ts`, `lib/withdrawals.ts`; `SaqueTab.tsx`, `SaquesPix.tsx` | Pedido, decisão admin |
| 13 | Aposta individual | `api/routes/bets.ts`, `lib/bets.ts`, `lib/live-bets.ts`; `pages/ApostaIndividualPage.tsx` | Catálogo, bilhete, liquidação |
| 14 | Streams | `api/routes/streams.ts`, `lib/streams.ts`, `lib/transmissoes.ts`; `pages/Streamers.tsx`, `features/streams/` | Agenda, entrar no ar, parar |
| 15 | Conteúdo (notícias/highlights) | `api/routes/content*.ts`; `pages/Lobby.tsx`, `Admin.tsx` | Listagem e CRUD admin |
| 16 | Notificações | `api/routes/notifications.ts`; `components/notifications/NotificationBell.tsx` | Sino e leitura |
| 17 | Admin | `api/routes/admin*.ts`; `pages/Admin*.tsx`, `components/admin/` | Cargos, contatos, punições, senhas, financeiro |
| 18 | Realtime + chat de sala | `api/src/realtime/index.ts`; `hooks/useSalaRealtime.ts`, `useSalaChat.ts` | WebSocket + LISTEN/NOTIFY |
| 19 | Upload de imagens | `api/routes/upload.ts`; `features/campeonatos/domain/imagem.ts`, `pages/equipes.tsx` | Logos e imagens de campeonato |
| 20 | Preview OG | `api/routes/og.ts`; `infra/nginx.conf` | Metatags para crawlers |

### 6.2 Incompletas ou bloqueadas por configuração

| Feature | Estado do código | O que falta | Marcador |
|---|---|---|---|
| Pagamentos MC (PIX) | Rotas, webhook idempotente, crédito atômico e testes existem | Conta Mercado Pago sem chave PIX habilitada | **BLK-005** (externo) |
| Proxy Riot / vínculo | Rotas e cache de elo existem | `RIOT_API_KEY` de desenvolvimento expira em ~24h | **BLK-006** (externo) |
| Backups automáticos | Serviço `backup` no compose | Dumps de 20 bytes; `PGPASSWORD` não é exportado no entrypoint | **BLK-008** (suspeita forte) |
| MCP de operações | `mcp/ops-server/index.js` | Container em restart loop; dependência não instalada no mount | **BLK-009** (suspeita forte) |
| Permissões de escrita do campeonato | Rotas existem, mas só checam sessão | Falta validar organizador/staff e dono do time | **TODO `sec.campeonato-permissoes`** |

### 6.3 Inativas, órfãs ou sem fluxo de uso

| Item | O que existe | Situação confirmada |
|---|---|---|
| Tierlist M7 Academy | `features/m7-academy-tierlist/` (16 arquivos), `pages/tierlist.tsx`, `api/routes/tierlists.ts`, `api/lib/tierlist.ts`, tabela `tierlist_submissions` | Página não roteada, router não montado, `ProgressPanel.tsx` sem import. O front chama `/api/tierlists`, que responde 404 hoje. |
| Recrutamento | Tabela `recruitment_posts` + texto no Lobby ("painel de recrutamento") | Nenhuma rota, nenhum componente, nenhuma referência no código da API. |
| VIP | Campo `users.is_vip`, `VipBadge`, exibição em perfil/players/salas | Não existe rota ou tela que conceda VIP; o código só **lê** o campo. |
| Reset de senha legado | `ResetHandler.tsx`, `ResetPassword.tsx` e rotas `/reset-password`, `/resetpassword` | Ambos são stubs que redirecionam para `/login`. O fluxo ativo é `/redefinir-senha`. |
| Sala Time vs Time legada | Rota `/time_vs_time/:id` + `SalaTimeVsTime.tsx` | A criação nova vai para `time_vs_time_livre`; a rota antiga continua servindo salas históricas. |
| Print/disputa pelo jogador | `POST /api/disputas/:matchId`, `GET /api/prints/:matchId` | O front não chama `POST /api/disputas` nem upload de print. O admin só lê. |
| `player_stats` | `GET/POST /api/content/player-stats` + SDK `api.content.playerStats` | Nenhum componente do front chama. |
| `api.matches.start` | Declarado em `ApiMatchesSdk` (`web/src/lib/api.ts:521`) | Não existe implementação no objeto `api`; nenhum chamador. |
| `broadcasts`, `referral_events`, `audit_logs`, `recruitment_posts` | Tabelas no schema e na migration | Zero referências de leitura/escrita no código. |

---

## 7. Redundâncias e duplicações

| # | O que está duplicado | Onde | Consequência |
|---|---|---|---|
| R-01 | Sala de time vs time | `features/sala-time-vs-time/SalaTimeVsTime.tsx` é descrita no próprio `App.tsx` como "cópia 1:1 de SalaMod1" | Duas UIs de sala para o mesmo domínio; correções precisam ser feitas duas vezes |
| R-02 | Duas implementações de sala de time | `SalaTimeVsTime` (legado, `/time_vs_time/:id`) e `SalaCampeonato` (novo, `/sala-time/:id`) | Fluxos e estados diferentes convivem |
| R-03 | Painel de cargos | Aba `AbaCargos` dentro de `/admin` + página inteira `/admin/cargos` | Mesma tela em dois formatos |
| R-04 | Painel de contatos | Aba `AbaContatos` dentro de `/admin` + página inteira `/admin/contatos` | Mesma tela em dois formatos |
| R-05 | Reset de senha | `/reset-password` (stub), `/resetpassword` (stub) e `/redefinir-senha` (real) | Duas rotas e dois arquivos sem função |
| R-06 | Criação de sala de time | `Jogar.tsx` tem `criarSalaTimes()` com `fetch` cru para `/api/matches/time-vs-time` | O fluxo não passa pelo SDK central |
| R-07 | Leitura de sala | `SalaCampeonato.tsx` repete 7 `fetch` diretos para `/api/...` em vez de usar `api.*` | Mesma regra de acesso duplicada |
| R-08 | Dois "clientes" de sala | `useSalaSimples.ts` (SalaMod1) e a lógica própria de `SalaCampeonato.tsx` | Comportamentos de polling/realtime divergem |
| R-09 | `SalaMod1` atende 3 rotas | `/5v5/:id`, `/aram/:id`, `/1v1/:id` | Intencional (mesmo componente), mas aumenta o acoplamento por modo |
| R-10 | `SalaCampeonato` atende 2 rotas | `/campeonato/sala/:id` e `/sala-time/:id` | Intencional (ADR-086), mas concentra dois fluxos |

---

## 8. Problemas estruturais confirmados

> Todos os itens abaixo foram verificados no código ou em arquivos do
> repositório. Nenhum é recomendação de mudança — é descrição do estado.

### E-01. `api/package.json` aponta `start` para o caminho errado

`api/package.json` tem `"start": "node dist/index.js"`, mas o `tsconfig` usa
`"rootDir": ".."` e inclui `../db/schema`. O build gera
`dist/api/src/index.js` (e `dist/db/schema/*`). O `Dockerfile` usa o caminho
correto (`CMD ["node", "dist/api/src/index.js"]`), mas `npm start` dentro de
`api/` falha.

**Arquivos:** `api/package.json`, `api/tsconfig.json`, `Dockerfile`.

### E-02. O front não está em TypeScript `strict`

`AGENTS.md` exige `strict: true`. `web/tsconfig.json` não define `strict` nem
`extends` de um config estrito. O `api/tsconfig.json` define `strict: true`.
O script `web` de lint é `tsc --noEmit`, mas roda sem strict.

**Arquivos:** `web/tsconfig.json`, `api/tsconfig.json`, `web/package.json`.

### E-03. CI não roda typecheck, lint nem testes

`.github/workflows/ci.yml` faz checkout, `npm ci` na raiz e build da imagem
Docker. Não executa `tsc --noEmit`, `vite build` isolado, `tsx --test` nem
`verify-swap.js`. O build da imagem instala dependências e compila, mas não
roda a suíte.

**Arquivos:** `.github/workflows/ci.yml`, `Dockerfile`.

### E-04. 43 testes da API não estão ligados a um script

Existem 43 arquivos em `api/test/`, mas `api/package.json` não tem script
`test`. A documentação operacional manda rodar
`npx tsx --test --test-concurrency=1 api/test/*.test.ts` manualmente. Sem
script, o CI não descobre e o agente novo não tem comando óbvio.

**Arquivos:** `api/test/`, `api/package.json`, `docs/superpowers/plans/2026-10-20-reset-senha-admin.md`.

### E-05. `api.matches.start` é uma promessa sem implementação

`web/src/lib/api.ts` declara `start: (id: number) => Promise<ApiSalaResultado>`
na interface `ApiMatchesSdk` (linha 521), mas o objeto `api.matches` (linhas
988-1038) não implementa `start`. O objeto é forçado com `as ApiMatchesSdk`,
então o TypeScript não acusa. Se alguém chamar `api.matches.start(...)`, o
erro é em runtime (`undefined is not a function`).

**Arquivos:** `web/src/lib/api.ts`.

### E-06. Router `tierlists` não montado, mas o front chama `/api/tierlists`

`api/src/index.ts` não importa `tierlistsRouter`. `web/src/features/m7-academy-tierlist/api.ts`
faz `fetch("/api/tierlists", ...)`. A feature inteira está desconectada:
página sem rota, router sem mount, `ProgressPanel.tsx` sem import.

**Arquivos:** `api/src/index.ts`, `api/src/routes/tierlists.ts`, `web/src/pages/tierlist.tsx`, `web/src/features/m7-academy-tierlist/api.ts`.

### E-07. `db/schema/tierlist.ts` fora do barrel de schema

`db/schema/index.ts` exporta 10 arquivos, mas não `tierlist.ts`. O código da
API importa o arquivo direto, então as queries funcionam. Porém
`drizzle.config.ts` aponta para `db/schema/index.ts` e `db/index.ts` importa
`./schema`: a tabela fica fora do schema do Drizzle Kit e do objeto `db`.
Risco latente: o próximo `drizzle-kit generate` pode propor `DROP TABLE
tierlist_submissions`, porque a tabela existe no snapshot mas não no schema
declarado. **PRECISA DE VERIFICAÇÃO** antes de rodar `generate`.

**Arquivos:** `db/schema/index.ts`, `db/schema/tierlist.ts`, `api/src/lib/tierlist.ts`.

### E-08. Rotas de escrita de campeonato sem autorização de organizador

Estas rotas só verificam se existe sessão (`getAuthUser`), não se o usuário é
organizador, admin ou dono do time:

- `POST /api/tournaments`
- `PUT /api/tournaments/:id`
- `POST /api/tournaments/:id/inscricoes`
- `POST /api/tournaments/:id/inscricoes/:teamId/aprovar`
- `POST /api/tournaments/:id/reabrir`
- `PUT /api/tournaments/:id/cronograma`
- `PUT /api/tournaments/:id/cronograma/merge`
- `POST /api/tournaments/:id/recalcular-pdl`

Na prática, qualquer usuário logado pode editar qualquer campeonato, aprovar a
própria inscrição e reabrir campeonato encerrado. `DELETE /:id` e
`DELETE /:id/inscricoes/:teamId` **têm** checagem; as demais não. É exatamente
o TODO `sec.campeonato-permissoes`.

**Arquivos:** `api/src/routes/tournaments.ts` (linhas 331, 368, 428, 446, 493,
510, 528, 556).

### E-09. `POST /:id/inscricoes` não valida o dono do time

Além de não checar organizador, a rota de inscrição aceita qualquer `teamId`
do body e chama `storeTimesInscritos`, que resolve o time por id/tag e faz
upsert. Não há verificação de que o usuário logado é dono ou membro do time
inscrito.

**Arquivos:** `api/src/routes/tournaments.ts:428`, `api/src/lib/tournament-store.ts:60`.

### E-10. Saldo de terceiros é público por `GET /api/wallet/admin/balances?userIds=...`

O comentário no código assume a paridade com a RPC antiga: com `userIds`, a
rota é pública e devolve `mp`/`mc` de qualquer usuário. Sem `userIds`, exige
admin. É uma decisão de produto, mas é uma exposição de dado financeiro que
merece decisão explícita.

**Arquivos:** `api/src/routes/wallet.ts:101-137`, `web/src/pages/players.tsx:130`, `web/src/pages/TimePage.tsx:1410`.

### E-11. `fetch` cru fora do SDK central

`AGENTS.md`/`ARQUITETURA.md` dizem que o acesso a dados passa por
`web/src/lib/api.ts` e `web/src/api/*`. Há chamadas diretas:

- `web/src/pages/Jogar.tsx:764` — `POST /api/matches/time-vs-time`
- `web/src/features/sala-campeonato/SalaCampeonato.tsx` — 7 chamadas
  (`/api/matches/:id`, `/tick`, `/api/teams/by-user/:uid`, `/api/matches/:id${path}`,
  `/api/streams/:id/parar`, `/api/tournaments/.../verificar`, `/api/matches/:id/verificar`)

**Arquivos:** citados acima.

### E-12. Erros engolidos em módulos de API do front

`web/src/api/salamod1.ts` (`buscarsalas`, `buscarJogadores`) e
`web/src/api/player.ts` (`buscarElosJogador`, `sincronizarContaRiot`) têm
`catch` que devolve `null`/`[]` sem registrar nem propagar. Isso contraria a
regra "nunca engula erro" e transforma falha de rede em "sem dados".

**Arquivos:** `web/src/api/salamod1.ts:6-19`, `web/src/api/player.ts:61-63, 93-95`.

### E-13. Quatro tabelas sem nenhuma referência no código

`broadcasts`, `recruitment_posts`, `referral_events` e `audit_logs` existem no
schema e na migration `0000_brave_korg.sql`, mas não têm `SELECT`, `INSERT`,
`UPDATE` ou `DELETE` em `api/src`, `web/src` ou `scripts/`.

**Arquivos:** `db/schema/conteudo.ts`, `db/schema/economia.ts`,
`db/schema/retencao.ts`, `db/migrations/0000_brave_korg.sql`.

### E-14. `player_stats` tem API, SDK e tabela, mas nenhum consumidor no front

`api/src/routes/content.ts` expõe `GET/POST /api/content/player-stats`;
`web/src/lib/api.ts` declara `api.content.playerStats` e
`recordPlayerStats`; nenhum componente chama. O dado não aparece em perfil,
players ou sala.

**Arquivos:** `api/src/routes/content.ts:18-83`, `web/src/lib/api.ts:982-986`.

### E-15. Fluxo de print/disputa do jogador não existe no front

A API tem `POST /api/disputas/:matchId`, `GET /api/prints/:matchId` e o
bucket privado `match-prints` em `POST /api/upload`. O admin lê prints/disputas
em `RevisaoPartidas.tsx`. Mas o front não tem upload de print nem botão de
abrir disputa: `api.prints.upload`, `api.prints.list`, `api.disputas.abrir` e
`api.disputas.list` não são chamados em lugar nenhum.

**Arquivos:** `api/src/routes/disputas.ts:79`, `api/src/routes/prints.ts:43`,
`web/src/components/admin/RevisaoPartidas.tsx`, `web/src/lib/api.ts:1188-1211`.

### E-16. Arquivos muito acima do limite de ~400 linhas

Front (linhas): `TimePage.tsx` 1984, `Lobby.tsx` 1869,
`SalaCampeonato.tsx` 1657, `Admin.tsx` 1627, `createCampPage.tsx` 1572,
`CampeonatoContext.tsx` 1483, `Jogar.tsx` 1335, `DraftRoom.tsx` 1257,
`api.ts` 1167, `SalaMod1.tsx` 1133, `equipes.tsx` 1104,
`SalaTimeVsTime.tsx` 1089.

API (linhas): `lib/sala-campeonato.ts` 858, `routes/teams.ts` 815,
`lib/serie-campeonato.ts` 744, `routes/tournaments.ts` 644,
`routes/matches-actions.ts` 635, `routes/matches.ts` 633,
`realtime/index.ts` 530, `lib/tournament-shape.ts` 519, `routes/upload.ts` 484.

**Arquivos:** citados acima.

### E-17. `npm run clean` do front não funciona no PowerShell

`web/package.json` tem `"clean": "rm -rf dist"`. No Windows/PowerShell padrão
do usuário, `rm` não existe com essa semântica. O comando só funciona em
Git Bash/WSL.

**Arquivo:** `web/package.json`.

### E-18. Dockerfile usa `npm install` em vez de `npm ci`

Os dois estágios (`api-builder`, `web-builder`) usam `npm install`, apesar de
existirem `package-lock.json`. Isso permite que o build resolva versões
diferentes do lock.

**Arquivo:** `Dockerfile`.

### E-19. `.mcp.json` aponta para `MCP/` com maiúscula

O arquivo referencia `D:/Aplicativos/M7arenaSite/MCP/browser-server/server.js`,
mas a pasta real é `mcp/browser-server`. No Windows funciona por
case-insensitivity; em Linux/macOS não.

**Arquivo:** `.mcp.json`.

### E-20. `mcp-ops` sobe sem instalar dependências

`infra/docker-compose.yml` monta `../mcp/ops-server` em `/app/ops-server` e
roda `node /app/ops-server/index.js` em uma imagem `node:22-alpine` limpa. O
`package.json` do ops-server depende de `@modelcontextprotocol/sdk`, que não
está no mount. É a **causa provável** do restart loop (BLK-009); confirmar com
`docker logs m7arena_mcp_ops`.

**Arquivos:** `infra/docker-compose.yml:125-139`, `mcp/ops-server/package.json`.

### E-21. Serviço de backup não exporta `PGPASSWORD`

O entrypoint do serviço `backup` chama `pg_dump -h postgres -U postgres`
sem exportar `PGPASSWORD`. As variáveis `POSTGRES_*` são definidas no
`environment`, mas o `pg_dump` não as usa automaticamente. É a **causa
provável** do dump de 20 bytes (BLK-008); confirmar com
`docker logs m7arena_backup`.

**Arquivo:** `infra/docker-compose.yml:109-123`.

### E-22. Documentação de arquitetura desatualizada em pontos concretos

`docs/ARQUITETURA.md` afirma:

- produção no branch `feat/redesign-modais` — o repositório está em `main`
  (`origin/HEAD -> origin/main`);
- `audit_log` particionado por mês — o schema tem `audit_logs` comum;
- `broadcasts` e `recruitment_posts` como conteúdo ativo — não têm código;
- "recrutamento" como domínio principal — não existe feature;
- `referral_events` como economia — não tem código.

**Arquivo:** `docs/ARQUITETURA.md`.

### E-23. `DISCARDED.md` contradiz o fluxo atual de scrim

O documento diz que `scrims` é "funcionalidade descontinuada de
treinos/scrims". O código tem `time_vs_time_livre`, rota `/sala-time/:id`,
`SalaCampeonato` e criação em `Jogar.tsx`. A tabela antiga pode ter sido
descartada, mas a feature não está descontinuada.

**Arquivos:** `db/schema/DISCARDED.md`, `web/src/App.tsx:257-258`,
`web/src/pages/Jogar.tsx:755-781`.

### E-24. Auditoria de segurança marcada como "Open" sem revalidação

`docs/auditoria-salas-morpheus.md` lista MORPH-001..004 como **Open**. No
código atual, MORPH-001 (senha da sala) está corrigido: o `join` valida a
senha no servidor (`api/src/routes/matches.ts:500-515`) e o shape não devolve
a senha. MORPH-002 (clamp de `taxaPct`/`maxJogadores`) também está corrigido
(`matches.ts:415-432`). MORPH-003 (CORS) está corrigido em `api/src/index.ts`.
O documento precisa de revalidação — hoje ele induz a achar que há três
vulnerabilidades abertas que o código já trata.

**Arquivos:** `docs/auditoria-salas-morpheus.md`, `api/src/routes/matches.ts`,
`api/src/index.ts`.

### E-25. `time_vs_time` legado continua roteado e a criação nova usa outro modo

A rota `/time_vs_time/:id` renderiza `SalaTimeVsTime` (cópia de `SalaMod1`),
enquanto a criação nova em `Jogar.tsx` detecta `modo === 'time_vs_time'` e
desvia para `POST /api/matches/time-vs-time` (modo `time_vs_time_livre`).
Ou seja: existem dois modelos de dados e duas UIs para "time vs time"; a rota
antiga só serve salas históricas. Não há indicação no código de quando (ou se)
as salas antigas deixarão de existir.

**Arquivos:** `web/src/App.tsx:255`, `web/src/pages/Jogar.tsx:704-781`,
`web/src/features/sala-time-vs-time/SalaTimeVsTime.tsx`.

### E-26. Rate limit da tierlist é em memória

`api/src/routes/tierlists.ts` usa um `Map` local (`rateHits`) para limitar
20 envios/10 min por IP. Isso zera no restart e não é compartilhado entre
réplicas. Hoje o router nem está montado, então o risco é latente.

**Arquivo:** `api/src/routes/tierlists.ts:11-20`.

### E-27. Jobs periódicos rodam dentro do processo da API

`api/src/index.ts` registra `setInterval` no mesmo processo do Express. Com
uma réplica só (situação atual), funciona. Com duas ou mais, cada réplica
executaria o mesmo cron (criação de salas, verificação de séries, refresh de
elos) em paralelo. Não há lock distribuído.

**Arquivo:** `api/src/index.ts:117-177`.

---

## 9. Suspeitas e pontos que precisam de verificação

> Itens aqui **não** foram provados só com o repositório. Dependem de banco de
> produção, logs da VPS, uso externo ou decisão de produto.

| # | Suspeita | Por que parece | Como verificar |
|---|---|---|---|
| S-01 | VIP é concedido manualmente no banco | Nenhuma rota/`UPDATE` seta `users.is_vip`; a UI só lê | Buscar `is_vip = true` e comparar com histórico de pagamentos |
| S-02 | `broadcasts` pode ser usado por processo externo | Tabela existe e tem índice `is_live`, mas nenhum código lê | Procurar jobs/scripts fora do repo e consultar linhas |
| S-03 | `referral_events` pode ter sido usado no site antigo | Tabela tem FKs e índices, mas zero código | Consultar contagem e datas no banco |
| S-04 | `audit_logs` pode receber escrita por trigger/rotina externa | Zero `INSERT` no código | `SELECT count(*), max(created_at)` e inspecionar triggers |
| S-05 | Salas `time_vs_time` antigas ainda têm partidas ativas | Rota e componente continuam no ar | `SELECT count(*) FROM matches WHERE mode='time_vs_time' AND status NOT IN (...)` |
| S-06 | O fluxo de print/disputa foi substituído pela verificação Riot, não removido | Comentários em `SalaMod1.tsx` dizem que a verificação "substitui o envio de print" | Confirmar com o usuário se o upload de print ainda é desejado |
| S-07 | `player_stats` pode ser consumido por cliente externo/antigo | API e SDK existem, front não usa | Procurar chamadas em logs do Nginx |
| S-08 | A falha do `mcp-ops` é só dependência faltando | `index.js` importa SDK ausente no mount | `docker logs m7arena_mcp_ops` e `docker exec ... ls node_modules` |
| S-09 | A falha do backup é só `PGPASSWORD` | Entrypoint não exporta a variável | `docker logs m7arena_backup` e testar `pg_dump` com `PGPASSWORD` |
| S-10 | MORPH-004 (se ainda existir) pode continuar aberto | Doc lista como Open; não foi revalidado nesta passada | Ler o finding e testar o fluxo correspondente |
| S-11 | `wallet/admin/balances` público é intencional | Comentário diz "paridade com a RPC antiga" | Confirmar decisão de produto com o usuário |
| S-12 | `tierlist` é feature futura do M7 Academy, não lixo | Estrutura completa (16 arquivos + API + tabela) | Confirmar roadmap com o usuário |
| S-13 | O upload de print ainda é aceito pelo servidor, mas pode não ser usado por ninguém | `POST /api/upload` aceita bucket `match-prints` e grava em `match_prints`; o front não oferece a ação | Procurar chamadas a `/api/upload` com `match-prints` nos logs do Nginx |
| S-14 | Assets de `web/public` podem ter arquivos órfãos | 95 binários sem inventário de referência | Cruzar nomes com `grep` no `src` |

---

## 10. Documentos vs código — divergências encontradas

| Documento | Afirma | Código mostra |
|---|---|---|
| `docs/ARQUITETURA.md` §7 | Produção no branch `feat/redesign-modais` | `main` é o branch atual e o default do remoto |
| `docs/ARQUITETURA.md` §3.5 | `audit_log` particionado por mês | `audit_logs` é tabela comum, sem partição e sem uso |
| `docs/ARQUITETURA.md` §3.5 | `broadcasts`, `recruitment_posts` fazem parte do conteúdo | Nenhum código lê/escreve |
| `docs/ARQUITETURA.md` §2 | "recrutamento" é domínio principal | Não existe rota, tela ou tabela em uso |
| `docs/ARQUITETURA.md` §3.4 | `referral_events` faz parte da economia | Nenhum código lê/escreve |
| `db/schema/DISCARDED.md` | `scrims` descontinuado | `time_vs_time_livre` ativo |
| `docs/auditoria-salas-morpheus.md` | MORPH-001/002/003 abertos | Corrigidos no código atual |
| `statusdoprojeto.md` | Gerado a partir de `docs/project-state.json` | Consistente; não editar à mão |

---

## 11. Números do estado atual

| Métrica | Valor |
|---|---|
| Arquivos do projeto (sem node_modules/.git/dist/uploads) | **509** |
| Diretórios | **80** |
| Arquivos TypeScript/TSX no front | **136** |
| Linhas de código no front (ts/tsx) | **~41.856** |
| Arquivos TypeScript em `api/src` | **73** |
| Linhas de código em `api/src` | **~15.269** |
| Arquivos de teste da API | **43** |
| Páginas (`web/src/pages/*.tsx`) | **28** |
| Páginas efetivamente roteadas | **27** |
| Rotas com path no front | **32** |
| Pastas de feature | **5** |
| Routers de API (arquivos) | **27** |
| Routers montados | **24** |
| Routers não montados | **1** (`tierlists`) |
| Sub-routers | **2** (`content-news`, `content-highlights`) |
| Declarações de rota na API (aprox.) | **215** |
| Arquivos em `api/src/lib` | **42** |
| Tabelas Drizzle | **48** |
| Migrations SQL | **35** |
| Tabelas sem referência no código | **4** |
| Componentes React | **44** (tsx) + 6 utilitários (ts) |
| Contexts | **4** |
| Hooks | **5** |
| Features ativas | **20** |
| Features incompletas/bloqueadas | **5** |
| Features inativas/órfãs | **9** |
| Problemas estruturais confirmados | **27** (E-01..E-27) |
| Suspeitas / precisa de verificação | **14** (S-01..S-14) |
| Redundâncias mapeadas | **10** (R-01..R-10) |

---

## 12. Resumo em uma página

O M7Arena é hoje um monorepo funcional com front React/Vite, API Express,
realtime separado e Postgres/Drizzle. As features centrais — autenticação,
perfil, times, salas casuais e apostadas, campeonatos, draft, carteira,
apostas individuais, streams, conteúdo, notificações e admin — estão ligadas
de ponta a ponta.

Os pontos que mais chamam atenção no estado atual são:

1. **Segurança de campeonato:** oito rotas de escrita só exigem login; qualquer
   usuário pode editar campeonato, aprovar inscrição e reabrir torneio.
2. **Feature tierlist desconectada:** front, API e tabela existem, mas nada
   está roteado/montado; o front chama um endpoint que responde 404.
3. **Duas implementações de sala de time:** a legada (`SalaTimeVsTime`,
   cópia de `SalaMod1`) e a nova (`SalaCampeonato`), com modos de dados
   diferentes.
4. **Quatro tabelas mortas:** `broadcasts`, `recruitment_posts`,
   `referral_events`, `audit_logs`.
5. **Dívida de padronização:** `fetch` cru em duas telas, erros engolidos em
   dois módulos de API, front sem `strict`, CI sem typecheck/testes, 43 testes
   sem script.
6. **Bloqueios externos** (Mercado Pago, Riot, backup, mcp-ops) estão
   registrados no status e não são, necessariamente, código incompleto.

Nada disso foi alterado. A decisão de manter, corrigir, isolar ou descontinuar
cada item fica com o usuário.
