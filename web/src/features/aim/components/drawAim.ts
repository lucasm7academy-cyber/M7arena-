/**
 * Pintura da arena de mira em Canvas 2D.
 *
 * Não conhece React: recebe o estado mutável do motor
 * (`features/aim/domain/engine.ts`) e desenha um frame. Quem chama é o loop do
 * `useAimGame`, uma vez por `requestAnimationFrame`.
 *
 * Coordenadas: as mesmas do estado (`state.width`/`state.height`, em px CSS); o
 * contexto já chega com a transformação de devicePixelRatio aplicada.
 */
import type { AimState, Target } from '../domain/engine';
import { timingWindow, TIMING_COLOR } from '../domain/engine';

const HIT_FADE = 200;
const EVENT_FADE = 680;
const COMBO_COLORS = ['#ff66aa', '#66ccff', '#88b300', '#a25fff', '#ff9f43'];
const comboColor = (combo: number) => COMBO_COLORS[Math.floor(combo / 10) % COMBO_COLORS.length];

export interface AimPointer {
  x: number;
  y: number;
  active: boolean;
  pressed?: boolean;
  trail?: { x: number; y: number; at: number }[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function drawBackground(ctx: CanvasRenderingContext2D, state: AimState): void {
  const { width: w, height: h } = state;

  // Piso da arena: radial escuro para não competir com os alvos.
  const floor = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.55, Math.max(w, h) * 0.8);
  floor.addColorStop(0, '#090b10');
  floor.addColorStop(0.55, '#06060a');
  floor.addColorStop(1, '#040406');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, w, h);

  // Grade de treino.
  const step = 56;
  const energy = Math.min(5, Math.floor(state.combo / 10));
  ctx.strokeStyle = `rgba(56,232,255,${0.018 + energy * 0.006})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = (w % step) / 2; x <= w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = (h % step) / 2; y <= h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // Luz da casa no canto: um halo dourado bem discreto.
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.6);
  glow.addColorStop(0, 'rgba(255,95,162,0.12)');
  glow.addColorStop(0.45, 'rgba(255,95,162,0.03)');
  glow.addColorStop(1, 'rgba(255,95,162,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const cool = ctx.createRadialGradient(w * 0.75, h * 0.55, 0, w * 0.75, h * 0.55, w * 0.6);
  cool.addColorStop(0, `rgba(56,232,255,${0.10 + energy * 0.008})`);
  cool.addColorStop(1, 'transparent');
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 55; i++) {
    ctx.fillStyle = `rgba(185,235,255,${0.07 + energy * 0.015})`;
    ctx.fillRect((i * 173.7) % w, (i * 97.3) % h, 1, 1);
  }
}

function drawTarget(ctx: CanvasRenderingContext2D, target: Target, now: number, combo: number): void {
  const elapsed = now - target.born;
  const remaining = clamp(1 - elapsed / target.life, 0, 1);
  const timing = TIMING_COLOR[timingWindow(target, now)];
  const color = comboColor(combo);

  // Anel de aproximação: fecha no corpo do alvo conforme o tempo acaba.
  const ringRadius = target.r * (1 + remaining * 1.4);
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(target.x, target.y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  if (target.vx || target.vy) {
    const speed = Math.hypot(target.vx, target.vy);
    const tailX = target.x - target.vx / speed * target.r * 2.6;
    const tailY = target.y - target.vy / speed * target.r * 2.6;
    const tail = ctx.createLinearGradient(tailX, tailY, target.x, target.y);
    tail.addColorStop(0, `${color}00`); tail.addColorStop(1, `${color}45`);
    ctx.save(); ctx.strokeStyle = tail; ctx.lineWidth = target.r * 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.restore();
  }
  // Corpo do alvo.
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  const body = ctx.createRadialGradient(
    target.x - target.r * 0.35,
    target.y - target.r * 0.4,
    target.r * 0.1,
    target.x,
    target.y,
    target.r,
  );
  body.addColorStop(0, `${color}90`);
  body.addColorStop(0.6, `${color}60`);
  body.addColorStop(1, '#0a0a12');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(target.x, target.y, Math.max(1, target.r - 4), 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = `900 ${Math.max(12, target.r * .7)}px Rajdhani, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#ffffff'; ctx.fillText(String(target.id), target.x, target.y + 1);
  ctx.restore();
  // A marca inferior conserva a leitura das janelas de timing.
  ctx.save(); ctx.fillStyle = timing; ctx.beginPath();
  ctx.arc(target.x, target.y + target.r * .6, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawHitBurst(ctx: CanvasRenderingContext2D, target: Target, now: number): void {
  if (target.hitAt === undefined || target.hitAt <= 0) return;
  const age = now - target.hitAt;
  if (age < 0 || age > HIT_FADE) return;
  const k = age / HIT_FADE;

  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.r * (1 + k * 1.9), 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = (1 - k) * 0.8;
  ctx.strokeStyle = comboColor(target.hitCombo ?? 0);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.r * (1 + k * 1.1), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = comboColor(target.hitCombo ?? 0);
  if (age < 70) {
    ctx.globalAlpha = (1 - age / 70) * .75;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = comboColor(target.hitCombo ?? 0); ctx.globalAlpha = 1 - k;
  }
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6 + target.id;
    const distance = target.r * (0.6 + k * 2.8);
    ctx.beginPath();
    ctx.arc(target.x + Math.cos(angle) * distance, target.y + Math.sin(angle) * distance, 2.5 * (1 - k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEvents(ctx: CanvasRenderingContext2D, state: AimState, now: number): void {
  for (const event of state.lastEvents) {
    const age = now - event.at;
    if (age < 0 || age > EVENT_FADE || event.x === undefined || event.y === undefined) continue;
    const k = age / EVENT_FADE;

    if (event.kind === 'hit') {
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = TIMING_COLOR[event.window ?? 300];
      ctx.font = 'italic 900 18px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${event.value ?? 0}`, event.x, event.y - 18 - k * 34);
      ctx.font = '900 10px Rajdhani, sans-serif';
      ctx.fillText(String(event.window ?? 300), event.x, event.y + 10 - k * 20);
      ctx.restore();
      continue;
    }

    if (event.kind === 'miss' || event.kind === 'expire') {
      if (age > 220) continue;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.strokeStyle = 'rgba(255,86,86,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(event.x - 7, event.y - 7); ctx.lineTo(event.x + 7, event.y + 7);
      ctx.moveTo(event.x + 7, event.y - 7); ctx.lineTo(event.x - 7, event.y + 7);
      ctx.stroke();
      ctx.restore();
      continue;
    }

  }
}

function drawReticle(ctx: CanvasRenderingContext2D, pointer: AimPointer, now: number): void {
  if (!pointer.active) return;
  const { x, y } = pointer;

  ctx.save();
  const trail = (pointer.trail ?? []).filter((p) => now - p.at < 180);
  ctx.lineCap = 'round';
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i];
    const gradient = ctx.createLinearGradient(a.x, a.y, b.x + 0.01, b.y + 0.01);
    const alpha = clamp(1 - (now - b.at) / 180, 0, 1);
    gradient.addColorStop(0, `rgba(63,191,154,${alpha * 0.15})`);
    gradient.addColorStop(1, `rgba(56,232,255,${alpha * 0.65})`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = pointer.pressed ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 1.7, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

function drawClockPressure(ctx: CanvasRenderingContext2D, state: AimState, now: number): void {
  if (!state.running) return;
  const left = state.durationMs - (now - state.startedAt);
  if (left > 5000) return;
  const pulse = 0.28 + Math.abs(Math.sin(now / 220)) * 0.35;
  ctx.save();
  ctx.globalAlpha = clamp(pulse, 0.1, 0.6);
  ctx.strokeStyle = comboColor(state.combo);
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, state.width - 3, state.height - 3);
  ctx.restore();
}

/** Desenha o frame completo: piso, alvos, estouros, eventos, retículo e pressão do relógio. */
export function drawAimScene(
  ctx: CanvasRenderingContext2D,
  state: AimState,
  now: number,
  pointer: AimPointer | null,
): void {
  ctx.clearRect(0, 0, state.width, state.height);
  drawBackground(ctx, state);
  const recent = state.lastEvents[state.lastEvents.length - 1];
  const age = recent ? now - recent.at : Infinity;
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced && recent?.kind === 'hit' && recent.window === 300 && age < 100) {
    ctx.fillStyle = `rgba(56,232,255,${0.045 * (1 - age / 100)})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }
  ctx.save();
  if (!reduced && recent && (recent.kind === 'miss' || recent.kind === 'expire') && age < 150) {
    ctx.translate(Math.sin(age * 0.13) * 2.5 * (1 - age / 150), Math.cos(age * 0.1) * 2 * (1 - age / 150));
  }

  for (const target of state.targets) {
    if (target.hitAt === undefined) drawTarget(ctx, target, now, state.combo);
  }
  for (const target of state.targets) {
    if (target.hitAt !== undefined) drawHitBurst(ctx, target, now);
  }

  drawEvents(ctx, state, now);
  if (pointer) drawReticle(ctx, reduced ? { ...pointer, trail: [] } : pointer, now);
  drawClockPressure(ctx, state, now);
  ctx.restore();
}
