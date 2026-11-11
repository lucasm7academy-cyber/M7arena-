import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({ api: { auth: { me: vi.fn() } } }));

test('monta React, executa efeitos, simula SDK/timers e limpa ao desmontar', async () => {
  vi.useFakeTimers();
  vi.mocked(api.auth.me).mockResolvedValue({ user: null });
  const cleanup = vi.fn();
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let mounted = true;

  function Probe() {
    const [ready, setReady] = useState(false);
    const [ticks, setTicks] = useState(0);
    useEffect(() => {
      let active = true;
      void api.auth.me().then(() => { if (active) setReady(true); });
      const timer = setInterval(() => setTicks(value => value + 1), 1000);
      return () => {
        active = false;
        clearInterval(timer);
        cleanup();
      };
    }, []);
    return <output>{ready ? 'pronto' : 'carregando'}:{ticks}</output>;
  }

  try {
    await act(async () => { root.render(<Probe />); });
    expect(container.textContent).toBe('pronto:0');
    expect(api.auth.me).toHaveBeenCalledExactlyOnceWith();
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(container.textContent).toBe('pronto:2');
    await act(async () => { root.render(<Probe />); });
    expect(api.auth.me).toHaveBeenCalledTimes(1);
    await act(async () => { root.unmount(); });
    mounted = false;
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(container.textContent).toBe('');
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(cleanup).toHaveBeenCalledTimes(1);
  } finally {
    if (mounted) await act(async () => { root.unmount(); });
    container.remove();
  }
});

test('bloqueia fetch e WebSocket reais no ambiente de testes', async () => {
  await expect(fetch('http://localhost/fixture')).rejects.toThrow('Rede bloqueada');
  expect(() => new WebSocket('ws://localhost/fixture')).toThrow('WebSocket bloqueado');
});
