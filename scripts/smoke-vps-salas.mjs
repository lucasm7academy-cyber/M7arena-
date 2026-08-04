// scripts/smoke-vps-salas.mjs — valida o fluxo de salas 1v1 na VPS após as
// fases do ajustarsala (F1: join protegido por sala ativa + server_time;
// F2: clock offset; F3: fallback polling). Rodar dentro do container:
//   docker cp scripts/smoke-vps-salas.mjs m7arena_app:/app/smoke2.mjs
//   docker exec -w /app m7arena_app node smoke2.mjs
const BASE = process.env.BASE || "http://localhost:3000";
const sufixo = Date.now();

const pg = (await import("pg")).default;
const dbClient = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function psql(sql) {
  return (await dbClient.query(sql)).rows;
}

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
  const r = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password: "Smoke@12345", displayName: "Smoke " + email.split("@")[0] }) });
  if (r.status !== 201) throw new Error(`register ${email} falhou: ${r.status}`);
  return { id: r.body.user.id, cookie: extraiCookie(r.setCookie) };
}

let ok = 0, falhas = 0;
const check = (c, l, e = "") => { if (c) { ok++; console.log(`  ok ${l}${e ? ` - ${e}` : ""}`); } else { falhas++; console.log(`  X ${l}${e ? ` - ${e}` : ""}`); } };

async function main() {
  console.log(`\n=== SMOKE VPS: SALAS 1V1 (ajustarsala F1/F2/F3) ===\n`);
  await dbClient.connect();

  const p1 = await registrar(`sala1_${sufixo}@teste.com`);
  const p2 = await registrar(`sala2_${sufixo}@teste.com`);
  const ids = [p1.id, p2.id].join("','");
  await psql(`UPDATE user_wallets SET mc=0 WHERE user_id IN ('${ids}')`);
  await psql(`UPDATE users SET riot_id='Sal'||substr(id::text,1,8)||'#BR1', termos_aceitos_em=now() WHERE id IN ('${ids}')`);
  await psql(`INSERT INTO game_accounts (user_id, game_id, external_id, handle, verified) SELECT u.id,'lol','puuid-'||u.id,'Sal'||substr(u.id::text,1,8)||'#BR1',true FROM users u WHERE u.id IN ('${ids}') ON CONFLICT (user_id,game_id) DO UPDATE SET handle=EXCLUDED.handle, verified=true`);

  // 1. Criar sala 1v1 casual
  const criar = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: "1v1", entryMp: 0, nome: "Smoke salas", maxJogadores: 2 }) }, p1.cookie);
  check(criar.status === 201, "sala 1v1 criada");
  const salaNum = criar.body.id;

  // 2. P1 entra (blue) -> sala continua preenchendo (max 2, tem 1)
  const e1 = await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: true }) }, p1.cookie);
  const est1 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(est1[0]?.status === "preenchendo", "sala segue preenchendo com 1 jogador (1v1 NAO abre contagem sozinha)", est1[0]?.status);

  // 3. P2 entra (red) -> preenche a ultima vaga -> confirmacao
  const e2 = await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: false }) }, p2.cookie);
  const est2 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(est2[0]?.status === "confirmacao", "com 2 jogadores a sala foi para confirmacao", est2[0]?.status);

  // 3b. REGRA DE TIMER (reforço F2): o deadline de confirmacao deve ser
  //     COERENTE com o server_time — confirmacao_expires_at ≈ server_time + 60s.
  //     Se valer, qualquer relógio de cliente (adiantado/atrasado) converge
  //     para o mesmo tempo restante via clockSync. Se o deadline fosse
  //     calculado com o relógio de UM cliente, isso aqui divergiria.
  const detConfirm = await api(`/api/matches/${salaNum}`, {}, p1.cookie);
  const expires = new Date(detConfirm.body?.confirmacao_expires_at).getTime();
  const diff = expires - detConfirm.body?.server_time;
  check(
    Math.abs(diff - 60_000) < 3_000,
    `deadline de confirmacao coerente com server_time (expires-server_time = ${Math.round(diff / 1000)}s ≈ 60s)`
  );

  // 4. Ambos confirmam -> partida
  await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, p1.cookie);
  await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, p2.cookie);
  await new Promise((r) => setTimeout(r, 300));
  const est3 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(["iniciando_partida", "partida_iniciada"].includes(est3[0]?.status), "sala avancou para partida", est3[0]?.status);

  // 5. server_time presente no shape (F2)
  const detalhe = await api(`/api/matches/${salaNum}`, {}, p1.cookie);
  check(typeof detalhe.body?.server_time === "number" && detalhe.body.server_time > 0, "shape inclui server_time (F2)");
  // F2 reforço: o server_time deve estar perto do relógio real (offset < 5s).
  const offsetMs = Math.abs(detalhe.body.server_time - Date.now());
  check(offsetMs < 5000, `server_time alinhado ao relogio real (offset ${offsetMs}ms < 5s)`);

  // 6. Bug D: linked residual em sala nao ativa NAO bloqueia novo join.
  //    Forca a sala atual para encerrada com linked residual de p1, e p1
  //    tenta entrar em OUTRA sala nova.
  await psql(`UPDATE matches SET status='encerrada', ended_at=now() WHERE sala_num=${salaNum}`);
  // (o linked residual foi liberado na confirmacao; para simular o bug antigo,
  //  setamos linked=true numa sala encerrada artificialmente)
  await psql(`UPDATE match_players SET linked=true WHERE match_id=(SELECT id FROM matches WHERE sala_num=${salaNum}) AND user_id='${p1.id}'`);
  const nova = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: "1v1", entryMp: 0, nome: "Sala nova apos bug D", maxJogadores: 2 }) }, p1.cookie);
  check(nova.status === 201, "p1 criou sala nova mesmo com linked residual em sala encerrada (bug D)");
  const novaNum = nova.body?.id;
  if (novaNum) {
    const rj = await api(`/api/matches/${novaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: true }) }, p1.cookie);
    check(rj.body?.ok === true, "p1 entrou na nova sala (join nao bloqueia por linked de sala morta)", rj.body?.erro || "ok");
  }

  // cleanup
  await psql(`DELETE FROM match_players WHERE user_id IN ('${ids}') OR match_id IN (SELECT id FROM matches WHERE created_by IN ('${ids}'))`);
  await psql(`DELETE FROM matches WHERE created_by IN ('${ids}')`);
  await psql(`DELETE FROM game_accounts WHERE user_id IN ('${ids}')`);
  await psql(`DELETE FROM user_wallets WHERE user_id IN ('${ids}')`);
  await psql(`DELETE FROM users WHERE id IN ('${ids}')`);

  await dbClient.end();
  console.log(`\n=== RESULTADO: ${ok} ok, ${falhas} falhas ===\n`);
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
