# Partidas e Salas — backend HTTP

## Responsabilidade e entradas

Consolida a fronteira HTTP de salas casuais, apostadas, salas de campeonato e
Time vs Time livre. O [bootstrap](../../index.ts) importa `matchesRouter` de
[routes.ts](routes.ts) e mantém a montagem em `/api/matches`, depois dos
middlewares globais de CORS, JSON, raw e cookies, na mesma posição entre os routers.

[actions-routes.ts](actions-routes.ts) exporta `matchesActionsRouter`, consumido
somente por `routes.ts`. O `matchesRouter.use(matchesActionsRouter)` continua
antes dos sete registros do router principal. São 26 endpoints, sem prefixo novo,
wrapper ou reexport nos caminhos antigos. Os dois arquivos herdados foram movidos
inteiros para preservar os handlers; não houve recorte artificial por tamanho.

Helpers de composição e resolução de sala continuam locais ao router. Nenhum
serviço de `lib/` foi transferido: exclusividade da entrada HTTP não implica
exclusividade de Draft, séries, autenticação, elegibilidade ou economia.

## Endpoints existentes

Caminhos relativos a `/api/matches`, na ordem de registro. Primeiro, o subrouter
de ações:

| Método | Caminho | Operação |
|---|---|---|
| POST | `/:id/draft/ban` | Ban do draft casual, conforme regras do modo. |
| POST | `/:id/draft/pick` | Pick do draft casual. |
| POST | `/:id/sala-campeonato/entrar` | Ocupar a vaga do próprio time. |
| POST | `/:id/sala-campeonato/sair` | Sair da vaga do time. |
| POST | `/:id/sala-campeonato/pronto` | Marcar o time como pronto. |
| POST | `/:id/sala-campeonato/lado` | Escolher lado, conforme fase e permissão. |
| POST | `/:id/sala-campeonato/pick-order` | Escolher ordem de pick. |
| POST | `/:id/sala-campeonato/ban` | Ban do draft de times. |
| POST | `/:id/sala-campeonato/pick` | Pick do draft de times. |
| POST | `/:id/sala-campeonato/resetar` | Admin/proprietário volta ao pronto do mesmo jogo. |
| POST | `/:id/sala-campeonato/resultado` | Admin/proprietário informa vencedor de uma jogada; sala livre apostada é recusada. |
| POST | `/:id/sala-campeonato/live` | Iniciar transmissão com validação do serviço de sala. |
| POST | `/time-vs-time` | Criar sala de times livre, com formato informado. |
| POST | `/:id/leave` | Sair da vaga conforme estado/vínculo e devolver reserva quando cabível. |
| POST | `/:id/remover-jogador` | Remover jogador com autorização e guards existentes. |
| POST | `/:id/confirm` | Confirmar participação e avaliar transições. |
| POST | `/:id/recusar` | Recusar e aplicar transição/reembolso existentes. |
| POST | `/:id/tick` | Avaliar prazos e transições no servidor. |
| POST | `/:id/verificar` | Verificar resultado com permissão e motor existentes. |

Depois, os registros de `routes.ts`:

| Método | Caminho | Operação |
|---|---|---|
| GET | `/` | Lista salas; filtros `status`, `limit` e vista enxuta `view=card`. |
| GET | `/minhas` | Histórico de salas encerradas do usuário autenticado. |
| GET | `/:id` | Detalhe legado, com código redigido conforme acesso. |
| GET | `/:id/mensagens` | Histórico autenticado do chat, `after` opcional e purge de mensagens antigas. |
| POST | `/` | Criar sala casual/apostada; criador não ocupa vaga nem reserva entrada nessa operação. |
| POST | `/:id/join` | Entrar/trocar vaga com senha, elegibilidade, disponibilidade e reserva existentes. |
| DELETE | `/:id` | Admin/proprietário exclui sala, devolvendo reservas pendentes e liberando código. |

`/minhas` permanece antes de `/:id`. A resolução de detalhe/chat/exclusão aceita
número público ou UUID; várias ações consultam diretamente `sala_num`. Não
uniformizar esses identificadores durante reorganizações. A autorização é feita
em cada handler/serviço; não existe novo middleware universal de sessão.

## Fluxos e contratos preservados

1. A vitrine consulta a lista completa ou `view=card`. Card usa contagem de
   jogadores e nome do criador, sem carregar draft, código ou resultado Riot;
   mantém `Cache-Control: private, max-age=5`.
2. Criar valida elegibilidade com aposta zero e grava sala vazia. No join, a
   transação com lock valida estado, senha, elegibilidade e vaga; reserva entrada
   apenas para um novo participante. Troca de vaga mantém o registro existente.
3. Confirmar, recusar, sair e tick reutilizam
   [match-flow](../../lib/match-flow.ts). Estados, deadlines, locks, transações,
   confirmação e vínculo continuam sob autoridade do servidor. Draft depende das
   regras do modo; não presumir draft no site para todos os modos.
4. [serie-sala](../../lib/serie-sala.ts) mantém MD1/MD3/MD5 de 5v5, default MD3
   para criação e comportamento MD1 para salas antigas sem estado. Entre jogos,
   confirmação e placar seguem o serviço existente, com um código para a série.
   [serie-livre](../../lib/serie-livre.ts) cuida da série local de scrim; não
   substituir pelo motor de Campeonato.
5. [verificar-partida](../../lib/verificar-partida.ts) decide resultado,
   continuação da série, encerramento ou cancelamento e efeitos econômicos.
   Resultado manual de Campeonato usa
   [serie-campeonato](../../lib/serie-campeonato.ts); os guards de admin e a
   recusa de resultado manual em sala livre apostada continuam no handler.
6. `notifyMatchChange` continua emitindo a notificação PostgreSQL existente.
   [Realtime](../../realtime/index.ts) é serviço separado: sessão, assinatura,
   eventos `match_update`, chat e preview de draft não foram movidos. Histórico
   HTTP de mensagens não substitui o transporte WebSocket.

As respostas mantêm o shape legado, campos snake_case, códigos HTTP e mensagens.
Ações usam em geral `{ ok, erro, estado, mudou }`, com os campos extras de cada
operação; leituras/criação/exclusão têm seus contratos próprios. Não padronizar
erros ou respostas ao mover arquivos. O detalhe conserva a redação de código
para visitante/estranho e as exceções autorizadas de participantes/staff/times.

## Serviços e fronteiras compartilhadas

| Dependência preservada | Consumidores e limite |
|---|---|
| [match-flow](../../lib/match-flow.ts) | Transições, identidade e notificação também usados por cron, Apostas, Administração, Carteira e outros routers; não é serviço exclusivo deste módulo. |
| [match-shape](../../lib/match-shape.ts) | Conversão legado/card e resumo Riot; usado pelo fluxo e por testes de shape. |
| [acesso-sala](../../lib/acesso-sala.ts), [sessão](../../lib/session.ts) | Acesso/identidade compartilhados; acesso-sala também atende Upload e sala de campeonato. |
| [draft](../../lib/draft/) | Regras, modos e motor usados por match-flow, shapes, séries/salas e cron. |
| [sala-campeonato](../../lib/sala-campeonato.ts), [draft de campeonato](../../lib/sala-campeonato-draft.ts) | Integram Partidas, Campeonato, Times, Streams, bootstrap e cron; também atendem scrim livre. |
| [serie-campeonato](../../lib/serie-campeonato.ts) | Códigos, séries e resultados compartilhados com [Campeonatos](../tournaments/README.md), cron e serviços de sala. |
| [serie-sala](../../lib/serie-sala.ts), [serie-livre](../../lib/serie-livre.ts), [verificar-partida](../../lib/verificar-partida.ts) | Fluxo, draft, verificação e cron têm consumidores cruzados; permanecem em `lib/`. |
| [Elegibilidade](../../lib/elegibilidade.ts) | Conta, vínculo Riot, termos, punições, saldo e bloqueios, compartilhados com Apostas, Administração e cron. |
| [Escrow](../../lib/escrow.ts) | Reserva, devolução, prêmio e cancelamento; ledger/transações/idempotência permanecem intactos. Apostas individuais têm motor próprio em [bets](../bets/README.md). |
| [Conexão](../../db.ts), [schemas](../../../../db/schema/) | Identidade/carteira, matches, times, campeonato e economia continuam externos, sem schema ou migration alterado. |

O módulo importa serviços compartilhados, sem transferir sua responsabilidade.
Reserva no join, reembolso na saída/cancelamento/exclusão e pagamento ao fim da
série mantêm a ordem e a transação existentes. Não testar finanças com dados reais.

## Frontend e SDK

[web/src/lib/api.ts](../../../../web/src/lib/api.ts) mantém `ApiMatchesSdk`,
`ApiLegacySala`, `ApiSalaResultado` e `api.matches`: list/listCards, minhas,
detail, create, join, leave, removerJogador, confirm, recusar, tick, draftBan,
draftPick, excluir, verificar e mensagens. O prefixo HTTP e os payloads não mudam.
`start` consta na interface legada, mas não tem implementação nesse objeto nem
endpoint registrado nos routers atuais; esta movimentação não acrescenta essa ação.

Consumidores incluem [Salas](../../../../web/src/features/salas/README.md),
[api/salamod1](../../../../web/src/api/salamod1.ts),
[useSalaSimples](../../../../web/src/hooks/useSalaSimples.ts),
[useSalaRealtime](../../../../web/src/hooks/useSalaRealtime.ts) e
[SalaCampeonato](../../../../web/src/features/sala-campeonato/SalaCampeonato.tsx).
As chamadas específicas de sala de campeonato/scrim preservam os mesmos caminhos;
não é necessário alterar o SDK ou o frontend para esta mudança de pasta.

## Testes disponíveis e limites

Em `api/`, sem instalar dependências, com PGlite em memória e conexões auxiliares
apontadas para uma porta de loopback sem serviço:

```powershell
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:9/m7arena_test'
$env:RIOT_API_KEY=''
.\node_modules\.bin\tsx.cmd --test --test-reporter=spec --test-concurrency=1 test/draft-rules.test.ts test/draft.test.ts test/estados.test.ts test/match-card.test.ts test/sala-campeonato-draft.test.ts test/sala-campeonato-schema.test.ts test/sala-campeonato.test.ts test/serie-5v5.test.ts test/serie-campeonato.test.ts test/smoke-serie-5v5.test.ts test/verificar-endpoint.test.ts test/verificar-partida.test.ts test/elegibilidade.test.ts test/escrow.test.ts test/escrow-timeout.test.ts
npm.cmd run build
```

O [helper](../../../test/helpers.ts) reconstrói PGlite com migrations locais.
Os 15 arquivos direcionados cobrem estados/escrow, elegibilidade, card, draft por
modo/Fearless, sala de campeonato/scrim, séries e motor de resultado. As buscas
Riot são simuladas/injetadas. `verificar-endpoint` e os smokes chamam funções de
serviço e espelham a lógica HTTP; não exercitam todos os handlers pelo Express.
Avisos de `pg_notify` recusado em `127.0.0.1:9` são esperados neste isolamento.
Esse conjunto é um catálogo de cobertura; selecione o fluxo afetado, sem executar
todos os arquivos por uma edição de README ou movimentação de imports.

Comparar os arquivos movidos com a fonte anterior, admitindo somente os caminhos
de import, verifica handlers/ordem/contratos; build verifica resolução TypeScript.
Essas evidências não homologam concorrência PostgreSQL, Riot real, WebSocket ou
fluxos autenticados no navegador. Nenhuma operação real é necessária neste lote.

Na raiz, use os [testes do Graph RAG](../../../../tools/graph-rag/README.md#testes-permanentes),
`node tools/graph-rag/cli.mjs build`, `status`, `query "Partidas Salas backend HTTP"`,
`context "file:api/src/modules/matches/routes.ts"` e
`context "file:api/src/modules/matches/actions-routes.ts"`. Confirme também
bootstrap, serviços e consumidores com grafo/busca direta; o grafo não modela
rotas HTTP, SDK ou WebSocket. Navegação geral no [índice](../../../../docs/modules/INDEX.md).
