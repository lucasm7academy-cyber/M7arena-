# Treino de mira

Mini-jogo de aquecimento no estilo osu!: três modos, alvos que encolhem e uma
nota de SS a D. A página fica em `/treino-mira` (rota pública carregada por
import lazy no [App](../../App.tsx), dentro do layout público, com portal em tela
cheia acima do cabeçalho) e o ranking geral
vem do servidor. Jogar exige apenas o navegador; entrar na conta serve para
gravar a nota.

## Entradas e arquivos

| Arquivo | Papel |
|---|---|
| [domain/engine.ts](domain/engine.ts) | Motor puro, sem DOM e sem dependências: `createAimState`, `startAim`, `tick`, `hitTest`, `dragHit`, `timingWindow`, `spawnTarget`, ajuste de dificuldade, métricas (`accuracy`, `aimsPerMinute`, `averageReaction`, `progress`, `difficultyAt`), `gradeOf`, `MODE_LABEL`, `MODE_HINT`, `SEED_LEADERBOARD`. O estado é mutável de propósito. |
| [hooks/useAimGame.ts](hooks/useAimGame.ts) | Dono do ciclo da rodada: guarda o estado em `ref`, roda o loop de `requestAnimationFrame`, mede o canvas (devicePixelRatio e resize), publica o HUD a ~4 Hz, pausa quando a aba é escondida e envia a nota ao servidor. |
| [components/drawAim.ts](components/drawAim.ts) | Pintura do frame em Canvas 2D: piso, grade, alvos com anel de aproximação, estouro do acerto, eventos (`+pontos`, erro, alvo expirado), retículo e a borda pulsando nos últimos 5 s. Não conhece React. |
| [components/AimCanvas.tsx](components/AimCanvas.tsx) | Moldura recortada da casa + `<canvas>` responsivo e o palco dos overlays. |
| [components/AimHud.tsx](components/AimHud.tsx) | Placar: modo, nível, temperatura do relógio, pontos, combo, melhor combo, acerto, APM e barra de progresso. |
| [components/AimResult.tsx](components/AimResult.tsx) | Resultado da rodada: nota, números, estado do envio e ações (jogar de novo, fechar). |
| [components/AimLeaderboard.tsx](components/AimLeaderboard.tsx) | Ranking do servidor com filtro por modo, destaque da própria linha, estado vazio e aviso quando a API não responde. |
| [components/frames.ts](components/frames.ts) | Recortes de canto compartilhados pelos componentes acima. |
| [pages/TreinoMira.tsx](pages/TreinoMira.tsx) | Composição da página: escolha de modo, arena, ranking e leitura da sessão. |

## Fluxo da rodada

1. `idle`: cartão central com três modos coloridos, dica, CTA e recorde pessoal
   quando a própria linha está no top 25 do modo. Ausência de linha ou falha de
   rede aparece como “—”, não como zero nem recorde inventado.
2. `playing`: `start()` chama `startAim` com `performance.now()`; o loop chama
   `tick(state, now, dt)` e pinta o frame. Cada `pointerdown` no canvas vira
   `hitTest` com as coordenadas convertidas para o espaço do estado. Em Movimento,
   o pointerdown usa `dragHit`; nos três modos, segurar e mover varre o segmento
   entre posições em passos de até 4px. O loop também testa o cursor parado
   enquanto pressionado, para receber alvos móveis.
3. Fim: quando o motor para (`state.running === false`, 30 s), o resultado é
   montado com `gradeOf(accuracy, score)` e, se houver sessão, enviado por
   `api.aim.submitScore`. Visitante vê o convite para entrar no lugar do envio.
4. `finished`: o resultado cobre a arena. "Jogar de novo" reinicia a rodada no
   mesmo modo; "Fechar" volta ao convite limpando o estado. Ao aceitar a nota, o
   ranking é recarregado (`refreshKey`).

Trocar de modo reinicia o estado e só acontece fora da rodada; os cartões ficam
desabilitados durante o jogo.

O X circular fixo (`aria-label="Voltar"`) volta ao lobby e a desmontagem encerra
o loop sem enviar uma rodada parcial. O scroll do documento fica bloqueado
enquanto a tela está aberta. Pointer capture mantém o arrasto; soltar, cancelar,
perder captura ou esconder a aba cancela a pressão.

`dragHit` só chama a mesma pontuação de `hitTest` se tocar um alvo ativo. Vazio
não incrementa tentativas/erros; `hitAt` bloqueia permanentemente repetição por
alvo (inclusive os 260ms da animação, cobrindo o cooldown pedido de ~80ms).
Não há fórmula paralela de pontos ou accuracy para arrasto.

Visual: fundo preto com halos ciano/rosa, grid e estrelas discretos, anel externo
na cor do combo (rosa, azul, verde, roxo e laranja a cada dez acertos), aro interno
branco e número central. O approach ring branco fecha de 2,4× até 1× durante a
vida do alvo; acertar antes interrompe o anel e dispara um burst de 200ms.
A marca inferior e os pontos flutuantes mostram a janela de timing
(300 ciano, 100 verde, 50 dourado), sem mudar a fórmula existente.
Movimento tem cauda; cursor tem rastro de 180ms; erro/expiração mostra X vermelho.
Perfect dá flash breve, erro dá shake de até 2,5px e S/SS recebe confete leve.
Flash, shake, trail e confete respeitam redução de movimento.

## Contratos

- Ranking: `api.aim.leaderboard(mode, limit)` → `{ rows }`, com `id`, `name`,
  `mode`, `score`, `accuracy`, `apm`, `grade` e `at`
  ([cliente HTTP](../../lib/api.ts)). O filtro `all` junta os três modos.
- Envio: `api.aim.submitScore({ mode, score, accuracy, apm, combo, durationMs })`
  → `{ ok, row, position }`. O servidor é a autoridade da nota e da posição; a
  UI só apresenta a prévia calculada pelo motor. Detalhes de validação, uma linha
  por jogador e recálculo da nota em
  [Mira da API](../../../../api/src/modules/aim/README.md).
- Sessão que cai entre a rodada e o envio (401) cai no mesmo convite para entrar;
  payload recusado (400) aparece como falha de envio com "Tentar de novo".
- Nada de ranking persistido no navegador. `SEED_LEADERBOARD` aparece somente
  como exemplo identificado quando o endereço do ranking não responde.
- Pontuação e nota saem do motor: acerto com bônus de velocidade, proximidade do
  centro e combo; a nota usa as janelas de inspiração osu! (300/100/50) na curva
  de `gradeOf`, e o servidor recalcula a mesma curva.

## Dependências compartilhadas

- [AuthContext](../../contexts/AuthContext.tsx): `user` decide se a nota é
  enviada e qual nome destacar no ranking.
- [lib/api.ts](../../lib/api.ts): namespaces `api.aim` e tipos `ApiAimScore`.
- Recortes, campos e tipografia seguem a gramática da vitrine Jogar, com
  acentos neon ciano/rosa e cor por contexto; dourado permanece pontual;
  `motion` e `lucide-react` já são dependências do frontend. Nenhuma biblioteca
  nova foi adicionada — a arena é Canvas 2D puro.

## Consumidores

- Rota `/treino-mira`.
- Bloco "Novidades" da [Home](../home/README.md): anuncia Sala M7 e Treino de Mira
  e o botão "GO!" navega para esta página.

## Verificações e limites

Em `web/`: `npm run lint` (tsc) e `npm run build`.

- A página roda o jogo no navegador; o React não re-renderiza por frame — o
  estado vive na `ref` do motor e o HUD só recebe um retrato a cada ~240 ms.
- O canvas é medido por `ResizeObserver` e desenha em devicePixelRatio (limitado
  a 2.5). Ao esconder a aba a rodada pausa e o relógio do motor é deslocado no
  retorno, para não encerrar uma rodada enquanto o jogador está fora.
- Sem teste DOM nesta consolidação: pintura, retículo, toque e resposta do mouse
  dependem de homologação em navegador desktop e mobile; lint e build não provam
  esses aspectos.
- O ranking e o envio dependem do serviço `/api/aim`. Sem resposta, a página
  continua jogável e mostra o aviso de indisponibilidade com linhas de exemplo.
- Filtro, destaque da própria linha e ordem exibida são leitura do servidor; o
  cliente não reordena nem recalcula posição.
