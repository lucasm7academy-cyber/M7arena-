# Campeonatos — backend HTTP

## Responsabilidade e entrada

Expõe listagem/detalhe, criação e edição, inscrições, cronograma, classificação,
chaves e operações de séries/salas de campeonatos. A entrada é
[`routes.ts`](./routes.ts), que exporta somente `tournamentsRouter`.
O [bootstrap](../../index.ts) monta esse router em `/api/tournaments`, mantendo
o processamento global de CORS, JSON e cookies no bootstrap.

O módulo começou com a movimentação física da rota existente. Os handlers e
helpers locais continuam juntos no arquivo herdado; não foram reescritos nem
divididos para acompanhar a mudança de pasta.

## Contratos HTTP existentes

Caminhos abaixo são relativos a `/api/tournaments`; a ordem é a do registro.

| Método | Caminho | Operação |
|---|---|---|
| GET | `/` | Lista completa ou vistas `card`/`agenda`; filtros status, criado_por e ids, ordenação. |
| GET | `/:id` | Documento completo com redação dos códigos conforme acesso. |
| GET | `/:id/shell` | Escalares e resumo para abertura do detalhe. |
| GET | `/:id/cronograma`, `/:id/classificacao`, `/:id/grupos`, `/:id/chaves` | Quatro seções registradas pelo mesmo loop. |
| POST | `/` | Criação com organizador obtido da sessão e título obrigatório. |
| PUT | `/:id` | Atualização parcial dos escalares/blocos enviados. |
| DELETE | `/:id` | Exclusão e recálculo de PDL após o cascade. |
| POST | `/:id/inscricoes` | Inscrição pelo dono do time ou staff. |
| POST | `/:id/inscricoes/:teamId/aprovar` | Aprovar/rejeitar via `p_aprovar`. |
| DELETE | `/:id/inscricoes/:teamId` | Remover inscrição e classificação correspondente. |
| POST | `/:id/reabrir` | Reabrir: grava o status persistido `open`. |
| PUT | `/:id/cronograma` | Substituir cronograma e aplicar desempates automáticos. |
| PUT | `/:id/cronograma/merge` | Mesclar jogos; participante só negocia horário do próprio jogo. |
| POST | `/:id/recalcular-pdl` | Recalcular PDL global a partir dos jogos finalizados. |
| POST | `/:id/jogo/:matchId/gerar-codigo` | Atribuir código à série e iniciá-la. |
| POST | `/:id/jogo/:matchId/verificar` | Disparar verificação da série. |
| POST | `/:id/jogo/:matchId/sala` | Criar/recuperar a sala da série. |

São 20 registros HTTP ao expandir as quatro seções. As respostas mantêm o shape
legado snake_case consumido pelo frontend; os mapeamentos não mudam com a pasta.

## Regras que precisam ser preservadas

- O helper local `getAuthUser` aceita cookie de sessão ou Bearer e verifica a
  validade da sessão. Não é um middleware universal de autorização: cada handler
  aplica suas verificações próprias. Criar exige sessão e título, atribuindo o
  organizador ao usuário; não presumir uma checagem extra de cargo nessa rota.
- Edição, aprovação, reabertura, cronograma e PDL usam
  `podeGerenciarCampeonato`. Exclusão e remoção de inscrição fazem as verificações
  locais de organizador/admin/proprietário. Não uniformizar essas regras numa movimentação.
- Dono do time inscreve o próprio time somente com inscrições abertas. Aprovação
  e pagamento enviados por não staff são substituídos por registered/paid=false.
- O merge de horário valida vínculo à série e deriva status/proposedBy no
  servidor. Participante não cria jogos, não altera resultado e não reabre jogo confirmado.
- Código, verificação e sala resolvem a série dentro do campeonato e exigem
  staff ou participante. A verificação também passa `permitirStreamer: true`.
- Leitura completa/cronograma/chaves redige códigos para quem não pode vê-los.
  Preserve os cabeçalhos de cache: card/agenda públicos; documento completo e
  seções protegidas com políticas privadas conforme o handler atual.
- Desempates usam chaves determinísticas; PDL vem do serviço próprio. Preservar
  códigos HTTP, mensagens, sanitizações e ordem das operações ao recortar handlers.

## Dependências e fronteiras atuais

| Local ainda existente | Responsabilidade utilizada |
|---|---|
| [tournament-shape](./tournament-shape.ts) | Shapes, tags, shell/seções, cronograma e resumo de inscritos; contratos de resposta consolidados neste módulo. |
| [tournament-store](./tournament-store.ts) | Escrita de blocos, inscrições, cronograma, bracket e remoção de inscrição; persistência consolidada no módulo. |
| [tournament-access](./tournament-access.ts) | Identidade, gestão, vínculo à série e redação de códigos; integra Times e já pertence a este módulo. |
| [tournament-pdl](./tournament-pdl.ts) | Recálculo global de PDL, vitórias, derrotas e ranking; serviço já consolidado neste módulo. |
| [tournament-tiebreakers](./tournament-tiebreakers.ts) | Inclusão de desempates; responsabilidade já consolidada neste módulo. |
| [serie-campeonato](../../lib/serie-campeonato.ts) | Códigos, best-of e verificação de resultados via integração Riot. |
| [sala-campeonato](../../lib/sala-campeonato.ts) | Criação e recuperação da sala da série; integra Times, Streams e Draft. |
| [db](../../db.ts), [schema](../../../../db/schema/) | Conexão e tabelas de identidade, campeonatos e times. |

Não há import direto deste router por cron ou realtime. Esses serviços consomem
outros helpers de séries/salas. Streams, Draft e verificação Riot são integrações
indiretas nesta entrada; não mover seus serviços junto com o arquivo HTTP.
O ciclo já existente entre serviços de série e sala requer atenção em recortes
posteriores; a movimentação da rota não muda os destinos de suas dependências.

## Critérios de desempate

[`tournament-tiebreakers.ts`](./tournament-tiebreakers.ts) exporta a função pura
`appendTiebreakers` e os contratos `LegacyCronogramaJogo`/`LegacyTournament`.
O router chama a função ao aplicar desempates automáticos; o teste direto é
`api/test/tiebreakers.test.ts`. O arquivo não importa serviços nem acessa banco.

Preservar a ordenação atual (vitórias decrescentes, derrotas e partidas crescentes), o empate
na fronteira de classificação e o limiar de dois classificados somente no formato
`grupos_16_4_2` (um nos demais). A regra espera os jogos regulares do grupo
terminarem, ignora fase final/chaves/desempates e não duplica um par já existente.
Quando necessário, acrescenta jogo `combinando`, com `A COMBINAR`/`--:--`, sem
mutar o cronograma original. As formas existentes de grupos e inscritos e os
retornos antecipados fazem parte do contrato; não normalizar dados ao mover.

Os serviços de série/sala e suas integrações continuam em `api/src/lib/`.
Esta consolidação não muda
classificação, resultados, PDL ou persistência dos jogos de desempate.

## Serviço de PDL

[`tournament-pdl.ts`](./tournament-pdl.ts) exporta `recalcularPdlGlobal(d)` e o
contrato `ResultadoPdl` (`times`, `jogos`). Usa a conexão padrão quando não recebe
o banco/transaction do chamador. Seus consumidores são este router,
o store deste módulo, `serie-campeonato.ts` ainda em `lib/`, e o teste
`api/test/tournament-pdl.test.ts`. Não importa a entrada HTTP nem esses consumidores.

O recálculo é global e parte do zero: conta somente jogos finalizados válidos,
ignora empate, ausência de placar, time não resolvido e chave visual; resolve
times por id ou pela tag quando o id está ausente. Preservar +15 por vitória,
-13 por derrota, clamp final em zero e ranking por PDL/vitórias decrescentes e
tag crescente. O serviço faz upsert sequencial de `team_stats` na temporada `s1`
e devolve as quantidades processadas. A transação pertence ao chamador quando
ele injeta `d`; o serviço não cria uma transação própria. Não transformar esse
recálculo em incremental nem mudar a ordem de gravação durante movimentações.

Os três testes específicos conferem pontuação/filtros, ranking e idempotência
com PGlite isolado. Classificação de UI e cálculo de desempates são contratos
distintos; consolidar os arquivos não autoriza mesclar algoritmos ou alterar regras.

## Regras de acesso

[`tournament-access.ts`](./tournament-access.ts) concentra os predicados de
Campeonatos, sem autenticar sessões nem fornecer middleware global. A identidade
autenticada continua vindo do chamador. Usa schemas e
`findUserTeamMemberships` de Times; não depende do router, PDL, shape ou store.

- `identidadeAcessoCampeonato` reúne cargos e ids de times do dono/membro aceito,
  incluindo o vínculo de convidado reconhecido por Times.
- `podeGerenciarCampeonato` aceita organizador dono ou cargos globais do contrato
  `STAFF_ROLES_CAMPEONATO`: admin, proprietario, moderador e organizer.
- `acessoNoCampeonato` combina essa identidade com o organizador do campeonato.
- `redigirCodigosDaSerie` muta o shape de resposta, ocultando códigos de séries
  alheias no cronograma/brackets. Staff mantém os códigos; tags fora dos inscritos
  ficam redigidas. Preservar normalização e recursão existentes.
- `timeDoUsuarioNaSerie` devolve A/B/null para o vínculo ao time; isso não concede
  poderes de staff. `resolverPermissaoSerie` separa isStaff/isParticipant e só
  considera streamer como staff quando `permitirStreamer` for passado.

Consumidores: router deste módulo e testes `tournament-access.test.ts` e
`tournament-shape.test.ts`. Os testes cobrem donos, membros aceitos, convidados,
pendentes/estranhos, staff, organizador, streamer condicionado e redação de códigos.
Não unificar esses predicados com autenticação ou alterar permissões durante uma
movimentação. `IdentidadeAcesso`, assinaturas, exceções e retornos são contratos.

## Contratos de resposta

[`tournament-shape.ts`](./tournament-shape.ts) concentra as conversões de
status/formato, loaders e builders que recompõem as respostas legadas. Seu
consumidor runtime é o router; os testes de shape, classificação, bracket e
série também o usam, inclusive por imports dinâmicos no teste de série.
Depende de db e schemas, sem importar o router ou outros serviços do domínio.

Principais contratos: `statusToLegacy/statusToNew`, `formatToLegacy/formatToNew`,
`cronogramaStatusToLegacy`, `loadTournamentData/Shell/Tags/Section`,
`buildTimesInscritos`, `buildTimesInscritosResumo`, `buildCronograma`,
`buildClassificacao`, `buildGrupos`, `buildBracket` e as vistas
`toLegacyTournament/Card/Shell/Section/List`. `TournamentSection` identifica as
quatro seções. Preserve os nomes snake_case, defaults e limites entre as vistas.

O card evita seções pesadas; o shell também omite a foto da organização; cada
seção busca somente os dados necessários. O documento completo conserva campos
administrativos. A classificação usa todos os times aprovados, deriva jogos
finalizados quando presentes e mantém o fallback manual existente. Grupos e
brackets preservam snapshots de tags/ids, lados/rodadas e valores ausentes.
Não mudar algoritmos, critérios de ordenação ou tratamento de null ao movimentar.
O redator de códigos continua separado no serviço de acesso e é aplicado pelo
router; o compositor de payload não substitui essa autorização.

O arquivo herdado foi movido inteiro, sem divisão ou alteração de funções.
Os serviços compartilhados de série/sala continuam fora do módulo e exigem
avaliação própria antes de qualquer movimentação.

## Persistência dos blocos

[`tournament-store.ts`](./tournament-store.ts) decompõe o payload legado nas
tabelas relacionais. Exports: `jogoConfirmadoSemHorario`, `storeTimesInscritos`,
`removerInscricao`, `storeCronograma`, `storeBracket`, `storeGrupos`,
`storeClassificacao` e `storeLegacyWrites`. O consumidor runtime é o router;
testes de agendamento, inscrição, bracket, Streams e série também o usam.

`removerInscricao`, `storeCronograma` e `storeBracket` aceitam conexão/transação
injetada; os demais escritores usam a conexão padrão existente. Não padronizar
essas assinaturas ou introduzir transações durante movimentações. O coordenador
`storeLegacyWrites` só toca os blocos presentes no body e mantém a ordem atual.

Preservar merge/replace por match_key, campos ausentes e defaults, liberação e
conservação de códigos, best-of e a codificação de lados/rodadas do bracket.
Finalização de cronograma chama encerramento de transmissão e de sala quando
aplicável, e o PDL é recalculado ao final. A remoção de inscrição também remove
sua classificação. Grupos/inscrições/classificação conservam seus upserts e
resolução de time por id/tag, sem alterar regras de autorização do router.

Integrações: PDL interno; `normalizarBestOf` e encerramento de sala ainda em
`lib/`; encerramento de transmissões no módulo Streams. O grafo contém um ciclo
preexistente entre serviços de sala/série/verificação; o store não integra esse
componente e sua movimentação não autoriza reorganizá-lo. Conservar efeitos,
ordem de operações e erros, inclusive em testes de W.O. e merge de resultados.

## Validação local

Sem instalar dependências, em `api/`:

```powershell
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:9/m7arena_test'
$env:RIOT_API_KEY=''
npm.cmd run build
```

A suíte usa PGlite isolado e migrations de teste no helper existente. Não apontar
testes para produção; conexões auxiliares de notificação devem ser isoladas também.
Os arquivos `tournament-*.test.ts`, `tiebreakers.test.ts`, `serie-campeonato.test.ts`,
`sala-campeonato*.test.ts`, `streams.test.ts` e `team-membership.test.ts` cobrem
serviços/consumidores relacionados; não são uma homologação HTTP de todos os handlers.
Selecione os testes conforme o fluxo alterado. Documentação pede conferência de
conteúdo/links; movimentação sem mudança de lógica pede comparação e build.
Na raiz, `git diff --check` confere o diff. No frontend, `npm.cmd run lint` e
`npm.cmd run build` conferem tipagem e bundle sem comprovar interação visual.

## Frontend relacionado

Consulte o [README de Campeonatos frontend](../../../../web/src/features/campeonatos/README.md)
para páginas, contexto, modais e contratos de UI. O ponto de entrada backend
atual é este módulo.

## Sorteio operacional de copas

O [script atual](../../../../scripts/campeonatos/sortear-semana.mjs) usa `pg` e
`DATABASE_URL` no ambiente da API. Seleciona campeonatos `groups/in_progress`,
filtrando nome/slug pelo argumento (`kraken`, `tesouro` ou sem filtro).
Busca times aprovados e considera todos os confrontos já existentes, inclusive
pendentes, para não repetir pares. Requer quantidade par de times, no mínimo quatro.

O algoritmo tenta duas rodadas de adversários inéditos, com os fallbacks e
limites do código atual. Sem arestas para uma rodada completa, interrompe essa
parte do sorteio; não contorne o guard com INSERT manual.

Em uma operação expressamente autorizada, confirme o campeonato pela API e
faça primeiro a prévia, após disponibilizar o script em `/app`:

```text
docker exec -w /app m7arena_app node sortear-semana.mjs kraken --dry-run
```

O `--dry-run` retorna antes da transação de escrita. A aplicação sem essa flag
exige autorização para aquela copa/lote; grava jogos `group_stage/combinando`,
`A COMBINAR`/`--:--`, `best_of=3` e chaves próprias. A transação valida a contagem
inserida e a ausência de pares duplicados, com rollback em erro.
Valide o cronograma pela API depois de aplicar. Não use IDs ou contagens de uma
rodada passada como prova da situação atual e não execute o sorteio como teste.
