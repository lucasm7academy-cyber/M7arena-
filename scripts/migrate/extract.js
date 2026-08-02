/**
 * Script de Extração ETL do Supabase (mig.extract)
 * Extrai os dados das tabelas de produção para arquivos JSON locais em scripts/migrate/dump/
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://m7academy.pro';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake-key-for-extract';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES_TO_EXTRACT = [
  'profiles',
  'contas_riot',
  'wallets',
  'times',
  'time_membros',
  'campeonatos',
  'partidas',
  'noticias',
  'highlights',
];

export async function extract() {
  const dumpDir = path.join(__dirname, 'dump');
  if (!fs.existsSync(dumpDir)) {
    fs.mkdirSync(dumpDir, { recursive: true });
  }

  console.log('[ETL Extract] Iniciando extração do Supabase...');

  for (const table of TABLES_TO_EXTRACT) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`[ETL Extract] Erro ao extrair ${table}:`, error.message);
        fs.writeFileSync(path.join(dumpDir, `${table}.json`), JSON.stringify([], null, 2));
      } else {
        fs.writeFileSync(path.join(dumpDir, `${table}.json`), JSON.stringify(data || [], null, 2));
        console.log(`[ETL Extract] Table ${table}: ${(data || []).length} registros salvos em dump/${table}.json`);
      }
    } catch (err: any) {
      console.error(`[ETL Extract] Exceção em ${table}:`, err?.message);
    }
  }

  console.log('[ETL Extract] Extração concluída!');
}

extract().catch(console.error);
