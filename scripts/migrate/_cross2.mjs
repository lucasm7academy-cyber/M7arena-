import fs from "fs";

const authUsers = JSON.parse(fs.readFileSync("dump/auth_users.json", "utf8"));
const profiles = JSON.parse(fs.readFileSync("dump/profiles.json", "utf8"));
const membros = JSON.parse(fs.readFileSync("dump/time_membros.json", "utf8"));
const times = JSON.parse(fs.readFileSync("dump/times.json", "utf8"));
const contasRiot = JSON.parse(fs.readFileSync("dump/contas_riot.json", "utf8"));

const authIds = new Set(authUsers.map((u) => u.id));
const donoIds = new Set(times.map((t) => t.dono_id));
const membroIds = new Set(membros.map((m) => m.user_id).filter(Boolean));
const contaIds = new Set(contasRiot.map((c) => c.user_id));

const donosSemAuth = [...donoIds].filter((d) => !authIds.has(d));
const membrosSemAuth = [...membroIds].filter((u) => !authIds.has(u));
const contasSemAuth = [...contaIds].filter((u) => !authIds.has(u));
console.log(`donos sem auth_users: ${donosSemAuth.length}`, donosSemAuth.slice(0, 10));
console.log(`membros sem auth_users: ${membrosSemAuth.length}`, membrosSemAuth.slice(0, 10));
console.log(`contas_riot sem auth_users: ${contasSemAuth.length}`, contasSemAuth.slice(0, 10));

// Quantos auth_users NAO tem profile (só conta, nunca criou perfil)?
const profileIds = new Set(profiles.map((p) => p.id));
const semProfile = authUsers.filter((u) => !profileIds.has(u.id));
console.log(`\nauth_users sem profile: ${semProfile.length}`);
const donoDeTime = semProfile.filter((u) => donoIds.has(u.id));
console.log(`desses, donos de time: ${donoDeTime.length}`);
for (const d of donoDeTime) {
  const t = times.find((t) => t.dono_id === d.id);
  console.log(`  - ${d.email} => dono de "${t?.nome}"`);
}
