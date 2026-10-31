# Cantos recortados COM borda — regra do projeto

> **Regra em uma linha:** `clip-path` recorta a própria `border`. Se o elemento
> tem canto recortado **e** borda, a borda tem que ser uma **moldura** (uma
> camada de fundo atrás do fill), nunca `border` no elemento recortado.

Verificado por script: `npm run lint:cut` (em `web/`) **falha** se alguém
escrever `border` + `clipPath` no mesmo nó. Ele roda junto com `npm run lint`.

## O bug clássico (NUNCA faça)

`clipPath` corta o **próprio elemento** — e isso inclui a `border`. Resultado
real: a borda some justamente na diagonal, "estilhaçada".

```tsx
// ❌ ERRADO — a borda morre no corte
<div className="border border-white/20" style={{ clipPath: CUT_BADGE }}>...</div>

// ❌ ERRADO — mesma coisa em botão
<button className="border border-white/15 bg-white/5" style={{ clipPath: CUT_BUTTON }}>Last</button>

// ❌ ERRADO — box-shadow também é recortado; o glow some com a borda
<div style={{ clipPath: CUT_BUTTON, border: '2px solid #FFB700', boxShadow: '...' }} />
```

## O jeito certo — moldura (frame)

Duas camadas: a de fora pinta a cor da borda e é recortada no canto externo; a
de dentro pinta o fundo e é recortada num canto **um pouco menor**, deixando
1px de borda em todas as arestas — inclusive nas diagonais.

```tsx
// moldura de 1px
<div className="p-[1px] bg-white/10" style={{ clipPath: CUT_BADGE }}>
  <div className="bg-[#161616] px-2.5 py-1" style={{ clipPath: CUT_BADGE_INNER }}>
    PDL 120
  </div>
</div>

// botão: o <button> vira a moldura, então o clique continua no elemento todo
<button className="p-[1px] bg-white/20 hover:bg-[#FFB700]/50" style={{ clipPath: CUT_BUTTON }}>
  <span className="w-full h-full bg-black flex items-center justify-center" style={{ clipPath: CUT_BUTTON_INNER }}>
    <ChevronLeft className="w-5 h-5" />
  </span>
</button>
```

Regras de uso:

- **A moldura precisa de fundo opaco no fill** — se o fill for translúcido, a
  cor da moldura atravessa o card e ele fica mais claro que o planejado. Use o
  tom sólido equivalente (`bg-white/5` sobre `#0A0A0A` ≈ `bg-[#161616]`).
- **`contents`/altura:** com `p-[1px]` o total continua igual (border-box); se
  o card tinha `h-10`, o fill vira `h-full` ou `h-[38px]`.
- **Para card inteiro**, o componente pronto é `CutCard`
  (`web/src/components/ui/CutCard.tsx`).
- **Borda mais grossa (2px)**: o canto interno precisa encolher mais que as
  retas, porque na diagonal o corte "anda" `√2 × espessura`. Use o helper:

  ```tsx
  import { cutPolygon } from '../components/ui/CutCard';

  <div className="p-[2px]" style={{ clipPath: CUT_BUTTON, background: cor }}>
    <div style={{ clipPath: cutPolygon(9, 2) }}>...</div>  {/* 9 - 0.586*2 = 7.83 */}
  </div>
  ```
- **Glow/brilho**: `box-shadow` é recortado. Use `filter: drop-shadow(...)`
  num wrapper **sem clip** (o drop-shadow segue o recorte).
- Alternativa manual antiga (mesma coisa, escrita à mão): `p-[1px]` com
  `background: corBorda` + fill com `clipPath` menor. É válida — só não invente
  `border` dentro do recorte.

## Onde isso já mordeu (histórico)

| Lugar | Status |
|---|---|
| Botão `Last` / `Last Pick` (sala campeonato) | ✅ corrigido com CutCard |
| Card da vaga no pós-draft (sala campeonato) | ✅ corrigido (CutCard + drop-shadow) |
| Pills **MD1/MD3/MD5** do modal TIME vs TIME (/jogar) | ✅ corrigido com CutCard |
| **Logo do time em "Minha Equipe" (/perfil)** — borda 2px + glow | ✅ moldura `p-[2px]` + `cutPolygon(9,2)` + drop-shadow |
| **Tag do time (#TAG) em "Minha Equipe"** | ✅ moldura |
| **Setas de navegar** "Salas Disponíveis" e "Partidas Finalizadas" (/jogar) | ✅ moldura 1px |
| Pills/ícones do /perfil (PDL/Partidas, barra de winrate, avatar de campeão, badge de rank, sync Riot, selo Verificado) | ✅ moldura |
| Ícones e avatar do Histórico de Apostas (/perfil) | ✅ moldura |
| Card de modo do /jogar, botão ENTRAR, header "Partidas Finalizadas", empty state | ✅ moldura |
| Top bar das salas (5v5/ARAM/1v1, Time vs Time/Scrim, Sala Campeonato) | ✅ moldura |
| Toast de /equipes, ícones do VipModal, checkout PIX (DepositTab), citação do /recrutamento | ✅ moldura |

## Checklist rápido ao criar um elemento recortado

1. Tem `clipPath`? Então **não** use `border`, `box-shadow` nem `shadow-*`.
2. Precisa de borda? → moldura `p-[Npx]` + fill clipado (ou `CutCard`).
3. Fundo do fill **opaco**; seleção = cor da moldura + fill.
4. Borda > 1px? → `cutPolygon(canto, espessura)` no canto interno.
5. Brilho externo → `drop-shadow` num wrapper sem clip.
6. Rode `npm run lint:cut` (ou `npm run lint`) antes de fechar a tarefa.
