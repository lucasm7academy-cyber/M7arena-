// somSala.ts — sons de confirmação da sala.
//
// Os dois MP3 vêm de /public/sounds: confirmacao-abertura.mp3 toca quando a
// contagem abre (preencher as vagas) e confirmacao-tick.mp3 a cada segundo
// enquanto a contagem está aberta e o usuário ainda não confirmou.
//
// Autoplay: o navegador só deixa tocar após o primeiro gesto do usuário. Como
// quem está na sala precisou clicar para entrar, o contexto já está liberado.

let aberturaEl: HTMLAudioElement | null = null;
let tickEl: HTMLAudioElement | null = null;

function somAbertura(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!aberturaEl) {
    aberturaEl = new Audio('/sounds/confirmacao-abertura.mp3');
  }
  return aberturaEl;
}

function somTick(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!tickEl) {
    tickEl = new Audio('/sounds/confirmacao-tick.mp3');
  }
  return tickEl;
}

/** Ding de abertura da contagem (contagem de confirmação abriu). */
export function tocarInicioConfirmacao() {
  const el = somAbertura();
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}

/** Tick de contagem — 1x por segundo enquanto a confirmação está aberta. */
export function tocarTickConfirmacao() {
  const el = somTick();
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}
