# Scripts operacionais e ferramentas do projeto

## Árvore de arquivos

[gerar-arvore.mjs](gerar-arvore.mjs) gera [docs/ARVORE.txt](../docs/ARVORE.txt)
com Node.js, sem dependências adicionais, sem executar a aplicação e sem Git.
Na raiz do projeto:

```powershell
node scripts/gerar-arvore.mjs
node scripts/gerar-arvore.mjs --check
```

O primeiro atualiza a árvore; se já for idêntica, não regrava o arquivo.
`--check` só lê: retorna código 0 se atualizada, 1 se ausente/desatualizada;
erro de execução ou argumento inválido retorna 2. A raiz é resolvida pelo local
do script, independentemente do diretório de onde o comando for chamado.

A árvore contém somente nomes reais, sem descrições, datas ou caminhos absolutos.
O nome inicial vem da pasta real do checkout. Diretórios vêm primeiro; nomes são
ordenados sem depender do locale do sistema, com desempate pela grafia original.
Saída UTF-8 com quebras LF. Inclui diretórios vazios, arquivos não rastreados,
assets, configurações, lockfiles, schemas/migrations e a própria `ARVORE.txt`.
Mudanças somente de conteúdo não alteram a árvore. Links/junctions aparecem como
folhas; seus alvos não são percorridos.

As exclusões explícitas do script valem em qualquer nível: Git, node_modules/vendor,
builds/dist/coverage, caches de ferramentas, temporários/logs, dumps/backups/uploads
locais e estado de editores/agentes. Também exclui `.env` local, chaves privadas,
artefatos tsbuildinfo e o relatório gerado de otimização de imagens; exemplos de
ambiente como `.env.example` são mantidos. Não usa extensões de código como
allowlist nem depende de arquivos já adicionados ao Git. Para um novo tipo de
artefato local, ajuste a política do gerador, sem editar a árvore manualmente.

Sempre gere após criar/remover/renomear/mover caminhos, conforme
[AGENTS.md](../AGENTS.md). Isso complementa índices funcionais e READMEs.
Teste direcionado, com fixtures temporárias isoladas:

```powershell
node --test scripts/tests/gerar-arvore.test.mjs
```

## Operação do produto

Há oito smokes manuais nesta pasta e dois de Realtime em `api/scripts/`.
Eles não são carregados pelo aplicativo nem executados automaticamente pela suíte.
Os que criam salas/usuários ou usam WebSocket exigem ambiente isolado e autorização;
não os use durante jogos reais. Antes de executá-los, confira o contrato atual.

**Legados incompatíveis:** `smoke-draft.mjs` e `smoke-vps-draft.mjs` ainda esperam
draft de 20 turnos na sala 5v5 comum. O [modo atual](../api/src/lib/draft/modos/5v5.ts)
tem `ativo: false`; o draft no site pertence às salas de times/campeonato.
Esses dois scripts não são validações vigentes nem referência para reintroduzir
o fluxo antigo. Precisam de revisão/deduplicação antes de qualquer uso.

Ferramentas transversais ao produto. Os comandos e efeitos abaixo correspondem
aos cabeçalhos dos scripts atuais; não são uma fila de execução. Scripts que
criam salas, usuários, partidas ou lançamentos exigem ambiente isolado e escopo
autorizado. Não rode smokes de VPS contra produção como validação de documentação.

| Entrada | Uso atual / efeito |
|---|---|
| [verify-swap.js](verify-swap.js) | `node scripts/verify-swap.js --strict`, na raiz. Busca textual de referências legadas no frontend; não é portão geral do agente. |
| [gerar-posicoes-campeoes.mjs](gerar-posicoes-campeoes.mjs) | `node scripts/gerar-posicoes-campeoes.mjs`, na raiz. Consulta Meraki/DDragon e grava metadados usados pelo draft; tem rede e escrita. |
| [smoke-clock-sync.mjs](smoke-clock-sync.mjs) | Em `api/`, `.\node_modules\.bin\tsx.cmd ../scripts/smoke-clock-sync.mjs`. Simula relógios no processo, sem stack/banco. |
| [smoke-clock-sync-vps.mjs](smoke-clock-sync-vps.mjs) | Mesmo launcher tsx, apontado para esse arquivo; usa a API configurada no script e cria dados de sala. |
| [smoke-confirmacao-concorrente.mjs](smoke-confirmacao-concorrente.mjs) | `node scripts/smoke-confirmacao-concorrente.mjs`. API local e Docker/PostgreSQL; cria dados e confirmações concorrentes. |
| [smoke-draft.mjs](smoke-draft.mjs) | Legado incompatível com o 5v5 atual; não executar como validação vigente. |
| [smoke-vps-codigo.mjs](smoke-vps-codigo.mjs) | No container `/app`, `node smoke-codigo.mjs`, após cópia conforme cabeçalho. Banco/HTTP, criação de dados e checagem da redação de códigos. |
| [smoke-vps-draft.mjs](smoke-vps-draft.mjs) | Legado incompatível com o 5v5 atual; não executar como validação vigente. |
| [smoke-vps-sala-campeonato.mjs](smoke-vps-sala-campeonato.mjs) | No container, `node smoke-sala.mjs`; criação e participação em séries. |
| [smoke-vps-salas.mjs](smoke-vps-salas.mjs) | No container, `node smoke2.mjs`; fluxo de salas, relógios e polling. |
| [campeonatos/sortear-semana.mjs](campeonatos/sortear-semana.mjs) | Sorteio com PostgreSQL; `--dry-run` faz prévia e a execução sem flag grava jogos em transação. Contrato no [README de Campeonatos](../api/src/modules/tournaments/README.md#sorteio-operacional-de-copas). |

Scripts frontend estão em [web/scripts](../web/scripts/README.md); o Graph RAG
tem [README próprio](../tools/graph-rag/README.md). Eles não devem ser reunidos
por semelhança de nome. `node --check` verifica apenas sintaxe, sem homologar os
efeitos de integração, concorrência ou rede dos scripts.
