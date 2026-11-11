# Módulo de Times — backend

Memória técnica do backend de times (listagem, criação, elenco/lineup, liderança).

## Responsabilidade

Endpoints de times e regras de participação (membros/convidados) e propriedade
(coroa/dono). Não inclui cálculo de PDL nem inscrições em campeonatos (outros
módulos importam as regras daqui).

## Arquivos

- `routes.ts` — endpoints HTTP (mount `/api/teams`).
- `team-membership.ts` — regras de participação (membros, convidados, um time só,
  vínculo por Riot ID, transferência de jogador).
- `team-ownership.ts` — regra de propriedade/liderança (quem tiver a coroa é o dono).

## Endpoints (routes.ts)

| Método | Rota | Papel |
|---|---|---|
| GET | `/api/teams` | listagem (busca/paginação, sort pdl) |
| GET | `/api/teams/batch` | vários times por ids |
| GET | `/api/teams/members` | membros por user_ids |
| GET | `/api/teams/by-user/:userId` | times do usuário |
| GET | `/api/teams/:id` | detalhe do time |
| POST | `/api/teams` | criação |
| PUT | `/api/teams/:id` | edição |
| POST | `/api/teams/:id/leave` | sair do time |
| POST | `/api/teams/:id/transferir-dono` | transferir dono |
| POST | `/api/teams/memberships/remove` | remover membro |
| POST | `/api/teams/:id/lineup` | salvar lineup |
| POST | `/api/teams/:id/stats/adjust` | ajuste de estatísticas |

## Funções principais

- `team-membership.ts`: `findUserTeamMemberships`, `sairDeOutrosTimes`,
  `resolverUserIdPorRiotId`, `transferirJogadorParaTime`, `vincularVagasConvidado`,
  `getRiotIdentities`.
- `team-ownership.ts`: `resolverNovoDono`.

## Regras a preservar

- **Um time só (ADR-087):** um jogador participa de um time por vez
  (`sairDeOutrosTimes`).
- **Convidado sem conta (ADR-056):** o roster pode ter vagas `guest_*` sem user_id;
  o vínculo é resolvido por PUUID/Riot ID (`resolverUserIdPorRiotId`,
  `vincularVagasConvidado`).
- **Coroa = dono (ADR-089):** o `owner_id` segue quem está coroado (capitão com
  conta); dono que perde a coroa/sai do lineup deixa de ser dono
  (`resolverNovoDono`). Coroa em convidado não troca o dono.

## Tabelas

- `teams`, `team_members`, `team_stats` (fonte `db/schema/teams.ts`; imports
  TypeScript usam o sufixo de runtime `.js`).
- `users`, `user_sessions`, `user_roles` (`identidade`)
- `game_accounts` (`games`)
- `tournaments`, `tournament_matches`, `bracket_matches` (`tournaments`)

## Integração com usuários e campeonatos

- Sessão/usuário: `getAuthUser` local em `routes.ts` (cookie `m7_session` ou Bearer); tabelas
  de identidade e `game_accounts` para Riot ID/PUUID.
- Campeonatos: o módulo não faz inscrição; `tournament-access.ts` importa
  `findUserTeamMemberships` para checar vínculo de time nas regras de campeonato.

## Dependências externas

- `team-membership.ts` é importado por `sala-campeonato.ts`, `tournament-access.ts`,
  `verificar-partida.ts` e `modules/profiles/routes.ts`.
- `team-ownership.ts` é importado por `routes.ts` (dentro do módulo).
- Montado em `api/src/index.ts` sob `/api/teams`.
- Testes: `api/test/team-membership.test.ts`, `team-ownership.test.ts`,
  `tournament-access.test.ts`.

Use os [comandos e isolamento da API](../../../../README.md#testes-da-api) para
esses arquivos. Eles validam serviços e acesso; não são uma suíte HTTP de todos
os handlers nem homologação da interface de Times.
