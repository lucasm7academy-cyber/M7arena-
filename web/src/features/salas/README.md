# Salas — vitrine, participação, histórico e chat

O módulo contém a vitrine [Jogar](pages/Jogar.tsx), rota pública `/jogar`,
o histórico [MinhasPartidas](pages/MinhasPartidas.tsx), rota privada `/partidas`,
a composição [SalaMod1](pages/SalaMod1.tsx) para `/5v5/:id`, `/aram/:id`, `/1v1/:id`
e a Sala M7 de poker em [poker/pages](poker/pages/PokerLobby.tsx) para
`/sala-m7` e `/sala-m7/:roomId`. As páginas têm export default e import lazy no
[App](../../App.tsx) com suspense; somente o histórico usa `PrivateRoute`.
Não é a consolidação completa de Salas.

## Sala M7 — poker e entradas extras

[ExtraGamesAccordion](components/ExtraGamesAccordion.tsx) apresenta Sala M7 e
Treino de Mira abaixo das partidas finalizadas em `/jogar`. Só um item abre por
vez; botões nativos têm `aria-expanded`/`aria-controls`, foco visível e expansão
de 240ms (sem animação com redução de movimento). O componente não interfere
em polling, cache, refs, observer ou query `view=finalizadas`.

- [PokerLobby](poker/pages/PokerLobby.tsx) lista a única mesa da casa `m7` e
  mesas de jogadores retornadas por `api.poker.rooms()`. Cada item mostra nome,
  blinds SB/BB, ocupação, dono, pública/privada e entrada em EA ou treino grátis.
  Não existem níveis, tiers ou tags de mesa. Falha na API mantém somente a mesa
  oficial com aviso discreto e botão de atualizar. Mesas privadas só aparecem
  para o dono, conforme filtro do servidor.
- [RoomCard](poker/components/RoomCard.tsx) adapta a leitura HTTP para o modelo
  de apresentação do motor. Cards seguem bordas/recortes da vitrine: verde para
  essência, azul para treino e roxo para privada, sem classificação por valor.
- [PokerRoomModal](poker/components/PokerRoomModal.tsx) cria mesa pelo SDK HTTP
  genérico (`api.post('/poker/rooms', body)`): nome, blinds 5/10, 10/20, 25/50 ou
  50/100, 2–6 lugares, pública/privada com senha e `valendoEssencia`. O cliente
  apenas informa o toggle; o servidor calcula entrada de 100 BB ou zero. Inputs
  usam o mesmo vidro/borda da vitrine. O modal controla foco, Escape e retorno
  de foco; falha de criação mantém os campos e exibe aviso.
- Mesa privada usa `ModalSenhaSala` compartilhado. A senha segue no estado da
  navegação para `usePokerRoom(room, password)` e `api.poker.buyIn`; não entra em
  query string nem armazenamento local. O servidor valida a senha.
- [PokerTable](poker/pages/PokerTable.tsx) resolve a mesa pela lista HTTP, recebe
  `room.buyIn` e cobre o layout público com portal em tela cheia. Buy-in/cashout
  continuam em [usePokerRoom](poker/hooks/usePokerRoom.ts), com confirmação de
  saída, tratamento de erro e proteção de sessão já existentes. Mesa grátis
  recebe 100 BB de fichas locais para viabilizar as mãos, sem débito de EA;
  a API decide o resgate permitido. O motor de poker não mudou.
- A mesa mantém pote central, blinds no topo, aposta/pagar no HUD flutuante,
  feltro verde com ribalta dourada discreta, avatar com anel e stack em pill,
  dealer button dourado e verso com brasão M7. [PokerDealer](poker/components/PokerDealer.tsx)
  preserva Twisted Fate e os quatro estados `idle/deal/showdown/result`.
  Fundo preto, halos ciano/rosa e vidro dão continuidade às entradas neon.
- Loja de cosméticos fica recolhida em uma seção secundária “em breve”; nenhuma
  compra é simulada e os botões permanecem desabilitados.

Contratos de saldo, reserva e ranking pertencem ao servidor. A rodada de poker
continua local contra bots; criar uma sala não implementa multiplayer humano.
Verificações desta camada: `npm run lint` e `npm run build` em `web`.
Canvas, toque, aparência responsiva, imagens remotas do crupiê e integração real
de criação/senha/caixa precisam de homologação em navegador; build não os comprova.

Jogar lista salas por `api.matches.listCards` e carrega finalizadas por
`api.matches.list` quando a seção entra na área observada. Cache em memória
pinta a vitrine imediatamente, mas sempre há revalidação. Polling de 15 segundos
pausa em aba oculta, revalida no foco/visibilidade com piso de cinco segundos e
evita requests sobrepostos. Preserve assinatura/cache, refs e cleanup de
intervalo, listeners, observer e scroll por query `view=finalizadas`.

Criação e entrada são coordenadas na página, com modal de criação interno e
modais compartilhados de login, vínculo e senha. `api/salamod1` fornece modos,
helpers e criação; sala de times livre usa o POST específico atual. Autenticação
das ações, elegibilidade, saldo exibido e senha seguem SDK/contextos/regras
existentes; a vitrine continua pública. Helpers de rota e armazenamento de senha,
`CutCard`, `MCIcon` e modais permanecem compartilhados. Não criar ou entrar em
salas reais ao validar callbacks; simule também o `fetch` direto de sala de times.

[MinhasPartidas](pages/MinhasPartidas.tsx) exibe salas finalizadas do participante,
usando `api.matches.minhas({ limit: 200 })`, endpoint `/api/matches/minhas`, com shape
`ApiLegacySala`. O backend consulta `matches`/participantes encerrados, ordenados
por criação decrescente. Vários modos, incluindo salas vinculadas a campeonatos,
podem aparecer; não é um histórico genérico de jogos Riot ou bilhetes de aposta.
Os itens exibem “Sala #” e navegam para `/sala/:id` como no código existente.

Dependências compartilhadas: [AuthContext](../../contexts/AuthContext.tsx),
[PerfilContext](../../contexts/PerfilContext.tsx), [SDK](../../lib/api.ts) e
`getModoInfo` de [api/salamod1](../../api/salamod1.ts). O helper fornece ícone/cor;
a página mantém mapeamento dos dados, estatísticas, datas, loading e callbacks.

Cuidados com o estado atual: o efeito de perfil atualiza apenas o selo VIP;
não existe bloqueio de histórico por VIP no JSX atual. O histórico carrega no
efeito de montagem assim que `user.id` estiver disponível, usando `carregarDados`
e o endpoint existente. A dependência é o ID: renderizações comuns, alterações
de perfil e novos objetos do mesmo usuário não repetem a consulta. Uma nova
montagem ou identidade inicia nova carga; cleanup descarta respostas anteriores
antes do mapeamento e impede que encerrem o loading atual. A requisição já
iniciada não é abortada. Sucesso, vazio e erro encerram loading da carga ativa;
erro mantém o registro existente no console, sem UI própria de falha. Não reative
restrições VIP com base no comentário antigo do topo.

Permanecem externos os hooks de participação e transporte Realtime,
componentes de Draft/elegibilidade e a feature de sala de campeonato.
Não mover esses componentes compartilhados ou mudar regras de participação,
apostas, resultados e verificação Riot junto com ajustes de histórico.

Validação em `web/`: `npm run lint`, `npm run build` e
`npm run test:dom -- src/features/salas/pages/MinhasPartidas.dom.test.tsx`.
O [teste permanente](pages/MinhasPartidas.dom.test.tsx) monta React real no jsdom
com SDK/identidades simulados: carga, sucesso/vazio/erro, VIP, dependências,
remontagem, StrictMode e respostas após unmount/troca de identidade. A regressão
de carga falhou antes da correção e passou depois; não usa chamada manual.
Homologação visual/interativa em navegador e integração real permanecem pendentes.

## Fronteiras e dependências de SalaMod1

- [SalaMod1](pages/SalaMod1.tsx) é a composição das salas comuns nas rotas
  públicas `/5v5/:id`, `/aram/:id` e `/1v1/:id` do App. Coordena vagas,
  confirmação, tela de draft, resultado, elegibilidade e chat; o servidor decide
  estados/regras. A página já está neste módulo; os contratos compartilhados
  permanecem nos locais indicados abaixo.
- [useSalaChat](hooks/useSalaChat.ts) e
  [ChatDaSala](components/ChatDaSala.tsx) têm somente SalaMod1
  como consumidor direto. O hook mantém mensagens/não lidas, histórico pelo SDK
  e expiração de 24h; o widget carrega no mount e envia por callback.
- [useSalaSimples](../../hooks/useSalaSimples.ts) é usado em runtime somente por
  SalaMod1, mas exporta `ErroElegibilidade` para
  [ModaisElegibilidade](../../components/partidas/ModaisElegibilidade.tsx).
  Esses modais e seus recortes também atendem Perfil e depósitos/saques.
  Não mover o hook como privado sem avaliar essa fronteira de tipo compartilhada.
- [useSalaRealtime](../../hooks/useSalaRealtime.ts) atende o hook comum e
  [SalaCampeonato](../sala-campeonato/README.md). O
  [README de Realtime](../../../../api/src/realtime/README.md) descreve o protocolo. Contrato:
  update/reconnect/status, chat e prévia de draft; socket `/ws`, com assinatura,
  refetch/debounce, reconexão e cleanup. Não alterar o transporte neste avanço.
- [DraftRoom](../../components/draft/DraftRoom.tsx) e
  [VagaSlot](../../components/partidas/VagaSlot.tsx) são usados pelas duas salas;
  regras/prazos do draft vêm do servidor, e ações chegam por callbacks.
  Tipos, áudio e componentes de draft permanecem compartilhados.
  O desenho do DraftRoom tem duas composições a partir das mesmas peças: em
  paisagem (desktop/notebook, tablet deitado, celular deitado) vale o layout
  absoluto em `vmin`; em retrato o conteúdo vira uma coluna centralizada e
  rolável, na ordem menu em linha, bans dos dois lados na mesma linha, fase +
  barra de turno + relógio, bolas dos dois times, picks do lado azul, picks do
  lado vermelho e grid de campeões com busca/filtro — com a barra de confirmar
  fixa no rodapé. As linhas dividem a largura (`flex-1`/`min-w-0`) para não
  estourar em telas estreitas. A troca é por orientação da tela (`landscape`),
  não por jogador ou modo. Quando o servidor marca o draft como `finished`, o
  chrome (relógio, fase, bans, picks, grid e confirmar) sai em fade de 300ms, as
  duas bolas viajam para o centro por `layoutId` e o tema de finalização sai em
  rampa; a tela de partida (`aoVivo`) usa a mesma composição central com
  [TeamBall](../../components/draft/TeamBall.tsx), então as bolas não saltam na
  troca. Essa transição só aparece enquanto a página mantém o DraftRoom montado
  depois do fim — hoje a sala de campeonato (janela pós-draft); em `/5v5` e
  `/aram` o componente sai de cena no mesmo update.
- SDK, contextos, `api/salamod1`, relógio/som e serviços backend continuam nos
  locais atuais. Procure entrada/saída/confirmação/tick em useSalaSimples e seus
  helpers HTTP; estado do chat em useSalaChat; conexão/eventos em useSalaRealtime.
  Não mover Draft, Realtime, elegibilidade ou serviços de campeonato em conjunto
  com uma movimentação isolada da página.

## Chat da sala comum

O hook guarda estado; o widget apresenta mensagens e recebe callbacks da página.
`ApiSalaChatMensagem` continua no SDK compartilhado. SalaMod1 liga recebimento
e reconexão de useSalaSimples ao hook; histórico vem de `api.matches.mensagens`,
na montagem do widget e na reconexão. IDs deduplicam recebimentos, mensagens de
outros usuários incrementam não lidas e abertura/scroll ao fim marcam leitura.
O envio usa o callback existente; transporte e autenticação continuam externos.

Mensagens expiram após 24 horas, com limpeza a cada cinco segundos e
`clearInterval` na desmontagem. Preserve dependências dos efeitos e refs de
scroll. O widget não tem UI própria de loading/erro nem rótulos de horário;
falha do histórico é registrada pelo hook. Não acrescentar esses estados numa
movimentação. Não há testes frontend específicos de Chat no repositório;
comparadores externos cobrem estado, timers e callbacks simulados. DOM, scroll
real, WebSocket e integração autenticada ainda exigem homologação em navegador.
