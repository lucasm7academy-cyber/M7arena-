export const NODE_COLORS = { Module: '#52d6c8', File: '#84aaff', Symbol: '#d4a0ff', Document: '#ffc16c' };
export const EDGE_COLORS = { CONTAINS: '#526882', IMPORTS: '#84aaff', IMPORTS_TYPE: '#d4a0ff',
  IMPORTS_DYNAMIC: '#f59fa8', EXPORTS: '#52d6c8', ALIASES: '#b8c6d8', DOCUMENTED_BY: '#ffc16c' };

export function createMapRenderer(svg, onSelect, onExpand) {
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs = {}) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  const scene = make('g'); svg.append(scene);
  let positions = new Map(), current = { nodes: [], edges: [] }, selected, scale = 1, tx = 0, ty = 0, drag;
  const camera = () => scene.setAttribute('transform', `translate(${tx} ${ty}) scale(${scale})`);
  const size = () => ({ w: svg.clientWidth || 800, h: svg.clientHeight || 600 });
  function fit() {
    if (!positions.size) return;
    const xs = [...positions.values()].map(p => p.x), ys = [...positions.values()].map(p => p.y);
    const left = Math.min(...xs) - 125, top = Math.min(...ys) - 45;
    const width = Math.max(...xs) + 125 - left, height = Math.max(...ys) + 45 - top;
    const { w, h } = size(); scale = Math.min(1.35, (w - 70) / width, (h - 70) / height);
    tx = (w - width * scale) / 2 - left * scale; ty = (h - height * scale) / 2 - top * scale; camera();
  }
  function zoom(factor, x = size().w / 2, y = size().h / 2) {
    const next = Math.max(0.12, Math.min(3, scale * factor));
    tx = x - (x - tx) * next / scale; ty = y - (y - ty) * next / scale; scale = next; camera();
  }
  function layout(nodes) {
    const count = nodes.length, viewport = size();
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * viewport.w / viewport.h * 130 / 285)));
    const slots = nodes.map((_, i) => ({ x: (i % cols) * 285, y: Math.floor(i / cols) * 130 }));
    const ordered = [...nodes];
    if (selected) {
      const cx = (cols - 1) * 285 / 2, cy = (Math.ceil(count / cols) - 1) * 130 / 2;
      slots.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
      ordered.sort((a, b) => Number(b.id === selected) - Number(a.id === selected));
    }
    // Grade estável sem colisões; o usuário pode reorganizar os nós por arraste.
    positions = new Map(ordered.map((n, i) => [n.id, slots[i]]));
  }
  function paint() {
    scene.replaceChildren();
    for (const e of current.edges) {
      const a = positions.get(e.from), b = positions.get(e.to); if (!a || !b) continue;
      const active = e.from === selected || e.to === selected;
      const line = make('path', { d: `M${a.x} ${a.y} L${b.x} ${b.y}`, fill: 'none', stroke: EDGE_COLORS[e.type],
        'stroke-width': active ? 2.5 : 1.3, opacity: active ? 1 : 0.2,
        'stroke-dasharray': ['IMPORTS_TYPE', 'DOCUMENTED_BY'].includes(e.type) ? '6 5' : 'none' });
      const title = make('title'); title.textContent = `${e.type}: ${e.from} → ${e.to}`; line.append(title); scene.append(line);
      const angle = Math.atan2(b.y - a.y, b.x - a.x), x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      scene.append(make('path', { d: `M${x - 8 * Math.cos(angle - 0.5)} ${y - 8 * Math.sin(angle - 0.5)} L${x} ${y} L${x - 8 * Math.cos(angle + 0.5)} ${y - 8 * Math.sin(angle + 0.5)}`, fill: 'none', stroke: EDGE_COLORS[e.type] }));
    }
    for (const n of current.nodes) {
      const p = positions.get(n.id), g = make('g', { transform: `translate(${p.x} ${p.y})`, role: 'button', tabindex: '0', 'aria-label': `${n.kind}: ${n.name}`, 'data-node-id': n.id, class: 'map-node' });
      g.append(make('rect', { x: -112, y: -29, width: 224, height: 58, rx: n.kind === 'Module' ? 16 : 7,
        fill: n.id === selected ? '#233e53' : '#142437', stroke: NODE_COLORS[n.kind], 'stroke-width': n.id === selected ? 3 : 1 }));
      const heading = make('text', { x: -98, y: -9, fill: NODE_COLORS[n.kind], 'font-size': 10 });
      heading.textContent = n.kind.toUpperCase() + (n.kind === 'Module' ? (n.path.startsWith('api/') ? ' · API' : ' · WEB') : '');
      const label = make('text', { x: -98, y: 13, fill: '#eef5ff', 'font-size': 12 });
      label.textContent = n.name.length > 28 ? n.name.slice(0, 26) + '…' : n.name;
      const title = make('title'); title.textContent = `${n.name}\n${n.path}`;
      g.append(heading, label, title);
      g.addEventListener('click', () => { if (!drag?.moved) onSelect(n.id); });
      g.addEventListener('dblclick', () => onExpand(n.id));
      g.addEventListener('keydown', e => { if (e.key === 'Enter') onSelect(n.id); if (e.key === ' ') { e.preventDefault(); onExpand(n.id); } });
      scene.append(g);
    }
    camera();
  }
  svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, tx, ty, node: e.target.closest('[data-node-id]')?.getAttribute('data-node-id'), moved: false };
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; svg.setPointerCapture(e.pointerId); }
    if (!drag.moved) return;
    if (drag.node) { const p = positions.get(drag.node); p.x += dx / scale; p.y += dy / scale; drag.x = e.clientX; drag.y = e.clientY; paint(); }
    else { tx = drag.tx + dx; ty = drag.ty + dy; camera(); }
  });
  const end = () => { const previous = drag; setTimeout(() => { if (drag === previous) drag = null; }, 0); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  return { fit, zoom, draw(view, id, arrange = true) { current = view; selected = id; if (arrange) layout(view.nodes); paint(); if (arrange) fit(); } };
}
