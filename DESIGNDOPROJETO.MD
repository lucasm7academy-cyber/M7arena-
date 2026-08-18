# Design System M7 Arena — Estilo Cut-Edge & Atmosfera Gamer

Este documento documenta e padroniza a identidade visual **Cut-Edge da M7 Arena**, desenvolvida para criar uma interface gamer de alta performance, imersiva, moderna e visualmente impactante, eliminando bordas arredondadas genéricas e o preto 100% chapado.

---

## 1. Filosofia Visual

1. **Cortes Angulares Precisos (Cut-Edge):** Todos os componentes essenciais (modais, cards, botões, badges, painéis) utilizam cantos chanfrados diagonais com recortes simétricos.
2. **Espessura de Borda Uniforme (Dual-Polygon Shell):** A borda é formada por dois containers sobrepostos com polígonos proporcionais (`p-[1px]` ou `p-[1.5px]`), garantindo que o chanfro tenha a mesma espessura de borda que as laterais retas.
3. **Fundo com Profundidade & Atmosfera:** O fundo da aplicação utiliza tons escuros com texturas e luzes ambientes suaves (`#060608`, `#08080a`, `#0c0c10`), nunca preto puro (`#000000`) sem profundidade.
4. **Gradientes e Fades Dinâmicos:** As bordas utilizam gradientes lineares (geralmente em ângulo de `135deg`) que concentram o brilho no canto superior esquerdo e suavizam em direção ao canto inferior direito.
5. **Abertura e Transições Instantâneas:** Nada de animações pesadas de escala/mola ("grow-up" lento). Modais e interações abrem com leveza e agilidade imediata.

---

## 2. Paleta de Cores e Atmosfera

### 2.1 Cores de Fundo (Depth Layers)
| Nível | Cor HEX | Aplicação |
|---|---|---|
| **Fundo Global** | `#060608` | Fundo geral da página com luzes ambientes |
| **Container Card** | `#08080a` | Fundo interno de modais e cards principais |
| **Subcard / Hover** | `#0c0c10` / `#0f0f14` | Subcontainers, inputs e estados de hover |
| **Preto Profundo** | `#030304` | Fundo de imagens e áreas de contraste máximo |

### 2.2 Cores de Destaque e Modos
| Cor | HEX | Significado / Uso |
|---|---|---|
| **Dourado Arena** | `#FFB700` | Identidade oficial M7, premiações, vitórias, CTAs primários |
| **Roxo Twitch / VIP** | `#9146FF` | Transmissões ao vivo, lives, assinaturas VIP |
| **Ciano Energético** | `#00F0FF` | Modo 5v5 Summoner's Rift, tecnologia, Riot ID |
| **Verde Esmeralda** | `#00FF41` | Vitórias, valores em R$ / Pix, modo ARAM |
| **Vermelho Fogo** | `#FF4655` / `#EF4444` | Derrotas, avisos de erro, status "Ao Vivo" |
| **Magenta / Roxo** | `#D500FF` | Modo 1v1 ARAM, destaques especiais |

### 2.3 Luzes Ambientes de Fundo (Backdrop Glows)
Para criar profundidade sem pesar no navegador, insere-se no topo da página:
```tsx
<div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
  <div className="absolute -top-[10%] left-[20%] w-[600px] h-[600px] bg-[#FFB700]/5 rounded-full blur-[140px]" />
  <div className="absolute top-[35%] right-[10%] w-[500px] h-[500px] bg-[#9146FF]/5 rounded-full blur-[140px]" />
  <div className="absolute top-[65%] left-[15%] w-[550px] h-[550px] bg-[#00F0FF]/4 rounded-full blur-[150px]" />
</div>
```

---

## 3. As Fórmulas de Polígonos Chanfrados (Clip-Path)

Exportadas e centralizadas no projeto:

```tsx
// 1. CARDS GRANDES, MODAIS E BANNERS (Corte de 14px)
export const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
export const CUT_FRAME_INNER = 'polygon(12.5px 0, 100% 0, 100% calc(100% - 12.5px), calc(100% - 12.5px) 100%, 0 12.5px)';

// 2. BOTÕES, SUBCARDS E HEADERS (Corte de 9px)
export const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';
export const CUT_BUTTON_INNER = 'polygon(7.8px 0, 100% 0, 100% calc(100% - 7.8px), calc(100% - 7.8px) 100%, 0 7.8px)';

// 3. BADGES, TAGS E INDICADORES (Corte de 6px)
export const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
export const CUT_BADGE_INNER = 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 5px)';
```

---

## 4. Estrutura de Construção dos Componentes

### 4.1 Card / Modal Principal (Dual Container com Borda Fade)
```tsx
<div
  className="relative p-[1.5px] w-full max-w-xl shadow-2xl transition-all"
  style={{
    clipPath: CUT_FRAME,
    background: 'linear-gradient(135deg, #FFB700 0%, #FFB70055 50%, rgba(255,255,255,0.08) 100%)',
    boxShadow: '0 0 50px -10px rgba(255,183,0,0.35)'
  }}
>
  <div
    className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-6"
    style={{ clipPath: CUT_FRAME_INNER }}
  >
    {/* Conteúdo do Card */}
  </div>
</div>
```

---

### 4.2 Botão Primário Dourado (CTA de Alta Conversão)
```tsx
<button
  onClick={handleClick}
  className="px-8 py-3.5 bg-[#FFB700] hover:bg-[#e0a000] text-black font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_25px_-5px_rgba(255,183,0,0.5)] cursor-pointer flex items-center justify-center gap-2"
  style={{ clipPath: CUT_BUTTON }}
>
  <span>CONFIRMAR ENTRADA</span>
  <ChevronRight size={14} />
</button>
```

---

### 4.3 Botão Secundário / Escuro
```tsx
<button
  onClick={handleCancel}
  className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/15 hover:border-white/30 font-black uppercase tracking-widest text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
  style={{ clipPath: CUT_BUTTON }}
>
  CANCELAR
</button>
```

---

### 4.4 Badge / Tag de Destaque
```tsx
<div
  className="px-2.5 py-1 bg-[#FFB700]/15 text-[#FFB700] border border-[#FFB700]/40 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"
  style={{ clipPath: CUT_BADGE }}
>
  <div className="w-1.5 h-1.5 rounded-full bg-[#FFB700] animate-pulse" />
  <span>TEMPORADA 2026</span>
</div>
```

---

### 4.5 Subcards / Caixas de Input Internas
```tsx
<div
  className="relative p-[1px] w-full"
  style={{
    clipPath: CUT_BUTTON,
    background: 'rgba(255, 255, 255, 0.1)'
  }}
>
  <div
    className="w-full bg-[#0c0c10] p-4 flex items-center justify-between"
    style={{ clipPath: CUT_BUTTON_INNER }}
  >
    <span className="text-white/60 text-xs font-bold">Nick Riot</span>
    <span className="text-white font-black text-xs uppercase">Player#BR1</span>
  </div>
</div>
```

---

## 5. Regras de Tipografia e Textos

- **Títulos e Ações:** `font-black`, `uppercase`, `tracking-tight` ou `tracking-tighter`.
- **Labels, Badges e Botões:** `font-black`, `uppercase`, `tracking-wider` ou `tracking-widest`, tamanho `text-[10px]` a `text-xs`.
- **Textos Secundários / Resumos:** `text-white/50` ou `text-white/60`, peso normal/médio, tamanho `text-xs` ou `text-sm`.

---

## 6. Checklist de Qualidade Visual

- [x] Nenhum card possui cantos arredondados genéricos (`rounded-2xl`, `rounded-xl`, etc.) onde o estilo chanfrado deve prevalecer.
- [x] O fundo nunca é preto puro chapado (`#000000`) sem textura/luz ambiente.
- [x] As bordas chanfradas utilizam pares de polígonos para manter a espessura contínua de 1px a 1.5px.
- [x] Modais e avisos abrem instantaneamente, sem efeito elástico de zoom ou grow-up.
- [x] As cores de cada modo (5v5, ARAM, 1v1, Campeonatos) orientam o gradiente da borda e os botões de ação.
