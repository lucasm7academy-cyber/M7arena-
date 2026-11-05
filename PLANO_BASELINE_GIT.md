# PLANO BASELINE GIT — M7Arena

> **Documento de verificação e planejamento. Nada foi alterado.**
> Esta etapa não criou tag, branch, commit, migration, deploy, restart ou
> restauração. A VPS foi inspecionada apenas em modo leitura. Nenhum valor de
> `.env`, token, senha ou chave é reproduzido neste documento.

**Levantamento:** 04/11/2026
**Ambiente local:** `D:\Aplicativos\M7arenaSite`
**VPS:** `pandapost-vps` (`/root/m7arena`)
**Objetivo:** preservar a produção atual antes de iniciar a simplificação.
**Relação com os documentos anteriores:** `ESTRUTURA_ATUAL.md` e
`CATALOGO_FUNCIONALIDADES.md` são a base funcional; este documento é a base de
segurança do Git, dos artefatos e dos dados.

---

## 1. Estado atual verificado

### 1.1 Git local

| Item | Valor verificado |
|---|---|
| Branch atual | `main` |
| HEAD local | `8e848f6aadd82919bcf221cea39da6b7f772b17a` |
| `origin/main` | `8e848f6aadd82919bcf221cea39da6b7f772b17a` |
| Working tree | **limpo** — nenhum arquivo modificado, nenhum não rastreado |
| Tags locais | **nenhuma** |
| Branch `simplificacao-m7arena` | **não existe** |
| Stash | **1 stash** (`stash@{0}`) |
| Branches não mergeadas em `main` | **nenhuma** (`git branch -a --no-merged main` vazio) |
| Reflog | mostra apenas fast-forwards e commits de documentação/status recentes |

**Histórico recente (15 commits):**

| Commit | Tipo | Assunto |
|---|---|---|
| `8e848f6` | Documentação/status | registra sessão do catálogo funcional |
| `ad68ccb` | Documentação | catálogo funcional completo |
| `ac36534` | Documentação/status | registra sessão do mapeamento |
| `35c9fbf` | Documentação | mapeamento completo da estrutura |
| `8e498dc` | **Código** | modal de resultado também no DraftRoom |
| `4edf11b` | Documentação/status | registra sessão do resultado manual |
| `ecd1477` | **Código** | admin insere resultado manual; série avança/finaliza |
| `c1a7c6a` | Documentação/status | sessão sala 250 / queue 3100 |
| `537c74a` | **Código** | troca de lado move time, logo, vaga e placar |
| `46aade4` | **Código** | logo e placar seguem o lado no draft |
| `7a30247` | **Código** | buscar partida blind na queue 3100 |
| `176d4a5` | Documentação/status | sessão header de finalizada |
| `79f4a2a` | **Código** | header de finalizada no padrão das salas |
| `7a2fa38` | **Código** | classificação lista todos os times aprovados |
| `d3869a5` | Documentação/status | sessão limpeza dos códigos 5x5 |

**Leitura:** os 4 commits posteriores a `8e498dc` são somente documentação/status.
Eles não alteram runtime e não estão na VPS. O último commit de código é
`8e498dc`.

### 1.2 Git remoto e VPS

| Item | Valor verificado |
|---|---|
| `origin` | `https://github.com/lucasm7academy-cyber/M7arena-.git` |
| `origin/main` (remoto real) | `8e848f6aadd82919bcf221cea39da6b7f772b17a` |
| `vps` (remoto SSH) | `ssh://pandapost-vps/root/m7arena` |
| `vps/main` (remoto real) | `8e498dcc46896d92ecc76aef08b6ac97ec65f3e1` |
| Repositório da VPS: branch | `main` |
| Repositório da VPS: HEAD | `8e498dc` |
| Repositório da VPS: working tree rastreado | **limpo** (0 modificações rastreadas) |
| Repositório da VPS: não rastreados | **87 arquivos / 1,8 MB** |
| VPS `origin/main` local | `8e498dc` (a VPS não puxou os 4 commits de documentação) |

**Diferença `vps/main..main`:** apenas 5 arquivos, todos de documentação/status:

- `ESTRUTURA_ATUAL.md` (novo)
- `CATALOGO_FUNCIONALIDADES.md` (novo)
- `docs/project-state.json`
- `docs/status-log.jsonl`
- `statusdoprojeto.md`

Nenhum arquivo de `web/`, `api/`, `db/`, `infra/`, `scripts/` ou `mcp/` difere
entre a VPS e a `main` local.

### 1.3 Arquivos não rastreados na VPS

A VPS tem **87 arquivos não rastreados**, todos com status `??`:

| Extensão | Quantidade |
|---|---:|
| `.sql` | 53 |
| `.mjs` | 23 |
| `.html` | 6 |
| `.json` | 3 |
| `.txt` | 1 |
| `.patch` | 1 |

Exemplos relevantes (sem abrir conteúdo):

- `index.rollback-*.html` — cópias de rollback do front;
- `match_codes_backup_20261101.sql`, `sala250_backup_*.json` — dados operacionais;
- `sortear-semana.mjs`, `smoke-vps-*.mjs` — scripts operacionais;
- `mig27.sql` … `mig32.sql` — SQL de migrações aplicadas manualmente;
- `vps-wip-before-align-20261031.patch`, `vps-status-before-align-20261031.txt`.

**Nada disso está no Git.** É o primeiro material a preservar antes de qualquer
`git clean`, reset ou limpeza de pasta.

### 1.4 Stash existente

| Item | Valor |
|---|---|
| Stash | `stash@{0}` |
| Origem | branch `feat/redesign-modais` |
| Mensagem | `backup WIP main folder 2026-10-31 antes de main 7d0d3a2` |
| Tamanho | 273 arquivos, +2.077 / −31.091 linhas |
| Conteúdo | remoção de legado Next.js/Supabase, docs antigos, assets duplicados, etc. |

O stash **não está aplicado** e **não é alcançável por branch**. Ele é histórico
recuperável, mas não faz parte da produção atual. Não deve ser descartado sem
exportação/avaliação.

---

## 2. Versão efetivamente implantada na VPS

### 2.1 Conclusão curta

**A produção não é um único build de um único commit.** Ela é um conjunto misto:

| Camada | Commit/build efetivo | Situação |
|---|---|---|
| Front servido pelo Nginx | **`8e498dc`** | imagem Nginx construída depois do pull de `8e498dc`; HTML/JS ao vivo batem com o container |
| API (`m7arena_app`) | **`ecd1477`** | imagem construída quando o repo estava em `ecd1477`; código de API é equivalente a `8e498dc` (o commit seguinte é só front) |
| Realtime | **build de 2026-11-01** | container antigo, imagem **ausente do image store**; código compilado é idêntico ao da imagem atual |
| Banco | **18 MB / 48 tabelas** | schema completo, mas ledger de migrations tem só 14 registros |
| Uploads | **31,3 MB / 221 arquivos** | volume `infra_uploads_data` |
| Configuração | `.env` de **740 bytes** | fora do Git; apenas nomes de variáveis foram inspecionados |

**Commit de referência para a baseline:** `8e498dc`.
Ele representa o código de produção; a API já contém o mesmo código em
`ecd1477`, e o front foi reconstruído em `8e498dc`.

### 2.2 Evidências por camada

#### Front / Nginx

- Container `m7arena_nginx`:
  - imagem `m7arena-nginx:latest`;
  - image ID `sha256:3c05d54498e080433ea64e842bf86050a8dc6319edc7cbc5ab68dce5182865d3`;
  - criada em `2026-11-03T00:50:26Z`;
  - iniciada em `2026-11-03T00:50:38Z`.
- Reflog da VPS: `8e498dc` foi atualizado às `2026-11-03 00:50:06 UTC`,
  **antes** da imagem Nginx (00:50:26).
- O `docker history` da imagem Nginx mostra
  `COPY /app/web/dist /usr/share/nginx/html` em `2026-11-03T00:50:26Z`.
- Hashes ao vivo x container:
  - HTML: `f0a7666d297377a826516bfe1659cc0dc03d821bb3f08726fa1b5b008e6db482`
    (igual no `https://m7arena.pro/` e no container);
  - JS principal `index-r33Yq3V-.js`:
    `759824dcc8fcbc289fe9fee523d51b9e60bf1e72deb7f32b9d9f215ff78d68c3`
    (igual no site e no container).
- `GET /api/health` respondeu `{"status":"ok","service":"m7arena-api",...}`.

**Conclusão:** o que o usuário vê no navegador corresponde ao build Nginx feito
a partir de `8e498dc`.

#### API (`m7arena_app`)

- Container `m7arena_app`:
  - imagem `m7arena-app:latest`;
  - image ID `sha256:6e053809cbf3cdc30825329a8b584e9fc7421f3fad741128fdd42cfb80d71751`;
  - criada em `2026-11-03T00:47:56Z`;
  - iniciada em `2026-11-03T00:48:18Z`.
- Reflog da VPS:
  - `ecd1477` atualizado às `2026-11-03 00:47:23 UTC`;
  - `4edf11b` (só docs) às `00:48:57`;
  - `8e498dc` às `00:50:06`.
- Portanto, a imagem da API foi construída **entre `ecd1477` e `4edf11b`**,
  ou seja, em cima de `ecd1477`.
- O `dist` da API dentro do container contém
  `registrarResultadoManualSerie`, função introduzida em `ecd1477`.
- `8e498dc` altera **somente** `web/src/features/sala-campeonato/SalaCampeonato.tsx`.
  Não há mudança de API entre `ecd1477` e `8e498dc`.

**Conclusão:** a API em execução é code-equivalent a `8e498dc`; foi construída
um pouco antes do commit final, mas o único diff posterior é front.

#### Realtime

- Container `m7arena_realtime`:
  - imagem referenciada: `sha256:5adac6f829d564a72c64070ee8d6eafb9ec237a4ed0171cc744ea0bb4e03a091`;
  - criado/iniciado em `2026-11-01T20:47:28Z` / `20:47:29Z`;
  - **a imagem não aparece em `docker image ls -a`**;
  - **`docker image inspect` falha** com “No such image”.
- O container continua rodando porque mantém as camadas em uso, mas a imagem
  não pode ser recriada a partir de uma tag.
- O arquivo compilado `/app/dist/api/src/realtime/index.js` tem hash
  `e56e73d42ff348cccf7576349dc9c35fa8c075c83e1462050aa11635b5178d79`
  **igual** ao mesmo arquivo dentro do container `m7arena_app`.
- O código-fonte do realtime não muda desde `2026-10-31`; os commits de
  `2026-11-01` a `8e498dc` não alteram `api/src/realtime/index.ts`.

**Conclusão:** o realtime está funcionalmente no código atual, mas roda em uma
imagem órfã, mais antiga e não reproduzível. É o ativo mais frágil da produção.

#### Banco de dados

- Tamanho: **18 MB**.
- Tabelas no schema `public`: **48** (compatível com o schema Drizzle).
- Ledger `drizzle.__drizzle_migrations`: **14 registros**.
- `db/migrations/meta/_journal.json`: **33 entradas**.
- Arquivos `db/migrations/*.sql`: **35**.
- `0033_stiff_hemingway.sql` e `0034_blind_codes.sql` **não estão no journal**.
- Objetos tardios existem no banco:
  - `tierlist_submissions`;
  - `bet_tickets`;
  - `transmissoes`;
  - colunas `campeonato_sala_estado.formato`, `placar_a`, `ultimo_vencedor`;
  - `transmissoes.sala_id`;
  - `tournament_matches.sorteio_forcado`.

**Conclusão:** o schema materializado está completo, mas o **histórico de
migrations do Drizzle está atrasado/inconsistente**. Isso é um risco alto para
qualquer `drizzle-kit migrate/generate` futuro. Não execute migrations contra
produção até reconciliar esse ledger. A presença de `mig27.sql`…`mig32.sql`
entre os arquivos não rastreados da VPS é **compatível** com aplicação manual
dessas migrations, mas a causa exata não foi provada.

#### Uploads e configuração

- Volume `infra_uploads_data` montado em `/var/www/uploads`:
  - **31,3 MB**;
  - **221 arquivos**.
- `.env` da VPS:
  - `/root/m7arena/.env`, **740 bytes**, modo `-rw-r--r--`;
  - contém configuração de produção, incluindo nomes de variáveis como
    `DATABASE_URL`, `AUTH_SECRET`, `RIOT_API_KEY`, `MERCADO_PAGO_*`,
    `GOOGLE_*`, `APP_URL`;
  - **não** contém `DISCORD_WEBHOOK_URL` no ambiente do container `app`;
  - valores não foram lidos/reproduzidos neste documento.
  - O modo `644` permite leitura por qualquer usuário local da VPS; recomenda-se
    restringir para `600` **depois da aprovação**, junto com o backup seguro.

#### Backups

- O serviço `m7arena_backup` está rodando, mas os dumps automáticos têm
  **20 bytes** e os logs mostram:
  `pg_dump: error: connection to server at "postgres" ... fe_sendauth: no password supplied`.
- Existem dois dumps manuais antigos, ambos com gzip válido e cabeçalho
  PostgreSQL:
  - `/root/backups/m7arena_20260919_163708.sql.gz` — 772.516 bytes;
  - `/root/backups/m7arena_20261022_043015.sql.gz` — 1.245.165 bytes.
- **Não há dump automático válido recente.** O último dump manual é de
  22/10/2026, anterior ao estado atual do banco.

---

## 3. Diferenças encontradas

| # | Comparação | Resultado |
|---|---|---|
| D-01 | `main` local x `origin/main` | Iguais (`8e848f6`). |
| D-02 | `origin/main` x VPS | VPS está 4 commits atrás; todos de documentação/status. |
| D-03 | VPS HEAD x imagem da API | Imagem da API foi construída em `ecd1477`, não em `8e498dc`; API é equivalente porque `8e498dc` é front-only. |
| D-04 | VPS HEAD x imagem do Nginx | Nginx foi construído depois do pull de `8e498dc`; front corresponde. |
| D-05 | Realtime x app | Container realtime é de 01/11, imagem órfã; código compilado é igual ao app atual. |
| D-06 | Schema real x ledger Drizzle | 48 tabelas e objetos tardios existem; ledger tem 14 registros para 33 entradas/35 arquivos. |
| D-07 | Journal x arquivos SQL | `0033` e `0034` estão fora do `_journal.json`. |
| D-08 | Backups automáticos x banco | Dumps de 20 bytes; sem backup automático válido. |
| D-09 | Dumps manuais x estado atual | Dois dumps válidos, mas de 19/09 e 22/10; não cobrem o estado atual. |
| D-10 | Git x arquivos da VPS | 87 arquivos não rastreados (1,8 MB), incluindo SQL, scripts, rollbacks e backups operacionais. |
| D-11 | Git x stash | 1 stash grande (273 arquivos) não aplicado e não representado por branch. |
| D-12 | Imagens x labels de build | Imagens não têm `org.opencontainers.image.revision`; a proveniência é inferida por timestamps/reflog/hashes, não por label. |

---

## 4. Riscos de sobrescrever ou perder alterações

| Severidade | Risco | Impacto | Mitigação proposta |
|---|---|---|---|
| **Crítico** | Rodar `drizzle-kit migrate` ou `drizzle-kit generate` na produção | Ledger atrasado pode reaplicar migrations já materializadas; `schema/index.ts` não exporta `tierlist.ts` e o generate pode propor `DROP TABLE tierlist_submissions`. | Não executar. Reconciliar journal/ledger em tarefa separada, testando em cópia restaurada. |
| **Crítico** | Iniciar simplificação sem dump válido | Perda de dados se qualquer migration/limpeza tocar o banco; backups automáticos estão quebrados. | Tirar dump novo, validar restauração em ambiente descartável e copiar para fora da VPS antes de qualquer mudança. |
| **Alto** | `docker compose up -d`, `down`, `rm` ou recreate do realtime | A imagem do realtime não existe no image store; o container atual não pode ser recriado exatamente. | Antes de qualquer compose: `docker commit` do realtime e/ou `docker save`; testar recreate em localhost. |
| **Alto** | `git clean -fdx` ou limpeza manual da pasta da VPS | Apaga os 87 arquivos não rastreados, rollbacks, SQLs e possivelmente `.env` ignorado. | Arquivar untracked + `.env` fora do Git antes; não usar `clean -x` sem revisão. |
| **Alto** | `git stash drop` / perda do stash | Perde 273 arquivos de trabalho antigo (+2.077/−31.091) sem branch. | Exportar patch e criar branch a partir do stash antes de qualquer limpeza. |
| **Alto** | Tag no commit errado | Tag em `8e848f6` inclui docs, mas não é o commit exato do front de produção; tag em `8e498dc` não inclui docs. | Criar duas tags: produção em `8e498dc` e documentos em `8e848f6`. |
| **Médio** | `docker system prune` / remoção de imagens | Pode apagar camadas/cache e a referência do realtime; rollback fica impossível. | Não podar; salvar imagens antes. |
| **Médio** | Sobrescrever `.env` no deploy | Perda de credenciais/configuração de produção. | Backup seguro do `.env` (fora do Git, criptografado) e nunca sobrescrever sem diff. |
| **Médio** | Restaurar dump antigo direto na produção | Perda de dados entre a data do dump e hoje. | Restaurar somente em banco novo/descartável; produção só troca após validação e janela. |
| **Médio** | Trabalhar na pasta principal em vez de worktree | Commits de simplificação podem se misturar com docs/status e com o estado da produção. | Worktree/clone separado, branch `simplificacao-m7arena`. |
| **Baixo** | Apagar branches antigas | Todas estão mergeadas em `main`, mas são histórico útil. | Não apagar; manter refs e tags. |
| **Baixo** | `mcp-ops` em restart loop | Não afeta o runtime do site, mas afeta operação. | Fora do escopo da baseline; registrar e não reiniciar agora. |

---

## 5. Estratégia recomendada para preservar a produção

### 5.1 Ordem recomendada (não executar ainda)

1. **Congelar** qualquer deploy, migration, limpeza ou alteração na VPS.
2. **Preservar artefatos Docker** (app, nginx e, principalmente, realtime).
3. **Tirar dump novo do PostgreSQL** e validar restauração em ambiente descartável.
4. **Arquivar uploads, `.env`, untracked e stash** fora do Git.
5. **Criar tags e branch** somente depois que 1–4 estiverem verificados.
6. **Testar o restore e o build local** a partir da tag/branch.
7. Só então iniciar a simplificação funcional.

### 5.2 Preservar a versão atual da produção com tag

- **Tag de produção:** `baseline-producao-2026-11-04` em `8e498dc`.
  - Representa o código de produção (front `8e498dc`; API equivalente).
- **Tag de documentos:** `baseline-documentos-2026-11-04` em `8e848f6`.
  - Preserva `ESTRUTURA_ATUAL.md` e `CATALOGO_FUNCIONALIDADES.md`, que não estão
    na VPS.
- As tags devem ser **anotadas** (`git tag -a`) e enviadas ao `origin`.
- Não mover essas tags depois. Se precisar de outra baseline, criar uma nova.

### 5.3 Manter o histórico recuperável

- Não fazer `reset --hard`, `rebase`, `squash`, `filter-repo` ou force-push na
  `main`.
- Manter todas as branches antigas; todas estão mergeadas, mas são histórico.
- Exportar o stash para patch e criar uma branch de preservação
  (`wip/backup-2026-10-31`) antes de qualquer limpeza.
- Exportar a lista de 87 untracked para um arquivo de inventário + tar seguro.
- Guardar o patch/tar fora do repositório e com checksum.

### 5.4 Criar `simplificacao-m7arena` a partir de base verificada

Base recomendada: **`8e848f6`** (main local/remota), porque:

- contém os dois documentos de auditoria;
- o código é idêntico ao de `8e498dc`;
- não há alteração de runtime nos 4 commits posteriores.

Alternativa conservadora: criar a branch em `8e498dc` e fazer merge dos 4
commits de documentação. A base `8e848f6` é mais simples e preserva os docs.

### 5.5 Preservar os documentos de auditoria

- A tag `baseline-documentos-2026-11-04` em `8e848f6` preserva os dois arquivos.
- A branch `simplificacao-m7arena` nasce com eles.
- Não mover/renomear os docs durante a simplificação; se forem atualizados,
  criar novos commits e manter o histórico.

### 5.6 Alterações em localhost, sem afetar produção

- Usar **worktree separado** ou clone fora de `D:\Aplicativos\M7arenaSite`.
- Usar `infra/docker-compose.local.yml` com `.env.local`.
- Apontar `DATABASE_URL` para o Postgres local, nunca para a VPS.
- Usar uploads local (`uploads_local_data`) e chaves de teste.
- Restaurar o dump em um banco local descartável para validar dados/schema.
- Não conectar o ambiente local ao Mercado Pago/Riot de produção; usar chaves
  de teste ou desabilitar as integrações.

### 5.7 Commits recuperáveis e integração futura

- Commits pequenos e temáticos na `simplificacao-m7arena`.
- Push da branch para o `origin` desde o primeiro commit.
- Integração na `main` por **merge commit** (`--no-ff`), não squash/rebase, para
  preservar os commits de trabalho.
- Antes do merge: revisar diff, rodar typecheck/testes/smokes, comparar com a tag
  de produção.
- Depois do merge: criar tag de release e só então deploy a partir da `main`.

### 5.8 Rollback para deploy futuro

- Guardar as imagens atuais:
  - `m7arena-app:latest` (`6e0538…`);
  - `m7arena-nginx:latest` (`3c05d5…`);
  - realtime: `docker commit` do container atual, pois a imagem original sumiu.
- Salvar com `docker save` + checksum.
- No deploy, usar imagens pinadas por tag/digest, não `latest` implícito.
- Rollback de app/front: subir as imagens baseline com
  `DOCKER_IMAGE`/`NGINX_IMAGE` apontando para as tags baseline.
- Rollback de dados: restaurar o dump em banco **novo** e trocar a aplicação
  após validação; nunca dar `DROP` no banco atual.
- Rollback de uploads: restaurar o tar em volume novo; não sobrescrever o volume
  atual.
- Rollback de configuração: restaurar `.env` do backup seguro.

### 5.9 Dados fora do Git

| Dado | Onde está | Como preservar | Como validar |
|---|---|---|---|
| PostgreSQL | container `m7arena_postgres`, volume próprio | `pg_dump -Fc` novo + cópia offsite + checksum | `pg_restore --list` e restore em container descartável; contar 48 tabelas e consultar dados-chave |
| Uploads | volume `infra_uploads_data` (31,3 MB / 221 arquivos) | tar do volume em modo leitura + checksum | listar tar, contar arquivos, abrir uma imagem de teste |
| Configuração | `/root/m7arena/.env` (740 B) | cópia criptografada/offline; nunca no Git | diff de nomes de variáveis; testar app local com `.env.local` |
| Imagens Docker | Docker local da VPS | `docker save` + `docker commit` do realtime | `docker load` em host de teste; `docker images` |
| Untracked | `/root/m7arena` (87 arquivos) | tar + inventário + checksum | listar tar; revisar o que é operacional vs descartável |
| Stash | `.git` local | patch + branch de preservação | aplicar em clone de teste e rodar build |

**Não foi executado nenhum restore.** O plano exige um restore de teste em
ambiente descartável antes de considerar a baseline segura.

---

## 6. Comandos propostos (NÃO EXECUTAR AINDA)

> Todos os comandos abaixo são propostas. Nenhum foi executado nesta etapa.
> Substitua nomes de arquivos/datas se o usuário preferir outra convenção.

### 6.1 Tags Git

```bash
# Na pasta local, com a main limpa
git tag -a baseline-producao-2026-11-04 8e498dc \
  -m "Produção em 2026-11-04: front 8e498dc; API ecd1477 equivalente; realtime build 2026-11-01"

git tag -a baseline-documentos-2026-11-04 8e848f6 \
  -m "Documentos ESTRUTURA_ATUAL e CATALOGO_FUNCIONALIDADES"

git push origin baseline-producao-2026-11-04 baseline-documentos-2026-11-04
```

### 6.2 Branch de simplificação

```bash
# Base recomendada: main local/remota (8e848f6), que inclui os docs
git switch -c simplificacao-m7arena 8e848f6
git push -u origin simplificacao-m7arena
```

### 6.3 Worktree local isolado

```powershell
# Windows/PowerShell — pasta fora do repositório principal
git worktree add D:\Aplicativos\M7arena-simplificacao simplificacao-m7arena
```

```bash
# Alternativa: clone separado
git clone https://github.com/lucasm7academy-cyber/M7arena-.git D:/Aplicativos/M7arena-simplificacao
cd D:/Aplicativos/M7arena-simplificacao
git switch simplificacao-m7arena
```

### 6.4 Preservar o stash

```bash
# Exportar antes de qualquer limpeza
git stash show -p 'stash@{0}' > /root/backups/m7arena-stash-2026-10-31.patch

# Criar branch de preservação (não descartar o stash até validar)
git stash branch wip/backup-2026-10-31 'stash@{0}'
```

### 6.5 Preservar untracked da VPS

```bash
cd /root/m7arena
git ls-files --others --exclude-standard -z \
  | tar --null -T - -czf /root/backups/m7arena-untracked-2026-11-04.tar.gz

sha256sum /root/backups/m7arena-untracked-2026-11-04.tar.gz
```

### 6.6 Preservar imagens Docker

```bash
# App e Nginx
docker tag m7arena-app:latest m7arena-app:baseline-2026-11-04
docker tag m7arena-nginx:latest m7arena-nginx:baseline-2026-11-04

# Realtime: a imagem original não existe; preservar o container em execução
docker commit m7arena_realtime m7arena-realtime:baseline-2026-11-04

# Salvar tudo
docker save m7arena-app:baseline-2026-11-04 \
  m7arena-nginx:baseline-2026-11-04 \
  m7arena-realtime:baseline-2026-11-04 \
  | gzip > /root/backups/m7arena-images-2026-11-04.tar.gz

sha256sum /root/backups/m7arena-images-2026-11-04.tar.gz
```

### 6.7 Dump do PostgreSQL (modelo; não executar agora)

```bash
# Ler POSTGRES_PASSWORD do .env sem imprimir o valor
set -a
. /root/m7arena/.env
set +a

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" m7arena_postgres \
  pg_dump -U postgres -Fc m7arena \
  > /root/backups/m7arena-pre-baseline-2026-11-04.dump

ls -lh /root/backups/m7arena-pre-baseline-2026-11-04.dump
sha256sum /root/backups/m7arena-pre-baseline-2026-11-04.dump
```

Validação (também não executar agora):

```bash
# Listar o conteúdo sem restaurar
pg_restore --list /root/backups/m7arena-pre-baseline-2026-11-04.dump | head

# Restore de teste em container descartável, porta local, banco separado
docker run --rm -d --name m7arena_restore_test \
  -e POSTGRES_PASSWORD=test_only \
  -p 55432:5432 postgres:16-alpine

# Criar banco de teste e restaurar
docker exec m7arena_restore_test createdb -U postgres m7arena_restore
docker exec -i m7arena_restore_test pg_restore -U postgres -d m7arena_restore \
  < /root/backups/m7arena-pre-baseline-2026-11-04.dump

# Validar contagem de tabelas e alguns dados
docker exec m7arena_restore_test psql -U postgres -d m7arena_restore \
  -c "select count(1) from pg_tables where schemaname = current_schema();"

# Destruir apenas o container de teste
docker rm -f m7arena_restore_test
```

### 6.8 Backup de uploads

```bash
docker run --rm \
  -v infra_uploads_data:/data:ro \
  -v /root/backups:/backup \
  alpine \
  tar czf /backup/m7arena-uploads-2026-11-04.tar.gz -C /data .

sha256sum /root/backups/m7arena-uploads-2026-11-04.tar.gz
```

### 6.9 Backup da configuração

```bash
# Não colocar .env no Git. Copiar para arquivo com modo restrito e criptografar.
install -m 600 /root/m7arena/.env /root/backups/m7arena-env-2026-11-04.env
# Depois: criptografar (age/gpg) e copiar para armazenamento seguro.
```

### 6.10 Rollback futuro (modelo)

```bash
# Exemplo com imagens baseline; ajustar conforme o compose/override
DOCKER_IMAGE=m7arena-app:baseline-2026-11-04 \
NGINX_IMAGE=m7arena-nginx:baseline-2026-11-04 \
docker compose --env-file /root/m7arena/.env -f /root/m7arena/infra/docker-compose.yml up -d
```

> O rollback do realtime exige um override que use
> `m7arena-realtime:baseline-2026-11-04` ou o mesmo `DOCKER_IMAGE` da app
> (o código compilado do realtime é idêntico). Validar em localhost antes.

---

## 7. Estratégia de localhost isolado e integração futura

### 7.1 Isolamento

| Item | Produção | Localhost |
|---|---|---|
| Pasta | `/root/m7arena` | `D:\Aplicativos\M7arena-simplificacao` (worktree/clone) |
| Branch | `main` (VPS) | `simplificacao-m7arena` |
| Compose | `infra/docker-compose.yml` | `infra/docker-compose.local.yml` |
| Porta web | 80/443 via Nginx host | `localhost:3000` |
| Postgres | container `m7arena_postgres` | container `m7arena_local_postgres` |
| Uploads | volume `infra_uploads_data` | volume `uploads_local_data` |
| Env | `/root/m7arena/.env` | `.env.local` com chaves de teste |
| Dados | produção | dump restaurado/sanitizado ou seed local |

Passos:

1. Criar worktree/clone separado.
2. Criar `.env.local` sem credenciais de produção.
3. Subir `docker compose --env-file .env.local -f infra/docker-compose.local.yml up -d --build`.
4. Restaurar o dump em banco local **descartável** e validar contagem de tabelas.
5. Rodar `npx tsc --noEmit`, testes da API e `node scripts/verify-swap.js`.
6. Abrir `http://localhost:3000` e testar os fluxos que serão simplificados.
7. Nunca apontar `DATABASE_URL` local para a VPS.

### 7.2 Integração futura

1. Trabalhar somente na `simplificacao-m7arena`.
2. Commits pequenos, com mensagem clara e testes.
3. Push frequente para o `origin` (branch recuperável).
4. Abrir PR para `main` quando o bloco estiver estável.
5. Fazer **merge commit** (`--no-ff`) para preservar os commits da branch.
6. Rodar validações na `main` mergeada.
7. Criar tag de release (`simplificacao-AAAA-MM-DD`) e só então deploy.
8. Manter a tag `baseline-producao-2026-11-04` intacta para rollback.

### 7.3 Critérios para considerar a baseline “segura”

- [ ] Dump novo do banco tirado e com tamanho > 0.
- [ ] `pg_restore --list` lê o dump sem erro.
- [ ] Restore de teste em container descartável concluído.
- [ ] Contagem de tabelas do restore confere com a produção (48).
- [ ] Uploads arquivados e tar listável.
- [ ] `.env` copiado para local seguro e criptografado.
- [ ] Imagens app/nginx salvas; realtime commitado/salvo.
- [ ] 87 untracked arquivados e inventariados.
- [ ] Stash exportado e/ou em branch de preservação.
- [ ] Tags `baseline-producao` e `baseline-documentos` criadas e enviadas.
- [ ] Branch `simplificacao-m7arena` criada e enviada.
- [ ] Build local a partir da tag/branch sobe em `localhost:3000`.
- [ ] Nenhuma migration foi executada contra produção.

---

## 8. Decisão solicitada

Antes de qualquer simplificação, aprovar:

1. Os nomes das tags:
   - `baseline-producao-2026-11-04` em `8e498dc`;
   - `baseline-documentos-2026-11-04` em `8e848f6`.
2. A branch `simplificacao-m7arena` a partir de `8e848f6`.
3. A preservação do container realtime via `docker commit`, já que a imagem
   original não existe mais.
4. O restore de teste em container descartável (não na produção).
5. Se o dump de produção pode ser usado no localhost (contém dados de usuários)
   ou se será sanitizado.
6. Onde guardar os backups offsite (fora da VPS) e por quanto tempo.

**Nada foi executado.** O próximo passo, após aprovação, é a fase de resgate:
imagens, dump, uploads, `.env`, untracked e stash. Só depois vêm tags, branch e
localhost.
