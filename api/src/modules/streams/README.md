# Módulo de Transmissões — backend (Streams)

Memória técnica do backend de transmissões de streamers (Twitch) e agenda de
jogos de campeonato.

## Responsabilidade

Gerencia lives de streamers parceiros e a agenda de transmissão de jogos de
campeonato: vitrine pública, painel do streamer, pegar/soltar vaga e o
encerramento automático das lives vinculadas a jogo/série/scrim.

## Arquivos

- `routes.ts` — endpoints HTTP (mount `/api/streams`), sessão/cargo e erro → HTTP.
  Agenda e consultas delegam a `streams.ts`; criação avulsa e encerramento
  `/:id/parar` ainda persistem diretamente pelo router.
- `streams.ts` — regras (vitrine, agenda, pegar/soltar, entrar no ar, helpers de
  data/título). Testável com PGlite (`api/test/streams.test.ts`).
- `transmissoes.ts` — encerramento automático das lives de jogo.

## Endpoints (routes.ts)

| Método | Rota | Papel |
|---|---|---|
| GET | `/api/streams` | vitrine pública |
| GET | `/api/streams/agenda` | jogos agendáveis (enriquecido se logado) |
| GET | `/api/streams/minha` | live ativa do usuário |
| POST | `/api/streams/agenda/:matchId` | pega a vaga |
| DELETE | `/api/streams/agenda/:matchId` | solta a vaga |
| POST | `/api/streams/agenda/:matchId/no-ar` | entra no ar |
| POST | `/api/streams` | inicia transmissão livre |
| POST | `/api/streams/:id/parar` | encerra a live |

## Funções exportadas

- `streams.ts`: `listarVitrine`, `listarAgenda`, `minhaTransmissao`, `pegarVaga`,
  `soltarVaga`, `entrarNoAr`, `validarStreamer`, `toLegacyTransmissao`,
  `instanteJogo`, `dataLabelSP`, `montarTituloJogo`, `jogoNaAgenda`,
  `dentroDaJanela`, `diaSP`; constantes `TZ_TRANSMISSAO`, `JANELA_ANTES_MS`.
- `transmissoes.ts`: `encerrarTransmissoesDoJogo`, `STATUS_JOGO_FINALIZADO`.

## Tabelas

- `transmissoes`, `escalas_transmissao` (fonte `db/schema/conteudo.ts`; imports
  TypeScript usam o sufixo de runtime `.js`).
- `users`, `user_roles` (`identidade`); `teams`; `matches`;
  `tournaments`, `tournament_matches`.

## Dependências

- `api/src/lib/match-flow.ts` (`getAuthUser`).
- `sala-campeonato.ts` importa `instanteJogo`, `validarStreamer`, `montarTituloJogo`.
- `serie-campeonato.ts` e `tournament-store.ts` importam `encerrarTransmissoesDoJogo`
  (finalização de série / W.O. no storeCronograma).
- Montado em `api/src/index.ts` sob `/api/streams`.

## Regras a preservar

- Live de campeonato (`match_id`) e de scrim (`sala_id`) **não usam `expira_em`**:
  o fim é o fim da série/sala. Live avulsa expira por tempo.
- Uma live por usuário: entrar no ar encerra as anteriores.
- Janela "Estou no ar": em andamento ou 30 min antes do horário (`JANELA_ANTES_MS`).
- `STATUS_JOGO_FINALIZADO = ["finalizado", "finalizada", "finished"]`.
- Vaga: 1 streamer por jogo (idempotente para o dono).

## Verificação

[streams.test.ts](../../../test/streams.test.ts) cobre serviços de agenda,
encerramento e leitura com PGlite. Não homologa todos os handlers HTTP nem o
painel frontend. Use o [ambiente e comando isolados](../../../../README.md#testes-da-api)
com `test/streams.test.ts`; não criar/encerrar lives reais para validar uma mudança.
