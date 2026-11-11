# Home

Página e componentes exclusivos da Home. [Lobby](pages/Lobby.tsx), com export
default `Home`, compõe hero, lives/highlights, partidas futuras, ranking, jornada,
depoimentos, comunidade e FAQ. O [App](../../App.tsx) carrega a página por import
lazy na rota `/lobby`; layout e condições de montagem permanecem no App.

- [UpcomingMatches](components/UpcomingMatches.tsx): carrossel e `MatchPoster`,
  com pausa por mouse/foco, navegação e intervalo de oito segundos.
- [useUpcomingMatches](hooks/useUpcomingMatches.ts): consulta agenda de campeonatos,
  times e transmissões pelo [cliente HTTP compartilhado](../../lib/api.ts),
  resolve os dados dos confrontos e mantém cache em memória por cinco minutos.
- [TopTeamsStickers](components/TopTeamsStickers.tsx): três equipes por PDL,
  emblemas do ranking e navegação para `/times`.
- [HalloweenScenery](components/HalloweenScenery.tsx): SVGs de cenário,
  morcegos e abóboras usados pelos cartazes.
- [upcoming-matches.css](components/upcoming-matches.css): estilos, animações e
  media queries do carrossel; importado por `UpcomingMatches`.

O [CutCard](../../components/ui/CutCard.tsx) permanece compartilhado. As molduras
de ranking estão em `web/public/ranks/molduras/` e são referenciadas por URLs
absolutas; logos dos times vêm dos dados da API. O cenário de Halloween é SVG
inline. As fontes e estilos globais continuam em `web/src/index.css`.

Lobby utiliza o [hook de transmissões de Streams](../streams/hooks/useTransmissoesAtivas.ts)
e `api.content.highlights()` do cliente HTTP compartilhado. O cache de highlights
em memória dura cinco minutos; FAQ e referência de scroll continuam na página.
Times e Campeonatos são acessados pelos componentes e links existentes, sem
mover SDKs ou regras desses módulos. Os assets do hero e da jornada ficam em
`web/public/images/`, `lanes_brancas/` e `ranks/`; URLs públicas permanecem absolutas.

Preserve o DOM, as classes, a ordem de importação do CSS, os recortes, os SVGs,
o cache e os efeitos ao editar. Não substitua artes nem redesenhe o tema.
Os breakpoints, a pausa do carrossel e as animações precisam de homologação
em navegador desktop/mobile; SSR, lint e build não comprovam esses aspectos.

Validação existente, a partir de `web/`: `npm run lint` e `npm run build`.
Não há suíte específica de Home no repositório nesta consolidação.
