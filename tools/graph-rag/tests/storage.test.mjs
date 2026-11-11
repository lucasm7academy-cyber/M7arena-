import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { construct } from '../indexer.mjs';
import { publish, load, freshness, cacheDirectory } from '../storage.mjs';
import { queryGraph, contextGraph } from '../search.mjs';
import { fixture } from './fixtures.mjs';

test('publica JSONL validado e detecta conteúdo modificado sem depender de HEAD', () => {
  const f = fixture();
  try {
    const first = publish(construct(f.root), f.cache), loaded = load(f.root, f.cache);
    assert.equal(loaded.manifest.generation, first.manifest.generation);
    assert.equal(freshness(loaded).stale, false);
    f.write('web/src/shared.ts', 'export function shared() { return 99; }\n');
    assert.deepEqual(freshness(loaded).modified, ['web/src/shared.ts']);
    assert.throws(() => queryGraph(loaded, 'shared'), e => e.code === 'INDEX_STALE');
    assert.throws(() => contextGraph(loaded, 'shared'), e => e.code === 'INDEX_STALE');
    const updated = publish(construct(f.root), f.cache);
    assert.notEqual(updated.manifest.generation, first.manifest.generation);
    assert.equal(freshness(updated).stale, false);
  } finally { f.cleanup(); }
});

test('detecta novos arquivos, remoção, renomeação e configuração alterada', () => {
  const f = fixture();
  try {
    let graph = publish(construct(f.root), f.cache);
    f.write('web/src/new.ts', 'export const created = 1;\n');
    assert.deepEqual(freshness(graph).added, ['web/src/new.ts']);
    graph = publish(construct(f.root), f.cache);
    fs.renameSync(path.join(f.root, 'web/src/new.ts'), path.join(f.root, 'web/src/renamed.ts'));
    const renamed = freshness(graph);
    assert.deepEqual(renamed.added, ['web/src/renamed.ts']);
    assert.deepEqual(renamed.removed, ['web/src/new.ts']);
    graph = publish(construct(f.root), f.cache);
    fs.unlinkSync(path.join(f.root, 'web/src/renamed.ts'));
    assert.deepEqual(freshness(graph).removed, ['web/src/renamed.ts']);
    graph = publish(construct(f.root), f.cache);
    f.write('web/tsconfig.json', '{"compilerOptions":{"moduleResolution":"Bundler","module":"ESNext","noLib":true}}');
    assert(freshness(graph).configurations.includes('web/tsconfig.json'));
    assert.equal(freshness(graph).stale, true);
  } finally { f.cleanup(); }
});

test('recusa cache corrompido e pointer com travessia de diretórios', () => {
  const f = fixture();
  try {
    const graph = publish(construct(f.root), f.cache);
    const generation = path.join(f.cache, 'generations', graph.manifest.generation);
    fs.appendFileSync(path.join(generation, 'nodes.jsonl'), '{invalid}\n');
    assert.throws(() => load(f.root, f.cache), e => e.code === 'CACHE_INVALID');
    fs.writeFileSync(path.join(f.cache, 'current.json'), '{"generation":"../../outside"}');
    assert.throws(() => load(f.root, f.cache), e => e.code === 'CACHE_INVALID');
  } finally { f.cleanup(); }
});

test('falha antes da publicação preserva geração anterior e libera lock próprio', () => {
  const f = fixture();
  try {
    const first = publish(construct(f.root), f.cache);
    f.write('web/src/lazy.ts', 'export const later = 55;\n');
    const next = construct(f.root);
    assert.throws(() => publish(next, f.cache, { onStaged() { throw new Error('fixture interruption'); } }), /fixture interruption/);
    assert.equal(load(f.root, f.cache).manifest.generation, first.manifest.generation);
    assert(!fs.existsSync(path.join(f.cache, 'build.lock')));
    assert(fs.readdirSync(path.join(f.cache, 'generations')).some(n => n.startsWith('.building-')));
    assert.equal(publish(next, f.cache).manifest.generation, next.manifest.generation);
  } finally { f.cleanup(); }
});

test('não escreve cache no repositório ou em seu ancestral; respeita lock existente', () => {
  const f = fixture();
  try {
    assert.throws(() => cacheDirectory(f.root, path.join(f.root, 'cache')), e => e.code === 'CACHE_LOCATION_INVALID');
    assert.throws(() => cacheDirectory(f.root, f.base), e => e.code === 'CACHE_LOCATION_INVALID');
    fs.mkdirSync(f.cache); fs.writeFileSync(path.join(f.cache, 'build.lock'), 'owned by another writer');
    assert.throws(() => publish(construct(f.root), f.cache), e => e.code === 'CACHE_BUSY');
    assert.equal(fs.readFileSync(path.join(f.cache, 'build.lock'), 'utf8'), 'owned by another writer');
    assert(!fs.existsSync(path.join(f.cache, 'current.json')));
  } finally { f.cleanup(); }
});

test('não escreve por junction/symlink na subpasta de gerações', t => {
  const f = fixture();
  try {
    const outside = path.join(f.base, 'outside');
    fs.mkdirSync(outside); fs.mkdirSync(f.cache);
    try { fs.symlinkSync(outside, path.join(f.cache, 'generations'), 'junction'); }
    catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Host não permite criar link descartável'); return; } throw error; }
    assert.throws(() => publish(construct(f.root), f.cache), e => e.code === 'CACHE_INVALID');
    assert.deepEqual(fs.readdirSync(outside), []);
  } finally { f.cleanup(); }
});
