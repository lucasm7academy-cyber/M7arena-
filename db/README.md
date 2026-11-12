# Dados — contratos persistidos compartilhados

Schemas Drizzle ficam em `schema/`; a baseline, migrations posteriores e metadados
atuais ficam em [migrations/](migrations/README.md). Não pertencem a uma única página nem devem acompanhar uma
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

## Baseline e manutenção

[0000_baseline.sql](migrations/0000_baseline.sql) cria a estrutura de referência,
com o catálogo inicial LoL/pacotes. Não contém usuários, saldos, partidas, Pix ou
códigos Riot reais. O [README das migrations](migrations/README.md) explica a
âncora do histórico, uso em banco vazio e evolução de bancos existentes.

Uma baseline não é backup de dados. O snapshot JSON atual descreve o schema para
o Drizzle calcular a próxima mudança; o journal ordena as migrations. Há apenas
um snapshot inicial e uma entrada inicial, sem a antiga sequência consolidada.
São metadados ativos da ferramenta, não checkpoints de desenvolvimento.

Ao criar/modificar tabela, atualize o schema TypeScript e gere/revise uma migration
incremental; a reconstrução usa baseline + incrementos. Não sobrescrever a baseline
aplicada a cada alteração, pois o banco existente precisa receber apenas o delta.
Outra consolidação pode reduzir o histórico novamente após prova de equivalência.
Não executar migrations na produção durante organização/documentação.

Testes usam o [helper PGlite](../api/test/helpers.ts) com o migrador real do Drizzle
e o journal, seguido de códigos fictícios em [fixtures](../api/test/fixtures/reference-data.ts).
[baseline.test.ts](../api/test/baseline.test.ts) verifica o catálogo estrutural de
referência, ausência de dados reais, consistência do snapshot e evolução sem
reaplicar a baseline ou perder registros existentes. Não homologa concorrência
PostgreSQL nem autoriza uma migration em produção. [Orientação](../README.md#testes-da-api).
