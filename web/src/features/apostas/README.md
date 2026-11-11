# Apostas individuais — apresentação

Componentes exclusivos da interface de desafios individuais. A coordenação
fica em [ApostaIndividualPage](pages/ApostaIndividualPage.tsx), carregada
pelo [App](../../App.tsx) na rota privada `/aposta-individual`, com `PrivateRoute`
e `RouteWithSuspense` preservados.

- [ItemMercado](components/ItemMercado.tsx): mercado, odd formatada, seleção e
  estimativa de retorno; recebe `market`, `odd`, `selecionado`, `stake` e `onClick`.
- [SummonerCard](components/SummonerCard.tsx): dados do jogador, saldo recebido,
  fila e totais. Usa o helper compartilhado de ícone Riot e emite o evento
  `m7:open-deposit` para o fluxo global de depósito.
- [FilaSelector](components/FilaSelector.tsx): opções de fila e callback `onSelect`.
  Exporta o tipo `FilaConfig`, consumido pela página, com identidade e dados visuais
  de cada opção. As imagens de fundo são fornecidas nas props.
- [BilheteAtivoView](components/BilheteAtivoView.tsx): status, metas e valores
  recebidos no bilhete; callback `onSync` e estado `syncing` vêm da página.
- [ModalResultadoAposta](components/ModalResultadoAposta.tsx): exibe bilhete
  finalizado e `deltaMc` recebidos; fecha via callback e navega ao histórico.

Os quatro primeiros têm export nomeado e default; o modal exporta default.
Tipos de mercado, fila, catálogo e bilhete vêm do [SDK compartilhado](../../lib/api.ts).
O [HistoricoApostas](components/HistoricoApostas.tsx) é usado no Perfil e consulta
o histórico pelo SDK; fica no domínio de desafios, apesar desse consumidor externo.
Nenhum destes componentes executa chamada de aposta ou altera saldo/persistência.
Estimativas e formatação existentes são apresentação; o servidor valida os
valores e liquida resultados.

A página mantém `PerfilContext`, chamadas `api.bets`, polling, seleção, confirmação,
toasts e resultado. Saldo exibido vem do perfil, e carteira/depósito continuam
compartilhados. Não mover essas responsabilidades ou alterar regras financeiras
durante ajustes de interface. Preserve props, callbacks, DOM, classes, Motion,
formatos de odds/valores e condições de loading/modais.

Na página, catálogo/bilhete são carregados juntos. Uma referência acompanha o
bilhete ativo; o polling de 20 segundos consulta mudanças e procura o resultado
no histórico, com cleanup do intervalo e deduplicação de notificações por ID.
Fila, seleções, stake, loading, sincronização, confirmação e resultado continuam
estados locais. Mantenha dependências dos efeitos e refs ao editar esses fluxos.

Validação existente, em `web/`: `npm run lint` e `npm run build`.
Não há teste frontend específico de Apostas nesta consolidação. Comparação SSR
e callbacks com fixtures não homologam layout, animações e interação real;
essa validação em navegador permanece pendente, sem transações financeiras reais.

## Backend e contratos compartilhados

O [módulo backend de Apostas](../../../../api/src/modules/bets/README.md) reúne
[router](../../../../api/src/modules/bets/routes.ts),
[validação/reserva/shapes](../../../../api/src/modules/bets/bets.ts) e
[detecção/liquidação](../../../../api/src/modules/bets/live-bets.ts).
O mount continua `/api/bets`; as chamadas de `api.bets` e seus payloads permanecem
iguais. `GET /history` também agrega salas apostadas, cuja economia é externa.
Elegibilidade, autenticação, proxy Riot, notificações e schemas de carteira/ledger
continuam compartilhados; veja as fronteiras e testes no README backend.
