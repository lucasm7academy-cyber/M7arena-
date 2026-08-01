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

Estão registradas como ADR-001 a ADR-008 no `statusdoprojeto.md`. Em resumo: Next.js 15 com serviço WebSocket separado; Auth.js v5 (os hashes bcrypt do sistema atual continuam válidos, ninguém reseta senha); import inicial de dados agora com re-sync no cutover; schema multi-jogo desde o v1; Drizzle; storage em disco local; paridade visual total; e governança por MCP com operações tipadas.

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

### Fase 3 — Aplicação

Port das telas, uma a uma, com o JSX recortado e colado do site atual. Começa pelo design system (tokens, fontes, assets, componentes de UI) — nenhuma tela é portada antes disso.

Ordem sugerida, da mais simples para a mais complexa: institucional → perfil → players → recrutamento → streamers → carteira → vincular → times → admin → salas → campeonatos.

Cada tela portada passa por comparação visual com a original antes de ser marcada como `done`.

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
Fase 0 ──┬── Fase 1 (schema) ──┬── Fase 3 (app) ──┐
         │                     │                  ├── Fase 5 (migração + cutover)
         └── Fase 2 (infra) ───┴── Fase 4 (mcp-ops)┘
```

Fase 0 bloqueia tudo. Fases 1 e 2 correm em paralelo. Fase 5 exige 1 e 3 prontas, e a VPS contratada.

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
