# M7Arena

React/Vite no frontend, Express na API, PostgreSQL/Drizzle nos dados e um processo
WebSocket separado. O mapa do produto está em [12 áreas](docs/modules/INDEX.md):
Início, Conta/Perfil, Jogadores, Times, Campeonatos, Salas, Desafios, Transmissões,
Administração, Carteira/Pix, Notificações e Conteúdo/Institucional.

## Organização atual

```text
web/src/
  App.tsx                    rotas e composição global
  features/                  páginas, componentes e serviços por domínio
    home/                    Início
    identity/ profile/       Conta, Perfil e vínculo Riot
    players/ teams/          Jogadores e Times
    campeonatos/             torneios e sua administração
    salas/ sala-campeonato/  salas comuns e salas de times/séries
    apostas/ streams/        Desafios e Transmissões
    admin/                   painel administrativo
    economy/ notifications/ carteira/Pix e sino
    institutional/           Quem Somos, Políticas e Tutorial
    m7-academy-tierlist/      sem rota ativa
  contexts/ hooks/ api/ lib/ contratos e implementações compartilhadas
  components/                UI, layout, Draft e widgets comuns
api/src/
  index.ts                   middlewares, mounts e inicialização de jobs
  modules/                   fronteiras HTTP e serviços próprios consolidados
    identity/ profiles/ players/ teams/ tournaments/ matches/
    bets/ streams/ admin/ economy/ notifications/ content/
  lib/                       serviços compartilhados, séries, Draft e economia
  routes/                    integrações Riot/upload/OG; tierlists não montado
  realtime/                  processo WebSocket separado
  cron.ts                    coordenação dos jobs
db/                          schemas e migrations
docs/                        índices de navegação
scripts/                     operação transversal
tools/graph-rag/              busca e visualizador técnico
infra/                       Compose, proxy e configuração de infraestrutura
mcp/                         ferramentas operacionais; ponte externa é independente
```

A interface e a API dividem responsabilidades diferentes: uma página agregadora
como Início não exige um router próprio; Carteira e Notificações não precisam
de página para serem funcionalidades. Não contar diretórios/símbolos como telas.

| Para entender | Entrada |
|---|---|
| Funcionalidades, rotas e relações de produto | [Índice de funcionalidades](docs/modules/INDEX.md) |
| Como agentes devem trabalhar e sincronizar contexto | [AGENTS.md](AGENTS.md) |
| Providers, SDK, layout e componentes comuns | [Frontend](web/src/README.md) |
| Sala, série, Draft, elegibilidade e motores comuns | [Serviços da API](api/src/lib/README.md) |
| Proxy Riot, upload e OG | [Integrações HTTP](api/src/routes/README.md) |
| Socket, chat e preview | [Realtime](api/src/realtime/README.md) |
| Persistência | [Dados](db/README.md) |
| Scripts e ferramentas frontend | [Scripts](scripts/README.md), [web/scripts](web/scripts/README.md) |

## Fronteiras compartilhadas

HTTP de domínio está em módulos; serviços de sessão, elegibilidade, carteira/ledger,
Draft e séries ainda têm consumidores cruzados. Os READMEs compartilhados acima
indicam os donos e dependências. Não copiar essas regras para cada tela.

Persistem concentrações de responsabilidade em SalaCampeonato, CampeonatoContext,
Jogar, DraftRoom, Perfil e SDK. A localização desses arquivos e seus contratos
está documentada; organização modular não significa que todas as divisões internas
ou limitações funcionais tenham sido resolvidas. Serviços de sala/série/Draft
têm ciclos de import que exigem uma refatoração própria.

O [mapa documental](docs/modules/INDEX.md) permite começar pelo produto.
O [Graph RAG](tools/graph-rag/README.md) atual ainda mostra detalhes de código
e não é a visão simplificada de acompanhamento; sua revisão vem depois desse mapa.


## Dados e contratos compartilhados

Autenticação usa sessão própria em cookie httpOnly. Cada operação aplica a
autorização no servidor; o cliente apresenta o resultado. Recuperação
administrativa está documentada em [Administração](web/src/features/admin/README.md#recuperação-de-senha).

Saldo, reservas, premiação, pagamentos, resultados e classificação são autoridade
do servidor. Preserve transações, ledger e idempotência. Testes precisam de dados
e serviços isolados; não use contas ou operações financeiras reais.

Segredos ficam no servidor, nunca em variáveis `VITE_*`. Não exponha valores de
ambiente ou dados pessoais em logs, documentação e mensagens. Mudanças de schema
exigem migration versionada, preservação dos dados e validação da cadeia em banco
isolado; revise SQL gerado para evitar repetição de DDL já aplicado.

O PgBouncer opera em transaction mode; prepared statements exigem o cuidado já
implementado no cliente. LISTEN/NOTIFY conecta diretamente ao PostgreSQL no
serviço Realtime. Essas fronteiras não devem ser unificadas numa movimentação.

## Uploads e autorização

O [router de upload](api/src/routes/upload.ts) exige sessão e aceita os buckets
de imagem definidos no servidor. `team-logos` usa o id do time no caminho e
permite dono, capitão ou cargo global `proprietario`; `public-images` aceita
`admin`, `proprietario`, `organizer` ou `organizador`. O cliente não decide um
caminho arbitrário. Conteúdo, tipo e limites são validados pelo servidor.
O [teste de permissão](api/test/upload-permissao.test.ts) exercita o predicado
usado pela rota com banco isolado, sem homologar todo o upload HTTP.

## Frontend e verificação local

O [App](web/src/App.tsx) monta a SPA. As salas usam `/5v5/:id`, `/aram/:id`,
`/1v1/:id`, `/sala-time/:id` e `/campeonato/sala/:id`. Timers e estados vêm do
servidor; a vitrine de Salas usa polling conforme seu README.

Mudanças visuais partem dos componentes e estilos existentes. O contrato do
recorte com borda está no [README da UI compartilhada](web/src/components/ui/README.md).
Não há um guia histórico de paleta ou layout que autorize alterações do produto.

Use os testes indicados pelo README do domínio. Na API, `npm.cmd run build`
verifica TypeScript; os testes usam PGlite em memória pelo helper existente.
No frontend, `npm run lint`, `npm run build` e os
[testes DOM](web/src/test/README.md) têm propósitos e limites diferentes.
Build/lint não homologam navegador, WebSocket ou produção.

## Testes da API

Os testes de serviço usam [helpers.ts](api/test/helpers.ts), que reconstrói PGlite
em memória pela [baseline e migrations posteriores](db/migrations/README.md),
com fixtures fictícias. Conexões auxiliares do código global também precisam de isolamento.
Em `api/`, com dependências já instaladas, um exemplo direcionado é:

```powershell
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:9/m7arena_test'
$env:RIOT_API_KEY=''
.\node_modules\.bin\tsx.cmd --test --test-concurrency=1 test/team-membership.test.ts test/team-ownership.test.ts
```

Substitua a seleção pelos arquivos pertinentes ao fluxo. Exemplos existentes:
`password-reset` (recuperação), `profile-privacidade` (shape público/privado),
`payments`/`webhook`/`withdrawals` (motores financeiros simulados),
`atualizar-elos`/`reconciliar-handles`/`riot-queues` (integração Riot simulada),
`draft*`/`sala-campeonato*`/`serie-*` e `cron` (serviços de salas/séries).
Não há cobertura HTTP completa só por esses arquivos existirem; para Realtime,
veja as [limitações do serviço](api/src/realtime/README.md#verificação-e-limites).

O [bootstrap da API](api/src/index.ts) inicia HTTP e jobs, e o router de upload
cria diretórios na importação. Não importe o bootstrap para testar um helper.
`db.ts` cria o pool durante a avaliação do módulo, enquanto `dotenv.config()`
aparece no corpo de `index.ts`, depois dos imports. Defina o ambiente antes de
iniciar o processo; não suponha que a chamada tardia ao dotenv configure um pool
já criado. Essa ordem de inicialização permanece como está no código.

## Implantação autorizada

O [Compose de produção](infra/docker-compose.yml) reúne PostgreSQL, PgBouncer,
API, Realtime, Nginx, backup e o serviço MCP de operações. O
[Compose local](infra/docker-compose.local.yml) atende o ambiente isolado.
Configurações, manifests e locks permanecem junto dos consumidores atuais.
A ponte externa de comunicação com o arquiteto é independente dos serviços em `mcp/`.

Publicar na VPS exige autorização específica e `main` commitada. Em `/root/m7arena`,
o Compose sempre usa `--env-file /root/m7arena/.env`. Após recriar a API, recarregue
o Nginx com `docker exec m7arena_nginx nginx -s reload` para renovar o upstream.
Valide `/api/health`, os chunks do frontend e a rota principal. A configuração de
backup de produção inclui cópia externa e restore verificado; isso não é uma
rotina de checkpoint por execução de desenvolvimento.

Este README documenta o procedimento; sua leitura não autoriza deploy, escrita
no banco ou execução de scripts operacionais.
