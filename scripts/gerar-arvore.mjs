import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const outputPath = 'docs/ARVORE.txt';

// Exclusões explícitas: não dependem de Git e não escondem fontes não rastreadas.
const excludedNames = new Set([
  '.git', 'node_modules', 'vendor', '.pnp', '.pnp.js', '.pnp.cjs', '.pnp.loader.mjs',
  'dist', 'build', 'coverage', '.nyc_output', '.next', '.nuxt', '.output', '.svelte-kit',
  'cache', 'caches', '.cache', '.vite', '.vite-temp', '.turbo', '.parcel-cache',
  '.pnpm-store', '__pycache__', '.venv', 'venv', 'tmp', 'temp',
  'logs', 'uploads', 'dump', 'backup', 'backups',
  '.vscode', '.idea', '.claude', '.codex', '.ds_store', 'thumbs.db', 'desktop.ini',
  'optimize-images-result.json',
]);

function excluded(name) {
  const lower = name.toLowerCase();
  return excludedNames.has(lower) || lower.startsWith('.aider') ||
    (/^\.env(?:\.|$)/i.test(name) && !/\.(example|sample|template)$/i.test(name)) ||
    /(?:~|\.(?:tmp|temp|swp|swo|bak|log|tsbuildinfo|dump|pem|key)|\.sql\.gz|\.tar\.gz)$/i.test(name);
}

const compare = (a, b) => a === b ? 0 : a < b ? -1 : 1;
const order = (a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) ||
  compare(a.name.toLowerCase(), b.name.toLowerCase()) || compare(a.name, b.name);

export function generateTree(root = projectRoot) {
  const absoluteRoot = fs.realpathSync(root);
  const lines = [`${path.basename(absoluteRoot)}/`];

  function walk(directory, prefix) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .filter(entry => !excluded(entry.name))
      .sort(order);
    entries.forEach((entry, index) => {
      const last = index === entries.length - 1;
      const directoryEntry = entry.isDirectory() && !entry.isSymbolicLink();
      lines.push(`${prefix}${last ? '└── ' : '├── '}${entry.name}${directoryEntry ? '/' : ''}`);
      // Junctions/links são folhas: não percorremos dependências ou alvos externos.
      if (directoryEntry) walk(path.join(directory, entry.name), prefix + (last ? '    ' : '│   '));
    });
  }

  walk(absoluteRoot, '');
  return lines.join('\n') + '\n';
}

function readOutput(root) {
  try { return fs.readFileSync(path.join(root, outputPath), 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function checkTree(root = projectRoot) {
  const current = readOutput(root);
  return current !== null && current === generateTree(root);
}

export function updateTree(root = projectRoot) {
  const docs = path.join(root, 'docs');
  const output = path.join(root, outputPath);
  for (const target of [docs, output]) {
    let stat;
    try { stat = fs.lstatSync(target); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error(`Destino não pode ser link: ${target}`);
  }
  fs.mkdirSync(docs, { recursive: true });
  // A saída deve existir durante a leitura para constar já na primeira geração.
  if (readOutput(root) === null) fs.writeFileSync(output, '', { flag: 'wx' });
  const expected = generateTree(root);
  if (readOutput(root) === expected) return false;
  fs.writeFileSync(output, expected, 'utf8');
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args.length === 0) {
      console.log(updateTree() ? `${outputPath} atualizada.` : `${outputPath} já está atualizada.`);
    } else if (args.length === 1 && args[0] === '--check') {
      const current = checkTree();
      console.log(current ? `${outputPath} está atualizada.` : `${outputPath} ausente ou desatualizada. Execute node scripts/gerar-arvore.mjs.`);
      process.exitCode = current ? 0 : 1;
    } else if (args.length === 1 && args[0] === '--help') {
      console.log('Uso: node scripts/gerar-arvore.mjs [--check]');
    } else {
      throw new Error('Uso: node scripts/gerar-arvore.mjs [--check]');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
