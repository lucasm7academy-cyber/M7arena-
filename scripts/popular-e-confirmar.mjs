// scripts/popular-e-confirmar.mjs — popula a sala 14 com 10 jogadores e
// confirma todos em sequência RÁPIDA (<10s), para o browser do Teste P5
// observar a transição em tempo real sem recarregar.
// Uso: node scripts/popular-e-confirmar.mjs [agora|vou]
const acao = process.argv[2] || "confirmar";
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

async function loginSenha(email, senha) {
  const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: senha }) });
  if (r.status !== 200) throw new Error(`login ${email} falhou: ${r.status}`);
  return extraiCookie(r.setCookie);
}
async function registrar(email) {
  const r = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password: "Smoke@12345", displayName: "Rapid " + email.split("@")[0] }) });
  if (r.status !== 201) throw new Error(`register ${email} falhou: ${r.status}`);
  return { id: r.body.user.id, cookie: extraiCookie(r.setCookie) };
}
async function psql(sql) {
  const { execSync } = await import("node:child_process");
  return execSync(`docker exec m7arena_local_postgres psql -U postgres -d m7arena -t -A -c "${sql.replace(/"/g, '\\"')}"`, { encoding: "utf8", shell: "cmd.exe" }).trim();
}

const SALA = 14;

async function main() {
  // Limpa a sala 14 de qualquer resíduo
  await psql(`DELETE FROM match_players WHERE match_id=(SELECT id FROM matches WHERE sala_num=${SALA})`);
  await psql(`UPDATE matches SET status='preenchendo', confirmacao_expires_at=NULL WHERE sala_num=${SALA}`);

  // Teste P5 entra na vaga TOP blue
  const cookieP5 = await loginSenha("teste.p5@m7arena.local", "Smoke@12345");
  const j1 = await api(`/api/matches/${SALA}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "TOP", is_time_a: true }) }, cookieP5);
  if (j1.body?.ok !== true) throw new Error("Teste P5 nao entrou: " + JSON.stringify(j1.body));

  // 9 novos jogadores: entrar + confirmar
  const emails = Array.from({ length: 9 }, (_, i) => `rap_${sufixo}_${i}@teste.com`);
  const users = [];
  for (const e of emails) users.push(await registrar(e));
  const ids = users.map((u) => u.id).join("','");
  await psql(`UPDATE user_wallets SET mc=500 WHERE user_id IN ('${ids}')`);
  await psql(`UPDATE users SET riot_id='Rap'||substr(id::text,1,8)||'#BR1', termos_aceitos_em=now() WHERE id IN ('${ids}')`);
  await psql(`INSERT INTO game_accounts (user_id, game_id, external_id, handle, verified) SELECT u.id,'lol','puuid-'||u.id,'Rap'||substr(u.id::text,1,8)||'#BR1',true FROM users u WHERE u.id IN ('${ids}') ON CONFLICT (user_id,game_id) DO UPDATE SET handle=EXCLUDED.handle, verified=true`);

  const roles = [["JG",true],["MID",true],["ADC",true],["SUP",true],["TOP",false],["JG",false],["MID",false],["ADC",false],["SUP",false]];
  const entradas = await Promise.all(users.map((u, i) => api(`/api/matches/${SALA}/join`, { method: "POST", body: JSON.stringify({ roleSlot: roles[i][0], is_time_a: roles[i][1] }) }, u.cookie)));
  const okEntradas = entradas.filter((r) => r.body?.ok === true).length;
  const estado = await psql(`SELECT status FROM matches WHERE sala_num=${SALA}`);
  console.log(`entradas ok: ${okEntradas}/9 | estado: ${estado}`);

  if (acao === "vou") {
    console.log("PARADO — agora navegue no browser e depois rode: node scripts/popular-e-confirmar.mjs confirmar");
    return;
  }

  // Confirmação rápida dos 9 (o Teste P5 confirma via browser)
  const confirms = [];
  for (const u of users) {
    const c = await api(`/api/matches/${SALA}/confirm`, { method: "POST", body: "{}" }, u.cookie);
    confirms.push(c.body?.ok === true);
  }
  const okConfirms = confirms.filter(Boolean).length;
  const estadoFinal = await psql(`SELECT status FROM matches WHERE sala_num=${SALA}`);
  console.log(`confirms ok: ${okConfirms}/9 | estado final: ${estadoFinal}`);
  console.log("agora clique em CONFIRMAR no browser do Teste P5");
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
