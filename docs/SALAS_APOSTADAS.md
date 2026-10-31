# Design — Salas Apostadas (M7 Arena) — v3

> **Data:** 2026-08-02
> **Status:** Design revisado, pronto para plano de implementação
> **Substitui:** v1 (design original) e v2 — esta versão incorpora a revisão de segurança, escala e usabilidade, e corrige o roadmap de validação de resultado após verificação das limitações reais da Riot API (custom games são privados na match-v5; o acesso atual é apenas tournament-stub-v5, cujos códigos não criam lobby real)
> **Referências:** ADR-019, plano antigo `Markdowns/01_Projeto/plano_partidas_apostadas.md` (M7AcademySite)

---

## 1. Problema e contexto

O site antigo tinha um fluxo de salas de partida que **quebrava com 10 jogadores**: estados indo e voltando, botão de confirmação aparecendo/sumindo, uns confirmados outros não. Causa raiz documentada:

1. **A máquina de estados rodava no cliente** — 10 navegadores concorrendo pela mesma linha da sala, sem lock global.
2. **Um trigger no banco brigava com o cliente** — `trigger_sala_confirmacao` gravava 40s enquanto o cliente gravava 60s.

**Isso já foi corrigido.** O `api/src/lib/match-flow.ts` roda a máquina de estados inteira no servidor, com `FOR UPDATE` (lock real do Postgres).

O que este design resolve é o que nunca chegou a existir: o fluxo de **partidas apostadas** (escrow, resultado por print, aprovação do admin, taxa da plataforma) e a **substituição do realtime do Supabase** pelo WebSocket próprio na VPS.

**Decisão macro:** o fluxo inteiro roda **100% na VPS Hostinger** (Postgres + API Node + WebSocket próprio + disco local). Zero Supabase.

---

## 2. Decisões de escopo

| Tema | Decisão |
|---|---|
| **Acesso** | Ver salas é público; agir (entrar, confirmar, print, contestar) exige conta logada e elegível (§2.1). |
| **Saldo** | Sem saldo suficiente não entra na vaga — modal "faltam X MC" + "Recarregar agora". Validação final sempre no servidor. |
| **Riot ID** | Obrigatório e único por conta para salas apostadas (anti multi-conta; base da Fase 3). |
| **Concorrência de salas** | 1 sala apostada ativa por jogador por vez. |
| **Strikes** | Kick por ociosidade e abandono geram strike; 3 em 30 dias → suspensão temporária de salas apostadas. |
| **Escrow** | `mc_reservado` na `user_wallets`. Entrar na vaga move `mc → mc_reservado`. |
| **Momento da reserva** | Ao entrar na vaga (escrow completo). |
| **Sair da sala** | Livre até a partida iniciar (devolve na hora). Depois de iniciar, não sai manualmente. |
| **Abandono após iniciar** | AFK/rage quit **não devolve nada** — o resultado da partida decide. Regra visível no app antes de confirmar. |
| **Kick de ociosidade** | Ocioso 30 min na vaga (partida não iniciou) → removido, MC devolvido, **sala continua**. Pode reentrar. Aviso ao usuário aos 25 min. |
| **Disparo do kick** | Varredura automática do servidor a cada 10 min (cron). |
| **Partida fantasma** | Sala em `partida_iniciada` há **mais de 3h** sem print → cron move para `aguardando_revisao` automaticamente. Nenhum MC fica em limbo eterno. |
| **Revisão** | Sem timeout técnico, mas com **SLA visível** ao usuário e notificação imediata ao admin. |
| **Resultado** | **Print enviado no app + admin aprova no painel — mecanismo definitivo do MVP.** Não existe validação automática de custom games sem Tournament-V5 de produção (§10). Migração para tournament codes com callback é o roadmap, condicionada à aprovação da Riot. |
| **Empate (`draw`)** | Tratado como cancelamento: **devolve tudo, sem taxa**. |
| **Taxa** | Percentual do pote (8,99% default). **Congelada na criação da sala** — mudar a config global não afeta salas em andamento. |
| **Arredondamento** | Política explícita (§4.1). A invariante nunca quebra por resto de divisão. |
| **Disputa** | Botão "Contestar resultado" disponível ao perdedor por 1h após o payout ficar pendente (§6.1). |
| **Salas casuais (0 MC)** | Não passam pelo admin — encerram no fluxo normal. |
| **Realtime** | WebSocket próprio na VPS (LISTEN/NOTIFY), só transporta IDs. |

### 2.1 Regras de acesso e elegibilidade

**Ver é público, agir exige conta:**

| Ação | Quem pode |
|---|---|
| Ver lista de salas e o estado de uma sala (times, vagas, valor da aposta) | **Qualquer pessoa**, logada ou não (leitura pública, sem dados sensíveis — nunca expor saldo ou e-mail de ninguém) |
| Entrar numa vaga, confirmar, enviar print, contestar | **Só conta cadastrada e logada** que passe nos requisitos abaixo |
| Visitante deslogado clica em qualquer ação | Modal "Crie sua conta para jogar" com CTA de cadastro/login (a sala fica visível ao fundo — a vitrine é parte da aquisição) |

**Requisitos para entrar numa vaga de sala apostada (validados no SERVIDOR, dentro da transação):**

1. **Conta ativa** — `users.status = 'ativa'`. Conta banida ou suspensa não entra em vaga nenhuma (nem casual).
2. **Riot ID vinculado** — obrigatório para salas apostadas (é o que amarra o print ao jogador hoje e o `allowedParticipants` do tournament code na Fase 3). **Riot ID é único na plataforma** (constraint) — impede o mesmo jogador de ocupar duas vagas com contas diferentes.
3. **Saldo suficiente** — `mc >= aposta_mc`. Se não tiver: **modal "Saldo insuficiente"** mostrando quanto falta ("faltam X MC") + botão **"Recarregar agora"** que leva direto ao fluxo de recarga. Nunca um erro genérico.
4. **Uma sala apostada ativa por vez** — o jogador não pode ocupar vaga em duas salas apostadas simultaneamente (evita MC espalhado em reservas paralelas e no-show em massa). Se tentar: modal apontando a sala onde ele já está, com link.
5. **Vaga ainda aberta e sala em `preenchendo`** — durante `confirmacao` em diante, ninguém novo entra (vagas travadas).
6. **Sem punição ativa** — ver strikes abaixo.
7. **Maioridade declarada** — aceite dos Termos de Uso com declaração de 18+ no cadastro (registro de `termos_aceitos_em`). Plataforma de aposta, mesmo com moeda virtual, não opera sem isso.

> **Regra de ouro da validação:** o front mostra os modais bonitos, mas **a fonte da verdade é o servidor**. Toda condição acima é re-checada dentro da transação com `FOR UPDATE` (dois cliques simultâneos com saldo para um só → um entra, o outro recebe o modal). Front sem validação de servidor é o bug antigo de novo.

**Strikes (anti no-show / AFK):**

- Kick por ociosidade (30 min) e abandono de partida iniciada geram **strike** no perfil.
- 3 strikes em 30 dias → **suspensão temporária de salas apostadas** (ex: 48h, configurável). Salas casuais continuam liberadas.
- Strike visível no próprio perfil ("você tem 2/3 strikes"), para ninguém ser suspenso de surpresa.
- Admin pode remover strike manualmente (caso de queda de energia comprovada etc.).



```
preenchendo → confirmacao → iniciando_partida → partida_iniciada
                                                      │
                              ┌───────────────────────┼──────────────────────┐
                              │ (aposta > 0)          │                      │
                              │ jogador envia print   │ 3h sem print (cron)  │
                              ▼                       ▼                      │
                        aguardando_revisao ◄──────────┘                      │
                              │                                              │
                   admin: aprovar time / empate / cancelar                   │
                              ▼                                              │
          encerrada (payout + taxa)  |  cancelada (devolve tudo, sem taxa)   │
                                                                             │
              (aposta = 0) ──────────────► encerrada (fluxo casual atual) ◄──┘
```

- **Só salas apostadas (aposta > 0)** entram em `aguardando_revisao`.
- **Salas casuais** seguem o fluxo atual (resultado simples, sem admin).
- **Estados novos:** `aguardando_revisao`, `cancelada`.

---

## 4. Regras de tempo e dinheiro

| Situação | O que acontece |
|---|---|
| Jogador entra na vaga (aposta > 0) | `mc -= aposta`; `mc_reservado += aposta` + ledger `match_entry_reserve` |
| Sai antes da partida iniciar | `mc_reservado -= aposta`; `mc += aposta` + ledger `match_entry_refund` |
| Ocioso 30 min na vaga (partida não iniciou) | Kick da vaga, devolve o MC, sala continua. Interação na sala (heartbeat do socket) renova o timer. |
| Confirmação venceu (60s) e faltou gente | Só os não-confirmados são removidos e devolvidos (comportamento atual do `match-flow.ts`) |
| Partida **iniciou** | Dinheiro travado — não devolve mais para quem confirmou |
| `partida_iniciada` há 3h sem print | Cron move para `aguardando_revisao` (partida fantasma) |
| Revisão | Fica até o admin decidir; SLA visível no app |
| Admin aprova vencedor | Payout com taxa (§4.1) + ledger `match_prize`/`match_loss` + `platform_revenue` |
| Admin marca empate | Devolve o reservado de todos, **sem taxa**, sala → `encerrada` com `resultado = 'draw'` |
| Admin cancela | Devolve o reservado de todos + sala → `cancelada` |

### 4.1 Política de arredondamento (MC é integer)

```
pote        = aposta_mc × nº de jogadores pagantes
taxa        = ceil(pote × taxa_pct / 100)          -- taxa arredonda PARA CIMA
premio_liq  = pote − taxa
por_vencedor = floor(premio_liq / nº vencedores)    -- prêmio arredonda PARA BAIXO
resto       = premio_liq − (por_vencedor × nº vencedores)
```

- O **resto** da divisão vai para a plataforma, somado à taxa, com lançamento próprio no ledger (`match_fee_rounding`).
- **Resultado garantido:** a soma de todos os lançamentos fecha exatamente com o pote. A invariante (§4.2) nunca quebra por 1 MC.

### 4.2 Invariante de segurança (regra de ouro)

> `disponível + reservado = total` sempre. O disponível nunca fica negativo.
> Todo `mc_reservado` tem exatamente um caminho de saída: payout, devolução por empate, devolução por cancelamento ou devolução por saída antes do início.
> Depois da partida iniciar, o único caminho de saída é decisão do admin (ou o timeout de partida fantasma, que apenas encaminha para o admin).
> Nenhum MC é criado ou destruído fora de: depósito, prêmio, perda, taxa e resto de arredondamento.

### 4.3 Idempotência do payout (obrigatório)

O payout é a operação mais crítica do sistema. Duplo clique, duas abas do admin ou retry de rede **não podem pagar duas vezes**:

1. A transição de `aguardando_revisao → encerrada/cancelada` roda em transação com `SELECT ... FOR UPDATE` na sala e **verifica o status dentro da transação**. Se já não estiver em `aguardando_revisao`, aborta com erro amigável ("esta partida já foi decidida").
2. Constraint única no ledger: `UNIQUE (match_id, user_id, tipo)` para os tipos `match_prize`, `match_loss`, `match_entry_refund` (por partida). Segunda tentativa de inserir → erro de constraint → rollback.
3. O endpoint de decisão do admin aceita um `decision_id` (uuid gerado no front) gravado em `matches.decisao_id` — retry com o mesmo id retorna o resultado já aplicado (idempotência de API).

---

## 5. Modelo de dados

```sql
-- users (novo) — elegibilidade (§2.1)
ALTER TABLE users
  ADD COLUMN riot_id text NULL,                 -- "Nome#TAG", obrigatório p/ sala apostada
  ADD COLUMN status text NOT NULL DEFAULT 'ativa',   -- 'ativa' | 'suspensa' | 'banida'
  ADD COLUMN suspensa_ate timestamp NULL,        -- fim da suspensão temporária (strikes)
  ADD COLUMN termos_aceitos_em timestamp NULL;   -- aceite dos Termos (18+)

CREATE UNIQUE INDEX idx_users_riot_id ON users (lower(riot_id)) WHERE riot_id IS NOT NULL;

-- match_players — garantias de vaga (§2.1)
-- 1 vaga por jogador por sala:
CREATE UNIQUE INDEX idx_match_players_unico ON match_players (match_id, user_id);
-- 1 sala apostada ativa por jogador (checada na transação de entrada com FOR UPDATE,
-- consultando salas do jogador em estados ativos com aposta_mc > 0)

-- user_strikes (novo) — anti no-show / AFK (§2.1)
CREATE TABLE user_strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  match_id uuid NOT NULL REFERENCES matches(id),
  motivo text NOT NULL,                          -- 'kick_ociosidade' | 'abandono'
  created_at timestamp NOT NULL DEFAULT now(),
  removido_por uuid NULL REFERENCES users(id),   -- admin que perdoou o strike
  removido_em timestamp NULL
);
CREATE INDEX idx_strikes_user_recentes ON user_strikes (user_id, created_at);

-- app_config (novo ou existente) — limites operacionais
-- aposta_min_mc, aposta_max_mc, taxa_pct_default, strikes_para_suspensao (3),
-- janela_strikes_dias (30), duracao_suspensao_horas (48)

-- user_wallets (novo)
ALTER TABLE user_wallets ADD COLUMN mc_reservado integer NOT NULL DEFAULT 0;

-- matches (novo)
ALTER TABLE matches
  ADD COLUMN aposta_mc integer NOT NULL DEFAULT 0,        -- 0 = casual
  ADD COLUMN taxa_pct numeric NOT NULL DEFAULT 8.99,      -- CONGELADA na criação da sala
  ADD COLUMN resultado text NULL,                          -- 'blue' | 'red' | 'draw'
  ADD COLUMN cancelado_em timestamp NULL,
  ADD COLUMN revisado_por uuid NULL REFERENCES users(id),  -- auditoria: quem decidiu
  ADD COLUMN revisado_em timestamp NULL,                   -- auditoria: quando decidiu
  ADD COLUMN decisao_id uuid NULL,                         -- idempotência do payout (§4.3)
  ADD COLUMN revisao_desde timestamp NULL;                 -- quando entrou em aguardando_revisao (SLA/fila)

-- match_prints (novo) — provas enviadas pelos jogadores
CREATE TABLE match_prints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  url text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- match_disputas (novo) — contestação de resultado (§6.1)
CREATE TABLE match_disputas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  motivo text NOT NULL,
  status text NOT NULL DEFAULT 'aberta',   -- 'aberta' | 'resolvida'
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)               -- 1 contestação por jogador por partida
);

-- Índices para o cron e o painel
CREATE INDEX idx_matches_status_updated ON matches (status, updated_at);
CREATE INDEX idx_matches_revisao ON matches (status, revisao_desde) WHERE status = 'aguardando_revisao';

-- Idempotência do ledger (§4.3)
CREATE UNIQUE INDEX idx_ledger_match_unico
  ON wallet_transactions (match_id, user_id, tipo)
  WHERE tipo IN ('match_prize', 'match_loss', 'match_entry_refund');
```

> **Observação:** nomes de coluna seguem o padrão Drizzle do projeto. Migrations geradas com `drizzle-kit generate` (invariante 3.5).
> **Regra da `taxa_pct`:** copiada da config global **no INSERT da sala**. O payout lê sempre `matches.taxa_pct`, nunca a config.

---

## 6. Fluxo de revisão do admin

```
partida_iniciada (aposta > 0)
      │  qualquer jogador confirmado envia print  ─── OU ─── 3h sem print (cron)
      ▼
aguardando_revisao  (grava revisao_desde = now())
      │  → máx. 3 prints por partida (evita spam)
      │  → notificação IMEDIATA ao admin: webhook Discord + badge no painel
      │  → app mostra ao jogador: "Em análise — pagamento em até X horas"
      ▼
admin abre o painel de revisão (fila ordenada por revisao_desde, mais antiga primeiro)
      │  vê: sala, times, jogadores, prints lado a lado, valores, disputas abertas
      ▼
  ┌─ aprovar Time A/B ─┐  ┌─── empate ───┐  ┌─ cancelar partida ─┐
  │ payout com taxa     │  │ devolve tudo  │  │ devolve tudo       │
  │ (§4.1 + §4.3)       │  │ sem taxa      │  │ sem taxa           │
  └─────────────────────┘  └───────────────┘  └────────────────────┘
           │ grava revisado_por + revisado_em em todos os casos
```

- **Upload do print**: rota `/api/upload` existente, bucket `match-prints` **privado**. A URL servida passa por endpoint autenticado (só admin e participantes da sala) — nunca link direto do disco.
- **Validação do upload**: tamanho máx. 5 MB, tipo verificado por magic bytes (não só extensão), rate limit por usuário na rota.
- **Notificação ao admin**: webhook do Discord dispara na entrada em `aguardando_revisao` (a comunidade já vive no Discord — custo ~20 linhas).
- **Mais de um revisor**: a permissão de revisar é por role (`admin` ou `moderador`), não por usuário fixo — o gargalo humano não pode ter ponto único de falha.

### 6.1 Disputa (contestação de resultado)

- Enquanto a sala está em `aguardando_revisao`, **qualquer jogador da sala** pode abrir uma contestação (botão "Contestar resultado" + campo de motivo).
- A contestação **não bloqueia** a decisão do admin — apenas aparece destacada no painel para ele pesar antes de decidir.
- 1 contestação por jogador por partida (constraint). Contestações ficam registradas para auditoria.
- v1 é só isso: registrar e exibir. Sem fluxo de apelação pós-payout (fica para depois, se necessário).

---

## 7. Realtime próprio na VPS

**Princípio:** *o WebSocket não transporta os dados da sala — só avisa "a sala X mudou". O cliente busca o estado atual via HTTP (`GET /api/matches/:id`).*

```
cliente                    servidor WebSocket               API
  │ subscribe sala 123           │                           │
  │ ──────────────────────────►  │                           │
  │ {subscribe, matchId:"123"}   │ LISTEN matches_channel    │
  │                              │   (conexão DEDICADA)      │
  │ alguém entrou numa vaga ───► │ transação no banco ─────► │ pg_notify("matches_channel", {matchId})
  │                              │  │                        │
  │ {match_update, matchId}      │◄─┘  (só o id, ~60 bytes)  │
  │ ◄──────────────────────────  │                           │
  │ [debounce 250ms no cliente]  │                           │
  │ GET /api/matches/123 (cookie) ────────────────────────►  │ valida sessão + permissão
  │ ◄──────────────────────────────────────────────────────  │ estado completo
```

**Leveza:**
- Socket trafega só o id da sala — poucos bytes, zero polling.
- **Debounce de 250ms no cliente**: múltiplos NOTIFY da mesma sala em sequência viram 1 único GET (evita thundering herd de 10 clientes refazendo GET simultâneo a cada micro-mudança).
- `pg_notify` é o recurso mais barato do Postgres.

**Segurança (6 travas):**
1. **Autenticação no handshake**: valida o cookie `m7_session` antes de aceitar a conexão.
2. **Validação de `Origin`** no handshake: rejeita conexões de origens que não sejam o domínio do app.
3. **Autorização por sala**: `subscribe_match` só é aceito se o usuário é participante (ou admin/moderador) daquela sala.
4. **Os dados nunca vêm do socket**: o cliente refaz `GET /api/matches/:id`, que valida permissão de novo.
5. **Limites**: máx. N conexões por usuário, rejeita `matchId` inválido.
6. **Ping/pong** a cada 30s: conexão que não responde 2 pings é derrubada — sem isso o limite por usuário enche de conexões zumbis.

**Robustez do LISTEN (crítico):**
- O `LISTEN` usa **uma conexão dedicada e persistente** — nunca uma conexão do pool (o pool recicla e o NOTIFY para de chegar silenciosamente).
- Reconexão automática com **re-LISTEN** ao detectar queda (restart do Postgres mata o LISTEN sem erro visível).
- Ao reconectar (servidor ou cliente), o cliente refaz o GET das salas inscritas para recuperar o que perdeu offline.

**O que fica na VPS:**
- Serviço `src/realtime/index.ts` entra no `docker-compose` como serviço `realtime` (porta 3001, interna).
- Nginx já tem o proxy `/ws/` configurado.
- Front troca `supabase.channel` pelo hook `useSalaRealtime` (com reconexão automática + refetch on reconnect + debounce).

**Pool do Postgres (VPS):**
- Pool único (`pg.Pool` via Drizzle) compartilhado por API + cron, limitado a ~20 conexões.
- - 1 conexão dedicada fora do pool para o LISTEN.

---

## 8. Cron de varredura (a cada 10 min)

Um único job com duas responsabilidades, ambas usando o índice `(status, updated_at)`:

1. **Kick de ociosidade**: vagas ocupadas há 30+ min em salas `preenchendo` → remove o jogador, devolve o MC, sala continua. (Aviso ao usuário aos 25 min via socket.)
2. **Partida fantasma**: salas `partida_iniciada` (aposta > 0) há 3+ horas → move para `aguardando_revisao` + notifica o admin. Partida de LoL não dura 3h; se chegou aí, algo deu errado e um humano precisa olhar.

Cada ação do cron roda na mesma máquina de estados do `match-flow.ts` (com `FOR UPDATE`) — o cron não escreve estado por fora.

---

## 9. Arquitetura (o que existe vs. o que é novo)

**Já existe e fica:**
- `matches`, `match_players`, `match_codes` (schema)
- Máquina de estados no servidor (`match-flow.ts`) com `FOR UPDATE`
- `wallet_transactions` (ledger), `platform_revenue` (taxa)
- Rota `/api/upload` (storage local)
- Sessão própria por cookie (ADR-011)

**É novo:**
1. Colunas novas em `user_wallets` e `matches` (incl. auditoria + idempotência, §5)
2. Tabelas `match_prints` e `match_disputas`
3. Estados `aguardando_revisao` e `cancelada` na máquina de estados
4. Funções de escrow em `match-flow.ts`: reservar, devolver, payout com taxa e arredondamento (§4.1), empate, cancelamento — todas idempotentes (§4.3)
5. Cron de varredura: kick de ociosidade + partida fantasma (§8)
6. Endpoints de revisão (listar fila, ver prints/disputas, aprovar/empate/cancelar com `decision_id`)
7. Endpoint de upload de print (bucket `match-prints` privado, validação por magic bytes, rate limit)
8. Endpoint de contestação (§6.1)
9. Webhook Discord de notificação ao admin
10. Realtime próprio no docker-compose + `useSalaRealtime` no front
11. Painel admin "Revisão de Partidas" (fila por antiguidade, prints lado a lado, disputas destacadas, botões idempotentes)
12. UI de wallet com saldo separado (disponível vs. em partida) + extrato com link para a sala

**Operação (obrigatório antes de ir pro ar):**
- **Backup automatizado**: `pg_dump` diário + cópia **para fora da VPS** (outro servidor ou bucket barato). Há dinheiro real de usuário no banco; disco de VPS morre. Sem backup externo, não lança.
- Teste de **restore** do backup pelo menos uma vez antes do lançamento.
- Logs estruturados de toda transição de estado com dinheiro (match_id, user_id, valores, quem disparou).

---

## 10. Roadmap: validação de resultado via Riot API

### 10.1 Restrições verificadas (por que o print é o mecanismo do MVP)

- **O acesso atual do projeto é apenas `tournament-stub-v5`.** O stub é um mock de integração: simula provider/tournament/codes para testar código, mas **os códigos gerados não são registrados nos servidores de jogo e não criam lobby real no client**. As 6 chaves existentes geradas via stub não correspondem a partidas reais e não servem para consultar nada. (É também por isso que "nunca expiram" — códigos reais do Tournament-V5 expiram ~3 meses após gerados.)
- **Custom games são privados na `match-v5`.** As partidas do M7 Arena são lobbies personalizados, e a Riot bloqueou o acesso a custom games na match-v5 (retorna 404 mesmo com o match ID conhecido). A orientação oficial da Riot é que a via para customs consultáveis é o **tournament code**.
- **Conclusão:** sem Tournament-V5 de produção, **não existe validação automática confiável** do resultado de uma custom. Print + revisão manual não é atalho provisório — é o único mecanismo real disponível hoje, e o design do MVP assume isso (SLA visível, notificação Discord, fila de revisão, disputa).

### 10.2 Fases

1. **Fase 1 — MVP (este documento):** print + revisão manual + notificação Discord + SLA visível + disputa. Mecanismo definitivo até a aprovação da Riot.
   - *Sinal fraco opcional no painel:* com a key atual (account-v1 + match-v5 públicas) dá para exibir selos periféricos ao admin — "Riot ID existe e é da região", "jogador não estava em partida ranqueada/normal no horário alegado". Não valida a custom, mas ajuda a detectar print suspeito. Baixa prioridade; só se sobrar tempo.
2. **Fase 2 — Submeter a application de produção (em paralelo ao desenvolvimento do MVP):** registrar uma **aplicação de produção do League of Legends** no Developer Portal e solicitar acesso ao **Tournament-V5**, informando que a plataforma organiza partidas competitivas. O clock da aprovação (semanas) corre enquanto o MVP é construído — submeter cedo.
   - *Atenção na aplicação:* deixar explícito que **MC não é conversível em dinheiro real** (as políticas da Riot são restritivas com gambling). Esse ponto pode ser decisivo na análise.
3. **Fase 3 — Migração para tournament codes (condicionada à aprovação):**
   - A criação da sala gera um tournament code real (lobby já configurado: mapa, draft, tamanho de time, participantes permitidos por PUUID).
   - Registro de **provider com URL de callback**: o resultado da partida chega via HTTP POST automaticamente ao servidor — sem polling, sem consulta.
   - **Auto-payout:** resultado recebido via callback + ninguém contestou em 1h → payout roda sozinho pela mesma máquina de estados (idempotência §4.3 já cobre). Admin passa a revisar **apenas disputas e divergências** — o gargalo humano vira exceção.
   - O fluxo de print permanece como fallback (callback pode falhar; a própria Riot recomenda auditar por eventos de lobby apenas como apoio).

### 10.3 O que o design do MVP já deixa pronto para a Fase 3

- `match_codes` já existe no schema — passa a armazenar o tournament code real no lugar do código manual.
- A máquina de estados não muda: o callback da Riot é só mais um gatilho de entrada em `aguardando_revisao` → auto-decisão, pelas mesmas funções idempotentes de payout.
- O endpoint de callback é um handler novo e pequeno; nada do fluxo de escrow, ledger ou revisão precisa ser reescrito.

---

## 11. Usabilidade (requisitos de front)

- **Modal de saldo insuficiente**: ao tentar entrar sem saldo → "Saldo insuficiente — faltam **X MC**" + botão **"Recarregar agora"** direto pro fluxo de recarga, e voltar pra sala após recarregar (deep link de retorno). Nunca erro genérico.
- **Vitrine pública**: visitante deslogado vê a lista de salas e o estado de cada uma; qualquer clique de ação abre o modal de cadastro/login com a sala ao fundo. A sala cheia de gente apostando é o melhor marketing da plataforma.
- **Riot ID obrigatório com aviso antecipado**: se o usuário sem Riot ID vinculado abrir uma sala apostada, o aviso aparece **antes** de ele clicar na vaga ("vincule seu Riot ID para jogar valendo MC"), não como erro depois.
- **Modal "você já está em outra sala"**: com link direto para a sala que está segurando a vaga/MC dele.
- **Strikes visíveis**: contador "2/3 strikes" no perfil + aviso no momento em que ganhar um; suspensão mostra quando termina.

- **Countdown de confirmação (60s)** sincronizado pelo `confirmacao_expires_at` **do servidor** — nunca timer local (origem do bug antigo de 40s vs 60s).
- **Aviso de kick**: toast/badge aos 25 min de ociosidade ("você será removido da vaga em 5 min"). Heartbeat do socket na sala renova o timer.
- **Wallet transparente**: "X MC disponível + Y MC em partida", com o valor reservado linkando para a sala que o segura. Saldo que "some" sem explicação = ticket de suporte.
- **Estado pós-print**: tela mostra "Em análise — prints recebidos: 2/3 — pagamento em até X horas". O envio nunca pode parecer que caiu no vazio.
- **Regras visíveis antes de confirmar**: valor da aposta, taxa da plataforma, regra de abandono (AFK perde) e SLA de pagamento — tudo na tela de confirmação. Em plataforma de aposta, confiança é o produto.
- **Reconexão transparente**: aba dorme / 4G oscila → `useSalaRealtime` reconecta sozinho e refaz o GET. Voltar pra aba nunca mostra sala congelada.
- **Botões do admin idempotentes**: desabilitam ao clicar; segunda decisão retorna "partida já decidida" sem efeito colateral.

---

## 12. Testes

- **Elegibilidade:** deslogado vê a sala mas qualquer ação → modal de cadastro; sem saldo → modal com valor faltante (e a transação no servidor rejeita mesmo se o front for burlado); sem Riot ID → bloqueado em sala apostada, liberado em casual; conta suspensa/banida → bloqueada; jogador já em sala apostada ativa → rejeitado com referência à sala; dois cliques simultâneos com saldo para um só → exatamente um entra.
- **Strikes:** kick por ociosidade gera strike; 3 strikes em 30 dias → suspensão de salas apostadas (casual continua); strike removido por admin registra quem/quando; suspensão expira sozinha.

- **Concorrência (o bug antigo):** N chamadas simultâneas de entrar/confirmar na mesma sala → uma única transição, sem duplicidade (lock segura).
- **Idempotência do payout:** duas chamadas simultâneas de "aprovar" na mesma sala → exatamente 1 payout; a segunda recebe "já decidida". Repetir com o mesmo `decision_id` → retorna o resultado aplicado, sem duplicar ledger.
- **Escrow (invariante):** `reservado + disponível` constante em todo o ciclo (entrar → sair → entrar → confirmar → encerrar/empatar/cancelar). Asserção automática após cada transição nos testes.
- **Arredondamento:** casos com pote/vencedores que não dividem exato (ex: 3 vencedores, pote 1000, taxa 8,99%) → soma de prize + loss + taxa + resto fecha exatamente com o pote.
- **Empate:** todos reembolsados integralmente, `platform_revenue` sem lançamento, sala `encerrada` com `resultado='draw'`.
- **Kick:** ocioso 30 min → removido, dinheiro devolvido, sala continua; interação renova o timer.
- **Partida fantasma:** sala iniciada há 3h sem print → cron move para `aguardando_revisao`, admin notificado, nenhum MC em limbo.
- **Revisão completa:** partida até `encerrada` → pote, taxa em `platform_revenue`, resto de arredondamento no ledger e saldo final de cada jogador conferem.
- **Cancelamento:** admin cancela após iniciar → todos reembolsados, sala `cancelada`, auditoria (`revisado_por/em`) gravada.
- **Disputa:** contestação registrada, aparece no painel, não bloqueia decisão; segunda contestação do mesmo jogador rejeitada.
- **Realtime:** duas abas/usuários veem mudanças sem refresh; derrubar o Postgres → LISTEN reconecta e re-escuta; matar a aba e voltar → estado atual recuperado no reconnect; conexão sem pong é derrubada.
- **Upload:** arquivo > 5 MB rejeitado; arquivo renomeado (magic bytes divergentes) rejeitado; 4º print da mesma partida rejeitado; acesso ao print por não-participante → 403.
- **Restore de backup:** dump restaurado em ambiente limpo e API sobe contra ele.
