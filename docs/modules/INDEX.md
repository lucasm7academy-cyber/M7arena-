# Funcionalidades do M7Arena

Mapa do produto atual, confirmado nas rotas de [App](../../web/src/App.tsx) e nos
registros do [bootstrap HTTP](../../api/src/index.ts). Comece pela funcionalidade
e leia seu README. Nomes de diretórios técnicos não são funcionalidades extras.

## Produto em 12 áreas

| Área | Rotas / entrada de interface | Contexto frontend | Dono HTTP / contexto backend |
|---|---|---|---|
| Início | `/lobby`; `/` redireciona ao lobby, com tratamento de callback OAuth | [Home](../../web/src/features/home/README.md) | Consome Times, Campeonatos, Streams e Conteúdo; sem router Home duplicado. |
| Conta e perfil | `/login`, `/redefinir-senha`; privadas `/perfil`, `/vincular` | [Identidade](../../web/src/features/identity/README.md), [Perfil/Riot](../../web/src/features/profile/README.md) | [Identidade](../../api/src/modules/identity/README.md) em `/api/auth` e `/api/terms`; [Perfis](../../api/src/modules/profiles/README.md) em `/api/profiles`. |
| Jogadores | `/players`, público | [Catálogo](../../web/src/features/players/README.md) | [Jogadores](../../api/src/modules/players/README.md), `/api/players`. |
| Times | `/times`, `/times/:id`, públicos; gestão exige identidade/permissão | [Times](../../web/src/features/teams/README.md) | [Times](../../api/src/modules/teams/README.md), `/api/teams`. |
| Campeonatos | `/campeonatos`, `/campeonato/:id`; privada `/admin/criar-campeonato` | [Campeonatos](../../web/src/features/campeonatos/README.md) | [Campeonatos](../../api/src/modules/tournaments/README.md), `/api/tournaments`. |
| Salas e partidas | `/jogar`, `/5v5/:id`, `/aram/:id`, `/1v1/:id`, `/campeonato/sala/:id`, `/sala-time/:id`; privada `/partidas` | [Salas comuns/histórico](../../web/src/features/salas/README.md), [sala de times/campeonato](../../web/src/features/sala-campeonato/README.md) | [Partidas](../../api/src/modules/matches/README.md), `/api/matches`; séries/Draft compartilhados. |
| Desafios individuais | Privada `/aposta-individual`; histórico também no Perfil | [Desafios/Apostas](../../web/src/features/apostas/README.md) | [Apostas](../../api/src/modules/bets/README.md), `/api/bets`; consome carteira, sem possuir Pix. |
| Transmissões | `/streamers`; lives também no Início/Salas | [Streams](../../web/src/features/streams/README.md) | [Streams](../../api/src/modules/streams/README.md), `/api/streams`. |
| Administração | Privada `/admin`, fora do layout público | [Admin](../../web/src/features/admin/README.md) | [Admin](../../api/src/modules/admin/README.md), `/api/admin`; outras abas consomem os domínios de Economia, Conteúdo, Jogadores e Times. |
| Carteira e Pix | Modal no layout, carteira no Perfil e saques no Admin; sem rota de página própria | [Economia](../../web/src/features/economy/README.md) | [Economia](../../api/src/modules/economy/README.md), `/api/wallet`, `/api/payments`, `/api/withdrawals`. |
| Notificações | Sino no layout; sem rota própria | [Sino](../../web/src/features/notifications/README.md) | [Notificações](../../api/src/modules/notifications/README.md), `/api/notifications`. |
| Conteúdo e institucional | `/quem-somos`, `/politicas`, `/tutorial`; highlights em Home/Streams/Admin | [Institucional](../../web/src/features/institutional/README.md), [Home](../../web/src/features/home/README.md) | [Conteúdo/highlights](../../api/src/modules/content/README.md), `/api/content`; textos institucionais são locais no frontend. |

Essas áreas são o mapa de navegação, não doze processos ou tabelas. Páginas
públicas podem ter ações autenticadas; PrivateRoute é apresentação, e o servidor
mantém as autorizações de cada endpoint. Os READMEs backend enumeram os métodos.

## O que liga as áreas

| Relação | Onde entender o contrato |
|---|---|
| Conta → todas as ações autenticadas | [Identidade backend](../../api/src/modules/identity/README.md) e [providers frontend](../../web/src/README.md). |
| Perfil/Riot ↔ Jogadores/Times | [Perfis](../../api/src/modules/profiles/README.md), [Times](../../api/src/modules/teams/README.md); identidade de convidado por PUUID/handle. |
| Campeonato → Times, Salas, séries e Streams | [Campeonatos](../../api/src/modules/tournaments/README.md) e [sala de times](../../web/src/features/sala-campeonato/README.md). |
| Salas/Desafios → elegibilidade, carteira e ledger | [Serviços compartilhados](../../api/src/lib/README.md) e [Economia](../../api/src/modules/economy/README.md). |
| Salas comuns e de times → Draft/Realtime | [Draft no mapa de serviços](../../api/src/lib/README.md#draft-comum), [Realtime](../../api/src/realtime/README.md), [componentes frontend](../../web/src/README.md). |
| Desafios → sino persistente | [Notificações](../../api/src/modules/notifications/README.md); distinto do WebSocket de sala. |
| Admin → serviços dos demais domínios | [Admin frontend](../../web/src/features/admin/README.md); a existência de uma aba não transfere a propriedade do serviço. |
| Início → agregação pública | [Home](../../web/src/features/home/README.md), sem duplicação de Times/Streams/Conteúdo. |

## Responsabilidades compartilhadas

- [Frontend](../../web/src/README.md): SDK, clientes Riot/sala, contextos, layout,
  Draft, elegibilidade, playerMeta e som. [UI](../../web/src/components/ui/README.md)
  detalha recortes, moeda e VIP.
- [Serviços da API](../../api/src/lib/README.md): sala/série/Draft, elegibilidade,
  sessão, motores econômicos, cache Riot e produtores de notificação.
- [Integrações HTTP](../../api/src/routes/README.md): `/api/riot`, `/api/upload` e `/api/og`.
  `/api/health` fica no bootstrap; `/ws` em [Realtime](../../api/src/realtime/README.md).
- [Dados](../../db/README.md): schemas, [baseline e evolução](../../db/migrations/README.md) e fronteiras persistidas.
- [Projeto/infraestrutura](../../README.md), [scripts](../../scripts/README.md),
  [ferramentas frontend](../../web/scripts/README.md) e
  [Graph RAG](../../tools/graph-rag/README.md): suporte ao desenvolvimento/operação.

## Compatibilidade e código sem entrada ativa

- `/time_vs_time_livre/:id` redireciona a `/sala-time/:id`;
  `/time_vs_time/:id` redireciona a `/jogar`. A rota `*` redireciona ao lobby.
- [Tierlist/M7 Academy](../../web/src/features/m7-academy-tierlist/README.md):
  código preservado sem rota no App e sem router montado. Não compõe as áreas
  ativas acima. Schema existente não autoriza reativação nem exclusão de dados.
- Menção em comentário, helper ou SDK não comprova funcionalidade publicada.
  Exemplo: assinatura `ApiMatchesSdk.start` sem implementação runtime, registrada
  no [README frontend](../../web/src/README.md#fluxo-de-dados-e-limites).

## Como manter este mapa

Ao criar/mover uma funcionalidade, atualize a linha correspondente e os links.
Regras e detalhes ficam no README dono; resultados de execuções ficam no chat.
Não recrie catálogos paralelos. A orientação para agentes está em
[AGENTS.md](../../AGENTS.md); [docs/INDEX.md](../INDEX.md) reúne os READMEs técnicos.
