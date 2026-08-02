'use client';

import { useCallback } from 'react';

const SOUNDS = {
  click: '/sounds/click.mp3',
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
} as const;

export function useSound() {
  const playSound = useCallback((type: keyof typeof SOUNDS = 'click') => {
    try {
      const audio = new Audio(SOUNDS[type]);
      audio.volume = 0.4;
      // O navegador bloqueia autoplay antes da primeira interação — silencioso por design.
      audio.play().catch(() => {});
    } catch {
      /* som é enfeite; nunca deve quebrar a navegação */
    }
  }, []);

  return { playSound };
}
