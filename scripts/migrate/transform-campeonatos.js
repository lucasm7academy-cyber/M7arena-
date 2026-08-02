/**
 * Transform: Campeonatos (mig.campeonatos)
 * Explode o JSONB legado de campeonatos para tabelas relacionais do schema Drizzle
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function transformCampeonatos() {
  const dumpDir = path.join(__dirname, 'dump');
  const outDir = path.join(__dirname, 'transformed');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('[ETL Transform] Explodindo JSONB de Campeonatos...');

  const campsPath = path.join(dumpDir, 'campeonatos.json');
  const camps = fs.existsSync(campsPath) ? JSON.parse(fs.readFileSync(campsPath, 'utf8')) : [];

  const tournamentsTransformed = camps.map((c) => ({
    id: c.id,
    gameId: 'lol',
    name: c.titulo,
    slug: (c.titulo || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: c.frase || null,
    format: c.formato || 'single_elimination',
    status: c.status === 'inscricoes_abertas' ? 'open' : c.status === 'em_andamento' ? 'active' : 'upcoming',
    entryFeeMp: c.taxa ? parseInt(c.taxa, 10) || 0 : 0,
    prizePoolMp: c.premiacao ? parseInt(c.premiacao, 10) || 0 : 0,
    createdAt: c.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  fs.writeFileSync(path.join(outDir, 'tournaments.json'), JSON.stringify(tournamentsTransformed, null, 2));
  console.log(`[ETL Transform] ${tournamentsTransformed.length} campeonatos transformados com sucesso!`);
}

transformCampeonatos();
