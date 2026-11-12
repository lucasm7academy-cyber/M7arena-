# AGENTS.md — Como trabalhar no M7Arena

As instruções expressas do proprietário definem o trabalho autorizado. Este guia
vale para qualquer agente. O projeto atual está neste repositório; não há migração
de um site antigo.

## 1. Encontrar a responsabilidade antes de editar

1. Confirme a raiz com `git rev-parse --show-toplevel` e o estado com
   `git status --short`. Preserve alterações e arquivos não rastreados existentes.
2. Localize a funcionalidade em [docs/modules/INDEX.md](docs/modules/INDEX.md).
   [docs/INDEX.md](docs/INDEX.md) reúne as entradas documentais e compartilhadas.
3. **Leia o README do domínio antes de qualquer alteração naquela área.**
   Se tocar um contrato compartilhado, leia também o README de sua fronteira.
4. Use o Graph RAG para localizar símbolos/dependências e abra os trechos de
   código necessários. Confira consumidores antes de mudar uma interface.
   Não é necessário reler o projeto inteiro para uma tarefa localizada.
5. Na conclusão, confira se a mudança alterou alguma responsabilidade, regra,
   contrato, caminho ou fluxo descrito no README e sincronize o que foi afetado.

## 2. Padrão documental e recuperação de contexto

- A documentação Markdown própria usa somente **AGENTS.md, INDEX.md e README.md**.
  Não crie relatórios de execução, planos históricos, regras avulsas ou cópias de
  arquitetura em outros arquivos Markdown. Relate resultados de trabalho no chat.
- **AGENTS** orienta o agente; **INDEX** localiza funcionalidades; **README**
  recupera o contexto da responsabilidade. O código atual confirma a implementação.
- Cada funcionalidade nova precisa de README em sua pasta e entrada no índice.
  Em uma mudança existente, atualize o README quando seu conteúdo for afetado;
  não acrescente uma linha de histórico para toda edição trivial.
- README deve explicar responsabilidade, entradas/arquivos, fluxo, contratos,
  dependências compartilhadas, consumidores e verificações pertinentes/limites.
  Documente o que existe e identifique limitações; não apresente plano como pronto.
- Índices mudam quando surgem ou mudam entradas, nomes, caminhos ou fronteiras.
  Não duplique regras de negócio no índice e em vários READMEs. Aponte ao dono.
- Um README por domínio/responsabilidade coesa, não por função pequena. Antes de
  criar um arquivo, procure a implementação e a documentação existentes.

## 3. Arquitetura modular

- Páginas/componentes próprios em `web/src/features/<domínio>/`; HTTP de domínio
  em `api/src/modules/<domínio>/`. Use `pages`, `components`, `hooks` e
  `services` quando houver essas responsabilidades, sem pastas vazias artificiais.
- Código compartilhado permanece na fronteira comum. Confira o
  [frontend](web/src/README.md), [serviços da API](api/src/lib/README.md),
  [integrações HTTP](api/src/routes/README.md) e [dados](db/README.md).
- Separe responsabilidades reais de arquivos sobrecarregados, preservando estado,
  callbacks e contratos. Não imponha limite arbitrário de linhas nem fragmente
  serviço compartilhado para torná-lo exclusivo de uma tela.
- Reutilize SDK, componentes, helpers e regras existentes. Evite cópias, wrappers
  e reexports de compatibilidade sem consumidor que os justifique.
- Preserve visual, classes, fontes, animações e navegação sem pedido de mudança.
  UI compartilhada: [README](web/src/components/ui/README.md).
- Arquivo existente não prova funcionalidade ativa. Confira App/bootstrap; código
  sem rota ativa é identificado separadamente no índice.

## 4. Validação proporcional e integridade

- **Documentação:** conferir conteúdo no código, caminhos, links e consistência
  dos índices. Não executar testes funcionais só por editar Markdown.
- **Movimentação/imports:** comparar corpos e destinos, conferir registros/rotas e
  executar a verificação de tipos/build afetada.
- **Mudança de comportamento:** selecionar testes do fluxo; suíte ampla somente
  quando o risco transversal justificar. Não repetir checks já aprovados sem
  nova mudança, falha ou dúvida concreta.
- Autenticação/autorização, saldo, reservas, ledger, resultado e classificação
  são autoridade do servidor. Não alterar regras sensíveis como efeito escondido
  de organização. Testes de dados/economia usam ambiente isolado.
- Não expor segredos/dados pessoais, usar credenciais no cliente ou operar produção
  sem autorização específica. Mudança de schema exige migration que preserve dados.
- A [baseline do banco](db/migrations/README.md) é a origem de reconstrução.
  Novas tabelas/colunas exigem schema, migration incremental e README sincronizados;
  banco novo usa baseline + incrementos. Não reescreva baseline já aplicada nem
  apague metadados ativos. Nova consolidação exige reconstrução isolada e
  compatibilidade comprovada com os bancos existentes, sem alterar seus dados.
- Build/lint não homologam UI, WebSocket, gateway ou produção. Registre limitações.
  [Testes da API](README.md#testes-da-api) e [DOM](web/src/test/README.md).

## 5. Graph RAG e encerramento

Na raiz:
```powershell
node tools/graph-rag/cli.mjs status
node tools/graph-rag/cli.mjs query "funcionalidade ou símbolo"
node tools/graph-rag/cli.mjs context "símbolo ou file:caminho"
node tools/graph-rag/cli.mjs build
```

Reconstrua se ausente/desatualizado e após mudanças nas fontes indexadas.
Confirme `fresh` antes da consulta; use o mesmo `--cache` quando customizado.
O grafo complementa o mapa de funcionalidades, não o substitui. Cache fresh
não comprova cobertura documental; mapa de símbolos não é a visão de produto.
Consulte o [escopo e limites atuais](tools/graph-rag/README.md); complete lacunas
com busca direta, sem despejar o grafo inteiro no contexto.

A [árvore de arquivos](docs/ARVORE.txt) é autogerada. Sempre que criar, remover,
renomear ou mover arquivos ou diretórios, execute `node scripts/gerar-arvore.mjs`
antes de concluir. Não edite `docs/ARVORE.txt` manualmente. Alterações apenas no
conteúdo de arquivos existentes não exigem regeneração. Para verificar sem gravar,
use `node scripts/gerar-arvore.mjs --check`. Detalhes no [README dos scripts](scripts/README.md#árvore-de-arquivos).

Confira diff pertinente, `git diff --check` e estado final, incluindo não rastreados.
Em deploy autorizado, publique a revisão atual e confira a pasta versionada da VPS:
remova arquivos obsoletos ausentes da versão publicada, validando os caminhos.
Não deixe patches, dumps ou scripts avulsos no projeto nem os copie para outro
lugar como rotina. Preserve banco/volumes, uploads e configuração de produção;
remoção de dados ou backup operacional exige escopo próprio.

Não crie checkpoints/backups por execução, instale dependências, faça operações
Git de escrita ou deploy fora do escopo autorizado. Procedimento de implantação
no [README raiz](README.md#implantação-autorizada). Preserve a ponte externa;
envie mensagens externas somente quando autorizado.
