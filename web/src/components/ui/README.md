# UI compartilhada

Componentes reutilizados por diferentes telas. Este README descreve os contratos
do código atual, sem estabelecer uma paleta nova ou reconstruir guias antigos.

## Recorte com borda

[CutCard.tsx](CutCard.tsx) exporta `CutCard`, `CUT_OUTER`, `CUT_INNER` e
`cutPolygon(corner, borderWidth)`. `CutCard` rende um `motion.div`, duas camadas
de fundo recortadas e o conteúdo acima delas. Ele não é um botão por padrão.

Props específicas: `className`, `contentClassName`, `background`, `borderColor`,
`borderWidth` e `children`; demais props são encaminhadas ao container.
Defaults atuais: fundo `#0A0A0A`, borda `rgba(255,255,255,0.1)` e largura de 1 px.
`cutPolygon` ajusta o canto interno conforme a largura da borda.

```tsx
<CutCard
  background="#0E0E12"
  borderColor="rgba(255,255,255,0.15)"
  contentClassName="p-4"
>
  Conteúdo
</CutCard>
```

Use preenchimento opaco para a moldura não atravessar o conteúdo. Uma `border`
no mesmo elemento com `clipPath` também é recortada; o componente resolve isso
com camadas separadas. Brilho externo pode ficar num wrapper sem recorte.
Preserve a semântica dos controles: botões permanecem botões; não altere permissões,
eventos ou acessibilidade apenas para adotar uma composição visual.

## Outros componentes e consumidores

- [MCIcon.tsx](MCIcon.tsx): ícone de moeda, com `className`, `size` e `style`.
- [VipBadge.tsx](VipBadge.tsx): apresentação compartilhada do indicador VIP.
- Salas, Campeonato, Times e demais consumidores mantêm suas próprias composições
  e estados. Confira imports e uso antes de mudar estes contratos comuns.

O diagnóstico textual de bordas fica em
[web/scripts](../../../scripts/README.md). Ele não substitui inspeção visual;
build/lint também não comprovam que todos os estados ficaram corretos.
