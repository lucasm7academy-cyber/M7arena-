import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { hash, slash, VERSION, fail } from './model.mjs';

const require = createRequire(import.meta.url);
export const ts = require('typescript');
const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const codeExtension = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const blocked = new Set(['node_modules', 'dist', '.git', 'cache', 'caches', 'historico', 'historical', 'assets', 'images']);
const sensitive = name => /^\.env(?:\.|$)|^(?:credentials?|secrets?)(?:\.|$)/i.test(name);
export function allowedSource(rel) {
  if (path.isAbsolute(rel) || rel.includes('\\') || rel.split('/').some(p => p === '..' || blocked.has(p) || sensitive(p))) return false;
  if (['docs/INDEX.md', 'docs/modules/INDEX.md'].includes(rel)) return true;
  if (!/^(?:web\/src\/|api\/src\/|api\/test\/|db\/schema\/)/.test(rel)) return false;
  return codeExtension.test(rel) || (/\/README\.md$/.test(rel) && /^(web\/src\/features\/|api\/src\/modules\/|web\/src\/test\/)/.test(rel));
}
export const inside = (base, target) => {
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
};

export function canonicalRoot(root) {
  const result = fs.realpathSync(path.resolve(root));
  if (!fs.statSync(result).isDirectory()) throw fail('ROOT_INVALID', 'Raiz inválida.');
  return result;
}

function walk(root, rel, files) {
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.isSymbolicLink() || blocked.has(entry.name) || sensitive(entry.name)) continue;
    const name = slash(path.join(rel, entry.name));
    if (entry.isDirectory()) walk(root, name, files);
    else if (entry.isFile() && (codeExtension.test(name) ||
      (entry.name === 'README.md' && /^(web\/src\/features\/|api\/src\/modules\/|web\/src\/test\/)/.test(name)))) files.add(name);
  }
}

export function readSource(root, rel) {
  const target = path.resolve(root, rel);
  if (!inside(root, target) || !inside(root, fs.realpathSync(target)) || fs.lstatSync(target).isSymbolicLink()) {
    throw fail('SOURCE_OUTSIDE_SCOPE', 'Fonte fora da raiz permitida.', { path: rel });
  }
  return fs.readFileSync(target, 'utf8');
}

function gitState(root, sources) {
  try {
    const run = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const tracked = new Set(run(['ls-files', '-z']).split('\0'));
    const dirty = run(['status', '--porcelain=v1', '-z', '--untracked-files=all']).split('\0');
    const states = new Map();
    for (let i = 0; i < dirty.length; i++) {
      const row = dirty[i];
      if (!row) continue;
      states.set(row.slice(3), row.slice(0, 2));
      if (row[0] === 'R' || row[0] === 'C') i++;
    }
    return { head: run(['rev-parse', 'HEAD']).trim(), files: Object.fromEntries(sources.map(p =>
      [p, { tracked: tracked.has(p), state: states.get(p) || (tracked.has(p) ? 'clean' : 'untracked') }])) };
  } catch {
    return { head: null, files: Object.fromEntries(sources.map(p => [p, { tracked: null, state: 'unknown' }])) };
  }
}

export function projectSettings(root, area, configurations) {
  const configPath = path.join(root, area, 'tsconfig.json');
  if (!fs.existsSync(configPath)) return { options: { moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } };
  const read = file => {
    const absolute = path.resolve(file);
    if (inside(root, absolute) && !slash(absolute).includes('/node_modules/')) {
      configurations[slash(path.relative(root, absolute))] = hash(fs.readFileSync(absolute));
    }
    return ts.sys.readFile(file);
  };
  const loaded = ts.readConfigFile(configPath, read);
  if (loaded.error) throw fail('CONFIG_INVALID', ts.flattenDiagnosticMessageText(loaded.error.messageText, ' '));
  const parsed = ts.parseJsonConfigFileContent(loaded.config, { ...ts.sys, readFile: read }, path.dirname(configPath), {}, configPath);
  const errors = parsed.errors.filter(e => e.code !== 18003);
  if (errors.length) throw fail('CONFIG_INVALID', errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, ' ')).join('; '));
  return { options: { ...parsed.options, noEmit: true }, configPath };
}

export function scan(rootInput) {
  const root = canonicalRoot(rootInput), names = new Set();
  for (const rel of ['web/src', 'api/src', 'api/test', 'db/schema']) walk(root, rel, names);
  for (const rel of ['docs/INDEX.md', 'docs/modules/INDEX.md']) if (fs.existsSync(path.join(root, rel))) names.add(rel);
  const files = [...names].filter(allowedSource).sort();
  const hashes = Object.fromEntries(files.map(p => [p, hash(readSource(root, p))]));
  const configurations = {};
  for (const p of ['package.json', 'package-lock.json', 'web/package.json', 'web/package-lock.json', 'api/package.json', 'api/package-lock.json', 'tsconfig.json']) {
    if (fs.existsSync(path.join(root, p))) configurations[p] = hash(readSource(root, p));
  }
  const projects = Object.fromEntries(['web', 'api'].map(area => [area, projectSettings(root, area, configurations)]));
  const extractorHash = hash(fs.readdirSync(toolRoot).filter(n => n.endsWith('.mjs')).sort()
    .map(n => `${n}:${hash(fs.readFileSync(path.join(toolRoot, n)))}`).join('\n'));
  const fingerprint = hash(JSON.stringify({ hashes, configurations, compilerVersion: ts.version, extractorHash, version: VERSION }));
  return { root, files, hashes, configurations, projects, compilerVersion: ts.version,
    extractorHash, fingerprint, git: gitState(root, files) };
}
