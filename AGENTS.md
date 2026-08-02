# AGENTS.md — Regras do projeto M7Arena

**Este arquivo é a fonte única de regras.** Vale para todo agente: Claude, Gemini, DeepSeek, Codex, Cursor, ou qualquer outro. `CLAUDE.md` e `GEMINI.md` apenas apontam para cá.

Você provavelmente está entrando neste projeto sem ter visto nada do que foi conversado antes. Este documento e o MCP `m7-status` existem exatamente por isso.

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

Isso devolve, em um bloco curto: o progresso de cada fase, o que está em andamento, quais bloqueios estão abertos, o que você pode pegar agora e as decisões já tomadas. **Não comece a trabalhar sem isso.** Você vai refazer coisa pronta ou desfazer decisão de outro agente.

**Quando o usuário pedir uma fase inteira** (ex.: "execute a Fase 1"):

```
chame  next_task  com phase="fase-1"
```

Isso devolve exatamente o que está liberado nessa fase, o que está esperando dependência e o que outro agente já está fazendo. As fases são:

| | |
|---|---|
| `fase-0` | Governança multi-agente ✅ concluída |
| `fase-1` | Schema do banco |
| `fase-2` | Infraestrutura (Docker/VPS) |
| `fase-3` | Aplicação (port visual 1:1) |
| `fase-4` | MCP de operações da VPS |
| `fase-5` | Migração de dados e cutover |

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

Isto não é teoria: um agente já marcou os 11 componentes da Fase 1 como concluídos anunciando "100% finalizado", quando na verdade as dependências nunca tinham sido instaladas, as migrations nunca tinham sido geradas, e o schema **nem compilava** — faltava um `import` de `integer` em `db/schema/conteudo.ts`. Nada daquilo tinha sido executado uma única vez.

Antes de marcar `done`, você é obrigado a:

1. **Instalar o que a peça precisa** (`npm install`) — se você adicionou dependência, ela tem que estar instalada.
2. **Executar de verdade.** Não basta o código "parecer certo".
   - Schema de banco → `npx drizzle-kit generate` gera o SQL, e o SQL aplica num Postgres limpo
   - Código TypeScript → `npx tsc --noEmit` sem erro
   - Docker → `docker compose config` valida, e o serviço sobe
   - MCP → `npm test` passa
3. **Copiar o resultado observado para o campo `evidence`** — o comando e o que ele devolveu.

A tool **recusa** `done` sem evidência. Isso é proposital.

Se você escreveu o arquivo mas não conseguiu executar (falta a VPS, falta credencial, o Docker não sobe), o status correto é **`doing`**, com uma nota dizendo o que falta verificar. Isso é honesto e útil. Anunciar conclusão sem verificação faz o próximo agente construir em cima de coisa quebrada — que é o caso mais caro de todos.

**Não anuncie porcentagem de conclusão** ("Fase 1 100% concluída") sem que cada peça tenha evidência executável. O número sai do estado, não da sua impressão.

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

## 2. O que é este projeto

O M7Arena é a **reescrita do motor** de um site que já existe e funciona.

| | Site atual | Site novo |
|---|---|---|
| Pasta | `D:\Aplicativos\M7AcademySite` | `D:\Aplicativos\M7arenaSite` (aqui) |
| Domínio | m7academy.pro | m7arena.pro |
| Front | React 19 + Vite (SPA) | **o mesmo, forkado sem alteração** (ADR-010) |
| Banco | Supabase | PostgreSQL em VPS própria |
| Auth | Supabase Auth (GoTrue) | sessão própria, cookie httpOnly (ADR-011) |
| Hospedagem | Vercel | VPS (2 vCPU, 8 GB, 100 GB NVMe) + Docker + Nginx |

É uma plataforma de campeonatos de League of Legends: times, ranking, salas de partida, carteira com moeda interna (MP/MC), VIP, recrutamento, streamers e notícias.

**O site antigo continua no ar durante tudo isso.** Ele é o fallback.

Leia `docs/ARQUITETURA.md` antes de escrever código, e `docs/PLANO_MIGRACAO.md` para entender a ordem das fases.

---

## 3. Invariantes — valem sempre, não são negociáveis

### 3.1 O design é cópia 1:1. Não redesenhe nada.

Esta é a regra que o usuário mais reforçou. O site novo tem que ser **visualmente indistinguível** do atual: mesmas cores, fontes, ícones, imagens, espaçamentos, tamanhos e layout.

Ao portar uma tela:

- **Recorte e cole o JSX.** Não reescreva.
- **Não toque em nenhum `className`.** As classes Tailwind vão como estão.
- Quebrar um arquivo grande em vários é **recorte**, não redesign. O resultado renderizado tem que ser idêntico.
- Não "melhore" espaçamento, cor, sombra, animação ou hierarquia visual. Mesmo que você ache que fica melhor.

O que **muda** ao portar (nada disso altera o visual):

| Antes | Depois |
|---|---|
| `import { supabase }` + query no componente | camada `features/<dominio>/server` |
| `useEffect(() => fetch)` | Server Component ou hook do padrão novo |
| `<Link to>` (react-router) | `<Link href>` (next/link) |
| `useNavigate()` / `useParams()` | `useRouter()` / `params` (next/navigation) |
| `<img src>` | `next/image`, mesmo arquivo e mesmo tamanho renderizado |
| regra de negócio no cliente | servidor |

Se uma tela mostra um dado que deixou de existir no modelo novo, **não decida sozinho**: registre um `add_blocker` e pergunte ao usuário.

### 3.2 Não toque no m7academy.pro

`D:\Aplicativos\M7AcademySite` é **somente leitura**. Você pode ler para copiar JSX, entender uma regra ou conferir o visual. Nunca edite, nunca rode migration lá, nunca mexa no Supabase de produção.

### 3.3 Nenhuma regra de negócio no cliente

Pagamento, resultado de partida, cálculo de saldo, classificação de campeonato e permissão são decididos **no servidor**. O cliente exibe o resultado.

Isso é uma correção direta do site atual, onde o navegador decide quem venceu a partida e quanto cada um recebe.

### 3.4 Nenhum segredo no bundle

Chave de API só em código de servidor. Nada de `NEXT_PUBLIC_*` para credencial.

No site atual a chave da Riot API está no bundle e qualquer visitante consegue extrair. Não repita.

### 3.5 Migrations reconstroem o banco inteiro

Toda mudança de schema entra como migration versionada. Um `git clone` + rodar as migrations tem que produzir o banco completo.

No site atual isso falhou: cerca de 15 tabelas em produção nunca tiveram `CREATE TABLE` versionado — existem só num dump.

### 3.5b Evidência é número que cai, não comando que passa

`npx tsc --noEmit → exit 0` passa lindamente numa API que **ninguém importa**. Em 2026-08-02 os oito `app.swap.*` foram marcados `done` exatamente assim: endpoints escritos, `exit 0` em tudo, e **zero** chamadas migradas no front. O painel dizia 58/58 com o app inteiro ainda rodando no Supabase.

Regra que sai disso:

- **Se a tarefa é remover algo, a evidência é a contagem caindo** — não um build passando. Para os swaps existe `node scripts/verify-swap.js`, que conta o que ainda fala com o Supabase em `web/src`, quebrado por domínio e por arquivo. Nenhum `app.swap.*` fecha sem o contador dele em 0.
- **Isso não é honra, é portão.** Para todo `app.swap.*`, mais `app.auth.sessao` e `app.storage.uploads`, o próprio MCP roda o `verify-swap.js` quando você chama `set_component_status ... done` e **recusa** se sobrar qualquer ocorrência — pelo MCP e pelo CLI. Não adianta escrever uma evidência melhor: quem mede é o servidor. Ver `mcp/status-server/lib/gates.js`.
- **Criar o endpoint não é fazer o swap.** O swap só existe quando o front deixa de chamar o antigo.
- **Nunca cite como evidência um arquivo que você escreveu mas não executou**, nem um comando que roda numa parte do sistema diferente da que a tarefa mudou.

### 3.6 Nenhum arquivo passa de ~400 linhas

Se passou, é hora de recortar. O site atual tem um componente de 4.482 linhas com 2.674 de JSX num único `return`. É intratável tanto para humano quanto para agente.

> **Ressalva da ADR-010, com prazo.** O fork do app original traz arquivos que já nascem violando isso (`CampeonatoDetalhes.tsx` tem 5.856 linhas). Durante a Etapa 3A — a cópia — **este invariante fica suspenso**: recortar arquivo enquanto copia é reescrita disfarçada, e foi exatamente o que fez o port anterior perder a paridade visual. Arquivo **novo** (API, sdk, auth) obedece ao limite desde a primeira linha. O corte dos arquivos herdados acontece dentro de cada `app.swap.*`, junto com a troca de dados — nunca como tarefa isolada. Detalhes em `docs/PLANO_MIGRACAO.md` seção 9.

---

## 4. Onde fica cada coisa

```
M7arenaSite/
├── AGENTS.md                    ← você está aqui (fonte única de regras)
├── CLAUDE.md, GEMINI.md         ← ponteiros para este arquivo
├── statusdoprojeto.md           ← GERADO. Não edite.
├── docs/
│   ├── project-state.json       ← fonte da verdade do status
│   ├── status-log.jsonl         ← histórico append-only
│   ├── ARQUITETURA.md           ← modelo de domínio, camadas, schema novo
│   └── PLANO_MIGRACAO.md        ← fases, mapeamento de dados, cutover
├── mcp/
│   ├── status-server/           ← o MCP m7-status
│   └── ops-server/              ← MCP de operações da VPS (fase 4)
├── db/                          ← schema Drizzle + migrations
├── infra/                       ← docker-compose, postgresql.conf, nginx
├── scripts/migrate/             ← extract/transform/load do Supabase
├── web/                         ← o fork React+Vite (ADR-010). O front vive aqui.
├── api/                         ← servidor de API Node + Drizzle (serviço `app`)
└── src/                         ← MORTO: port em Next descartado pela ADR-010.
                                    Preservado no commit 3e8fd68. Não trabalhe aqui.
```

---

## 5. Convenções de código

- **TypeScript com `strict: true`.** (O projeto antigo não tinha nenhuma flag de strictness — não repita.)
- Componentes `PascalCase.tsx`, hooks `useCamelCase.ts`, constantes `SCREAMING_SNAKE_CASE`.
- Um domínio por pasta em `src/features/`, com `domain/` (regras puras, sem React), `server/` (acesso a dados), `components/` e `hooks/`.
- **Nunca engula erro.** `catch {}` vazio é proibido. O site atual tem 17 deles, e por causa disso falhas de escrita são invisíveis.
- Textos de interface em português do Brasil.
- Comentários explicam **por quê**, não o quê.

---

## 6. Antes de pedir para rodar algo

O usuário está no Windows com PowerShell. Ele tem Node 24, Docker 29 e git instalados.

- Não invente comando de deploy: a VPS ainda não foi contratada (componente `infra.vps`, pendente).
- Não rode migration contra o Supabase de produção. Nunca.
- Não commite sem ele pedir.

---

## 7. Resumo em cinco linhas

1. `status_brief` antes de tudo.
2. O design é cópia — não redesenhe, não mexa em `className`.
3. O site antigo é somente leitura.
4. Regra de negócio e segredo ficam no servidor.
5. `set_component_status` + `log_session` antes de encerrar.
