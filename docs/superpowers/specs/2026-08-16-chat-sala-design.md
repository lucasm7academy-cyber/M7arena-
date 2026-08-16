# Chat da Sala de Partida — Design

**Data:** 2026-08-16 · **ADR:** ADR-040 · **Status:** aguardando revisão

## Contexto

As salas de partida (5v5, aram, 1v1, time_vs_time) precisam de um chat de
conversa geral entre os jogadores que estão na sala. Requisitos do usuário:

- **Leve** — não pode comprometer a performance da sala nem pesar no servidor.
- **Autoexclusão** — mensagens somem após 5 minutos (da UI e do banco).
- **Posição** — canto inferior direito da tela da sala, quase encostado na borda.
- **Partidas finalizadas não têm chat** — o widget só existe em salas ativas.
- **Permissão** — qualquer um que esteja na sala (participante de `match_players`,
  qualquer vaga/cargo) e staff (admin/moderador/proprietário) podem usar; exige
  conta Riot vinculada (`users.riot_id` preenchido).

## Decisões de arquitetura (ADR-040)

O chat trafega pelo **WebSocket próprio** (`api/src/realtime`), não pelo polling.
Motivo: o socket já existe e os participantes já estão assinados no `rooms` map.
O custo é INSERT no Postgres (~0,1ms) + fan-out em memória (≤20 sockets). Zero
requests HTTP extras no caso normal.

Descartado:

- **Chat no polling** — cada usuário somaria 1 request HTTP a cada 5s. 200 salas
  ativas × 10 jogadores ≈ 400 req/s extras. Pesa no VPS de 2 vCPU.
- **Chat piggyback no `match_update`** — cada mensagem faria todos os clientes
  refazerem o `GET /api/matches/:id` inteiro. Chat é alta frequência, o GET é pesado.

## Modelo de dados — migration `0018_sala_mensagens.sql`

```sql
CREATE TABLE IF NOT EXISTS sala_mensagens (
  id         bigserial PRIMARY KEY,
  match_id   uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id),
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sala_mensagens_match_id_id_idx
  ON sala_mensagens (match_id, id);
CREATE INDEX IF NOT EXISTS sala_mensagens_created_at_idx
  ON sala_mensagens (created_at);
```

Registrado em `db/schema/matches.ts` (tabela relacionada a partida, junto de
`match_players`), exportado no index do schema. `match_id` usa o `matches.id`
(uuid), igual a `match_players`. Nome `nome`/`tag`/`avatar` **não** são
desnormalizados — o servidor faz join com `users` no envio (1 query barata).

## Fluxo de envio — WebSocket (`api/src/realtime/index.ts`)

Novo tipo de mensagem do cliente:

```json
{ "type": "chat_send", "matchId": 123, "body": "vamo trocar o top?" }
```

Pipeline no servidor (`tratarMensagem`, estendido):

1. Socket já assinado naquela sala (`socketRoom` tem a entrada) — senão, erro.
2. `body`: string, `trim()`, 1–200 chars — senão, erro `body_invalido`.
3. **Ban** — `users.status === 'banida'` bloqueia (mesma fonte do
   `conta_banida` de `elegibilidade.ts:127`).
4. **Riot vinculado** — `users.riot_id` not null (mesma regra de
   `elegibilidade.ts:135`), senão erro `riot_id_necessario`.
5. **Rate limit** em memória por `userId`: mínimo 1s entre mensagens + teto de
   40 msg / 5 min. Estourado → erro `rate_limited`. (Serviço realtime é um
   processo único, então estado em memória é consistente.)
6. `INSERT ... RETURNING` + SELECT de `display_name`, `tag` (de
   `game_accounts.handle`? não — `users` não tem tag; ver nota abaixo) e avatar.
7. Fan-out `{ type: "chat_message", matchId, msg }` para o `rooms` map da sala —
   inclui o remetente (ele recebe o próprio eco, caminho único de render).

No fan-out, o servidor envia `{ id, user_id, nome, avatar, body, created_at }`,
onde `nome` = `users.display_name`. A UI exibe o `nome`; a `tag`, se necessário,
vem do cruzamento de `user_id` com a lista de `jogadores` já carregada (a lista
da sala contém `tag`).

Erros de envio voltam como `{ type: "chat_error", error: "<codigo>" }` e o front
mostra toast.

## Histórico — `GET /api/matches/:id/mensagens`

- Query: `?after=<id>` (bigserial) retorna mensagens com `id > after`, ASC, máx.
  200. Sem `after`, retorna as 200 últimas.
- Auth: sessão (cookie httpOnly, mesmo middleware de `matches.ts`). Autorização:
  participante de `match_players` OU staff (`user_roles` admin/moderador/proprietário).
- Purge preguiçoso: junto da leitura, `DELETE FROM sala_mensagens WHERE
  created_at < now() - interval '5 minutes'` (barato; mantém a tabela pequena).
- Registrado em `api/src/routes/matches.ts`, exportado pelo router existente.

## Purge TTL — cron (`api/src/cron.ts`)

No `runCron` (roda a cada 10 min via `index.ts:100`), passo novo:

```sql
DELETE FROM sala_mensagens WHERE created_at < now() - interval '5 minutes';
```

Garante que a tabela nunca acumula mesmo se ninguém ler. O retorno do cron pode
logar o número de mensagens purgadas (opcional).

## Cliente — front (`web/src`)

### `useSalaRealtime` (extensão)

- Nova opção `onChatMessage?: (msg: SalaChatMensagem) => void`.
- No handler `onmessage`: `chat_message` chama `onChatMessage` **imediato** (sem
  debounce/jitter — mensagem é entrega real, não sync de estado).
- Retorna `{ enviarChat }`: `ws.send({ type: "chat_send", matchId, body })`.
  Envia direto pelo socket existente (sem segunda conexão).

### `useSalaSimples` (extensão leve)

- Aceita opções `{ onChatMessage }` e repassa para `useSalaRealtime`.
- Retorna `enviarChat` no objeto.

### Novo `useSalaChat(salaId, { habilitado, onReceber })`

Estado e regras de UI:

- Carrega histórico no mount e no reconnect (via `onReconnect` do WS → refetch).
- **Auto-remove**: cada mensagem agenda `setTimeout(5min)` que remove pelo `id`
  da lista local; timers limpos no unmount. Caso a mensagem já venha expirada do
  histórico (falha de purge), é descartada na hora.
- Contador de não lidas (estado `colapsado`).
- `receber(msg)`: append + marca não lida se não estiver visível no scroll.
- Envio: `enviar(body)` → chama `enviarChat` do socket; `chat_error` vira toast
  (`riot_id_necessario`, `rate_limited`, `body_invalido`, `conta_banida`).
- `habilitado = estado ativo`: `sala.estado ∈ {preenchendo, confirmacao,
  iniciando_partida, partida_iniciada, aguardando_revisao}`. Em `encerrada`/
  `cancelada` o widget não é renderizado.

### Novo `ChatDaSala` (`web/src/components/partidas/ChatDaSala.tsx`)

- Fixo no canto inferior direito, quase encostado na borda (margem ~16px), com
  `z-[120]` — acima do hub central (`z-[70]`) e acima dos overlays laterais
  (`z-[5]`/`z-[45]`), abaixo dos modais fixos de confirmação/erro (`z-50` são
  `position: fixed inset-0` que cobrem a tela inteira e por isso ficam à frente
  independente do z-index da âncora, mas o painel do chat, por ser ancorado, não
  conflita com eles).
- **Fechado**: botão compacto, visual do padrão da sala (glass escuro
  `bg-black/60 backdrop-blur`, accent dourado `#FFB700`, canto cortado
  `CUT_BUTTON`), ícone de mensagem + badge com contagem de não lidas.
- **Aberto**: painel `w-80 h-96`, colapsável; lista de mensagens (nome pequeno +
  texto, auto-scroll; badge "novas mensagens" se rolou pra cima); input (max 200
  chars, Enter envia) + botão enviar. Tamanho responsivo em mobile (largura
  `calc(100vw - 32px)`).
- Não renderizado em sala não ativa (filtro do hook pai).

## Performance

| Operação | Custo |
|---|---|
| Envio (cliente→servidor) | 1 frame WS existente |
| INSERT + join nome | ~0,1–0,3ms |
| Fan-out (≤20 sockets) | microssegundos em memória |
| Recebimento | 1 frame WS existente, sem debounce |
| Histórico (load/reconnect) | 1 GET leve, index seek |
| Purge cron | `DELETE` indexado por `created_at`, tabela sempre ≤ 5min de dados |

**Nenhum impacto no polling-fallback nem no fluxo `match_update` da sala.** O
pico de "thundering herd" já é mitigado pelo jitter do `useSalaRealtime`; o chat
não participa desse caminho.

## Segurança

- Todas as validações no servidor (nunca confiar no cliente): tamanho, trim,
  ban, Riot vinculado, rate limit.
- Autorização de envio = participante/staff (mesma trava do subscribe).
- Sem segredos no bundle: nada novo exposto.
- `body` é texto puro renderizado como texto (nunca `dangerouslySetInnerHTML`).

## Testes / verificação (como "done" vai ser medido)

1. `npx drizzle-kit generate` gera `0018_sala_mensagens.sql`; aplica num Postgres
   limpo (cadeia 0000–0018).
2. `npx tsc --noEmit` em `api/` e `web/` sem erro.
3. `npm test` do status-server passa (nada quebrado).
4. Manual (browser): abrir sala ativa com 2 usuários logados (Riot vinculado) →
   enviar e receber em tempo real; mensagem some da UI após 5 min; banido não
   envia; sem Riot não envia; sala `encerrada` não mostra chat.
5. `verify-swap` não é afetado (sem toque no Supabase).

## Fora de escopo

- Chat privado/DM, anexos, emojis, edição/exclusão de mensagem, histórico
  persistente além de 5 min, mensagens de sistema, moderação de conteúdo
  (filtro de palavras). Rate limit + ban é o controle de spam.
