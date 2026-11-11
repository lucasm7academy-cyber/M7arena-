import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

export function fixture() {
  const temporary = fs.realpathSync(os.tmpdir());
  const base = fs.mkdtempSync(path.join(temporary, 'm7-graph-rag-'));
  const root = path.join(base, 'repo'), cache = path.join(base, 'cache');
  fs.mkdirSync(root);
  const write = (rel, content) => {
    const target = path.resolve(root, rel);
    assert(target.startsWith(root + path.sep));
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content);
  };
  write('package.json', '{"type":"module"}');
  write('web/tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext',
    moduleResolution: 'Bundler', baseUrl: '.', paths: { '@/*': ['./src/*'] }, noLib: true } }));
  write('api/tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', noLib: true } }));
  write('web/src/shared.ts', 'export function shared() { return 7; }\nexport function clash() { return 1; }\n');
  write('web/src/types.ts', 'export interface Data { id: string }\n');
  write('web/src/mixed.ts', 'export interface Item { id: number }\nexport const mix = 1;\n');
  write('web/src/lazy.ts', 'export const later = 2;\n');
  write('web/src/features/alpha/main.ts', [
    "import './theme.css';",
    "import { shared as local } from '@/shared';",
    "import type { Data } from '../../types.js';",
    "import { type Item, mix } from '../../mixed';",
    'export const alpha = local() + mix;',
    'export default function Main() { return alpha; }',
    'export { local as forwarded };',
    "export const lazy = () => import('../../lazy.js');",
    'declare const dynamicName: string;',
    'export const unknown = () => import(dynamicName);',
  ].join('\n'));
  write('web/src/features/alpha/theme.css', 'SENSITIVE_CANARY_DO_NOT_INDEX');
  write('web/src/features/alpha/barrel.ts', "export { shared as exposed } from '../../shared.js';\nexport * from '../../types';\nexport { default as Main } from './main';\n");
  write('web/src/features/beta/other.ts', 'export function clash() { return 2; }\n');
  write('web/src/features/alpha/README.md', '# Alpha — inscrição\n\n## Entradas\n\n[Inscrição Alpha](main.ts) e [contrato](../../shared.ts).\n');
  write('api/src/use.ts', "import { row } from '../../db/schema/entity.js';\nexport const apiValue = row;\n");
  write('api/test/use.test.ts', "import { apiValue } from '../src/use.js';\nexport const observed = apiValue;\n");
  write('db/schema/entity.ts', 'export const row = { id: 1 };\n');
  write('docs/INDEX.md', '# Índice\n\n[Módulos](modules/INDEX.md).\n');
  write('docs/modules/INDEX.md', '# Módulos\n\n[Alpha](../../web/src/features/alpha/README.md).\n');
  for (const name of ['web/src/.env.ts', 'web/src/credentials.ts', 'web/src/assets/hidden.ts',
    'web/src/dist/hidden.ts', 'web/src/node_modules/hidden.ts', 'mcp/old.ts', 'docs/historico/README.md', 'statusdoprojeto.md']) {
    write(name, 'SENSITIVE_CANARY_DO_NOT_INDEX');
  }
  return { root, cache, base, write, cleanup() {
    // Delete somente o diretório descartável criado neste helper.
    const resolved = fs.realpathSync(base);
    assert.equal(path.dirname(resolved), temporary);
    assert(path.basename(resolved).startsWith('m7-graph-rag-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  } };
}
