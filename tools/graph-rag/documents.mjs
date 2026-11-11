import path from 'node:path';
import { node, edge, fileId, evidence } from './model.mjs';

const clean = text => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*#]/g, '').trim();

export function modulesFor(snapshot, nodes, edges) {
  const modules = new Map();
  for (const rel of snapshot.files) {
    const match = rel.match(/^(web\/src\/features\/[^/]+|api\/src\/modules\/[^/]+)\//);
    if (!match) continue;
    const dir = match[1];
    if (!modules.has(dir)) {
      const doc = snapshot.files.find(p => p === dir + '/README.md');
      const source = evidence(doc || rel, snapshot.hashes[doc || rel]);
      const item = node('Module', dir, path.posix.basename(dir), dir, source, 'filesystem', { aliases: [], aliasEvidence: [], partial: true });
      nodes.push(item); modules.set(dir, item);
    }
    edges.push(edge('CONTAINS', modules.get(dir).id, fileId(rel), evidence(rel, snapshot.hashes[rel]), 'filesystem'));
  }
  return modules;
}

export function extractDocuments(snapshot, sources, modules, nodes, edges, diagnostics) {
  const files = new Set(snapshot.files), byId = new Map(nodes.map(n => [n.id, n]));
  for (const rel of snapshot.files.filter(p => p.endsWith('.md'))) {
    const lines = sources.get(rel).split(/\r?\n/);
    const headings = lines.flatMap((line, i) => /^#{1,6}\s+/.test(line) ? [{ title: clean(line), line: i + 1 }] : []);
    const item = node('Document', rel, headings[0]?.title || path.posix.basename(rel), rel,
      evidence(rel, snapshot.hashes[rel], 1, lines.length), 'documentation', { headings, aliases: [] });
    nodes.push(item);
    edges.push(edge('CONTAINS', fileId(rel), item.id, item.source, 'filesystem'));
    const owner = modules.get(path.posix.dirname(rel));
    if (owner) {
      owner.aliases.push(item.name);
      owner.aliasEvidence.push({ alias: item.name, origin: 'documentation', resolution: 'declared',
        source: evidence(rel, snapshot.hashes[rel], headings[0]?.line || 1) });
      edges.push(edge('DOCUMENTED_BY', owner.id, item.id, item.source, 'documentation'));
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const match of line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
        const [_, label, raw] = match;
        if (/^(?:https?:|mailto:|#)/.test(raw)) continue;
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), raw.split('#')[0]));
        const ev = evidence(rel, snapshot.hashes[rel], i + 1);
        const targetFile = byId.get(fileId(target));
        if (!targetFile) {
          diagnostics.push({ code: 'DOCUMENT_LINK_OUTSIDE_INDEX', path: rel, target, source: ev, resolution: 'unresolved' });
          continue;
        }
        const tableAlias = line.startsWith('|') ? clean(line.split('|')[1] || '') : clean(label);
        targetFile.aliases = [...new Set([...targetFile.aliases, clean(label), tableAlias])];
        targetFile.aliasEvidence ||= [];
        for (const alias of [...new Set([clean(label), tableAlias])]) targetFile.aliasEvidence.push({ alias,
          origin: 'documentation', resolution: 'declared', source: ev });
        edges.push(edge('DOCUMENTED_BY', targetFile.id, item.id, ev, 'documentation', { label: clean(label) }));
      }
    }
  }
}
