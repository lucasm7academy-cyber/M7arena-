import { createHash } from 'node:crypto';

export const VERSION = 'm7-graph-rag-1';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const slash = value => value.replaceAll('\\', '/');
export const id = (kind, value) => `${kind}:${value}`;
export const fileId = path => id('file', path);
export const stable = value => JSON.stringify(value);
export const ordered = items => [...items].sort((a, b) => a.id.localeCompare(b.id, 'en'));

export function evidence(path, sourceHash, startLine = 1, endLine = startLine) {
  return { path, startLine, endLine, hash: sourceHash };
}

export function node(kind, key, name, path, source, origin = 'ast', extra = {}) {
  return { id: id(kind.toLowerCase(), key), kind, name, path, source,
    origin, resolution: origin === 'documentation' ? 'declared' : 'resolved',
    extractorVersion: VERSION, ...extra };
}

export function edge(type, from, to, source, origin = 'ast', extra = {}) {
  const qualifier = extra.exportName || '';
  return { id: id('edge', hash([type, from, to, qualifier].join('\0'))),
    type, from, to, path: source.path, evidence: [source], origin,
    resolution: origin === 'documentation' ? 'declared' : 'resolved',
    extractorVersion: VERSION, ...extra };
}

export function mergeEdges(edges) {
  const result = new Map();
  for (const item of edges) {
    const prior = result.get(item.id);
    if (!prior) result.set(item.id, item);
    else for (const ev of item.evidence) {
      if (!prior.evidence.some(p => stable(p) === stable(ev))) prior.evidence.push(ev);
    }
  }
  for (const item of result.values()) item.evidence.sort((a, b) =>
    a.path.localeCompare(b.path, 'en') || a.startLine - b.startLine || a.endLine - b.endLine);
  return ordered(result.values());
}

export function fail(code, message, details = {}) {
  return Object.assign(new Error(message), { code, details });
}
