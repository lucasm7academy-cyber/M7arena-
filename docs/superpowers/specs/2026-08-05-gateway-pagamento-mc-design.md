# Design: Gateway de pagamento de MC (Mercado Pago PIX) — 100% na VPS

> Data: 2026-08-05 · ADR-031 · Componente: `app.payments`
> Substitui a edge function `create-mercado-pago-order` do Supabase (BLK-003).
> **Sem Supabase**: pedido, webhook e crédito de MC rodam na API própria.

## 1. Problema

A compra de M7 Coins (MC) está 100% bloqueada. O `DepositModal` chama a edge
function `create-mercado-pago-order` do Supabase via `supabase.auth.getSession()`,
que pós ADR-011 é sempre nula — o pagamento nunca chega ao Mercado Pago (BLK-003).

Além disso, a tabela de preço atual é arbitrária e está hardcoded no cliente
(R$2→110, R$10→550, R$20→1.187, R$50→3.100, R$100→6.547 MC), violando o
invariante 3.3 (nenhuma regra de negócio no cliente).

## 2. Decisões (fechadas com o usuário)

| Tema | Decisão |
|---|---|
| Hospedagem | 100% VPS/API própria. Zero Supabase. |
| Gateway | Mercado Pago, Checkout Transparente, **PIX only** (sem fallback Checkout Pro). |
| Tabela de preço | `mc_packages` no banco é a fonte da verdade. Cliente só envia `packageId`. |
| Base | R$1 = 100 MC. |
| Bônus | A partir de R$50: +6 MC por real (R$50→+300, R$100→+600, R$200→+1.200). |
| Selo "Mais Escolhido" | R$50 (primeiro pacote com bônus). |
| Webhook | Valida `x-signature` (HMAC SHA-256, secret do MP) **e** confirma o status na API do MP (`GET /v1/payments/{id}`) antes de creditar. |
| Crédito | Idempotente: transação com `FOR UPDATE`, já `approved` sai com 200. |
| Front | `DepositModal` renderiza os pacotes da API, mesmos classNames (paridade visual 1:1). |

## 3. Modelo de dados (migration 0010)

### 3.1 Tabela nova `mc_packages`

| campo | tipo | nota |
|---|---|---|
| id | uuid pk defaultRandom | |
| price_brl | numeric(10,2) notNull | único por pacote |
| base_mc | integer notNull | MC base (100 × reais) |
| bonus_mc | integer notNull default 0 | bônus promocional |
| is_popular | boolean notNull default false | selo "Mais Escolhido" |
| active | boolean notNull default true | controla visibilidade |
| sort_order | integer notNull default 0 | ordem de exibição |
| created_at | timestamp defaultNow notNull | |

Seed (6 pacotes, `sort_order` 1..6):

| price_brl | base_mc | bonus_mc | total | is_popular |
|---|---|---|---|---|
| 5.00 | 500 | 0 | 500 | false |
| 10.00 | 1.000 | 0 | 1.000 | false |
| 20.00 | 2.000 | 0 | 2.000 | false |
| 50.00 | 5.000 | 300 | 5.300 | **true** |
| 100.00 | 10.000 | 600 | 10.600 | false |
| 200.00 | 20.000 | 1.200 | 21.200 | false |

### 3.2 Coluna nova em `payments`

`mc_credit integer notNull default 0` — total de MC (base + bônus) que aquele
pagamento credita. O webhook usa este valor para creditar `user_wallets.mc` e
gravar o ledger `wallet_transactions` (kind `deposit`).

## 4. API — `api/src/routes/payments.ts` (novo)

Montada em `app.use("/api/payments", paymentsRouter)`.

| Rota | Auth | Corpo | Resposta |
|---|---|---|---|
| `GET /api/payments/packages` | público | — | lista de pacotes ativos ordenados por `sort_order`: `{ id, priceBrl, baseMc, bonusMc, totalMc, isPopular }` |
| `POST /api/payments/mc/order` | cookie m7_session | `{ packageId }` | `{ orderId, method: 'pix', qrCode, brCode, paymentId }` |
| `POST /api/payments/webhook` | público (MP) | notificação MP | `{ success }` ou 401 |
| `GET /api/payments/:orderId/status` | cookie m7_session | — | `{ status, orderId }` |

### 4.1 `POST /api/payments/mc/order`

1. Autentica pela sessão (`m7_session`), resolve o `userId`.
2. Valida `packageId` contra `mc_packages` (existente + `active`). **Nunca** usa
   valor/MC enviados pelo cliente.
3. Monta o payload PIX no MP (`POST https://api.mercadopago.com/v1/payments`):
   - `transaction_amount = price_brl`
   - `description = "M7 Arena - <totalMc> MCs"`
   - `payment_method_id = "pix"`
   - `payer.email` — em modo `TEST-` usa email de teste; em produção usa
     `user-<userId8>@m7arena.pro`
   - `external_reference` = id do registro em `payments` (gerado antes do MP)
   - `notification_url` = `MERCADO_PAGO_NOTIFICATION_URL` (env)
   - header `X-Idempotency-Key` = `userId_Date.now()` (como o site antigo)
4. Insere `payments`: `gateway='mercadopago'`, `gatewayRef` = id do pagamento do
   MP, `product='mc_pack_<packageId>'`, `amountBrl=price_brl`,
   `mc_credit=totalMc`, `status='pending'`.
5. Devolve `orderId` (id MP), `qrCode` (`qr_code_base64`), `brCode`
   (`qr_code`), `paymentId` (uuid nosso).
6. Erros do MP → 502 com mensagem; sem segredos no corpo.

### 4.2 `POST /api/payments/webhook`

1. Lê `type` e `data.id` da query string. `type !== 'payment'` → 200 e sai.
2. Valida `x-signature` (ts + v1, HMAC-SHA256 sobre
   `id:<dataId>;request-id:<x-request-id>;ts:<ts>;`, secret do MP). Inválida →
   401. Em modo `TEST-` pula a assinatura (igual site antigo).
3. **Não confia no payload**: chama `GET /v1/payments/{dataId}` no MP com o
   access token. Se status `!== 'approved'` → 200 (nada a fazer ainda).
4. Acha o `payments` por `gatewayRef = dataId`. Não achou → 404 (MP reenvia).
5. Transação com `SELECT ... FOR UPDATE` no `payments`:
   - Já `approved` → commit e 200 (idempotente).
   - Senão: upsert `user_wallets.mc += mc_credit`, insere
     `wallet_transactions` (currency `mc`, amount `+mc_credit`, kind `deposit`,
     refType `payment`, refId = id do pagamento, `balanceAfter` = novo saldo),
     marca `payments.status='approved'`, `paidAt = now`.
6. Toda falha inesperada → 500 (MP reenvia o webhook, idempotência protege).

### 4.3 `GET /api/payments/:orderId/status`

Autenticado. `:orderId` é o **uuid nosso** (`paymentId`, retornado no
`POST /api/payments/mc/order`) — não o id do MP. Lê `payments` por `id` do dono
da sessão. Devolve o status do banco. Não chama o MP — o webhook é o que move o
status; o botão "Já paguei" só relê. (O id do MP fica em `gatewayRef`, usado
só para casar o webhook.)

## 5. Front — `DepositModal.tsx`

- Remove o array `PACKAGES` hardcoded e o import/uso de `supabase`.
- Busca os pacotes em `api.payments.packages()` no mount.
- Seleção de pacote → POST `api.payments.createMcOrder({ packageId })` →
  `setPaymentData({ orderId, qrCode, brCode })`.
- `checkPayment` → `api.payments.status(orderId)`; se `approved`, toast + fecha.
- Renderização mantém **todos os classNames atuais** (paridade visual 1:1,
  ADR-005). A grade, o resumo e a tela de QR ficam idênticos — só a fonte de
  dados muda. O `bonusPct` deixa de ser calculado com a referência antiga e
  passa a usar `baseMc/bonusMc` vindos do servidor.
- Badge "Mais Escolhido" quando `isPopular`.
- Cliente **nunca** decide valor: envia só `packageId`.

## 6. Configuração (env)

`api/.env`:

```
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-4743852098543095-041512-fcc3790257259c7b4cf0d927f97e5af2-3157267389
MERCADO_PAGO_WEBHOOK_SECRET=82941e20a61499d1684b83779a117254f011fda03f4cf52b793880ec7cca8dc7
MERCADO_PAGO_NOTIFICATION_URL=https://dev.m7arena.pro/api/payments/webhook
```

- `MERCADO_PAGO_ACCESS_TOKEN` detecta modo teste pelo prefixo `TEST-`.
- Nenhum destes valores pode aparecer no bundle do front.

## 7. Painel do Mercado Pago (ação do usuário)

Trocar a "URL de produção" do webhook de
`https://pgspcoclplcifigbtval.supabase.co/functions/v1/mercado-pago-webhook`
para **`https://dev.m7arena.pro/api/payments/webhook`**. (O `notification_url`
por pedido já aponta para a VPS, então mesmo antes de trocar no painel o fluxo
funciona — a troca evita duplicidade de notificação.)

## 8. Erros e validações

- `packageId` inválido/inativo → 400 `pacote_invalido`.
- Não autenticado → 401.
- MP indisponível → 502 `mercadopago_indisponivel` (sem segredo).
- Webhook com assinatura inválida → 401.
- Webhook para pagamento inexistente → 404.
- Status duplicado → idempotente (200).

## 9. Testes (evidência de done)

1. `npx drizzle-kit generate` → migration `0010_*.sql` com `mc_packages` (6
   seeds) + `payments.mc_credit`. Aplica em Postgres limpo e no PGlite dos
   testes (`setupDb` já varre `db/migrations`).
2. `npx tsc --noEmit` na API e no web → exit 0.
3. Teste unitário novo `api/test/payments.test.ts` (PGlite + migrations):
   - `GET /packages` devolve os 6 pacotes, popular = R$50.
   - criar pedido grava `payments` com `mc_credit` = base+bonus.
   - webhook credita `user_wallets.mc` + ledger `deposit` com `balanceAfter`
     correto.
   - webhook repetido não credita duas vezes.
   - assinatura inválida → 401 (teste de função pura de validação).
4. Build do Vite passa (`npm run build` em `web/`).

## 10. Fora de escopo

- VIP (`create-vip-order`) continua pendente.
- PIX payout/saque (`sec.pix`) continua pendente.
- Extrato de transações no front (lacuna 2 do plano-m7coins).
