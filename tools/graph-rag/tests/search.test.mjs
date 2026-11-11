import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { construct } from '../indexer.mjs';
import { publish } from '../storage.mjs';
import { queryGraph, contextGraph } from '../search.mjs';
import { fixture } from './fixtures.mjs';

test('consulta nome, caminho, símbolo, heading e alias documental explícito', () => {
  const f = fixture();
  try {
    const graph = publish(construct(f.root), f.cache);
    const symbols = queryGraph(graph, 'clash').results.filter(n => n.kind === 'Symbol' && n.name === 'clash');
    assert.equal(symbols.length, 2); assert.notEqual(symbols[0].path, symbols[1].path);
    const result = queryGraph(graph, 'inscrição alpha');
    assert(result.results.some(n => n.path === 'web/src/features/alpha/README.md'));
    assert(result.results.some(n => n.path === 'web/src/features/alpha/main.ts'));
    assert(queryGraph(graph, 'file:web/src/shared.ts').results[0].id === 'file:web/src/shared.ts');
  } finally { f.cleanup(); }
});

test('contexto percorre relações diretas/reversas e devolve trechos rastreáveis', () => {
  const f = fixture();
  try {
    const graph = publish(construct(f.root), f.cache);
    const direct = contextGraph(graph, 'file:web/src/features/alpha/main.ts', { files: 8, lines: 100, bytes: 30000, hops: 1 });
    assert(direct.snippets.some(s => s.path === 'web/src/shared.ts'));
    const reverse = contextGraph(graph, 'file:web/src/shared.ts', { files: 8, lines: 100, bytes: 30000, hops: 1 });
    assert(reverse.snippets.some(s => s.path === 'web/src/features/alpha/main.ts' && s.via.some(v => v.direction === 'reverse')));
    assert(reverse.relations.some(e => e.type === 'IMPORTS'));
    for (const snippet of reverse.snippets) {
      const lines = fs.readFileSync(path.join(f.root, snippet.path), 'utf8').split(/\r?\n/);
      assert.equal(snippet.text, lines.slice(snippet.startLine - 1, snippet.endLine).join('\n'));
      assert.equal(snippet.hash, graph.manifest.sourceHashes[snippet.path]);
      for (const step of snippet.via) assert(step.evidence.length > 0);
    }
    assert.equal(reverse.metrics.outputBytes, Buffer.byteLength(JSON.stringify(reverse)));
  } finally { f.cleanup(); }
});

test('respeita teto global de arquivos, linhas, hops e bytes incluindo metadados', () => {
  const f = fixture();
  try {
    const graph = publish(construct(f.root), f.cache);
    const result = contextGraph(graph, 'alpha', { files: 1, lines: 3, hops: 0, bytes: 1800 });
    assert(result.metrics.files <= 1); assert(result.metrics.lines <= 3);
    assert(result.snippets.every(s => s.via.length === 0));
    assert(Buffer.byteLength(JSON.stringify(result)) <= 1800);
    assert.equal(result.truncated, true);
    assert.throws(() => contextGraph(graph, 'alpha', { bytes: 1 }), e => e.code === 'LIMIT_INVALID');
    assert.throws(() => contextGraph(graph, 'alpha', { hops: 99 }), e => e.code === 'LIMIT_INVALID');
    assert.equal(queryGraph(graph, 'unfindable-xyz987').results.length, 0);
  } finally { f.cleanup(); }
});

test('preserva entrada e README relevantes antes de vizinhos periféricos', () => {
  const f = fixture();
  try {
    const graph = publish(construct(f.root), f.cache);
    const result = contextGraph(graph, 'inscrição alpha', { files: 2, lines: 50, bytes: 18000 });
    assert(result.snippets.some(s => s.path === 'web/src/features/alpha/README.md'));
    assert(result.snippets.some(s => s.path === 'web/src/features/alpha/main.ts'));
  } finally { f.cleanup(); }
});

test('CLI real executa build/status/query/context com JSON e erro stale', () => {
  const f = fixture();
  try {
    const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
    const call = (...args) => JSON.parse(execFileSync(process.execPath, [cli, ...args, '--root', f.root, '--cache', f.cache], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    assert.equal(call('status').status, 'missing');
    assert.equal(call('build').status, 'built');
    assert.equal(call('status').freshness.stale, false);
    assert(call('query', 'Main').results.length > 0);
    assert(call('context', 'Main').snippets.length > 0);
    f.write('web/src/lazy.ts', 'export const later = 42;');
    assert.equal(call('status').freshness.stale, true);
    assert.throws(() => call('context', 'Main'), error => JSON.parse(error.stderr).code === 'INDEX_STALE');
    assert.equal(call('build').status, 'built');
    assert.equal(call('status').freshness.stale, false);
  } finally { f.cleanup(); }
});
