// scripts/smoke-confirmacao-concorrente.mjs
// Prova de concorrência da confirmação (o bug do site antigo: 10 navegadores
// concorrendo pela mesma linha, sem lock — estados indo e voltando, uns
// confirmados outros não).
//
// Cenário real: criar sala 5v5, preencher 10 vagas, disparar 10 confirms em
// PARALELO (Promise.all), esperar, e conferir: estado final estável, todos os
// 10 confirmados, e exatamente uma transição para iniciando_partida.
//
// Requer stack local (localhost:3000) + Postgres local.

const BASE = "http://localhost:3000";
const PSQL = "docker exec m7arena_local_postgres psql -U postgres -d m7arena -t -A -c";

const sufixo = Date.now();
// 1 criador (entra ao criar) + 9 jogadores = 10 vagas na sala 5v5.
const emails = Array.from({ length: 10 }, (_, i) => `conc_${sufixo}_${i}@teste.com`);

async function api(path, opts = {}, token) {
  const headers = { ...(opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}) };
  if (token) headers["Cookie"] = token;
  const r = await fetch(BASE + path, { ...opts, headers, redirect: "manual" });
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("json") ? await r.json() : await r.text();
  return { status: r.status, body, setCookie: r.headers.get("set-cookie") || "" };
}

const extraiCookie = (setCookie) => (setCookie.match(/m7_session=[^;]+/) || [])[0] || "";

async function registrar(email) {
  const r = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "Smoke@12345", displayName: "Conc " + email.split("@")[0] }),
  });
  if (r.status !== 201) throw new Error(`register ${email} falhou: ${r.status} ${JSON.stringify(r.body)}`);
  return { id: r.body.user.id, cookie: extraiCookie(r.setCookie) };
}

async function psql(sql) {
  const { execSync } = await import("node:child_process");
  const cmd = `${PSQL} "${sql.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: "utf8", shell: "cmd.exe" }).trim();
}

let ok = 0;
let falhas = 0;
const check = (cond, label, extra = "") => {
  if (cond) { ok++; console.log(`  ✔ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { falhas++; console.log(`  ✘ ${label}${extra ? ` — ${extra}` : ""}`); }
};

async function main() {
  console.log(`\n═══ CONCORRÊNCIA DA CONFIRMAÇÃO (1 criador + 9, 10 confirms em paralelo) ═══\n`);

  // 1. Cria 10 usuários: 1 cria a sala + 9 jogadores (o criador é o 10º na sala)
  const users = [];
  for (const email of emails) users.push(await registrar(email));
  console.log(`  ✓ 10 usuários registrados`);

  const criador = users[0];
  const jogadores = users.slice(1); // 9

  // 2. Cria sala 5v5 apostada (o criador entra na criação)
  const criar = await api("/api/matches", {
    method: "POST",
    body: JSON.stringify({ mode: "5v5", entryMp: 0, nome: "Conc concorrente", maxJogadores: 10 }),
  }, criador.cookie);
  if (criar.status !== 201) throw new Error(`criar sala falhou: ${criar.status} ${JSON.stringify(criar.body)}`);
  const salaNum = criar.body.id;
  check(salaNum > 0, `sala criada #${salaNum} (criador dentro, vaga TOP)`);

  // 3. Funda carteira + libera elegibilidade de todos
  const ids = users.map((u) => u.id).join("','");
  await psql(`UPDATE user_wallets SET mc=500 WHERE user_id IN ('${ids}')`);
  await psql(`UPDATE users SET riot_id='Conc'||substr(id::text,1,8)||'#BR1', termos_aceitos_em=now() WHERE id IN ('${ids}')`);
  await psql(`INSERT INTO game_accounts (user_id, game_id, external_id, handle, verified) SELECT u.id, 'lol', 'puuid-'||u.id, 'Conc'||substr(u.id::text,1,8)||'#BR1', true FROM users u WHERE u.id IN ('${ids}') ON CONFLICT (user_id, game_id) DO UPDATE SET handle=EXCLUDED.handle, verified=true`);

  // 4. 9 jogadores entram em vagas paralelas (concorrência de entrada)
  const roles = [
    ["JG", true], ["MID", true], ["ADC", true], ["SUP", true],
    ["TOP", false], ["JG", false], ["MID", false], ["ADC", false], ["SUP", false],
  ];
  const entradas = jogadores.map((u, i) =>
    api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: roles[i][0], is_time_a: roles[i][1] }) }, u.cookie)
  );
  const resEntradas = await Promise.all(entradas);
  const entrou = resEntradas.filter((r) => r.body?.ok === true).length;
  check(entrou === 9, `9 jogadores entraram (${entrou})`);
  const errosEntrada = resEntradas.filter((r) => r.body?.ok !== true).map((r) => r.body?.erro || `http${r.status}`);
  if (errosEntrada.length) console.log(`     ↳ erros de entrada: ${[...new Set(errosEntrada)].join(", ")}`);

  // 5. Conferir que a sala foi para `confirmacao` (10/10 preenchida)
  let estado = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(estado === "confirmacao", `sala em confirmacao após preencher`, estado);

  // 6. O 10 confirms em PARALELO — o cenário exato do bug antigo
  //    (9 jogadores + o criador, que ocupa a vaga TOP blue desde a criação)
  const confirmadores = [criador, ...jogadores];
  const confirms = confirmadores.map((u) =>
    api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: JSON.stringify({}) }, u.cookie)
  );
  const resConfirms = await Promise.all(confirms);
  const okConfirms = resConfirms.filter((r) => r.body?.ok === true).length;
  check(okConfirms === 10, `10 confirms simultâneos respondidos ok (${okConfirms})`);
  const errosConfirm = resConfirms.filter((r) => r.body?.ok !== true).map((r) => r.body?.erro || `http${r.status}`);
  if (errosConfirm.length) console.log(`     ↳ erros de confirm: ${[...new Set(errosConfirm)].join(", ")}`);

  // 7. Estado final: DEVE ser iniciando_partida (ou partida_iniciada), estável
  await new Promise((r) => setTimeout(r, 500));
  const final1 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  const final2 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(final1 === "iniciando_partida" || final1 === "partida_iniciada", `estado final estável: ${final1}`, final1);
  check(final1 === final2, "estado não oscila entre duas leituras", `${final1} → ${final2}`);

  // 8. Todos confirmados (nenhum ficou para trás)
  const confirmados = await psql(`SELECT count(*) FROM match_players WHERE match_id=(SELECT id FROM matches WHERE sala_num=${salaNum}) AND confirmed=true`);
  check(Number(confirmados) === 10, `10/10 confirmados`, `${confirmados}/10`);

  // 9. Nenhuma transição duplicada: só uma sala em iniciando/partida para 10 jogadores
  const transicoes = await psql(`SELECT count(*) FROM matches WHERE sala_num=${salaNum} AND status IN ('iniciando_partida','partida_iniciada')`);
  check(Number(transicoes) === 1, "exatamente 1 transição de confirmação", transicoes);

  console.log(`\n═══ RESULTADO: ${ok} ok, ${falhas} falhas ═══\n`);
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
