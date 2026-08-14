// somSala.ts — sons de confirmação da sala.
//
// MP3 de /public/sounds:
// - confirmacao-abertura.mp3: notificação quando a contagem abre (pré-boostada).
// - confirmacao-musica.mp3: música de fundo tocando até o jogador confirmar.
// - confirmacao-tick.mp3: beep a cada segundo da contagem.
//
// Autoplay: o navegador só deixa tocar após o primeiro gesto do usuário. Como
// quem está na sala precisou clicar para entrar, o contexto já está liberado.

let aberturaEl: HTMLAudioElement | null = null;
let musicaEl: HTMLAudioElement | null = null;
let tickEl: HTMLAudioElement | null = null;

function somAbertura(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!aberturaEl) {
    aberturaEl = new Audio('/sounds/confirmacao-abertura.mp3');
    aberturaEl.volume = 1.0;
  }
  return aberturaEl;
}

function somMusica(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!musicaEl) {
    musicaEl = new Audio('/sounds/confirmacao-musica.mp3');
    musicaEl.volume = 0.55;
    musicaEl.loop = true;
  }
  return musicaEl;
}

function somTick(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!tickEl) {
    tickEl = new Audio('/sounds/confirmacao-tick.mp3');
    tickEl.volume = 0.35;
  }
  return tickEl;
}

/** Notificação de abertura + música de fundo até confirmar. */
export function tocarInicioConfirmacao() {
  const abertura = somAbertura();
  if (abertura) {
    abertura.currentTime = 0;
    abertura.play().catch(() => {});
  }
  const musica = somMusica();
  if (musica) {
    musica.currentTime = 0;
    musica.play().catch(() => {});
  }
}

/** Parar a música de fundo (jogador confirmou ou sala saiu de confirmacao). */
export function pararMusicaConfirmacao() {
  if (musicaEl) {
    musicaEl.pause();
    musicaEl.currentTime = 0;
  }
}

/** Tick de contagem — 1x por segundo enquanto a confirmação está aberta. */
export function tocarTickConfirmacao() {
  const el = somTick();
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}
