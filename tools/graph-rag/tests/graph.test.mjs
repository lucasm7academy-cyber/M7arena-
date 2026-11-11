import test from 'node:test';
import assert from 'node:assert/strict';
import { construct } from '../indexer.mjs';
import { fixture } from './fixtures.mjs';

test('extrai imports, aliases, tipos, dinâmicos literais, exports e proveniência reais', () => {
  const f = fixture();
  try {
    const graph = construct(f.root), main = 'file:web/src/features/alpha/main.ts';
    const has = (type, from, to) => graph.edges.some(e => e.type === type && e.from === from && e.to === to);
    assert(has('IMPORTS', main, 'file:web/src/shared.ts'));
    assert(has('IMPORTS_TYPE', main, 'file:web/src/types.ts'));
    assert(!has('IMPORTS', main, 'file:web/src/types.ts'));
    assert(has('IMPORTS_TYPE', main, 'file:web/src/mixed.ts'));
    assert(has('IMPORTS', main, 'file:web/src/mixed.ts'));
    assert(has('IMPORTS_DYNAMIC', main, 'file:web/src/lazy.ts'));
    assert(has('IMPORTS', 'file:api/src/use.ts', 'file:db/schema/entity.ts'));
    assert(has('IMPORTS', 'file:api/test/use.test.ts', 'file:api/src/use.ts'));
    const defaultExport = graph.edges.find(e => e.type === 'EXPORTS' && e.from === main && e.exportName === 'default');
    assert.equal(graph.nodes.find(n => n.id === defaultExport.to).name, 'Main');
    const exposed = graph.edges.find(e => e.type === 'EXPORTS' && e.exportName === 'exposed');
    const alias = graph.edges.find(e => e.type === 'ALIASES' && e.from === exposed.to);
    assert.equal(graph.nodes.find(n => n.id === alias.to).name, 'shared');
    assert(graph.edges.some(e => e.type === 'EXPORTS' && e.exportName === 'Data' && e.from.endsWith('/barrel.ts')));
    const homonyms = graph.nodes.filter(n => n.kind === 'Symbol' && n.name === 'clash');
    assert.equal(homonyms.length, 2); assert.notEqual(homonyms[0].id, homonyms[1].id);
    assert(graph.edges.some(e => e.type === 'DOCUMENTED_BY' && e.from === main && e.origin === 'documentation' && e.resolution === 'declared'));
    assert(graph.diagnostics.some(d => d.code === 'DYNAMIC_IMPORT_NON_LITERAL'));
    assert(graph.diagnostics.some(d => d.code === 'ASSET_IMPORT_EXCLUDED' && d.specifier === './theme.css'));
    const ids = new Set(graph.nodes.map(n => n.id));
    for (const relation of graph.edges) {
      assert(ids.has(relation.from)); assert(ids.has(relation.to));
      for (const ev of relation.evidence) { assert.equal(ev.hash, graph.manifest.sourceHashes[ev.path]); assert(ev.startLine > 0); }
    }
  } finally { f.cleanup(); }
});

test('grafo e geração são determinísticos com fontes/configs idênticas', () => {
  const f = fixture();
  try {
    const first = construct(f.root), second = construct(f.root);
    assert.deepEqual(first.nodes, second.nodes); assert.deepEqual(first.edges, second.edges);
    assert.deepEqual(first.diagnostics, second.diagnostics); assert.equal(first.manifest.generation, second.manifest.generation);
  } finally { f.cleanup(); }
});

test('allowlist exclui credenciais, assets, dependências, legado e histórico', () => {
  const f = fixture();
  try {
    const graph = construct(f.root), paths = Object.keys(graph.manifest.sourceHashes);
    assert(!paths.some(p => /\.env|credentials|assets|node_modules|dist\/|historico|^mcp\/|statusdoprojeto/.test(p)));
    assert(!JSON.stringify(graph).includes('SENSITIVE_CANARY_DO_NOT_INDEX'));
    assert(paths.includes('docs/INDEX.md')); assert(paths.includes('db/schema/entity.ts'));
    assert(graph.nodes.every(n => ['Module', 'File', 'Symbol', 'Document'].includes(n.kind)));
    assert(!graph.edges.some(e => /CALLS|ENDPOINT|SCHEMA|TESTED_BY/.test(e.type)));
  } finally { f.cleanup(); }
});
