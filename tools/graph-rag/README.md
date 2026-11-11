# Graph RAG local — MVP

Ferramenta de desenvolvimento para localizar arquivos, símbolos e documentação
com relações extraídas estaticamente. Gera pacotes de contexto para agentes; não
executa código da aplicação, acessa backend/banco ou altera o produto.

## Uso pelos agentes

O fluxo de [AGENTS.md](../../AGENTS.md) começa pelos [índices](../../docs/INDEX.md),
consulta `status` e `query`, passa pelo README do domínio e recupera trechos com
`context`. Confira símbolos, dependências e consumidores no código atual.
Após mudar fontes ou documentos indexados, execute `build` e confira `status`.
O índice não inclui todo o repositório: complete lacunas com busca textual seletiva.
Essa integração usa somente a CLI e não depende do antigo servidor de status.

## Executar na raiz do projeto

```powershell
node tools/graph-rag/cli.mjs build
node tools/graph-rag/cli.mjs status
node tools/graph-rag/cli.mjs query "inscrição campeonato"
node tools/graph-rag/cli.mjs context "MinhasPartidas"
node tools/graph-rag/cli.mjs visualize
```

Todas as saídas são JSON; erros estruturados saem em stderr com exit 1.
`status` informa `missing` quando ainda não há índice. `query`, `context` e `visualize`
recusam índice ausente, inválido ou desatualizado. Use `build` para reconstruir.
Node e TypeScript Compiler API da raiz já instalada são os únicos requisitos;
esta ferramenta não exige instalação adicional nem servidor MCP.

Opções comuns: `--root <raiz>` e `--cache <diretório externo dedicado>`.
O padrão de cache é `%LOCALAPPDATA%/M7Arena/graph-rag/<hash-da-raiz>`; fora do
Windows, usa LOCALAPPDATA se definido ou o diretório temporário do sistema.
Nenhum índice é escrito no repositório. Cache dentro da raiz ou em um ancestral
dela é recusado. Não use diretório compartilhado com outros arquivos.

```powershell
node tools/graph-rag/cli.mjs build --cache D:/Aplicativos/m7arena-graph-rag-cache
node tools/graph-rag/cli.mjs query "highlights Home" --limit 20
node tools/graph-rag/cli.mjs context "confirmarAposta" --files 6 --lines 160 --hops 1 --bytes 18000 --snippet-lines 32
```

Repita `--cache` nas consultas se usar um diretório diferente do padrão.
`--json` também é aceito. Query por ID é exata: por exemplo
`context "file:web/src/hooks/useSalaRealtime.ts"`.

## Mapa interativo local

Na raiz, gere o índice e depois a página:

```powershell
node tools/graph-rag/cli.mjs build
node tools/graph-rag/cli.mjs visualize
```

O comando devolve JSON com `output` (caminho absoluto do HTML), `url` (`file:///`),
geração, tamanho e contagens. Abra o caminho informado no navegador. No Windows,
também é possível abrir diretamente com o navegador padrão:

```powershell
$mapa = node tools/graph-rag/cli.mjs visualize | ConvertFrom-Json
Start-Process -FilePath $mapa.output
```

O arquivo fica em `<cache>/visualizer/mapa.html`. O cache padrão é o diretório
externo descrito acima; `--cache` é aceito como nos demais comandos. A página é
autocontida: HTML/CSS/JavaScript e os nós/relações reais do índice, sem React,
dependências adicionais, rede, servidor ou MCP. Não executa código do produto nem
lê arquivos de ambiente/banco. A geração valida cache, integridade e frescor antes
de escrever; índice ausente, inválido ou stale é recusado. Nenhum artefato do grafo
é alterado, e o HTML anterior permanece intacto se o índice for recusado.

A abertura mostra os módulos descobertos por diretório, distinguindo API e Web.
O mapa não declara todos esses domínios arquiteturalmente consolidados. Para
arquivos fora dos módulos, use a pesquisa por nome/caminho. Se o índice não tiver
módulos, a abertura mostra até 24 arquivos. A pesquisa da interface é uma busca
local simples por palavras e acentos; não substitui nem muda o ranking da CLI.

- Clique ou Enter seleciona o nó; duplo clique ou Espaço expande seu conteúdo.
- **Expandir conteúdo** revela relações `CONTAINS` de saída; **Ver dependências**
  revela vizinhos diretos nos dois sentidos das demais relações habilitadas.
- **Recolher** remove a expansão daquele nó; conexões ainda alcançáveis por outras
  expansões são preservadas. **Voltar à visão geral** limpa a navegação e os filtros.
- Arraste o fundo para deslocar e os nós para reorganizar. A roda e os botões
  controlam zoom; **Enquadrar** ajusta o mapa à área disponível.
- Filtros distinguem Module/File/Symbol/Document e cada tipo de relação, incluindo
  imports de código, tipo, dinâmicos e documentação. Setas indicam o sentido; tipo
  e documentação também usam linhas tracejadas. Filtrar o tipo de um nó pai pode
  ocultar seu ramo; pesquise o arquivo desejado ou volte à visão geral.
- O painel mostra caminho, origem, resolução, extrator, linhas/hash de evidência,
  relações diretas e READMEs vinculados por relações reais do índice. **Copiar
  caminho** usa clipboard quando disponível, com campo selecionável/Ctrl+C como
  alternativa local. Clicar em uma relação/README foca seu nó no mapa.

Limites: 120 nós e 300 relações desenhados, 24 vizinhos por expansão, 40 resultados
de pesquisa e 60 relações no painel. Contagens/avisos indicam dados ocultos; repita
a expansão para paginar vizinhos ou reduza filtros/libere espaço. O grafo completo
fica nos dados incorporados, mas não é desenhado de uma vez. O painel preserva
proveniência; não infere chamadas, rotas, cobertura ou relações de README ausentes.

O HTML é um retrato validado **no momento da geração**; offline não verifica
alterações posteriores. Depois de mudar fontes/configurações, rode `build` e
`visualize` novamente e reabra/recarregue o HTML. O comando substitui somente o
HTML nesse cache, sem criar versões ou checkpoints. Nomes/caminhos são tratados
como dados (JSON escapado e `textContent`); CSP restringe scripts ao bundle local
com hash e bloqueia conexões de rede.

## O que é indexado

- Código TS/TSX/JS em `web/src`, `api/src`, `api/test` e `db/schema`.
- `docs/INDEX.md`, `docs/modules/INDEX.md`, READMEs de features/módulos e de testes frontend.
- Configurações TypeScript reais para resolução, inclusive aliases e imports
  `.js` da API com fonte `.ts`. Hashes de configs/manifests/locks são metadados
  de frescor; esses arquivos não viram contexto de código.

Dependências, dist, .git, caches, assets, binários, arquivos de credenciais/env,
históricos, documentos gerados de status e o MCP legado ficam fora do índice.
Symlinks de fontes não são seguidos. A exclusão é por caminho/formato e não é
uma auditoria de credenciais eventualmente embutidas em código.

Quatro tipos: Module, File, Symbol, Document. Relações: CONTAINS, IMPORTS,
IMPORTS_TYPE, IMPORTS_DYNAMIC literal, EXPORTS, ALIASES resolvidos e
DOCUMENTED_BY. Named/default, reexports e símbolos homônimos preservam identidade
por caminho/nome qualificado. Um módulo descoberto não é declarado consolidado.

Evidências incluem caminho, linhas, hash, origem, resolução e versão do extrator.
Aliases de busca vindos de links/linhas de tabela conservam sua evidência
documental. Relação documental é `declared`; não prova execução. Tipos não são
tratados como imports runtime. Não há adaptadores HTTP, SDK, schema, cobertura
de testes, callbacks ou WebSocket, nem relações CALLS inferidas por nomes.

## Recuperação e limites

Busca nomes, caminhos, símbolos, headings e aliases documentais explícitos, com
normalização de acentos, plurais e separadores. Usa afinidade de módulo comprovada
por diretório e referências documentais, especificidade dos aliases e intenção
genérica de criação/remoção/atualização/apresentação. Não contém caminhos de
resposta para perguntas conhecidas. Declarações relevantes são selecionadas no
meio do arquivo; fontes grandes não recebem preferência apenas por repetição.
Consulta exata de símbolo prioriza sua declaração; homônimos continuam distintos.
Expande relações diretas e reversas com
hops limitados. Pontuação e expansão são heurísticas, não prova de relevância.
Perguntas amplas podem recuperar outros domínios com vocabulário semelhante.
Use resultado como navegação e refine por arquivo/símbolo quando necessário.

`context` retorna intervalos de linhas com hashes, semente, relações/evidências e
trechos. Padrões: seis arquivos, 160 linhas totais, um hop, 18.000 bytes de JSON
completo e até 32 linhas por trecho. Limites são globais; `--snippet-lines`
controla o tamanho local. `truncated` informa corte ou expansão limitada.
Arquivos pequenos podem caber inteiros; arquivos grandes não são despejados.
Limites máximos: 50 arquivos, 2.000 linhas, três hops, 1 MB e 200 linhas/trecho.

O pacote não substitui leitura adicional quando faltar o handler pretendido.
Gaps, diagnósticos e resultados fora do domínio precisam de revisão do agente;
nenhuma cobertura ou autorização é deduzida de um import de teste ou da UI.

## Persistência e frescor

Gerações contêm manifest.json, nodes.jsonl, edges.jsonl e diagnostics.json.
IDs/grafo são determinísticos para as mesmas fontes/configs/extrator. A publicação
valida artefatos antes de trocar atomicamente current.json e preserva a geração
anterior em falha. Build usa lock exclusivo; não remove lock de outro processo.
Gerações e staging incompleto são conservados para diagnóstico, sem limpeza automática.

Frescor usa hashes de fontes/configs, versão/hash do extrator e Compiler API;
HEAD sozinho não basta. Arquivos novos não rastreados também são enumerados.
Renomeação aparece como remoção + adição. Git é metadado opcional: sem repositório
Git, a detecção por conteúdo funciona e estado tracked fica desconhecido.
Trechos são lidos das fontes atuais e revalidados. Não há atualização incremental
complexa: `build` reconstrói tudo. Fontes/configs alteradas exigem nova construção.

Cache inválido é recusado por esquema, hashes, alvos e confinamento. Preserve-o
para diagnóstico e use outro `--cache` dedicado quando necessário; não execute
limpeza ampla da raiz. A ferramenta não modifica regras do agente ou legados.

## Testes permanentes

Execute a suíte ao alterar o indexador, busca, persistência ou visualizador.
Para reorganizar apenas fontes do produto, reconstruir e conferir as consultas
afetadas é proporcional; não repetir testes da ferramenta por toda edição documental.

```powershell
node --test tools/graph-rag/tests/graph.test.mjs tools/graph-rag/tests/storage.test.mjs tools/graph-rag/tests/search.test.mjs tools/graph-rag/tests/relevance.test.mjs tools/graph-rag/tests/real-queries.test.mjs tools/graph-rag/tests/visualize.test.mjs
```

Fixtures temporárias locais cobrem resolução, tipos, exports/aliases, homônimos,
proveniência, exclusões, determinismo, busca, vizinhos diretos/reversos, CLI real,
limites, fontes novas/modificadas/removidas/renomeadas, stale, configs, cache
corrompido, publicação interrompida, lock e confinamento de junctions. Regressões
de relevância incluem perguntas novas em fixtures e as cinco consultas reais do
projeto, com declarações/handlers esperados. Dados dessas consultas ficam somente
nos testes; não participam do algoritmo. Não usam rede, banco ou dependência nova.
Cleanup apaga apenas o diretório temporário criado pelo próprio helper, validado.

`visualize.test.mjs` cobre geração/CLI real, equivalência dos nós/relações, bundle
offline e CSP, dados hostis, proveniência/README, pesquisa/filtros, expansão e
recolhimento, limites e rejeição de cache ausente/corrompido/stale ou saída via
junction. Testes de modelo não substituem verificação interativa no navegador.

Smoke opcional com o grafo real, usando um Chrome/Edge **já instalado** em processo
headless e perfil temporário isolado, sem CDP, servidor ou instalação:

```powershell
node tools/graph-rag/tests/browser-smoke.mjs "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

O smoke exercita a interface no navegador (abertura, pesquisa, seleção, expansão,
linhas, filtros, proveniência, zoom, recolhimento e retorno à visão geral), valida
o bundle/CSP real e salva `preview.png` junto do HTML. Usa uma cópia temporária do
HTML acrescida somente das asserções de teste; o HTML entregue não contém esse
harness. O perfil e os arquivos temporários são removidos ao concluir. Não cobre
arraste físico nem permissões do clipboard do navegador habitual do proprietário.

Estrutura: [scope](scope.mjs), [extrator](extract.mjs), [documentos](documents.mjs),
[indexador](indexer.mjs), [persistência](storage.mjs), [busca](search.mjs) e
[CLI](cli.mjs), [gerador visual](visualize.mjs) e [interface offline](viewer/).
A integração operacional está no guia de agentes; não há servidor
MCP, chamadas de rede nem necessidade de serviços da aplicação.
