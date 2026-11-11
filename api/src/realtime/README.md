# Realtime — transporte de salas

## Responsabilidade e consumidores

[index.ts](index.ts) inicia um processo HTTP/WebSocket separado da API, com porta
interna padrão 3001. O proxy publica `/ws`. Não importe esse entrypoint como
helper de teste: ele cria servidor, conexões e timers no escopo do módulo.

O serviço usa `pg` diretamente: pool para consultas e um `pg.Client` dedicado a
`LISTEN matches_channel`. A conexão LISTEN precisa chegar ao PostgreSQL, sem o
PgBouncer em transaction mode. Não importa o router de Partidas nem decide seu
Draft, resultado, escrow ou autorização HTTP.

[useSalaRealtime](../../../web/src/hooks/useSalaRealtime.ts) é o consumidor
frontend comum a [SalaMod1](../../../web/src/features/salas/README.md) e
[SalaCampeonato](../../../web/src/features/sala-campeonato/README.md).
O produtor HTTP de notificações é `notifyMatchChange` em
[match-flow](../lib/match-flow.ts); cron e serviços de sala também o consomem.

## Protocolo atual

| Sentido | Mensagem | Contrato |
|---|---|---|
| Cliente → servidor | `subscribe_match` | `matchId` aceita número público ou UUID; valida existência e associa o socket à sala. Nova assinatura substitui a anterior. |
| Servidor → cliente | `subscribed` | Confirma a sala com `matchId` numérico. |
| Servidor → cliente | `match_update` | Invalidação: normalmente leva `matchId`; após reconectar LISTEN pode vir sem id. O cliente refaz o GET autenticado da sala. |
| Cliente → servidor | `chat_send` | `body` passa por assinatura, sessão, conta, Riot ID e rate limit antes do INSERT. |
| Servidor → cliente | `chat_message` | `matchId` e `msg` com id, usuário, nome, avatar, corpo, cor e timestamp. |
| Servidor → cliente | `chat_error` | Campo `error`; não é uma resposta HTTP de Partidas. |
| Cliente/servidor | `draft_preview` | Campeão/lado efêmeros, sem persistência; exige sessão para publicar e não substitui a ação HTTP de ban/pick. |
| Servidor → cliente | `error` | Erros de JSON/assinatura e referência de sala. |

O socket transporta conteúdo de chat e prévia; somente `match_update` leva uma
invalidação sem o documento da partida. Não assumir, com base no comentário
antigo do topo do código, que todo WebSocket leva apenas o id.

## Identidade, limites e reconexão

O upgrade verifica `Origin` e resolve `m7_session`. Sem sessão válida, o socket
vira visitante: pode assinar e receber eventos, mas não publicar chat/prévia.
O serviço aplica limites globais/por IP para visitantes e por usuário autenticado.
O chat exige `users.riot_id`, recusa conta banida, aceita de 1 a 200 caracteres,
limita um envio por segundo e 40 em cinco minutos. A cor fica congelada na mensagem.

Prévia tem throttle de 150 ms; heartbeat usa ping/pong. O listener reconecta com
backoff e avisa os sockets para reler estado quando recupera o PostgreSQL.
O hook frontend refaz a assinatura, usa debounce com jitter para invalidações e
limpa a conexão ao desmontar/desabilitar.

No hook atual, `onStatusChange(true)` ocorre no `open` e `onReconnect` depois do
envio de assinatura, sem aguardar o ACK `subscribed`. Esses callbacks não provam
que o servidor já aceitou a sala. Preservar ou mudar essa semântica exige conferir
os dois consumidores, sem confundir estado de transporte com autorização.

## Verificação e limites

Não há suíte de integração dedicada a este processo/handshake/NOTIFY na árvore
atual. Os testes backend de sala/série/Draft exercitam serviços com PGlite; não
validam PostgreSQL LISTEN, limites de socket, protocolo ou reconexão em rede.
Os testes DOM bloqueiam WebSocket real. Build/lint também não homologam o serviço.

Uma alteração neste contrato precisa de verificação isolada do serviço e dos
consumidores frontend. Consulte o [README do projeto](../../../README.md) para
ambiente e limites; não use produção ou contas reais como teste de transporte.
