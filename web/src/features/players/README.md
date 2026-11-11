# Jogadores — catálogo público

[Players](pages/Players.tsx) atende `/players`, público e lazy no
[App](../../App.tsx). Exibe jogadores, elo, partidas/win rate, rotas preferidas,
VIP e vínculo de time. Clique abre OP.GG; não há rota de perfil público local
desse card. O backend é [Jogadores](../../../../api/src/modules/players/README.md).

## Estrutura e carregamento

- `pages/Players.tsx`: filtros, busca com debounce de 300 ms, página de 40 itens,
  loading, popup e apresentação. Mantém os efeitos, refs e callbacks de navegação.
- [services/catalog.ts](services/catalog.ts): `carregarJogadores`, tamanho da
  página, mapeamentos de filtro e cálculo de partidas/win rate (SoloQ com fallback
  FlexQ). Busca `players.filtrados`, enriquece por `teams.members`/`teams.batch`,
  reconhece convidados e prioriza vínculo real, compondo os cards.
- [playerMeta](../../components/players/playerMeta.ts) contém tipos de jogador,
  roles, estilos e ícones usados também por [Times](../teams/README.md). Continua
  compartilhado. `lib/opgg.ts` monta o link externo; `api/riot.ts` fornece DDragon.

A listagem lê cache de elo do servidor. Não dispara consulta Riot individual
para recalcular elo a cada render. O refresh em lote pertence ao painel Admin/jobs.
Uma falha em `players.filtrados` atualmente vira lista vazia no loader; preservar
ou mudar esse tratamento deve ser uma decisão explícita, não efeito da extração.

## Limitações atuais do contrato

O parâmetro `filtroSemTime` é recebido pelo loader, mas não aplicado. O backend
filtra lane após paginar e conta total antes desse filtro. Essas são limitações
existentes; a organização não as corrigiu. Não anunciar o filtro como funcional
sem alterar e verificar o fluxo completo.

Preserve a origem dos dados, os callbacks, o JSX e o tema. Para imports/extração
sem mudança de lógica, lint/build em `web/` e comparação das declarações são
proporcionais. Não há teste DOM específico do catálogo; testes do job no backend
não homologam filtros, rolagem ou interação dessa página.
