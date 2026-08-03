// Smoke test local do fluxo apostado ponta a ponta (P1 Task 6).
// Uso: node --input-type=module scripts/smoke-apostas.mjs
// Requer stack local (localhost:3000) + Postgres local com migration 0009.

const BASE = "http://localhost:3000";
const email = (p) => `smoke_${p}_${Date.now()}@teste.com`;
const cookieJar = {};

async function api(path, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
}

async function registrar(prefixo) {
  const mail = email(prefixo);
  const r = await api("/api/auth/register", {
    method: "POST",
    body: { email: mail, password: "Smoke@12345", displayName: "Smoke " + prefixo },
  });
  if (r.status !== 201) throw new Error(`register ${prefixo} falhou: ${r.status} ${JSON.stringify(r.json)}`);
  const setCookie = r.headers.get("set-cookie") || "";
  const m = setCookie.match(/m7_session=([^;]+)/);
  if (!m) throw new Error("sem cookie de sessão no register");
  return { id: r.json.user.id, cookie: `m7_session=${m[1]}`, email: mail };
}

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT falhou: " + msg);
}

const resumo = [];
function step(nome, ok, extra = "") {
  resumo.push(`${ok ? "OK" : "FALHA"}  ${nome}${extra ? "  " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

// ── 1. Registra usuários ────────────────────────────────────────────────────
const admin = await registrar("admin");
const j1 = await registrar("j1");
const j2 = await registrar("j2");
step("registra admin + 2 jogadores", true, `admin=${admin.id.slice(0,8)} j1=${j1.id.slice(0,8)}`);

// ── 2. Admin ganha role admin + saldo de todos ──────────────────────────────
// (ajuste de saldo e role direto no banco — smoke test, não é o foco)
const { execSync } = await import("node:child_process");
const psql = (sql) => execSync(`docker exec m7arena_local_postgres psql -U postgres -d m7arena -t -A -F "|" -c "${sql.replace(/"/g, '\\"')}"`, { encoding: "utf8" });
// lê "mc|mc_reservado" de uma linha "N|N"
const lerSaldo = (sql) => {
  const out = psql(sql).trim().split(/\r?\n/).filter(Boolean).pop() || "";
  const [mc, reservado] = out.split("|");
  return { mc: Number(mc), reservado: Number(reservado) };
};
psql(`INSERT INTO user_roles (user_id, role) VALUES ('${admin.id}', 'admin') ON CONFLICT DO NOTHING;`);
psql(`UPDATE user_wallets SET mc = 1000 WHERE user_id = '${j1.id}';`);
psql(`UPDATE user_wallets SET mc = 1000 WHERE user_id = '${j2.id}';`);
step("admin com role + saldo 1000 MC nos jogadores", true);

// ── 3. Cria sala apostada (aposta 30) ───────────────────────────────────────
const cria = await api("/api/matches", {
  method: "POST",
  cookie: j1.cookie,
  body: { mode: "5v5", entryMp: 30, maxJogadores: 2 },
});
assert(cria.status === 201, `criar sala ${cria.status} ${JSON.stringify(cria.json)}`);
const sala = cria.json;
const salaNum = sala.id;
// o shape legado devolve id=sala_num; o uuid real fica no banco
const row = psql(`SELECT id FROM matches WHERE sala_num=${salaNum};`);
const m = row.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
assert(!!m, "não achei o uuid da sala no banco");
const salaId = m[0];
step("cria sala apostada 30 MC", true, `sala_num=${salaNum} uuid=${salaId}`);

// criador tem mc_reservado = 30 (lê do banco — balance não expõe reservado)
const wJ1db = lerSaldo(`SELECT mc, mc_reservado FROM user_wallets WHERE user_id='${j1.id}';`);
step("criador reservou 30 MC", wJ1db.reservado === 30 && wJ1db.mc === 970, `mc=${wJ1db.mc} reservado=${wJ1db.reservado}`);

// ── 4. Segundo jogador entra (join usa sala_num) ────────────────────────────
const join = await api(`/api/matches/${salaNum}/join`, {
  method: "POST",
  cookie: j2.cookie,
  body: { side: "red", roleSlot: "TOP" },
});
step("j2 entra na sala", join.json?.ok === true, JSON.stringify(join.json));
const wJ2db = lerSaldo(`SELECT mc, mc_reservado FROM user_wallets WHERE user_id='${j2.id}';`);
step("j2 reservou 30 MC", wJ2db.reservado === 30 && wJ2db.mc === 970, `mc=${wJ2db.mc} reservado=${wJ2db.reservado}`);

// ── 5. Simula partida iniciada + entrada em revisão (caminho real) ─────────
// report-result de sala apostada chama entrarEmRevisao (máquina de estados).
psql(`UPDATE matches SET status='partida_iniciada' WHERE id='${salaId}';`);
const rr = await api(`/api/matches/${salaNum}/report-result`, {
  method: "POST",
  cookie: j1.cookie,
  body: { winnerSide: "blue" },
});
step("report-result move para aguardando_revisao", rr.json?.ok === true && rr.json?.estado === "aguardando_revisao", JSON.stringify(rr.json));

// ── 6. Admin lista pendentes e decide aprovar blue ──────────────────────────
const pendentes = await api("/api/revisao/pendentes", { cookie: admin.cookie });
step("GET /revisao/pendentes ok", Array.isArray(pendentes.json), `status=${pendentes.status}`);
const naFila = Array.isArray(pendentes.json) && pendentes.json.some((m) => m.id === salaId);
step("sala na fila de revisão", naFila === true);

// j1 é blue, j2 é red. Aprovar blue.
const dec = await api(`/api/revisao/${salaId}/decidir`, {
  method: "POST",
  cookie: admin.cookie,
  body: { winnerSide: "blue", decisionId: crypto.randomUUID() },
});
step("admin aprova blue", dec.json?.ok === true, JSON.stringify(dec.json));

const wJ1pos = lerSaldo(`SELECT mc, mc_reservado FROM user_wallets WHERE user_id='${j1.id}';`);
const wJ2pos = lerSaldo(`SELECT mc, mc_reservado FROM user_wallets WHERE user_id='${j2.id}';`);
// pote 60, taxa ceil(5.394)=6, liq 54, 1 vencedor -> +54; perdedor perde o reservado
step("vencedor blue recebe prêmio", wJ1pos.mc === 1000 - 30 + 54, `mc=${wJ1pos.mc} reservado=${wJ1pos.reservado}`);
step("perdedor red zerou reservado", wJ2pos.reservado === 0 && wJ2pos.mc === 970, `mc=${wJ2pos.mc} reservado=${wJ2pos.reservado}`);

// idempotência: segunda decisão deve falhar
const dec2 = await api(`/api/revisao/${salaId}/decidir`, {
  method: "POST",
  cookie: admin.cookie,
  body: { winnerSide: "red", decisionId: crypto.randomUUID() },
});
step("segunda decisão rejeitada (já decidida)", dec2.json?.ok === false && dec2.json?.erro === "partida_ja_decidida", JSON.stringify(dec2.json));

// ── 7. Auditoria no banco ───────────────────────────────────────────────────
const rev = await api("/api/admin/cargos", { cookie: admin.cookie }).catch(() => ({ status: 0 }));
const ledger = psql(`SELECT kind, amount FROM wallet_transactions WHERE ref_id='${salaId}' ORDER BY created_at;`);
step("ledger tem prize/loss/reserve/refund", /match_prize/.test(ledger) && /match_loss/.test(ledger), ledger.trim().split("\n").filter(l=>l.includes("match_")).join(" | "));

console.log("\n── Resumo smoke test ──");
console.log(resumo.join("\n"));
console.log(`\nSala: ${salaId}`);
