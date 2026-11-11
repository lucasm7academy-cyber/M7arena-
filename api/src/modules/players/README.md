# Jogadores — catálogo público e refresh administrativo

[routes.ts](routes.ts) exporta `playersRouter`, montado em `/api/players`.
Consulta contas LoL, seus caches e metadados de apresentação. Atualização de elo
em lote é uma operação administrativa separada da leitura pública.

| Método / caminho relativo | Contrato |
|---|---|
| `GET /search` | Pesquisa contas por handle; apoio a vínculo/elenco. |
| `GET /by-ids` e `POST /by-ids` | Lote de contas por UUIDs de usuário; mesmo helper e shape legado. |
| `GET /by-puuid/:puuid` | Consulta conta LoL por PUUID. |
| `GET /count` | Contagem de contas LoL. |
| `GET /filtrados` | Catálogo público; p_offset, p_limit, p_search, p_elo_tier e p_role_lane; shape plano com total_count. |
| `POST /refresh-elos` | Sessão admin/proprietario; inicia job e responde 202, sem esperar a varredura. `force:true` ignora TTL. |
| `GET /refresh-elos/status` | Mesma autorização administrativa; andamento do job. |

A lista lê `game_accounts.metadata.elo_cache`; não consulta a Riot por jogador
no carregamento. O filtro de elo usa SoloQ; lane é filtrada após a paginação,
enquanto total_count vem da consulta anterior à lane. Documentar essa limitação
é diferente de modificar paginação ou critérios de ranking.

`/filtrados` conserva campos legados tier/soloQ/flexQ, lanes, VIP, PUUID e rank
derivado do offset. `mc` é placeholder zero, não uma leitura pública de carteira.
Busca/listagem não concedem acesso a saldos de outros usuários.

## Dependências e consumidores

[atualizar-elos.ts](../../lib/atualizar-elos.ts) mantém TTL, pacing e single-flight;
[reconciliar-handles.ts](../../lib/reconciliar-handles.ts) mantém dados da identidade
Riot. Ambos são chamados também pelo bootstrap/jobs e permanecem compartilhados.
Falha de Riot deve preservar cache; os testes existentes cobrem esse contrato.

[Catálogo frontend](../../../../web/src/features/players/README.md), Times,
Administração e Vincular usam o SDK `players`; os metadados de UI são
compartilhados com Times. Não mover esses consumidores para dentro do catálogo.

Build verifica imports/tipos. `api/test/atualizar-elos.test.ts`,
`reconciliar-handles.test.ts` e `riot-queues.test.ts` cobrem os serviços simulados;
veja o [isolamento](../../../../README.md#testes-da-api). Não há cobertura HTTP
completa do catálogo; não dispare refresh real para validar uma reorganização.
