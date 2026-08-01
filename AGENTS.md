# AGENTS.md — Regras do projeto M7Arena

**Este arquivo é a fonte única de regras.** Vale para todo agente: Claude, Gemini, DeepSeek, Codex, Cursor, ou qualquer outro. `CLAUDE.md` e `GEMINI.md` apenas apontam para cá.

Você provavelmente está entrando neste projeto sem ter visto nada do que foi conversado antes. Este documento e o MCP `m7-status` existem exatamente por isso.

---

## 1. O protocolo (obrigatório, sem exceção)

**No início de toda sessão:**

```
chame a tool  status_brief
```

Isso devolve, em um bloco curto: o que está em andamento, quais bloqueios estão abertos, os próximos passos e as decisões já tomadas. **Não comece a trabalhar sem isso.** Você vai refazer coisa pronta ou desfazer decisão de outro agente.

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
| Front | React 19 + Vite (SPA) | Next.js 15 (App Router) |
| Banco | Supabase | PostgreSQL em VPS própria |
| Auth | Supabase Auth (GoTrue) | Auth.js v5 |
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

### 3.6 Nenhum arquivo passa de ~400 linhas

Se passou, é hora de recortar. O site atual tem um componente de 4.482 linhas com 2.674 de JSX num único `return`. É intratável tanto para humano quanto para agente.

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
└── src/                         ← a aplicação Next.js
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
