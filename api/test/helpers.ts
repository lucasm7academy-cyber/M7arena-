import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedTestMatchCodes } from "./fixtures/reference-data.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "../../db/migrations");

/**
 * Reconstrói PGlite pela baseline e pelas migrations posteriores do journal.
 * Dados de jogadores/carteiras são fixtures dos testes; códigos são fictícios.
 * O catálogo estrutural da baseline foi comparado à produção, sem copiar dados.
 */
export async function setupDb() {
  const client = new PGlite();
  const db = drizzle(client);
  try {
    await migrate(db, { migrationsFolder: migrationsDir });
    await seedTestMatchCodes(db);
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}
