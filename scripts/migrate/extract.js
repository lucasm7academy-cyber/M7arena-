/**
 * Extract real do Supabase (mig.extract)
 * Usa a service role key para puxar auth.users (emails) + tabelas de dados.
 * Saída: scripts/migrate/dump/*.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bfsusctegzvfrlehhink.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
  "profiles",
  "contas_riot",
  "wallets",
  "times",
  "time_membros",
  "time_convites",
  "discord_links",
  "campeonatos",
];

const dumpDir = path.join(__dirname, "dump");
fs.mkdirSync(dumpDir, { recursive: true });

// 1. auth.users → emails reais
async function extractAuthUsers() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    all.push(...data.users);
    if (data.users.length === 0 || all.length >= data.total) break;
  }
  const slim = all.map((u) => ({
    id: u.id,
    email: u.email,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at,
    provider: u.app_metadata?.provider ?? null,
  }));
  fs.writeFileSync(path.join(dumpDir, "auth_users.json"), JSON.stringify(slim, null, 2));
  console.log(`[ETL Extract] auth_users: ${slim.length} registros`);
}

// 2. Tabelas de dados (paginação de 1000)
async function extractTable(table) {
  const all = [];
  let from = 0;
  const pageSize = 1000;
  for (let i = 0; i < 200; i++) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  fs.writeFileSync(path.join(dumpDir, `${table}.json`), JSON.stringify(all, null, 2));
  console.log(`[ETL Extract] ${table}: ${all.length} registros`);
}

await extractAuthUsers();
for (const table of TABLES) {
  await extractTable(table);
}

console.log("[ETL Extract] Extração concluída!");
