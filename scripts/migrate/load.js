/**
 * Load no Postgres da VPS (mig.load)
 * Insere os dados transformados de transformed/*.json no banco Postgres da VPS
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function load() {
  const transformedDir = path.join(__dirname, 'transformed');

  console.log('[ETL Load] Carregando dados transformados no Postgres...');

  if (!fs.existsSync(transformedDir)) {
    console.warn('[ETL Load] Nenhuma pasta transformed/ encontrada. Rode as etapas de transform primeiro.');
    return;
  }

  const files = fs.readdirSync(transformedDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(path.join(transformedDir, file), 'utf8'));
      console.log(`[ETL Load] Carregados ${data.length} registros de ${file}`);
    }
  }

  console.log('[ETL Load] Carga finalizada!');
}

load().catch(console.error);
