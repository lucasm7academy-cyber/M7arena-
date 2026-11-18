# Documentação atual do M7Arena

A documentação Markdown própria usa somente `AGENTS.md`, `INDEX.md` e `README.md`.
Cada documento tem uma responsabilidade; regras antigas não são mantidas em
arquivos paralelos. Código atual confirma o comportamento descrito.

## Comece por aqui

1. [AGENTS.md](../AGENTS.md): como localizar, implementar modularmente, verificar
   e manter README/índice/grafo sincronizados.
2. [Mapa das 12 áreas do produto](modules/INDEX.md): páginas ativas, donos HTTP,
   relações entre funcionalidades e código sem entrada ativa.
3. README da funcionalidade: contexto, estrutura, regras/contratos, consumidores,
   dependências e limites. Leia antes de alterar aquela área.
4. [Graph RAG](../tools/graph-rag/README.md): localização técnica de arquivos e
   símbolos; complementa o mapa, sem substituir a leitura do domínio.

## Contexto compartilhado e operação

Para visualizar os caminhos reais, abra a [árvore de arquivos autogerada](ARVORE.txt).
Ela complementa o mapa funcional; não substitui índices ou READMEs.

| Assunto | README dono |
|---|---|
| Arquitetura, árvore, integridade e implantação | [Projeto](../README.md) |
| Providers, layout, SDK, componentes e hooks comuns | [Frontend](../web/src/README.md) |
| Salas, séries, Draft, elegibilidade e outros serviços comuns | [Serviços da API](../api/src/lib/README.md) |
| Proxy Riot, uploads e preview social | [Integrações HTTP](../api/src/routes/README.md) |
| WebSocket, chat e preview de Draft | [Realtime](../api/src/realtime/README.md) |
| Schemas, baseline e migrations | [Dados](../db/README.md), [baseline e evolução](../db/migrations/README.md) |
| Componentes visuais, recortes e VIP | [UI](../web/src/components/ui/README.md) |
| Scripts operacionais e sorteio de copas | [Scripts](../scripts/README.md); contrato do sorteio em [Campeonatos](../api/src/modules/tournaments/README.md#sorteio-operacional-de-copas) |
| Otimização de imagens e diagnóstico de bordas | [Ferramentas frontend](../web/scripts/README.md) |
| Testes React/DOM | [Testes DOM](../web/src/test/README.md) |
| Seleção e isolamento dos testes backend | [Testes da API](../README.md#testes-da-api) |
| Busca e visualizador técnico | [Graph RAG](../tools/graph-rag/README.md) |

## Alcance do mapa e do grafo

O índice de funcionalidades foi organizado por rotas/consumidores atuais, sem
transformar cada arquivo/símbolo em uma funcionalidade. O visualizador técnico
ainda trabalha com diretórios, arquivos e símbolos; sua simplificação visual
continua sendo etapa separada deste mapa.

O indexador cobre o código de `web/src`, `api/src`, `api/test` e `db/schema` e a
documentação Markdown do projeto (`AGENTS.md`, `INDEX.md` e `README.md`) em
diretórios não excluídos. `fresh` confirma essas fontes, não o repositório
inteiro: scripts executáveis, configuração, infraestrutura e SQL ficam fora do
grafo e exigem leitura direta.

Para consultas, use `status` e reconstrua com `build` quando necessário; depois
`query`/`context` seletivos. Ausência de resultado exige consulta direta ao código,
não invenção de uma implementação nem duplicação de uma já existente.
