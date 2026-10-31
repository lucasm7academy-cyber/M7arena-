# AGENTS.md â€” Regras do projeto M7Arena

**Este arquivo Ã© a fonte Ãºnica de regras.** Vale para todo agente: Claude, Gemini, DeepSeek, Codex, Cursor, ou qualquer outro. `CLAUDE.md` e `GEMINI.md` apenas apontam para cÃ¡.

VocÃª provavelmente estÃ¡ entrando neste projeto sem ter visto nada do que foi conversado antes. Este documento e o MCP `m7-status` existem exatamente por isso.

> **Contexto em uma linha:** o M7Arena Ã© o projeto original e estÃ¡ em produÃ§Ã£o em `m7arena.pro`. NÃ£o existe mais migraÃ§Ã£o do site antigo. Trabalhe em cima deste repositÃ³rio e esqueÃ§a o legado.

---

## 1. O protocolo (obrigatÃ³rio, sem exceÃ§Ã£o)

**No inÃ­cio de toda sessÃ£o:**

```
chame a tool  status_brief
```

**Quando o usuÃ¡rio mandar `error`** (sÃ³ essa palavra):

O usuÃ¡rio estÃ¡ com o app aberto e viu um erro no console do navegador na tela atual. Use o browser MCP (`browser_url` + `browser_errors`) para identificar o erro na tela em que ele estÃ¡, diagnostique e **corrija** â€” nÃ£o apenas reporte.

Duas regras obrigatÃ³rias:

1. **NÃƒO recarregue a pÃ¡gina antes de olhar o erro.** O erro pode ser causado por um botÃ£o/funcionalidade especÃ­fico da pÃ¡gina â€” recarregar faz ele sumir e vocÃª perde a causa. Primeiro capture o estado atual (`browser_errors` + `browser_url` + se precisar o que estÃ¡ na tela), sÃ³ entÃ£o recarregue se for necessÃ¡rio.
2. **Depois de corrigir, NÃƒO saia testando de novo.** PeÃ§a ao usuÃ¡rio para testar â€” ele sabe qual botÃ£o/funcionalidade disparou o erro. Recarregar e "ver que passou" nÃ£o prova nada quando o gatilho Ã© uma aÃ§Ã£o do usuÃ¡rio.

O brief devolve, em um bloco curto: o progresso de cada fase, o que estÃ¡ em andamento, quais bloqueios estÃ£o abertos, o que vocÃª pode pegar agora e as decisÃµes jÃ¡ tomadas. **NÃ£o comece a trabalhar sem isso.** VocÃª vai refazer coisa pronta ou desfazer decisÃ£o de outro agente.

**Quando o usuÃ¡rio pedir uma fase inteira** (ex.: "execute a Fase 1"):

```
chame  next_task  com phase="fase-1"
```

Isso devolve exatamente o que estÃ¡ liberado nessa fase, o que estÃ¡ esperando dependÃªncia e o que outro agente jÃ¡ estÃ¡ fazendo. As fases sÃ£o:

| | |
|---|---|
| `fase-0` | GovernanÃ§a multi-agente âœ… |
| `fase-1` | Schema do banco |
| `fase-2` | Infraestrutura (VPS/Docker/Nginx) |
| `fase-3` | AplicaÃ§Ã£o (React + Vite + API) |
| `fase-4` | MCP de operaÃ§Ãµes da VPS |

**Antes de comeÃ§ar uma peÃ§a**, marque-a como `doing` com o seu nome â€” Ã© assim que outro agente sabe que nÃ£o deve pegar a mesma.

**Ao terminar de trabalhar:**

```
chame  set_component_status  para cada peÃ§a que vocÃª mexeu
chame  log_session           com um resumo do que fez
```

**Se travar em algo:**

```
chame  add_blocker
```

**Se decidir algo relevante entre alternativas:**

```
chame  add_decision
```

Toda tool de escrita pede um parÃ¢metro `agent`. Preencha com o seu nome (`claude`, `gemini`, `deepseek`, `codex`). Ã‰ como o usuÃ¡rio sabe quem fez o quÃª.

### O que significa "done" â€” leia isto antes de marcar qualquer coisa

> Existe uma skill global com o detalhamento completo disto: **`entrega-verificada`**
> (em `~/.gemini/config/skills/` para Antigravity). Ative-a se estiver em dÃºvida
> sobre o que conta como pronto. O resumo abaixo Ã© o mÃ­nimo obrigatÃ³rio.

**Escrever o arquivo nÃ£o Ã© terminar a peÃ§a. Terminar Ã© ter rodado e visto passar.**

Antes de marcar `done`, vocÃª Ã© obrigado a:

1. **Instalar o que a peÃ§a precisa** (`npm install`) â€” se vocÃª adicionou dependÃªncia, ela tem que estar instalada.
2. **Executar de verdade.** NÃ£o basta o cÃ³digo "parecer certo".
   - Schema de banco â†’ `npx drizzle-kit generate` gera o SQL, e o SQL aplica num Postgres limpo
   - CÃ³digo TypeScript â†’ `npx tsc --noEmit` sem erro
   - Docker â†’ `docker compose config` valida, e o serviÃ§o sobe
   - MCP â†’ `npm test` passa
3. **Copiar o resultado observado para o campo `evidence`** â€” o comando e o que ele devolveu.

A tool **recusa** `done` sem evidÃªncia. Isso Ã© proposital.

Se vocÃª escreveu o arquivo mas nÃ£o conseguiu executar (falta credencial, o Docker nÃ£o sobe), o status correto Ã© **`doing`**, com uma nota dizendo o que falta verificar. Isso Ã© honesto e Ãºtil. Anunciar conclusÃ£o sem verificaÃ§Ã£o faz o prÃ³ximo agente construir em cima de coisa quebrada â€” que Ã© o caso mais caro de todos.

**NÃ£o anuncie porcentagem de conclusÃ£o** sem que cada peÃ§a tenha evidÃªncia executÃ¡vel. O nÃºmero sai do estado, nÃ£o da sua impressÃ£o.

### DependÃªncias entre componentes

Cada componente pode depender de outros â€” por exemplo, `db.identidade` exige `db.setup` (Drizzle configurado) antes. O mapa estÃ¡ em `mcp/status-server/lib/plan.js`.

Se vocÃª marcar como `doing` ou `done` algo cujas dependÃªncias nÃ£o estÃ£o prontas, a tool **avisa mas nÃ£o impede**. Ã€s vezes hÃ¡ motivo legÃ­timo. Se for o caso, registre o porquÃª com `add_decision` â€” senÃ£o o prÃ³ximo agente vai achar que foi descuido.

Ao criar um componente novo com `add_component`, adicione as dependÃªncias dele em `lib/plan.js`.

### Se o MCP nÃ£o estiver disponÃ­vel na sua sessÃ£o

Alguns harnesses nÃ£o carregam MCP. **NÃ£o improvise** lendo o cÃ³digo do servidor e chamando funÃ§Ãµes com `node -e` â€” isso pula o lock de escrita e as validaÃ§Ãµes, e pode corromper o estado se outro agente escrever ao mesmo tempo.

Use o CLI oficial, que passa exatamente pelas mesmas checagens:

```bash
node mcp/status-server/scripts/cli.js brief
node mcp/status-server/scripts/cli.js next fase-1
node mcp/status-server/scripts/cli.js set db.setup doing --agent gemini --notes "..."
node mcp/status-server/scripts/cli.js session --agent gemini --summary "..." --touched a,b
node mcp/status-server/scripts/cli.js decision --agent gemini --title "..." --decision "..."
node mcp/status-server/scripts/cli.js blocker --agent gemini --desc "..."
```

Rode sem argumento para ver a ajuda completa. E avise o usuÃ¡rio que o MCP nÃ£o carregou, para ele corrigir a configuraÃ§Ã£o.

### Nunca edite o `statusdoprojeto.md` Ã  mÃ£o

Ele Ã© **gerado** a partir de `docs/project-state.json`. Qualquer ediÃ§Ã£o manual Ã© apagada na prÃ³xima escrita via MCP. Se vocÃª acha que falta alguma coisa nele, o caminho Ã© uma tool, nÃ£o o editor.

O motivo: se cada agente escrever markdown livre, em duas semanas o arquivo tem quatro formatos diferentes e ninguÃ©m confia nele. Com operaÃ§Ãµes tipadas, Claude e Gemini produzem exatamente a mesma coisa.

---

## 2. O que Ã© este projeto

O **M7Arena** Ã© uma plataforma de campeonatos de League of Legends em produÃ§Ã£o: times, ranking, salas de partida (5v5, ARAM, 1v1 e Time vs Time), carteira com moeda interna (MP/MC), VIP, recrutamento, streamers e notÃ­cias.

| Camada | Tecnologia |
|---|---|
| Front | React 19 + Vite (SPA) em `web/` |
| API | Node + Express + Drizzle em `api/` |
| Banco | PostgreSQL 16 + PgBouncer na VPS |
| Auth | sessÃ£o prÃ³pria, cookie httpOnly (ADR-011) |
| Realtime | serviÃ§o Node separado (`ws` + `pg` LISTEN/NOTIFY) |
| Infra | Docker Compose + Nginx + TLS na VPS |

NÃ£o hÃ¡ mais "site novo vs site antigo". O M7Arena Ã© a fonte da verdade, o domÃ­nio Ã© `m7arena.pro`, e todo trabalho acontece aqui. Leia `docs/ARQUITETURA.md` antes de escrever cÃ³digo.

---

## 3. Invariantes â€” valem sempre, nÃ£o sÃ£o negociÃ¡veis

### 3.1 O design atual Ã© a referÃªncia. NÃ£o redesenhe sem pedido.

O visual que estÃ¡ no ar Ã© o que o usuÃ¡rio quer manter. Ao mexer numa tela:

- **NÃ£o troque `className`, cores, fontes, tamanhos, espaÃ§amentos ou animaÃ§Ãµes sem o usuÃ¡rio pedir.**
- Quebrar um arquivo grande em vÃ¡rios Ã© **recorte**, nÃ£o redesign. O resultado renderizado tem que ser idÃªntico.
- NÃ£o "melhore" hierarquia visual por conta prÃ³pria. Mesmo que vocÃª ache que fica melhor.
- **Cantos recortados COM borda: SEMPRE o componente `CutCard`** (`web/src/components/ui/CutCard.tsx`). `border` + `clipPath` no mesmo elemento **corta a borda** nas diagonais. Regra completa: `docs/CANTOS_RECORTADOS.md`.

Se uma tela mostra um dado que deixou de existir no modelo, **nÃ£o decida sozinho**: registre um `add_blocker` e pergunte ao usuÃ¡rio.

### 3.2 Nenhuma regra de negÃ³cio no cliente

Pagamento, resultado de partida, cÃ¡lculo de saldo, classificaÃ§Ã£o de campeonato e permissÃ£o sÃ£o decididos **no servidor**. O cliente exibe o resultado.

### 3.3 Nenhum segredo no bundle

Chave de API sÃ³ em cÃ³digo de servidor. Nada de `VITE_*` para credencial â€” tudo que comeÃ§a com `VITE_` vai para o bundle e qualquer visitante consegue ler. A `RIOT_API_KEY` e o token do Mercado Pago ficam sÃ³ na API.

### 3.4 Migrations reconstroem o banco inteiro

Toda mudanÃ§a de schema entra como migration versionada em `db/migrations/`. Um `git clone` + rodar as migrations tem que produzir o banco completo. Nunca altere o banco de produÃ§Ã£o "na mÃ£o" sem gerar a migration correspondente.

### 3.5 EvidÃªncia Ã© nÃºmero que cai, nÃ£o comando que passa

`npx tsc --noEmit â†’ exit 0` passa lindamente numa API que **ninguÃ©m importa**. JÃ¡ aconteceu de oito `app.swap.*` serem marcados `done` com endpoints escritos e **zero** chamadas migradas no front.

Regra que sai disso:

- **Se a tarefa Ã© remover algo, a evidÃªncia Ã© a contagem caindo** â€” nÃ£o um build passando. Para os domÃ­nios que ainda falam com o Supabase existe `node scripts/verify-swap.js`, que conta as ocorrÃªncias em `web/src` por domÃ­nio e por arquivo.
- **Isso nÃ£o Ã© honra, Ã© portÃ£o.** Para todo `app.swap.*`, mais `app.auth.sessao` e `app.storage.uploads`, o prÃ³prio MCP roda o `verify-swap.js` quando vocÃª chama `set_component_status ... done` e **recusa** se sobrar ocorrÃªncia â€” pelo MCP e pelo CLI. Ver `mcp/status-server/lib/gates.js`.
- **Criar o endpoint nÃ£o Ã© fazer o swap.** O swap sÃ³ existe quando o front deixa de chamar o antigo.
- **Nunca cite como evidÃªncia um arquivo que vocÃª escreveu mas nÃ£o executou**, nem um comando que roda numa parte do sistema diferente da que a tarefa mudou.

> Ainda existem chamadas ao Supabase em `web/src` (recrutamento, VIP/edge functions, transmissÃµes, votos e resultados). Elas sÃ£o dÃ­vida tÃ©cnica real e estÃ£o no status â€” nÃ£o finja que o site jÃ¡ Ã© 100% prÃ³prio.

### 3.6 Nenhum arquivo passa de ~400 linhas

Se passou, Ã© hora de recortar. Existem arquivos herdados grandes (`CampeonatoDetalhes.tsx` passa de 5 mil linhas); **ao mexer neles, recorte dentro do domÃ­nio** â€” nÃ£o faÃ§a uma tarefa isolada de "quebrar arquivo", para nÃ£o misturar recorte com mudanÃ§a de comportamento. Arquivo novo obedece ao limite desde a primeira linha.

---

## 4. Onde fica cada coisa

```
M7arenaSite/
â”œâ”€â”€ AGENTS.md                    â† vocÃª estÃ¡ aqui (fonte Ãºnica de regras)
â”œâ”€â”€ CLAUDE.md, GEMINI.md         â† ponteiros para este arquivo
â”œâ”€â”€ statusdoprojeto.md           â† GERADO. NÃ£o edite.
â”œâ”€â”€ docs/
â”‚   â”œâ”€â”€ project-state.json       â† fonte da verdade do status
â”‚   â”œâ”€â”€ status-log.jsonl         â† histÃ³rico append-only
â”‚   â”œâ”€â”€ ARQUITETURA.md           â† stack, camadas, pastas, deploy
â”‚   â”œâ”€â”€ DESIGN_SYSTEM.md         â† cores, recortes e padrÃµes visuais
â”‚   â”œâ”€â”€ CANTOS_RECORTADOS.md     â† regra do CutCard
â”‚   â”œâ”€â”€ RIOT_TORNEIOS_COMUNIDADE.md
â”‚   â”œâ”€â”€ ROTINA_SORTEIO_COPAS.md  â† sorteio semanal das copas
â”‚   â””â”€â”€ SALAS_APOSTADAS.md       â† regras de escrow/revisÃ£o das salas
â”œâ”€â”€ mcp/
â”‚   â”œâ”€â”€ status-server/           â† MCP m7-status
â”‚   â””â”€â”€ ops-server/              â† MCP de operaÃ§Ãµes da VPS
â”œâ”€â”€ db/                          â† schema Drizzle + migrations
â”œâ”€â”€ infra/                       â† docker-compose, nginx, postgresql.conf
â”œâ”€â”€ scripts/                     â† smokes, verify-swap, sorteio das copas
â”œâ”€â”€ web/                         â† front React + Vite (SPA em produÃ§Ã£o)
â””â”€â”€ api/                         â† API Node + Drizzle (serviÃ§o `app`)
```

NÃ£o existe mais `src/` na raiz nem configuraÃ§Ã£o de Next. Se algo apontar para eles, Ã© resÃ­duo â€” remova.

---

## 5. ConvenÃ§Ãµes de cÃ³digo

- **TypeScript com `strict: true`.**
- Componentes `PascalCase.tsx`, hooks `useCamelCase.ts`, constantes `SCREAMING_SNAKE_CASE`.
- DomÃ­nios com regra prÃ³pria ficam em `web/src/features/<dominio>/` (`components/`, `hooks/`, e regras puras quando fizer sentido). O acesso a dados passa por `web/src/lib/api.ts` e pelos mÃ³dulos de `web/src/api/`.
- **Nunca engula erro.** `catch {}` vazio Ã© proibido. Falha de escrita invisÃ­vel Ã© pior que erro na tela.
- Textos de interface em portuguÃªs do Brasil.
- ComentÃ¡rios explicam **por quÃª**, nÃ£o o quÃª.

---

## 6. Antes de pedir para rodar algo

O usuÃ¡rio estÃ¡ no Windows com PowerShell. Ele tem Node 24, Docker 29 e git instalados.

- A VPS existe e estÃ¡ em produÃ§Ã£o (`/root/m7arena`, serviÃ§os `m7arena_app`, `m7arena_realtime`, `m7arena_nginx`, `m7arena_postgres`). O deploy Ã© feito por lÃ¡.
- **NÃ£o rode migration contra o banco de produÃ§Ã£o sem o usuÃ¡rio pedir.**
- **NÃ£o commite sem ele pedir.**
- NÃ£o invente comando de deploy: siga o que estÃ¡ em `docs/ARQUITETURA.md`.

---

## 7. Resumo em cinco linhas

1. `status_brief` antes de tudo.
2. O design atual Ã© a referÃªncia â€” nÃ£o redesenhe sem pedido.
3. Regra de negÃ³cio e segredo ficam no servidor.
4. EvidÃªncia Ã© execuÃ§Ã£o real, nÃ£o arquivo escrito.
5. `set_component_status` + `log_session` antes de encerrar.

---

## 8. Rotina recorrente: sorteio semanal das copas

Quando o usuÃ¡rio pedir algo como **"segue com o sorteio da copa do Kraken"** (ou Tesouro, ou as duas), **nÃ£o releia o cÃ³digo**: o procedimento estÃ¡ pronto em `docs/ROTINA_SORTEIO_COPAS.md` e o script em `scripts/campeonatos/sortear-semana.mjs`. O resumo Ã©:

```powershell
scp scripts/campeonatos/sortear-semana.mjs pandapost-vps:/root/m7arena/sortear-semana.mjs
ssh pandapost-vps "docker cp /root/m7arena/sortear-semana.mjs m7arena_app:/app/sortear-semana.mjs"
ssh pandapost-vps "docker exec -w /app m7arena_app node sortear-semana.mjs kraken --dry-run"  # prÃ©via
ssh pandapost-vps "docker exec -w /app m7arena_app node sortear-semana.mjs kraken"            # aplicar
```

ConvenÃ§Ã£o (ADR-068): 2 adversÃ¡rios inÃ©ditos por time = 8 jogos por copa, pendentes de fase de grupos (`A COMBINAR`). O script valida em transaÃ§Ã£o (0 pares repetidos) e imprime o que sobra para a prÃ³xima semana. Depois de aplicar, confirme pela API (`dev.m7arena.pro`) e registre `log_session`.

