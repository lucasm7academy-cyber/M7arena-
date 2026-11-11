const graphData = JSON.parse(document.getElementById('graph-data').textContent);
const model = createViewerModel(graphData);
const $ = id => document.getElementById(id);
const names = { Module: 'Módulos', File: 'Arquivos', Symbol: 'Símbolos', Document: 'Documentos' };
const relationNames = { CONTAINS: 'Contém', IMPORTS: 'Importação de código', IMPORTS_TYPE: 'Importação de tipo',
  IMPORTS_DYNAMIC: 'Importação dinâmica', EXPORTS: 'Exporta', ALIASES: 'Alias', DOCUMENTED_BY: 'Documentado por' };
function element(tag, text, className) {
  const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
  if (className) el.className = className; return el;
}
function button(text, action) { const b = element('button', text); b.type = 'button'; b.addEventListener('click', action); return b; }
const renderer = createMapRenderer($('map'), selectNode, id => { selectNode(id); expandSelected(true); });
function refresh(arrange = true) {
  const view = model.view(); renderer.draw(view, model.selected, arrange);
  $('counts').textContent = `${view.nodes.length} de ${graphData.nodes.length.toLocaleString('pt-BR')} nós · ${view.edges.length} relações visíveis · limite ${VIEW_LIMITS.nodes} nós / ${VIEW_LIMITS.edges} relações`;
  $('hidden').textContent = `${view.hiddenNodes.toLocaleString('pt-BR')} nós fora desta visão${view.hiddenEdges ? ` · ${view.hiddenEdges} relações entre nós visíveis omitidas` : ''}${view.omitted ? ` · limite de nós atingido (${view.omitted} pendentes)` : ''}.`;
  $('map-label').textContent = model.selected ? 'Explorando conexões' : 'Módulos do projeto';
  showDetails();
}
function selectNode(id) { model.select(id); refresh(false); }
function reveal(id) { model.focus(id); $('notice').textContent = ''; refresh(); }
function expandSelected(content) {
  if (!model.selected) return;
  const r = model.expand(model.selected, content);
  $('notice').textContent = `${r.added} conexões acrescentadas${r.remaining ? ` · ${r.remaining} ainda ocultas. Expanda novamente ou recolha outros nós para liberar espaço.` : '.'}`;
  refresh();
}
function evidenceText(ev) { return `${ev.path}:${ev.startLine}${ev.endLine !== ev.startLine ? `–${ev.endLine}` : ''}\nSHA-256: ${ev.hash}`; }
function showDetails() {
  const host = $('detail-body'); host.replaceChildren();
  const info = model.details(model.selected);
  if (!info) { host.append(element('div', 'Selecione um nó no mapa ou pesquise um arquivo para ver sua origem e suas conexões.', 'empty')); return; }
  const n = info.node;
  host.append(element('small', n.kind.toUpperCase()), element('h2', n.name, 'node-name'), element('p', n.path || 'Sem caminho no índice', 'path'));
  const actions = element('div', undefined, 'detail-actions');
  actions.append(button('Expandir conteúdo', () => expandSelected(true)), button('Ver dependências', () => expandSelected(false)),
    button('Recolher', () => { model.collapse(n.id); $('notice').textContent = ''; refresh(); }),
    button('Copiar caminho', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
        await navigator.clipboard.writeText(n.path || ''); $('notice').textContent = 'Caminho copiado.';
      } catch {
        const input = element('input', undefined, 'copy-fallback'); input.value = n.path || ''; input.readOnly = true;
        input.setAttribute('aria-label', 'Caminho para copiar manualmente'); actions.append(input); input.select();
        $('notice').textContent = 'Selecione o campo e use Ctrl+C para copiar o caminho.';
      }
    }));
  host.append(actions);
  host.append(element('h3', 'Origem e evidência'), element('p', `Origem: ${n.origin}\nResolução: ${n.resolution}\nExtrator: ${n.extractorVersion}\n${evidenceText(n.source)}`, 'kv'));
  if (n.partial) host.append(element('p', 'Módulo descoberto por diretório; não comprova consolidação de todas as responsabilidades.', 'kv'));
  host.append(element('h3', 'READMEs relacionados'));
  if (!info.readmes.length) host.append(element('p', 'Nenhum vínculo de README encontrado no índice.', 'kv'));
  for (const doc of info.readmes) { const b = button(doc.path, () => reveal(doc.id)); b.className = 'result'; host.append(b); }
  host.append(element('h3', `Relações diretas (${info.total})`));
  if (info.total > info.relations.length) host.append(element('p', `Exibindo ${info.relations.length} de ${info.total}; use os filtros para reduzir.`, 'kv'));
  for (const edge of info.relations) {
    const target = model.nodes.get(edge.from === n.id ? edge.to : edge.from);
    const row = element('div', undefined, 'relation');
    row.append(button(`${edge.from === n.id ? '→' : '←'} ${edge.type} · ${target?.name || 'Nó ausente'}`, () => reveal(target.id)));
    row.append(element('small', `${edge.origin} · ${edge.resolution}`));
    const ev = element('small', edge.evidence.map(evidenceText).join('\n')); ev.className = 'path'; row.append(ev); host.append(row);
  }
}
function search() {
  const result = model.search($('search').value), host = $('results'); host.replaceChildren();
  $('search-meta').textContent = ! $('search').value.trim() ? 'Busque por nome ou caminho.' :
    `${result.total} resultados${result.total > result.nodes.length ? ` · exibindo ${result.nodes.length}` : ''}`;
  for (const n of result.nodes) {
    const b = button(n.name, () => reveal(n.id)); b.className = 'result';
    b.append(element('small', `${n.kind} · ${n.path}`)); host.append(b);
  }
}
for (const kind of NODE_KINDS) {
  const label = element('label'), input = element('input'); input.type = 'checkbox'; input.checked = true;
  input.setAttribute('aria-label', `Mostrar ${names[kind]}`);
  input.addEventListener('change', () => { if (input.checked) model.kinds.add(kind); else model.kinds.delete(kind); search(); refresh(); });
  label.append(input, element('span', names[kind])); $('node-filters').append(label);
}
for (const kind of RELATION_KINDS) {
  const label = element('label'), input = element('input'); input.type = 'checkbox'; input.checked = true;
  input.setAttribute('aria-label', `Relação ${kind}`);
  input.addEventListener('change', () => { if (input.checked) model.relations.add(kind); else model.relations.delete(kind); refresh(); });
  const swatch = element('span', undefined, 'swatch'); swatch.style.backgroundColor = EDGE_COLORS[kind];
  label.append(input, swatch, element('span', relationNames[kind])); $('edge-filters').append(label);
}
$('search').addEventListener('input', search);
$('overview').addEventListener('click', () => {
  model.kinds.clear(); NODE_KINDS.forEach(k => model.kinds.add(k)); model.relations.clear(); RELATION_KINDS.forEach(k => model.relations.add(k));
  document.querySelectorAll('input[type=checkbox]').forEach(el => { el.checked = true; });
  $('search').value = ''; $('notice').textContent = ''; model.overview(); search(); refresh();
});
$('zoom-in').addEventListener('click', () => renderer.zoom(1.25));
$('zoom-out').addEventListener('click', () => renderer.zoom(0.8));
$('fit').addEventListener('click', () => renderer.fit());
new ResizeObserver(() => renderer.fit()).observe($('map'));
$('snapshot').textContent = `Validado ao gerar em ${new Date(graphData.generatedAt).toLocaleString('pt-BR')} · geração ${graphData.generation.slice(0, 12)}`;
$('snapshot').title = graphData.generation;
search(); refresh();
