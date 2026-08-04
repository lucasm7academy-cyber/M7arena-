// src/lib/clockSync.ts
// Correção de skew de relógio entre cliente e servidor (ajustarsala F2).
//
// O problema: `sala.confirmacao_expires_at` é um timestamp absoluto do
// servidor. Se o relógio local do dispositivo diverge do servidor, o "tempo
// restante" calculado com `Date.now()` sai errado e cada jogador vê um valor
// diferente (ex.: 20s vs 75s). Aqui medimos `offset = server_time - Date.now()`
// a cada resposta da sala e derivamos todos os timers com `now + offset`.

let offset = 0; // server_now - client_now (ms)

/** Registra o relógio do servidor vindo de uma resposta (epoch ms). */
export function registrarServerTime(serverTime: number | string | null | undefined) {
  const st = Number(serverTime);
  if (!Number.isFinite(st) || st <= 0) return;
  // Média suave: não deixa uma única medição (latência) deslocar o relógio.
  const medido = st - Date.now();
  offset = offset === 0 ? medido : offset * 0.7 + medido * 0.3;
}

/** Relógio "verdadeiro" (servidor) no instante atual, em ms. */
export function agoraServidor(): number {
  return Date.now() + offset;
}

/** Força a reavaliação do offset numa medição nova. (útil em testes) */
export function _resetOffset() {
  offset = 0;
}
