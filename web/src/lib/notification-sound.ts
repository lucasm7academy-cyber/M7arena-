/**
 * Som de notificação — dois tons curtos via WebAudio. Sem dependência de asset:
 * toca um ping suave distinto do som de sucesso/erro já usado no app. Não lança
 * erro se o navegador bloquear autoplay (o chamador geralmente toca após uma
 * interação do usuário, mas o catch é a rede de segurança).
 */

let ctx: AudioContext | null = null;

export function playNotificationSound(): void {
  try {
    ctx = ctx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t = ctx.currentTime;

    const nota = (freq: number, start: number, dur: number) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + start);
      gain.gain.setValueAtTime(0.0001, t + start);
      gain.gain.exponentialRampToValueAtTime(0.16, t + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t + start);
      osc.stop(t + start + dur + 0.02);
    };

    nota(880, 0, 0.16);
    nota(1175, 0.14, 0.22);
  } catch {
    // Sem audio / autoplay bloqueado — silencioso por design.
  }
}
