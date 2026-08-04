# 🔧 Ajustar Sala — Força-tarefa de sincronização realtime

> Status: **EM INVESTIGAÇÃO** — nenhuma mudança de código foi feita ainda.
> Este documento é o plano da força-tarefa. Todo item abaixo nasce de um teste
> real feito na VPS (`dev.m7arena.pro`) com 2 contas simultâneas.

---

## 1. O que foi observado no teste real (síntese do usuário)

| # | Sintoma | Gravidade |
|---|---------|-----------|
| A | Quando a **última vaga é preenchida**, a contagem de confirmação NÃO inicia para quem **já estava na sala** (só inicia para quem entrou por último, e mesmo assim às vezes só após recarregar a página). | crítica |
| B | O **cronômetro de confirmação fica dessincronizado** entre os jogadores: um vê 20s, outro vê 70-75s. O tempo não vem do servidor de forma alinhada. | crítica |
| C | Em **sala 1v1**, a contagem abriu com **apenas 1 jogador** na vaga (o outro "fantasma"?). Suspeita do usuário: o outro player estava numa vaga de outra sala e foi contado. | crítica |
| D | **Contas bloqueadas para entrar em qualquer vaga** com erro `ja_em_outra_sala`, mesmo com todas as partidas iniciadas já encerradas. **CAUSA RAIZ ENCONTRADA** (abaixo). | crítica |

---

## 2. O que já foi confirmado e corrigido nesta sessão (item D)

### 2.1 Causa raiz (encontrada no banco da VPS)

Uma sala (sala `2`) estava **presa no estado `finalizacao`** — o estado da
votação red/blue que foi **removida do código pelo ADR-027** (commit `2038924`).

- Depois do ADR-027, **não existe mais nenhum código** que gere ou transicione
  o estado `finalizacao` (confirmado: `rg finalizacao api/src` → 0 ocorrências).
- Mas a sala ficou **no banco** nesse estado, com os 2 jogadores em
  `match_players.linked = true`.
- O `join` de qualquer outra sala consulta apenas `linked=true`
  (`api/src/routes/matches.ts:220-226`) **sem filtrar se a sala ainda está
  ativa** — então a sala morta bloqueava os 2 usuários para sempre.

### 2.2 Correção de dados aplicada (one-off, sem mudança de código)

```sql
BEGIN;
UPDATE matches SET status='encerrada', ended_at=now(), updated_at=now(),
       state_deadline_at=NULL
WHERE sala_num=2 AND status='finalizacao';
UPDATE match_players SET linked=false
WHERE match_id=(SELECT id FROM matches WHERE sala_num=2) AND linked=true;
COMMIT;
```

Resultado: sala `2` → `encerrada`, `linked` = 0 nos 2 jogadores. As contas
voltaram a entrar em vagas. **Isto destrava o sintoma imediato, mas não
corrige o bug de código** (seção 3.4).

---

## 3. Análise de causa raiz por sintoma (código lido nesta sessão)

### 3.1 Bug A — contagem não inicia para quem já está na sala

**Onde:** `web/src/hooks/useSalaSimples.ts`

- O ADR-026 resolveu **só o lado de quem dispara a ação**:
  - `entrar()` → se `r.estado === 'confirmacao'` faz `sincronizarTudo('entrar')`
    (linhas 344-345) — refetch da sala inteira.
- Quem **já estava na sala** não dispara nada. Ele depende **exclusivamente do
  WebSocket** (`useSalaRealtime` → `onUpdate` → `sincronizarTudo('realtime')`).
- Se o socket não está conectado (serviço `realtime` fora do ar — **foi exatamente
  o caso na VPS até o commit `b9bc34e`**, ou aba em background, ou mensagem
  perdida), o jogador não vê a transição até recarregar.

**Conclusão:** o servidor **já** faz `notifyMatchChange` (pg_notify → WS) no
join. O problema é a **confiabilidade da entrega** ao cliente + a falta de um
fallback. Não há polling de backup quando o WS falha.

### 3.2 Bug B — cronômetro dessincronizado (20s vs 75s)

**Onde:** `web/src/hooks/useSalaSimples.ts:85-87`

```ts
const timer = sala?.confirmacao_expires_at
  ? Math.max(0, Math.round((new Date(sala.confirmacao_expires_at).getTime() - Date.now()) / 1000))
  : 60;
```

- O timer usa `Date.now()` — o **relógio local do dispositivo** — contra um
  timestamp absoluto vindo do servidor.
- Se o relógio do dispositivo B está atrasado em relação ao servidor, ele
  "enxerga" mais segundos no futuro (75s num deadline de 60s). Dispositivos com
  relógios diferentes → contagens diferentes.
- `timerIniciandoPartida` (linhas 89-91) tem o mesmo problema.

**Conclusão:** falta **correção de skew de relógio** (server time sync). O
padrão de mercado para isso é o cliente calcular o offset entre o relógio do
servidor e o local, e usar `now + offset` para derivar timers.

### 3.3 Bug C — 1v1 abriu contagem com 1 jogador

**Onde:** `api/src/lib/match-flow.ts` (`avaliarTransicoes`, linhas 132-150)

- A transição `preenchendo → confirmacao` só ocorre quando
  `total >= max` (1v1 → max=2).
- `totalJogadores` conta `match_players WHERE match_id = matchId` — **só da sala
  atual**, não de outras. Então a hipótese "o outro player estava em outra sala
  e foi contado" **não se sustenta na conta do servidor**.
- **Explicação provável:** na criação, o criador **já entra como jogador**
  (`api/src/routes/matches.ts:155-162`, blue/TOP/confirmed). Então uma sala 1v1
  "nova" já tem 1 vaga preenchida no servidor. Se a UI do criador está
  desatualizada (Bug A — sem realtime/refetch), a tela mostra "só 1" ou "0",
  mas o servidor já vê 2 quando o segundo entra → a contagem abre. É um
  **efeito combinado do Bug A** sobre a percepção, não uma contagem errada do
  servidor.

**Para confirmar:** precisa de repro com log no servidor (imprimir `total` e
`max` na transição) + olhar a tela no momento. **Não fechado ainda.**

### 3.4 Bug D — linked preso em sala morta (causa raiz de código)

**Onde:** `api/src/routes/matches.ts:219-226`

```ts
const outrosVinculos = await tx
  .select({ matchId: matchPlayers.matchId })
  .from(matchPlayers)
  .where(and(eq(matchPlayers.userId, user.id), eq(matchPlayers.linked, true)));
if (outrosVinculos.some((p: any) => p.matchId !== match.id)) {
  return { ok: false, erro: "ja_em_outra_sala", estado: match.status, mudou: false };
}
```

- Consulta `linked=true` **sem join com `matches`** → uma sala em
  `finalizacao`/`encerrada`/`cancelada` com `linked` preso bloqueia para sempre.
- `linked` deveria ser liberado em TODOS os caminhos de término (decisão de
  revisão faz isso em `revisao.ts:141`, mas salas que ficaram presas em estados
  mortos não passam por lá).

---

## 4. Pesquisa de mercado — como resolver timer sync em tempo real

### 4.1 Problema
Dois relógios não são iguais. Todo cliente que calcula "tempo restante" com
`Date.now()` contra um timestamp do servidor vai divergir dos outros clientes.

### 4.2 Padrões de mercado (games e SaaS em tempo real)

| Padrão | Descrição | Uso aqui |
|--------|-----------|----------|
| **Server time + clock offset** | O servidor expõe o epoch atual (ex.: endpoint `GET /api/time` ou o header `Date` de qualquer resposta). O cliente mede `offset = serverNow - clientNow` uma vez e passa a usar `Date.now() + offset` em todo cálculo. | elimina o Bug B. |
| **Server sends `remaining_ms`** | O servidor calcula `deadline - now` no momento da resposta e o cliente apenas decrementa a partir do timestamp de recebimento. | alternativa ao offset; simples, mas sensível a latência. |
| **Broadcast de estado (WS)** | Toda mutação faz push para todos os inscritos da sala (o `pg_notify` + serviço `realtime` já faz isso). | base do Bug A; precisa de confiabilidade. |
| **Fallback polling leve** | Enquanto a sala está em estado ativo, o cliente faz GET leve a cada 5-10s para cobrir falha/queda do WS. | resolve o Bug A sem depender 100% do WS. |
| **Heartbeat/keepalive** | WS com ping/pong (o realtime já implementa, trava 6). | garante detecção de queda. |

### 4.3 Recomendação de arquitetura (a discutir com o usuário)

1. **Relógio do servidor vira a fonte única** para qualquer deadline:
   - Adicionar `server_time` no shape de `GET /api/matches/:id` (ou um
     `GET /api/time` barato).
   - No cliente, medir o offset uma vez (na carga inicial) e derivar todos os
     timers com `Date.now() + offset`.
2. **Sincronização por evento + fallback**:
   - Manter o WS como via principal (já existe).
   - Adicionar um **polling leve** (ex.: 5s) enquanto a sala estiver em
     `preenchendo`/`confirmacao`/`iniciando_partida`, que só dispara se o WS
     estiver "suspeito" (sem `match_update` recente) — ou simplesmente um
     polling curto e barato nesses estados, já que o GET é leve.
3. **Proteção do `join` contra salas mortas** (Bug D):
   - Filtrar `outrosVinculos` por `matches.status IN (ESTADOS_ATIVOS)`
     (join com `matches`), ignorando `linked` de salas em
     `finalizacao`/`encerrada`/`cancelada`.
   - Adicionar **salvaguarda no cron**: normalizar/limpar salas presas em
     estados mortos (ex.: `finalizacao` → `encerrada`) e liberar `linked`
     residual de salas que não estão mais ativas.

---

## 5. Plano de implementação (por fase)

> **Status atual:** Fases 1-5 **concluídas e no ar** na VPS (incluindo o teste
> visual com 2 contas reais em sala 1v1).

> **Atualização (2026-08-04): Fases 1, 2 e 3 implementadas, commitadas e no ar
> na VPS.** Restam as Fases 4 e 5 (validação visual com 2 abas reais).

### Fase 1 — Servidor: relógio único + proteção de join (Bug D + B) ✅
- [x] `GET /api/matches/:id` e `GET /api/matches` passam a incluir
      `server_time` (epoch ms) no shape.
- [x] `join`: filtrar `outrosVinculos` por sala **ativa**
      (`matches.status IN ESTADOS_ATIVOS`).
- [x] Cron: job de saneamento — salas presas em estados mortos (`finalizacao`)
      viram `encerrada`/`cancelada` e `linked` residual é liberado.
- [x] Testes: API (`npx tsx --test`) + smoke de regressão.

### Fase 2 — Cliente: clock offset nos timers (Bug B) ✅
- [x] `useSalaSimples`: medir `offset = server_time - Date.now()` na carga e
      usar `Date.now() + offset` em `timer` e `timerIniciandoPartida`.
- [x] Recalcular offset a cada refetch (barato) para cobrir relógio que muda.

### Fase 3 — Cliente: contagem inicia para todos (Bug A) ✅
- [x] Fallback: polling leve (5s) nos estados ativos quando o WS não entregou
      `match_update` recente (ou polling simples nesses estados).
- [x] Garantir que o `onUpdate` do WS refaça o GET mesmo quando o estado não
      mudou (para atualizar `confirmacao_expires_at` de todos).

### Fase 4 — Bug C: repro e fechamento ✅
- [x] Log temporário no `avaliarTransicoes` (total, max, matchId) para repro.
      → smoke-vps-salas.mjs provou que o servidor NÃO abre contagem com 1
      jogador (1v1 segue `preenchendo` com 1 vaga; só abre com 2).
- [x] Teste real 1v1 com 2 contas e comparação de telas.
- [x] Confirmar se é efeito do Bug A ou há contagem errada de verdade.
      → CONFIRMADO visualmente (2026-08-04): sala #23 com 1 jogador ficou em
      "AGUARDANDO JOGADORES"; com o 2º jogador na última vaga, abriu
      "CONFIRMANDO PRESENÇA" com timer. Era efeito do Bug A (sync visual),
      não do servidor.

### Fase 5 — Deploy e smoke na VPS ✅
- [x] Commit + push + `docker compose up -d --build app nginx realtime`.
- [x] Smoke automatizado: smoke-vps-salas.mjs 9/9 (1v1 não abre com 1 jogador,
      deadline = 60s coerente com server_time, linked residual liberado).
- [x] Smoke VISUAL: 2 jogadores em 2 abas reais, preencher última vaga, conferir
      contagem igual nas duas telas + timers alinhados + entrar em nova sala
      após encerrar. → CONFIRMADO (sala #23: contagem abriu ao preencher a
      última vaga; timer no servidor coerente com as telas).

---

## 6. Critérios de aceite (o que o teste real precisa provar)

1. **Contagem inicia simultaneamente** para TODOS os jogadores da sala quando a
   última vaga é preenchida — **sem recarregar a página**.
2. **Cronômetro idêntico** em todas as telas (diferença ≤ 1s).
3. **1v1 não abre contagem** com menos de 2 jogadores reais.
4. **Nenhuma conta fica bloqueada** com `ja_em_outra_sala` após a partida
   encerrar — entrar em nova sala imediatamente.
5. Com o serviço `realtime` fora do ar, a sala ainda funciona (fallback polling)
   — a contagem continua sendo exibida (com atraso de até ~5s).

---

## 7. Arquivos envolvidos (para referência)

| Arquivo | Papel |
|---------|-------|
| `api/src/routes/matches.ts` | join (bloqueio `ja_em_outra_sala`), shape da sala |
| `api/src/lib/match-flow.ts` | máquina de estados, `avaliarTransicoes` |
| `api/src/lib/match-shape.ts` | shape legado (onde entra `server_time`) |
| `api/src/cron.ts` | saneamento de salas mortas / linked residual |
| `api/src/lib/elegibilidade.ts` | `ESTADOS_ATIVOS` (fonte dos estados vivos) |
| `web/src/hooks/useSalaSimples.ts` | timers locais, tick, sincronização |
| `web/src/hooks/useSalaRealtime.ts` | WS próprio + reconexão |
| `web/src/pages/SalaMod1.tsx` | UI da contagem/timer |
| `web/src/pages/Jogar.tsx` | criação de sala, listagem |
| `api/src/realtime/index.ts` | WS (pg_notify → broadcast) |
