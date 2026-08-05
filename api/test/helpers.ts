import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "../../db/migrations");

/**
 * Sobe um PGlite com o banco completo reconstruído a partir das migrations
 * reais (0000-0009). Isso garante que os testes rodam contra o mesmo DDL de
 * produção — qualquer divergência de coluna aparece aqui, não em produção.
 */
export async function setupDb() {
  const client = new PGlite();
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^00\d{2}_/.test(f) && f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
    const stmts = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    for (const st of stmts) {
      await client.exec(st);
    }
  }
  const db = drizzle(client);
  return { client, db };
}
