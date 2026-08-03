/**
 * Aplica as senhas extraídas (dump/passwords.json) no Postgres da VPS, mapeando
 * por EMAIL (mesma regra do load.js). Não muda IDs: só atualiza password_hash
 * dos usuários já existentes.
 *
 * USO (local ou na VPS):
 *   $env:DATABASE_URL="postgresql://postgres:...@localhost:5432/m7arena"
 *   node scripts/migrate/load-passwords.mjs
 *
 * Confere depois:
 *   SELECT count(*) FROM users WHERE password_hash IS NOT NULL;
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5433/m7arena";

const passwordsPath = path.join(__dirname, "dump", "passwords.json");
if (!fs.existsSync(passwordsPath)) {
  console.error(`[ETL LoadPasswords] dump/passwords.json não existe. Rode extract-passwords.mjs antes.`);
  process.exit(1);
}

const passwords = JSON.parse(fs.readFileSync(passwordsPath, "utf8"));
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });

let atualizados = 0;
let semMatch = 0;

for (const p of passwords) {
  const r = await pool.query(
    `UPDATE users SET password_hash = $1
     WHERE lower(email) = lower($2)`,
    [p.encryptedPassword, p.email]
  );
  if (r.rowCount > 0) atualizados++;
  else {
    semMatch++;
    console.log(`  sem usuário no destino: ${p.email}`);
  }
}

console.log(`[ETL LoadPasswords] ${atualizados} senhas aplicadas, ${semMatch} sem match no destino.`);
await pool.end();
