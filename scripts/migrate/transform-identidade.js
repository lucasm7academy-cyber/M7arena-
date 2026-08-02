/**
 * Transform: Identidade (mig.identidade)
 * Mapeia os dados legados de perfis, wallets, contas_riot, discord_links para a nova estrutura de schema Drizzle
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function transformIdentidade() {
  const dumpDir = path.join(__dirname, 'dump');
  const outDir = path.join(__dirname, 'transformed');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('[ETL Transform] Mapeando tabela de Identidade...');

  const profilesPath = path.join(dumpDir, 'profiles.json');
  const profiles = fs.existsSync(profilesPath) ? JSON.parse(fs.readFileSync(profilesPath, 'utf8')) : [];

  const usersTransformed = profiles.map((p) => ({
    id: p.id,
    email: p.email || `${p.id}@m7arena.pro`,
    displayName: p.nome || p.riot_id || 'Jogador',
    avatarUrl: p.avatar_url || null,
    bio: p.bio || null,
    isVip: !!p.is_vip,
    status: 'active',
    createdAt: p.created_at || new Date().toISOString(),
    updatedAt: p.updated_at || new Date().toISOString(),
  }));

  fs.writeFileSync(path.join(outDir, 'users.json'), JSON.stringify(usersTransformed, null, 2));
  console.log(`[ETL Transform] ${usersTransformed.length} usuários transformados com sucesso!`);
}

transformIdentidade();
