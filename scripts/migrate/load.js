/**
 * Load no Postgres da VPS (mig.load)
 * Insere users, game_accounts, user_wallets, teams, team_members, team_invites
 * preservando o vínculo dono → time. Merge por EMAIL: se o usuário já existe
 * no banco (ex.: logou com Google), reaproveita o id existente e re-mapeia
 * todas as referências (owner_id, user_id).
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5433/m7arena";

function readTransformed(name) {
  const p = path.join(__dirname, "transformed", `${name}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : [];
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });

async function seedGame() {
  await pool.query(
    `INSERT INTO games (id, name, active) VALUES ('lol', 'League of Legends', true)
     ON CONFLICT (id) DO NOTHING`
  );
}

async function loadUsers(users) {
  const emailToDbId = {};
  const supabaseToDbId = {};

  for (const u of users) {
    // Já existe por email? (caso do usuário que logou via Google antes da migração)
    const exists = await pool.query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [
      u.email.toLowerCase(),
    ]);

    if (exists.rows.length > 0) {
      const dbId = exists.rows[0].id;
      emailToDbId[u.email.toLowerCase()] = dbId;
      supabaseToDbId[u.id] = dbId;
      continue;
    }

    await pool.query(
      `INSERT INTO users
         (id, email, email_verified, password_hash, display_name, avatar_url, bio,
          socials, lane_primary, lane_secondary, status, is_vip, vip_expires_at,
          created_at, updated_at)
       VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (email) DO NOTHING`,
      [
        u.id,
        u.email.toLowerCase(),
        u.emailVerified ?? null,
        u.displayName || u.email.split("@")[0],
        u.avatarUrl ?? null,
        u.bio ?? null,
        u.socials ?? {},
        u.lanePrimary ?? null,
        u.laneSecondary ?? null,
        u.status ?? "active",
        u.isVip ?? false,
        u.vipExpiresAt ?? null,
        u.createdAt ?? new Date(),
        u.updatedAt ?? new Date(),
      ]
    );
    emailToDbId[u.email.toLowerCase()] = u.id;
    supabaseToDbId[u.id] = u.id;
  }

  return { emailToDbId, supabaseToDbId };
}

async function loadGameAccounts(accounts, supabaseToDbId) {
  let n = 0;
  for (const a of accounts) {
    const userId = supabaseToDbId[a.userId];
    if (!userId) continue;
    const r = await pool.query(
      `INSERT INTO game_accounts
         (id, user_id, game_id, external_id, handle, verified, metadata, synced_at, created_at, updated_at)
       VALUES ($1,$2,'lol',$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        a.id,
        userId,
        a.externalId,
        a.handle,
        a.verified ?? false,
        a.metadata ?? {},
        a.syncedAt ?? null,
        a.createdAt ?? new Date(),
        a.updatedAt ?? new Date(),
      ]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] game_accounts inseridos: ${n}`);
}

async function loadWallets(wallets, supabaseToDbId) {
  let n = 0;
  for (const w of wallets) {
    const userId = supabaseToDbId[w.userId];
    if (!userId) continue;
    const r = await pool.query(
      `INSERT INTO user_wallets (user_id, mp, mc, updated_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET mp = EXCLUDED.mp, mc = EXCLUDED.mc, updated_at = EXCLUDED.updated_at`,
      [userId, w.mp ?? 0, w.mc ?? 0, w.updatedAt ?? new Date()]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] user_wallets inseridos/atualizados: ${n}`);
}

async function loadTeams(teams, supabaseToDbId) {
  let n = 0;
  for (const t of teams) {
    const ownerId = supabaseToDbId[t.ownerId];
    if (!ownerId) continue;
    const r = await pool.query(
      `INSERT INTO teams
         (id, game_id, name, tag, logo_url, gradient_from, gradient_to, owner_id,
          status, contacts, created_at, updated_at)
       VALUES ($1,'lol',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        t.id,
        t.name,
        t.tag,
        t.logoUrl ?? null,
        t.gradientFrom ?? null,
        t.gradientTo ?? null,
        ownerId,
        t.status ?? "active",
        t.contacts ?? {},
        t.createdAt ?? new Date(),
        t.updatedAt ?? new Date(),
      ]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] teams inseridos: ${n}`);
}

async function loadTeamMembers(members, supabaseToDbId) {
  let n = 0;
  for (const m of members) {
    const userId = m.userId ? supabaseToDbId[m.userId] : null;
    const r = await pool.query(
      `INSERT INTO team_members
         (id, team_id, user_id, guest_handle, guest_riot_id, guest_puuid,
          guest_profile_icon_id, guest_elo_cache, role_slot, is_captain,
          status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        m.id,
        m.teamId,
        userId ?? null,
        m.guestHandle ?? null,
        m.guestRiotId ?? null,
        m.guestPuuid ?? null,
        m.guestProfileIconId ?? null,
        m.guestEloCache ?? null,
        m.roleSlot ?? "SUB",
        m.isCaptain ?? false,
        m.status ?? "accepted",
        m.createdAt ?? new Date(),
      ]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] team_members inseridos: ${n}`);
}

async function loadTeamInvites(invites, supabaseToDbId) {
  let n = 0;
  for (const c of invites) {
    const fromUserId = supabaseToDbId[c.fromUserId];
    const toUserId = c.toUserId ? supabaseToDbId[c.toUserId] : null;
    if (!fromUserId) continue;
    const r = await pool.query(
      `INSERT INTO team_invites
         (id, team_id, from_user_id, to_user_id, riot_id, role, message, type, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        c.id,
        c.teamId,
        fromUserId,
        toUserId ?? null,
        c.riotId ?? null,
        c.role ?? "SUB",
        c.message ?? null,
        c.type ?? "invite",
        c.status ?? "pending",
        c.createdAt ?? new Date(),
      ]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] team_invites inseridos: ${n}`);
}

async function loadTeamStats(stats) {
  let n = 0;
  for (const s of stats) {
    const r = await pool.query(
      `INSERT INTO team_stats (team_id, season_id, pdl, wins, losses, ranking, updated_at)
       VALUES ($1,'s1',$2,$3,$4,$5,$6)
       ON CONFLICT (team_id, season_id) DO UPDATE SET
         pdl = EXCLUDED.pdl, wins = EXCLUDED.wins, losses = EXCLUDED.losses,
         ranking = EXCLUDED.ranking, updated_at = EXCLUDED.updated_at`,
      [s.teamId, s.pdl ?? 0, s.wins ?? 0, s.losses ?? 0, s.ranking ?? null, s.updatedAt ?? new Date()]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] team_stats inseridos/atualizados: ${n}`);
}

async function load() {
  const users = readTransformed("users");
  const gameAccounts = readTransformed("game_accounts");
  const wallets = readTransformed("user_wallets");
  const teams = readTransformed("teams");
  const members = readTransformed("team_members");
  const invites = readTransformed("team_invites");
  const stats = readTransformed("team_stats");

  console.log("[ETL Load] Conectando no Postgres da VPS...");

  await seedGame();
  const { supabaseToDbId } = await loadUsers(users);
  await loadGameAccounts(gameAccounts, supabaseToDbId);
  await loadWallets(wallets, supabaseToDbId);
  await loadTeams(teams, supabaseToDbId);
  await loadTeamMembers(members, supabaseToDbId);
  await loadTeamInvites(invites, supabaseToDbId);
  await loadTeamStats(stats);

  await pool.end();
  console.log("[ETL Load] Carga finalizada!");
}

load().catch(async (err) => {
  console.error("[ETL Load] ERRO:", err.message, err.code || "", err.detail || "");
  await pool.end();
  process.exit(1);
});
