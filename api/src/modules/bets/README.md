# Apostas — backend

## Responsabilidade e entradas

Módulo de apostas individuais sobre a próxima partida ranqueada do próprio
jogador (Solo/Flex), com odds fixas da plataforma. O histórico HTTP também
agrega salas apostadas, lendo seus registros; não controla o escrow dessas salas.

| Arquivo | Responsabilidade / consumidores |
|---|---|
| [routes.ts](routes.ts) | Exporta `betsRouter`; o [bootstrap](../../index.ts) monta em `/api/bets`, após CORS, parsers e cookies globais. |
| [bets.ts](bets.ts) | Catálogo, validação de legs, shapes e reserva/devolução/pagamento/lançamento específicos dos bilhetes. Consumido pelo router, motor e testes de Apostas. |
| [live-bets.ts](live-bets.ts) | Detecção Riot, liquidação, timeout/anulação e `runBetsCron`. Consumido pelo router, [cron global](../../cron.ts) e testes. |

Os três arquivos foram movidos com mudanças somente nos caminhos de imports.
`live-bets.ts` é um arquivo herdado extenso; não foi dividido
nem teve funções financeiras reescritas para forçar uma nova organização.
Não existem wrappers de compatibilidade nos caminhos anteriores.

## Contratos HTTP

Ordem de registro, relativa a `/api/bets`:

| Método | Caminho | Contrato atual |
|---|---|---|
| GET | `/catalog` | Público; mercados agrupados, odd vigente, limites e filas. |
| GET | `/me` | Sessão obrigatória; bilhetes do usuário, mais recentes primeiro. |
| GET | `/me/active` | Sessão obrigatória; comportamento atual procura primeiro um bilhete `aguardando`; retorna `null` se ausente, mesmo havendo `em_jogo`. Se houver aguardando, prefere um em jogo. |
| GET | `/:id` restrito a UUID | Sessão e propriedade; detalhe com legs. A expressão UUID evita capturar `/history`. |
| POST | `/` | Sessão; recebe `{ queue, legs: [{ marketKey, stake }] }`, valida e reserva em transação; retorna o bilhete com status 201. |
| POST | `/:id/sync` | Sessão e propriedade; chama detecção/liquidação e relê o bilhete. Encerrados retornam diretamente `{ ok, status, ticket }`. |
| GET | `/history` | Sessão; agrega bilhetes individuais e salas apostadas, com `deltaMc` e ordenação por criação. |

São sete registros, com a mesma ordem e os mesmos handlers. Não há DELETE para
cancelamento pelo jogador. Preserve respostas, erros e a restrição UUID.
Comentários antigos não substituem o comportamento dos handlers atuais.

## Criação, reserva e liquidação

1. `getAuthUser` em [match-flow](../../lib/match-flow.ts) lê cookie `m7_session`
   ou Bearer, consulta sessão não expirada e resolve o usuário. O catálogo é público;
   as demais rotas checam sessão, e detalhe/sync verificam o dono do bilhete.
2. O POST valida fila e chama `validarElegibilidade(db, user.id, 0)`. Esse zero
   preserva o caminho atual de elegibilidade: conta ativa/Riot ID; não significa
   que todas as regras adicionais de salas apostadas sejam aplicadas aqui.
3. `validarBilhete` resolve mercados, conflitos, stake inteiro/mínimo e teto de
   payout. `jogadorEmJogo` aplica a checagem atual de partida ranqueada em andamento.
4. A transação verifica outro bilhete aguardando e carteira com locks, cria ticket
   e legs com snapshot da odd/payout e chama `reservarStake` por leg. A reserva move
   `mc` para `mc_reservado` e grava ledger; não alterar a ordem nem os erros.
5. `detectarPartida` usa espectador/histórico Riot para localizar a próxima partida;
   `liquidarPartida` resolve legs e paga, retém ou devolve. Timeout/anulação e
   notificações usam as transações existentes. `runBetsCron` continua chamado pelo
   cron global; o sync HTTP reutiliza o mesmo motor.

O modelo individual é contra a plataforma. [Escrow de salas](../../lib/escrow.ts)
é entre participantes e permanece externo. O histórico apenas consulta essas
salas e seu ledger; não mover sua economia junto com este módulo.

## Fronteiras compartilhadas preservadas

- [Elegibilidade](../../lib/elegibilidade.ts): regras/punições também usadas por
  Salas, Administração, cron e testes próprios; permanece fora do módulo.
- [match-flow](../../lib/match-flow.ts), [sessão](../../lib/session.ts) e
  [conexão](../../db.ts): autenticação, fluxo de salas e infraestrutura comuns.
- [Proxy Riot](../../routes/riot.ts) e [notificações](../../lib/notifications.ts):
  serviços usados por outros domínios. Apostas consome suas interfaces existentes.
- [Schema de bilhetes](../../../../db/schema/bets.ts),
  [identidade/carteira](../../../../db/schema/identidade.ts),
  [ledger](../../../../db/schema/economia.ts) e [salas](../../../../db/schema/matches.ts)
  continuam em `db/schema/`, sem alteração de tabelas ou migrations.
- [SDK frontend](../../../../web/src/lib/api.ts) e
  [README frontend](../../../../web/src/features/apostas/README.md): contratos HTTP
  compartilhados, sem mudança da interface, odds ou cálculos nesta consolidação.

## Testes e navegação

Sem instalar dependências, em `api/`, usando PGlite em memória e sem chave Riot:

```powershell
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:9/m7arena_test'
$env:RIOT_API_KEY=''
.\node_modules\.bin\tsx.cmd --test --test-concurrency=1 test/bets.test.ts test/elegibilidade.test.ts test/cron.test.ts
npm.cmd run build
```

[bets.test.ts](../../../test/bets.test.ts) cobre catálogo/validação, reserva,
ledger, detecção e liquidação com dados simulados; os testes de
[elegibilidade](../../../test/elegibilidade.test.ts) e [cron](../../../test/cron.test.ts)
cobrem consumidores compartilhados. O [helper](../../../test/helpers.ts) reconstrói
um banco PGlite isolado. Avisos de `pg_notify` recusado no loopback e chave Riot
ausente podem ocorrer nesse ambiente; não apontar conexões auxiliares para produção.
Esses testes não homologam todos os handlers HTTP, Riot real ou concorrência em
PostgreSQL de produção. Não realizar transações financeiras reais para validar.
Selecione os testes conforme a lógica alterada. Edição documental não exige
executá-los; movimentação sem mudança de corpo usa comparação de imports e build.

Na raiz, reconstrua o grafo com `node tools/graph-rag/cli.mjs build` e consulte
`query "criação de Apostas Individuais"`, `context "betsRouter"`,
`context "reservarStake"` e `context "runBetsCron"` usando a mesma CLI.
Confira também [docs/modules/INDEX.md](../../../../docs/modules/INDEX.md).
