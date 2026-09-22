/**
 * otimizar-imagens.mjs — migra imagens do Supabase para o volume local e
 * converte as imagens de EXIBIÇÃO já existentes para WebP redimensionado.
 *
 * Contexto: os logos de time ainda apontavam para o Supabase (URL legada da
 * migração) e os arquivos locais eram guardados crus (PNG/JPG de até 1,7 MB),
 * renderizados em ~40–120px. Resultado: ~1s de card preto esperando a imagem.
 *
 * O que faz, por referência de imagem (teams.logo_url, tournaments.logo_url,
 * tournaments.banner_url):
 *  - URL do Supabase → baixa, otimiza e grava no volume local; troca a URL.
 *  - URL local pesada → otimiza, grava `<nome>.webp` ao lado e troca a URL.
 *  - Já `.webp` e pequena → ignora (idempotente).
 * Propaga a URL nova para os snapshots que a repetem (tournament_standings.logo,
 * matches.time_a_logo/time_b_logo).
 *
 * NÃO toca em match-prints (prova de resultado).
 *
 * Uso (dentro do container da API, que tem DATABASE_URL, sharp e o volume):
 *   docker exec -w /app m7arena_app node otimizar-imagens.mjs --dry-run
 *   docker exec -w /app m7arena_app node otimizar-imagens.mjs
 */
const dryRun = process.argv.includes("--dry-run");

const pg = (await import("pg")).default;
const sharp = (await import("sharp")).default;
const fs = await import("node:fs/promises");
const path = await import("node:path");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/uploads";
const LADO_MAX = { "team-logos": 512, "public-images": 1920 };
// Abaixo disso a imagem já carrega rápido no tamanho em que é renderizada —
// não vale trocar a URL por ganho marginal.
const PESO_MINIMO = 30 * 1024;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
/** URL sem cache-buster (`?t=...`) — o arquivo em disco não tem a query. */
const semQuery = (url) => url.split("?")[0];

async function otimizar(buffer, bucket) {
  const lado = LADO_MAX[bucket] ?? 1920;
  return sharp(buffer)
    .rotate()
    .resize({ width: lado, height: lado, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

/** Baixa (se externo) ou lê do disco (se local) o conteúdo da imagem. */
async function lerImagem(url) {
  if (/^https?:\/\//i.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFile(path.join(UPLOAD_DIR, semQuery(url).replace(/^\/uploads\//, "")));
}

/** Caminho/URL de destino de uma imagem otimizada, seguindo a convenção de cada bucket. */
function destino(bucket, subpasta, nomeBase) {
  const rel = path.join(bucket, subpasta, `${nomeBase}.webp`);
  return { disco: path.join(UPLOAD_DIR, rel), url: `/uploads/${rel.split(path.sep).join("/")}` };
}

const relatorios = [];
let economizado = 0;

/** Otimiza uma referência e devolve a URL nova (ou null se nada a fazer). */
async function processar({ url, bucket, subpasta, nomeBase, origem }) {
  if (!url) return null;
  const externo = /^https?:\/\//i.test(url);

  // Arquivo local já convertido: nada a fazer (mantém o script idempotente).
  if (!externo && semQuery(url).endsWith(".webp")) return null;

  const antes = await lerImagem(url).catch((e) => {
    console.warn(`  ! falhou ler ${url}: ${e.message}`);
    return null;
  });
  if (!antes) return null;

  // Arquivo local já leve: não vale trocar a URL por ganho marginal.
  if (!externo && antes.length <= PESO_MINIMO) {
    relatorios.push(`  = ${origem} ${url} mantido (já leve: ${kb(antes.length)})`);
    return null;
  }

  let otimizada;
  try {
    otimizada = await otimizar(antes, bucket);
  } catch (e) {
    console.warn(`  ! sharp falhou em ${url}: ${e.message}`);
    return null;
  }

  const { disco, url: urlNova } = destino(bucket, subpasta, nomeBase);
  const economia = antes.length - otimizada.length;

  // Local: nunca piora (se o WebP não ficou menor, mantém o original).
  // Externo: SEMPRE traz para casa — o que importa é remover a dependência do
  // Supabase (o TTFB de 1,3s existe mesmo para arquivo pequeno).
  if (!externo && economia <= 0) {
    relatorios.push(`  = ${origem} ${url} mantido (webp ${kb(otimizada.length)} >= original ${kb(antes.length)})`);
    return null;
  }

  if (dryRun) {
    relatorios.push(`  [dry-run] ${origem} ${url}\n      -> ${urlNova} (${kb(antes.length)} -> ${kb(otimizada.length)})`);
    economizado += Math.max(0, economia);
    return urlNova;
  }

  await fs.mkdir(path.dirname(disco), { recursive: true });
  await fs.writeFile(disco, otimizada);
  relatorios.push(`  ${origem} ${url}\n      -> ${urlNova} (${kb(antes.length)} -> ${kb(otimizada.length)}, -${kb(economia)})`);
  economizado += Math.max(0, economia);
  return urlNova;
}

/** Troca a URL antiga pela nova em todas as colunas que guardam snapshots dela. */
async function propagar(urlAntiga, urlNova) {
  if (dryRun) return;
  await db.query(`UPDATE tournament_standings SET logo = $2 WHERE logo = $1`, [urlAntiga, urlNova]);
  await db.query(`UPDATE matches SET time_a_logo = $2 WHERE time_a_logo = $1`, [urlAntiga, urlNova]);
  await db.query(`UPDATE matches SET time_b_logo = $2 WHERE time_b_logo = $1`, [urlAntiga, urlNova]);
}

console.log(`\n=== OTIMIZAÇÃO/MIGRAÇÃO DE IMAGENS ${dryRun ? "(DRY-RUN)" : ""} ===\n`);

// ── Times ───────────────────────────────────────────────────────────────────
const times = (await db.query(`SELECT id, tag, logo_url FROM teams WHERE logo_url IS NOT NULL ORDER BY tag`)).rows;
console.log(`--- ${times.length} logos de time ---`);
for (const t of times) {
  const limpa = semQuery(t.logo_url);
  const nomeBase = path.basename(limpa, path.extname(limpa)) || `logo-${t.id}`;
  const urlNova = await processar({
    url: t.logo_url,
    bucket: "team-logos",
    subpasta: t.id,
    nomeBase,
    origem: `[${t.tag}]`,
  });
  if (urlNova && urlNova !== t.logo_url) {
    if (!dryRun) await db.query(`UPDATE teams SET logo_url = $2 WHERE id = $1`, [t.id, urlNova]);
    await propagar(t.logo_url, urlNova);
  }
}

// ── Campeonatos ─────────────────────────────────────────────────────────────
const camps = (await db.query(`SELECT id, name, logo_url, banner_url FROM tournaments`)).rows;
console.log(`\n--- ${camps.length} campeonatos ---`);
for (const c of camps) {
  for (const [campo, nomeBase] of [["logo_url", `${c.id}-logo`], ["banner_url", `${c.id}-banner`]]) {
    const urlAntiga = c[campo];
    const urlNova = await processar({
      url: urlAntiga,
      bucket: "public-images",
      subpasta: "campeonatos",
      nomeBase,
      origem: `[${c.name} ${campo}]`,
    });
    if (urlNova && urlNova !== urlAntiga) {
      if (!dryRun) await db.query(`UPDATE tournaments SET ${campo} = $2 WHERE id = $1`, [c.id, urlNova]);
      await propagar(urlAntiga, urlNova);
    }
  }
}

console.log(relatorios.join("\n"));

// Snapshots de classificação que ainda apontam para storage externo (logo de um
// time que já trocou de imagem e cujo arquivo antigo não é referenciado por
// ninguém): re-aponta para a logo ATUAL do time.
if (dryRun) {
  const { rows } = await db.query(
    `SELECT count(*)::int c FROM tournament_standings ts JOIN teams tm ON tm.id = ts.team_id
     WHERE ts.logo LIKE '%supabase%' AND tm.logo_url IS NOT NULL AND tm.logo_url NOT LIKE '%supabase%'`
  );
  console.log(`\nstandings a re-apontar para a logo atual do time: ${rows[0].c} (dry-run)`);
} else {
  const rep = await db.query(
    `UPDATE tournament_standings ts SET logo = tm.logo_url FROM teams tm
     WHERE ts.team_id = tm.id AND ts.logo LIKE '%supabase%'
       AND tm.logo_url IS NOT NULL AND tm.logo_url NOT LIKE '%supabase%'`
  );
  console.log(`\nstandings re-apontados para a logo atual do time: ${rep.rowCount}`);
}

console.log(`\nTotal economizado: ${kb(economizado)}`);
if (dryRun) console.log("(dry-run — nada foi gravado)");

await db.end();
