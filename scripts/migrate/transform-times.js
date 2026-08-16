/**
 * Transform: Times (mig.times)
 * times → teams, time_membros → team_members, time_convites → team_invites.
 * Preserva os IDs originais do Supabase para manter o vínculo dono → time.
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

const times = readDump("times");
const membros = readDump("time_membros");
const convites = readDump("time_convites");

const TIME_STATUS = { ativo: "active", "em_fase_de_grupos": "active", finalizado: "active" };
const MEMBRO_STATUS = { ativo: "accepted", pendente: "pending", recusado: "declined" };
const CONVITE_STATUS = { pendente: "pending", aceito: "accepted", recusado: "declined" };
const CONVITE_TIPO = { convite: "invite", solicitacao: "request" };
// A coluna role_slot do schema novo usa o vocabulário top/jungle/mid/adc/support/sub/coach.
// O dump do Supabase traz o rótulo legado (TOP/JG/MID/ADC/SUP/RES/COACH) — traduzir aqui
// evita gravar valor que a API de times não reconhece (bug: todo membro virava TOP).
const LANE_LEGACY_TO_SLOT = {
  TOP: "top",
  JG: "jungle",
  MID: "mid",
  ADC: "adc",
  SUP: "support",
  RES: "sub",
  COACH: "coach",
};

// teams
const teams = times.map((t) => ({
  id: t.id,
  gameId: "lol",
  name: t.nome,
  tag: t.tag,
  logoUrl: t.logo_url ?? null,
  gradientFrom: t.gradient_from ?? null,
  gradientTo: t.gradient_to ?? null,
  ownerId: t.dono_id,
  status: TIME_STATUS[t.status] ?? "active",
  contacts: {
    ...(t.whatsapp ? { whatsapp: t.whatsapp } : {}),
    ...(t.discord ? { discord: t.discord } : {}),
  },
  createdAt: t.created_at ?? new Date().toISOString(),
  updatedAt: t.created_at ?? new Date().toISOString(),
}));

// team_members
const teamMembers = membros.map((m) => {
  const isGuest = !m.user_id;
  return {
    id: m.id,
    teamId: m.time_id,
    userId: m.user_id ?? null,
    guestHandle: isGuest ? m.guest_riot_id ?? null : null,
    guestRiotId: m.guest_riot_id ?? null,
    guestPuuid: m.guest_puuid ?? null,
    guestProfileIconId: m.guest_profile_icon_id ?? null,
    guestEloCache: m.guest_elo_cache ?? null,
    roleSlot: LANE_LEGACY_TO_SLOT[m.lane] ?? "sub",
    isCaptain: !!m.is_capitao,
    status: MEMBRO_STATUS[m.status] ?? "accepted",
    createdAt: m.joined_at ?? new Date().toISOString(),
  };
});

// team_invites
const teamInvites = convites.map((c) => ({
  id: c.id,
  teamId: c.time_id,
  fromUserId: c.de_user_id,
  toUserId: c.para_user_id ?? null,
  riotId: c.riot_id ?? null,
  role: c.role ?? "SUB",
  message: c.mensagem ?? null,
  type: CONVITE_TIPO[c.tipo] ?? "invite",
  status: CONVITE_STATUS[c.status] ?? "pending",
  createdAt: c.criado_em ?? c.created_at ?? new Date().toISOString(),
}));

// team_stats: pdl, wins, losses, ranking vêm direto de `times` (colunas legadas)
const teamStats = times.map((t) => ({
  teamId: t.id,
  seasonId: "s1",
  pdl: t.pdl ?? 0,
  wins: t.wins ?? 0,
  losses: t.losses ?? 0,
  ranking: t.ranking ?? null,
  updatedAt: t.created_at ?? new Date().toISOString(),
}));

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "teams.json"), JSON.stringify(teams, null, 2));
fs.writeFileSync(path.join(outDir, "team_members.json"), JSON.stringify(teamMembers, null, 2));
fs.writeFileSync(path.join(outDir, "team_invites.json"), JSON.stringify(teamInvites, null, 2));
fs.writeFileSync(path.join(outDir, "team_stats.json"), JSON.stringify(teamStats, null, 2));

console.log(`[ETL Transform] teams: ${teams.length}`);
console.log(`[ETL Transform] team_members: ${teamMembers.length}`);
console.log(`[ETL Transform] team_invites: ${teamInvites.length}`);
console.log(`[ETL Transform] team_stats: ${teamStats.length}`);
