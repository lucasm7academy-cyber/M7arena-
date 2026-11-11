import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { inside, canonicalRoot, scan, allowedSource } from './scope.mjs';
import { hash, fail, VERSION } from './model.mjs';

export function cacheDirectory(rootInput, requested) {
  const root = canonicalRoot(rootInput);
  const proposed = path.resolve(requested || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'M7Arena', 'graph-rag', hash(root).slice(0, 16)));
  let ancestor = proposed;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const cache = path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, proposed));
  if (inside(root, cache) || inside(cache, root) || cache === path.parse(cache).root || cache === os.homedir()) {
    throw fail('CACHE_LOCATION_INVALID', 'O cache deve ser dedicado e externo ao repositório.', { cache });
  }
  return cache;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw fail('CACHE_INVALID', 'JSON de cache ausente ou inválido.', { file }); }
}

function safeFile(directory, name) {
  const target = path.join(directory, name);
  if (!fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink() || !inside(directory, fs.realpathSync(target))) {
    throw fail('CACHE_INVALID', 'Artefato ausente ou fora da geração.', { name });
  }
  return target;
}

function readGeneration(root, cache, generation) {
  if (!/^[a-f0-9]{64}$/.test(generation)) throw fail('CACHE_INVALID', 'Identificador de geração inválido.');
  const directory = path.join(cache, 'generations', generation);
  if (!fs.existsSync(directory) || !inside(cache, fs.realpathSync(directory))) throw fail('CACHE_INVALID', 'Geração ausente ou externa.');
  const manifest = readJson(safeFile(directory, 'manifest.json'));
  if (manifest.root !== root || manifest.generation !== generation || manifest.formatVersion !== 1 || manifest.extractorVersion !== VERSION) {
    throw fail('CACHE_INVALID', 'Manifesto incompatível com esta raiz/extrator.');
  }
  if (!manifest.sourceHashes || !manifest.configurationHashes || Object.keys(manifest.sourceHashes).some(p => !allowedSource(p)) ||
    hash(JSON.stringify({ hashes: manifest.sourceHashes, configurations: manifest.configurationHashes,
      compilerVersion: manifest.compilerVersion, extractorHash: manifest.extractorHash, version: VERSION })) !== manifest.fingerprint) {
    throw fail('CACHE_INVALID', 'Escopo ou fingerprint do manifesto inválido.');
  }
  const read = name => {
    const raw = fs.readFileSync(safeFile(directory, name), 'utf8');
    if (hash(raw) !== manifest.artifacts?.[name]) throw fail('CACHE_INVALID', 'Hash de artefato divergente.', { name });
    return raw;
  };
  let nodes, edges, diagnostics;
  try {
    const lines = raw => raw.trim() ? raw.trimEnd().split('\n').map(row => JSON.parse(row)) : [];
    nodes = lines(read('nodes.jsonl')); edges = lines(read('edges.jsonl')); diagnostics = JSON.parse(read('diagnostics.json'));
  } catch (error) { if (error.code) throw error; throw fail('CACHE_INVALID', 'Conteúdo do grafo inválido.'); }
  const ids = new Set(), kinds = new Set(['Module', 'File', 'Symbol', 'Document']);
  const validEvidence = ev => ev && manifest.sourceHashes?.[ev.path] === ev.hash &&
    Number.isInteger(ev.startLine) && ev.startLine > 0 && Number.isInteger(ev.endLine) && ev.endLine >= ev.startLine;
  for (const item of nodes) {
    if (!kinds.has(item.kind) || !item.id || ids.has(item.id) || !validEvidence(item.source) ||
      (item.kind !== 'Module' && (!allowedSource(item.path) || item.path !== item.source.path))) throw fail('CACHE_INVALID', 'Nó inválido ou repetido.');
    ids.add(item.id);
  }
  const edgeIds = new Set();
  for (const item of edges) {
    if (!item.id || edgeIds.has(item.id) || !ids.has(item.from) || !ids.has(item.to) || !item.evidence?.length || !item.evidence.every(validEvidence)) {
      throw fail('CACHE_INVALID', 'Aresta inválida ou alvo ausente.');
    }
    edgeIds.add(item.id);
  }
  if (nodes.length !== manifest.counts?.nodes || edges.length !== manifest.counts?.edges || diagnostics.length !== manifest.counts?.diagnostics ||
    hash(JSON.stringify({ fingerprint: manifest.fingerprint, nodes, edges })) !== generation) throw fail('CACHE_INVALID', 'Contagem ou geração inconsistente.');
  return { manifest, nodes, edges, diagnostics, cache };
}

export function load(rootInput, requested) {
  const root = canonicalRoot(rootInput), cache = cacheDirectory(root, requested), pointer = path.join(cache, 'current.json');
  if (!fs.existsSync(pointer)) throw fail('INDEX_MISSING', 'Índice ainda não construído.', { cache });
  const current = readJson(safeFile(cache, 'current.json'));
  return readGeneration(root, cache, current.generation);
}

export function publish(graph, requested, { onStaged } = {}) {
  const root = graph.manifest.root, cache = cacheDirectory(root, requested);
  fs.mkdirSync(cache, { recursive: true });
  const generations = path.join(cache, 'generations');
  if (fs.existsSync(generations) && (fs.lstatSync(generations).isSymbolicLink() || !fs.statSync(generations).isDirectory())) {
    throw fail('CACHE_INVALID', 'Diretório de gerações não pode ser link ou arquivo.');
  }
  fs.mkdirSync(generations, { recursive: true });
  if (!inside(cache, fs.realpathSync(generations))) throw fail('CACHE_INVALID', 'Gerações fora do cache autorizado.');
  const lock = path.join(cache, 'build.lock');
  let descriptor;
  try { descriptor = fs.openSync(lock, 'wx'); }
  catch { throw fail('CACHE_BUSY', 'Outro build possui o lock do cache; nenhuma geração foi alterada.', { cache }); }
  try {
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, version: VERSION }));
    const generation = graph.manifest.generation, final = path.join(cache, 'generations', generation);
    if (!fs.existsSync(final)) {
      const staging = path.join(cache, 'generations', `.building-${generation}-${randomUUID()}`);
      fs.mkdirSync(staging, { recursive: true });
      const artifacts = {
        'nodes.jsonl': graph.nodes.map(n => JSON.stringify(n)).join('\n') + '\n',
        'edges.jsonl': graph.edges.map(e => JSON.stringify(e)).join('\n') + '\n',
        'diagnostics.json': JSON.stringify(graph.diagnostics, null, 2) + '\n',
      };
      for (const [name, raw] of Object.entries(artifacts)) fs.writeFileSync(path.join(staging, name), raw, { flag: 'wx' });
      const manifest = { ...graph.manifest, artifacts: Object.fromEntries(Object.entries(artifacts).map(([n, raw]) => [n, hash(raw)])) };
      fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
      onStaged?.(staging);
      // Ambos os caminhos são derivados e confinados ao cache verificado.
      if (!inside(cache, staging) || !inside(cache, final)) throw fail('CACHE_LOCATION_INVALID', 'Destino de publicação inválido.');
      fs.renameSync(staging, final);
    }
    const validated = readGeneration(root, cache, generation);
    const pointer = path.join(cache, `current-${randomUUID()}.tmp`);
    fs.writeFileSync(pointer, JSON.stringify({ generation }) + '\n', { flag: 'wx' });
    fs.renameSync(pointer, path.join(cache, 'current.json'));
    return validated;
  } finally {
    fs.closeSync(descriptor);
    fs.unlinkSync(lock);
  }
}

export function freshness(graph) {
  try {
    const current = scan(graph.manifest.root), before = graph.manifest.sourceHashes;
    const added = current.files.filter(p => !Object.hasOwn(before, p));
    const removed = Object.keys(before).filter(p => !Object.hasOwn(current.hashes, p));
    const modified = current.files.filter(p => Object.hasOwn(before, p) && before[p] !== current.hashes[p]);
    const configurations = [...new Set([...Object.keys(current.configurations), ...Object.keys(graph.manifest.configurationHashes)])]
      .filter(p => current.configurations[p] !== graph.manifest.configurationHashes[p]);
    return { stale: current.fingerprint !== graph.manifest.fingerprint || !!(added.length + removed.length + modified.length + configurations.length), added, removed, modified, configurations,
      extractorChanged: current.extractorHash !== graph.manifest.extractorHash, git: current.git };
  } catch (error) { return { stale: true, reason: error.code || 'SOURCE_UNAVAILABLE', message: error.message }; }
}

export function requireFresh(graph) {
  const state = freshness(graph);
  if (state.stale) {
    const { git, ...details } = state;
    throw fail('INDEX_STALE', 'Índice desatualizado; execute build antes de recuperar contexto.', details);
  }
  return state;
}
