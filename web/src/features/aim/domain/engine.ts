/**
 * Motor do treino de mira (estilo osu!) — Canvas 2D, sem dependências.
 *
 * O estado é **mutável de propósito**: a UI roda isto dentro de
 * `requestAnimationFrame` para não re-renderizar o React a cada frame.
 * Chame `tick()` uma vez por frame e `hit()` a cada clique.
 */

export type AimMode = 'flick' | 'track' | 'precision';

export interface Target {
  id: number;
  x: number;
  y: number;
  r: number; // raio atual (encolhe até o approach time)
  r0: number; // raio inicial no spawn
  rMin: number;
  born: number;
  life: number; // ms até expirar
  vx: number;
  vy: number;
  hitAt?: number; // momento do acerto (para a animação de estouro)
  hitWindow?: 300 | 100 | 50;
  hitCombo?: number;
}

export interface AimConfig {
  mode: AimMode;
  width: number;
  height: number;
  durationMs: number;
}

export interface AimState {
  mode: AimMode;
  width: number;
  height: number;
  durationMs: number;
  running: boolean;
  startedAt: number;
  now: number;
  targets: Target[];
  spawnCooldown: number;
  nextId: number;
  score: number;
  combo: number;
  bestCombo: number;
  hits: number;
  misses: number;
  expired: number;
  reactionTotal: number; // soma dos tempos de reação dos alvos acertados
  lastEvents: AimEvent[];
  difficulty: number; // 0..1
}

export interface AimEvent {
  id: number;
  kind: 'hit' | 'miss' | 'expire' | 'level';
  x?: number;
  y?: number;
  value?: number;
  window?: 300 | 100 | 50;
  combo?: number;
  at: number;
}

export const MODE_LABEL: Record<AimMode, string> = {
  flick: 'Flick',
  track: 'Movimento',
  precision: 'Precisão',
};

export const MODE_HINT: Record<AimMode, string> = {
  flick: 'Alvos aparecem em pontos aleatórios e encolhem. Clique antes de sumir.',
  track: 'Segure e arraste pelos alvos em movimento. Não há penalidade ao arrastar no vazio.',
  precision: 'Alvos menores, mais tempo, sem desculpa: acerte o centro.',
};

const MODE_TUNING: Record<AimMode, {
  startRadius: number;
  endRadius: number;
  startLife: number;
  endLife: number;
  moving: boolean;
  spawnGap: number;
}> = {
  flick: { startRadius: 46, endRadius: 20, startLife: 1800, endLife: 720, moving: false, spawnGap: 240 },
  track: { startRadius: 40, endRadius: 22, startLife: 2400, endLife: 1400, moving: true, spawnGap: 520 },
  precision: { startRadius: 26, endRadius: 12, startLife: 2000, endLife: 1100, moving: false, spawnGap: 420 },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Curva de dificuldade: começa leve e sobe de forma contínua (não em degraus). */
export function difficultyAt(state: AimState): number {
  const progress = Math.min(1, Math.max(0, (state.now - state.startedAt) / state.durationMs));
  // easeOutQuad: sobe rápido no início e estabiliza, sem platô evidente
  return Math.min(1, progress * (2 - progress) * 0.92 + Math.min(0.08, state.hits / 400));
}

export function createAimState(config: AimConfig): AimState {
  return {
    mode: config.mode,
    width: config.width,
    height: config.height,
    durationMs: config.durationMs,
    running: false,
    startedAt: 0,
    now: 0,
    targets: [],
    spawnCooldown: 0,
    nextId: 1,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    expired: 0,
    reactionTotal: 0,
    lastEvents: [],
    difficulty: 0,
  };
}

export function startAim(state: AimState, now: number, seed = 0): AimState {
  state.running = true;
  state.startedAt = now;
  state.now = now;
  state.targets = [];
  state.score = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.hits = 0;
  state.misses = 0;
  state.expired = 0;
  state.reactionTotal = 0;
  state.lastEvents = [];
  state.difficulty = 0;
  state.spawnCooldown = 0;
  state.nextId = 1;
  // Alvo inicial já visível: a primeira ação acontece em <1s.
  spawnTarget(state, now);
  if (seed) state.difficulty = 0;
  return state;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function maxTargets(state: AimState): number {
  const base = state.mode === 'precision' ? 1 : state.mode === 'track' ? 2 : 1;
  return base + Math.floor(state.difficulty * 2);
}

export function spawnTarget(state: AimState, now: number): Target | null {
  if (state.targets.filter((t) => t.hitAt === undefined).length >= maxTargets(state)) return null;
  const tuning = MODE_TUNING[state.mode];
  const d = state.difficulty;
  const r = Math.round(lerp(tuning.startRadius, tuning.endRadius, d));
  const life = Math.round(lerp(tuning.startLife, tuning.endLife, d));
  const pad = r + 12;
  const target: Target = {
    id: state.nextId++,
    x: randomBetween(pad, Math.max(pad, state.width - pad)),
    y: randomBetween(pad, Math.max(pad, state.height - pad)),
    r,
    r0: r,
    rMin: tuning.endRadius,
    born: now,
    life,
    vx: 0,
    vy: 0,
  };
  if (tuning.moving) {
    const speed = lerp(40, 130, d); // px/s
    const angle = Math.random() * Math.PI * 2;
    target.vx = Math.cos(angle) * speed;
    target.vy = Math.sin(angle) * speed;
  }
  state.targets.push(target);
  return target;
}

/** Avança o tempo: move alvos, expira os que passaram do tempo e repõe a fila. */
export function tick(state: AimState, now: number, dtMs: number): AimState {
  if (!state.running) return state;
  state.now = now;
  state.difficulty = difficultyAt(state);

  if (now - state.startedAt >= state.durationMs) {
    state.running = false;
    return state;
  }

  const tuning = MODE_TUNING[state.mode];
  const dt = Math.min(48, dtMs) / 1000;

  for (const target of state.targets) {
    if (target.hitAt !== undefined) continue;
    if (target.vx || target.vy) {
      target.x += target.vx * dt;
      target.y += target.vy * dt;
      if (target.x < target.r || target.x > state.width - target.r) {
        target.vx *= -1;
        target.x = Math.min(Math.max(target.x, target.r), state.width - target.r);
      }
      if (target.y < target.r || target.y > state.height - target.r) {
        target.vy *= -1;
        target.y = Math.min(Math.max(target.y, target.r), state.height - target.r);
      }
    }
    if (now - target.born >= target.life) {
      target.hitAt = -1; // marca expirado
      state.expired += 1;
      state.combo = 0;
      pushEvent(state, { kind: 'expire', x: target.x, y: target.y, at: now });
    }
  }

  // Remove alvos resolvidos (acertados ou expirados) depois da animação.
  state.targets = state.targets.filter((t) => t.hitAt === undefined || (t.hitAt > 0 && now - t.hitAt < 260));

  state.spawnCooldown -= dtMs;
  if (state.spawnCooldown <= 0) {
    const pending = state.targets.filter((t) => t.hitAt === undefined).length;
    if (pending < maxTargets(state)) {
      spawnTarget(state, now);
      state.spawnCooldown = Math.max(140, tuning.spawnGap - state.difficulty * 140);
    }
  }
  return state;
}

function pushEvent(state: AimState, event: Omit<AimEvent, 'id'>): void {
  state.lastEvents.push({ id: state.lastEvents.length + 1, ...event });
  if (state.lastEvents.length > 24) state.lastEvents.shift();
}

export interface HitResult {
  hit: boolean;
  points: number;
  target?: Target;
}

/** Janela visual de timing; não altera a fórmula de pontos existente. */
export function timingWindow(target: Target, now: number): 300 | 100 | 50 {
  const elapsed = Math.max(0, now - target.born) / target.life;
  return elapsed < 0.4 ? 300 : elapsed < 0.75 ? 100 : 50;
}

export const TIMING_COLOR = { 300: '#38e8ff', 100: '#3fbf9a', 50: '#FFB700' } as const;

/** Mesma pontuação do clique, sem tentativa/erro quando o arrasto passa no vazio.
 * hitAt é a trava por alvo: um alvo resolvido nunca pontua novamente, inclusive
 * durante os 260ms de animação (mais que o cooldown de 80ms).
 */
export function dragHit(state: AimState, x: number, y: number, now: number): HitResult {
  if (!state.running || !state.targets.some((target) =>
    target.hitAt === undefined && Math.hypot(x - target.x, y - target.y) <= target.r
  )) return { hit: false, points: 0 };
  return hitTest(state, x, y, now);
}

/** Registra um clique nas coordenadas do canvas. */
export function hitTest(state: AimState, x: number, y: number, now: number): HitResult {
  if (!state.running) return { hit: false, points: 0 };
  // Prioriza o alvo mais recente (o que está por cima).
  for (let i = state.targets.length - 1; i >= 0; i--) {
    const target = state.targets[i];
    if (target.hitAt !== undefined) continue;
    const dx = x - target.x;
    const dy = y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= target.r) {
      const remaining = Math.max(0, 1 - (now - target.born) / target.life);
      const precision = 1 - Math.min(1, distance / target.r);
      const speedBonus = Math.round(remaining * 60);
      const precisionBonus = Math.round(precision * 40);
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.hits += 1;
      state.reactionTotal += now - target.born;
      const points = 100 + speedBonus + precisionBonus + Math.min(150, state.combo * 5);
      state.score += points;
      target.hitAt = now;
      target.hitWindow = timingWindow(target, now);
      target.hitCombo = state.combo;
      pushEvent(state, { kind: 'hit', x, y, value: points, window: target.hitWindow, combo: state.combo, at: now });
      return { hit: true, points, target };
    }
  }
  state.misses += 1;
  state.combo = 0;
  pushEvent(state, { kind: 'miss', x, y, at: now });
  return { hit: false, points: 0 };
}

export function accuracy(state: AimState): number {
  const attempts = state.hits + state.misses + state.expired;
  if (attempts === 0) return 0;
  return (state.hits / attempts) * 100;
}

export function averageReaction(state: AimState): number {
  if (state.hits === 0) return 0;
  return Math.round(state.reactionTotal / state.hits);
}

export function aimsPerMinute(state: AimState): number {
  const elapsed = Math.max(1, state.now - state.startedAt);
  return Math.round((state.hits / elapsed) * 60000);
}

export function progress(state: AimState): number {
  const elapsed = Math.max(0, state.now - state.startedAt);
  return Math.min(100, (elapsed / state.durationMs) * 100);
}

/* ------------------------------------------------------------------ */
/* Rank e ranking                                                      */
/* ------------------------------------------------------------------ */

export interface RankGrade {
  grade: string;
  label: string;
  tint: string;
}

export function gradeOf(acc: number, score: number): RankGrade {
  if (acc >= 97 && score >= 9000) return { grade: 'SS', label: 'Impecável', tint: '#c8aa6e' };
  if (acc >= 93) return { grade: 'S', label: 'Cirúrgico', tint: '#f0d9a8' };
  if (acc >= 86) return { grade: 'A', label: 'Consistente', tint: '#3fbf9a' };
  if (acc >= 76) return { grade: 'B', label: 'Aquecendo', tint: '#5b8def' };
  if (acc >= 62) return { grade: 'C', label: 'Precisa treinar', tint: '#b07be0' };
  return { grade: 'D', label: 'Começando', tint: '#c14b4b' };
}

export interface LeaderboardRow {
  id: string;
  name: string;
  mode: AimMode;
  score: number;
  accuracy: number;
  apm: number;
  grade: string;
  hero?: boolean;
  at: string;
}

/** Ranking inicial da casa: dá alvo para bater, não é telemetria real. */
export const SEED_LEADERBOARD: LeaderboardRow[] = [
  { id: 'seed-1', name: 'Vitor', mode: 'flick', score: 14820, accuracy: 97.4, apm: 96, grade: 'SS', at: 'hoje' },
  { id: 'seed-2', name: 'Kaiô', mode: 'track', score: 11240, accuracy: 94.1, apm: 78, grade: 'S', at: 'ontem' },
  { id: 'seed-3', name: 'Duda', mode: 'flick', score: 9860, accuracy: 92.6, apm: 84, grade: 'S', at: 'ontem' },
  { id: 'seed-4', name: 'Nina', mode: 'precision', score: 8410, accuracy: 89.3, apm: 61, grade: 'A', at: '2 dias' },
  { id: 'seed-5', name: 'Rafa', mode: 'flick', score: 7180, accuracy: 84.8, apm: 72, grade: 'B', at: '3 dias' },
  { id: 'seed-6', name: 'Beto', mode: 'track', score: 5320, accuracy: 79.2, apm: 54, grade: 'B', at: '4 dias' },
];

export function insertScore(rows: LeaderboardRow[], row: LeaderboardRow): { rows: LeaderboardRow[]; position: number } {
  const next = [...rows, row].sort((a, b) => b.score - a.score);
  return { rows: next.slice(0, 25), position: next.findIndex((r) => r.id === row.id) + 1 };
}

export function bestOf(rows: LeaderboardRow[], name: string): LeaderboardRow | null {
  const mine = rows.filter((r) => r.name.toLowerCase() === name.toLowerCase()).sort((a, b) => b.score - a.score);
  return mine[0] ?? null;
}

export function toLeaderboardRow(
  state: AimState,
  name: string,
  id: string,
): LeaderboardRow {
  const acc = accuracy(state);
  return {
    id,
    name: name || 'Você',
    mode: state.mode,
    score: state.score,
    accuracy: Math.round(acc * 10) / 10,
    apm: aimsPerMinute(state),
    grade: gradeOf(acc, state.score).grade,
    hero: true,
    at: 'agora',
  };
}
