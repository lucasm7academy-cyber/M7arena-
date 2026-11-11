import path from 'node:path';
import { scan, readSource } from './scope.mjs';
import { node, evidence, ordered, mergeEdges, VERSION, hash, fail } from './model.mjs';
import { modulesFor, extractDocuments } from './documents.mjs';
import { extractCode } from './extract.mjs';

export function construct(root) {
  const snapshot = scan(root), nodes = [], edges = [], diagnostics = [];
  const sources = new Map(snapshot.files.map(p => [p, readSource(snapshot.root, p)]));
  for (const rel of snapshot.files) {
    nodes.push(node('File', rel, path.posix.basename(rel), rel,
      evidence(rel, snapshot.hashes[rel], 1, sources.get(rel).split(/\r?\n/).length), 'filesystem',
      { aliases: [], role: rel.endsWith('.md') ? 'document' : /(?:\.test\.|^api\/test\/)/.test(rel) ? 'test' : 'source' }));
  }
  const modules = modulesFor(snapshot, nodes, edges);
  extractCode(snapshot, nodes, edges, diagnostics);
  extractDocuments(snapshot, sources, modules, nodes, edges, diagnostics);
  const ids = new Set();
  for (const item of nodes) {
    if (ids.has(item.id)) throw fail('DUPLICATE_NODE', 'Identificador repetido.', { id: item.id });
    ids.add(item.id);
    if (item.aliases) item.aliases.sort();
  }
  for (const item of edges) if (!ids.has(item.from) || !ids.has(item.to)) throw fail('DANGLING_EDGE', 'Alvo inexistente.', { edge: item.id });
  diagnostics.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
  const graph = { nodes: ordered(nodes), edges: mergeEdges(edges), diagnostics };
  const generation = hash(JSON.stringify({ fingerprint: snapshot.fingerprint, nodes: graph.nodes, edges: graph.edges }));
  const manifest = { formatVersion: 1, extractorVersion: VERSION, compilerVersion: snapshot.compilerVersion,
    generation, root: snapshot.root, fingerprint: snapshot.fingerprint, extractorHash: snapshot.extractorHash,
    sourceHashes: snapshot.hashes, configurationHashes: snapshot.configurations, git: snapshot.git,
    counts: { files: snapshot.files.length, nodes: graph.nodes.length, edges: graph.edges.length, diagnostics: diagnostics.length } };
  return { ...graph, manifest };
}
