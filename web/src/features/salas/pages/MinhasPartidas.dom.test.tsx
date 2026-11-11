import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { AuthUser } from '../../../contexts/AuthContext';
import type { ApiLegacySala } from '../../../lib/api';
import MinhasPartidas from './MinhasPartidas';

const fixture = vi.hoisted(() => ({
  user: null as AuthUser | null,
  vip: false,
  minhas: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: fixture.user }) }));
vi.mock('../../../contexts/PerfilContext', () => ({ usePerfilSafe: () => ({ perfil: { isVip: fixture.vip } }) }));
vi.mock('../../../lib/api', () => ({ api: { matches: { minhas: fixture.minhas } } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => fixture.navigate }));

let view: { container: HTMLDivElement; root: Root } | undefined;

function identity(id = 'u'): AuthUser {
  return {
    id, email: 'fixture@example.invalid', isVip: false, roles: [],
    user_metadata: { full_name: 'Fixture', avatar_url: null },
  };
}

function room(id: number, user = 'u', sideA = true, winner = 'A', mode = '5v5'): ApiLegacySala {
  return {
    id, modo: mode, vencedor: winner, created_at: '2026-11-10T15:30:00Z',
    time_a_nome: 'Alpha', time_b_nome: 'Beta',
    jogadores: [
      { user_id: user, nome: 'Jogador fixture', is_time_a: sideA },
      { user_id: 'opponent', nome: 'Adversário fixture', is_time_a: !sideA },
    ],
  } as ApiLegacySala;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

async function render(strict = false) {
  if (!view) {
    const container = document.createElement('div');
    document.body.append(container);
    view = { container, root: createRoot(container) };
  }
  const { root, container } = view;
  await act(async () => {
    root.render(strict ? <StrictMode><MinhasPartidas /></StrictMode> : <MinhasPartidas />);
  });
  return container;
}

async function unmount() {
  if (!view) return;
  const { root, container } = view;
  view = undefined;
  try { await act(async () => { root.unmount(); }); }
  finally { container.remove(); }
}

function loading(container: HTMLElement) {
  return container.querySelectorAll('.animate-pulse').length;
}

beforeEach(() => {
  fixture.user = identity();
  fixture.vip = false;
  fixture.minhas.mockReset();
  fixture.navigate.mockReset();
});

afterEach(async () => {
  await unmount();
  expect(fetch).not.toHaveBeenCalled();
});

test('montagem consulta automaticamente, mostra histórico/estatísticas e preserva navegação', async () => {
  const response = deferred<ApiLegacySala[]>();
  fixture.minhas.mockReturnValue(response.promise);
  const container = await render();
  expect(fixture.minhas).toHaveBeenCalledExactlyOnceWith({ limit: 200 });
  expect(loading(container)).toBe(7);
  await act(async () => {
    response.resolve([room(101), room(102, 'u', false, 'B', 'aram'), room(103, 'u', false, 'A', '1v1')]);
  });
  expect(loading(container)).toBe(0);
  expect(Array.from(container.querySelectorAll('p')).map(p => p.textContent).filter(s => s?.startsWith('Sala #')))
    .toEqual(['Sala #101', 'Sala #102', 'Sala #103']);
  expect(Array.from(container.querySelectorAll('p.text-4xl')).map(p => p.textContent)).toEqual(['3', '2', '1']);
  expect(container.textContent).toContain('67% Win Rate');
  expect(container.textContent).toContain('ARAM');
  expect(container.textContent).toContain('1v1');
  const label = Array.from(container.querySelectorAll('p')).find(p => p.textContent === 'Sala #101');
  const card = label?.closest<HTMLElement>('.cursor-pointer');
  expect(card).toBeTruthy();
  await act(async () => { card!.click(); });
  expect(fixture.navigate).toHaveBeenCalledWith('/sala/101');
});

test('resposta vazia encerra loading e mostra o estado vazio', async () => {
  fixture.minhas.mockResolvedValue([]);
  const container = await render();
  expect(fixture.minhas).toHaveBeenCalledExactlyOnceWith({ limit: 200 });
  expect(loading(container)).toBe(0);
  expect(container.textContent).toContain('Sua jornada começa aqui');
});

test('erro preserva o registro existente e encerra loading', async () => {
  const error = new Error('falha fixture');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  fixture.minhas.mockRejectedValue(error);
  const container = await render();
  expect(log).toHaveBeenCalledWith('[MinhasPartidas] erro ao carregar histórico:', error);
  expect(loading(container)).toBe(0);
  expect(container.textContent).toContain('Sua jornada começa aqui');
});

test('aguarda identidade disponível antes de consultar', async () => {
  fixture.user = null;
  fixture.minhas.mockResolvedValue([room(101)]);
  const container = await render();
  expect(fixture.minhas).not.toHaveBeenCalled();
  fixture.user = identity();
  await render();
  expect(fixture.minhas).toHaveBeenCalledExactlyOnceWith({ limit: 200 });
  expect(container.textContent).toContain('Sala #101');
  expect(loading(container)).toBe(0);
});

test('não consulta sem identidade mesmo após rerender', async () => {
  fixture.user = null;
  await render();
  await render();
  expect(fixture.minhas).not.toHaveBeenCalled();
});

test.each([false, true])('VIP %s só controla o selo e não bloqueia carga', async vip => {
  fixture.vip = vip;
  fixture.minhas.mockResolvedValue([room(101)]);
  const container = await render();
  expect(fixture.minhas).toHaveBeenCalledExactlyOnceWith({ limit: 200 });
  expect(container.textContent).toContain('Sala #101');
  expect(container.textContent!.includes('VIP Ativo')).toBe(vip);
});

test('rerender, perfil e novo objeto de mesma identidade não repetem consulta', async () => {
  fixture.minhas.mockResolvedValue([room(101)]);
  await render();
  await render();
  fixture.vip = true;
  await render();
  fixture.user = { ...identity(), user_metadata: { full_name: 'Outro nome', avatar_url: null } };
  await render();
  expect(fixture.minhas).toHaveBeenCalledTimes(1);
});

test('nova montagem carrega novamente', async () => {
  fixture.minhas.mockResolvedValue([room(101)]);
  await render();
  await unmount();
  const container = await render();
  expect(fixture.minhas).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Sala #101');
});

test('resposta após unmount é descartada antes do mapeamento', async () => {
  const response = deferred<ApiLegacySala[]>();
  fixture.minhas.mockReturnValue(response.promise);
  const container = await render();
  expect(fixture.minhas).toHaveBeenCalledTimes(1);
  await unmount();
  const rows = [room(101)];
  const map = vi.spyOn(rows, 'map');
  await act(async () => { response.resolve(rows); });
  expect(map).not.toHaveBeenCalled();
  expect(container.textContent).toBe('');
});

test('resposta da identidade antiga não sobrescreve a identidade nova', async () => {
  const old = deferred<ApiLegacySala[]>();
  const current = deferred<ApiLegacySala[]>();
  fixture.minhas.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const container = await render();
  fixture.user = identity('other');
  await render();
  expect(fixture.minhas).toHaveBeenCalledTimes(2);
  await act(async () => { current.resolve([room(201, 'other')]); });
  expect(container.textContent).toContain('Sala #201');
  const oldRows = [room(101)];
  const map = vi.spyOn(oldRows, 'map');
  await act(async () => { old.resolve(oldRows); });
  expect(map).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Sala #201');
  expect(container.textContent).not.toContain('Sala #101');
  expect(loading(container)).toBe(0);
});

test('falha antiga não encerra loading da identidade atual', async () => {
  const old = deferred<ApiLegacySala[]>();
  const current = deferred<ApiLegacySala[]>();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  fixture.minhas.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const container = await render();
  fixture.user = identity('other');
  await render();
  const error = new Error('falha antiga fixture');
  await act(async () => { old.reject(error); });
  expect(log).toHaveBeenCalledWith('[MinhasPartidas] erro ao carregar histórico:', error);
  expect(loading(container)).toBe(7);
  await act(async () => { current.resolve([]); });
  expect(loading(container)).toBe(0);
});

test('StrictMode descarta o primeiro efeito e permite a carga da montagem válida', async () => {
  const old = deferred<ApiLegacySala[]>();
  const current = deferred<ApiLegacySala[]>();
  fixture.minhas.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const container = await render(true);
  expect(fixture.minhas).toHaveBeenCalledTimes(2);
  const oldRows = [room(101)];
  const map = vi.spyOn(oldRows, 'map');
  await act(async () => { old.resolve(oldRows); });
  expect(map).not.toHaveBeenCalled();
  expect(loading(container)).toBe(7);
  await act(async () => { current.resolve([room(201)]); });
  expect(container.textContent).toContain('Sala #201');
  expect(loading(container)).toBe(0);
});
