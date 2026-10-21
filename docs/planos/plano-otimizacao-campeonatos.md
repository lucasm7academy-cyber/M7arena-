# Otimização de `/campeonatos` e do detalhe do campeonato

Status: implementado no branch `opt/campeonatos-lazy` (worktree), validado localmente.
Não deployado.

## Problema medido (dev.m7arena.pro)

| Tela | Antes |
|---|---|
| `GET /api/tournaments` (lista) | 147,7 KB, 60 KB gzip, ~362 ms TTFB, ~21 queries (7 por campeonato) |
| Card de campeonato | baixava `cronograma`, `bracket_data`, `classificacao`, `grupos`, `times_inscritos`, `regulamento` e a foto da organização |
| Detalhe | baixava o documento completo antes do primeiro paint |
| Lobby | baixava o documento completo de todos os campeonatos para montar "próximos jogos" |
| `useTransmissoesAtivas` (poll 30 s) | documento completo só para ler `nome` |
| Hero `/campeonatos` (`.webm`) | 3,38 MB sem `Cache-Control` |

Caso extremo: **COPA DO MILHO** tinha 90,3 KB, sendo **57,9 KB** de
`org_photo_url` (data URL base64) — campo que o detalhe público nem renderiza.

## Arquitetura: índice → documento → seções

Nada de paginação nem de virtualização; o contrato é particionado.

```
GET /api/tournaments?view=card        → card da listagem (campos do card)
GET /api/tournaments?view=agenda      → card + jogos confirmados + times resumidos
GET /api/tournaments/:id/shell        → escalares + times_inscritos
GET /api/tournaments/:id/cronograma   → { cronograma }
GET /api/tournaments/:id/classificacao→ { classificacao }
GET /api/tournaments/:id/grupos       → { grupos }
GET /api/tournaments/:id/chaves       → { bracket_data }
GET /api/tournaments[?sem view]       → documento completo (compatibilidade/admin)
GET /api/tournaments/:id              → documento completo (compatibilidade/admin)
```

Os endpoints antigos continuam intocados em semântica (mesmo shape, mesmos
campos). Tudo é **aditivo**: o `createCampPage` (admin) continua usando
`list()`/`detail()` completos.

`org_photo_url` saiu só do `shell` (o editor do admin continua recebendo no
documento completo). `regulamento` e `banner_url` ficam no shell porque o hero e
o modal de regulamento renderizam os dois.

## Segurança: código de série

`codigo_partida` só existe em `cronograma` e `bracket_data`. As rotas de seção
aplicam a mesma redação do detalhe completo (`redigirCodigosDaSerie` +
`acessoNoCampeonato`, ADR-043): staff/organizador ou quem joga a série vê o
código; os demais recebem `null`. A rota monta o mapa tag→time com
`loadTournamentTags` (só id/tag), sem carregar o cadastro completo.

Cache: `private, max-age=5, must-revalidate` nas seções (resposta varia por
cookie). `card`/`agenda` são públicos (`max-age=30,
stale-while-revalidate=300`); documento completo é `private, no-store`.

## Front

- **`tournamentCache.ts`**: cache em memória do shell (30 s) e das seções (30 s),
  com deduplicação de requisições em voo, `invalidateTournament(id)` em toda
  escrita e `prefetchTournament(id)` no hover/focus do card.
- **`CampeonatoContext`**: abre com shell + classificação (aba inicial Visão
  Geral). Cada aba declara suas seções:

  | Aba | Seções |
  |---|---|
  | Visão Geral | `classificacao` |
  | Grupos | `grupos` + `cronograma` |
  | Cronograma | `cronograma` |
  | Chaves | `chaves` |
  | Histórico | `classificacao` + `cronograma` |

  `tabLoading`/`tabError` mostram spinner/erro **apenas no conteúdo da aba**;
  hero, cabeçalho e abas continuam na tela. "Tentar novamente" refaz só a seção.
- **`CampeonatoDetalhes`**: estado de carregamento/erro por aba.
- **`campeonatos.tsx`**: usa `view=card`; removeu `timesInscritos` do card (nunca
  era renderizado) e faz prefetch no hover.
- **`Lobby`**: usa `view=agenda`.
- **`useTransmissoesAtivas`** e **`Streamers`**: usam `view=card`.
- **`createCampPage`**: o auto-optimizer passou a migrar `orgPhotoUrl` base64
  para `/uploads/public-images/campeonatos/` (o save já fazia via
  `processTournamentImages`; agora a listagem do admin também limpa o legado).

## Regra de ouro da escrita parcial

`saveToSupabase` manda **só** o que o detalhe carregou:

- escalares + `times_inscritos` + `times_ordem_sorteio` sempre (vêm no shell);
- `grupos` só se a seção `grupos` foi baixada;
- `cronograma` só se a seção `cronograma` foi baixada;
- `classificacao` nunca volta (é calculada no servidor, o detalhe só exibe);
- `org_photo_url` nunca volta (não está no shell; reenviar `''` apagaria a foto).

Sem isso, salvar a cor tema na aba Configurações mandaria `cronograma: []` e
`grupos: {}`, apagando dados. `handleSortearGrupos`/`handleSortearChaves`
(handlers legados sem botão na UI) ganharam guarda explícita: sem as seções
carregadas, recusam em vez de regravar vazio.

## Nginx

- `^~ /assets/`: `expires 1y` + `public, immutable` (hash no nome).
- `^~ /images/`: `expires 7d` (hero `.webm`, imagens públicas).
- `^~` evita que a regex de assets capture `/uploads/` e quebre as imagens
  enviadas.

## Resultado medido (payload real de dev, com os contratos novos)

Projeção sobre o JSON de produção (mesmos dados, campos do contrato novo):

| Contrato | Tamanho |
|---|---|
| `GET /api/tournaments` (antes) | **147,7 KB** |
| `view=card` | **2,3 KB** (-98,4%) |
| `view=agenda` | **9,2 KB** |
| Detalhe Kraken: shell + classificação | **6,0 KB** (antes 28,7 KB) |
| Detalhe Milho: shell + classificação | **14,8 KB** (antes 90,3 KB) |
| Seções sob demanda (Kraken) | cronograma 10,8 KB · chaves 10,0 KB · grupos 1,7 KB · classificação 1,9 KB |

O detalhe só paga cronograma/chave quando o usuário abre a aba; a lista nunca
mais paga nenhum deles.

## Evidência de validação

- `api`: `npx tsc --noEmit` → exit 0.
- `api`: `npx tsx --test test/*.test.ts` → **277/277** (8 novos em
  `api/test/tournament-shape.test.ts`: shell sem seções, cada seção com uma
  chave, redação por tag, card sem campos pesados, resumo de times da agenda,
  documento completo intacto).
- Rotas registradas conferidas: shell + `cronograma|classificacao|grupos|chaves`.
- `web`: `npx tsc --noEmit` → exit 0; `npm run build` → ok.
- Sem Docker/Postgres local nesta máquina: o smoke HTTP com dados reais fica
  pendente de subir o compose local (ou de deploy em dev).

## Rollback

Os endpoints novos são aditivos. Reverter o front (voltar a chamar
`list()`/`detail()`) restaura o comportamento antigo sem migration. Nenhuma
migration de banco foi criada.

## Fora de escopo (mantido)

- Vídeo do hero **não** foi trocado (pedido explícito do usuário).
- Paginação/virtualização da lista.
- `React.lazy` das abas.
- Regra de negócio no cliente.
