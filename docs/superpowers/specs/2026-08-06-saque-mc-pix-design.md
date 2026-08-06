# Spec: Saque de M7 Coins (MC) via PIX

> **Data:** 2026-08-06
> **Estado:** aprovado pelo usuário (brainstorming)
> **Documentos relacionados:** [`../planos/plano-m7coins.md`](../../planos/plano-m7coins.md),
> [`../ARQUITETURA.md`](../../ARQUITETURA.md) §3.6 (ledger),
> [`../PLANO_MIGRACAO.md`](../../PLANO_MIGRACAO.md).

## 1. Objetivo

Permitir que o jogador **saque MC convertidos em reais para sua chave PIX**,
com aprovação manual do admin. O saque é o espelho do depósito (ADR-031): o
DepositModal vira um checkout com duas abas — **Depósito** (padrão, como está
hoje) e **Saque**.

O admin paga a chave PIX **fora do sistema** (transferência manual) e apenas
**marca o pedido como pago** no painel. Ao pagar, o MC — que já foi debitado na
solicitação — é consolidado; ao rejeitar, o MC é devolvido ao jogador.

## 2. Regras de negócio (decididas com o usuário)

| Regra | Valor |
|---|---|
| Conversão | **100 MC = R$1,00** (simétrica ao depósito R$5 = 500 MC) |
| Valor mínimo | **R$20,00** (2.000 MC) |
| Taxa | **Sem taxa** — o jogador recebe o valor cheio |
| Quando debitar | **Na solicitação** — `user_wallets.mc` é debitado na hora (padrão escrow) |
| Chave PIX | Obrigatória; **snapshot** no momento do pedido (troca posterior da chave não afeta pedidos em aberto) |
| Quem decide | Admin/proprietário (`ehAdmin`) — paga (consolida) ou rejeita (devolve) |

Nenhuma taxa de conversão é decidida no cliente: o cliente envia só o `mcAmount`
e o servidor calcula `amountBrl = mcAmount / 100` (inteiro quando `mcAmount` é
múltiplo de 100). A conversão para reais exibida no front é somente visual.

## 3. Modelo de dados

Nova tabela `withdrawals` em `db/schema/economia.ts` (+ migration `0012`):

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK defaultRandom | |
| `userId` | uuid FK → users (cascade) | |
| `mcAmount` | integer notNull | MC debitados na solicitação |
| `amountBrl` | numeric(10,2) notNull | R$ líquidos que o admin paga |
| `pixType` | varchar(50) | snapshot de `user_payout_info` |
| `pixKey` | text | snapshot — chave que será paga |
| `pixName` | text | snapshot — nome do titular |
| `status` | varchar(50) default 'pending' | `pending` → `paid` \| `rejected` |
| `adminId` | uuid FK → users | quem decidiu |
| `decisionId` | uuid | idempotência (padrão revisão de partidas) |
| `createdAt` | timestamp defaultNow | |
| `decidedAt` | timestamp | preenchido na decisão |

Índices: `withdrawals_user_idx` (userId), `withdrawals_status_idx` (status).

### Ledger (`wallet_transactions`)

Novos `kind`s (o comentário do schema da coluna `kind` é atualizado):

- `withdrawal_hold` — na solicitação, `amount = −mcAmount`, `balance_after` novo saldo.
- `withdrawal_refund` — na rejeição, `amount = +mcAmount`, `balance_after` novo saldo.
- (Pago não lança ledger de saldo — o dinheiro já saiu na solicitação; o registro em `withdrawals` é a trilha.)

## 4. Fluxos

### 4.1 Solicitar saque (jogador)

1. Jogador logado abre o checkout → aba **Saque**.
2. Precisa ter `user_payout_info.pixKey` não vazio (cadastra no perfil, já existe).
3. Digita valor em **MC** (mín. 2.000); o cliente exibe ao vivo o equivalente em reais.
4. `POST /api/withdrawals` com `{ mcAmount }`.
5. Servidor, em transação:
   - valida `mcAmount` inteiro ≥ 2.000 e múltiplo de 100 (conversão exata);
   - valida PIX cadastrado (`pixKey` não vazio);
   - valida saldo disponível `user_wallets.mc ≥ mcAmount`;
   - debita `user_wallets.mc`, grava ledger `withdrawal_hold`;
   - insere `withdrawals` com status `pending` e snapshot do PIX.
6. Resposta: pedido criado com status `pending`.

### 4.2 Admin paga (consolida)

1. Painel admin → aba **Saques** → fila dos pendentes (mais antigos primeiro).
2. Admin transfere o valor para a chave PIX **fora do sistema** e clica **Marcar como Pago**.
3. `POST /api/withdrawals/:id/decide` com `{ action: 'paid', decisionId }`.
4. Servidor, em transação:
   - `SELECT ... FOR UPDATE` da linha; recusa se não estiver `pending` (idempotência);
   - valida `decisionId` ainda não usado;
   - atualiza `status='paid'`, `adminId`, `decidedAt`.

### 4.3 Admin rejeita (devolve)

1. `POST /api/withdrawals/:id/decide` com `{ action: 'rejected', decisionId }`.
2. Servidor, em transação:
   - `SELECT ... FOR UPDATE`; recusa se não estiver `pending`;
   - devolve `user_wallets.mc += mcAmount`, grava ledger `withdrawal_refund`;
   - atualiza `status='rejected'`, `adminId`, `decidedAt`.

## 5. API

Novo arquivo `api/src/routes/withdrawals.ts` (padrão `wallet.ts`/`revisao.ts`):

| Rota | Auth | Corpo | Descrição |
|---|---|---|---|
| `POST /api/withdrawals` | jogador | `{ mcAmount }` | cria solicitação (conversão no servidor) |
| `GET /api/withdrawals/mine` | jogador | — | pedidos do próprio usuário (ordem desc por createdAt) |
| `GET /api/withdrawals/admin` | admin | — | fila pending (mais antiga primeiro) + histórico recente |
| `POST /api/withdrawals/:id/decide` | admin | `{ action: 'paid'\|'rejected', decisionId }` | decide, idempotente |

Regras transversais:

- Autenticação pelo cookie `m7_session` (mesmo helper de `wallet.ts`/`profiles.ts`).
- Admin = `ehAdmin` (role `admin` ou `proprietario` em `user_roles`).
- Erros codificados: `saldo_insuficiente`, `pix_nao_cadastrado`, `valor_minimo_nao_atingido` (mín. R$20), `valor_invalido`, `pedido_ja_decidido`, `decision_id_invalido`, `nao_autorizado`, `nao_autenticado`.
- Em `GET /api/withdrawals/admin`, o payload **não** mascara a chave PIX (admin precisa copiar para pagar).
- Em `GET /api/withdrawals/mine`, a chave PIX também vem completa — é a chave do
  próprio usuário; o front mascara na exibição do modal.

## 6. Front

### 6.1 DepositModal → checkout com abas

`web/src/components/modals/deposit/DepositModal.tsx` ganha um toggle **Depósito | Saque** no topo, com **Depósito como aba padrão** ao abrir o modal (o comportamento atual do depósito não muda). O depósito é extraído para um subcomponente para o arquivo não passar de ~400 linhas (invariante 3.6) — recorte, sem mudar visual.

Aba **Saque**:

- Saldo duplo: "5.000 MC = R$50,00" (lê `api.wallet.balance()`).
- Chave PIX cadastrada (nome + chave mascarada). Sem chave → aviso para cadastrar no perfil, sem botão de saque.
- Input em **MC** (mín. 2.000) com conversão ao vivo para reais ao lado.
- Botão **Solicitar Saque** → `api.withdrawals.create(mcAmount)`.
- Lista dos últimos pedidos com `1.000 MC = R$10,00` + badge de status (Pendente/Pago/Rejeitado).

`web/src/lib/api.ts`: novo bloco `withdrawals` com tipos (`ApiWithdrawal`, `ApiWithdrawalCreate`).

### 6.2 Painel admin

Nova aba **Saques** em `web/src/pages/Admin.tsx` (+ card no dashboard com contagem de pendentes, mesmo padrão da `RevisaoPartidas`). A lista sai para `web/src/components/admin/SaquesPix.tsx` (padrão da `RevisaoPartidas.tsx`) para o `Admin.tsx` não estourar ~400 linhas:

- Fila dos pendentes (mais antigos primeiro): jogador (riot id + nome), `X MC = R$Y`, chave PIX + tipo + nome do titular, há quanto tempo.
- Botões: **Marcar como Pago** (consolida) e **Rejeitar** (devolve MC), com `decisionId` gerado no cliente (padrão `gerarUuid` da `RevisaoPartidas`).
- Badge de status e histórico recente abaixo da fila.

## 7. Fora de escopo (YAGNI)

- Pagamento PIX automático (payout via API de banco) — o admin paga manualmente e confirma.
- Notificações por e-mail/Discord.
- Extrato completo no perfil (fica para tarefa própria de extrato).
- Taxa sobre o saque.

## 8. Critérios de aceite

1. Aba Saque abre no checkout com Depósito padrão; Depósito continua funcionando igual.
2. Jogador sem chave PIX vê aviso e não consegue sacar.
3. Jogador com saldo suficiente solicita 1.000 MC → pedido `pending`, saldo cai 1.000, ledger `withdrawal_hold`, exibição "1.000 MC = R$10,00".
4. Solicitação abaixo de R$20 (2.000 MC) é recusada com `valor_minimo_nao_atingido`.
5. Solicitação sem saldo é recusada com `saldo_insuficiente`.
6. Admin vê o pedido na aba Saques com chave PIX completa e marca **Pago** → status `paid`, MC não é devolvido.
7. Dois cliques simultâneos de "Pago" → exatamente 1 decisão (`pedido_ja_decidido` no segundo).
8. Admin **Rejeita** → status `rejected`, MC devolvido, ledger `withdrawal_refund`.
9. `npx tsc --noEmit` sem erro em `api/` e `web/`; `npx drizzle-kit generate` produz migration `0012` e ela aplica num Postgres limpo.
