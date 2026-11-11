# Notificações — sino do usuário

[NotificationBell](components/NotificationBell.tsx) é montado no
[LayoutWrapper](../../components/layout/LayoutWrapper.tsx). Consulta notificações
persistentes de apostas pelo SDK `notifications`; o
[backend](../../../../api/src/modules/notifications/README.md) filtra pelo usuário.

O clique para abrir consulta a lista; fechar não faz nova consulta. O componente
mantém itens/não lidas/loading, permite marcar uma ou todas como lidas, fecha por
clique externo e reproduz som quando a resposta contém não lidas. Abertura não
marca tudo automaticamente. Não há polling ou assinatura WebSocket nesse sino.

Depende de AuthContext, `useSound` e `lib/notification-sound.ts`. Não confundir
com `VerificacaoStatus`/VerificacaoContext (verificação de jogos) nem com
[Realtime](../../../../api/src/realtime/README.md) de sala/chat/Draft.

Não há suíte DOM específica. Para paths, lint/build; para comportamento, simule
SDK/usuário e verifique carga, leitura e listeners sem gerar notificações reais.
Atualização de payload requer conferir o produtor de Apostas e o router backend.
