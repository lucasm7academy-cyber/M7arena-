# Integrações HTTP compartilhadas e entrada inativa

Os routers funcionais estão em [modules](../modules/). Aqui permanecem integrações
transversais, montadas pelo [bootstrap](../index.ts), e um router não montado.

| Arquivo | Montagem / responsabilidade |
|---|---|
| [riot.ts](riot.ts) | `/api/riot`: proxy servidor → Riot/DDragon; fornece também `riotRaw` aos motores backend, caches e estatísticas. |
| [upload.ts](upload.ts) | `/api/upload`: imagem autenticada para volume local, permissão por bucket/dono e otimização de imagem. |
| [og.ts](og.ts) | `/api/og`: HTML Open Graph de sala para crawlers; roteamento de bots é feito no Nginx. |
| [tierlists.ts](tierlists.ts) | Exporta tierlistsRouter, mas não é montado. Código relacionado está [documentado como inativo](../../../web/src/features/m7-academy-tierlist/README.md). |

## Contratos ativos

Riot registra `GET /version`, `/account/:gameName/:tagLine`, `/summoner/:puuid`,
`/league/:puuid`, `/matches/:puuid`, `/match/:matchId` e `/stats/:puuid` sob
`/api/riot`. `riotRaw` é serviço interno reutilizado por verificações e jobs,
sem objeto Express de resposta. A chave fica exclusivamente no servidor.
Cache de estatísticas e limites de lote são implementados no router; frontend
acessa por `web/src/api/riot.ts`, sem credencial Riot.

Upload registra `POST /api/upload`, com parsers/validações existentes de imagem;
confira o contrato multipart no SDK ao alterar um consumidor.
`team-logos` valida dono/capitão/proprietario; `public-images` valida cargo global.
O [README raiz](../../../README.md#uploads-e-autorização) descreve as permissões.
O router cria pastas ao importar; não trate esse import como operação sem efeitos.

OG registra `GET /api/og/:modo/:id` e gera preview de sala/participantes. Assets e modo devem
continuar alinhados aos caminhos do frontend e ao proxy; não é a tela da sala.

## Verificação

Build valida imports; `api/test/upload-permissao.test.ts` e
`upload-otimizacao.test.ts` cobrem helpers, não todo HTTP/disco/proxy. Testes Riot
de serviços usam mocks. Conferir documentação não exige executar essas integrações
nem chamar gateway, Riot ou banco reais. Infraestrutura fica em `infra/`.
