# Notificações persistentes

[routes.ts](routes.ts) exporta `notificationsRouter`, montado em
`/api/notifications`. O [produtor compartilhado](../../lib/notifications.ts)
exporta `criarNotificacao(tx, ...)`; o chamador fornece banco/transação.
Os produtores atuais de bilhetes estão no motor de [Apostas](../bets/README.md).

| Método e caminho relativo | Contrato |
|---|---|
| `GET /` | Sessão; até 50 próprias notificações recentes, `{ notifications, unreadCount }`. A contagem considera essa janela de 50, não toda a tabela. |
| `POST /:id/read` | Sessão, UUID válido e filtro pelo dono; `{ ok: true }`. |
| `POST /read-all` | Marca todas as notificações do próprio usuário; `{ ok: true }`. |

O router valida identidade por getAuthUser de match-flow. O schema é
`db/schema/conteudo.ts`; payload contém os dados da notificação, sem novo envio
de chat/email. Marcação individual não confirma que uma linha tenha sido alterada.

O [sino frontend](../../../../web/src/features/notifications/README.md) lê e marca
pelo SDK. Não usa WebSocket; [Realtime de Salas](../../realtime/README.md) é outro
protocolo. VerificacaoStatus/VerificacaoContext acompanham o vínculo por ícone Riot,
também distintos das notificações persistentes do sino.

Não há suíte específica de todos esses handlers. Build valida imports; mudanças
no produtor de apostas selecionam seus testes de serviço, com
[isolamento](../../../../README.md#testes-da-api). Não gerar notificações reais
ou iniciar o bootstrap para validar documentação.
