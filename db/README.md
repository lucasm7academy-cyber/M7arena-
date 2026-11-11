# Dados — contratos persistidos compartilhados

Schemas Drizzle ficam em `schema/`; migrations SQL versionadas e seus metadados
em `migrations/`. Não pertencem a uma única página nem devem acompanhar uma
movimentação de router. Conexão da API em `api/src/db.ts`; Realtime usa pg próprio.

| Schema | Responsabilidade / domínios consumidores |
|---|---|
| [identidade](schema/identidade.ts) | Usuários, sessões, cargos, carteira e Pix privado; Conta, Perfis, Economia e autorização dos demais domínios. |
| [games](schema/games.ts) | Contas de jogo, PUUID/handle e metadata; Perfis, Jogadores, Times e verificações. |
| [teams](schema/teams.ts) | Times, membros, convidados e estatísticas. |
| [tournaments](schema/tournaments.ts) | Torneios, inscrições, grupos, cronograma e brackets. |
| [matches](schema/matches.ts) | Salas, vagas, códigos, Draft e estados; Campeonato e scrim também os utilizam. |
| [bets](schema/bets.ts) | Bilhetes individuais e legs. |
| [economia](schema/economia.ts) | Pacotes, pagamentos, ledger e saques; os motores de reserva/liquidação continuam no servidor. |
| [conteudo](schema/conteudo.ts) | Highlights, transmissões/agenda e notificações persistentes. |
| [apostas](schema/apostas.ts) | Inclui advertências usadas pela elegibilidade/Admin; nome não significa domínio exclusivo de desafios. |
| [retencao](schema/retencao.ts) | Estruturas persistidas de retenção; presença no schema não prova uma página/fluxo ativo. |
| [tierlist](schema/tierlist.ts) | Submissões do código Tierlist sem rota ativa. Não remover dados/migrations pelo estado da UI. |

O índice de [funcionalidades](../docs/modules/INDEX.md) aponta os serviços/routers
que usam esses contratos. Schema define armazenamento; README do domínio descreve
a regra efetivamente aplicada. Não inferir autorização ou atomicidade só da tabela.

Mudança de schema exige migration versionada que preserve dados e reconstrua o
banco. Metadados `*_snapshot.json` são artefatos de migrations, não checkpoints
de desenvolvimento nem documentação antiga a excluir. Não editar ou executar
migrations em produção como parte de organização/documentação.

Testes de serviço usam [helper PGlite](../api/test/helpers.ts) isolado e um conjunto
de migrations selecionado pelo helper; isso não homologa toda a cadeia de deploy
ou concorrência PostgreSQL. [Orientação de testes](../README.md#testes-da-api).
