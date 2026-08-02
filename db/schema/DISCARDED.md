# Tabelas e Views Descartadas (Não Migradas)

Conforme definido na **Fase 1 (`db.descarte`)** do plano de migração, as seguintes **15 tabelas** e **5 views** legadas do Supabase (`M7AcademySite`) **NÃO** serão criadas no Drizzle ORM nem integradas na migração de dados para a nova base PostgreSQL do `M7Arena`.

---

## 1. Tabelas Mortas / Obsoletas (15)

| Tabela Supabase | Motivo do Descarte |
|---|---|
| `drafts` | Feature obsoleta / não utilizada no fluxo atual. |
| `scrims` | Funcionalidade descontinuada de treinos/scrims. |
| `sala_chat` | Chat de sala legado. O chat em tempo real será gerenciado via WebSocket. |
| `transacoes` | Substituída pela estrutura auditável de ledger (`wallet_transactions` e `payments`). |
| `admin_logs` | Substituída pela retenção particionada `audit_log`. |
| `campeonato_times` | Substituída pela tabela relacional normalizada `tournament_teams`. |
| `campeonato_jogadores` | Substituída pela tabela relacional normalizada `tournament_matches` / `match_players`. |
| `vip_assinaturas` | O status VIP e expiração vivem diretamente em `users` (`is_vip`, `vip_expires_at`). |
| `screens` | Estrutura legada de layouts dinâmicos descontinuada. |
| `screen_propostas` | Estrutura legada descontinuada. |
| `campeonatos_audit` | Auditoria legada que duplicava blobs JSONB a cada update. Substituída por `audit_log`. |
| `twitch_lives_ativas` | Gerenciado via worker em memória / cache no servidor. |
| `votos_jogos` | Votação temporária antiga descontinuada. |
| `edge_function_logs` | Logs legados de edge functions Supabase. |
| `discord_oauth_state` | Gerenciado via Auth.js v5 no novo sistema. |

---

## 2. Views Legadas Descartadas (5)

| View Supabase | Motivo do Descarte |
|---|---|
| `saldos` | Substituída pela tabela `user_wallets` + ledger `wallet_transactions`. |
| `admin_usuarios` | Substituída por query de agregação no servidor (`users` + `user_roles`). |
| `vw_saldos` | View duplicada descontinuada. |
| `vw_admin_usuarios` | View duplicada descontinuada. |
| `vw_platform_roles_detalhes` | Substituída pela tabela relacional N:N `user_roles`. |

---

> **Regra:** Não crie definições Drizzle nem rotinas ETL de migração para estes elementos.
