# Cantos recortados COM borda — regra do projeto

> **Regra em uma linha:** todo card/botão com canto recortado que precise de
> borda usa o componente **`CutCard`** (`web/src/components/ui/CutCard.tsx`).
> **Nunca** coloque `border` num elemento com `clipPath` — a borda é cortada
> junto com o canto e a falha aparece nas diagonais.

## O bug clássico (NUNCA faça)

`clipPath` corta o **próprio elemento** — e isso inclui a `border`. Resultado
real (já aconteceu 3x no projeto): o canto fica sem borda, "estilhaçado".

```tsx
// ❌ ERRADO — a borda morre no corte
<div className="border border-white/20" style={{ clipPath: CUT_BADGE }}>...</div>

// ❌ ERRADO — mesma coisa em botão
<button className="border border-white/15 bg-white/5" style={{ clipPath: CUT_BUTTON }}>Last</button>
```

## O jeito certo — `CutCard`

O `CutCard` pinta a borda numa camada recortada (clip externo) e o conteúdo
numa camada interna com o clip menor — a "borda" aparece em **todas** as
arestas, inclusive nas diagonais.

```tsx
import { CutCard } from '../components/ui/CutCard';

<CutCard
  borderColor="rgba(255,255,255,0.15)" // cor da borda
  background="#0E0E12"                 // fundo do conteúdo — PRECISA SER OPACO
  className="h-11 w-full"              // tamanho/formato do card
  contentClassName="flex items-center justify-center text-white" // conteúdo
>
  Last
</CutCard>
```

Regras de uso:

- **`background` precisa ser opaco** — se for translúcido, o "frame" da borda
  atravessa o card. (Translúcido só por cima de um fundo sólido próprio.)
- Para o card **selecionado/ativo**, passe a cor de destaque no `borderColor`
  E no `background` (ex.: `#FFB700` nos dois, texto preto).
- **Glow/brilho**: use `filter: drop-shadow(...)` num wrapper **sem clip** —
  `box-shadow` no elemento recortado é cortado junto (o drop-shadow segue o
  recorte). Ex.: card da vaga do pós-draft.
- Alternativa manual (padrão antigo do fork, ainda válido):
  ```tsx
  <div className="p-[1px]" style={{ background: corBorda, clipPath: CUT_X }}>
    <div style={{ clipPath: CUT_X_INNER }} className="bg-fundo">conteúdo</div>
  </div>
  ```

## Onde isso já mordeu (histórico)

| Lugar | Status |
|---|---|
| Botão `Last` / `Last Pick` (sala campeonato) | ✅ corrigido com CutCard |
| Card da vaga no pós-draft (sala campeonato) | ✅ corrigido (CutCard + drop-shadow) |
| Pills **MD1/MD3/MD5** do modal TIME vs TIME (/jogar) | ✅ corrigido com CutCard |
| Tela "Partidas Finalizadas" do /jogar (pontual, "a seta") | ⚠️ usar CutCard ao tocar |

## Checklist rápido ao criar um elemento recortado

1. Tem `clipPath`? Então **não** use `border` nele.
2. Precisa de borda? → `CutCard` (ou o par `p-[1px]` + clip interno).
3. Fundo do CutCard **opaco**; seleção = cor no `borderColor` + `background`.
4. Brilho externo → `drop-shadow` num wrapper sem clip.
