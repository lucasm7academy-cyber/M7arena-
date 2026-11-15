# Sala de campeonato e scrim livre

## Entradas e responsabilidade

[SalaCampeonato.tsx](SalaCampeonato.tsx) atende as rotas públicas
`/campeonato/sala/:id` e `/sala-time/:id` do [App](../../App.tsx). O alias
`/time_vs_time_livre/:id` redireciona para a sala livre. O componente também
apresenta a fase final dessas salas; os estados e permissões vêm do servidor.

A composição pós-draft (`renderPosDraft`) desenha cada time na
[bola compartilhada do draft](../../components/draft/TeamBall.tsx): círculo com
a logo ao fundo e borda acesa na cor do lado em jogo, no mesmo tamanho e com o
mesmo brilho da bola do draft, centralizada sobre os campeões escolhidos. A
entrada é um fade curto (sem reposicionar as bolas: quem as leva ao centro é a
transição do fim do draft) e respeita `prefers-reduced-motion`. Ela atende a
partida finalizada da sala livre; no campeonato, `camp_jogo` com draft no
payload segue na casca ao vivo do DraftRoom, que exibe essas mesmas bolas no
centro. A transição até lá (fade do relógio, dos slots, do grid e do confirmar,
bolas ao centro e som de finalização em rampa) roda dentro da janela
`posDraftAtivo` deste arquivo.

A página concentra consulta e transformação da resposta, polling, ligação com
Realtime, catálogo de campeões, vagas dos times, escolha de lado/ordem, Draft,
código, transmissão, verificação de resultado e telas de encerramento.
[ModalResultadoManual](ModalResultadoManual.tsx) recebe estado e callbacks da
página; ele não persiste resultado por conta própria.

## Contratos e fluxo de dados

| Operação | Entrada atual |
|---|---|
| Carregar sala | `GET /api/matches/:id`; `carregar` registra `server_time` e atualiza o estado local. |
| Participar, pronto, lado, ordem, ban/pick, reset e resultado manual | `POST /api/matches/:id/sala-campeonato/<ação>` pelo helper local `chamar`. Resposta usa `ok/erro/estado/mudou`, com campos adicionais conforme a ação. |
| Times do usuário | `GET /api/teams/by-user/:userId`, para apresentação do lado do usuário. |
| Iniciar transmissão | Ação `/sala-campeonato/live` de Partidas. |
| Encerrar transmissão | `POST /api/streams/:id/parar`, com permissão validada no servidor. |
| Verificar série de campeonato | `POST /api/tournaments/:id/jogo/:serieId/verificar`. |
| Verificar sala livre | `POST /api/matches/:id/verificar`. |

Essas chamadas ainda usam `fetch` diretamente nesta página, com cookie e
tratamento local de resposta. Não são métodos completos do SDK `api.matches`.
Uma alteração de contrato precisa conferir a página e o SDK; a existência de
tipos em `web/src/lib/api.ts` não garante que esta composição os utilize.
O catálogo de campeões usa DDragon para apresentação, sem decidir regras de Draft.

[useSalaRealtime](../../hooks/useSalaRealtime.ts) dispara recarga em atualização
e reconexão e entrega prévia de Draft. Há polling de cinco segundos mesmo com
socket ativo; o intervalo de um segundo repinta os relógios. Timers derivados de
`server_time`, timeout de pós-Draft e cleanup dos efeitos fazem parte do fluxo.
Não interpretar a prévia WebSocket como ban/pick persistido.

## Fronteiras compartilhadas

- HTTP de sala no [módulo Partidas](../../../../api/src/modules/matches/README.md).
- [sala-campeonato](../../../../api/src/lib/sala-campeonato.ts) compõe sala,
  vagas, pronto e acesso; [draft de times](../../../../api/src/lib/sala-campeonato-draft.ts)
  cuida das fases e Fearless.
- [serie-campeonato](../../../../api/src/lib/serie-campeonato.ts) atende a série
  ligada a torneio; [serie-livre](../../../../api/src/lib/serie-livre.ts) atende
  scrim. [serie-sala](../../../../api/src/lib/serie-sala.ts) é a série 5v5 comum,
  consumida também por Draft/verificação, não um substituto dos outros motores.
- [Realtime](../../../../api/src/realtime/README.md),
  [DraftRoom](../../components/draft/DraftRoom.tsx),
  [TeamBall](../../components/draft/TeamBall.tsx),
  [VagaSlot](../../components/partidas/VagaSlot.tsx), identidade, relógio e áudio
  são compartilhados com outros fluxos. A ação "Atualizar resultado" desta
  página entra no DraftRoom pelo slot `acoesTopo.extra`: fica na linha do topo
  no celular e no canto esquerdo no desktop, sem o componente conhecer a ação.
- O [módulo Campeonato](../../../../api/src/modules/tournaments/README.md) mantém
  inscrição, cronograma, classificação e persistência da série; Streams mantém
  transmissão. Autorização, elegibilidade e economia continuam no servidor.

Os serviços de sala/série/Draft têm imports nos dois sentidos. Mover um deles por
nome ou como dependência exclusiva desta tela pode afetar cron, Campeonato,
Partidas e Streams. A página também usa respostas locais genéricas (`any`);
mudanças em payload precisam conferir todos esses consumidores.

## Verificação

Em `web/`, `npm run lint` e `npm run build` verificam tipagem/bundle. Não há teste
DOM específico desta feature. Não considerar essas verificações homologação de
timers, troca de lados, Draft, callbacks administrativos ou reconexão.

Os testes backend `sala-campeonato.test.ts`, `sala-campeonato-draft.test.ts`,
`sala-campeonato-schema.test.ts`, `serie-campeonato.test.ts` e `streams.test.ts`
exercitam serviços com banco isolado. Consulte o
[comando e isolamento da API](../../../../README.md#testes-da-api).
Eles não montam esta página nem exercitam o protocolo WebSocket real.
Não aplicar resultado, criar transmissão ou operar salas reais para testar UI.
