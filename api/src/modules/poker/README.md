# Sala M7 (poker) — essência EA

## Fronteira HTTP

O [bootstrap](../../index.ts) monta o router em `/api/poker`. Autenticação pelo
helper compartilhado [getAuthUser](../../lib/content.ts) (cookie `m7_session` ou
Bearer).

| Arquivo / prefixo | Método e caminho relativo | Contrato |
|---|---|---|
| [routes.ts](routes.ts), `/api/poker` | `GET /rooms` | Público, identidade opcional. `{ rooms }`: mesa da casa `m7` e mesas abertas públicas; privadas aparecem somente para o dono. |
| [routes.ts](routes.ts) | `POST /rooms` | Autenticado. `{ name, sb, bb, seats, isPrivate, password?, valendoEssencia }`; devolve `{ ok, room }`. |
| [routes.ts](routes.ts) | `POST /buyin` | Autenticado. `{ roomId, buyIn, password? }`; debita EA quando aplicável e abre sessão. Devolve `{ ok, sessionId, ea }`. |
| [routes.ts](routes.ts) | `POST /cashout` | Autenticado. `{ sessionId, stack }`; credita EA e fecha a sessão. Devolve `{ ok, ea, payout }`. |

## Regras e invariantes

- **EA é moeda de jogo separada de MC**: nenhuma função daqui toca `mc` ou
  `mc_reservado`; EA não é sacável, não entra em reserva de sala apostada e não
  participa de Pix. O ledger usa `currency = 'ea'` e os kinds `poker_buyin`
  (amount negativo) e `poker_cashout` (amount positivo), sempre com
  `balance_after` e `ref_id` da sessão.
- Há uma única mesa da casa: `m7`, buy-in exato 2000, blinds 10/20 e 6 lugares.
  Não há tiers, classificação ou raridade. A rodada determina as apostas.
- Mesas criadas têm nome após trim de 3..40 caracteres, lugares inteiros 2..6
  e pares de blinds 5/10, 10/20, 25/50 ou 50/100. Blinds fora desses pares
  retornam 400 `blinds_invalidos`. `valendoEssencia` e `isPrivate` são booleanos
  obrigatórios. O servidor calcula `buyIn = 100 * bb` se valendo essência, ou
  zero para treino; campo extra `buyIn` na criação não determina o valor.
- Privada exige senha de 4..32 caracteres, armazenada com bcrypt. A senha é
  exigida de qualquer jogador no buy-in, inclusive do dono; erro = 400
  `senha_invalida`. Nenhuma resposta expõe `passwordHash`.
- Cada sala retornada tem `{ id, name, sb, bb, buyIn, seats, seated, isPrivate,
  ownerName }`. A casa tem `ownerName: "M7"`; `seated` conta sessões abertas
  por `roomId`, não bots. Mesas do banco são ordenadas por criação decrescente.
- Buy-in aceita `m7` ou uma mesa persistida aberta, com valor exato da mesa.
  Mesa inexistente/fechada = 400 `mesa_invalida`; valor divergente = 400
  `valor_invalido`; saldo EA insuficiente = 400 `saldo_insuficiente`.
  Criação inválida retorna 400 `{ ok: false, erro, error }` sem inserir mesa.
- Treino abre sessão com buy-in zero, sem débito ou ledger. Cashout de treino
  fecha com payout zero, sem crédito ou ledger: fichas de treino não viram EA.
  Criação e entrada são silenciosas, sem notificação, banner ou e-mail.
- As duas operações rodam em transação com lock da carteira
  (`SELECT ... FOR UPDATE`). Sessão de outro jogador ou inexistente = 404
  `sessao_nao_encontrada`; cashout repetido na mesma sessão = 400
  `sessao_encerrada`, sem creditar de novo. `stack` é inteiro 0..2000000.
- O grant inicial de 2.000 EA é SQL da migration incremental (kind
  `poker_grant`, currency `ea`, `ref_id = 'grant_inicial_2000_ea'`), idempotente
  pelo índice único parcial `idx_ledger_poker_grant_unico`. Não há notificação,
  banner ou e-mail.

## Limitação conhecida (não é furo silencioso)

A mesa roda no cliente contra bots (`web/src/features/salas/poker/domain`), então o `stack`
do cashout é **informado pelo cliente** — o servidor não reexecuta as mãos.
Como EA não é sacável e nunca vira MC, a exposição é de saldo/saldo de jogo
fictício: não há conversão financeira nem Pix nesse caminho.

## Consumidores e verificação

SDK `api.poker` em [web/src/lib/api.ts](../../../../web/src/lib/api.ts) e as
telas de `web/src/features/salas/poker`. Persistência em `db/schema/poker.ts`
(`poker_rooms` e `poker_sessions`) e `db/schema/identidade.ts` (`user_wallets.ea`); saldo exposto
por `GET /api/wallet/balance` ([Economia](../economy/README.md)).

Verificação: [poker-rooms.test.ts](../../../test/poker-rooms.test.ts) (HTTP real,
visibilidade, validações, senha, valor calculado, treino e ocupação) e
[poker-essencia.test.ts](../../../test/poker-essencia.test.ts) em
[ambiente isolado](../../../../README.md#testes-da-api) (grant idempotente,
buy-in, cashout e recusas). PGlite não homologa concorrência real de PostgreSQL
nem as telas.
