import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('Rede bloqueada nos testes DOM; simule o SDK.');
  }));
  vi.stubGlobal('WebSocket', class {
    constructor() {
      throw new Error('WebSocket bloqueado nos testes DOM.');
    }
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
