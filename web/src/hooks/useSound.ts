import { useCallback } from 'react';

const SOUNDS = {
  click: '/sounds/click.mp3',
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
};

export function useSound() {
  const playSound = useCallback((type: 'click' | 'success' | 'error' = 'click') => {
    try {
      const audio = new Audio(SOUNDS[type]);
      audio.volume = 0.4;
      audio.play().catch(() => {
        // Navegador pode bloquear autoplay
      });
    } catch (e) {
      // Ignora erros
    }
  }, []);

  return { playSound };
}