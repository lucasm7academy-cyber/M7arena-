# Economia — carteira, compra de moeda e saques

## Fronteira HTTP

O [bootstrap](../../index.ts) monta três routers em seus prefixos públicos
existentes. Economia é consumida por Perfil, cabeçalho, Administração, Desafios
e Salas; não pertence exclusivamente a uma dessas páginas.

| Arquivo / prefixo | Método e caminho relativo | Contrato |
|---|---|---|
| [wallet-routes.ts](wallet-routes.ts), `/api/wallet` | `GET /balance` | Próprio saldo mc/mcReservado e salas ativas que retêm reserva. |
| Carteira | `GET /admin/balances` | Admin/proprietario; userIds opcional, até 500 ids. |
| Carteira | `POST /admin/adjust-mc` | Somente proprietario; userId/deltaMC/motivo, recusa saldo final negativo e lança ledger. |
| [payments-routes.ts](payments-routes.ts), `/api/payments` | `GET /packages` | Catálogo público de pacotes ativos. |
| Pagamentos | `POST /mc/order` | Autenticado; packageId. Preço e crédito vêm do pacote no servidor; retorna paymentId/orderId/QR. |
| Pagamentos | `POST /webhook` | Callback Mercado Pago; assinatura, consulta ao gateway e processamento idempotente no serviço. |
| Pagamentos | `GET /:orderId/status` | Próprio pagamento; parâmetro é o paymentId interno retornado na criação. |
| [withdrawals-routes.ts](withdrawals-routes.ts), `/api/withdrawals` | `POST /` | Autenticado; mcAmount, snapshot Pix, débito/reserva do saque em transação. |
| Saques | `GET /mine` | Próprios pedidos, até 50 recentes. |
| Saques | `GET /admin` | Autorização pelo helper getAdminUser; fila/histórico, até 100, incluindo Pix completo. |
| Saques | `POST /:id/decide` | Administração; action paid/rejected e decisionId UUID; decisão transacional. |

## Serviços e invariantes existentes

- [pagamentos.ts](../../lib/pagamentos.ts) decide webhook;
  [mercado-pago.ts](../../lib/mercado-pago.ts) integra gateway e crédito.
  Pedido local é inserido antes de criar Pix externo; a confirmação idempotente
  registra crédito e ledger. Não confiar em preço/crédito ou status do cliente.
- [withdrawals.ts](../../lib/withdrawals.ts): 100 MC = R$1, mínimo 2000 MC,
  valor inteiro e múltiplo de 100, chave Pix cadastrada e lock de carteira.
  `withdrawal_hold` debita na solicitação; paid consolida e rejected devolve com
  `withdrawal_refund`. Não há transferência bancária automática nessa decisão.
- [escrow.ts](../../lib/escrow.ts) é o motor de reservas/pagamentos de Salas;
  [Apostas](../bets/README.md) mantém o motor dos bilhetes individuais. Ambos usam
  carteira/ledger e conservam regras próprias; não são o processamento de Pix.
- Ajuste administrativo ainda executa as escritas sequenciais do handler/helper
  atual; não presumir atomicidade global ou acrescentar transação nesta organização.
- Autenticação continua nos helpers existentes: wallet tem helper local,
  payments usa match-flow, saques usa match-flow/content. Schemas permanecem em
  `db/schema/identidade.ts` e `economia.ts`. Pix privado é mantido por Perfis.

## Consumidores e verificação proporcional

[Interface de economia](../../../../web/src/features/economy/README.md), SDK
`wallet`, `payments` e `withdrawals`, PerfilContext e painel administrativo.
Os termos visuais E/Essência Azul e nomes mc no contrato coexistem; não renomear
campos numa mudança de pastas. Respostas `error`/`erro` variam entre endpoints.

Documentação pede conferência de fontes/links; imports pedem build. Alterações
funcionais selecionam `api/test/payments.test.ts`, `webhook.test.ts`,
`withdrawals.test.ts` ou `escrow.test.ts`, conforme o motor, em
[ambiente isolado](../../../../README.md#testes-da-api). Eles não homologam Pix
real nem todos os handlers. Não criar cobrança, saque ou ajuste real para testar.
