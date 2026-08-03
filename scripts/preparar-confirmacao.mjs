// scripts/preparar-confirmacao.mjs
// Prepara a sala 14 (do Teste P5) em estado `confirmacao` com 9 jogadores
// extras, para testar o realtime do countdown no browser sem recarregar.
// O Teste P5 (TOP blue) permanece NA sala, e os 9 entram nas outras vagas.

const BASE = "http://localhost:3000";
const sufixo = Date.now();

async function api(path, opts = {}, token) {
  const headers = { ...(opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}) };
  if (token) headers["Cookie"] = token;
  const r = await fetch(BASE + path, { ...opts, headers });
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("json") ? await r.json() : await r.text();
  return { status: r.status, body, setCookie: r.headers.get("set-cookie") || "" };
}
const extraiCookie = (sc) => (sc.match(/m7_session=[^;]+/) || [])[0] || "";

async function registrar(email) {
  const r = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "Smoke@12345", displayName: "Prep " + email.split("@")[0] }),
  });
  if (r.status !== 201) throw new Error(`register ${email} falhou: ${r.status} ${JSON.stringify(r.body)}`);
  return { id: r.body.user.id, cookie: extraiCookie(r.setCookie) };
}

async function psql(sql) {
  const { execSync } = await import("node:child_process");
  const cmd = `docker exec m7arena_local_postgres psql -U postgres -d m7arena -t -A -c "${sql.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: "utf8", shell: "cmd.exe" }).trim();
}

const SALA_NUM = 14;

async function main() {
  const emails = Array.from({ length: 9 }, (_, i) => `prep_${sufixo}_${i}@teste.com`);
  const users = [];
  for (const e of emails) users.push(await registrar(e));
  console.log("9 usuarios registrados");

  const ids = users.map((u) => u.id).join("','");
  await psql(`UPDATE user_wallets SET mc=500 WHERE user_id IN ('${ids}')`);
  await psql(`UPDATE users SET riot_id='Prep'||substr(id::text,1,8)||'#BR1', termos_aceitos_em=now() WHERE id IN ('${ids}')`);
  await psql(`INSERT INTO game_accounts (user_id, game_id, external_id, handle, verified) SELECT u.id, 'lol', 'puuid-'||u.id, 'Prep'||substr(u.id::text,1,8)||'#BR1', true FROM users u WHERE u.id IN ('${ids}') ON CONFLICT (user_id, game_id) DO UPDATE SET handle=EXCLUDED.handle, verified=true`);

  const roles = [
    ["JG", true], ["MID", true], ["ADC", true], ["SUP", true],
    ["TOP", false], ["JG", false], ["MID", false], ["ADC", false], ["SUP", false],
  ];
  const entradas = users.map((u, i) =>
    api(`/api/matches/${SALA_NUM}/join`, { method: "POST", body: JSON.stringify({ roleSlot: roles[i][0], is_time_a: roles[i][1] }) }, u.cookie)
  );
  const res = await Promise.all(entradas);
  const ok = res.filter((r) => r.body?.ok === true).length;
  console.log(`entradas ok: ${ok}/9`);

  const estado = await psql(`SELECT status FROM matches WHERE sala_num=${SALA_NUM}`);
  console.log(`estado da sala 14: ${estado}`);
  if (estado !== "confirmacao") {
    console.error("sala nao foi para confirmacao");
    process.exit(1);
  }
  const exp = await psql(`SELECT confirmacao_expires_at FROM matches WHERE sala_num=${SALA_NUM}`);
  console.log(`confirmacao_expires_at (servidor): ${exp}`);
  console.log("PRONTO — navegue no browser para /sala-mod1/14");
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
