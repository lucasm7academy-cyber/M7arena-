# Molduras do Ranking (Top 1 / 2 / 3) — padrão de arte

Este documento é a **especificação única** das três molduras de dragão usadas no
pódio do lobby (`TopTeamsStickers`). O objetivo é que a IA gere as três artes com
**exatamente a mesma planta** — só mudando o material (ouro / fogo / pedra) e o
número do badge — para a plataforma sobrepor logo, nome e números sempre no
mesmo lugar.

- Prancha-guia (fundo escuro, para anexar no gerador): `docs/ranking/moldura-rank-template.png`
- Prancha só com as guias (fundo transparente): `docs/ranking/moldura-rank-guides.png`
- Validador: `node scripts/ranking/check-frame.mjs <arquivo.png>`

---

## 1. Especificação canônica (não mudar entre as 3 artes)

| Item | Valor em px | Valor em % |
|---|---|---|
| Tela | **1024 × 1536** (2:3, retrato) | — |
| Fundo externo | 100% transparente (alpha 0) | — |
| Círculo da logo | centro **(512, 770)**, diâmetro **600** | centro (50,00%, 50,13%), ⌀ 58,59% da largura |
| Interior do círculo | **100% transparente** (vazado) | — |
| Placa do nome | x **216 → 808**, y **1048 → 1144** (592 × 96) | x 21,09%→78,91%, y 68,23%→74,48% |
| Faixa das 3 caixas | x **177 → 847**, y **1171 → 1355** (670 × 184) | y 76,24%→88,22% |
| Caixa 1 (WIN RATE) | x **177 → 385** (208 de largura) | centro 27,44% |
| Caixa 2 (WIN / LOSS) | x **408 → 616** | centro 50,00% |
| Caixa 3 (PDL) | x **639 → 847** | centro 72,56% |
| Linha de separação do valor | y **1290** | 83,98% |

Regras de ouro:

1. As **3 caixas são idênticas** (208 × 184) e com o mesmo espaçamento (23 px).
2. Nada de texto dentro da placa/caixas além dos rótulos fixos `WIN RATE`,
   `WIN / LOSS` e `PDL` (e o número do rank no badge).
3. O **miolo da placa e das caixas é liso/escuro** (é onde a plataforma escreve).
4. O **círculo é vazado de verdade**: alpha 0 no interior, sem "vidro" e sem
   textura. Sem anel metálico invadindo o miolo.
5. O dragão pode invadir a borda do círculo (garras, badge, placa) — isso é
   desejado: esses elementos ficam **por cima** da logo do time.

---

## 2. Prompt (copiar e colar)

> **Prompt principal — variante 3º lugar (dragão de montanha / golem)**
>
> Moldura de ranking de eSports, fantasia sombria, **PNG com transparência
> real**, tela **1024 × 1536 px (retrato 2:3)**, composição **vertical e
> simétrica**, vista de frente, centralizada.
>
> **Estrutura obrigatória (não alterar posições):**
> - **Círculo vazado no centro** — centro exatamente em **(512, 770)**, diâmetro
>   **600 px**. O interior do círculo deve ser **100% transparente** (alpha 0),
>   sem vidro, sem fumaça, sem textura e sem reflexo. A moldura de pedra/garras
>   contorna esse círculo.
> - **Placa de nome** logo abaixo do círculo: retângulo **x 216→808, y
>   1048→1144** (592 × 96 px), pedra escura lisa com borda de ouro e pontas
>   chanfradas. **Interior liso e escuro**, sem relevo no centro (a plataforma
>   escreve o nome lá).
> - **Três caixas de estatística iguais**, lado a lado, em **x 177→385, x
>   408→616 e x 639→847**, todas com **y 1171→1355** (208 × 184 px cada, 23 px
>   de vão). Cada caixa: fundo escuro liso, borda fina de ouro, cantos
>   chanfrados, e no topo da caixa apenas o rótulo em maiúsculas pequenas:
>   **WIN RATE**, **WIN / LOSS**, **PDL** (com um ícone minúsculo acima de cada
>   um). Abaixo do rótulo, uma **linha horizontal fina de ouro em y 1290** e,
>   embaixo dela, **espaço vazio** para o número.
> - **Badge do rank** acima do círculo, centralizado em x 512, entre y 430 e y
>   560: placa pontiaguda de ouro com o número **3** em relevo.
>
> **Dragão:** dragão de montanha/golem de pedra vulcânica, escamas de basalto
> com veios de magma dourado, garras abertas contornando o círculo, cabeça
> acima do badge, asas caídas nas laterais. Estilo concept art AAA, iluminação
> cinematográfica, alto contraste, dourado quente (#FFB700 / #FF8A00) sobre
> pedra quase preta (#141014).
>
> **Consistência:** esta é a **prancha mestre**. As variantes 1º e 2º lugar
> devem usar **exatamente a mesma planta, o mesmo enquadramento, o mesmo
> tamanho de círculo, placa e caixas**. Só podem mudar: (a) o material/paleta —
> 1º = ouro polido com escamas douradas, 2º = dragão de fogo com chamas
> laranja, 3º = golem de pedra vulcânica; (b) o número do badge (1 / 2 / 3);
> (c) o formato da cabeça/asas do dragão.
>
> **Negativo (não fazer):** fundo branco ou xadrez, fundo cinza, sombra
> projetada no chão, texto extra, números dentro das caixas, cantos retos,
> círculo preenchido com cor, vidro no centro, moldura cortada nas bordas da
> tela, elementos fora do enquadramento, marca d'água, assinatura.

---

## 3. Como manter a consistência no gerador

1. **Anexe a prancha-guia** (`moldura-rank-template.png`) como *image prompt* /
   referência de composição (ou use ControlNet/Depth/Canny, se a ferramenta
   tiver). Ela tem as zonas marcadas nas coordenadas exatas.
2. Gere **sempre no mesmo tamanho** (1024 × 1536). Se a ferramenta só gerar
   quadrado, gere em 1024×1024 e **não** corte: refaça até sair no 2:3.
3. Mantenha o **mesmo seed** e troque só as palavras de material/paleta e o
   número do badge.
4. Peça **transparência real** (PNG/WebP com alpha). Se vier com xadrez
   achatado, o validador avisa e a gente limpa.
5. Depois de gerar, rode o validador para ver o desvio em pixels.

---

## 4. Validação

```bash
node scripts/ranking/check-frame.mjs caminho/da/arte.png
```

Ele imprime:

- tamanho da tela (tem de ser 1024 × 1536);
- centro e diâmetro do **buraco** medido, e a diferença para o padrão;
- gera `caminho/da/arte-guia.png` com as guias canônicas sobrepostas — se as
  linhas caírem em cima das bordas da arte, está aprovada.

Tolerância aceitável: **±15 px** no centro do círculo e **±25 px** no diâmetro.
A arte de referência (#3) passa com +1 px de centro e +5 px de diâmetro.

---

## 5. O que a plataforma preenche

| Zona | Conteúdo | Origem |
|---|---|---|
| Círculo | logo do time | `teams.logo_url` |
| Placa | nome do time (maiúsculas) | `teams.nome` |
| Caixa 1 | `winrate%` | `teams.winrate` |
| Caixa 2 | `vitorias/derrotas` | `teams.wins` / `games_played - wins` |
| Caixa 3 | PDL | `teams.pdl` |

O componente lê essas coordenadas de **um único objeto** (`FRAMES` em
`web/src/components/home/TopTeamsStickers.tsx`). Quando as três artes seguirem
esta planta, as três passam a usar a **mesma configuração** — hoje cada uma tem
um ajuste fino porque as artes atuais vieram com as caixas em alturas
diferentes.
