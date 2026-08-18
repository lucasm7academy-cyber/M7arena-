# Design — Reconciliação automática do handle Riot (cron 3 dias)

Data: 2026-08-17
Autor: deepseek
Status: aprovado pelo usuário em brainstorm

## Problema

O jogador vincula a conta Riot e o site grava um **retrato** do Riot ID
(`game_accounts.handle`, "Game#TAG") e do PUUID (`game_accounts.externalId`)
naquele momento (`POST /api/profiles/me/riot`, api/src/routes/profiles.ts:257).

Quando o jogador renomeia no LoL, o PUUID continua o mesmo (identidade imutável),
então a validação de partida (que cruza PUUID) continua passando — mas **o nome
exibido no site fica velho**: salas, perfil, admin e players.tsx leem
`game_accounts.handle` (api/src/routes/matches.ts:53, api/src/lib/match-shape.ts:45).
Resultado: quem vai jogar vê um nome na sala e outro no jogo. Confusão.

## Objetivo

Manter `game_accounts.handle` (e o espelho `users.riot_id`) **sincronizado com o
nome atual do LoL**, de forma automática e leve, sem mudar nada no front.

## Abordagem escolhida

Reconciliação **server-side em lote**, disparada por **cron periódico de 3 em 3
dias**, varrendo **todas** as contas LoL vinculadas. Sem front, sem lazy na
renderização de sala (evita N chamadas à Riot por request).

Fonte da verdade: endpoint da Riot
`GET /riot/account/v1/accounts/by-puuid/{puuid}`, que devolve o Riot ID atual
(`gameName` + `tagLine`) a partir do PUUID.

## Componentes

### 1. Módulo novo `api/src/lib/reconciliar-handles.ts` (~150 linhas)

Contrato espelhado em `runCron` (api/src/cron.ts):

```ts
export async function runReconciliacaoHandles(d: any = db): Promise<{
  total: number;
  atualizadas: number;
  erros: number;
}>
```

Lógica:

1. **Selecionar** todas as `game_accounts` com `game_id = 'lol'` e
   `external_id` não nulo (todas as vinculadas, sem filtro de stale — decisão
   do usuário).
2. Para cada conta, **buscar** o nome atual via `riotRaw` (api/src/routes/riot.ts:69,
   já exportado, com cache em memória de 10min):
   `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid/{puuid}`.
3. **Comparar**: se `gameName + '#' + tagLine` ≠ `handle` atual, gravar
   `UPDATE game_accounts SET handle = ?, syncedAt = ?, updatedAt = ?` **e**
   `UPDATE users SET riot_id = ?` (espelho, regra do vínculo — ADR-023).
4. **Falha da Riot** (403/429/404/5xx → `riotRaw` devolve `null`): **pula a
   conta sem sobrescrever** e conta em `erros` com `console.warn` (nunca engole).
5. **Concorrência limitada**: 3 em paralelo, mesmo padrão de `refresh-elos`
   (api/src/routes/players.ts:241, constantes `REFRESH_CONCURRENCY`). Cache de
   memória por PUUID já coberto pelo `riotRaw`.

Invariante 3.6 (<400 linhas) respeitado: módulo dedicado, pequeno e testável.

### 2. Disparo em `api/src/index.ts`

```ts
setInterval(() => {
  runReconciliacaoHandles().catch((e) => console.error("[cron-handles] erro:", e?.message));
}, 3 * 24 * 60 * 60 * 1000);
runReconciliacaoHandles().catch((e) => console.error("[cron-handles] erro inicial:", e?.message));
```

Timer **separado** do `runCron` de 10min (api/src/index.ts:100) — o intervalo de
3 dias não cabe no timer curto. 1 execução no boot para já resolver os cases
existentes (ex.: CGM GUERRA) assim que houver chave Riot válida.

### 3. Front — zero mudanças

A sala monta `nome`/`tag` a partir de `game_accounts.handle` em tempo de
requisição. Após o cron atualizar, o nome novo aparece automaticamente em salas,
perfil, admin e players.tsx.

## Fluxo de dados

```
cron (3d) → runReconciliacaoHandles
  → SELECT game_accounts (lol, external_id != null)
  → por lote de 3:
      → riotRaw(by-puuid) → { gameName, tagLine }
      → handle novo = "Game#TAG"
      → mudou? → UPDATE game_accounts.handle + users.riot_id
      → falhou? → pula, loga warn
  → retorna { total, atualizadas, erros }
```

## Tratamento de erro

- `riotRaw` já loga e retorna `null` em erro (nunca engole silencioso).
- `null` ⇒ **não sobrescreve** — handle velho preservado; conta contada em `erros`.
- Sem chave (`RIOT_API_KEY` ausente): `riotRaw` loga warn e devolve `null` ⇒
  nenhuma escrita; o cron fica inerte até existir chave válida (BLK-006).

## Testes

Novo `api/test/reconciliar-handles.test.ts`, no padrão dos existentes
(PGlite via `setupDb` de api/test/helpers.js + `riotRaw` mockado):

1. Nome mudou → `handle` e `users.riot_id` atualizados; `atualizadas == 1`.
2. Nome igual → nenhuma escrita; `atualizadas == 0`.
3. Riot falha (mock retorna `null`) → handle preservado; `erros == 1`.
4. Conta sem `external_id` → ignorada (não entra no lote).

## Verificação (evidência de done)

- `npm test` → suíte completa passa, incluindo o novo arquivo.
- Rodada manual com chave Riot ativa na VPS: `runReconciliacaoHandles` executa
  e confirma o CGM GUERRA com o nome novo no banco e nas salas.

## Pendências / dependências

- **BLK-006**: sem chave Riot permanente, o cron só sincroniza enquanto houver
  chave de dev válida (expira ~24h). Produção requer personal key.