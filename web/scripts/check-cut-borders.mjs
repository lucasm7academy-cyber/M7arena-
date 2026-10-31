#!/usr/bin/env node
// Portão anti-regressão dos cantos recortados.
//
// clip-path recorta o próprio elemento — inclusive a `border`. Resultado: o
// canto fica sem borda, "estilhaçado". Já aconteceu várias vezes no projeto
// (logo do time no /perfil, setas das partidas finalizadas no /jogar, botões
// Last/Last Pick, pills MD1/MD3/MD5...).
//
// Como corrigir: docs/CANTOS_RECORTADOS.md.
//   ❌ <div className="border border-white/10" style={{ clipPath: CUT }} />
//   ✅ <div className="p-[1px] bg-white/10" style={{ clipPath: CUT }}>
//        <div style={{ clipPath: CUT_INNER }}>...</div>
//      </div>
//
// Uso: node scripts/check-cut-borders.mjs [diretório...]   (default: src)
// Sai com código 1 se encontrar alguma ocorrência.

import fs from 'node:fs';
import path from 'node:path';

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['src'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx|jsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

// Lê um "open tag" JSX a partir do '<', respeitando strings e chaves.
function readTag(src, start) {
  let i = start + 1;
  let braces = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
    if (c === '{') { braces++; i++; continue; }
    if (c === '}') { braces--; i++; continue; }
    if (c === '>' && braces === 0) return { text: src.slice(start, i + 1), end: i + 1 };
    i++;
  }
  return null;
}

// Classes do Tailwind que pintam borda de verdade (ignora border-opacity,
// border-spacing, border-collapse e border-radius).
function isBorderClass(token) {
  const base = token.slice(token.lastIndexOf(':') + 1);
  if (base === 'border') return true;
  if (!base.startsWith('border-')) return false;
  return !/^border-(opacity|spacing|collapse|separate|radius)(-|$)/.test(base);
}

const STYLE_BORDER = /\bborder\s*:|\bborder(?:Top|Right|Bottom|Left)(?:Width|Style)?\s*:/;

const findings = [];

for (const file of roots.flatMap((r) => walk(r))) {
  const src = fs.readFileSync(file, 'utf8');
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;

  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '<') continue;
    const next = src[i + 1];
    if (!next || !/[A-Za-z/>]/.test(next)) continue;

    const tag = readTag(src, i);
    if (!tag) break;
    i = tag.end - 1;

    if (!tag.text.includes('clipPath') && !tag.text.includes('clip-path')) continue;

    const classMatch = tag.text.match(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]*?)\})\s*(?=[a-zA-Z]|>)/);
    const classText = classMatch ? (classMatch[1] ?? classMatch[2] ?? classMatch[3] ?? '') : '';
    const tokens = classText.split(/[\s`{}()'"+?&|]+/).filter(Boolean);
    const badClass = tokens.find(isBorderClass);
    const badStyle = STYLE_BORDER.test(tag.text) ? (tag.text.match(STYLE_BORDER) || [])[0] : null;

    if (!badClass && !badStyle) continue;

    findings.push({
      file,
      line: lineOf(i),
      reason: badClass ? `classe "${badClass}"` : `style "${badStyle}"`,
      snippet: tag.text.replace(/\s+/g, ' ').slice(0, 160),
    });
  }
}

if (findings.length === 0) {
  console.log('OK — nenhum <elemento clipPath + border> encontrado.');
  process.exit(0);
}

console.error(`\n${findings.length} elemento(s) com clip-path + border (a borda morre no canto recortado):\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  [${f.reason}]`);
  console.error(`      ${f.snippet}`);
}
console.error('\nUse moldura: p-[Npx] + clip externo, fill com clip interno (docs/CANTOS_RECORTADOS.md).\n');
process.exit(1);
