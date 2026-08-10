import { readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const BASE = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "images");
const TARGET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif"]);
const MIN_SIZE = 15 * 1024;

const files = (await readdir(BASE))
  .filter((f) => TARGET_EXTENSIONS.has(extname(f).toLowerCase()))
  .filter((f) => !f.toLowerCase().endsWith(".webp"));

const conversions = [];
const kept = [];

for (const file of files) {
  const inPath = join(BASE, file);
  const outPath = join(BASE, file.replace(/\.[^.]+$/, "") + ".webp");

  try {
    const inSize = (await stat(inPath)).size;
    if (inSize <= MIN_SIZE) {
      kept.push({ file, size: inSize, reason: `<=15KB (${inSize} bytes)` });
      continue;
    }

    await sharp(inPath).webp({ quality: 80 }).toFile(outPath);
    const outSize = (await stat(outPath)).size;

    if (outSize < inSize) {
      conversions.push({ file, inSize, outSize, saved: inSize - outSize });
    } else {
      await unlink(outPath).catch(() => {});
      kept.push({ file, size: inSize, reason: `webp ${outSize} >= original ${inSize}` });
    }
  } catch (err) {
    console.warn(`[warn] falha ao processar ${file}:`, err.message);
    try {
      const outPath = join(BASE, file.replace(/\.[^.]+$/, "") + ".webp");
      await unlink(outPath).catch(() => {});
    } catch {
      /* limpeza best-effort de webp residual */
    }
  }
}

console.log("\n=== CONVERSOES VENCEDORAS ===");
for (const c of conversions.sort((a, b) => b.saved - a.saved)) {
  console.log(`${c.file}\n  original: ${c.inSize} bytes -> webp: ${c.outSize} bytes (economia ${c.saved} bytes)`);
}

const totalSaved = conversions.reduce((sum, c) => sum + c.saved, 0);
console.log(`\nTOTAL ECONOMIZADO: ${totalSaved} bytes (${(totalSaved / 1024).toFixed(1)} KB / ${(totalSaved / 1024 / 1024).toFixed(2)} MB)`);
console.log(`Conversões vencedoras: ${conversions.length}`);

console.log("\n=== MANTIDOS ORIGINAIS ===");
for (const k of kept) {
  console.log(`${k.file} (${k.size} bytes) — ${k.reason}`);
}

await writeFile(
  join(dirname(fileURLToPath(import.meta.url)), "optimize-images-result.json"),
  JSON.stringify({ conversions, kept, totalSaved }, null, 2),
  "utf-8",
);
console.log("\nResultado salvo em web/scripts/optimize-images-result.json");
