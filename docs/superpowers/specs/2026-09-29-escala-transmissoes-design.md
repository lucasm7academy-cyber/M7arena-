# Escala de Transmissões (agenda de streamers) — Design

**Data:** 2026-09-29 · **ADR:** (a registrar) · **Status:** aguardando revisão

## Contexto

Hoje o streamer agenda por WhatsApp: o admin manda a lista de próximos jogos no
grupo, cada streamer responde o que vai transmitir, e na hora ele entra em
`/streamers`, escolhe campeonato + times na mão e define uma duração estimada
(1–6 h). O card da live fica no ar até o tempo expirar — ninguém sabe quando o
jogo realmente acabou.

O objetivo é inverter isso: os jogos confirmados viram uma **agenda dentro da
plataforma**, o streamer marca os que vai transmitir, entra no ar com um clique
(e recebe o código da partida), e a plataforma **desliga a live sozinha quando
a série termina**. O público vê quem vai transmitir no próprio card do próximo
confronto.

## Decisões do usuário (aprovadas em 2026-09-29)

| Decisão | Escolha |
|---|---|
| Vagas por jogo | **1 streamer por jogo** (primeiro que marca leva) |
| Ignição da live | Streamer aperta **"Estou no ar"** e já vê o código da partida |
| Ignição/desligamento | Ligação manual (clique); **desligamento automático** quando a plataforma identifica o fim do jogo |
| Onde aparece | Seção na página `/streamers` + **streamer escalado no card do Lobby** |
| Escopo de jogos | Só jogos de campeonato **confirmados com data/hora** (e `em_andamento`) |

## Decisões de arquitetura

### 1. Vínculo live ↔ jogo por `transmissoes.match_id`

A live ganha um vínculo opcional com o jogo (`tournament_matches.id`). O fluxo
livre atual (padrão/amistoso/campeonato manual, com `expira_em`) continua
funcionando sem match — nada muda para ele. A live de jogo **não tem
`expira_em`**: o fim dela é o fim do jogo.

### 2. Desligamento em duas camadas (escrita + leitura)

A plataforma identifica o fim do jogo em vários caminhos: motor de série pela
Riot (cron de 10 min + verificação manual), W.O./resultado manual do ADM
(`storeCronograma`), remoção do jogo (replace do cronograma), exclusão do
campeonato. Confiar em um único ponto de escrita é frágil — o incidente dos
`app.swap.*` mostrou o custo de presumir que "o caminho principal cobre".

- **Escrita**: helper `encerrarTransmissoesDoJogo(d, matchId)` (= `ativo=false`)
  chamado nos pontos conhecidos de finalização (`serie-campeonato.ts` e
  `storeCronograma`). Exclusão do jogo/campeonato cai por **FK CASCADE**.
- **Leitura (fonte da verdade)**: a vitrine `/api/streams` e `/api/streams/minha`
  fazem join com o jogo e só consideram a live viva enquanto o jogo **não** está
  `finalizado/finalizada/finished`. Se algum caminho de escrita escapar, o card
  some do site do mesmo jeito. `/minha` ainda faz lazy cleanup (`ativo=false`)
  quando encontra uma live expirada ou de jogo finalizado.

Custo: 1 join barato por leitura (indexado pela PK de `tournament_matches`).

### 3. Janela do "Estou no ar": 30 min antes ou jogo em andamento

O servidor só aceita `no-ar` quando `agora >= horário agendado − 30 min` **ou**
o jogo já está `em_andamento`. Antes disso o botão fica bloqueado com o motivo
visível. O horário agendado (`display_date` + `display_time`) é interpretado
como **America/Sao_Paulo (UTC−3 fixo** — o Brasil não tem mais horário de
verão), porque os campos são date-only + hora local.

### 4. Título e vínculo montados no servidor

No `no-ar`, o servidor monta `titulo = "<campeonato>\n<TAG_A> x <TAG_B>"`,
`campeonato_id`, `time1_id`, `time2_id` e `modo='campeonato'` a partir do jogo.
Isso também corrige o bug atual do painel, que envia `campeonatoId: null`
sempre (o card de campeonato no Lobby cai no fallback "Campeonato").

## Modelo de dados — migration `0024_*` (gerada por `drizzle-kit`)

```sql
-- transmissoes ganha o vínculo com o jogo (nullable: fluxo livre não usa)
ALTER TABLE transmissoes ADD COLUMN match_id uuid
  REFERENCES tournament_matches(id) ON DELETE CASCADE;

CREATE TABLE escalas_transmissao (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid NOT NULL UNIQUE REFERENCES tournament_matches(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX escalas_transmissao_user_idx ON escalas_transmissao (user_id);
```

- `match_id UNIQUE` em `escalas_transmissao` é a garantia de **1 streamer por
  jogo** (o servidor checa antes para devolver erro amigável; o banco é a trava).
- Registrado em `db/schema/conteudo.ts` (`transmissoes.matchId` +
  `escalasTransmissao`), exportado pelo barrel.
- **Atenção no generate**: o snapshot `0023_snapshot.json` não existe em
  `db/migrations/meta/` — se o diff re-emitir DDL da 0023, o SQL da 0024 é
  editado à mão para conter só o que esta feature adiciona (mesmo tratamento da
  ADR-021).

## API — `api/src/routes/streams.ts`

### `GET /api/streams/agenda` (público)

Lista jogos de campeonato com transmissão agendável: `confirmado` com
`display_date` ISO (`YYYY-MM-DD`) + `display_time` (`HH:MM`) válidos e horário
≥ agora − 2 h, **ou** `em_andamento` (nunca `finalizado`). Ordena por data/hora
asc, máx. 50. O enriquecimento (streamer, "meu", código) usa a sessão quando há.

```json
[{
  "match_id": "uuid",
  "tournament_id": "uuid",
  "campeonato": { "id": "uuid", "titulo": "Copa do Kraken", "cor": "#FFB700" },
  "fase": "Fase de Grupos",
  "time_a": { "id": "uuid", "tag": "M7W", "nome": "M7 Wolves", "logo": "https://...", "cor": "#..." },
  "time_b": { "id": "uuid", "tag": "BKA", "nome": "Black Owls", "logo": null, "cor": null },
  "data": "2026-09-30", "hora": "20:00", "data_label": "HOJE",
  "status": "confirmado",
  "ao_vivo": false,
  "streamer": { "user_id": "uuid", "nome": "Fulano", "twitch": "canal" },
  "meu": false,
  "codigo_partida": null,
  "transmissao_id": null,
  "pode_assumir": true
}]
```

- `data_label` (`HOJE` / `AMANHÃ` / `30 SET`) calculado no servidor com
  `Intl.DateTimeFormat` em `America/Sao_Paulo` — evita duplicar regra de fuso.
- `codigo_partida` só vem preenchido para o **próprio streamer escalado** (ou
  staff admin/proprietário/moderador/organizer); `null` para os demais.
- `transmissao_id` só quando é a live ativa do próprio usuário naquele jogo.
- `pode_assumir` = vaga livre E sessão tem cargo `streamer` + Twitch no perfil.

### `POST /api/streams/agenda/:matchId` — pegar a vaga

Valida cargo `streamer` + Twitch no perfil; jogo existe, é do escopo da agenda
e não está finalizado. Insere em `escalas_transmissao`. Erros: `409
vaga_ocupada`, `400 jogo_nao_confirmado`, `404 jogo_nao_encontrado`, `403
sem_cargo_streamer`, `400 sem_twitch_no_perfil`. Resposta: `{ "ok": true }`.

### `DELETE /api/streams/agenda/:matchId` — soltar a vaga

Só o dono. Se a live do jogo dele está ativa → `409 live_no_ar` (encerra
primeiro). Resposta: `{ "ok": true }`.

### `POST /api/streams/agenda/:matchId/no-ar` — entrar no ar

Valida dono da escala, cargo + Twitch, jogo não finalizado e janela (30 min
antes / em andamento). **Idempotente**: se já existe live ativa do usuário
naquele jogo, devolve ela. Antes de criar, encerra outras transmissões ativas
do mesmo usuário (uma live por vez). Cria com `match_id`, `expira_em = null`,
título/campeonato/times do jogo. Resposta:

```json
{ "transmissao": { "id": "uuid", "...shape legado..." }, "codigo_partida": "BR04fa2-xxxx" }
```

Erros: `403 nao_e_o_streamer`, `409 jogo_finalizado`, `409 fora_da_janela`
(código com motivo), `400 sem_twitch_no_perfil`.

### Vitrine e painel (queries com join)

- `GET /api/streams` — live de jogo aparece enquanto `ativo = true` E o jogo não
  está finalizado; live livre mantém a regra `expira_em > now`. O shape legado
  ganha `match_id` (e `campeonato_id`, `time1_id/time2_id` já existem).
- `GET /api/streams/minha` — mesma regra + lazy cleanup: transmissão expirada
  (livre) ou de jogo finalizado é desativada no banco e devolvida como `null`.
  Corrige de passagem o bug atual do painel, que não checava `expira_em`.

## Fim automático — pontos de chamada

1. `api/src/lib/serie-campeonato.ts` → `verificarSerieMatch`, no bloco
   `r.estado === "finalizada"` (fim detectado pela Riot; cobre cron de 10 min e
   verificação manual). `verificarSerieBracket` fica fora: a agenda só escala
   `tournament_matches`.
2. `api/src/lib/tournament-store.ts` → `storeCronograma`, quando um jogo com
   `match_key` existente vira `finalizado/finalizada` (W.O. e resultado manual
   do ADM). O select de `existingMatches` ganha `id` para o helper.
3. Exclusão do jogo (replace sem merge) e exclusão do campeonato → **CASCADE**
   na FK apaga transmissão e escala.
4. Leitura (vitrine/minha) → proteção final descrita na decisão 2.

## Front (`web/src`)

### Novo: `features/streams/`

- `types.ts` — tipos da agenda (`AgendaJogo`, `AgendaStreamer` etc.).
- `components/AgendaTransmissoes.tsx` (< 400 linhas) — seção "AGENDA DE
  TRANSMISSÕES" renderizada em `/streamers` **entre o painel de live e o
  empty state/grid**. Cards no padrão visual da página (glass escuro, borda
  `white/5`, tipografia black uppercase):
  - Data (HOJE/AMANHÃ/label), hora, campeonato + fase, `#TAG_A x #TAG_B` com
    logos/cores, status do slot.
  - Estados do card: **LIVRE** (botão QUERO TRANSMITIR), **SEU** (SOLTAR +
    ESTOU NO AR com tooltip quando fora da janela), **OUTRO** (nome do
    streamer), **AO VIVO** (badge vermelho + código da partida com botão
    copiar + ENCERRAR + link para a Twitch), **aguardando código** (jogo em
    andamento sem código gerado).
  - Polling de 60 s; quando o próprio "estado no ar" muda (entrou/saiu), chama
    `onChange()` para o pai refazer `minha()` + `fetchStreams()`.
- `web/src/lib/api.ts` — `api.streams.agenda()`, `.pegar(matchId)`,
  `.soltar(matchId)`, `.entrarNoAr(matchId)`.

### `pages/Streamers.tsx`

- Renderiza `<AgendaTransmissoes onChange={...} />` (arquivo herdado passa de
  400 linhas — a seção vai inteira em componente próprio, sem ampliar o
  existente além da integração).
- Painel "AO VIVO": quando `userStream.match_id` está presente, troca
  "Duração: X HORAS" por "ATÉ O FIM DA SÉRIE" e mostra o código da partida (se
  disponível).
- `fetchStreams` interno passa a aceitar live de jogo com `expira_em = null`
  (mesmo filtro do hook).

### `hooks/useTransmissoesAtivas.ts`

Filtro corrigido: transmissão com `match_id` é válida enquanto o servidor a
devolve (não re-filtrar por `expira_em`); transmissão sem `match_id` mantém
`expira_em > now`. O resto (dedupe, thumbs, times, campeonato) igual.

### `pages/Lobby.tsx` (card do próximo confronto)

- `UpcomingMatch` ganha `matchId` (o cronograma já expõe `match_id`).
- O fetch de próximos jogos (cache 5 min existente) busca também
  `api.streams.agenda()` e guarda o mapa `matchId → streamer`.
- No "Date & Time Hub" do card, chip discreto do streamer escalado (ícone
  Twitch + nome) quando houver. Nada mais do card muda.

## Permissões e regras (tudo no servidor)

- Agendar/entrar no ar: cargo `streamer` + Twitch no perfil (mesmas regras do
  fluxo atual, `streams.ts`).
- 1 vaga por jogo (unique + checagem).
- Código da partida na agenda: só o streamer escalado do jogo e staff.
- Soltar vaga bloqueado com live no ar.
- Nenhuma regra de negócio no cliente (janela, vaga, desligamento, título).

## Testes / verificação (como "done" vai ser medido)

1. `npm run db:generate` → migration `0024_*`; a suíte de testes aplica a
   cadeia completa num PGlite em memória (`api/test/helpers.ts`).
2. `npx tsx --test api/test/streams-agenda.test.ts` — novo teste cobrindo:
   pegar vaga; `409 vaga_ocupada`; `no-ar` fora da janela → erro; `no-ar` na
   janela → cria transmissão vinculada com título do jogo; vitrine inclui a
   live de jogo; finalizar a série (`verificarSerieMatch` mockada ou
   `storeCronograma`) → transmissão vira `ativo=false` e vitrine some; soltar
   vaga; soltar com live no ar → `409`.
3. `npx tsx --test "api/test/*.test.ts"` — suíte completa passa (inclui o motor
   de série existente, que ganhou a chamada nova).
4. `npx tsc --noEmit -p api/tsconfig.json` e `npm run lint --prefix web` +
   `npm run build --prefix web` sem erro.
5. Manual local (browser): jogo confirmado aparece na agenda; pegar; `Estou no
   ar` antes da janela bloqueado e depois liberado; código aparece; encerrar
   jogo pela verificação → card some da vitrine e painel volta a "iniciar
   transmissão"; card do Lobby mostra o streamer escalado.

## Fora de escopo (YAGNI)

- Notificação in-app / WhatsApp / Discord quando surgem jogos ou quando a live
  cai (o admin segue chamando no grupo; notificação é evolução futura).
- API da Twitch (viewer count, thumbs reais, confirmação de offline).
- Múltiplos POVs por jogo (decisão: 1 vaga).
- Escala para jogos de chaveamento (`bracket_matches`) e salas avulsas.
- Aba de agenda na página do campeonato.
