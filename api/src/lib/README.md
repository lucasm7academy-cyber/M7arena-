# Serviços compartilhados da API

Esta pasta é uma fronteira compartilhada, não uma funcionalidade de usuário.
Antes de mover ou recriar um serviço, confira seus consumidores e o README do
[domínio no índice](../../../docs/modules/INDEX.md). Os routers dos domínios estão
em `api/src/modules`; serviços mantidos aqui não se tornam exclusivos pelo nome.

## Mapa de responsabilidades

| Arquivos | O que mantém / quem usa |
|---|---|
| [match-flow.ts](match-flow.ts) | Sessão reutilizada por routers, resolução de sala, códigos, transições e `notifyMatchChange`; participa de Salas, Apostas, cron e integração de séries. |
| [match-shape.ts](match-shape.ts) | Shape completo/card legado de sala, vagas e dados apresentados ao frontend. |
| [acesso-sala.ts](acesso-sala.ts) | Cargos, staff e participante para leitura de código/chat/ações; não substitui permissões de Campeonato. |
| [elegibilidade.ts](elegibilidade.ts) | Conta/Riot/termos/saldo/salas ativas, advertências e ban automático; usado por Salas, Desafios e Administração. |
| [escrow.ts](escrow.ts) | Reservar/devolver entrada, prêmio e ledger de salas; não é o motor dos bilhetes individuais. |
| [verificar-partida.ts](verificar-partida.ts) | Conferência Riot e encerramento/cancelamento; integra séries, Times e economia. |
| [sala-campeonato.ts](sala-campeonato.ts) | Vagas/pronto/lado, acesso, criação e transmissão de sala de torneio ou scrim. |
| [sala-campeonato-draft.ts](sala-campeonato-draft.ts) | Draft de times, ordem e Fearless; integração com sala/série. |
| [serie-campeonato.ts](serie-campeonato.ts) | Códigos, busca de partidas, MD1/MD3/MD5 e persistência da série ligada ao torneio. |
| [serie-livre.ts](serie-livre.ts) | Verificação/resultado da série de scrim, sem campeonato. |
| [serie-sala.ts](serie-sala.ts) | Série 5v5 comum, progressão entre jogos e coordenação com confirmação/verificação. |
| [session.ts](session.ts), [password-reset.ts](password-reset.ts) | Criação/cookie OAuth e recuperação transacional; [Identidade](../modules/identity/README.md) explica consumidores e limites. |
| [content.ts](content.ts) | Helpers de sessão/cargos compartilhados por Conteúdo e saques, apesar do nome. Não é apenas highlights. |
| [profile-shape.ts](profile-shape.ts) | Shape legado com distinção Pix próprio/público; [Perfis](../modules/profiles/README.md). |
| [atualizar-elos.ts](atualizar-elos.ts), [reconciliar-handles.ts](reconciliar-handles.ts) | Jobs de cache/identidade Riot com single-flight e pacing; usados por bootstrap/Jogadores, refletidos em Times/Perfil. |
| [ddragon.ts](ddragon.ts) | Dados de campeões usados no fluxo de draft; integra DDragon. |
| [mercado-pago.ts](mercado-pago.ts), [pagamentos.ts](pagamentos.ts), [withdrawals.ts](withdrawals.ts) | Gateway, confirmação/crédito e saque; [Economia](../modules/economy/README.md) documenta transações e contratos. |
| [notifications.ts](notifications.ts) | Produtor persistente usado por Apostas; [Notificações](../modules/notifications/README.md). |
| [tierlist.ts](tierlist.ts) | Validação de código sem router ativo; [Tierlist](../../../web/src/features/m7-academy-tierlist/README.md). |

## Draft comum

[draft/index.ts](draft/index.ts) é a entrada pública do motor: exporta regras,
registry e ações. `draft/regras.ts` resolve modo → contrato;
`draft/modos/{1v1,aram,5v5,time-vs-time}.ts` descrevem regras por modo;
`draft/flow.ts` cria/avalia/aplica ações; `tipos.ts` contém os contratos.
O comportamento de sala de times também passa pelo serviço específico acima.
Não usar um comentário genérico do motor para substituir as regras de cada modo.

O servidor decide turno, prazo, ban/pick e transições. O frontend apresenta estado
e envia intenção; preview de socket não persiste uma escolha. Leia
[Partidas](../modules/matches/README.md), [sala de times](../../../web/src/features/sala-campeonato/README.md)
e [Realtime](../realtime/README.md) antes de mudar esse acordo.

## Fronteiras e verificação

Sala ↔ série de campeonato e sala ↔ draft de times têm dependências em ambos os
sentidos. Não repartir serviços compartilhados por uma tela ou criar cópias para
evitar um import. Refatorar esses ciclos é uma intervenção de lógica própria.

[cron.ts](../cron.ts) coordena limpeza/verificação/apostas; [index.ts](../index.ts)
inicia HTTP e timers de sala/série/elos/handles. [db.ts](../db.ts) cria o pool na
importação. Não importar entrypoints nem executar jobs como teste documental.
Use o [guia de testes proporcionais](../../../README.md#testes-da-api).
