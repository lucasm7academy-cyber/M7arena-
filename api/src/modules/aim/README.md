# Mira — ranking do treino de mira

## Fronteira HTTP

O [bootstrap](../../index.ts) monta o router em `/api/aim`. A autenticação do
`POST` usa o helper compartilhado [getAuthUser](../../lib/content.ts) (cookie
`m7_session` ou Bearer), o mesmo das demais rotas.

| Arquivo / prefixo | Método e caminho relativo | Contrato |
|---|---|---|
| [routes.ts](routes.ts), `/api/aim` | `GET /leaderboard` | Público. `mode=all\|flick\|track\|precision` (default `all`; outro valor = 400 `modo_invalido`) e `limit` 1..100 (default 25, ausente/fora da faixa usa o padrão/teto). |
| [routes.ts](routes.ts) | `POST /scores` | Autenticado. `{ mode, score, accuracy, apm, combo, durationMs }`; devolve `{ ok, row, position }`. Payload inválido = 400 `dados_invalidos`. |

## Regras e invariantes

- A partida roda no cliente (`web/src/features/aim/domain/engine.ts`), mas a nota
  é **do servidor**: [service.ts](service.ts) recalcula `grade` com a mesma curva
  (SS se acc>=97 e score>=9000; S>=93; A>=86; B>=76; C>=62; senão D) e descarta
  qualquer `grade` enviada pelo cliente.
- Limites validados: `mode` na lista; `score` 0..200000; `accuracy` 0..100;
  `apm` 0..600; `combo` 0..10000; `durationMs` 10000..180000. Campos inteiros
  exigem inteiro; `accuracy` aceita decimal e é arredondada para o percentual
  inteiro persistido (`accuracy_pct`). A nota é calculada sobre esse percentual
  arredondado, para grade e número exibido não divergirem.
- Ranking = **um registro por jogador** (o melhor score dele no escopo),
  ordenado por `score` desc e `created_at` asc (`DISTINCT ON (user_id)` em
  subconsulta). `name` usa `users.display_name` com fallback para a parte local
  do e-mail; `accuracy` sai com uma casa numérica (o percentual é inteiro, então
  o JSON mostra `97`); `at` é ISO.
- `position` do `POST` é 1-based no ranking do modo enviado, considerando o
  melhor score do jogador após a inserção — não necessariamente a linha recém
  gravada.

## Consumidores, dependências e limites

Consumido pelo SDK `api.aim` em [web/src/lib/api.ts](../../../../web/src/lib/api.ts)
e pela página/estado do treino em `web/src/features/aim`. Persiste em
`db/schema/aim.ts` (`aim_scores`); não grava economia nem notificação.

Limitação: como o score nasce no cliente, o servidor valida faixa e recalcula a
nota, mas não reexecuta a partida. O ranking é de treino/vaidade — não distribui
EA, MC, prêmio ou classificação de torneio. Verificação:
[aim-ranking.test.ts](../../../test/aim-ranking.test.ts) em
[ambiente isolado](../../../../README.md#testes-da-api); não homologa
anti-cheat nem navegador.
