# Módulo de Times

Memória técnica da funcionalidade de times (listagem, página pública e gestão).

## Responsabilidade

Listagem de times (busca/paginação ordenada por PDL) e página pública de um time
com gestão de elenco/lineup e liderança, usando Riot ID/OP.GG para o catálogo de
jogadores.

## Estrutura

- `roster.ts` — tipos e funções compartilhados (`Membro`, `TimeData`, `ROLE_ORDER`, `eloDisplay`).
- `types.ts` — tipos compartilhados `TeamBasico` (listagem) e `CreateTeamData` (formulário de criação).
- `pages/equipes.tsx` — coordenação da listagem, busca, paginação e estados (rota `/times`).
- `components/TeamCard.tsx` — apresentação de cada time na listagem.
- `pages/TimePage.tsx` — página principal e coordenação de estados (rota `/times/:id`).
- `components/TeamRoster.tsx` — apresentação visual do elenco (Lineup).
- `components/modals/ModalBase.tsx` — wrapper visual compartilhado dos modais.
- `components/modals/CreateTeamModal.tsx` — formulário de criação de times.
- `components/modals/InvitePlayerModal.tsx` — modal de convite de jogadores.
- `components/modals/ManageLineupModal.tsx` — modal de gerenciamento do lineup.
- `components/modals/EditTeamModal.tsx` — modal de edição do time.
- `components/modals/ConfirmLeaveModal.tsx` — modal de confirmação de saída.

## roster.ts

Definições não visuais compartilhadas do módulo Times:
`Membro` (tipo), `TimeData` (tipo), `ROLE_ORDER` (ordem das rotas) e `eloDisplay`
(formatação de elo, sem JSX/React).

## TeamCard

- **Responsabilidade:** apresentar a linha de um time na listagem, com logo/tag,
  nome, selo de proprietário, ranking, PDL, winrate e vitórias/derrotas,
  preservando os layouts desktop/mobile e o som de clique.
- **Props:** `team` (`TeamBasico`, definido em `types.ts`), `onClick` (recebe o
  time) e `onLogoClick` opcional (recebe a URL do logo).
- **Relação com equipes.tsx:** a página mantém busca/paginação, carregamento da
  API, criação, navegação para `/times/:id` e estado do lightbox; o card apenas
  apresenta os dados e chama os callbacks. Usa `AuthContext` para identificar
  o proprietário e `useSound`, sem estado próprio nem chamadas à API.

## TeamRoster

- **Responsabilidade:** renderizar o elenco (titulares, reservas, coach) com
  ordenação por rota, avatar, Riot ID, elo e selo de capitão — apenas apresentação.
- **Props:** `membros` (`Membro[]`), `gradientFrom` (cor do time),
  `onPlayerClick` (callback de clique num jogador).
- **Relação com TimePage:** importa `Membro`, `ROLE_ORDER` e `eloDisplay` de
  `roster.ts`. A lógica de gerenciamento do elenco fica no `ManageLineupModal`
  e no backend (`api/src/modules/teams/`).

## CreateTeamModal

- **Responsabilidade:** formulário de criação com estados locais de nome, tag,
  cores, logo/preview/erro, WhatsApp e Discord; mantém os temas e a compressão
  de imagem locais, sem chamadas à API.
- **Props:** `onClose`, `onCreate` (recebe `CreateTeamData`, de `types.ts`, e pode
  retornar uma Promise) e `hasRiot` (vínculo Riot informado pela página).
- **Relação com equipes.tsx:** a página mantém `modalCriar`, `hasRiot`,
  `handleCreateTeam`, autenticação, chamadas de criação/upload/atualização,
  notificações e recarga do perfil/listagem. O formulário chama `onCreate` e
  fecha imediatamente via `onClose`, sem aguardar a resposta da API; não há
  estado de envio/loading próprio. A montagem condicional em `AnimatePresence`
  permanece na página, reiniciando os estados a cada abertura.
- **Validações atuais:** nome preenchido (até 24 caracteres), tag de 3 a 4
  caracteres em maiúsculas, vínculo Riot, WhatsApp e Discord preenchidos.
  WhatsApp é enviado apenas com dígitos. O seletor de logo aceita PNG/JPEG;
  a checagem atual usa MIME contendo `image`. A compressão tenta JPEG até
  400×400, qualidade 0,7; se falhar, mantém o arquivo original.
- **Fluxo preservado:** a página exige usuário autenticado e usa
  `api.teams.create`; havendo arquivo de logo, executa upload e
  `api.teams.update`. Erro de criação gera popup; falha de upload é registrada
  e não impede a conclusão da criação. O JSX original foi mantido, reutilizando
  apenas os polígonos `CUT_FRAME`/`CUT_FRAME_INNER` de `ModalBase`.

## InvitePlayerModal

- **Responsabilidade:** interface de convite de jogadores (busca por Riot ID,
  lista de pendentes, definição de posição) com estado local próprio.
- **Props:** `membros` (`Membro[]`), `gradientFrom`, `onClose`,
  `onAddPlayer` (callback que recebe a lista final de membros).
- **Relação com TimePage:** o TimePage mantém `modalConvidar`, `handleUpdatePlayers`
  e os dados (`time.membros`, `time.gradientFrom`), passando apenas o necessário.

## ManageLineupModal

- **Responsabilidade:** gerenciamento do lineup (mudar posição, promover/transferir
  a coroa, expulsar jogador) com estado local próprio.
- **Props:** `membrosIniciais` (`Membro[]`), `gradientFrom`, `onClose`,
  `onUpdateTeam`, `isProprietario`, `podeRemover`, `podePromover`.
- **Relação com TimePage:** o TimePage mantém `modalLineup`, `handleUpdatePlayers`
  e as permissões (`isProprietario`, `userRole`), passando apenas o necessário.
- **Regras:** titular/reserva/coach, máx 3 reservas, 1 por rota, coroa = dono
  (ADR-089). Helpers `sortPlayers` e `getEloColor` vivem neste modal.

## EditTeamModal

- **Responsabilidade:** edição do time (nome, tag, logo, cor, WhatsApp, Discord)
  com estado local próprio e upload de logo.
- **Props:** `team` (`TimeData`), `onClose`, `onSave` (callback `Partial<TimeData>`).
- **Relação com TimePage:** o TimePage mantém `modalEditar` e `handleUpdateTeam`,
  passando o `time` e recebendo o resultado.
- **Helpers locais:** `validarImagem`, `uploadLogoTime` e `COLOR_THEMES` vivem neste modal.

## ConfirmLeaveModal

- **Responsabilidade:** confirmação de saída do time (texto, cancelar, confirmar).
- **Props:** `onClose`, `onConfirm`.
- **Relação com TimePage:** o TimePage mantém `modalSair` e `handleSairTime`; a
  transferência obrigatória de liderança é coordenada pela página/backend.

## Rotas

- `/times` → `equipes.tsx` (público).
- `/times/:id` → `TimePage.tsx` (público; ações de gestão exigem login/cargo).

## Fluxos

- **Listagem:** paginada (20 por página) + pesquisa por nome, ordenada por PDL.
- **Criação:** `api.teams.create`, seguida de upload de logo (`api.teams.update`).
- **Detalhe:** `api.teams.detail(id)` carrega time e elenco (Riot IDs enriquecidos).
- **Elenco/lineup:** `api.teams.saveLineup` grava o lineup; papéis (`Role`) vêm de
  `web/src/components/players/playerMeta.ts`.
- **Saída:** `api.teams.leave`.
- **Liderança:** transferência de dono/capitão tratada no backend (`team-ownership`).

## Riot ID e OP.GG

- `web/src/api/riot.ts` (`buildProfileIconUrl`, `buscarJogadorCompleto`) para
  ícone/nível/puuid.
- `web/src/lib/opgg.ts` (`opGgUrl`) monta o link OP.GG a partir de gameName#tagLine.

## Campeonatos e PDL

- A listagem é ordenada por PDL (`sort: 'pdl'`).
- O detalhe do time expõe `pdl` e `torneio` (vínculo a campeonato).
- PDL é calculado no backend (`api/src/modules/tournaments/tournament-pdl.ts`).

## Endpoints backend (`api/src/modules/teams/routes.ts`)

- GET `/api/teams`, `/batch`, `/members`, `/by-user/:userId`, `/:id`.
- POST `/api/teams`, `/:id/leave`, `/:id/transferir-dono`, `/memberships/remove`,
  `/:id/lineup`, `/:id/stats/adjust`.
- PUT `/:id`.
- Regras em `api/src/modules/teams/team-membership.ts` e `team-ownership.ts`.
- Documentação completa em `api/src/modules/teams/README.md`.

## Dependências compartilhadas

- `web/src/lib/api.ts` (cliente HTTP), `web/src/contexts/AuthContext.tsx`,
  `PerfilContext.tsx`, `web/src/hooks/useSound.ts`,
  `web/src/components/players/playerMeta.ts`.

## Cuidados

- `TimePage.tsx` coordena a página e orquestra os modais; recorte apenas o que
  for responsabilidade independente, sem alterar comportamento/aparência.
- Regras de permissão (quem edita lineup, promove capitão, remove membro) vivem no
  backend — não duplicar no cliente.

Em `web/`, `npm run lint` e `npm run build` verificam tipagem/bundle. Não há suíte
DOM específica de Times; os testes de serviço indicados no
[README backend](../../../../api/src/modules/teams/README.md) não homologam os
modais ou as permissões integradas no navegador.
