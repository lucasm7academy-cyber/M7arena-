import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { construct } from '../indexer.mjs';
import { queryGraph, contextGraph } from '../search.mjs';
import { fixture } from './fixtures.mjs';

function orders() {
  const f = fixture();
  f.write('web/src/features/alpha/README.md', '# Pedidos — cadastro\n\n[Cadastro de pedidos](orders.ts).\n[Referência antiga](missing.ts).\n');
  f.write('web/src/features/beta/README.md', '# Estoque\n\n[Processamento](other.ts).\n');
  f.write('web/src/features/alpha/orders.ts', '// linha sem relação com a consulta\n'.repeat(1000) +
    'declare const service: { create(value: unknown): unknown };\n' +
    'export async function confirmarPedido() {\n  return service.create({ pedido: true });\n}\n' +
    'export function processar() { return "pedido"; }\n');
  f.write('web/src/features/beta/other.ts', 'export function processar() { return "estoque"; }\n');
  return f;
}

test('acentos e separadores preservam símbolo exato e trecho no meio do arquivo', () => {
  const f = orders();
  try {
    const graph = construct(f.root);
    const accented = queryGraph(graph, 'criação pedidos').results[0];
    const plain = queryGraph(graph, 'criacao pedidos').results[0];
    assert.equal(accented.path, plain.path);
    const context = contextGraph(graph, 'confirmarPedido', { files: 1, lines: 12, bytes: 9000 });
    assert.equal(context.snippets[0].startLine, 1002);
    assert(context.snippets[0].text.includes('service.create'));
    assert(context.snippets[0].text.includes('confirmarPedido'));
  } finally { f.cleanup(); }
});

test('pergunta inédita prioriza cadastro no domínio e distingue homônimos', () => {
  const f = orders();
  try {
    const graph = construct(f.root);
    const result = queryGraph(graph, 'criar pedidos', { limit: 8 });
    assert(result.results[0].path.includes('/alpha/'));
    const homonyms = queryGraph(graph, 'processar').results;
    assert.equal(homonyms.length, 2); assert.notEqual(homonyms[0].id, homonyms[1].id);
    const scoped = queryGraph(graph, 'processar pedidos', { limit: 4 });
    assert(scoped.results[0].path.includes('/alpha/'));
  } finally { f.cleanup(); }
});

test('documentação incompleta não cria alvo e ausência confiável não inventa resultado', () => {
  const f = orders();
  try {
    const graph = construct(f.root);
    assert(graph.diagnostics.some(d => d.target?.endsWith('/missing.ts')));
    const result = contextGraph(graph, 'criar pedidos', { files: 4, lines: 24, bytes: 10000 });
    for (const s of result.snippets) {
      assert(fs.existsSync(path.join(f.root, s.path)));
      assert.equal(s.hash, graph.manifest.sourceHashes[s.path]);
    }
    assert.equal(queryGraph(graph, 'nebulosox987').results.length, 0);
    assert.deepEqual(contextGraph(graph, 'confirmarPedido'), contextGraph(graph, 'confirmarPedido'));
    f.write('web/src/features/alpha/orders.ts', 'export const changed = true;');
    assert.throws(() => contextGraph(graph, 'confirmarPedido'), e => e.code === 'INDEX_STALE');
  } finally { f.cleanup(); }
});
