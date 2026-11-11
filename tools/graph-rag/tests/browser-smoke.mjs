// Smoke opcional em um Chrome/Edge já instalado, em processo headless separado.
// Não usa o perfil do proprietário, CDP, servidor, rede ou pacote adicional.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { visualize } from '../visualize.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const browser = process.argv[2];
if (!browser || !fs.existsSync(browser)) throw new Error('Informe o caminho absoluto de um Chrome/Edge já instalado.');
const result = visualize(root);
const original = fs.readFileSync(result.output, 'utf8');
const code = original.match(/<script>([\s\S]*?)<\/script>/)[1];
const smoke = `
(function () {
  const checks = [];
  const check = (ok, name) => { if (!ok) throw new Error(name); checks.push(name); };
  const click = text => { const b = [...document.querySelectorAll('button')].find(el => el.textContent === text); check(!!b, 'botao ' + text); b.click(); };
  const search = text => { const input = document.getElementById('search'); input.value = text; input.dispatchEvent(new Event('input', {bubbles:true})); };
  const mapped = () => [...document.querySelectorAll('[data-node-id]')];
  try {
    check(mapped().length > 0 && mapped().length <= 120, 'modulos iniciais e limite');
    check(mapped().every(n => n.getAttribute('data-node-id').startsWith('module:')), 'abertura progressiva');
    check(document.getElementById('map').getBoundingClientRect().width > 200, 'SVG com area real');
    search('api/src/modules/matches');
    const hit = [...document.querySelectorAll('#results button')].find(el => el.textContent.includes('Module'));
    check(!!hit, 'pesquisa de modulo real'); hit.click();
    check(document.querySelector('.node-name').textContent === 'matches', 'selecao e detalhes');
    click('Expandir conteúdo');
    check(mapped().some(n => n.getAttribute('data-node-id') === 'file:api/src/modules/matches/routes.ts'), 'expansao de arquivos');
    check(document.querySelector('#map path'), 'linhas de relacao reais');
    check(document.getElementById('detail-body').textContent.includes('SHA-256:'), 'proveniencia');
    const transform = document.querySelector('#map > g').getAttribute('transform');
    document.getElementById('zoom-in').click();
    check(transform !== document.querySelector('#map > g').getAttribute('transform'), 'zoom');
    const contains = document.querySelector('[aria-label="Relação CONTAINS"]');
    contains.click(); check(mapped().length === 1, 'filtro de relacao'); contains.click();
    click('Recolher'); check(mapped().length === 1, 'recolhimento');
    search('api/src/modules/matches/routes.ts');
    const file = [...document.querySelectorAll('#results button')].find(el => el.textContent.includes('File'));
    check(!!file, 'pesquisa de arquivo'); file.click();
    click('Ver dependências'); check(mapped().length > 1, 'dependencias sob demanda');
    check(document.getElementById('detail-body').textContent.includes('README.md'), 'README vinculado');
    const symbols = document.querySelector('[aria-label="Mostrar Símbolos"]'); symbols.click();
    check(mapped().every(n => !n.getAttribute('data-node-id').startsWith('symbol:')), 'filtro de no');
    click('↖ Voltar à visão geral'); check(mapped().every(n => n.getAttribute('data-node-id').startsWith('module:')), 'retorno a visao geral');
    check(document.querySelectorAll('input[type=checkbox]:not(:checked)').length === 0, 'restauracao dos filtros');
    document.body.setAttribute('data-browser-smoke', 'PASS');
    document.body.setAttribute('data-browser-checks', checks.length);
    // Deixa a captura em uma visão com relações e painel de evidência.
    search('api/src/modules/matches/routes.ts');
    [...document.querySelectorAll('#results button')].find(el => el.textContent.includes('File')).click();
    [...document.querySelectorAll('button')].find(el => el.textContent === 'Ver dependências').click();
    const boxes = mapped().map(n => n.getBoundingClientRect());
    check(boxes.every((a,i) => boxes.every((b,j) => i === j || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)), 'layout sem sobreposicao');
    document.body.setAttribute('data-browser-checks', checks.length);
  } catch(error) { document.body.setAttribute('data-browser-smoke', 'FAIL: ' + error.message); }
})();`;
const bundle = code + smoke;
const digest = value => createHash('sha256').update(value).digest('base64');
const testHtml = original.replace(`'sha256-${digest(code)}'`, `'sha256-${digest(bundle)}'`).replace(`<script>${code}</script>`, `<script>${bundle}</script>`);
const temporary = fs.realpathSync(os.tmpdir());
const base = fs.mkdtempSync(path.join(temporary, 'm7-graph-browser-'));
try {
  const fixture = path.join(base, 'smoke.html'); fs.writeFileSync(fixture, testHtml);
  const screenshot = path.join(path.dirname(result.output), 'preview.png');
  const output = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${path.join(base, 'profile')}`, '--window-size=1600,1000', '--virtual-time-budget=3000',
    `--screenshot=${screenshot}`, '--dump-dom', pathToFileURL(fixture).href], { encoding: 'utf8', timeout: 45000, maxBuffer: 40 * 1024 * 1024, windowsHide: true });
  if (output.error) throw output.error;
  assert.equal(output.status, 0, output.stderr.slice(-2000));
  const state = output.stdout.match(/data-browser-smoke="([^"]+)"/)?.[1];
  assert.equal(state, 'PASS', state || output.stderr.slice(-2000));
  console.log(JSON.stringify({ status: state, browserChecks: Number(output.stdout.match(/data-browser-checks="(\d+)"/)[1]),
    nodes: result.nodes, edges: result.edges, screenshot, html: result.output }));
} finally {
  const resolved = fs.realpathSync(base);
  assert.equal(path.dirname(resolved), temporary); assert(path.basename(resolved).startsWith('m7-graph-browser-'));
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
