# Plano: Aposta Individual (self-bet) em partidas ranqueadas Solo/Flex

> **Para agentes:** este é o plano próprio do recurso de aposta individual. Ele
> **não cria do zero** — reaproveita o vínculo Riot (PUUID), a carteira MC
> (`user_wallets.mc`/`mc_reservado`), o ledger e a verificação server-side que
> as salas apostadas já usam. Este documento consolida o modelo, o fluxo de
> dinheiro (plataforma como **casa**, odds fixas), as garantias anti-fraude e o
> que ainda falta fechar. Criado em 2026-08-31.
>
> **Documentos relacionados:** [`../ARQUITETURA.md`](../ARQUITETURA.md) §3.6
> (ledger), [`../PLANO_MIGRACAO.md`](../PLANO_MIGRACAO.md) §5 (mapeamento),
> [`plano-m7coins.md`](plano-m7coins.md) (moeda MC e escrow),
> [`../../design_salas_apostadas_v3.md`](../../design_salas_apostadas_v3.md)
> (design das salas apostadas — escrow, taxa, revisão).

---

## 1. Resposta direta às perguntas que deram origem a este plano

| Pergunta | Resposta |
|---|---|
| O jogador aposta sobre QUAL jogo? | **A própria próxima partida ranqueada** (Solo Duo = queue 420, Flex = queue 440). A aposta é sempre sobre o jogo FUTURO, nunca sobre um já rolando. |
| Quem paga quando acerta? | **A plataforma (casa)** — odds fixas. Acertou → paga `stake × odd`; errou → retém o stake. Não é escrow entre jogadores (diferente das salas). |
| Como o sistema sabe quando o jogo começa? | **Espectador da Riot** (`/lol/spectator/v4/active-games/by-summoner/:id`). O cron varre bilhetes `aguardando` e trava `em_jogo` quando detecta a partida na fila certa. |
| Como garante que NÃO é jogo já rolando? | **Duas camadas**: (1) na criação do bilhete, rejeita se o jogador já está em partida ranqueada (`ja_em_jogo_ranqueada`); (2) na detecção, só aceita partida cujo `gameStartTime` é posterior à aposta (tolerância 2 min de relógio). |
| Como liquida o resultado? | **match-v5** (`/lol/match/v5/matches/:matchId`) — lê win/loss, kills e first blood do jogador (por PUUID) e resolve cada mercado. |
| O jogador vê o histórico? | **Sim** — `GET /api/bets/history` agrega apostas individuais + salas apostadas, com o delta de MC real do ledger. |

**O que este plano adiciona:** documentação consolidada (este arquivo), o mapa
de lacunas (seção 6) e os critérios de aceite (seção 8). O fluxo principal já
está implementado, testado e **deployado na VPS** (dev.m7arena.pro).

---

## 2. Onde vive a aposta individual no projeto

| Camada | Arquivo | Papel |
|---|---|---|
| Schema | `db/schema/bets.ts` | `bet_tickets` (bilhete por partida futura) + `bet_legs` (mercado individual com stake/odd/payout) |
| Migration | `db/migrations/0022_bet_individual.sql` | Cria `bet_tickets`/`bet_legs` + FKs + índices |
| Regra | `api/src/lib/bets.ts` | Catálogo de mercados, `validarBilhete` (mín. 100 MC, teto 5000), escrow (`reservarStake`, `devolverStake`, `pagarLeg`, `perderLeg`), `shapeTicket` |
| Regra | `api/src/lib/live-bets.ts` | `detectarPartida` (espectador), `liquidarPartida` (match-v5), `jogadorEmJogo` (anti-fraude), `runBetsCron` |
| Regra | `api/src/routes/bets.ts` | `catalog`, `me`, `me/active`, `create`, `sync`, `cancel`, `history` |
| Regra | `api/src/cron.ts` | Varredura de bets a cada 10 min (detecção + liquidação) |
| Front | `web/src/pages/ApostaIndividualPage.tsx` | Página de aposta (top bar + coluna jogador + coluna mercados), em `/aposta-individual` |
| Front | `web/src/components/partidas/ItemMercado.tsx` | Item de mercado (cartão arredondado) |
| Front | `web/src/components/perfil/HistoricoApostas.tsx` | Histórico de MC ganho/perdido no perfil |
| Front | `web/src/lib/api.ts` | SDK `api.bets.*` |
| Layout | `web/src/components/layout/LayoutWrapper.tsx` | `/aposta-individual` é `isGamePage` (tela cheia + sidebar/hamburger) |

---

## 3. Modelo de dados (resumo)

### `bet_tickets` — um bilhete = uma partida ranqueada futura

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid FK → users | Dono do bilhete (o jogador que aposta em si mesmo) |
| `queue` | varchar | `'solo'` (420) \| `'flex'` (440) |
| `status` | varchar | `aguardando` → `em_jogo` → `finalizada`/`cancelada`/`anulada` |
| `stake_total` | int | Soma dos stakes das legs |
| `resultado` | varchar | `ganha` \| `perdida` \| `anulada` |
| `summoner_id` | varchar | encryptedSummonerId (preenchido ao entrar em jogo) |
| `match_riot_id` | varchar | `BR1_<gameId>` (preenchido ao detectar) |
| `queue_id` | int | 420 \| 440 |
| `game_start_at` | timestamp | Início da partida detectada |
| `expires_at` | timestamp | Deadline de detecção (20 min) — passo disso sem jogo → cancela e devolve |
| `created_at`/`updated_at`/`ended_at` | timestamp | Controle |

### `bet_legs` — um mercado dentro do bilhete (independente)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `ticket_id` | uuid FK → bet_tickets | Bilhete pai |
| `market_key` | varchar | Chave canônica do mercado (ex.: `result_vitoria`, `kills_over_10`) |
| `odd` | numeric(6,3) | Snapshot da odd no momento da aposta |
| `stake` | int | Valor apostado nessa leg |
| `payout` | int | Payout esperado = `floor(stake × odd)` |
| `status` | varchar | `aberta` → `ganha`/`perdida`/`anulada` |

---

## 4. Catálogo de mercados (BET_MARKETS em `lib/bets.ts`)

| Grupo | Mercado | Key | Odd |
|---|---|---|---|
| Resultado | Vitória | `result_vitoria` | 1.35 |
| Resultado | Derrota | `result_derrota` | 2.60 |
| Abates | Matar mais de 7/8/9/10/12/13 | `kills_over_N` | 1.35 / 1.28 / 1.22 / 1.18 / 1.12 / 1.08 |
| Abates | Matar até 6/8/10/12 | `kills_under_N` | 1.60 / 1.40 / 1.25 / 1.15 |
| First Blood | Sim | `first_blood_sim` | 1.20 |
| First Blood | Não | `first_blood_nao` | 1.20 |

**Limites:** mínimo **100 MC** por mercado (`BET_MIN_STAKE`); teto de **5.000 MC** de payout por bilhete (`BET_MAX_PAYOUT`, risco da casa).

---

## 5. Fluxo de dinheiro (plataforma como casa)

1. **Criar bilhete** (`POST /api/bets`) — valida elegibilidade (conta ativa, Riot ID, termos) e o conjunto de legs; reserva o stake (`mc → mc_reservado`, ledger `bet_entry_reserve`). Rejeita se já está em partida ranqueada (`ja_em_jogo_ranqueada`).
2. **Detectar** (`runBetsCron` / `/sync`) — espectador encontra a partida na fila certa, que começou **depois** da aposta → `em_jogo`, grava `match_riot_id`/`queue_id`/`game_start_at`.
3. **Cancelar por timeout** (20 min sem jogo) — devolve o stake (ledger `bet_refund`), bilhete `cancelada`/`resultado=anulada`.
4. **Liquidar** (`runBetsCron`) — match-v5 resolve cada leg:
   - `ganha` → `pagarLeg` credita `payout` (ledger `bet_prize`) e libera a reserva.
   - `perdida` → `perderLeg` libera a reserva sem creditar (ledger `bet_loss`).
   - `anulada` (não dá para saber) → devolve o stake.
5. **Resultado do bilhete** — `ganha` se alguma leg ganhou, `perdida` se só perdeu, `anulada` se todas anuladas.

**Invariante:** `mc + mc_reservado = total` preservado em todo o ciclo (mesmo mecanismo das salas apostadas). A odd fica no **snapshot** da leg — mudar a config não altera bilhetes já feitos.

---

## 6. Garantias anti-fraude (não é jogo já rolando)

1. **Criação bloqueada em jogo ativo** — `jogadorEmJogo` consulta o espectador na hora de criar; se o jogador já está em partida ranqueada, recusa com `ja_em_jogo_ranqueada`. Só aposta **fora de jogo, antes de entrar na fila**.
2. **Só conta o próximo jogo** — na detecção, `gameStartTime` precisa ser **posterior** ao `createdAt` do bilhete (tolerância de 2 min para skew de relógio). Partida que começou antes é ignorada.
3. **Nunca paga às cegas** — sem chave Riot ou sem dados, o sistema não liquida; cai no timeout honesto (cancela e devolve).

---

## 7. Lacunas e tarefas de fechamento

| # | Lacuna | Impacto | Status |
|---|---|---|---|
| 1 | **Chave Riot permanente** — a `RGAPI-d8a76e0f-...` é vitalícia e já está na VPS; BLK-006 (expira em 24h) está superado. | Nenhum (já resolvido) | ✅ Fechado |
| 2 | **PUUIDs de contas de outra região** — alguns `external_id` legados no banco não resolvem no `summoner by-puuid` (400 "decrypting"); contas verificadas têm PUUID válido. | Baixo (afeta contas antigas) | Em aberto — reconciliar handles já existe (`runReconciliacaoHandles`) |
| 3 | **Escopo do espectador** — o endpoint pode devolver 403 em algumas contas (restrição da Riot); no caso normal (jogador em partida ranqueada) retorna 200. | Baixo | Monitorar |
| 4 | **Limites em `app_config`** — hoje `BET_MIN_STAKE`/`BET_MAX_PAYOUT` são constantes fixas no código, não config. | Baixo | Em aberto |
| 5 | **Extra: mercados mais avançados** — "Full Metas" (parlay combinando vitória + kills + first blood) e outros mercados podem ser adicionados ao catálogo sem mudar o motor. | Baixo | Backlog |

---

## 8. Critérios de aceite (fluxo de aposta individual)

1. Apostar exige login + conta Riot vinculada + termos aceitos.
2. Apostar enquanto já está em partida ranqueada → `ja_em_jogo_ranqueada` (recusa).
3. Mínimo 100 MC/mercado; soma dos payouts ≤ 5000 MC.
4. Criar bilhete: `mc -= stake`, `mc_reservado += stake`, ledger `bet_entry_reserve`.
5. Detectar jogo na fila certa que começou **depois** da aposta → `em_jogo` + `match_riot_id`.
6. Timeout 20 min sem jogo → cancela, devolve stake, ledger `bet_refund`.
7. Acertou mercado → credita `payout` (ledger `bet_prize`); errou → retém (ledger `bet_loss`); não dá para saber → devolve (anulada).
8. Invariante `mc + mc_reservado = total` preservado em todo o ciclo.
9. Histórico (`/api/bets/history`) mostra cada bilhete/sala com o delta de MC real.
10. Testes: `api/test/bets.test.ts` cobre validação, escrow, detecção e liquidação (23 testes).
