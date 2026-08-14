// somSala.ts — sons de confirmação da sala sintetizados com Web Audio API.
//
// Não usa arquivo de áudio: o "tick" da contagem e o "ding" de abertura são
// gerados na hora com osciladores. Motivo: o projeto só tem click.mp3 e
// click1.mp3 (sons de botão), e um asset novo de notificação fugiria do padrão
// do fork sem necessidade — o Web Audio cobre os dois casos sem download.
//
// Autoplay: o navegador só deixa tocar após o primeiro gesto do usuário. Como
// quem está na sala precisou clicar para entrar, o contexto já está liberado.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx.state === 'running' ? audioCtx : null;
}

function beep(freq: number, duracao: number, volume: number, atraso = 0) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + atraso;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duracao + 0.02);
}

/** Ding de abertura da contagem (contagem de confirmação abriu). */
export function tocarInicioConfirmacao() {
  beep(880, 0.12, 0.2, 0);
  beep(1320, 0.2, 0.2, 0.15);
}

/** Tick de contagem — 1x por segundo enquanto a confirmação está aberta. */
export function tocarTickConfirmacao() {
  beep(1200, 0.08, 0.15);
}
