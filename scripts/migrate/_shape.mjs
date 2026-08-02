import fs from "fs";

for (const f of ["times", "time_membros", "profiles", "contas_riot", "wallets", "auth_users"]) {
  const data = JSON.parse(fs.readFileSync(`dump/${f}.json`, "utf8"));
  console.log(`\n===== ${f} (${data.length}) =====`);
  if (data.length) {
    console.log("colunas:", Object.keys(data[0]).join(", "));
  }
  if (f === "times" && data.length) {
    console.log("exemplo times:", JSON.stringify(data[0], null, 2));
  }
  if (f === "time_membros" && data.length) {
    console.log("exemplo membro:", JSON.stringify(data[0], null, 2));
  }
}
