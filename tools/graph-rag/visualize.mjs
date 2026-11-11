import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load, requireFresh } from './storage.mjs';
import { inside } from './scope.mjs';
import { fail } from './model.mjs';

const viewerDir = fileURLToPath(new URL('./viewer/', import.meta.url));
export function serializeGraphData(data) {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function renderVisualizer(graph, generatedAt = new Date().toISOString()) {
  const data = { generation: graph.manifest.generation, generatedAt, nodes: graph.nodes, edges: graph.edges };
  const read = name => fs.readFileSync(path.join(viewerDir, name), 'utf8');
  const script = '(() => {\n"use strict";\n' + ['model.mjs', 'render.mjs', 'app.js']
    .map(name => read(name).replace(/^export /gm, '')).join('\n') + '\n})();';
  const digest = createHash('sha256').update(script).digest('base64');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${digest}'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; base-uri 'none'; form-action 'none'; object-src 'none'">
<title>M7Arena · Mapa do Graph RAG</title><style>${read('style.css')}</style></head>
<body><header><div class="brand"><span class="logo" aria-hidden="true">⌘</span><div><p class="eyebrow">M7ARENA · FERRAMENTAS LOCAIS</p><h1>Mapa do Graph RAG</h1></div></div><span class="badge">Offline · somente leitura</span><p id="snapshot" class="snapshot"></p></header>
<div class="layout"><aside aria-label="Pesquisa e filtros">
<button id="overview" class="reset">↖ Voltar à visão geral</button>
<label for="search">Pesquisar módulos, arquivos e símbolos</label><input id="search" type="search" placeholder="Ex.: matches, DraftRoom…" autocomplete="off">
<p id="search-meta" class="search-meta" aria-live="polite"></p><div id="results" class="results"></div>
<h3>Tipos de nó</h3><div id="node-filters" class="filters"></div>
<h3>Tipos de relação</h3><div id="edge-filters" class="filters"></div>
<p class="guide">Clique para inspecionar.<br>Duplo clique ou Espaço: expandir conteúdo.<br>Arraste nós para organizar.<br>Arraste o fundo para deslocar.<br>Use a roda do mouse para aproximar.<br><br>É um retrato do índice no momento da geração. Após alterar fontes, execute build e visualize novamente.</p>
</aside><main aria-label="Mapa de relações">
<div class="map-title"><h2 id="map-label">Módulos do projeto</h2><small>Explore uma fronteira de cada vez</small></div>
<div class="toolbar"><button id="zoom-out" aria-label="Diminuir zoom">−</button><button id="zoom-in" aria-label="Aumentar zoom">+</button><button id="fit">Enquadrar</button></div>
<svg id="map" role="group" aria-label="Grafo interativo de módulos e dependências"></svg>
<div class="map-status" aria-live="polite"><span id="counts"></span><br><span id="hidden"></span><span id="notice"></span></div>
</main><aside class="details" aria-label="Detalhes do nó"><p class="eyebrow">INSPECIONAR</p><div id="detail-body"></div></aside></div>
<script id="graph-data" type="application/json">${serializeGraphData(data)}</script><script>${script}</script></body></html>`;
}

export function visualize(root, cache) {
  const graph = load(root, cache);
  requireFresh(graph);
  const directory = path.join(graph.cache, 'visualizer');
  if (fs.existsSync(directory) && (fs.lstatSync(directory).isSymbolicLink() || !fs.statSync(directory).isDirectory())) {
    throw fail('VISUALIZE_LOCATION_INVALID', 'A pasta do visualizador não pode ser link ou arquivo.');
  }
  fs.mkdirSync(directory, { recursive: true });
  if (!inside(graph.cache, fs.realpathSync(directory))) throw fail('VISUALIZE_LOCATION_INVALID', 'Destino fora do cache.');
  const output = path.join(directory, 'mapa.html');
  if (fs.existsSync(output) && (fs.lstatSync(output).isSymbolicLink() || !fs.statSync(output).isFile())) {
    throw fail('VISUALIZE_LOCATION_INVALID', 'O HTML de destino não pode ser link ou diretório.');
  }
  const html = renderVisualizer(graph);
  const temporary = path.join(directory, `mapa-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, html, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, output);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return { status: 'visualized', generation: graph.manifest.generation, freshness: 'fresh',
    output, url: pathToFileURL(output).href, bytes: Buffer.byteLength(html), nodes: graph.nodes.length, edges: graph.edges.length };
}
