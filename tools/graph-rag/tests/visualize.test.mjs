import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture } from './fixtures.mjs';
import { construct } from '../indexer.mjs';
import { load, publish } from '../storage.mjs';
import { renderVisualizer, visualize } from '../visualize.mjs';
import { createViewerModel, VIEW_LIMITS } from '../viewer/model.mjs';

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const embedded = html => JSON.parse(html.match(/<script id="graph-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

test('visualize CLI gera HTML autocontido externo com nós/relações reais e preserva os comandos anteriores', () => {
  const f = fixture();
  try {
    const call = (...args) => JSON.parse(execFileSync(process.execPath, [cli, ...args, '--root', f.root, '--cache', f.cache], { encoding: 'utf8' }));
    assert.equal(call('build').status, 'built');
    const graph = load(f.root, f.cache), pointer = fs.readFileSync(path.join(f.cache, 'current.json'), 'utf8');
    const result = call('visualize'), html = fs.readFileSync(result.output, 'utf8');
    assert.equal(result.status, 'visualized'); assert.equal(result.freshness, 'fresh');
    assert.equal(path.dirname(result.output), path.join(f.cache, 'visualizer'));
    assert(result.url.startsWith('file:///')); assert(!result.output.startsWith(f.root));
    assert.deepEqual(embedded(html).nodes, graph.nodes); assert.deepEqual(embedded(html).edges, graph.edges);
    assert.equal(fs.readFileSync(path.join(f.cache, 'current.json'), 'utf8'), pointer);
    assert(!/<script[^>]+src=|<link[^>]+href=|\bfetch\s*\(|new WebSocket|XMLHttpRequest/.test(html));
    assert(html.includes("connect-src 'none'"));
    assert.equal(call('status').freshness.stale, false);
    assert(call('query', 'shared').results.length > 0); assert(call('context', 'shared').snippets.length > 0);
    assert.equal(call('visualize').output, result.output);
  } finally { f.cleanup(); }
});

test('recusa índice ausente, stale e inválido sem gerar nem substituir HTML', () => {
  const f = fixture();
  try {
    assert.throws(() => visualize(f.root, f.cache), e => e.code === 'INDEX_MISSING');
    const graph = publish(construct(f.root), f.cache), result = visualize(f.root, f.cache);
    const original = fs.readFileSync(result.output, 'utf8');
    f.write('web/src/shared.ts', 'export const changed = true;');
    const failed = spawnSync(process.execPath, [cli, 'visualize', '--root', f.root, '--cache', f.cache], { encoding: 'utf8' });
    assert.equal(failed.status, 1); assert.equal(JSON.parse(failed.stderr).code, 'INDEX_STALE');
    assert.match(JSON.parse(failed.stderr).message, /build/);
    assert.equal(fs.readFileSync(result.output, 'utf8'), original);
    fs.appendFileSync(path.join(f.cache, 'generations', graph.manifest.generation, 'nodes.jsonl'), '{}');
    assert.throws(() => visualize(f.root, f.cache), e => e.code === 'CACHE_INVALID');
    assert.equal(fs.readFileSync(result.output, 'utf8'), original);
  } finally { f.cleanup(); }
});

test('textos hostis continuam dados; bundle e CSP têm hash válido sem execução de HTML indexado', () => {
  const f = fixture();
  try {
    const graph = construct(f.root), attack = '</script><img src=x onerror=alert(1)>&\u2028\u2029';
    graph.nodes[0] = { ...graph.nodes[0], name: attack, aliases: [attack] };
    const html = renderVisualizer(graph);
    assert(!html.includes(attack)); assert(!html.includes('<img src=x'));
    assert.equal(embedded(html).nodes[0].name, attack);
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    assert.doesNotThrow(() => new vm.Script(script));
    assert(html.includes(`script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`));
    assert(!/innerHTML|outerHTML|document\.write|eval\(/.test(script));
  } finally { f.cleanup(); }
});

test('navegação inicia nos módulos, pesquisa, seleciona, expande e recolhe sem perder proveniência', () => {
  const f = fixture();
  try {
    const graph = construct(f.root), model = createViewerModel(graph);
    assert(model.view().nodes.every(n => n.kind === 'Module'));
    assert(model.view().nodes.length < graph.nodes.length);
    const module = model.search('alpha').nodes.find(n => n.kind === 'Module');
    model.select(module.id); model.expand(module.id);
    const file = model.view().nodes.find(n => n.path === 'web/src/features/alpha/main.ts'); assert(file);
    model.select(file.id); model.expand(file.id);
    assert(model.view().nodes.some(n => n.kind === 'Symbol'));
    assert(model.details(file.id).readmes.some(n => n.path.endsWith('alpha/README.md')));
    assert.deepEqual(model.details(file.id).node.source, file.source);
    model.expand(file.id, false);
    assert(model.view().edges.some(e => e.type === 'IMPORTS'));
    assert(model.details(file.id).relations.some(e => e.type === 'IMPORTS_TYPE'));
    model.relations.delete('IMPORTS_TYPE');
    assert(!model.view().edges.some(e => e.type === 'IMPORTS_TYPE'));
    assert(!model.details(file.id).relations.some(e => e.type === 'IMPORTS_TYPE'));
    model.kinds.delete('Symbol'); assert(!model.search('alpha').nodes.some(n => n.kind === 'Symbol'));
    model.collapse(module.id); assert(model.view().nodes.every(n => n.kind === 'Module'));
    model.focus(file.id); assert.equal(model.selected, file.id); assert.deepEqual(model.view().nodes, [file]);
    model.overview(); assert.equal(model.selected, null);
    assert.deepEqual(model.search('NÃO EXISTE').nodes, []);
  } finally { f.cleanup(); }
});

test('limita nós, expansões, relações, detalhes e resultados com indicação dos itens ocultos', () => {
  const nodes = [{ id: 'root', kind: 'Module', name: 'raiz', path: 'root' },
    ...Array.from({ length: 200 }, (_, i) => ({ id: `f${i}`, kind: 'File', name: `arquivo ${i}`, path: `f${i}` }))];
  const edges = nodes.slice(1).map(n => ({ from: 'root', to: n.id, type: 'CONTAINS' }));
  for (const a of nodes.slice(1, 120)) for (const b of nodes.slice(1, 120)) if (a !== b) edges.push({ from: a.id, to: b.id, type: 'IMPORTS' });
  const model = createViewerModel({ nodes, edges });
  assert.equal(model.expand('root').added, VIEW_LIMITS.batch);
  let last; for (let i = 0; i < 10; i++) last = model.expand('root');
  const view = model.view(); assert.equal(view.nodes.length, VIEW_LIMITS.nodes);
  assert(last.remaining > 0); assert(view.hiddenNodes > 0);
  assert.equal(view.edges.length, VIEW_LIMITS.edges); assert(view.hiddenEdges > 0);
  assert.equal(model.search('arquivo').total, 200); assert.equal(model.search('arquivo').nodes.length, VIEW_LIMITS.search);
  assert.equal(model.details('root').relations.length, VIEW_LIMITS.details);
  assert.equal(model.details('root').total, 200);
  model.collapse('root'); assert.equal(model.view().nodes.length, 1);
});

test('recusa junction/symlink no diretório de saída sem escrever fora do cache', t => {
  const f = fixture();
  try {
    publish(construct(f.root), f.cache);
    const outside = path.join(f.base, 'outside'); fs.mkdirSync(outside);
    try { fs.symlinkSync(outside, path.join(f.cache, 'visualizer'), 'junction'); }
    catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Host não permite link descartável'); return; } throw error; }
    assert.throws(() => visualize(f.root, f.cache), e => e.code === 'VISUALIZE_LOCATION_INVALID');
    assert.deepEqual(fs.readdirSync(outside), []);
  } finally { f.cleanup(); }
});
