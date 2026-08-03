# Design — Salas Apostadas (M7 Arena)

> **Data:** 2026-08-03
> **Status:** Design aprovado, aguardando plano de implementação
> **Referências:** ADR-019, plano antigo `Markdowns/01_Projeto/plano_partidas_apostadas.md` (M7AcademySite)

---

## 1. Problema e contexto

O site antigo tinha um fluxo de salas de partida que **quebrava com 10 jogadores**: estados indo e voltando, botão de confirmação aparecendo/sumindo, uns confirmados outros não. O plano antigo documentou a causa raiz:

1. **A máquina de estados rodava no cliente** — cada navegador avaliava regras e escrevia direto no banco. Com 10 pessoas, eram 10 clientes concorrendo pela mesma linha da sala. Não existe lock global entre navegadores.
2. **Um trigger no banco brigava com o cliente** — `trigger_sala_confirmacao` gravava `confirmacao_expires_at = now()+40s` enquanto o cliente gravava 60s.

**Isso já foi corrigido na arquitetura nova.** O `api/src/lib/match-flow.ts` roda a máquina de estados inteira no servidor, com `FOR UPDATE` (lock real do Postgres). A concorrência não é mais problema.

O que este design resolve é o que **nunca chegou a existir**: o fluxo de **partidas apostadas** (escrow, resultado por print, aprovação do admin, taxa da plataforma) e a **substituição do realtime do Supabase** pelo WebSocket próprio na VPS.

**Decisão macro:** o fluxo inteiro roda **100% na VPS** (Postgres + API Node + WebSocket próprio + disco local). Zero Supabase.

---

## 2. Decisões de escopo (brainstorm)

| Tema | Decisão |
|---|---|
| **Escrow** | `mc_reservado` na `user_wallets`. Entrar na vaga move `mc → mc_reservado`. |
| **Momento da reserva** | Ao entrar na vaga (escrow completo). |
| **Sair da sala** | Livre até a partida iniciar (devolve na hora). Depois de iniciar, não sai manualmente. |
| **Kick de ociosidade** | Jogador ocioso 30 min na vaga (partida não iniciou) é removido da vaga, devolve o MC, **a sala continua**. Pode reentrar e ganhar mais 30 min. |
| **Disparo do kick** | Varredura automática do servidor a cada 10 min (cron). |
| **Revisão** | Sem timeout. Fica em `aguardando_revisao` até o admin decidir (pagar ou cancelar). |
| **Resultado** | Print enviado no app + admin aprova no painel. |
| **Taxa** | Percentual do pote (8,99% default, configurável no banco). |
| **Salas casuais (0 MC)** | Não passam pelo admin — encerram no fluxo normal. |
| **Realtime** | WebSocket próprio na VPS (LISTEN/NOTIFY), seguro e leve. |

---

## 3. Fluxo da sala apostada

```
preenchendo → confirmacao → iniciando_partida → partida_iniciada
                                                      │
                                    (aposta > 0 → jogadores enviam print)
                                                      ▼
                                              aguardando_revisao   ← estado NOVO
                                                      │
                                          admin: pagar ou cancelar
                                                      ▼
                                  encerrada (payout + taxa)  |  cancelada (devolve tudo)
```

- **Só salas apostadas (aposta > 0)** entram em `aguardando_revisao`.
- **Salas casuais** seguem o fluxo atual (resultado simples, sem admin).

---

## 4. Regras de tempo e dinheiro

| Situação | O que acontece |
|---|---|
| Jogador entra na vaga (aposta > 0) | `mc -= aposta`; `mc_reservado += aposta` + ledger `match_entry_reserve` |
| Sai antes da partida iniciar | `mc_reservado -= aposta`; `mc += aposta` + ledger `match_entry_refund` |
| **Ocioso 30 min** na vaga (partida não iniciou) | **Kick da vaga**, devolve o MC, **sala continua** |
| Confirmação venceu (60s) e faltou gente | Só os não-confirmados são removidos e devolvidos (já é o comportamento do `match-flow.ts`) |
| Partida **iniciou** | **Dinheiro travado** — não devolve mais para quem confirmou |
| Revisão (prints enviados) | Sem timeout, fica até o admin decidir |
| Admin aprova vencedor | Pote = `aposta × jogadores`; `taxa = pote × taxa_pct`; vencedores dividem `pote − taxa`; perdedores perdem o reservado; `mc_reservado` zera + ledger `match_prize`/`match_loss` + `platform_revenue` |
| Admin cancela | Devolve o reservado de todos + sala `cancelada` |

**Invariante de segurança (regra de ouro):**
> `disponível + reservado = total` sempre. O disponível nunca fica negativo.
> Todo `mc_reservado` tem exatamente um caminho de saída: payout ou devolução.
> Depois da partida iniciar, o único caminho de saída é o admin (pagar ou cancelar).

---

## 5. Modelo de dados

```sql
-- user_wallets (novo)
ALTER TABLE user_wallets ADD COLUMN mc_reservado integer NOT NULL DEFAULT 0;

-- matches (novo)
ALTER TABLE matches
  ADD COLUMN aposta_mc integer NOT NULL DEFAULT 0,        -- 0 = casual
  ADD COLUMN taxa_pct numeric NOT NULL DEFAULT 8.99,      -- configurável
  ADD COLUMN resultado text NULL,                          -- 'blue' | 'red' | 'draw'
  ADD COLUMN cancelado_em timestamp NULL;

-- match_prints (novo) — provas enviadas pelos jogadores
CREATE TABLE match_prints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  url text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
```

> **Observação:** os nomes de coluna aqui seguem o padrão Drizzle do projeto. As migrations são geradas com `drizzle-kit generate` (invariante 3.5).

---

## 6. Fluxo de revisão do admin

```
partida_iniciada (aposta > 0)
      │  qualquer jogador da sala envia print (screenshot do resultado)
      ▼
aguardando_revisao
      │  → máx. 3 prints por partida (evita spam)
      │  → notificação no painel + badge "N revisões pendentes"
      ▼
admin abre o painel de revisão
      │  vê: sala, times, jogadores, prints lado a lado, valores apostados
      ▼
  ┌── aprovar Time A ──┐   ┌── aprovar Time B ──┐   ┌── cancelar partida ──┐
  │ payout aos vencedores │   │ payout aos vencedores │   │ devolve tudo          │
  └──────────────────────┘   └──────────────────────┘   └──────────────────────┘
```

- **Upload do print**: rota `/api/upload` existente, novo bucket `match-prints` (privado — só admin e participantes).
- **Quem envia**: qualquer jogador confirmado na sala, quando `aposta > 0`.
- **Painel**: nova aba "Revisão de Partidas" no admin.
- **Ao aprovar**: `match-flow.ts` calcula pote, taxa, paga vencedores, registra `platform_revenue`, sala → `encerrada`.
- **Ao cancelar**: devolve `mc_reservado` de todos, sala → `cancelada`.

---

## 7. Realtime próprio na VPS (seguro e leve)

**Princípio:** *o WebSocket não transporta os dados da sala — só avisa "a sala X mudou". O cliente busca o estado atual via HTTP (`GET /api/matches/:id`).*

```
cliente                    servidor WebSocket               API
  │ subscribe sala 123           │                           │
  │ ──────────────────────────►  │                           │
  │ {subscribe, matchId:"123"}   │ LISTEN matches_channel    │
  │                              │   (Postgres NOTIFY)      │
  │ alguém entrou numa vaga ───► │ transação no banco ─────► │ pg_notify("matches_channel", {matchId})
  │                              │  │                        │
  │ {match_update, matchId}      │◄─┘  (só o id, ~60 bytes)  │
  │ ◄──────────────────────────  │                           │
  │ GET /api/matches/123 (cookie) ────────────────────────►  │ valida sessão + permissão
  │ ◄──────────────────────────────────────────────────────  │ estado completo
```

**Leveza:**
- O socket trafega **só o id** da sala quando algo muda — poucos bytes, zero polling.
- `pg_notify` é o recurso mais barato do Postgres.
- **Sem payload no socket** = sem risco de vazar dado de outra sala no fan-out.

**Segurança (4 travas):**
1. **Autenticação no handshake**: valida o cookie `m7_session` antes de aceitar a conexão.
2. **Autorização por sala**: `subscribe_match` só é aceito se o usuário é participante (ou admin) daquela sala.
3. **Os dados nunca vêm do socket**: o cliente refaz `GET /api/matches/:id`, que valida permissão de novo.
4. **Limites**: máx. N conexões por usuário, timeout de inatividade, rejeita `matchId` inválido.

**O que fica na VPS:**
- Serviço `src/realtime/index.ts` (já existe) entra no `docker-compose` como serviço `realtime` (porta 3001, interna).
- Nginx já tem o proxy `/ws/` configurado.
- Front troca `supabase.channel` pelo socket próprio (novo hook `useSalaRealtime`).

---

## 8. Arquitetura (o que existe vs. o que é novo)

**Já existe e fica:**
- `matches`, `match_players`, `match_codes` (schema)
- Máquina de estados no servidor (`match-flow.ts`) com `FOR UPDATE`
- `wallet_transactions` (ledger), `platform_revenue` (taxa)
- Rota `/api/upload` (storage local)
- Sessão própria por cookie (ADR-011)

**É novo:**
1. Coluna `mc_reservado` em `user_wallets`
2. Colunas `aposta_mc`, `taxa_pct`, `resultado`, `cancelado_em` em `matches`
3. Tabela `match_prints`
4. Estados `aguardando_revisao` e `cancelada` na máquina de estados
5. Funções de escrow em `match-flow.ts` (reservar, devolver, pagar com taxa)
6. Cron de varredura (kick de ociosidade a cada 10 min)
7. Endpoints de revisão do admin (listar pendentes, ver prints, aprovar/cancelar)
8. Endpoint de upload de print (bucket `match-prints`)
9. Realtime próprio no docker-compose + front conecta (`useSalaRealtime`)
10. Painel admin "Revisão de Partidas"

---

## 9. Testes

- **Concorrência (o bug antigo):** disparar N chamadas simultâneas de entrar/confirmar na mesma sala e conferir que o lock segura (uma única transição, sem duplicidade).
- **Escrow:** conferir que `reservado + disponível` se mantém constante em todo o ciclo (entrar → sair → entrar → confirmar → encerrar/cancelar). Nenhum MC criado ou destruído fora de depósito, pagamento e taxa.
- **Kick:** jogador ocioso 30 min é removido, dinheiro devolvido, sala continua.
- **Revisão:** partida completa até `encerrada`; conferir pote, taxa em `platform_revenue` e saldo final de cada jogador.
- **Cancelamento:** admin cancela após iniciar → todos reembolsados, sala `cancelada`.
- **Realtime:** duas abas/usuários veem mudanças de vaga e estado sem refresh.
