# AGENTS.md — Regras do projeto M7Arena

**Este arquivo é a fonte única de regras.** Vale para todo agente: Claude, Gemini, DeepSeek, Codex, Cursor, ou qualquer outro.

Você provavelmente está entrando neste projeto sem ter visto nada do que foi conversado antes. Este documento e o MCP `m7-status` existem exatamente por isso.

> **Contexto em uma linha:** o M7Arena é o projeto original e está em produção em `m7arena.pro`. Não existe mais migração do site antigo. Trabalhe em cima deste repositório e esqueça o legado.

---

## 1. O protocolo (obrigatório, sem exceção)

**No início de toda sessão:**

```
chame a tool  status_brief
```

**Quando o usuário mandar `error`** (só essa palavra):

O usuário está com o app aberto e viu um erro no console do navegador na tela atual. Use o browser MCP (`browser_url` + `browser_errors`) para identificar o erro na tela em que ele está, diagnostique e **corrija** — não apenas reporte.

Duas regras obrigatórias:

1. **NÃO recarregue a página antes de olhar o erro.** O erro pode ser causado por um botão/funcionalidade específico da página — recarregar faz ele sumir e você perde a causa. Primeiro capture o estado atual (`browser_errors` + `browser_url` + se precisar o que está na tela), só então recarregue se for necessário.
2. **Depois de corrigir, NÃO saia testando de novo.** Peça ao usuário para testar — ele sabe qual botão/funcionalidade disparou o erro. Recarregar e "ver que passou" não prova nada quando o gatilho é uma ação do usuário.

O brief devolve, em um bloco curto: o progresso de cada fase, o que está em andamento, quais bloqueios estão abertos, o que você pode pegar agora e as decisões já tomadas. **Não comece a trabalhar sem isso.** Você vai refazer coisa pronta ou desfazer decisão de outro agente.

**Quando o usuário pedir uma fase inteira** (ex.: "execute a Fase 1"):

```
chame  next_task  com phase="fase-1"
```

Isso devolve exatamente o que está liberado nessa fase, o que está esperando dependência e o que outro agente já está fazendo. As fases são:

| | |
|---|---|
| `fase-0` | Governança multi-agente ✅ |
| `fase-1` | Schema do banco |
| `fase-2` | Infraestrutura (VPS/Docker/Nginx) |
| `fase-3` | Aplicação (React + Vite + API) |
| `fase-4` | MCP de operações da VPS |

**Antes de começar uma peça**, marque-a como `doing` com o seu nome — é assim que outro agente sabe que não deve pegar a mesma.

**Ao terminar de trabalhar:**

```
chame  set_component_status  para cada peça que você mexeu
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

Toda tool de escrita pede um parâmetro `agent`. Preencha com o seu nome (`claude`, `gemini`, `deepseek`, `codex`). É como o usuário sabe quem fez o quê.

### O que significa "done" — leia isto antes de marcar qualquer coisa

> Existe uma skill global com o detalhamento completo disto: **`entrega-verificada`**
> (em `~/.gemini/config/skills/` para Antigravity). Ative-a se estiver em dúvida
> sobre o que conta como pronto. O resumo abaixo é o mínimo obrigatório.

**Escrever o arquivo não é terminar a peça. Terminar é ter rodado e visto passar.**

Antes de marcar `done`, você é obrigado a:

1. **Instalar o que a peça precisa** (`npm install`) — se você adicionou dependência, ela tem que estar instalada.
2. **Executar de verdade.** Não basta o código "parecer certo".
   - Schema de banco → `npx drizzle-kit generate` gera o SQL, e o SQL aplica num Postgres limpo
   - Código TypeScript → `npx tsc --noEmit` sem erro
   - Docker → `docker compose config` valida, e o serviço sobe
   - MCP → `npm test` passa
3. **Copiar o resultado observado para o campo `evidence`** — o comando e o que ele devolveu.

A tool **recusa** `done` sem evidência. Isso é proposital.

Se você escreveu o arquivo mas não conseguiu executar (falta credencial, o Docker não sobe), o status correto é **`doing`**, com uma nota dizendo o que falta verificar. Isso é honesto e útil. Anunciar conclusão sem verificação faz o próximo agente construir em cima de coisa quebrada — que é o caso mais caro de todos.

**Não anuncie porcentagem de conclusão** sem que cada peça tenha evidência executável. O número sai do estado, não da sua impressão.

### Dependências entre componentes

Cada componente pode depender de outros — por exemplo, `db.identidade` exige `db.setup` (Drizzle configurado) antes. O mapa está em `mcp/status-server/lib/plan.js`.

Se você marcar como `doing` ou `done` algo cujas dependências não estão prontas, a tool **avisa mas não impede**. Às vezes há motivo legítimo. Se for o caso, registre o porquê com `add_decision` — senão o próximo agente vai achar que foi descuido.

Ao criar um componente novo com `add_component`, adicione as dependências dele em `lib/plan.js`.

### Se o MCP não estiver disponível na sua sessão

Alguns harnesses não carregam MCP. **Não improvise** lendo o código do servidor e chamando funções com `node -e` — isso pula o lock de escrita e as validações, e pode corromper o estado se outro agente escrever ao mesmo tempo.

Use o CLI oficial, que passa exatamente pelas mesmas checagens:

```bash
node mcp/status-server/scripts/cli.js brief
node mcp/status-server/scripts/cli.js next fase-1
node mcp/status-server/scripts/cli.js set db.setup doing --agent gemini --notes "..."
node mcp/status-server/scripts/cli.js session --agent gemini --summary "..." --touched a,b
node mcp/status-server/scripts/cli.js decision --agent gemini --title "..." --decision "..."
node mcp/status-server/scripts/cli.js blocker --agent gemini --desc "..."
```

Rode sem argumento para ver a ajuda completa. E avise o usuário que o MCP não carregou, para ele corrigir a configuração.

### Nunca edite o `statusdoprojeto.md` à mão

Ele é **gerado** a partir de `docs/project-state.json`. Qualquer edição manual é apagada na próxima escrita via MCP. Se você acha que falta alguma coisa nele, o caminho é uma tool, não o editor.

O motivo: se cada agente escrever markdown livre, em duas semanas o arquivo tem quatro formatos diferentes e ninguém confia nele. Com operações tipadas, Claude e Gemini produzem exatamente a mesma coisa.

---

## 1.1 Multi-agente: worktree e commit na main (obrigatório)

- Cada agente/terminal trabalha no **seu próprio `git worktree`**. Nunca trabalhe na pasta principal compartilhada nem no worktree de outro agente.
- Antes de começar: `git fetch origin`, atualize seu worktree a partir da `main` e confira `git status`.
- **Toda mudança tem que ser commitada e enviada para a `main` antes de encerrar a tarefa.** Não deixe alteração só no worktree nem "para depois".
- Commits pequenos e claros. No fim: `git add -A`, `git commit`, `git push origin main` (ou PR já mergeado). O que não está na main não existe para os outros agentes.
- Nunca `force-push`, `reset --hard` ou `checkout -f` na main nem no worktree de outro agente. Se outro agente estiver no mesmo arquivo, pare e combine.
- O deploy é na VPS e **somente a partir da main commitada**. Nunca suba um worktree sujo nem uma branch local. Depois valide `/api/health` e os chunks.
- Na VPS, compose sempre com `--env-file /root/m7arena/.env`; sem isso o app sobe com senha default (ADR-015/BLK-007).

---

## 1.2 Modo local vs VPS (padrão: VPS)

Por padrão, quando a tarefa muda o runtime (web/API/infra), o fluxo é **implementar, validar, commitar/pushar na main e subir na VPS** ao final, seguindo o deploy documentado. Tarefas só de docs/status não precisam de deploy.

Quando o usuário disser **"trabalhar local"**, **"editar local"**, **"só local"**, **"não sobe"** ou equivalente:

- edite e valide localmente; **não suba para a VPS** ainda;
- commite e envie para a main (regra 1.1), mas deixe claro que **ainda não está na VPS**;
- só suba quando o usuário disser **"sobe"**, **"pode subir"**, **"aplica na VPS"** ou equivalente;
- o modo local vale para a tarefa/lote atual; uma nova solicitação sem "local" volta ao padrão VPS.

Aqui, "local" significa **commitado na main, mas ainda não aplicado na VPS**. Trabalho não commitado é proibido pela regra 1.1.

**Se o usuário esquecer de pedir para subir:**

- no início da sessão/tarefa e ao terminar cada bloco local, compare `origin/main` com o commit da VPS (`ssh pandapost-vps "cd /root/m7arena && git rev-parse --short HEAD"`, ou o marcador de deploy);
- se houver mudança de runtime na main que não está na VPS, avise uma vez, curto: "⚠️ Há mudanças de runtime na main que ainda não estão na VPS (apenas local: X..Y). Quer subir agora?";
- não repita o aviso a cada mensagem; avise no início, no fim do bloco e antes de encerrar;
- em modo local, **nunca** faça deploy sem o "pode subir".

O deploy é na VPS e só da main commitada; nunca de worktree sujo. Depois de subir, valide `/api/health`, o bundle e a rota principal.

---

## 2. O que é este projeto

O **M7Arena** é uma plataforma de campeonatos de League of Legends em produção: times, ranking, salas de partida (5v5, ARAM, 1v1 e Time vs Time), carteira com moeda interna (MP/MC), VIP, recrutamento, streamers e notícias.

| Camada | Tecnologia |
|---|---|
| Front | React 19 + Vite (SPA) em `web/` |
| API | Node + Express + Drizzle em `api/` |
| Banco | PostgreSQL 16 + PgBouncer na VPS |
| Auth | sessão própria, cookie httpOnly (ADR-011) |
| Realtime | serviço Node separado (`ws` + `pg` LISTEN/NOTIFY) |
| Infra | Docker Compose + Nginx + TLS na VPS |

Não há mais "site novo vs site antigo". O M7Arena é a fonte da verdade, o domínio é `m7arena.pro`, e todo trabalho acontece aqui. Leia `docs/ARQUITETURA.md` antes de escrever código.

---

## 3. Invariantes — valem sempre, não são negociáveis

### 3.1 O design atual é a referência. Não redesenhe sem pedido.

O visual que está no ar é o que o usuário quer manter. Ao mexer numa tela:

- **Não troque `className`, cores, fontes, tamanhos, espaçamentos ou animações sem o usuário pedir.**
- Quebrar um arquivo grande em vários é **recorte**, não redesign. O resultado renderizado tem que ser idêntico.
- Não "melhore" hierarquia visual por conta própria. Mesmo que você ache que fica melhor.
- **Cantos recortados COM borda: SEMPRE o componente `CutCard`** (`web/src/components/ui/CutCard.tsx`). `border` + `clipPath` no mesmo elemento **corta a borda** nas diagonais. Regra completa: `docs/CANTOS_RECORTADOS.md`.

Se uma tela mostra um dado que deixou de existir no modelo, **não decida sozinho**: registre um `add_blocker` e pergunte ao usuário.

### 3.2 Nenhuma regra de negócio no cliente

Pagamento, resultado de partida, cálculo de saldo, classificação de campeonato e permissão são decididos **no servidor**. O cliente exibe o resultado.

### 3.3 Nenhum segredo no bundle

Chave de API só em código de servidor. Nada de `VITE_*` para credencial — tudo que começa com `VITE_` vai para o bundle e qualquer visitante consegue ler. A `RIOT_API_KEY` e o token do Mercado Pago ficam só na API.

### 3.4 Migrations reconstroem o banco inteiro

Toda mudança de schema entra como migration versionada em `db/migrations/`. Um `git clone` + rodar as migrations tem que produzir o banco completo. Nunca altere o banco de produção "na mão" sem gerar a migration correspondente.

### 3.5 Evidência é número que cai, não comando que passa

`npx tsc --noEmit → exit 0` passa lindamente numa API que **ninguém importa**. Já aconteceu de oito `app.swap.*` serem marcados `done` com endpoints escritos e **zero** chamadas migradas no front.

Regra que sai disso:

- **Se a tarefa é remover algo, a evidência é a contagem caindo** — não um build passando. `node scripts/verify-swap.js` conta qualquer chamada ao Supabase em `web/src`; hoje tem que sair **0**.
- **Isso não é honra, é portão.** Para todo `app.swap.*`, mais `app.auth.sessao` e `app.storage.uploads`, o próprio MCP roda o `verify-swap.js` quando você chama `set_component_status ... done` e **recusa** se sobrar ocorrência — pelo MCP e pelo CLI. Ver `mcp/status-server/lib/gates.js`.
- **Criar o endpoint não é fazer o swap.** O swap só existe quando o front deixa de chamar o antigo.
- **Nunca cite como evidência um arquivo que você escreveu mas não executou**, nem um comando que roda numa parte do sistema diferente da que a tarefa mudou.

> O front não fala mais com o Supabase: `node scripts/verify-swap.js` deve sair com 0 ocorrências. Se aparecer chamada nova, é regressão — não reintroduza.

### 3.6 Nenhum arquivo passa de ~400 linhas

Se passou, é hora de recortar. Existem arquivos herdados grandes (`CampeonatoDetalhes.tsx` passa de 5 mil linhas); **ao mexer neles, recorte dentro do domínio** — não faça uma tarefa isolada de "quebrar arquivo", para não misturar recorte com mudança de comportamento. Arquivo novo obedece ao limite desde a primeira linha.

---

## 4. Onde fica cada coisa

```
M7arenaSite/
├── AGENTS.md                    ← você está aqui (fonte única de regras)
├── statusdoprojeto.md           ← GERADO. Não edite.
├── docs/
│   ├── project-state.json       ← fonte da verdade do status
│   ├── status-log.jsonl         ← histórico append-only
│   ├── ARQUITETURA.md           ← stack, camadas, pastas, deploy
│   ├── DESIGN_SYSTEM.md         ← cores, recortes e padrões visuais
│   ├── CANTOS_RECORTADOS.md     ← regra do CutCard
│   ├── RIOT_TORNEIOS_COMUNIDADE.md
│   ├── ROTINA_SORTEIO_COPAS.md  ← sorteio semanal das copas
│   └── SALAS_APOSTADAS.md       ← regras de escrow/revisão das salas
├── mcp/
│   ├── status-server/           ← MCP m7-status
│   └── ops-server/              ← MCP de operações da VPS
├── db/                          ← schema Drizzle + migrations
├── infra/                       ← docker-compose, nginx, postgresql.conf
├── scripts/                     ← smokes, verify-swap, sorteio das copas
├── web/                         ← front React + Vite (SPA em produção)
└── api/                         ← API Node + Drizzle (serviço `app`)
```

Não existe mais `src/` na raiz nem configuração de Next. Se algo apontar para eles, é resíduo — remova.

---

## 5. Convenções de código

- **TypeScript com `strict: true`.**
- Componentes `PascalCase.tsx`, hooks `useCamelCase.ts`, constantes `SCREAMING_SNAKE_CASE`.
- Domínios com regra própria ficam em `web/src/features/<dominio>/` (`components/`, `hooks/`, e regras puras quando fizer sentido). O acesso a dados passa por `web/src/lib/api.ts` e pelos módulos de `web/src/api/`.
- **Nunca engula erro.** `catch {}` vazio é proibido. Falha de escrita invisível é pior que erro na tela.
- Textos de interface em português do Brasil.
- Comentários explicam **por quê**, não o quê.

---

## 6. Antes de pedir para rodar algo

O usuário está no Windows com PowerShell. Ele tem Node 24, Docker 29 e git instalados.

- A VPS existe e está em produção (`/root/m7arena`, serviços `m7arena_app`, `m7arena_realtime`, `m7arena_nginx`, `m7arena_postgres`). O deploy é feito por lá.
- **Não rode migration contra o banco de produção sem o usuário pedir.**
- **Commite e envie para a main ao terminar**; não deixe trabalho só no worktree.
- Não invente comando de deploy: siga o que está em `docs/ARQUITETURA.md` e só suba da main commitada.

---

## 7. Resumo em cinco linhas

1. `status_brief` antes de tudo.
2. O design atual é a referência — não redesenhe sem pedido.
3. Regra de negócio e segredo ficam no servidor.
4. Evidência é execução real, não arquivo escrito.
5. `set_component_status` + `log_session` antes de encerrar.

---

## 8. Rotina recorrente: sorteio semanal das copas

Quando o usuário pedir algo como **"segue com o sorteio da copa do Kraken"** (ou Tesouro, ou as duas), **não releia o código**: o procedimento está pronto em `docs/ROTINA_SORTEIO_COPAS.md` e o script em `scripts/campeonatos/sortear-semana.mjs`. O resumo é:

```powershell
scp scripts/campeonatos/sortear-semana.mjs pandapost-vps:/root/m7arena/sortear-semana.mjs
ssh pandapost-vps "docker cp /root/m7arena/sortear-semana.mjs m7arena_app:/app/sortear-semana.mjs"
ssh pandapost-vps "docker exec -w /app m7arena_app node sortear-semana.mjs kraken --dry-run"  # prévia
ssh pandapost-vps "docker exec -w /app m7arena_app node sortear-semana.mjs kraken"            # aplicar
```

Convenção (ADR-068): 2 adversários inéditos por time = 8 jogos por copa, pendentes de fase de grupos (`A COMBINAR`). O script valida em transação (0 pares repetidos) e imprime o que sobra para a próxima semana. Depois de aplicar, confirme pela API (`dev.m7arena.pro`) e registre `log_session`.
