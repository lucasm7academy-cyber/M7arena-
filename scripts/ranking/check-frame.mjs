#!/usr/bin/env node
/**
 * check-frame.mjs — valida uma arte de moldura do ranking contra a planta
 * canônica (docs/ranking/MOLDURA_RANKING.md).
 *
 * Uso:  node scripts/ranking/check-frame.mjs <arte.png|webp>
 *
 * Mede o buraco central (alpha 0) por flood fill a partir do centro, compara
 * com o padrão e grava ao lado da imagem um `<arte>-guia.png` com as guias.
 *
 * O `sharp` é o da API (não existe node_modules na raiz).
 */
import sharp from '../../api/node_modules/sharp/dist/index.mjs';
import path from 'node:path';

const W = 1024;
const H = 1536;
const CIRCULO = { cx: 512, cy: 770, d: 600 };
const PLACA = { x: 216, y: 1048, w: 592, h: 96 };
const BOXES = [
  { x: 177, w: 208 },
  { x: 408, w: 208 },
  { x: 639, w: 208 },
];
const FAIXA = { y: 1171, h: 184 };
const VALOR_Y = 1290;
const TOL_CENTRO = 15;
const TOL_DIAMETRO = 25;

const arquivo = process.argv[2];
if (!arquivo) {
  console.error('uso: node scripts/ranking/check-frame.mjs <arte.png>');
  process.exit(1);
}

const { data, info } = await sharp(arquivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const alpha = (x, y) => data[(y * w + x) * 4 + 3];

const problemas = [];
if (w !== W || h !== H) problemas.push(`tela ${w}x${h} (padrão ${W}x${H})`);

// Flood fill do buraco a partir do centro (não vaza pro fundo externo porque só
// anda dentro da região conectada ao centro).
const dentro = new Uint8Array(w * h);
const pilha = [[CIRCULO.cx, CIRCULO.cy]];
let n = 0;
while (pilha.length) {
  const [x, y] = pilha.pop();
  if (x < 0 || y < 0 || x >= w || y >= h) continue;
  const p = y * w + x;
  if (dentro[p] || alpha(x, y) >= 16) continue;
  dentro[p] = 1;
  n++;
  pilha.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

// diâmetro = linha com mais pixels do buraco; centro = média dessa linha
let diametro = 0;
let cy = CIRCULO.cy;
let cx = CIRCULO.cx;
if (n > 0) {
  for (let y = 0; y < h; y++) {
    let soma = 0;
    let cont = 0;
    for (let x = 0; x < w; x++) {
      if (dentro[y * w + x]) {
        soma += x;
        cont++;
      }
    }
    if (cont > diametro) {
      diametro = cont;
      cy = y;
      cx = soma / cont;
    }
  }
}

const pct = (v) => ((v * 100) / w).toFixed(2) + '%';
console.log('arquivo:', path.basename(arquivo));
console.log('tela:', `${w}x${h}`);

if (n === 0) {
  console.log('BURACO: nenhum pixel transparente no centro — o círculo da logo não está vazado.');
  problemas.push('sem buraco transparente');
} else {
  const dx = cx - CIRCULO.cx;
  const dy = cy - CIRCULO.cy;
  const dd = diametro - CIRCULO.d;
  console.log(`buraco: centro (${cx.toFixed(1)}, ${cy}) · diâmetro ${diametro}px (${pct(diametro)} da largura)`);
  console.log(`desvio: centro x ${dx >= 0 ? '+' : ''}${dx.toFixed(1)}px · y ${dy >= 0 ? '+' : ''}${dy.toFixed(1)}px · diâmetro ${dd >= 0 ? '+' : ''}${dd}px`);
  if (Math.abs(dx) > TOL_CENTRO || Math.abs(dy) > TOL_CENTRO) problemas.push(`centro do círculo fora de ±${TOL_CENTRO}px`);
  if (Math.abs(dd) > TOL_DIAMETRO) problemas.push(`diâmetro do círculo fora de ±${TOL_DIAMETRO}px`);
}

const guia = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${CIRCULO.cx}" cy="${CIRCULO.cy}" r="${CIRCULO.d / 2}" fill="none" stroke="#ff00ff" stroke-width="4" stroke-dasharray="12 8"/>
  <rect x="${PLACA.x}" y="${PLACA.y}" width="${PLACA.w}" height="${PLACA.h}" fill="none" stroke="#00ff88" stroke-width="4" stroke-dasharray="12 8"/>
  ${BOXES.map((b) => `<rect x="${b.x}" y="${FAIXA.y}" width="${b.w}" height="${FAIXA.h}" fill="none" stroke="#00d5ff" stroke-width="4" stroke-dasharray="12 8"/>
  <line x1="${b.x}" y1="${VALOR_Y}" x2="${b.x + b.w}" y2="${VALOR_Y}" stroke="#00d5ff" stroke-width="2"/>`).join('')}
  <line x1="0" y1="${CIRCULO.cy}" x2="${w}" y2="${CIRCULO.cy}" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1"/>
  <line x1="${CIRCULO.cx}" y1="0" x2="${CIRCULO.cx}" y2="${h}" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1"/>
</svg>`;

const saida = arquivo.replace(/\.(png|webp|jpe?g)$/i, '-guia.png');
const plano = await sharp(arquivo).ensureAlpha().flatten({ background: '#101014' }).png().toBuffer();
await sharp(plano).composite([{ input: Buffer.from(guia) }]).toFile(saida);
console.log('guia salva em:', saida);

if (problemas.length) {
  console.log('\nAJUSTAR:');
  problemas.forEach((p) => console.log(' -', p));
  process.exitCode = 1;
} else {
  console.log('\nOK — dentro da planta canônica.');
}
