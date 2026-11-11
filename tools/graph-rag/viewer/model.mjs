// Modelo de navegação do visualizador; não altera os nós nem as relações do índice.
export const NODE_KINDS = ['Module', 'File', 'Symbol', 'Document'];
export const RELATION_KINDS = ['CONTAINS', 'IMPORTS', 'IMPORTS_TYPE', 'IMPORTS_DYNAMIC', 'EXPORTS', 'ALIASES', 'DOCUMENTED_BY'];
export const VIEW_LIMITS = { nodes: 120, edges: 300, batch: 24, search: 40, details: 60 };
export const normalizeText = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function createViewerModel(data, limits = VIEW_LIMITS) {
  const nodes = new Map(data.nodes.map(n => [n.id, n]));
  const adjacency = new Map(data.nodes.map(n => [n.id, []]));
  for (const e of data.edges) { adjacency.get(e.from)?.push(e); adjacency.get(e.to)?.push(e); }
  const searchable = data.nodes.map(n => [n, normalizeText([n.name, n.path, ...(n.aliases || [])].join(' '))]);
  const roots = new Set(), expanded = new Map();
  const kinds = new Set(NODE_KINDS), relations = new Set(RELATION_KINDS);
  let selected = null;
  const allowed = n => n && kinds.has(n.kind);
  const linked = id => (adjacency.get(id) || []).filter(e => relations.has(e.type));

  function view() {
    const visible = new Set();
    const queue = [...roots].filter(id => allowed(nodes.get(id)));
    let omitted = 0;
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]; if (visible.has(id)) continue;
      if (visible.size >= limits.nodes) { omitted++; continue; }
      visible.add(id);
      for (const target of expanded.get(id) || []) {
        if (allowed(nodes.get(target)) && linked(id).some(e => (e.from === id && e.to === target) || (e.to === id && e.from === target))) queue.push(target);
      }
    }
    const edges = data.edges.filter(e => relations.has(e.type) && visible.has(e.from) && visible.has(e.to));
    return { nodes: [...visible].map(id => nodes.get(id)), edges: edges.slice(0, limits.edges),
      hiddenNodes: data.nodes.length - visible.size, omitted, hiddenEdges: edges.length - Math.min(edges.length, limits.edges) };
  }
  function overview() {
    roots.clear(); expanded.clear(); selected = null;
    for (const n of data.nodes.filter(n => n.kind === 'Module')) roots.add(n.id);
    if (!roots.size) for (const n of data.nodes.filter(n => n.kind === 'File').slice(0, limits.batch)) roots.add(n.id);
    return view();
  }
  function focus(id) {
    if (!nodes.has(id)) return;
    roots.clear(); roots.add(id); expanded.clear(); selected = id;
    return view();
  }
  function expand(id, content = true) {
    if (!nodes.has(id)) return { added: 0, remaining: 0 };
    const candidates = [...new Set(linked(id).filter(e => content ? e.type === 'CONTAINS' && e.from === id : e.type !== 'CONTAINS')
      .map(e => e.from === id ? e.to : e.from))].filter(target => allowed(nodes.get(target)));
    const current = expanded.get(id) || new Set();
    const visible = new Set(view().nodes.map(n => n.id));
    let room = limits.nodes - visible.size, added = 0;
    for (const target of candidates) {
      if (current.has(target)) continue;
      if (added >= limits.batch || (!visible.has(target) && room <= 0)) break;
      current.add(target); added++;
      if (!visible.has(target)) { visible.add(target); room--; }
    }
    expanded.set(id, current);
    return { added, remaining: candidates.filter(target => !current.has(target)).length };
  }
  function collapse(id) { expanded.delete(id); return view(); }
  function search(text) {
    const words = normalizeText(text).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return { nodes: [], total: 0 };
    // Busca local simples para a interface. Não substitui nem modifica o ranking da CLI.
    const found = searchable.filter(([n, haystack]) => allowed(n) && words.every(w => haystack.includes(w))).map(([n]) => n);
    return { nodes: found.slice(0, limits.search), total: found.length };
  }
  function details(id) {
    const n = nodes.get(id); if (!n) return null;
    const direct = linked(id);
    const readmes = new Map();
    const owners = (adjacency.get(id) || []).filter(e => e.type === 'CONTAINS' && e.to === id).map(e => e.from);
    const documentationOwners = new Set([id, ...owners, `file:${n.path}`]);
    for (const owner of [...documentationOwners]) {
      for (const e of adjacency.get(owner) || []) if (e.type === 'CONTAINS' && e.to === owner) documentationOwners.add(e.from);
    }
    for (const owner of documentationOwners) for (const e of adjacency.get(owner) || []) {
      const doc = nodes.get(e.to);
      if (e.from === owner && e.type === 'DOCUMENTED_BY' && /(?:^|\/)README\.md$/.test(doc?.path || '')) readmes.set(doc.id, doc);
    }
    return { node: n, relations: direct.slice(0, limits.details), total: direct.length, readmes: [...readmes.values()] };
  }
  overview();
  return { nodes, kinds, relations, view, overview, focus, expand, collapse, search, details,
    select(id) { if (nodes.has(id)) selected = id; }, get selected() { return selected; } };
}
