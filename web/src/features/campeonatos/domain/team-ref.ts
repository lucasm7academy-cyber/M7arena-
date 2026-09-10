/**
 * Comparação de referências de time (tag/nome) usada no campeonato.
 *
 * As tags podem ser editadas pelo capitão e o cronograma guarda o valor do
 * momento em que o jogo foi criado — então a comparação precisa ignorar caixa
 * e espaços. Sem isso, o time do jogador não era reconhecido na partida (o
 * botão Iniciar Série e o Copiar Código não apareciam para os membros).
 */
export const sameTeamRef = (a?: string | null, b?: string | null) =>
  (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
