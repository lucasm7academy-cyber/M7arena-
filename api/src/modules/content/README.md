# Conteúdo

Entrada HTTP de Conteúdo, hoje restrita a highlights. [routes.ts](routes.ts)
exporta `contentRouter`, montado em `/api/content` pelo [bootstrap](../../index.ts).
O router delega `/highlights` ao [router de highlights](highlights-routes.ts),
que concentra os cinco handlers do módulo.

| Método e caminho sob `/api/content` | Contrato atual |
|---|---|
| `GET /highlights` | Público: ativos, ordenados por ordem/data, limite 50. |
| `GET /highlights/all` | Administração: inclui inativos, limite 200. |
| `POST /highlights` | Administração: exige título/link; retorna criado com 201. |
| `PUT /highlights/:id` | Administração: alteração parcial; 404 se ausente. |
| `DELETE /highlights/:id` | Administração: exclusão e resposta `{ ok: true }`. |

Os handlers e validações ficam em `highlights-routes.ts`. O schema é
`db/schema/conteudo.ts`, acessado pelo DB compartilhado. O contrato HTTP usa
`title`, `videoUrl`, `thumbnailUrl`, `active`, `ordem` e `categoria`.
O SDK frontend e [api-content.ts](../../../../web/src/lib/api-content.ts)
adaptam esses campos para a Home e Streams sem modificar o contrato da API.

As operações administrativas chamam `getAdminUser(req, res, ["admin"])` de
[lib/content.ts](../../lib/content.ts). Esse arquivo também exporta `getAuthUser`
e é usado por saques; portanto, é dependência compartilhada de autenticação,
apesar do nome. Permanecem nele sessão/cookie/Bearer, consulta de cargos e
normalização de cargos legados. Não mover ou reescrever essas regras junto com
uma reorganização de Conteúdo.

Preserve prefixos, ordem de montagem, limites, filtros, respostas e autorização.
Notícias e player_stats já não são funcionalidades ativas deste router.

Validação de tipos a partir de `api/`: `npm run build`. Para testes de serviços
relacionados, use a [seleção e o isolamento da API](../../../../README.md#testes-da-api).
Não há teste específico de Conteúdo na árvore atual. A suíte utiliza PGlite;
nunca aponte verificações ou comparadores para o banco de produção.
Comparações HTTP com DB/autorização simulados ajudam a verificar os contratos,
mas não substituem homologação integrada com autenticação e banco reais,
que permanece pendente nesta consolidação.
