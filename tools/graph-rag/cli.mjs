#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { construct } from './indexer.mjs';
import { publish, load, freshness, cacheDirectory } from './storage.mjs';
import { queryGraph, contextGraph } from './search.mjs';
import { fail } from './model.mjs';
import { visualize } from './visualize.mjs';

export function parse(argv) {
  const [command, ...rest] = argv;
  const args = [], options = {};
  const names = new Set(['root', 'cache', 'limit', 'files', 'lines', 'hops', 'bytes', 'snippet-lines']);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--json') continue;
    if (rest[i].startsWith('--')) {
      const name = rest[i].slice(2);
      if (!names.has(name) || !rest[i + 1] || rest[i + 1].startsWith('--')) throw fail('ARGUMENT_INVALID', 'Opção desconhecida ou sem valor.', { name });
      options[name === 'snippet-lines' ? 'snippetLines' : name] = rest[++i];
    } else args.push(rest[i]);
  }
  return { command, options, query: args.join(' ') };
}

export function run(argv) {
  const { command, options, query } = parse(argv);
  const root = options.root || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  if (command === 'visualize') return visualize(root, options.cache);
  if (command === 'build') {
    const graph = publish(construct(root), options.cache);
    return { status: 'built', generation: graph.manifest.generation, cache: graph.cache,
      counts: graph.manifest.counts, compilerVersion: graph.manifest.compilerVersion };
  }
  if (command === 'status') {
    try {
      const graph = load(root, options.cache);
      return { generation: graph.manifest.generation, cache: graph.cache, counts: graph.manifest.counts,
        extractorVersion: graph.manifest.extractorVersion, freshness: freshness(graph) };
    } catch (error) {
      if (error.code !== 'INDEX_MISSING') throw error;
      return { status: 'missing', cache: cacheDirectory(root, options.cache) };
    }
  }
  if (command === 'query' || command === 'context') {
    const graph = load(root, options.cache);
    return command === 'query' ? queryGraph(graph, query, options) : contextGraph(graph, query, options);
  }
  throw fail('COMMAND_INVALID', 'Use build, status, query, context ou visualize. Todas as saídas são JSON.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(run(process.argv.slice(2))) + '\n'); }
  catch (error) {
    process.stderr.write(JSON.stringify({ error: true, code: error.code || 'GRAPH_RAG_ERROR', message: error.message, details: error.details || {} }) + '\n');
    process.exitCode = 1;
  }
}
