import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  accuracy,
  aimsPerMinute,
  averageReaction,
  createAimState,
  difficultyAt,
  gradeOf,
  hitTest,
  dragHit,
  progress,
  startAim,
  tick,
} from '../domain/engine';
import type { AimMode, AimState, RankGrade } from '../domain/engine';
import { drawAimScene } from '../components/drawAim';
import type { AimPointer } from '../components/drawAim';
import { api } from '../../../lib/api';

/** Duração de uma rodada. O servidor recebe este valor junto da nota. */
export const AIM_ROUND_MS = 30_000;

export type AimPhase = 'idle' | 'playing' | 'finished';

/** Números que o HUD mostra: publicados a ~4 Hz, nunca a cada frame. */
export interface AimHud {
  score: number;
  combo: number;
  bestCombo: number;
  accuracy: number;
  apm: number;
  progress: number;
  remainingMs: number;
  difficulty: number;
  hits: number;
  misses: number;
  expired: number;
}

export interface AimRoundResult {
  mode: AimMode;
  score: number;
  accuracy: number;
  apm: number;
  bestCombo: number;
  hits: number;
  misses: number;
  expired: number;
  reaction: number;
  durationMs: number;
  grade: RankGrade;
}

export type AimSubmitStatus = 'idle' | 'skipped' | 'sending' | 'saved' | 'error';

export interface AimSubmit {
  status: AimSubmitStatus;
  position: number | null;
  message: string | null;
}

interface UseAimGameOptions {
  mode: AimMode;
  /** Só quem tem sessão envia nota; visitante joga e vê o ranking público. */
  canSubmit: boolean;
  /** Chamado depois que o servidor aceita a nota (para o ranking recarregar). */
  onSaved?: () => void;
}

const HUD_INTERVAL_MS = 240;

function hudFrom(state: AimState): AimHud {
  return {
    score: state.score,
    combo: state.combo,
    bestCombo: state.bestCombo,
    accuracy: Math.round(accuracy(state) * 10) / 10,
    apm: aimsPerMinute(state),
    progress: progress(state),
    remainingMs: Math.max(0, state.durationMs - Math.max(0, state.now - state.startedAt)),
    difficulty: difficultyAt(state),
    hits: state.hits,
    misses: state.misses,
    expired: state.expired,
  };
}

/** Empurra o relógio do motor: usado para pausar quando a aba fica escondida. */
function shiftClock(state: AimState, deltaMs: number): void {
  if (deltaMs <= 0) return;
  state.startedAt += deltaMs;
  state.now += deltaMs;
  for (const target of state.targets) {
    target.born += deltaMs;
    if (target.hitAt !== undefined && target.hitAt > 0) target.hitAt += deltaMs;
  }
  for (const event of state.lastEvents) event.at += deltaMs;
}

/**
 * Dono do ciclo de vida da rodada: estado do motor em `ref`, loop de
 * `requestAnimationFrame`, canvas responsivo (devicePixelRatio), HUD a ~4 Hz e
 * envio da nota ao servidor. O React só re-renderiza em eventos.
 */
export function useAimGame({ mode, canSubmit, onSaved }: UseAimGameOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<AimState>(
    createAimState({ mode, width: 960, height: 540, durationMs: AIM_ROUND_MS }),
  );
  const pointerRef = useRef<AimPointer>({ x: 0, y: 0, active: false });
  const lastHudRef = useRef(0);
  const pausedAtRef = useRef(0);
  const resultRef = useRef<AimRoundResult | null>(null);
  const canSubmitRef = useRef(canSubmit);
  const onSavedRef = useRef(onSaved);
  const mountedRef = useRef(true);

  const [phase, setPhase] = useState<AimPhase>('idle');
  const [hud, setHud] = useState<AimHud>(() => hudFrom(stateRef.current));
  const [result, setResult] = useState<AimRoundResult | null>(null);
  const [submit, setSubmit] = useState<AimSubmit>({ status: 'idle', position: null, message: null });

  useEffect(() => {
    canSubmitRef.current = canSubmit;
  }, [canSubmit]);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(
    () => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        stateRef.current.running = false;
      };
    },
    [],
  );

  /** Ajusta o bitmap do canvas ao tamanho real (CSS px × DPR) e ao estado do motor. */
  const syncSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const state = stateRef.current;
    state.width = width;
    state.height = height;
    for (const target of state.targets) {
      const pad = target.r + 4;
      target.x = Math.min(Math.max(target.x, pad), Math.max(pad, width - pad));
      target.y = Math.min(Math.max(target.y, pad), Math.max(pad, height - pad));
    }
  }, []);

  const paint = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = stateRef.current;
    const scale = canvas.width / Math.max(1, state.width);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawAimScene(ctx, state, now, pointerRef.current);
  }, []);

  const publishHud = useCallback((force = false) => {
    const now = performance.now();
    if (!force && now - lastHudRef.current < HUD_INTERVAL_MS) return;
    lastHudRef.current = now;
    setHud(hudFrom(stateRef.current));
  }, []);

  const submitRound = useCallback(async (round: AimRoundResult) => {
    if (!canSubmitRef.current) {
      if (mountedRef.current) setSubmit({ status: 'skipped', position: null, message: null });
      return;
    }

    if (mountedRef.current) setSubmit({ status: 'sending', position: null, message: null });
    try {
      const response = await api.aim.submitScore({
        mode: round.mode,
        score: round.score,
        accuracy: Math.round(round.accuracy * 10) / 10,
        apm: round.apm,
        combo: round.bestCombo,
        durationMs: round.durationMs,
      });
      if (!mountedRef.current) return;
      if (response && response.ok === false) {
        setSubmit({
          status: 'error',
          position: null,
          message: response.erro ?? 'O servidor não aceitou a nota.',
        });
        return;
      }
      setSubmit({ status: 'saved', position: response?.position ?? null, message: null });
      onSavedRef.current?.();
    } catch (error) {
      if (!mountedRef.current) return;
      const raw = error instanceof Error ? error.message : '';
      if (raw === 'nao_autenticado') {
        // Sessão caiu entre a rodada e o envio: vale o mesmo convite do visitante.
        setSubmit({ status: 'skipped', position: null, message: null });
        return;
      }
      setSubmit({
        status: 'error',
        position: null,
        message:
          raw === 'dados_invalidos'
            ? 'A rodada não passou na validação do servidor.'
            : raw || 'Não foi possível enviar a nota.',
      });
    }
  }, []);

  const finish = useCallback(() => {
    const state = stateRef.current;
    const acc = accuracy(state);
    const round: AimRoundResult = {
      mode: state.mode,
      score: state.score,
      accuracy: Math.round(acc * 10) / 10,
      apm: aimsPerMinute(state),
      bestCombo: state.bestCombo,
      hits: state.hits,
      misses: state.misses,
      expired: state.expired,
      reaction: averageReaction(state),
      durationMs: state.durationMs,
      grade: gradeOf(acc, state.score),
    };
    resultRef.current = round;
    pointerRef.current.active = false;
    setResult(round);
    setPhase('finished');
    publishHud(true);
    void submitRound(round);
  }, [publishHud, submitRound]);

  /** Loop único da rodada. Encerra sozinho quando o motor para ou a fase muda. */
  useEffect(() => {
    if (phase !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    lastHudRef.current = 0;

    const frame = (now: number) => {
      const state = stateRef.current;
      if (document.hidden) {
        // Sem tick enquanto a aba está escondida: o relógio é corrigido no retorno.
        last = now;
        raf = requestAnimationFrame(frame);
        return;
      }
      tick(state, now, now - last);
      const pointer = pointerRef.current;
      if (pointer.pressed && pointer.active) dragHit(state, pointer.x, pointer.y, now);
      last = now;
      paint(now);
      if (!state.running) {
        finish();
        return;
      }
      publishHud();
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, finish, paint, publishHud]);

  /** Pausa de fato: ao voltar para a aba, desloca o relógio do motor. */
  useEffect(() => {
    if (phase !== 'playing') return;
    const onVisibility = () => {
      if (document.hidden) {
        pointerRef.current.pressed = false;
        pausedAtRef.current = performance.now();
        return;
      }
      const pausedAt = pausedAtRef.current;
      pausedAtRef.current = 0;
      if (!pausedAt) return;
      shiftClock(stateRef.current, performance.now() - pausedAt);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase]);

  /** Canvas responsivo: mede no mount, em cada resize real e a cada rodada. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncSize();
    paint(performance.now());

    const observer = new ResizeObserver(() => {
      syncSize();
      paint(performance.now());
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [phase, paint, syncSize]);

  /** Trocar de modo só é possível fora da rodada; reinicia a apresentação. */
  useEffect(() => {
    const state = stateRef.current;
    if (state.running) return;
    stateRef.current = createAimState({
      mode,
      width: state.width,
      height: state.height,
      durationMs: AIM_ROUND_MS,
    });
    setPhase('idle');
    setResult(null);
    resultRef.current = null;
    setSubmit({ status: 'idle', position: null, message: null });
    publishHud(true);
    paint(performance.now());
  }, [mode, paint, publishHud]);

  const start = useCallback(() => {
    const state = stateRef.current;
    state.mode = mode;
    state.durationMs = AIM_ROUND_MS;
    startAim(state, performance.now());
    pointerRef.current.active = false;
    pointerRef.current.pressed = false;
    pointerRef.current.trail = [];
    resultRef.current = null;
    setResult(null);
    setSubmit({ status: 'idle', position: null, message: null });
    setPhase('playing');
    publishHud(true);
  }, [mode, publishHud]);

  const dismissResult = useCallback(() => {
    const state = stateRef.current;
    if (state.running) return;
    stateRef.current = createAimState({
      mode: state.mode,
      width: state.width,
      height: state.height,
      durationMs: AIM_ROUND_MS,
    });
    setPhase('idle');
    setResult(null);
    setSubmit({ status: 'idle', position: null, message: null });
    publishHud(true);
    paint(performance.now());
  }, [paint, publishHud]);

  const retrySubmit = useCallback(() => {
    const round = resultRef.current;
    if (round) void submitRound(round);
  }, [submitRound]);

  const toArenaPoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * state.width,
      y: ((event.clientY - rect.top) / rect.height) * state.height,
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const state = stateRef.current;
      const point = toArenaPoint(event);
      if (!point || !state.running || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerRef.current = { ...point, active: true, pressed: true, trail: [] };
      (state.mode === 'track' ? dragHit : hitTest)(state, point.x, point.y, performance.now());
      publishHud(true);
      paint(performance.now());
    },
    [paint, publishHud, toArenaPoint],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const point = toArenaPoint(event);
      if (!point) return;
      const state = stateRef.current;
      const pointer = pointerRef.current;
      const now = performance.now();
      // Varre o segmento, não apenas o último ponto: movimentos rápidos não
      // atravessam um alvo sem tocá-lo. Cada alvo só pode ser resolvido uma vez.
      if (state.running && pointer.pressed && (event.buttons & 1)) {
        const steps = Math.min(160, Math.max(1, Math.ceil(Math.hypot(point.x - pointer.x, point.y - pointer.y) / 4)));
        for (let i = 1; i <= steps; i++) {
          dragHit(state, pointer.x + (point.x - pointer.x) * i / steps, pointer.y + (point.y - pointer.y) * i / steps, now);
        }
      }
      pointerRef.current = {
        ...point, active: true, pressed: pointer.pressed && Boolean(event.buttons & 1),
        trail: [...(pointer.trail ?? []).filter((p) => now - p.at < 220), { ...point, at: now }].slice(-40),
      };
      if (!state.running) paint(performance.now());
    },
    [paint, toArenaPoint],
  );

  const handlePointerLeave = useCallback(() => {
    pointerRef.current.active = false;
    pointerRef.current.pressed = false;
    if (!stateRef.current.running) paint(performance.now());
  }, [paint]);

  return {
    canvasRef,
    phase,
    hud,
    result,
    submit,
    start,
    retrySubmit,
    dismissResult,
    handlePointerDown,
    handlePointerMove,
    handlePointerLeave,
    handlePointerUp: () => { pointerRef.current.pressed = false; },
  };
}
