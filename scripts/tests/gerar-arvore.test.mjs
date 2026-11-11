import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateTree, checkTree, updateTree } from '../gerar-arvore.mjs';

function fixture(t) {
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  const parent = fs.mkdtempSync(path.join(temporaryRoot, 'm7-arvore-'));
  const root = path.join(parent, 'M7Arena');
  fs.mkdirSync(root);
  t.after(() => {
    const target = fs.realpathSync(parent);
    assert.equal(path.dirname(target), temporaryRoot);
    assert(path.basename(target).startsWith('m7-arvore-'));
    fs.rmSync(target, { recursive: true, force: true });
  });
  const write = (relative, value = '') => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  };
  return { root, write };
}

test('estrutura real, diretórios primeiro, ordenação fixa, UTF-8 e arquivos novos sem Git', t => {
  const { root, write } = fixture(t);
  write('z.ts'); write('a.ts'); write('pasta/README.md'); write('pasta/sub/ação.ts');
  fs.mkdirSync(path.join(root, 'vazia'));
  assert.equal(generateTree(root), [
    'M7Arena/', '├── pasta/', '│   ├── sub/', '│   │   └── ação.ts',
    '│   └── README.md', '├── vazia/', '├── a.ts', '└── z.ts', '',
  ].join('\n'));
});

test('primeira geração inclui a própria saída e repetição não regrava o arquivo', t => {
  const { root, write } = fixture(t);
  write('src/app.ts');
  assert.equal(updateTree(root), true);
  const output = path.join(root, 'docs/ARVORE.txt');
  assert.match(fs.readFileSync(output, 'utf8'), /ARVORE\.txt/);
  assert.equal(checkTree(root), true);
  const fixedTime = new Date('2000-01-01T00:00:00Z');
  fs.utimesSync(output, fixedTime, fixedTime);
  const before = fs.statSync(output).mtimeMs;
  assert.equal(updateTree(root), false);
  assert.equal(fs.statSync(output).mtimeMs, before);
});

test('criação, remoção, renomeação e movimento tornam a árvore desatualizada', t => {
  const { root, write } = fixture(t);
  updateTree(root);
  write('origem/novo.ts');
  assert.equal(checkTree(root), false);
  updateTree(root);
  assert.match(generateTree(root), /novo\.ts/);
  fs.renameSync(path.join(root, 'origem/novo.ts'), path.join(root, 'origem/renomeado.ts'));
  assert.equal(checkTree(root), false);
  updateTree(root);
  fs.mkdirSync(path.join(root, 'destino'));
  fs.renameSync(path.join(root, 'origem/renomeado.ts'), path.join(root, 'destino/renomeado.ts'));
  assert.equal(checkTree(root), false);
  updateTree(root);
  assert.match(generateTree(root), /destino\/\n│   └── renomeado\.ts/);
  fs.unlinkSync(path.join(root, 'destino/renomeado.ts'));
  assert.equal(checkTree(root), false);
  updateTree(root);
  assert.doesNotMatch(generateTree(root), /novo\.ts|renomeado\.ts/);
  assert.equal(checkTree(root), true);
});

test('mudança de conteúdo não exige atualização; modo de verificação não escreve', t => {
  const { root, write } = fixture(t);
  assert.equal(checkTree(root), false);
  assert.equal(fs.existsSync(path.join(root, 'docs')), false);
  write('src/app.ts', 'antes'); updateTree(root);
  const output = path.join(root, 'docs/ARVORE.txt');
  const before = fs.readFileSync(output);
  write('src/app.ts', 'depois');
  assert.equal(checkTree(root), true);
  write('src/new.ts');
  assert.equal(checkTree(root), false);
  assert.deepEqual(fs.readFileSync(output), before);
});

test('ignora artefatos em qualquer nível e mantém configurações, assets e migrations', t => {
  const { root, write } = fixture(t);
  for (const folder of ['.git', 'node_modules', 'dist', 'build', 'coverage', '.cache',
    '.vite', 'vendor', 'tmp', 'uploads', 'logs', '.codex', 'backup']) {
    write(`${folder}/invisivel.txt`); write(`api/${folder}/invisivel.txt`);
  }
  for (const file of ['.env', '.env.local', 'state.tmp', 'out.log', 'tsconfig.tsbuildinfo',
    'dump.sql.gz', '.DS_Store', 'optimize-images-result.json']) write(file);
  for (const file of ['.env.example', '.github/workflows/ci.yml', 'db/migrations/0001.sql',
    'db/migrations/meta/0001_snapshot.json', 'web/public/images/logo.webp', 'package-lock.json']) write(file);
  const tree = generateTree(root);
  assert.doesNotMatch(tree, /invisivel|\.env\.local|state\.tmp|out\.log|tsbuildinfo|dump\.sql|DS_Store|optimize-images-result/);
  for (const file of ['.env.example', '.github/', '0001.sql', '0001_snapshot.json', 'logo.webp', 'package-lock.json']) assert(tree.includes(file), file);
});

test('CLI usa a raiz do script, --check retorna 1/0 sem escrita e recusa argumentos inválidos', t => {
  const { root, write } = fixture(t);
  write('scripts/gerar-arvore.mjs', fs.readFileSync(fileURLToPath(new URL('../gerar-arvore.mjs', import.meta.url))));
  const script = path.join(root, 'scripts/gerar-arvore.mjs');
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.equal(run('--check').status, 1);
  assert.equal(fs.existsSync(path.join(root, 'docs')), false);
  assert.equal(run().status, 0);
  assert.equal(run('--check').status, 0);
  write('novo.ts');
  const before = fs.readFileSync(path.join(root, 'docs/ARVORE.txt'));
  assert.equal(run('--check').status, 1);
  assert.deepEqual(fs.readFileSync(path.join(root, 'docs/ARVORE.txt')), before);
  assert.equal(run('--invalid').status, 2);
});

test('mostra links como folhas, sem seguir o alvo ou escrever saída através de um link', t => {
  const { root, write } = fixture(t);
  const outside = path.join(path.dirname(root), 'outside');
  fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'externo.txt'), '');
  fs.symlinkSync(outside, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.match(generateTree(root), /└── link\n/);
  assert.doesNotMatch(generateTree(root), /externo\.txt/);
  fs.symlinkSync(outside, path.join(root, 'docs'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => updateTree(root), /Destino não pode ser link/);
  assert.equal(fs.existsSync(path.join(outside, 'ARVORE.txt')), false);
});
