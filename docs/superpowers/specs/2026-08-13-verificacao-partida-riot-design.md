# Verificação automática de partidas via Riot API — design

**Data:** 2026-08-13
**Status:** aprovado (brainstorming)
**Fase:** Fase 3 (app) — muda o fluxo de resultado de salas

## Objetivo

Substituir a decisão de resultado baseada em print (que hoje leva toda sala a
`aguardando_revisao` para o admin decidir) por **verificação automática via Riot
match v5**. A Riot é a fonte da verdade: ela diz quem jogou (PUUIDs), quem
venceu (`teams[].win`) e as stats. O print deixa de ser o gatilho — vira
evidência opcional de **contestação**, que só existe em partidas finalizadas.

## Decisões de design (validadas com o usuário)

1. **A verificação automática decide o vencedor e paga o escrow para TODAS as
   salas** (casuais e apostadas). O admin não aprova resultado no fluxo normal —
   só vê o log. A Riot é a fonte da verdade.
2. **Nick que não bate = cancela na hora.** Se a partida foi achada mas 1+ PUUID
   dos `participants` não corresponde aos vinculados na sala, a sala é cancelada
   e o MC devolvido — o impostor não leva nada. Sem apelação.
3. **Partida não encontrada = polling por até 3h, depois cancela.** O cron
   (10min) varre salas em `partida_iniciada`. Passou 3h sem achar a partida na
   Riot → `cancelada` + devolve MC (mesmo comportamento da "partida fantasma"
   atual, mas com devolução).
4. **Botão "Verificar partida" = acelerador.** Qualquer jogador da sala em
   `partida_iniciada` clica e dispara a mesma verificação na hora. Se achou +
   bateu → finaliza e paga imediatamente. Se não → volta ao fluxo normal do
   polling (3h).
5. **Contestação só em partida finalizada (`encerrada`).** O jogador (participante
   confirmado) anexa print (imagem) + motivo (texto). O resultado **fica de pé**
   enquanto o admin analisa.
6. **Contestação procedente = cancelamento total.** O admin julga, e se houver
   problema reverte tudo: desfaz o payout, **todos voltam com o saldo de antes**
   e a sala vira `cancelada`. Se improcedente, só fecha a disputa.
7. **Polling mora no servidor** (cron), não no cliente — não depende de aba
   aberta e não vaza regra de negócio para o cliente (invariante 3.3).

## Fluxo da sala (nova máquina de estados)

```
partida_iniciada  (jogo rolando na Riot)
   │
   ├─ botão "Verificar partida" (qualquer jogador) ─► verificação imediata
   ├─ cron (a cada 10min) ──────────────────────────► verificação automática
   ▼
verificarPartida(matchId):
   ├─ não achou partida na Riot
   │     └─ < 3h desde partida_iniciada ──► continua (volta ao fluxo)
   │     └─ ≥ 3h ──────────────────────────► CANCELADA + devolve MC
   ├─ achou, endOfGameResult="GameComplete", 10 nicks batem
   │     └─ ► ENCERRADA + winnerSide + pagarPremio (escrow automático)
   └─ achou, mas 1+ nick NÃO bate
         └─ ► CANCELADA + devolve MC (impostor não leva nada)
```

Depois de `encerrada`/`cancelada` o polling **acaba** — a sala só existe na
seção "Partidas Finalizadas". `aguardando_revisao` deixa de ser alcançável no
fluxo normal (fica para compatibilidade/legado); o painel do admin passa de
"revisar resultado" para "revisar contestação".

## Motor de verificação — `api/src/lib/verificar-partida.ts` (novo, ~400 linhas)

Função `verificarPartida(matchId)`:

**Passo 1 — achar a partida certa na Riot.** A Riot não busca por código
diretamente. Método (validado em 2026-08-13 com dados reais):
1. Pegar `codigoPartida` da sala e os PUUIDs dos jogadores
   (`game_accounts.external_id` via `match_players.userId`).
2. Varrer o histórico de **cada** jogador:
   `by-puuid/ids?queue=3130&startTime=<createdAt da sala>&endTime=agora`.
3. Juntar os matchIds, buscar cada um e filtrar onde
   `info.tournamentCode === codigoPartida`.
4. Se **vários** matches com o mesmo código (código reutilizável), escolher o de
   `gameCreation` mais próximo do `iniciandoPartidaAt` da sala — janela de tempo
   + conjunto de PUUIDs desambigua (nunca os mesmos jogadores/horários).

**Passo 2 — conferir os 10 nicks.** Comparar PUUIDs de `info.participants[]` da
partida achada contra os PUUIDs vinculados na sala (`match_players` +
`game_accounts`):
- Todos batem → vencedor = time com `teams[].win`, gravar `match_results`
  (winnerSide + payload da Riot), chamar `pagarPremio`.
- Qualquer PUUID ≠ sala → `pagarCancelamento` + `cancelada`.

**Passo 3 — cache e rate limit.** O cron varre N salas; a Riot cobra por
chamada. Reaproveitar `riotFetch`/`riotRaw` de `riot.ts` (cache em memória).
Guardar matchIds já vistos por sala para não repetir a varredura a cada 10min.
Respeitar `X-Rate-Limit` com backoff.

**Idempotência:** se a sala já está `encerrada`/`cancelada`, no-op.

## Cron — `api/src/cron.ts` (mudança)

- O passo de "partida fantasma" muda: sala `partida_iniciada` há 3h sem
  resolução → **`cancelada` + devolve MC** (antes ia para `aguardando_revisao`).
- Novo passo: para cada sala `partida_iniciada` com menos de 3h, chamar
  `verificarPartida` (com cache para não estourar rate limit).

## Botão — `POST /api/matches/:id/verificar` (novo, em matches-actions.ts)

- Requer participante **confirmado** da sala em `partida_iniciada`.
- Chama `verificarPartida(matchId)` e devolve o resultado:
  `{ ok, estado, vencedor?, erro? }`.
- Retorna "ainda em jogo / não encontrada" quando a partida não apareceu — o
  jogador volta ao fluxo normal do polling.
- `notifyMatchChange` na transição.

## Contestação — `api/src/routes/disputas.ts` (mudança) + front

- `abrirDisputa` passa a aceitar sala em **`encerrada`** (hoje só
  `aguardando_revisao`).
- Vínculo do print à disputa: nova coluna `contestacao_url` em `match_disputas`
  (migration). O upload usa o bucket `match-prints` (fluxo existente em
  `upload.ts`), e a URL do print vai para a disputa.
- O print de contestação é **1 por disputa** (não o teto de 3 da partida).

## Painel admin — `web/src/components/admin/RevisaoPartidas.tsx` (mudança)

- Lista **disputas abertas** em partidas `encerrada` (não mais fila de
  `aguardando_revisao`).
- Admin vê: resultado verificado (vencedor da Riot, KDA), print da contestação,
  motivo, e decide:
  - **Improcedente** → fecha a disputa (status `resolvida`); resultado continua;
    escrow intocado.
  - **Procedente** → chama `reverterPayout` (sala vira `cancelada`).
- Mostrar aviso quando o estorno de um vencedor falha por saldo insuficiente.

## Escrow — `api/src/lib/escrow.ts` (novo: `reverterPayout`)

Estorno do payout para o estado pré-aposta (contesção procedente):

```
reverterPayout(matchId, aposta, players, taxaPct, calc):
  para cada vencedor:  mc -= porVencedor  (devolve o prêmio)
                       mc += aposta       (devolve a reserva)
  para cada perdedor:  mc += aposta       (devolve a reserva "perdida")
  estornar platform_revenue (taxa + resto) da partida
  ledger: match_prize_revert + match_entry_refund para todos
  sala → cancelada
```

**Restrição explícita:** o estorno do vencedor exige que ele ainda tenha `mc >=
porVencedor` a estornar. Se gastou o prêmio, o admin vê aviso "saldo insuficiente
para estorno" e decide manualmente. É a natureza de reverter dinheiro já
movimentado.

## Front — `web/src`

**SalaMod1.tsx:**
- `partida_iniciada`: sai o botão "Enviar print", entra **"Verificar partida"**
  (qualquer jogador da sala) → spinner "Verificando..." → resultado (finalizada +
  vencedor / ainda em jogo / cancelada).
- Aviso reforçado **"confiram os nicks"** no CTA de confirmar presença — nick
  errado = sala cancelada.

**ResultadoPartida.tsx (partida finalizada):**
- Bloco "Contestar resultado" para participantes confirmados: upload de print +
  campo motivo. Mostra o resultado verificado pela Riot quando disponível.

**AguardandoRevisao.tsx:** deixa de ser usado no fluxo normal (não há mais sala
em `aguardando_revisao`). Remover.

**Jogar.tsx / Finalizadas:** cards seguem como estão (ADR-030); contestação abre
de dentro da sala finalizada (ResultadoPartida), não no card.

**Realtime:** transição `partida_iniciada` → `encerrada`/`cancelada` pelo
cron/botão usa `notifyMatchChange` (já existente).

## O que sai

- `report-result` (matches-actions.ts) deixa de ser usado pelo front.
- Envio de print durante o jogo (gatilho de revisão) — removido.
- Cron de fantasma para `aguardando_revisao` → vira cancelamento com devolução.
- Componente AguardandoRevisao.

## Migration (banco)

- `match_disputas`: nova coluna `contestacao_url` (text, nullable).

## Testes

- `verificarPartida`: achou+nicks batem → encerrada+paga; nick não bate →
  cancelada+devolve; não achou < 3h → continua; ≥ 3h → cancelada.
- `reverterPayout`: vencedores/perdedores voltam ao saldo pré-aposta; estorno de
  taxa; aviso de saldo insuficiente quando vencedor gastou o prêmio.
- Disputa abre em `encerrada`; admin procedente → reverterPayout + cancelada;
  improcedente → fecha sem tocar escrow.
- Botão `verificar` idempotente em sala já finalizada.
- Front: tsc web + api, build web.

## Riscos / dependências

- **BLK-006:** a `RIOT_API_KEY` na VPS é chave de dev (expira ~24h). A
  verificação automática depende de chave válida. Para produção é necessária
  chave permanente (personal key) — já registrado como bloqueio.
- Spectator API (jogo ao vivo) deu **403** com a chave atual — por isso a
  verificação dos nicks acontece no fim do jogo (match v5), não durante. Se o
  spectator desbloquear no futuro, dá para antecipar a checagem.
- `RIOT_API_KEY` continua no servidor, nunca no bundle (invariante 3.4).
