# Plano: Sistema de moedas M7COINS (MC) e M7 Points (MP)

> **Para agentes:** este é o plano próprio do sistema de moedas. Ele **não cria do
> zero** — o MC já existe e já é moeda global no app. Este documento consolida o
> estado atual, o modelo de dados, o fluxo de dinheiro nas salas apostadas e as
> lacunas que ainda faltam fechar. Atualizado em 2026-08-04.
>
> **Documentos relacionados:** [`../ARQUITETURA.md`](../ARQUITETURA.md) §3.6
> (ledger), [`../PLANO_MIGRACAO.md`](../PLANO_MIGRACAO.md) §5 (mapeamento),
> [`../../design_salas_apostadas_v3.md`](../../design_salas_apostadas_v3.md)
> (design completo das salas apostadas — escrow, taxa, revisão).

---

## 1. Resposta direta às perguntas que deram origem a este plano

| Pergunta | Resposta |
|---|---|
| O sistema de pontos MC já existe? | **Sim.** Schema, ledger, escrow, revisão e API de carteira estão implementados e testados. |
| MC já é moeda global no app? | **Sim.** `user_wallets.mc` é global por usuário; o `mc_reservado` segura o escrow das salas apostadas. Não existe "MC por sala" — a sala referencia a aposta e o saldo é da carteira global. |
| Quando o admin declara o vencedor, o repasse com taxa da plataforma acontece? | **Sim.** `POST /api/revisao/:id/decidir` com `winnerSide: 'blue'|'red'` → `pagarPremio` (pote − taxa 8,99% congelada na criação). |
| Empate fica sem taxa e devolve o saldo total? | **Sim.** `winnerSide: 'draw'` → `pagarEmpate` devolve o reservado de todos, **sem taxa**, sala → `encerrada` com `resultado='draw'`. |
| Cancelamento? | **Sim.** `winnerSide: 'cancel'` → `pagarCancelamento` devolve tudo, sala → `cancelada`. |

**O que este plano adiciona:** documentação consolidada (este arquivo), o mapa
de lacunas e as tarefas de fechamento que ainda existem (seção 6). Nada do fluxo
principal de MC precisa ser redesenhado — ele já segue o ADR-019 e o
`design_salas_apostadas_v3.md`.

---

## 2. Onde vive o MC no projeto

| Camada | Arquivo | Papel |
|---|---|---|
| Schema | `db/schema/identidade.ts:84` | `user_wallets` (`mp`, `mc`, `mc_reservado`) — carteira global |
| Schema | `db/schema/economia.ts` | `wallet_transactions` (ledger append-only), `payments`, `platform_revenue`, `referral_events` |
| Schema | `db/schema/matches.ts:57` | `matches.aposta_mc` (0 = casual) e `taxa_pct` (congelada na criação) |
| Regra | `api/src/lib/escrow.ts` | `reservarEntrada`, `devolverEntrada`, `calcularPayout`, `pagarPremio`, `pagarEmpate`, `pagarCancelamento` |
| Regra | `api/src/routes/revisao.ts` | Admin decide `blue/red/draw/cancel`; roda em transação com `FOR UPDATE` + `decision_id` (idempotência) |
| Regra | `api/src/lib/match-flow.ts` | `ESTADOS_ATIVOS`, `entrarEmRevisao`, notify |
| Regra | `api/src/routes/matches.ts` | criação (clamp aposta/taxa/max, MORPH-002), join reserva escrow |
| Regra | `api/src/routes/matches-actions.ts` | `report-result` → apostada vai para revisão; casual encerra |
| Regra | `api/src/routes/wallet.ts` | `/balance` (mc + mcReservado + emPartida), `/deposit`, `/admin/balances`, `/admin/adjust` |
| Front | `web/src/contexts/PerfilContext.tsx:115` | `api.wallet.balance()` no `carregarPerfil` |
| Front | `web/src/components/perfil/CarteiraEStrikes.tsx` | exibe "X MC disponível + Y MC em partida" com link para a sala |

---

## 3. Modelo de dados (resumo)

```
user_wallets (1 por usuário)
  mc            → saldo livre (pode entrar em vaga)
  mc_reservado  → escrow travado em salas apostadas ativas
  mp            → M7 Points (moeda de pontos, ranking — sem fluxo de aposta)
  INVARIANTE: mc nunca negativo; mc + mc_reservado = total

matches
  aposta_mc     → 0 = casual; > 0 = apostada
  taxa_pct      → congelada na criação (default 8.99)

wallet_transactions (ledger, append-only, balance_after)
  kinds: match_entry_reserve | match_entry_refund | match_prize | match_loss |
         deposit | payout | vip_purchase | referral_bonus | admin_adjustment

platform_revenue (por partida)
  mc_fee         → taxa ceil(pote * taxa_pct / 100)
  mc_fee_rounding → resto de arredondamento (premio floor)
```

### 3.1 Política de arredondamento (MC é inteiro — design v3 §4.1)

```
pote         = aposta_mc × nº jogadores pagantes
taxa         = ceil(pote × taxa_pct / 100)
premio_liq   = pote − taxa
por_vencedor = floor(premio_liq / nº vencedores)
resto        = premio_liq − (por_vencedor × nº vencedores)  → vai para platform_revenue
```

A soma de todos os lançamentos fecha exatamente com o pote — a invariante nunca
quebra por 1 MC. (Implementado e coberto por teste em `api/test/escrow.test.ts`.)

### 3.2 Empate e cancelamento

`pagarEmpate` / `pagarCancelamento` chamam `devolverEntrada` para cada jogador:
`mc_reservado -= aposta; mc += aposta`, **sem taxa**, sem linha em
`platform_revenue`. Diferença só no estado final da sala (`encerrada`+draw vs
`cancelada`).

---

## 4. Fluxo do dinheiro numa sala apostada (fim a fim)

```
criar sala (aposta_mc > 0) ── taxa_pct congelada no INSERT
  → entrar na vaga  → reservarEntrada  (mc -= aposta; mc_reservado += aposta)
  → sair antes de iniciar → devolverEntrada (inverte, idempotente)
  → confirmação venceu / kick ociosidade → devolverEntrada só dos removidos
  → partida inicia → dinheiro trava
  → partida_iniciada há 3h sem print (cron) → aguardando_revisao
  → qualquer jogador envia print → aguardando_revisao
  → ADMIN decide:
       blue/red → pagarPremio (taxa + resto → platform_revenue; vencedores +porVencedor;
                   perdedores zera reservado sem devolver)
       draw     → pagarEmpate (devolve tudo, sem taxa)
       cancel   → pagarCancelamento (devolve tudo)
  → em TODOS os casos: match_players.linked = false (liberar para nova sala)
```

**Segurança (já implementada):**
- Decisão do admin roda em transação com `SELECT ... FOR UPDATE` e verifica o
  status dentro da transação → dois cliques só pagam uma vez.
- `UNIQUE (match_id, user_id, tipo)` no ledger para `match_prize`/`match_loss`/
  `match_entry_refund` → segunda tentativa estoura constraint e faz rollback.
- `decision_id` (uuid gerado no front) → retry idempotente de API.
- Clamps no servidor (MORPH-002): `apostaMc` 0..1M, `taxaPct` 0..100,
  `maxJogadores` 2..10 + allowlist de modo + guarda no `calcularPayout`.
- CORS com allowlist fixa (MORPH-003). Senha validada no servidor (MORPH-001).

---

## 5. MP (M7 Points) — o que é hoje

- **Existe:** `user_wallets.mp` (global) + exibido no ranking (`players.tsx`) e
  no ajuste admin (`/admin/adjust` com `deltaMP`).
- **Não tem fluxo de movimentação automática no novo schema.** No site antigo
  MP era moeda de pontos de campeonatos. No port, `entry_mp` virou alias do
  valor da aposta (`matches.ts:111` — `apostaMc ?? entryMp`), mas quem domina o
  escrow é `aposta_mc`. O `mp` permanece como moeda de exibição/ranking, com
  movimentação apenas via ajuste admin.
- **Decisão em aberto:** se o MP volta a ganhar fluxo (ex.: recompensa de
  campeonato, vitória em casual), registre como ADR. Fora do escopo das salas
  apostadas.

---

## 6. Lacunas e tarefas de fechamento

| # | Lacuna | Impacto | Status |
|---|---|---|---|
| 1 | **Depósito real (BLK-003)** — `DepositModal` existe, mas criar ordem de pagamento exige migrar as edge functions do Supabase (`create-mercado-pago-order`, `create-vip-order`) para a API própria. Sem isso MC só entra por `admin_adjust`. | Crítico para o produto (usuário não compra MC) | Bloqueado por `app.edge-functions` + credenciais Mercado Pago/Discord |
| 2 | **Extrato/transações no front** — `wallet_transactions` existe no banco, mas não há tela de extrato no app (só a carteira com reservado). | Médio (transparência) | Em aberto |
| 3 | **`app_config` (limites operacionais)** — o design v3 §5 prevê `app_config` com `aposta_min_mc`, `aposta_max_mc`, `taxa_pct_default`, `strikes_para_suspensao`, etc. Hoje os limites são clamps fixos no código (MORPH-002), não config. | Baixo (clamps já protegem) | Em aberto |
| 4 | **PIX payout (`sec.pix`)** — `user_payout_info` existe (PIX cadastrado), mas o fluxo de sacar MC → PIX não existe e depende de `app.edge-functions`. | Médio | Bloqueado por `app.edge-functions` |
| 5 | **`vip_purchase`** — compra de VIP com MC (`wallet_transactions.kind` prevê) depende das edge functions. | Médio | Bloqueado por `app.edge-functions` |
| 6 | **Punições/strikes** — `user_strikes` + suspensão temporária existem; falta config de limite (3 strikes / 30 dias / 48h) que viria de `app_config`. | Baixo | Parcial |

---

## 7. Caminho de implementação sugerido (ordem)

1. **`app.edge-functions`** — migrar as 6 edge functions (requer segredos do
   painel do Supabase; BLK-003). Destrava depósito real, VIP e PIX.
2. **`sec.pix`** — fluxo de saque PIX sobre a API própria.
3. **Extrato no front** — tela/histórico lendo `wallet_transactions` (nova rota
   `GET /api/wallet/transactions`).
4. **`app_config`** — tabela de configuração + leitura nos clamps/cron.
5. Revisão de **MP** (definir fluxo, se houver) como ADR.

Nada disso muda o motor das salas apostadas, que já está fechado e no ar.

---

## 8. Critérios de aceite (fluxo de MC como um todo)

1. Comprar MC (depósito) credita `user_wallets.mc` + ledger `deposit` — atômico.
2. Entrar em sala apostada: `mc -= aposta`, `mc_reservado += aposta`, ledger `match_entry_reserve`.
3. Sair antes de iniciar: devolve, ledger `match_entry_refund`, idempotente.
4. Admin aprova vencedor: vencedores recebem `porVencedor`, perdedores perdem a reserva, taxa + resto em `platform_revenue`, ledger `match_prize`/`match_loss`.
5. Empate: todos reembolsados, sem taxa, `platform_revenue` sem linha, sala `encerrada`/draw.
6. Cancelamento: todos reembolsados, sala `cancelada`.
7. Invariante: `mc + mc_reservado` constante em todo o ciclo (testado automaticamente).
8. Arredondamento: pote 1000, 3 vencedores, 8,99% → soma prize+loss+taxa+resto = pote.
9. Dois cliques simultâneos do admin → exatamente 1 payout.
