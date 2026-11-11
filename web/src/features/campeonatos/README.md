# Módulo de Campeonatos — frontend

## Responsabilidade e entradas

Listagem pública de torneios e coordenação de inscrições, grupos, cronograma,
chaves, classificação e administração do campeonato. A organização é gradual:
o módulo existente é `features/campeonatos`; não há módulo frontend paralelo.

- `/campeonatos` → `pages/campeonatos.tsx`, importado por lazy load em `web/src/App.tsx`.
- `/campeonato/:id` → `pages/CampeonatoDetalhes.tsx`, importado por lazy load em `web/src/App.tsx`;
  mantém o acesso público com `RouteWithSuspense` dentro do layout existente.
- `/admin/criar-campeonato` → `pages/createCampPage.tsx`, importado por lazy load em `web/src/App.tsx`;
  usa `PrivateRoute` e verifica admin/organizador na própria página.
- `components/` reúne os componentes específicos do módulo: abas, cronograma,
  grupos, brackets, formulário, modais e utilitários visuais do detalhe.

## Estrutura atual

| Caminho relativo ao módulo | Responsabilidade |
|---|---|
| `pages/campeonatos.tsx` | Listagem, busca por título/descrição, filtro de status, cards e navegação. |
| `pages/createCampPage.tsx` | Criação e gerenciamento: configurações, imagens, inscrições, status e chaves; mantém a implementação existente. |
| `pages/CampeonatoDetalhes.tsx` | Orquestra o detalhe: informações, participantes, grupos/sorteios, cronograma, resultados, classificação, PDL, chaves e modais, com o estado do `CampeonatoContext`. |
| `CampeonatoContext.tsx` | `CampeonatoProvider`/`useCampeonato`: estado do detalhe, abas, modais, inscrições, cronograma e ações administrativas. |
| `components/FormCriarCampeonato.tsx` | Interface do formulário usada por `createCampPage.tsx`. |
| `components/ListaCampeonatosAdmin.tsx` | Grade administrativa: novo campeonato, cards com status/inscritos/data, seleção e confirmação de exclusão. Recebe dados e callbacks da página, sem estado ou requisições próprios. |
| `components/modals/ConfiguracoesCampeonatoModal.tsx` | Apresentação do modal de configurações/edição; recebe dados, setters, refs e callbacks da página, sem estado ou requisições próprios. |
| `components/VisaoGeral.tsx`, `Grupos.tsx`, `GroupStage.tsx` | Informações gerais, participantes e visualização dos grupos. |
| `components/Chaves.tsx`, `DoubleSideBracket.tsx`, `DoubleEliminationBracket.tsx` | Chaveamento e visualização dos brackets. |
| `components/BracketMatch.tsx`, `UpperRound.tsx`, `LowerRound.tsx` | Partidas e rodadas dos brackets superior e inferior. |
| `components/Cronograma.tsx`, `ListaCronograma.tsx`, `AdminCriarJogo.tsx` | Cronograma, salas/resultados de séries e interface de criação manual de jogos. |
| `components/MeusJogosPendentes.tsx`, `TodosJogosPendentes.tsx`, `Historico.tsx` | Jogos pendentes do participante/do campeonato e histórico. |
| `components/cut-edge.ts`, `dates.ts`, `icons.ts` | Utilitários visuais, datas e ícones usados pelos componentes do módulo. |
| `components/modals/` | `RegrasModal`, `BracketModal`, `InscricaoModal`, `AgendamentoModal` e `AdminMatchModal`. |
| `domain/bracket.ts` | Estrutura inicial, migração e avanço de times nas chaves. |
| `domain/team-ref.ts` | Comparação de tag/nome ignorando caixa e espaços (`sameTeamRef`). |
| `domain/agendamento.ts` | Predicado puro `semHorario(data?, hora?)`: reconhece ausência de data/hora e os sentinelas `A COMBINAR`/`--:--` do cronograma. |
| `domain/imagem.ts` | Compressão e upload das imagens do campeonato via cliente da API. |
| `types.ts` | Contratos de UI: campeonato, inscrições, cronograma, classificação e brackets. |
| `mappers.ts` | Conversão do payload snake_case da API para UI e montagem de payloads. |
| `tournamentCache.ts` | Cache de shell/seções por 30 segundos, deduplicação, prefetch e invalidação. |

## Listagem

Usa `api.tournaments.listCards({ sort: 'created_at' })`, com cache próprio de
5 minutos em memória. Mapeia status para os cards e ordena por inscrições
abertas, andamento, em breve e finalizados. Busca e filtro ficam na página;
o card usa a logo, e o banner permanece exclusivo do detalhe.

O clique abre `/campeonato/:id`; o hover antecipa shell e classificação pelo
`tournamentCache`. O botão de gerenciamento aparece para `role === 'admin'`
ou `cargo === 'organizador'`. A listagem não importa `CampeonatoContext`.

## Criação e gerenciamento

`pages/createCampPage.tsx` mantém o componente `AdminPanel`, as abas de criação
e gerenciamento e os estados existentes. Usa `AuthContext`/`RoleContext` para
identidade, cargo e filtro dos torneios do organizador; a rota conserva `PrivateRoute`.

Quando nenhum torneio está selecionado, `components/ListaCampeonatosAdmin.tsx`
renderiza a grade existente com props tipadas. `myTournaments`, seleção, aba e
exclusão permanecem sob controle da página; o componente mantém o JSX, animações
e confirmação de exclusão dos cards. Não acessa a API nem introduz hooks.

O formulário é `components/FormCriarCampeonato.tsx`, com campos, callbacks e refs
recebidos da página. Compressão, uploads de logo/banner/foto da organização e
tratamento de imagens existentes usam `domain/imagem.ts`. A persistência passa
por `api.tournaments` em `lib/api.ts`: listagem, detalhe, criação, atualização,
remoção, reabertura e aprovação/remoção de inscrições. A integração com Times
nesta página usa os times inscritos no payload do campeonato; não há import
direto do módulo Times nem chamada a `api.teams`. Nenhuma dessas regras foi
separada ou alterada nesta movimentação.

### Modal de configurações

`components/modals/ConfiguracoesCampeonatoModal.tsx` contém o overlay e o painel
de edição antes renderizados em `pages/createCampPage.tsx`. Não adiciona wrappers,
hooks, efeitos ou acesso à API. A página conserva `isEditModalOpen` e o
`AnimatePresence` que controla a montagem e as animações de saída.

As 12 props são `formData`, `setFormData`, `selectedTournament`,
`setSelectedTournament`, `setIsEditModalOpen`, `orgInputRef`, `bannerInputRef`,
`orgPhotoInputRef`, `handleInputChange`, `handleStatusChange`,
`handleDeleteTournament` e `handleSaveEdit`. O formulário tem contrato explícito;
o campeonato é genérico, exigindo somente id, tier e os quatro status atuais,
para preservar os demais campos nos setters sem depender da página.

Estados, `openEditModal`, sincronização de prévia, validações, permissões,
compressão/upload e persistência permanecem na página. Os três inputs de arquivo
ocultos também permanecem lá; o modal aciona as mesmas refs. Salvar, trocar status
e excluir continuam chamando os handlers recebidos. Os ajustes visuais inline
de cor, tier e prêmios extras usam os setters originais, sem novo estado.

Cuidados: preservar a montagem condicional, a seleção preenchida por
`openEditModal`, a ordem fechar/excluir e os callbacks completos. Não mover os
inputs ocultos, duplicar os estados ou transformar descartar em rollback:
o comportamento existente de prévia e descarte é mantido. Os nomes, atributos,
classes, textos e eventos dos campos permanecem os mesmos.

Validação local: `npm.cmd run lint` e `npm.cmd run build` em `web/`, mais o teste
de agendamento indicado abaixo. O teste permanente de agendamento é evidência
reproduzível desse contrato; não cobre o formulário e seus callbacks.
Homologação interativa em navegador deve ser registrada separadamente quando disponível.

## Detalhe do campeonato

`pages/CampeonatoDetalhes.tsx` obtém o `id` da rota, monta o `CampeonatoProvider`
e usa `useCampeonato` para renderizar informações, inscrições/participantes,
grupos e sorteios, cronograma, resultados, classificação, PDL e chaveamento.
Mantém navegação de volta a `/campeonatos`, regulamento e controles administrativos.
Os estados, ações, carregamento por aba e permissões continuam no
`CampeonatoContext.tsx`, sem alteração nesta movimentação.

A página usa os componentes em `components/`
(`VisaoGeral`, `Grupos`, `Cronograma`, `Chaves`, `Historico`, brackets e utilitários)
e os cinco modais em `components/modals/`. A estrutura inicial das chaves vem
de `domain/bracket.ts`. Não chama a API diretamente: usa as ações do contexto.
`components/` reúne componentes específicos do módulo e `domain/` mantém a
lógica de domínio já existente. `CampeonatoContext.tsx` continua na raiz do módulo;
formulário e modais mantêm seus caminhos. `AdminCriarJogo`, `Chaves`,
`ListaCronograma`, `MeusJogosPendentes`, `TodosJogosPendentes` e `BracketModal`
consomem `useCampeonato`. Os demais recebem props ou compõem esses componentes.
O detalhe e `BracketModal` compartilham os brackets de `components/`.

O contexto usa `domain/agendamento.ts` nas três verificações de horário do
handler de agendamento. A extração preserva a comparação literal existente;
não normaliza entradas nem valida formatos. Estados, transições, permissões e
persistência continuam no contexto. Teste isolado, sem bibliotecas adicionais:
`node --test web/src/features/campeonatos/domain/agendamento.test.ts` (na raiz).

As rotas relacionadas permanecem `/campeonatos`, `/campeonato/:id`,
`/admin/criar-campeonato` (com `PrivateRoute`) e `/campeonato/sala/:id`.
A integração com Times, Salas e Draft continua pelos consumidores existentes.

## Dependências confirmadas

- **Identidade/permissões:** listagem usa `RoleContext`; contexto do detalhe
  usa também `AuthContext` e `PerfilContext`. Admin da plataforma ou
  organizador proprietário (`criadoPor === user.id`) determina `isAdmin` no detalhe;
  a autorização efetiva permanece no servidor.
- **Times:** contexto usa `api.teams.batch`, `api.teams.byUser` e o time do perfil
  para inscrições e reconhecimento do participante. A listagem aponta para `/times`.
- **Salas/Draft:** `components/ListaCronograma.tsx` cria/abre
  `/campeonato/sala/:id`. A página `features/sala-campeonato/SalaCampeonato.tsx`
  importa `components/draft/DraftRoom`; essa dependência é indireta, fora da listagem.
- **LoL/Riot:** textos da listagem e de `mappers.ts` mencionam LoL; o formulário
  existente expõe tier/limite de elo. `ListaCronograma.tsx` copia código Riot e
  consulta resultados de série pela API própria, sem chamar a Riot diretamente.

## API utilizada

Cliente central: `web/src/lib/api.ts`. Backend de entrada:
`api/src/modules/tournaments/routes.ts` (mount `/api/tournaments`).

| Consumidor | Endpoints principais |
|---|---|
| Listagem | GET `/api/tournaments?sort=created_at&view=card`. |
| Cache/detalhe | GET `/api/tournaments/:id/shell` e `/:id/{classificacao,grupos,cronograma,chaves}`. |
| Contexto | PUT `/api/tournaments/:id`, `/:id/cronograma`, `/:id/cronograma/merge`; POST `/:id/inscricoes`, `/:id/recalcular-pdl`. |
| Criação/admin | GET/POST `/api/tournaments`, GET/DELETE `/:id`, PUT `/:id`; POST `/:id/reabrir`, `/:id/inscricoes/:teamId/aprovar`; DELETE `/:id/inscricoes/:teamId`. |
| Cronograma externo | POST `/api/tournaments/:id/jogo/:matchId/sala` e `/:id/jogo/:matchId/verificar`. |
| Apoio | GET `/api/teams/batch`, `/api/teams/by-user/:userId`; POST `/api/upload`. |

Nas células acima, caminhos iniciados por `/:id` continuam sob `/api/tournaments`.

## Cuidados durante a modularização

- Preservar rotas, estados, filtros, cache, JSX, classes e contratos da API.
- Detalhe carrega seções por aba. `salvarCampeonato` só reenvia grupos/cronograma
  já carregados, para não apagar dados ausentes; classificação não volta no PUT.
- Edição manual da chave é visual; não deve produzir PDL, histórico ou resultados
  do cronograma. Resultados/PDL continuam coordenados pela API existente.
- Não mudar identificação de times, permissões ou fluxos de inscrição/agendamento
  durante movimentações. Regras genéricas e vínculos LoL/Riot seguem no local atual.
- As três páginas principais ficam em `pages/`, e os componentes específicos
  ficam em `components/`, sem camada de compatibilidade no caminho antigo.
  As movimentações preservam as implementações, com ajuste apenas de imports;
  contexto, formulário, modais, domínio e tipos mantêm seus locais.
- Em futuras refatorações do detalhe, preservar o `CampeonatoProvider`, todos os
  estados e callbacks consumidos, permissões de usuário/admin e integrações com
  Times/Salas/Draft, além de aparência e responsividade. Não alterar a lógica de
  inscrições, sorteios, resultados, classificação ou PDL durante recortes físicos.

## Homologação pendente

As movimentações das páginas e dos componentes ainda exigem conferência
visual e de navegação em navegador.
Lint/build e comparação do código não substituem essa homologação.
