import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { construct } from '../indexer.mjs';
import { queryGraph, contextGraph } from '../search.mjs';

// Expectativas verificadas no código; nenhum caminho desta tabela é usado pelo algoritmo.
import { cases } from './real-cases.mjs';

let graph;
before(() => { graph = construct(fileURLToPath(new URL('../../../', import.meta.url))); });
for (const c of cases) test(`regressão real ${c.id}: entrada e declaração recuperadas`, () => {
  const found = queryGraph(graph, c.question, { limit: 100 });
  const paths = [...new Set(found.results.filter(r => r.kind !== 'Module').map(r => r.path))].slice(0, 8);
  assert(c.main.some(p => paths.includes(p)), `${c.id}: entrada ausente do top8`);
  const context = contextGraph(graph, c.question, { files: 8, lines: 180, hops: 1, bytes: 24000 });
  assert(context.snippets.some(s => c.main.includes(s.path)), `${c.id}: entrada ausente do pacote`);
  assert(context.snippets.some(s => s.nodeId.includes(c.handler) && s.text.includes(c.handler)), `${c.id}: declaração ${c.handler} ausente`);
  assert(context.metrics.outputBytes <= 24000);
});
