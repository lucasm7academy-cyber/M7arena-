// scripts/smoke-vps-revisao.mjs — smoke contra o DEPLOY (VPS) validando a
// decisão de 2026-08-03 + fix do proprietário na revisão:
//  - sala CASUAL (0 MC) vai para a revisão do admin (sem votação de player)
//  - o PROPRIETÁRIO (não só admin/moderador) vê a fila e decide (fix do 403)
//  - ao finalizar, os vínculos (linked) são liberados e o jogador consegue
//    entrar numa sala NOVA (não fica preso por ja_em_outra_sala)
//
// Roda DENTRO do container m7arena_app (node + pg + acesso ao postgres):
//   docker cp scripts/smoke-vps-revisao.mjs m7arena_app:/tmp/smoke.mjs
//   docker exec m7arena_app node /tmp/smoke.mjs
const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL_PROPRIETARIO = process.env.PROPRIETARIO_EMAIL || "lucasm7academy@gmail.com";
const sufixo = Date.now();

// pg vem do node_modules do app (mesma versão usada pela API).
const pg = (await import("pg")).default;
const dbClient = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function psql(sql) {
  const r = await dbClient.query(sql);
  return r.rows;
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

async function login(email, senha) {
  const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: senha }) });
  if (r.status !== 200) throw new Error(`login ${email} falhou: ${r.status}`);
  return extraiCookie(r.setCookie);
}
async function registrar(email) {
  const r = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password: "Smoke@12345", displayName: "Smoke " + email.split("@")[0] }) });
  if (r.status !== 201) throw new Error(`register ${email} falhou: ${r.status}`);
  return { id: r.body.user.id, cookie: extraiCookie(r.setCookie) };
}
/** Cria sessão válida para um usuário e devolve o token (para o proprietário,
 *  cuja senha o smoke não conhece). */
async function criarSessao(userId) {
  const { randomBytes } = await import("node:crypto");
  const token = "smoke_owner_" + randomBytes(16).toString("hex");
  await psql(`INSERT INTO user_sessions (session_token, user_id, expires) VALUES ('${token}', '${userId}', now() + interval '1 hour')`);
  return `m7_session=${token}`;
}

let ok = 0, falhas = 0;
const check = (c, l, e = "") => { if (c) { ok++; console.log(`  ok ${l}${e ? ` - ${e}` : ""}`); } else { falhas++; console.log(`  X ${l}${e ? ` - ${e}` : ""}`); } };

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  console.log(`\n=== SMOKE VPS: SALA CASUAL -> REVISAO PELO PROPRIETARIO ===\n`);

  await dbClient.connect();

  const p1 = await registrar(`vps1_${sufixo}@teste.com`);
  const p2 = await registrar(`vps2_${sufixo}@teste.com`);
  console.log("  2 jogadores registrados");
  const ids = [p1.id, p2.id].join("','");
  await psql(`UPDATE user_wallets SET mc=0 WHERE user_id IN ('${ids}')`);
  await psql(`UPDATE users SET riot_id='Vps'||substr(id::text,1,8)||'#BR1', termos_aceitos_em=now() WHERE id IN ('${ids}')`);
  await psql(`INSERT INTO game_accounts (user_id, game_id, external_id, handle, verified) SELECT u.id,'lol','puuid-'||u.id,'Vps'||substr(u.id::text,1,8)||'#BR1',true FROM users u WHERE u.id IN ('${ids}') ON CONFLICT (user_id,game_id) DO UPDATE SET handle=EXCLUDED.handle, verified=true`);

  // 1. Cria sala 1v1 CASUAL
  const criar = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: "1v1", entryMp: 0, nome: "Smoke revisao vps", maxJogadores: 2 }) }, p1.cookie);
  check(criar.status === 201, "sala 1v1 casual criada");
  const salaNum = criar.body.id;

  // 2. P1 blue / P2 red -> confirmacao
  const e1 = await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: true }) }, p1.cookie);
  const e2 = await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: false }) }, p2.cookie);
  const est1 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(e1.body?.ok && e2.body?.ok, "2 jogadores entraram");
  check(est1[0]?.status === "confirmacao", "sala foi para confirmacao", est1[0]?.status);

  // 3. Ambos confirmam -> partida
  await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, p1.cookie);
  await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, p2.cookie);
  await new Promise((r) => setTimeout(r, 300));
  await psql(`UPDATE matches SET status='partida_iniciada', state_deadline_at=NULL WHERE sala_num=${salaNum}`);

  // 4. P1 envia print -> aguardando_revisao
  const fd = new FormData();
  fd.append("file", new Blob([Buffer.from(PNG, "base64")], { type: "image/png" }), "print.png");
  fd.append("bucket", "match-prints");
  fd.append("path", (await psql(`SELECT id FROM matches WHERE sala_num=${salaNum}`))[0].id);
  const up = await api("/api/upload", { method: "POST", body: fd }, p1.cookie);
  const est3 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(up.status === 200, "print enviado (casual!)");
  check(est3[0]?.status === "aguardando_revisao", "sala foi para aguardando_revisao", est3[0]?.status);

  // 5. PROPRIETÁRIO (não só admin) vê a fila -> 200 (era 403 antes do fix)
  const [dono] = await psql(`SELECT id FROM users WHERE email='${EMAIL_PROPRIETARIO}'`);
  check(Boolean(dono), `proprietario encontrado (${EMAIL_PROPRIETARIO})`);
  const ownerCookie = await criarSessao(dono.id);
  const fila = await api("/api/revisao/pendentes", {}, ownerCookie);
  const temSala = Array.isArray(fila.body) && fila.body.some((s) => s.salaNum === salaNum);
  check(fila.status === 200, "proprietario acessa /revisao/pendentes (nao 403)", `status ${fila.status}`);
  check(temSala, "sala aparece na fila do proprietario");

  // 6. PROPRIETÁRIO decide (aprova blue) -> encerrada
  const salaUuid = (await psql(`SELECT id FROM matches WHERE sala_num=${salaNum}`))[0].id;
  const { randomUUID } = await import("node:crypto");
  const decidir = await api(`/api/revisao/${salaUuid}/decidir`, { method: "POST", body: JSON.stringify({ winnerSide: "blue", decisionId: randomUUID() }) }, ownerCookie);
  const est4 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(decidir.status === 200, "proprietario decidiu a revisao", `status ${decidir.status}`);
  check(est4[0]?.status === "encerrada", "sala encerrada", est4[0]?.status);

  // 7. LIBERAÇÃO: linked liberado + jogador entra em sala NOVA
  const linked = (await psql(`SELECT count(*)::int AS n FROM match_players WHERE match_id='${salaUuid}' AND linked=true`))[0].n;
  check(Number(linked) === 0, "vinculos liberados apos decisao", `${linked} linked`);
  const nova = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: "1v1", entryMp: 0, nome: "Sala nova smoke", maxJogadores: 2 }) }, p1.cookie);
  check(nova.status === 201, "p1 criou NOVA sala (nao preso)");
  const novaNum = nova.body?.id;
  if (novaNum) {
    const rj = await api(`/api/matches/${novaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: true }) }, p1.cookie);
    check(rj.body?.ok === true, "p1 entrou na nova sala (sem ja_em_outra_sala)", rj.body?.erro || "ok");
  }

  // cleanup: sessões, salas e usuários do smoke (ordem respeita as FKs)
  await psql(`DELETE FROM user_sessions WHERE session_token LIKE 'smoke_owner_%'`);
  await psql(`DELETE FROM user_roles WHERE user_id IN ('${ids}')`);
  await psql(`DELETE FROM game_accounts WHERE user_id IN ('${ids}')`);
  await psql(`DELETE FROM match_prints WHERE match_id IN (SELECT id FROM matches WHERE created_by IN ('${ids}'))`);
  await psql(`DELETE FROM match_players WHERE user_id IN ('${ids}') OR match_id IN (SELECT id FROM matches WHERE created_by IN ('${ids}'))`);
  await psql(`DELETE FROM wallet_transactions WHERE user_id IN ('${ids}')`);
  await psql(`DELETE FROM matches WHERE created_by IN ('${ids}')`);
  await psql(`DELETE FROM user_wallets WHERE user_id IN ('${ids}')`);
  await psql(`DELETE FROM users WHERE id IN ('${ids}')`);

  await dbClient.end();
  console.log(`\n=== RESULTADO: ${ok} ok, ${falhas} falhas ===\n`);
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
