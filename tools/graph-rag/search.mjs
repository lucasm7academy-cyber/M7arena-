import { hash, fail } from './model.mjs';
import { readSource } from './scope.mjs';
import { requireFresh } from './storage.mjs';
import { terms, rankGraph } from './relevance.mjs';
export { terms } from './relevance.mjs';

function ranked(graph, query) {
  return rankGraph(graph, query).rows;
}

function matchEvidence(item, keys) {
  return { kind: 'lexical', source: item.source,
    aliases: (item.aliasEvidence || []).filter(record => terms(record.alias).some(t => keys.includes(t))).slice(0, 3) };
}

function bounded(value, fallback, max, min = 1) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw fail('LIMIT_INVALID', 'Limite fora do intervalo.', { value, min, max });
  return number;
}

export function queryGraph(graph, query, options = {}) {
  requireFresh(graph);
  const limit = bounded(options.limit, 12, 100);
  return { generation: graph.manifest.generation, status: 'fresh', query,
    results: ranked(graph, query).slice(0, limit).map(({ item, score }) => ({ id: item.id, kind: item.kind,
      name: item.name, path: item.path, score, origin: item.origin, resolution: item.resolution, source: item.source,
      match: matchEvidence(item, terms(query)) })),
    limitations: ['Grafo estático; não infere chamadas runtime, endpoints ou cobertura de testes.'] };
}

export function contextGraph(graph, query, options = {}) {
  requireFresh(graph);
  const limits = { files: bounded(options.files, 6, 50), lines: bounded(options.lines, 160, 2000),
    hops: bounded(options.hops, 1, 3, 0), bytes: bounded(options.bytes, 18000, 1000000, 512),
    snippetLines: bounded(options.snippetLines, 32, 200) };
  const byId = new Map(graph.nodes.map(n => [n.id, n])), adjacency = new Map(), candidates = new Map();
  const priority = { IMPORTS: 0, IMPORTS_TYPE: 1, IMPORTS_DYNAMIC: 2, ALIASES: 3, EXPORTS: 4, CONTAINS: 5, DOCUMENTED_BY: 6 };
  for (const relation of graph.edges) for (const [from, to, direction] of [[relation.from, relation.to, 'direct'], [relation.to, relation.from, 'reverse']]) {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push({ target: to, relation, direction });
  }
  const ranking = rankGraph(graph, query), hits = ranking.rows;
  const queue = hits.slice(0, 24).map(h => ({ ...h, depth: 0, via: [], seed: h.item.id }));
  const seen = new Set(), traversed = new Map();
  let expansionTruncated = false;
  while (queue.length && seen.size < 240) {
    queue.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id, 'en'));
    const current = queue.shift();
    if (seen.has(current.item.id)) continue;
    seen.add(current.item.id);
    const item = current.item, rel = item.kind === 'Module' ? item.source.path : item.path;
    if (Object.hasOwn(graph.manifest.sourceHashes, rel)) {
      const previous = candidates.get(rel);
      if (!previous || previous.score < current.score) candidates.set(rel, { ...current, rel });
    }
    if (current.depth >= limits.hops) continue;
    const neighbors = [...(adjacency.get(item.id) || [])].sort((a, b) =>
      priority[a.relation.type] - priority[b.relation.type] || a.target.localeCompare(b.target, 'en'));
    if (neighbors.length > 24) expansionTruncated = true;
    for (const next of neighbors.slice(0, 24)) {
      traversed.set(next.relation.id, next.relation);
      queue.push({ item: byId.get(next.target), score: current.score * 0.45, depth: current.depth + 1,
        via: [...current.via, { edgeId: next.relation.id, direction: next.direction, type: next.relation.type,
          from: next.relation.from, to: next.relation.to, origin: next.relation.origin,
          resolution: next.relation.resolution, evidence: next.relation.evidence }], seed: current.seed });
    }
  }
  if (queue.length) expansionTruncated = true;
  const result = { generation: graph.manifest.generation, status: 'fresh', query, limits, snippets: [], relations: [],
    truncated: expansionTruncated, gaps: ['Sem adaptadores HTTP/SDK/schema/cobertura; documentação é evidência declarada.'],
    metrics: { files: 0, lines: 0, excerptBytes: 0, outputBytes: 0 } };
  const size = () => {
    for (let i = 0; i < 3; i++) result.metrics.outputBytes = Buffer.byteLength(JSON.stringify(result));
    return result.metrics.outputBytes;
  };
  const keys = terms(query);
  const lexical = new Map();
  for (const hit of hits) {
    const rel = hit.item.kind === 'Module' ? hit.item.source.path : hit.item.path;
    lexical.set(rel, Math.max(lexical.get(rel) || 0, hit.score));
  }
  const selectionScore = candidate => Math.max(lexical.get(candidate.rel) || 0, candidate.score * 0.1);
  const ordered = [...candidates.values()].sort((a, b) => selectionScore(b) - selectionScore(a) || a.rel.localeCompare(b.rel, 'en'));
  let usedLines = 0;
  for (const candidate of ordered) {
    if (result.snippets.length >= limits.files || usedLines >= limits.lines) { result.truncated = true; break; }
    const text = readSource(graph.manifest.root, candidate.rel), expected = graph.manifest.sourceHashes[candidate.rel];
    if (hash(text) !== expected) throw fail('INDEX_STALE', 'Fonte mudou durante a recuperação.', { path: candidate.rel });
    const preferred = ranking.regions.get(candidate.rel);
    if (preferred && !query.startsWith('file:') && !candidate.rel.endsWith('.md')) candidate.item = preferred.item;
    const lines = text.split(/\r?\n/), source = candidate.item.source;
    const isSymbol = candidate.item.kind === 'Symbol';
    const first = isSymbol ? source.startLine - 1 : 0, last = isSymbol ? Math.min(lines.length, source.endLine) : lines.length;
    let best = first, bestScore = -1;
    for (let i = first; i < last; i++) {
      const tokens = terms(lines[i]), score = keys.filter(key => tokens.includes(key)).length;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    const count = Math.min(limits.snippetLines, limits.lines - usedLines, last - first);
    const start = isSymbol ? first : Math.max(first, Math.min(best - 4, last - count));
    let end = Math.min(last, start + count);
    const snippet = { path: candidate.rel, nodeId: candidate.item.id, seedId: candidate.seed,
      startLine: start + 1, endLine: end, hash: expected, origin: candidate.item.origin,
      resolution: candidate.item.resolution, via: candidate.via, evidence: source,
      match: candidate.via.length ? { kind: 'graph', seed: candidate.seed } : matchEvidence(candidate.item, keys),
      text: lines.slice(start, end).join('\n') };
    result.snippets.push(snippet);
    while (size() > limits.bytes && end > start + 1) {
      end--; snippet.endLine = end; snippet.text = lines.slice(start, end).join('\n'); result.truncated = true;
    }
    if (size() > limits.bytes) { result.snippets.pop(); result.truncated = true; break; }
    usedLines += end - start;
    if (end - start < last - first) result.truncated = true;
  }
  const selectedPaths = new Set(result.snippets.map(s => s.path));
  const relevant = [...traversed.values()].filter(e => selectedPaths.has(byId.get(e.from)?.path) && selectedPaths.has(byId.get(e.to)?.path))
    .sort((a, b) => priority[a.type] - priority[b.type] || a.id.localeCompare(b.id, 'en'));
  for (const relation of relevant.slice(0, 12)) {
    const summary = { id: relation.id, type: relation.type, from: relation.from, to: relation.to,
      origin: relation.origin, resolution: relation.resolution, evidence: relation.evidence };
    result.relations.push(summary);
    if (size() > limits.bytes) { result.relations.pop(); result.truncated = true; break; }
  }
  result.metrics.files = result.snippets.length;
  result.metrics.lines = usedLines;
  result.metrics.excerptBytes = result.snippets.reduce((sum, s) => sum + Buffer.byteLength(s.text), 0);
  // Metadados também contam no teto; reserva final não descarta fonte silenciosamente.
  while (size() > limits.bytes && result.relations.length) { result.relations.pop(); result.truncated = true; }
  while (size() > limits.bytes && result.snippets.length) {
    const removed = result.snippets.pop(); result.metrics.files--; result.metrics.lines -= removed.endLine - removed.startLine + 1;
    result.metrics.excerptBytes -= Buffer.byteLength(removed.text); result.truncated = true;
  }
  if (!hits.length) result.gaps.push('Nenhuma entrada lexical encontrada; use arquivo/símbolo explícito ou rg.');
  requireFresh(graph);
  size();
  if (size() > limits.bytes) throw fail('LIMIT_TOO_SMALL', 'Teto insuficiente para os metadados de contexto.');
  return result;
}
