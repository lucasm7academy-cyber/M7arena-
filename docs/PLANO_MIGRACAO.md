# PLANO DE MIGRAÇÃO — M7Academy → M7Arena

Documento central do projeto. O status ao vivo de cada item está em [`../statusdoprojeto.md`](../statusdoprojeto.md) (gerado pelo MCP). As regras de trabalho, em [`../AGENTS.md`](../AGENTS.md). O desenho técnico, em [`ARQUITETURA.md`](./ARQUITETURA.md).

---

## 1. Por que estamos fazendo isso

O site atual funciona e está no ar, mas acumulou dívida estrutural em três frentes:

**Custo e controle.** Supabase + Vercel têm custo variável e crescente. Uma VPS própria custa fixo (R$ 100-200/mês) e não tem lock-in.

**Estrutura do banco.** O mesmo usuário está espalhado por 8 tabelas sem chave estrangeira entre si. Ler "um usuário" custa 5 consultas. Existem ~15 tabelas mortas ocupando espaço. Um campeonato inteiro vive em blobs JSONB numa linha só, com auditoria que duplica esses blobs a cada edição.

**Estrutura do código.** 5 arquivos concentram 43,5% das 29.420 linhas. O maior tem 5.856 linhas, com um componente de 4.482 e um único `return` com 2.674 linhas de JSX. Cada feature foi feita isolada, sem visão do todo.

Agora o produto está pronto e sabemos o que funciona. Dá para refazer o motor com arquitetura pensada — **mantendo o design exatamente como está**.

## 2. O que muda e o que não muda

| | |
|---|---|
| **Muda** | banco, autenticação, camada de dados, hospedagem, framework, organização do código |
| **Não muda** | design, cores, fontes, ícones, imagens, layout, espaçamentos, fluxos do usuário |

`m7academy.pro` continua no ar, intacto, o tempo todo. `m7arena.pro` é o domínio novo, apontado por registro A (Hostinger) para o IP da VPS só quando estiver pronto.

## 3. Decisões travadas

Estão registradas como ADR-001 a ADR-011 no `statusdoprojeto.md`. Em resumo: import inicial de dados agora com re-sync no cutover; schema multi-jogo desde o v1; Drizzle; storage em disco local; paridade visual total; governança por MCP com operações tipadas; **fork do app React/Vite existente em vez de reescrita em Next.js (ADR-010)**; e **sessão própria por cookie httpOnly em vez de Auth.js v5 (ADR-011)**. Os hashes bcrypt do sistema atual continuam válidos — ninguém reseta senha.

> **ADR-001 e ADR-002 foram revogadas.** O port para Next.js foi tentado e reimplementou o front em 9.781 linhas contra 29.420 do original, sem atingir a paridade visual que a ADR-005 exige. O código está preservado no commit `3e8fd68`. Ver seção 4, Fase 3.

Para revogar qualquer uma delas, use `add_decision` com o campo `supersedes` — não apague a anterior.

---

## 4. As fases

### Fase 0 — Governança ✅ concluída

MCP `m7-status`, `AGENTS.md` vinculante, documentos centrais e estado inicial com 62 componentes mapeados. É o que permite trocar de agente ou de terminal sem perder contexto.

### Fase 1 — Schema

Modelo novo em Drizzle, com migrations que reconstroem o banco do zero. Detalhes em [`ARQUITETURA.md`](./ARQUITETURA.md) seção 3.

Ordem sugerida: identidade → jogos → times → campeonatos → partidas → economia → conteúdo → índices → retenção.

### Fase 2 — Infra

`docker-compose.yml` com sete serviços: postgres, pgbouncer, app, realtime, nginx, backup, mcp-ops. Configuração do Postgres dimensionada para 8 GB / 2 vCPU. Backup com cópia off-site e restore testado.

Pode correr em paralelo com a Fase 1.

### Fase 3 — Aplicação (fork do React/Vite + troca da camada de dados)

**Não existe mais port de tela.** Sob a ADR-010, o front do m7arena.pro é um fork literal do app React+Vite do m7academy.pro. O visual não é reconstruído: ele é copiado. Isso torna a paridade visual um fato, não uma tarefa.

A fase tem duas etapas, e a ordem é obrigatória — o grafo em `mcp/status-server/lib/plan.js` a impõe, então `next_task` não libera a Etapa B antes de a A fechar.

**Etapa A — o site em React de pé, sem tocar em banco.**

| # | Componente | O que é |
|---|---|---|
| 1 | `app.fork.copia` | Copiar `M7AcademySite` → `M7arenaSite/web/`. Zero alteração de UI. |
| 2 | `app.fork.build` | `npm install` + `vite build` + dev server servindo as 25 rotas. |
| 3 | `design.regressao` | Conferir as 25 telas contra o site no ar. |

Ao fim da Etapa A o site está visualmente pronto e rodando. Ele ainda fala com o Supabase — isso é esperado e temporário.

**Etapa B — trocar o motor de dados por baixo.**

Primeiro a fundação (`app.api.server` → `app.auth.sessao` → `app.sdk`), depois os swaps por domínio: identidade, times, campeonatos, salas, carteira, conteúdo, rpc, uploads.

**`app.auth.sessao` vem antes de todos os swaps.** Enquanto o front usar `supabase.auth` para a sessão, nenhuma chamada à API própria consegue se autenticar. O grafo impõe isso.

> ### Como um swap fecha
>
> Em 2026-08-02 os oito `app.swap.*` foram marcados `done` com os endpoints escritos, `tsc --noEmit exit 0` em tudo — e **zero** chamadas migradas no front. O painel dizia 58/58 com o app inteiro ainda rodando no Supabase. Escrever o endpoint **não é** fazer o swap.
>
> Um swap é: `supabase.from('x')` no componente **deixa de existir** e vira chamada ao `app.sdk`.
>
> A evidência é mecânica:
>
> ```
> node scripts/verify-swap.js            # relatório completo, por domínio e arquivo
> node scripts/verify-swap.js identidade # só um domínio
> node scripts/verify-swap.js --strict   # exit 1 se sobrou algo
> ```
>
> Nenhum `app.swap.*` é marcado `done` sem o contador dele em **0**. Linha de base em 2026-08-02: **192 ocorrências**.

O `app.sdk` é a peça de maior alavancagem: é o módulo único (`web/src/lib/api.ts`) por onde os ~113 pontos de chamada ao Supabase passam a falar com a API. **Não imite a query-builder do PostgREST** — exponha funções por domínio.

**A superfície a substituir, medida:**

| Chamada | Ocorrências |
|---|---|
| `supabase.from()` | 62 |
| `supabase.auth.*` | 23 |
| `supabase.rpc()` | 18 |
| `supabase.storage` | 10 |
| `import.meta.env` | 19 |

**Três armadilhas do fork, que o plano cobre explicitamente:**

1. **Regra de negócio no cliente.** O original decide saldo, resultado de partida e classificação no front. Trocar o transporte não conserta isso. Cada `app.swap.*` tem que *mover a regra para o servidor*, não só apontar o `fetch` para outro lugar. É o `sec.regras-servidor`, e é o item mais crítico da fase.
2. **Segredos no bundle.** Tudo com prefixo `VITE_` é público. As 19 ocorrências de `import.meta.env` precisam de auditoria (`app.env`), e a chave da Riot precisa sair de vez (`sec.riot-key`).
3. **Arquivos gigantes.** O fork traz a dívida do original junto: `CampeonatoDetalhes.tsx` tem 5.856 linhas, `createCampPage.tsx` 2.044, `TimePage.tsx` 1.943. Ver a ressalva ao invariante de 400 linhas na seção 9.

### Fase 4 — MCP de operações

Servidor MCP na VPS para os agentes verem logs, rodar consultas de diagnóstico, testar endpoints, acompanhar métricas e fazer deploy/rollback sem SSH manual.

**Isso é um shell remoto com acesso ao banco.** Bearer token, bind em `127.0.0.1`, acesso só por túnel SSH ou Tailscale, e a consulta ao banco roda com role somente-leitura e `statement_timeout`.

### Fase 5 — Migração de dados e cutover

---

## 5. Mapeamento de dados

| Origem (Supabase) | Destino | Observação |
|---|---|---|
| `auth.users` | `users` + `user_identities` | hashes bcrypt preservados |
| `profiles` | `users` (merge por id) + `user_payout_info` | PIX vai para tabela própria |
| `contas_riot` | `game_accounts` (`game_id='lol'`) | `elo_cache`/`champions_cache` → `metadata` |
| `wallets` | `user_wallets` + lançamento de abertura em `wallet_transactions` | |
| `platform_roles` | `user_roles` | 1:1 vira N:N |
| `discord_links` | `user_identities` (provider `discord`) | |
| `times` | `teams` + `team_stats` | pdl/wins/losses saem para a tabela de stats |
| `time_membros` | `team_members` | colunas `guest_*` viram `guest_handle` |
| `campeonatos` | `tournaments` + `tournament_teams` + `tournament_groups` + `tournament_matches` | **explode 7 blobs JSONB** |
| `salas` / `sala_jogadores` | `matches` / `match_players` | só encerradas; salas ativas não migram |
| `resultados_partidas` | `match_results` | |
| `player_stats` | derivado de `match_results` | não migra direto |
| `transacoes_pontos` | `wallet_transactions` | |
| `pagamentos` | `payments` | |
| `noticias`, `highlights`, `recrutamentos` | `news`, `highlights`, `recruitment_posts` | |
| buckets de storage | volume de uploads da VPS | |

**Não migrar** (mortas ou substituídas): `drafts`, `scrims`, `sala_chat`, `transacoes`, `admin_logs`, `campeonato_times`, `campeonato_jogadores`, `vip_assinaturas`, `screens`, `screen_propostas`, `campeonatos_audit`, `twitch_lives_ativas`, `votos_jogos`, `edge_function_logs`, `discord_oauth_state`, e as views `saldos`, `admin_usuarios`, `vw_saldos`, `vw_admin_usuarios`, `vw_platform_roles_detalhes`.

### O passo difícil

Explodir `campeonatos.cronograma`, `bracket_data`, `classificacao` e `times_inscritos` em linhas de `tournament_matches` e `tournament_teams` **não é conversão cega**. O script precisa emitir relatório de divergências: jogo sem time correspondente, placar inconsistente com a classificação, chave que não fecha. Cada divergência é decidida caso a caso, não silenciada.

---

## 6. Cutover

1. Re-sync incremental — só o delta desde o import inicial
2. `verify-migration.sql` com divergência zero (contagens e somas de controle por tabela: total de usuários, soma de MP/MC, partidas por status, times por campeonato)
3. Baixar o TTL do DNS com antecedência
4. Registro A de `m7arena.pro` → IP da VPS, na Hostinger
5. Certificado TLS
6. Fumaça: login com Google, login com senha, criar sala, entrar em sala, ver campeonato, depósito
7. `m7academy.pro` permanece no ar como fallback

### Segredos a rotacionar antes disso

- Chave da Riot API — está exposta no bundle público do site atual
- Token do Mercado Livre — foi commitado no repositório antigo
- Confirmar se as credenciais do Supabase compartilhadas em chat durante a migração US→BR foram rotacionadas

---

## 7. Ordem e dependências

```
Fase 0 ──┬── Fase 1 (schema) ──┐
         │                     ├── Fase 3B (dados) ──┐
         ├── Fase 2 (infra) ───┴── Fase 4 (mcp-ops) ─┼── Fase 5 (migração + cutover)
         │                                           │
         └── Fase 3A (fork React) ───────────────────┘
                    ▲
             portão: nada de 3B abre antes daqui
```

Fase 0 bloqueia tudo. Fases 1 e 2 correm em paralelo.

**A Etapa 3A (fork) não depende de nada além da Fase 0** — pode começar imediatamente, mesmo sem VPS e mesmo com o schema em aberto. Ela é o portão da Etapa 3B: `app.api.server` exige `app.fork.build` concluído, então nenhum agente consegue começar a mexer em banco antes de o site estar rodando em React.

Fase 5 exige 1, 2 e 3 prontas e a VPS contratada. O `mig.cutover` agora também exige `design.regressao`, `sec.regras-servidor` e `infra.nginx.spa` — ou seja, não vira o DNS com o app pela metade.

**Bloqueio externo atual:** a VPS ainda não foi contratada (componente `infra.vps`). Isso **não** trava a Etapa 3A, que roda inteira na máquina local.

**Bloqueio externo atual:** a VPS ainda não foi contratada (componente `infra.vps`). Tudo que depende de execução remota fica parado até lá — mas as fases 1, 2 e 3 podem ser desenvolvidas e testadas localmente com Docker.

---

## 8. Como você entra nesse plano

Se você é um agente chegando agora:

1. `status_brief` para ver onde o projeto está
2. Escolha um componente `todo` cujas dependências já estejam `done`
3. `set_component_status` para `doing`, com seu nome
4. Trabalhe seguindo as regras do `AGENTS.md`
5. `set_component_status` para `done`, com evidência (caminho:linha, comando que roda)
6. `log_session` com o resumo

Se algo travar, `add_blocker`. Se você decidir entre alternativas, `add_decision`.

---

## 9. Ressalva ao invariante de 400 linhas

O `AGENTS.md` diz que nenhum arquivo passa de ~400 linhas. O fork da ADR-010 traz arquivos que violam isso de saída: `CampeonatoDetalhes.tsx` (5.856), `createCampPage.tsx` (2.044), `TimePage.tsx` (1.943), `Lobby.tsx` (1.726), `Admin.tsx` (1.225).

**Isso é aceito de propósito, com prazo.** A regra passa a valer assim:

- **Na Etapa 3A o invariante fica suspenso.** Copiar é copiar. Recortar arquivo durante a cópia é justamente o erro que produziu o port de 9.781 linhas — vira reescrita disfarçada e a paridade se perde de novo.
- **Todo arquivo *novo* (API, sdk, auth) obedece ao limite desde a primeira linha.**
- **Na Etapa 3B o corte acontece junto com o swap, não separado dele.** Quando `app.swap.campeonatos` tira o JSONB gigante de dentro de `CampeonatoDetalhes.tsx`, o arquivo encolhe naturalmente. Recortar aí é de graça; recortar antes é pagar duas vezes.

Não abra uma tarefa de refatoração isolada para isso. Ela morre no meio e deixa o arquivo pior do que estava.
