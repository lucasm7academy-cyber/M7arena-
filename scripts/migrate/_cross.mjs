import fs from "fs";

const authUsers = JSON.parse(fs.readFileSync("dump/auth_users.json", "utf8"));
const profiles = JSON.parse(fs.readFileSync("dump/profiles.json", "utf8"));
const membros = JSON.parse(fs.readFileSync("dump/time_membros.json", "utf8"));
const times = JSON.parse(fs.readFileSync("dump/times.json", "utf8"));
const contasRiot = JSON.parse(fs.readFileSync("dump/contas_riot.json", "utf8"));
const wallets = JSON.parse(fs.readFileSync("dump/wallets.json", "utf8"));

const emailById = Object.fromEntries(authUsers.map((u) => [u.id, u.email]));
const comEmail = profiles.filter((p) => emailById[p.id]);
console.log(`profiles com email no auth_users: ${comEmail.length}/${profiles.length}`);
const semEmail = profiles.filter((p) => !emailById[p.id]);
console.log(`sem email: ${semEmail.length}`);
if (semEmail.length) console.log("ids sem email:", semEmail.slice(0, 5).map((p) => p.id));

const lanes = [...new Set(membros.map((m) => m.lane))];
const statusesMembro = [...new Set(membros.map((m) => m.status))];
const tiposMembro = [...new Set(membros.map((m) => m.tipo))];
const statusesTime = [...new Set(times.map((t) => t.status))];
const profilesStatus = [...new Set(profiles.map((p) => p.status))];
console.log("\nlanes:", lanes.join(", "));
console.log("status membro:", statusesMembro.join(", "));
console.log("tipo membro:", tiposMembro.join(", "));
console.log("status time:", statusesTime.join(", "));
console.log("status profile:", profilesStatus.join(", "));

// donos existem nos profiles?
const donoIds = new Set(times.map((t) => t.dono_id));
const profilesIds = new Set(profiles.map((p) => p.id));
const donosSemProfile = [...donoIds].filter((d) => !profilesIds.has(d));
console.log(`\ndonos: ${donoIds.size}, donos sem profile: ${donosSemProfile.length}`, donosSemProfile.slice(0, 10));

// membros user_id existem nos profiles?
const membroUserIds = new Set(membros.map((m) => m.user_id).filter(Boolean));
const membrosSemProfile = [...membroUserIds].filter((u) => !profilesIds.has(u));
console.log(`membros user_id sem profile: ${membrosSemProfile.length}`, membrosSemProfile.slice(0, 10));

// contas_riot referenciam profiles?
const contasRiotUserIds = new Set(contasRiot.map((c) => c.user_id));
const contasSemProfile = [...contasRiotUserIds].filter((u) => !profilesIds.has(u));
console.log(`contas_riot sem profile: ${contasSemProfile.length}`, contasSemProfile.slice(0, 10));

// wallets referenciam profiles?
const walletUserIds = new Set(wallets.map((w) => w.user_id));
const walletsSemProfile = [...walletUserIds].filter((u) => !profilesIds.has(u));
console.log(`wallets sem profile: ${walletsSemProfile.length}`, walletsSemProfile.slice(0, 10));

// O usuario logado lucasm7academy@gmail.com existe?
console.log("\nlucasm7academy no auth_users:", authUsers.find((u) => u.email === "lucasm7academy@gmail.com"));
