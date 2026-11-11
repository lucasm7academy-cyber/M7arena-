# Módulo de Transmissões (Streams)

Memória técnica do módulo de transmissões: lives de streamers parceiros (Twitch)
e agenda de jogos de campeonato.

## Responsabilidade

Exibir as transmissões ao vivo na vitrine e permitir que um streamer (cargo
`streamer` + Twitch no perfil) abra/encerre lives — avulsas, amistosas ou de
campeonato — e pegue jogos agendados na "Agenda de Jogos" para transmitir.

## Estrutura

- **Página:** `pages/Streamers.tsx` — rota `/streamers` (import em `web/src/App.tsx`).
- **Componente:** `components/AgendaTransmissoes.tsx` — agenda (pegar/soltar vaga, "Estou no ar", encerrar).
- **Hook:** `hooks/useTransmissoesAtivas.ts` — lives ativas para a vitrine.
- **Tipos:** `types.ts` — shape `AgendaJogo` (snake_case da API).

## Consumidores externos

- [Lobby](../home/pages/Lobby.tsx) importa `hooks/useTransmissoesAtivas` para a vitrine de
  lives. A página Streamers usa busca própria inline, não o hook.

## Backend

- Rotas: `api/src/modules/streams/routes.ts` (mount `/api/streams`).
- Regras: `api/src/modules/streams/streams.ts` (vitrine, agenda, pegar/soltar, entrar no ar).
- Fim automático: `api/src/modules/streams/transmissoes.ts` (`encerrarTransmissoesDoJogo`).
- Contratos e testes: [README backend](../../../../api/src/modules/streams/README.md).

## Dependências (confirmadas no código)

- Front consome `api.streams.*`, `api.teams.*`, `api.tournaments.listCards` e
  `api.content.highlights` via `web/src/lib/api.ts`.
- Usa `AuthContext`, `PerfilContext` (`cargo`, `twitch`), `useSound` e `Toast`.

## Fluxo básico

1. A página busca `api.streams.ativas()`, deduplica por usuário e enriquece com
   o time do streamer.
2. Streamer logado vê o painel "Iniciar Transmissão Avulsa" e a Agenda.
3. Lives de campeonato (`match_id`) e de scrim (`sala_id`) **não usam
   `expira_em`**: terminam com a série/sala; lives avulsas expiram por tempo.

## Cuidados

- `Streamers.tsx` é herdado — não alterar aparência, URLs ou comportamento sem pedido.
- Não adicionar expiração por tempo às lives de campeonato/scrim (regra do servidor).
