import { readSource } from './scope.mjs';
import { hash, fail } from './model.mjs';

const stop = new Set('onde alterar corrigir localizar modificar investigar como para uma um na no de do da das dos em e ou por a o as os'.split(' '));
export function terms(text) {
  return [...new Set(String(text).replace(/([a-z\d])([A-Z])/g, '$1 $2').normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 1 && !stop.has(t)).map(t => {
      if (t.length > 5) t = t.replace(/coes$/, 'cao').replace(/oes$/, 'ao').replace(/ais$/, 'al');
      return t.length > 3 ? t.replace(/s$/, '') : t;
    }))];
}
const canonical = text => String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function matches(a, b) {
  if (a === b) return true;
  let n = 0; while (a[n] && a[n] === b[n]) n++;
  return n >= 5 && (n / Math.min(a.length, b.length) >= 0.7 || Math.min(a.length, b.length) === 5);
}
const has = (tokens, word) => tokens.some(t => matches(t, word));
const actions = {
  create: 'criar criacao cadastrar cadastro registrar registro create register submit confirmar',
  remove: 'excluir exclusao remover remocao apagar delete remove',
  update: 'atualizar atualizacao salvar update save',
};
function profile(query) {
  const all = terms(query), selected = Object.entries(actions).find(([, values]) =>
    terms(values).some(word => all.includes(word)));
  const uiWords = terms('apresentação visual layout aparência renderização interface');
  const ui = all.some(word => uiWords.includes(word));
  const actionWords = selected ? terms(selected[1]) : [];
  const topics = all.filter(word => !actionWords.includes(word) && !uiWords.includes(word));
  return { all, topics: topics.length ? topics : all, actionWords, ui,
    config: all.some(word => terms('configuração permissão parâmetro opção limite').includes(word)),
    exact: canonical(query) };
}

function topology(graph) {
  const modules = graph.nodes.filter(n => n.kind === 'Module');
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const own = rel => modules.filter(m => rel.startsWith(m.path + '/')).map(m => m.id);
  const associations = new Map(), rows = new Map();
  const add = (rel, ids) => {
    if (!associations.has(rel)) associations.set(rel, new Set());
    for (const id of ids) associations.get(rel).add(id);
  };
  for (const n of graph.nodes) if (n.kind === 'File') add(n.path, own(n.path));
  for (const e of graph.edges) if (e.type === 'DOCUMENTED_BY') {
    const from = byId.get(e.from), doc = byId.get(e.to);
    if (from?.kind !== 'File' || !doc) continue;
    add(from.path, own(doc.path));
    for (const ev of e.evidence) {
      const key = `${ev.path}:${ev.startLine}`;
      if (!rows.has(key)) rows.set(key, new Set());
      rows.get(key).add(from.path);
    }
  }
  // Uma linha documental pode vincular entradas front/back ao mesmo módulo.
  for (const paths of rows.values()) {
    const owners = [...new Set([...paths].flatMap(own))];
    for (const rel of paths) add(rel, owners);
  }
  return { modules, associations };
}

function metadataScore(item, p) {
  if (item.id === p.raw) return 1000;
  const name = terms(item.name), path = terms(item.path), heads = terms((item.headings || []).map(h => h.title).join(' '));
  let value = 0, covered = 0;
  let focusedAlias = false;
  for (const label of item.aliases || []) {
    const tokens = terms(label);
    if (p.topics.length > 1 && p.topics.every(key => has(tokens, key)) && tokens.length <= p.topics.length * 2) focusedAlias = true;
  }
  for (const key of p.topics) {
    const weights = [has(name, key) ? 5 : 0, has(path, key) ? 1.5 : 0, has(heads, key) ? 2 : 0];
    let alias = 0;
    for (const label of item.aliases || []) {
      const tokens = terms(label);
      if (has(tokens, key)) alias = Math.max(alias, 3 * Math.min(1, p.topics.length / Math.max(1, tokens.length)));
    }
    const weight = Math.max(...weights, alias);
    if (weight) { value += weight; covered++; }
  }
  const coverage = covered / Math.max(1, p.topics.length);
  if (coverage < 0.45) return 0;
  value *= coverage ** 2;
  if (focusedAlias && item.kind === 'File') value += 15;
  if (canonical(item.name) === p.exact) value += 25;
  if (item.kind === 'Symbol' && ['import', 'export'].includes(item.category)) value *= 0.25;
  if (item.role === 'test' && !p.all.some(t => ['test', 'teste'].includes(t))) value *= 0.5;
  if (/docs\/(?:modules\/)?INDEX\.md$/.test(item.path)) value *= 0.15;
  return value;
}

export function rankGraph(graph, query) {
  const p = { ...profile(query), raw: query };
  if (!p.all.length && !query.includes(':')) throw fail('QUERY_EMPTY', 'Informe nome, funcionalidade, caminho ou símbolo.');
  const exactId = graph.nodes.find(n => n.id === query);
  if (exactId) return { rows: [{ item: exactId, score: 1000 }], regions: new Map(), profile: p };
  const exactSymbols = graph.nodes.filter(n => n.kind === 'Symbol' && n.category === 'declaration' && canonical(n.name) === p.exact);
  if (exactSymbols.length && !graph.nodes.some(n => n.kind === 'Module' && canonical(n.name) === p.exact)) return { rows: exactSymbols.map(item => ({ item, score: 1000 })),
    regions: new Map(exactSymbols.map(item => [item.path, { item, score: 1000 }])), profile: p };
  const { modules, associations } = topology(graph);
  const affinities = modules.map(m => ({ id: m.id, value: p.topics.filter(t => has(terms([m.name, ...(m.aliases || [])].join(' ')), t)).length }));
  const bestAffinity = Math.max(0, ...affinities.map(m => m.value));
  const domains = new Set(affinities.filter(m => m.value > 0 && m.value >= bestAffinity * 0.75).map(m => m.id));
  const domainTerms = terms(modules.filter(m => domains.has(m.id)).flatMap(m => [m.name, ...(m.aliases || [])]).join(' '));
  p.functional = p.topics.filter(t => !has(domainTerms, t));
  const factor = item => {
    const linked = associations.get(item.path) || new Set();
    let weight = !domains.size ? 1 : [...linked].some(m => domains.has(m)) ? 1.7 : linked.size ? 0.2 : 0.8;
    weight /= Math.sqrt(Math.max(1, linked.size));
    if (p.ui && item.path.startsWith('api/')) weight *= 0.3;
    return weight;
  };
  const rows = graph.nodes.map(item => ({ item, score: metadataScore(item, p) * factor(item) }));
  const files = new Map();
  for (const row of rows) if (Object.hasOwn(graph.manifest.sourceHashes, row.item.path)) files.set(row.item.path, Math.max(files.get(row.item.path) || 0, row.score));
  const candidates = [...files].filter(([rel, score]) => score > 0 && !rel.endsWith('.md')).sort((a, b) => b[1] - a[1]).slice(0, 48);
  const regions = new Map(), sources = new Map();
  for (const [rel] of candidates) {
    const text = readSource(graph.manifest.root, rel);
    if (hash(text) !== graph.manifest.sourceHashes[rel]) throw fail('INDEX_STALE', 'Fonte mudou durante a busca.', { path: rel });
    sources.set(rel, text.split(/\r?\n/));
  }
  for (const row of rows) {
    const item = row.item, lines = sources.get(item.path);
    if (item.kind !== 'Symbol' || item.category !== 'declaration' || !lines) continue;
    const source = item.source, span = source.endLine - source.startLine + 1;
    const text = lines.slice(source.startLine - 1, source.endLine).join('\n');
    const head = text.slice(0, 400);
    const callable = ['FunctionDeclaration', 'MethodDeclaration'].includes(item.declarationKind) ||
      /^\s*(?:export\s+)?(?:const|let|var)\s+[\w$]+(?:\s*:[^=\n]+)?\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/.test(head);
    const table = item.declarationKind === 'VariableDeclaration' && /=\s*\{/.test(head);
    const exact = canonical(item.name) === p.exact;
    if (!callable && !(table && p.config) && !exact) continue;
    const tokens = terms(text), named = terms(item.name);
    const body = p.topics.filter(t => has(tokens, t)).length / Math.max(1, p.topics.length);
    const nameTerms = p.functional.length ? p.functional : p.topics;
    const name = nameTerms.filter(t => has(named, t)).length / Math.max(1, nameTerms.length);
    const action = p.actionWords.length && p.actionWords.some(t => tokens.includes(t)) ? 5 : 0;
    if (p.functional.length && !p.functional.some(t => has(tokens, t)) && !exact) continue;
    if (!body && !action && !exact) continue;
    let score = (body * 4 + name * 3 + action) / Math.log2(span + 3);
    const functionalLines = p.functional.length ? text.split(/\r?\n/).filter(line =>
      p.functional.some(t => has(terms(line), t))).length : 0;
    score += Math.min(6, functionalLines) * 0.25 / Math.sqrt(Math.max(1, span / 32));
    if (table && p.config) score *= 3;
    if (exact) score += 50;
    score *= factor(item);
    if (!regions.has(item.path) || regions.get(item.path).score < score) regions.set(item.path, { item, score });
    row.score += score * 5;
  }
  const exactIds = new Set(graph.nodes.filter(n => n.id === query).map(n => n.id));
  if (exactIds.size) return { rows: rows.filter(r => exactIds.has(r.item.id)).map(r => ({ ...r, score: 1000 })), regions, profile: p };
  return { rows: rows.filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id, 'en')), regions, profile: p };
}
