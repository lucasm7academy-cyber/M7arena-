/**
 * Extrai as senhas (encrypted_password) direto do Postgres do Supabase (BLK-001).
 *
 * CONTEXTO: a service role key via PostgREST NÃO expõe o schema auth. O caminho
 * correto é conectar direto no banco (pooler session mode, porta 5432) e ler
 * auth.users.encrypted_password. Os hashes são bcrypt $2a$10$ e continuam válidos
 * no novo app (bcrypt.compare em api/src/routes/auth.ts).
 *
 * USO:
 *   node scripts/migrate/extract-passwords.mjs  (gera dump/passwords.json)
 *
 * SAÍDA: scripts/migrate/dump/passwords.json
 *   [{ id, email, encryptedPassword, provider }] — só os que têm senha (provider 'email').
 *
 * CREDENCIAL: connection string no painel do Supabase (Settings > Database).
 * A string que já foi usada (projeto BR, pooler session 5432):
 *   postgresql://postgres.bfsusctegzvfrlehhink:<SENHA>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Preenche via env para não versionar a senha: $env:SUPABASE_DB_URL
const CONN = process.env.SUPABASE_DB_URL;

if (!CONN) {
  console.error(
    "[ETL Passwords] Defina SUPABASE_DB_URL com a connection string do Postgres do Supabase " +
      "(pooler session mode, porta 5432). Ex.:\n" +
      '  $env:SUPABASE_DB_URL="postgresql://postgres.bfsusctegzvfrlehhink:SENHA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"'
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: CONN, max: 2 });

async function main() {
  const { rows } = await pool.query(`
    SELECT
      id,
      email,
      encrypted_password AS "encryptedPassword",
      raw_app_meta_data->>'provider' AS provider
    FROM auth.users
    WHERE encrypted_password IS NOT NULL AND encrypted_password <> ''
  `);

  const out = path.join(__dirname, "dump", "passwords.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(rows, null, 2));

  console.log(`[ETL Passwords] ${rows.length} usuários com senha extraídos -> dump/passwords.json`);
  await pool.end();
}

main().catch((e) => {
  console.error("[ETL Passwords] ERRO:", e.message);
  process.exit(1);
});
