/**
 * Transform: Identidade (mig.identidade)
 * Base = auth_users (email real, via service role). Enriquecida por profiles.
 * Gera users.json, game_accounts.json, user_wallets.json com os IDs ORIGINAIS
 * do Supabase preservados (é o que mantém o vínculo times → dono).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dumpDir = path.join(__dirname, "dump");
const outDir = path.join(__dirname, "transformed");

function readDump(name) {
  const p = path.join(dumpDir, `${name}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : [];
}

const authUsers = readDump("auth_users");
const profiles = readDump("profiles");
const contasRiot = readDump("contas_riot");
const wallets = readDump("wallets");

const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

// 1. users: todos do auth_users + dados do profile quando existir
const users = authUsers.map((u) => {
  const p = profileById[u.id];
  const [nomeExibicao = null, riotId = null] = [p?.nome_exibicao ?? null, null];
  return {
    id: u.id,
    email: u.email.toLowerCase(),
    passwordHash: null, // BLK-001: hashes vivem em auth.users.encrypted_password (inalcançável via API)
    displayName: p?.nome_exibicao || (u.email ? u.email.split("@")[0] : "Jogador"),
    avatarUrl: p?.avatar_url ?? null,
    bio: p?.bio ?? null,
    socials: {
      ...(p?.instagram ? { instagram: p.instagram } : {}),
      ...(p?.twitch ? { twitch: p.twitch } : {}),
      ...(p?.discord ? { discord: p.discord } : {}),
      ...(p?.youtube ? { youtube: p.youtube } : {}),
    },
    lanePrimary: p?.lane_primaria ?? null,
    laneSecondary: p?.lane_secundaria ?? null,
    isVip: !!p?.is_vip,
    vipExpiresAt: p?.vip_expira_em ?? null,
    emailVerified: u.createdAt ?? null,
    status: "active",
    createdAt: p?.created_at ?? u.createdAt ?? new Date().toISOString(),
    updatedAt: p?.updated_at ?? u.createdAt ?? new Date().toISOString(),
  };
});

// 2. game_accounts: contas_riot → game_accounts (LoL)
const gameAccounts = contasRiot
  .filter((c) => authUsers.some((u) => u.id === c.user_id))
  .map((c) => {
    const riotId = c.riot_id || (c.nickname ? `${c.nickname}#BR1` : null);
    return {
      id: c.id,
      userId: c.user_id,
      gameId: "lol",
      externalId: c.puuid ?? c.riot_id ?? c.id,
      handle: riotId || c.user_id,
      verified: !!c.validado,
      metadata: {
        nickname: c.nickname ?? null,
        level: c.level ?? null,
        profile_icon_id: c.profile_icon_id ?? null,
        elo_cache: c.elo_cache ?? null,
        champions_cache: c.champions_cache ?? null,
      },
      syncedAt: c.vinculado_em ?? null,
      createdAt: c.created_at ?? new Date().toISOString(),
      updatedAt: c.stats_updated_at ?? c.created_at ?? new Date().toISOString(),
    };
  });

// 3. user_wallets
const userWallets = wallets
  .filter((w) => authUsers.some((u) => u.id === w.user_id))
  .map((w) => ({
    userId: w.user_id,
    mp: w.mp ?? 0,
    mc: w.mc ?? 0,
    updatedAt: w.updated_at ?? new Date().toISOString(),
  }));

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "users.json"), JSON.stringify(users, null, 2));
fs.writeFileSync(path.join(outDir, "game_accounts.json"), JSON.stringify(gameAccounts, null, 2));
fs.writeFileSync(path.join(outDir, "user_wallets.json"), JSON.stringify(userWallets, null, 2));

console.log(`[ETL Transform] users: ${users.length}`);
console.log(`[ETL Transform] game_accounts: ${gameAccounts.length}`);
console.log(`[ETL Transform] user_wallets: ${userWallets.length}`);
