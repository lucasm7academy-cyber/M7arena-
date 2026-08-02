# Plano: Zerar o Supabase — Conclusão dos swaps (Fase 3, Etapa B)

> **Para agentes:** este plano executa com subagentes em paralelo (worktree isolation). Cada swap é uma tarefa independente com gate mecânico (`verify-swap <dominio>` → 0). Atualizado em 2026-08-02 após a ADR-016 (campeonatos normalizados).
> **Gatilho:** usuário pediu para atualizar o plano à realidade atual e executar com até 5 subagentes.

**Goal:** Eliminar as **97 chamadas `supabase.*`** restantes em `web/src`, trocando-as pela API própria (`web/src/lib/api.ts`), para o site novo parar de depender do Supabase e `node scripts/verify-swap.js --strict` sair com exit 0.

**Architecture:** Cada domínio pendente é um swap independente (ordem importa: identidade destrava o PerfilContext). Para cada um: (1) estender a API (`api/src/routes/`) se faltar endpoint, (2) adicionar o namespace no SDK (`web/src/lib/api.ts`), (3) trocar os call sites `supabase.*` pelo SDK, (4) rodar `node scripts/verify-swap.js <dominio>` até 0. O gate é o contador — o MCP recusa `done` enquanto sobrar ocorrência.

**Tech Stack:** Node 24, TypeScript strict, Express + Drizzle (API), React 19 + Vite (web), Postgres 16 na VPS.

## Global Constraints

- **Design é cópia 1:1 (ADR-005/010):** não redesenhe, não toque em `className`, não mude layout. O que muda é só a origem dos dados.
- **Regra de negócio no servidor (invariante):** pagamento, resultado de partida, saldo e classificação são decididos na API, nunca no cliente.
- **Nenhum segredo no bundle:** a chave anon do Supabase em `web/src/lib/supabase.ts` some junto com o arquivo (Task 8).
- **Nenhum arquivo passa de ~400 linhas:** arquivos NOVOS respeitam desde a linha 1. Herdados do fork só recortados dentro do swap.
- **Nunca engula erro:** `catch {}` vazio é proibido. A rota genérica `api/src/routes/rpc.ts` engole erro — é dívida que este plano liquida.
- **`m7academy.pro` é somente leitura.**
- **Evidência é número que cai, não build que passa:** nenhum `app.swap.*` fecha sem `verify-swap <dominio>` → 0.
- **Comit frequente:** 1 commit por swap, com o domínio no título.
- **MCP de governança:** `set_component_status` `doing`/`done` + `log_session` ao fim.

## Estado atual (baseline 2026-08-02, após ADR-016)

```
node scripts/verify-swap.js
FALTA app.swap.identidade     35  (profiles, contas_riot, discord_links, discord_oauth_state)
FALTA app.swap.salas          10  (salas, sala_jogadores)
FALTA app.swap.carteira        7  (wallets, ganhos_plataforma)
FALTA app.swap.conteudo       19  (noticias, highlights, player_stats)
FALTA app.swap.rpc             8  (supabase.rpc)
FALTA app.storage.uploads      8  (supabase.storage)
FALTA app.edge-functions       4  (functions/v1/ + getSession)
FALTA client Supabase           1
FALTA VITE_SUPABASE_*          5
Pendente: 97 ocorrências
OK: app.swap.times, app.swap.campeonatos, app.auth.sessao (0)
```

**Mudança vs. versão anterior do plano:** a ADR-016 normalizou campeonatos e **já converteu as 8 RPCs de campeonato** em endpoints (`registrar_time`, `atualizar_cronograma`, `merge_jogos`, `recalcular_pdl`, `aprovar_time`, `reabrir`). `app.swap.rpc` caiu de 18 → **8**. As 8 restantes: `AdminCargos` (2: listar_admins_com_email, atualizar_cargo_usuario), `wallet` (1: admin_ajustar_saldo), `salamod1` (1: genérica), `Admin` (1), `Lobby` (1: votar_jogo), + 2 não-rastreadas.

**Decisões vigentes:** ADR-010 (fork), ADR-011 (sessão própria), ADR-012 (times), ADR-015 (compose --env-file), ADR-016 (campeonatos normalizados — subsitui a ADR-014).

**Bug em aberto (urgente):** vínculo de conta Riot devolve 401 (`carregar_perfil_completo` RPC sem sessão GoTrue + busca de invocador sem cookie). É o coração da Task 1 — subagente em andamento.

---

## Ordem de execução (paralelizável)

```
1. app.swap.identidade  (35)  ← destrava PerfilContext → cargo/admin/players  [EM ANDAMENTO — bug 401]
2. app.swap.carteira    (7)   ← move saldo p/ servidor
3. app.swap.salas       (10)  ← move regras de sala p/ servidor
4. app.swap.conteudo    (19)  ← notícias/highlights/stats
5. app.swap.rpc         (8)   ← as 8 RPCs restantes viram endpoints nomeados
6. app.storage.uploads  (8)   ← uploads p/ disco local
7. app.edge-functions   (4)   ← pagamento MP + Discord OAuth (bloqueado por credenciais)
8. Limpeza final        (6)   ← apagar lib/supabase.ts + envs + tsc/build
```

**Paralelismo seguro:** carteira (Task 2), salas (Task 3), conteudo (Task 4) e storage (Task 6) são independentes entre si e da identidade — podem rodar em **subagentes paralelos com worktree isolation**. rpc (Task 5) e edge-functions (Task 7) ficam depois (rpc depende de rotas que os outros criam; edge-functions bloqueado por credenciais). Limpeza (Task 8) por último.

Justificativa: identidade primeiro porque o PerfilContext alimenta cargo (admin) e o card de perfil. carteira/salas antes de conteudo porque carregam regra de negócio. rpc depois porque elimina a rota genérica insegura. edge-functions por último por credenciais.

---

## Mapa de arquivos por swap

| Swap | Arquivos front a tocar | Arquivos API/SDK a tocar |
|---|---|---|
| identidade | `api/player.ts`, `Vincular.tsx`, `perfil.tsx`, `TimePage.tsx`, `DiscordCallback.tsx`, `equipes.tsx`, `players.tsx`, `PerfilContext.tsx`, `MinhasPartidas.tsx`, `Tutorial.tsx`, `AdminCargos.tsx` | `routes/profiles.ts` (estender), `api.ts` (namespaces `profiles`, `riot`) |
| carteira | `api/wallet.ts`, `Admin.tsx`, `api/player.ts`, `players.tsx`, `TimePage.tsx` | `routes/wallet.ts` (estender: debitar/incrementar), `api.ts` (namespace `wallet`) |
| salas | `api/salamod1.ts`, `Jogar.tsx`, `useSalaSimples.ts`, `Admin.tsx` | `routes/matches.ts` (estender: confirm/start/result), `api.ts` (namespace `matches`) |
| conteudo | `Admin.tsx`, `api/player.ts`, `Lobby.tsx`, `Streamers.tsx` | `routes/content.ts` (estender CRUD), `api.ts` |
| rpc | `AdminCargos.tsx`, `api/salamod1.ts`, `api/wallet.ts`, `Admin.tsx`, `Lobby.tsx` | `routes/rpc.ts` (substituir por endpoints nomeados), `api.ts` |
| storage | `createCampPage.tsx`, `equipes.tsx`, `TimePage.tsx`, `LayoutWrapper.tsx`, `perfil.tsx` | `routes/upload.ts` (limitar tipo/tamanho), `api.ts` |
| edge-functions | `deposit/DepositModal.tsx`, `vip/VipModal.tsx` | `routes/payments.ts` novas + workers webhook MP |

---

## Tarefas (atualizadas)

### Task 1: `app.swap.identidade` — [EM ANDAMENTO]

**Subagente em andamento** (bug 401 no vínculo Riot: `carregar_perfil_completo` + busca de invocador). O restante da Task segue o mapa original:
- `PerfilContext.tsx:70` (`carregar_perfil_completo`) → montar `carregarPerfil` com `Promise.all` (`/profiles/me`, `/wallet/balance`, `/teams/by-user/:id`) + `roles` do AuthContext. Shape de `PerfilData` igual.
- Cargo: `roles.includes('admin') → 'admin'`, `organizer → 'organizador'`, senão `'jogador'`. `refetchCargo` usa `api.auth.me()`.
- `Vincular.tsx:304` (upsert contas_riot) → `POST /api/profiles/me/riot`. `players.tsx` RPC `buscar_jogadores_filtrados` → `GET /api/players/search`. `AdminCargos.tsx` → `GET /api/admin/users`.
- `api/src/routes/profiles.ts`: adicionar `roles` no `/me`, rota listar jogadores.

**Gate:** `verify-swap.js identidade` → 0; `api tsc` 0; `web tsc` só 2 pré-existentes; smoke: logar → perfil mostra nome/elo/saldo; admin desbloqueia.
**Commit:** `feat(swap.identidade): PerfilContext e perfis na API própria`

### Task 2: `app.swap.carteira` — saldo no servidor
- `api/src/routes/wallet.ts`: `POST /api/wallet/admin/adjust` valida cargo admin, grava `wallet_transactions` (kind `admin_adjustment`, `balance_after`). Nunca o cliente decide delta.
- `api/wallet.ts:140` (`admin_ajustar_saldo`) → `api.wallet.adminAdjust(...)`.
- `players.tsx`/`Admin.tsx` leem `wallets.mc` → `api.wallet.balance(userId)` ou rota admin.
- Desbloqueia: `sec.regras-servidor` (parte saldo).

**Gate:** `verify-swap.js carteira` → 0; tsc; smoke admin ajusta saldo e ledger reflete.
**Commit:** `feat(swap.carteira): saldo e ajuste admin na API`

### Task 3: `app.swap.salas` — salas → matches
- `api/src/routes/matches.ts`: `confirm`/`start`/`reportResult` com débito de `entryMp` na criação, payout no `reportResult` (grava `wallet_transactions`), `pg_notify('matches_channel')`.
- `useSalaSimples.ts:492` (atualiza salas direto) e `salamod1.ts:68` (RPC genérica) → `api.matches.*`.
- `Admin.tsx` conta salas ativas → `GET /api/matches?status=...`.

**Gate:** `verify-swap.js salas` → 0; tsc; smoke criar sala debita, reportar paga prêmio.
**Commit:** `feat(swap.salas): salas/matches com regras no servidor`

### Task 4: `app.swap.conteudo` — notícias, highlights, stats
- `api/src/routes/content.ts`: CRUD autenticado de `highlights`/`noticias` com validação de cargo admin. `GET /api/content/player-stats/:userId`.
- `Admin.tsx:413-662` (insere/atualiza/deleta highlights/noticias no Supabase) → `api.content.*`.
- `api/player.ts:341/375` (`player_stats`) → `api.content.playerStats(userId)`. `Lobby.tsx`/`Streamers.tsx` → `api.content.*`.
- Adapter no SDK para shape legado (Admin usa snake_case `titulo`/`resumo`/`thumbnail_url`).

**Gate:** `verify-swap.js conteudo` → 0; tsc; smoke admin cria notícia e aparece no Lobby.
**Commit:** `feat(swap.conteudo): notícias/highlights/stats na API`

### Task 5: `app.swap.rpc` — 8 RPCs restantes viram endpoints
- **Remover** a rota genérica `api/src/routes/rpc.ts` (superfície de ataque: sem auth + interpolação + engole erro). Substituir por endpoints nomeados:
  - `AdminCargos`: `listar_admins_com_email`, `atualizar_cargo_usuario` → `GET/POST /api/admin/cargos`
  - `wallet`: `admin_ajustar_saldo` → `POST /api/wallet/admin/adjust` (Task 2)
  - `salamod1`: genérica → endpoint de sala (Task 3)
  - `Admin`: (1 RPC)
  - `Lobby`: `votar_jogo` → `POST /api/matches/:id/vote` ou similar
- Mover lógica SQL (votação/arbitragem/PDL) para API com Drizzle. `recalcular_pdl` já existe (Task campeonatos).

**Gate:** `verify-swap.js rpc` → 0; `rg "rpcName" api/src` → 0; tsc; smoke arbitragem/votação.
**Commit:** `feat(swap.rpc): RPCs restantes viram endpoints nomeados com auth`

### Task 6: `app.storage.uploads` — uploads para disco local
- `api/src/routes/upload.ts`: `maxSize` (5 MB), whitelist MIME (png/jpeg/webp), `bucket` obrigatório.
- `api.upload(file, bucket)` → `{ url: "/uploads/<file>" }`. URLs servidas pelo Nginx (já monta `/uploads/`).
- Trocar `getPublicUrl` do storage em `LayoutWrapper.tsx:46`, `perfil.tsx:18`, `createCampPage.tsx:145`, `equipes.tsx:295`, `TimePage.tsx:141` por `/uploads/<arquivo>`.

**Gate:** `verify-swap.js storage` → 0; tsc; smoke upload logo aparece em `/uploads/`.
**Commit:** `feat(swap.storage): uploads no disco local via /api/upload`

### Task 7: `app.edge-functions` — pagamento MP + Discord OAuth (última)
- `api/src/routes/payments.ts`: create-mercado-pago-order, create-vip-order, webhook (validar assinatura, gravar `payments`, creditar `user_wallets.mc` + `wallet_transactions`).
- `DepositModal.tsx:186`/`VipModal.tsx:159` chamam `${supabaseUrl}/functions/v1/create-*-order` → `api.payments.order(...)`. O `getSession` que os alimenta some.
- **Bloqueado por credenciais:** segredos MP/Discord no painel Supabase. Registrar `add_blocker` se sem acesso.

**Gate:** `verify-swap.js` (edge-functions) → 0; tsc; smoke ordem MP devolve `init_point`; blocker de credenciais resolvido.
**Commit:** `feat(edge-functions): pagamento MP e Discord OAuth na API`

### Task 8: Limpeza final — remover o Supabase do bundle
- Apagar `web/src/lib/supabase.ts` SÓ depois dos swaps 1–7 fecharem. `rg -n "supabase" web/src` → 0.
- **URLs antigas de storage** gravadas no banco (`bfsusctegzvfrlehhink.supabase.co/storage/v1/object/public/...`): decidir redirect no Nginx (`/storage/v1/object/public/*` → `/uploads/*`) vs reescrita no banco — decisão com o usuário.
- Remover `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` do `web/.env`.
- Verificação final: `verify-swap.js --strict` → exit 0; `vite build` + `npm run build` exit 0; deploy dev.m7arena.pro.

**Gate:** `verify-swap.js --strict` → 0; `rg supabase web/src` → 0; builds exit 0.
**Commit:** `chore: remove supabase client e envs do bundle`

---

## Verificação final geral

```bash
node scripts/verify-swap.js --strict   # exit 0
cd api && npx tsc --noEmit             # exit 0
cd web && npx tsc --noEmit             # só 2 erros pré-existentes
cd web && npx vite build && cd api && npm run build   # exit 0
# Deploy (ADR-015: sempre --env-file)
cd /root/m7arena && docker compose --env-file /root/m7arena/.env -f infra/docker-compose.yml up -d --build
# Atualizar governança: set_component_status done + log_session
```

## Componentes do MCP que este plano fecha

| Componente | Tarefa |
|---|---|
| `app.swap.identidade` | Task 1 (destrava cargo admin) |
| `app.swap.carteira` | Task 2 |
| `app.swap.salas` | Task 3 |
| `app.swap.conteudo` | Task 4 |
| `app.swap.rpc` | Task 5 (remove rota genérica insegura) |
| `app.storage.uploads` | Task 6 |
| `app.edge-functions` | Task 7 (credenciais) |
| `sec.regras-servidor` | Tasks 2, 3, 5 — revalidar |
| `sec.pix` | Task 7 — revalidar |
| `sec.upload` | Task 6 — revalidar |
| `design.regressao` | Pós Task 8 |
| `mig.*` (Fase 5) | Pós Task 8 (BLK-001 segue) |

## Riscos e bloqueios

- **BLK-001 (aberto):** hashes de senha inalcançáveis pela service key. Usuários com senha sem `passwordHash` (login só por Google). Não bloqueia este plano; revalidar na Fase 5.
- **Bug 401 vínculo Riot (urgente):** Task 1 — subagente em andamento. Corrige o fluxo de vínculo (PerfilContext + Vincular).
- **`app.edge-functions` (Task 7):** credenciais MP/Discord no painel Supabase. Sem acesso → `blocked` com nota.
- **URLs antigas de storage:** resolver na Task 8 (redirect Nginx vs reescrita) — decisão com o usuário.
- **Arquivos gigantes** (CampeonatoDetalhes 5.856): recortar apenas dentro do swap, nunca isolado.
- **Conflito de merge:** subagentes paralelos tocam `web/src/lib/api.ts` e `Admin.tsx`. Usar worktree isolation e resolver conflitos no merge final (edits são aditivos: namespaces e funções).
