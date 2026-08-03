// scripts/smoke-casual-revisao.mjs — valida a decisão de 2026-08-03: sala
// CASUAL (0 MC) também vai para a revisão do admin (sem votação de player).
// Fluxo: criar 1v1 casual → 2 jogadores entram → confirmam → partida inicia →
// um envia print → aguardando_revisao → admin aprova → encerrada.
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

async function login(email, senha) {
  const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: senha }) });
  if (r.status !== 200) throw new Error(`login ${email} falhou: ${r.status}`);
  return extraiCookie(r.setCookie);
}
async function registrar(email) {
  const r = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password: "Smoke@12345", displayName: "Casual " + email.split("@")[0] }) });
  if (r.status !== 201) throw new Error(`register ${email} falhou: ${r.status}`);
  return { id: r.body.user.id, cookie: extraiCookie(r.setCookie) };
}
async function psql(sql) {
  const { execSync } = await import("node:child_process");
  return execSync(`docker exec m7arena_local_postgres psql -U postgres -d m7arena -t -A -c "${sql.replace(/"/g, '\\"')}"`, { encoding: "utf8", shell: "cmd.exe" }).trim();
}

let ok = 0, falhas = 0;
const check = (c, l, e = "") => { if (c) { ok++; console.log(`  ✔ ${l}${e ? ` — ${e}` : ""}`); } else { falhas++; console.log(`  ✘ ${l}${e ? ` — ${e}` : ""}`); } };

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  console.log(`\n═══ FLUXO SALA CASUAL → REVISÃO ADMIN ═══\n`);

  const p1 = await registrar(`cas1_${sufixo}@teste.com`);
  const p2 = await registrar(`cas2_${sufixo}@teste.com`);
  console.log("  2 jogadores registrados");

  const ids = [p1.id, p2.id].join("','");
  await psql(`UPDATE user_wallets SET mc=0 WHERE user_id IN ('${ids}')`);
  await psql(`UPDATE users SET riot_id='Cas'||substr(id::text,1,8)||'#BR1', termos_aceitos_em=now() WHERE id IN ('${ids}')`);
  await psql(`INSERT INTO game_accounts (user_id, game_id, external_id, handle, verified) SELECT u.id,'lol','puuid-'||u.id,'Cas'||substr(u.id::text,1,8)||'#BR1',true FROM users u WHERE u.id IN ('${ids}') ON CONFLICT (user_id,game_id) DO UPDATE SET handle=EXCLUDED.handle, verified=true`);

  // 1. Cria sala 1v1 CASUAL (entryMp 0)
  const criar = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: "1v1", entryMp: 0, nome: "Casual revisao", maxJogadores: 2 }) }, p1.cookie);
  check(criar.status === 201, "sala 1v1 casual criada");
  const salaNum = criar.body.id;

  // 2. P1 entra blue, P2 entra red → confirmacao
  const e1 = await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: true }) }, p1.cookie);
  const e2 = await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: false }) }, p2.cookie);
  const estado1 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(e1.body?.ok && e2.body?.ok, "2 jogadores entraram", estado1);
  check(estado1 === "confirmacao", "sala foi para confirmacao", estado1);

  // 3. Ambos confirmam → iniciando_partida → partida_iniciada
  const c1 = await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, p1.cookie);
  const c2 = await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, p2.cookie);
  await new Promise((r) => setTimeout(r, 200));
  const estado2 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(c1.body?.ok && c2.body?.ok, "ambos confirmaram", estado2);
  check(estado2 === "iniciando_partida" || estado2 === "partida_iniciada", "sala em partida", estado2);

  // 4. Força partida_iniciada (espera ou força direto)
  await psql(`UPDATE matches SET status='partida_iniciada', state_deadline_at=NULL WHERE sala_num=${salaNum}`);

  // 5. P1 envia print → deve ir para aguardando_revisao (mesmo sendo CASUAL)
  const bin = Buffer.from(PNG, "base64");
  const fd = new FormData();
  fd.append("file", new Blob([bin], { type: "image/png" }), "print.png");
  fd.append("bucket", "match-prints");
  fd.append("path", (await psql(`SELECT id FROM matches WHERE sala_num=${salaNum}`)));
  const up = await api("/api/upload", { method: "POST", body: fd }, p1.cookie);
  const estado3 = await psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(up.status === 200, "print enviado (casual!)", `status ${up.status}`);
  check(estado3 === "aguardando_revisao", "casual foi para aguardando_revisao (sem votação)", estado3);

  // 6. Admin vê na fila de revisão
  const adm = await login("admin@m7arena.local", "Admin@M7Arena2026");
  const fila = await api("/api/revisao/pendentes", {}, adm);
  const temSala = Array.isArray(fila.body) && fila.body.some((s) => s.salaNum === salaNum);
  check(temSala, "admin vê a sala casual na fila de revisão");

  // 7. Admin aprova Time A (blue) → encerrada com resultado (sem dinheiro envolvido)
  const salaUuid = await psql(`SELECT id FROM matches WHERE sala_num=${salaNum}`);
  const { randomUUID } = await import("node:crypto");
  const decidir = await api(`/api/revisao/${salaUuid}/decidir`, { method: "POST", body: JSON.stringify({ winnerSide: "blue", decisionId: randomUUID() }) }, adm);
  const estado4 = await psql(`SELECT status, winner_side FROM matches WHERE sala_num=${salaNum}`);
  check(decidir.status === 200, "admin aprovou Time A", `status ${decidir.status}`);
  check(estado4.startsWith("encerrada"), "sala encerrada pelo admin", estado4.replace(/\|/g, " | "));

  // 8. REGRESSÃO do bug "não pode entrar em outra sala": após o admin decidir,
  //    o vínculo (linked) dos jogadores é liberado — um deles consegue entrar
  //    numa sala NOVA (o join checa `outrosVinculos` com linked=true).
  const linked = await psql(`SELECT count(*) FROM match_players WHERE match_id=(SELECT id FROM matches WHERE sala_num=${salaNum}) AND linked=true`);
  check(Number(linked) === 0, "vinculos liberados apos decisao do admin", `${linked} linked`);

  const nova = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: "1v1", entryMp: 0, nome: "Nova sala", maxJogadores: 2 }) }, p1.cookie);
  check(nova.status === 201, "p1 criou NOVA sala apos partida encerrada (nao preso)", `status ${nova.status}`);
  const novaNum = nova.body?.id;
  if (novaNum) {
    const rj = await api(`/api/matches/${novaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: true }) }, p1.cookie);
    check(rj.body?.ok === true, "p1 entrou na nova sala (nao recebeu ja_em_outra_sala)", rj.body?.erro || "ok");
  }

  console.log(`\n═══ RESULTADO: ${ok} ok, ${falhas} falhas ═══\n`);
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
