// scripts/smoke-vps-draft.mjs — E2E do draft POR MODO na VPS. Roda DENTRO do
// container (o script vive em /app para o ESM resolver o pacote `pg`):
//   docker cp scripts/smoke-vps-draft.mjs m7arena_app:/app/smoke-draft.mjs
//   docker exec -w /app m7arena_app node smoke-draft.mjs
//
// Cobre: 1v1 e ARAM pulam a fase (confirmou → iniciando_partida com código),
// 5v5 com draft de 20 turnos completo e timeouts (ban vazio/catch-up + pick
// cancela). Cria jogadores/salas de teste e LIMPA tudo no final, inclusive
// liberando os match_codes consumidos (o lobby e o pool não ficam sujos).
const BASE = process.env.BASE || "http://localhost:3000";
const sufixo = Date.now();

// Espelho de TURN_ORDER do modo 5v5 (api/src/lib/draft/modos/5v5.ts).
const TURN_ORDER_5V5 = [
  ["blue", "ban"], ["red", "ban"], ["blue", "ban"], ["red", "ban"],
  ["blue", "ban"], ["red", "ban"],
  ["blue", "pick"], ["red", "pick"], ["red", "pick"], ["blue", "pick"],
  ["blue", "pick"], ["red", "pick"],
  ["red", "ban"], ["blue", "ban"], ["red", "ban"], ["blue", "ban"],
  ["red", "pick"], ["blue", "pick"], ["blue", "pick"], ["red", "pick"],
];

const pg = (await import("pg")).default;
const dbClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
const psql = async (sql) => (await dbClient.query(sql)).rows;
const q1 = async (sql) => (await psql(sql))[0];

async function api(path, opts = {}, token) {
  const headers = { ...(opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}) };
  if (token) headers["Cookie"] = token;
  const r = await fetch(BASE + path, { ...opts, headers });
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("json") ? await r.json() : await r.text();
  return { status: r.status, body, setCookie: r.headers.get("set-cookie") || "" };
}
const extraiCookie = (sc) => (sc.match(/m7_session=[^;]+/) || [])[0] || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function registrar(email) {
  const r = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password: "Smoke@12345", displayName: "Draft " + email.split("@")[0] }) });
  if (r.status !== 201) throw new Error(`register ${email} falhou: ${r.status} ${JSON.stringify(r.body)}`);
  return { id: r.body.user.id, cookie: extraiCookie(r.setCookie) };
}

let ok = 0, falhas = 0;
const check = (c, l, e = "") => { if (c) { ok++; console.log(`  PASS ${l}${e ? ` - ${e}` : ""}`); } else { falhas++; console.log(`  FAIL ${l}${e ? ` - ${e}` : ""}`); } };

const salasCriadas = [];
const jogadoresCriados = [];

/** Registra N jogadores de teste com Riot/termos prontos. */
async function preparaJogadores(prefixo, n) {
  const players = [];
  for (let i = 0; i < n; i++) {
    const p = await registrar(`${prefixo}${i + 1}_${sufixo}@teste.com`);
    players.push(p);
    jogadoresCriados.push(p.id);
  }
  const ids = players.map((p) => p.id).join("','");
  await psql(`UPDATE user_wallets SET mc=0 WHERE user_id IN ('${ids}')`);
  await psql(`UPDATE users SET riot_id='Dft'||substr(id::text,1,8)||'#BR1', termos_aceitos_em=now() WHERE id IN ('${ids}')`);
  await psql(`INSERT INTO game_accounts (user_id, game_id, external_id, handle, verified) SELECT u.id,'lol','puuid-'||u.id,'Dft'||substr(u.id::text,1,8)||'#BR1',true FROM users u WHERE u.id IN ('${ids}') ON CONFLICT (user_id,game_id) DO UPDATE SET handle=EXCLUDED.handle, verified=true`);
  return players;
}

/** Cria sala, entra com os 2 jogadores e confirma os dois. */
async function montarSala(modo, roleSlot, jogadores, nome) {
  const criar = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: modo, entryMp: 0, nome, maxJogadores: 2 }) }, jogadores[0].cookie);
  if (criar.status !== 201) throw new Error(`criar ${modo} falhou: ${criar.status} ${JSON.stringify(criar.body)}`);
  const salaNum = criar.body.id;
  salasCriadas.push(salaNum);
  await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot, is_time_a: true }) }, jogadores[0].cookie);
  await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot, is_time_a: false }) }, jogadores[1].cookie);
  await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, jogadores[0].cookie);
  await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, jogadores[1].cookie);
  await sleep(300);
  return salaNum;
}

async function main() {
  console.log(`\n=== SMOKE VPS: DRAFT POR MODO ===\n`);
  await dbClient.connect();

  // ── Fase 1: 1v1 PULA o draft ──────────────────────────────────────────────
  {
    const [p1, p2] = await preparaJogadores("draft1v1vps_", 2);
    const s1 = await montarSala("1v1", "MID", [p1, p2], "Smoke 1v1 skip VPS");
    const est = (await q1(`SELECT status FROM matches WHERE sala_num=${s1}`))?.status;
    check(est === "iniciando_partida", "1v1: confirmou -> iniciando_partida (pulou o draft)", est);
    const n = (await q1(`SELECT count(*)::int AS n FROM match_drafts WHERE match_id=(SELECT id FROM matches WHERE sala_num=${s1})`))?.n;
    check(n === 0, "1v1: nenhuma linha de draft criada", String(n));
    const cod = (await q1(`SELECT codigo_partida FROM matches WHERE sala_num=${s1}`))?.codigo_partida;
    check(!!cod && cod !== "SEM-CODIGO-AGUARDE", "1v1: codigo atribuido ao pular", cod);
    const det = (await api(`/api/matches/${s1}`, {}, p1.cookie)).body;
    check(det?.draft === null, "1v1: shape.draft null");
    check(det?.estado === "iniciando_partida", "1v1: shape com estado certo", det?.estado);
  }

  // ── Fase 2: ARAM PULA o draft ─────────────────────────────────────────────
  {
    const [p1, p2] = await preparaJogadores("draftaramvps_", 2);
    const s2 = await montarSala("aram", "MID", [p1, p2], "Smoke ARAM skip VPS");
    const est = (await q1(`SELECT status FROM matches WHERE sala_num=${s2}`))?.status;
    check(est === "iniciando_partida", "aram: confirmou -> iniciando_partida (pulou o draft)", est);
    const n = (await q1(`SELECT count(*)::int AS n FROM match_drafts WHERE match_id=(SELECT id FROM matches WHERE sala_num=${s2})`))?.n;
    check(n === 0, "aram: nenhuma linha de draft criada", String(n));
    const det = (await api(`/api/matches/${s2}`, {}, p1.cookie)).body;
    check(det?.draft === null, "aram: shape.draft null");
  }

  // ── Fase 3: 5v5 TEM draft (20 turnos) ─────────────────────────────────────
  {
    const [p1, p2] = await preparaJogadores("draft5v5vps_", 2);
    const s3 = await montarSala("5v5", "JG", [p1, p2], "Smoke 5v5 draft VPS");
    const est = (await q1(`SELECT status FROM matches WHERE sala_num=${s3}`))?.status;
    check(est === "draft", "5v5: confirmou -> draft", est);

    let det = (await api(`/api/matches/${s3}`, {}, p1.cookie)).body;
    check(!!det?.draft, "5v5: shape traz o draft");
    check(det?.draft?.current_phase === "ban" && det?.draft?.current_team === "blue" && det?.draft?.current_turn === 0, "5v5: turno 0 = ban do azul");
    check(!!det?.draft?.turn_deadline_at, "5v5: prazo do turno no relogio do servidor");
    check(det?.draft?.regras?.max_bans_por_lado === 5 && det?.draft?.regras?.max_picks_por_lado === 5, "5v5: regras do modo no shape (5/5 slots)");
    check(det?.draft?.regras?.esconder_picks_adversario === false, "5v5: picks visiveis para todos");
    check(det?.draft?.regras?.role_controladora === "JG", "5v5: vitrine do JG");
    check(det?.draft?.duracao_turno_ms === 30000, "5v5: duracao do turno publicada", String(det?.draft?.duracao_turno_ms));
    check(det?.codigo_partida === null, "5v5: codigo ainda nao atribuido");

    // prazo coerente com o server_time (30s ± 3s) — o bug de fuso do site antigo.
    const restaMs = new Date(det?.draft?.turn_deadline_at).getTime() - det?.server_time;
    check(Math.abs(restaMs - 30_000) < 3_000, `5v5: deadline coerente com server_time (${Math.round(restaMs / 1000)}s ~ 30s)`);

    const errado = await api(`/api/matches/${s3}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Aatrox" }) }, p2.cookie);
    check(errado.body?.erro === "fora_do_turno", "5v5: ban do time errado recusado", errado.body?.erro);

    const b1 = await api(`/api/matches/${s3}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Aatrox" }) }, p1.cookie);
    check(b1.body?.ok === true, "5v5: azul baniu Aatrox");

    const faseErrada = await api(`/api/matches/${s3}/draft/pick`, { method: "POST", body: JSON.stringify({ championId: "Zed" }) }, p2.cookie);
    check(faseErrada.body?.erro === "fase_invalida", "5v5: pick na fase de ban recusado", faseErrada.body?.erro);

    const repetido = await api(`/api/matches/${s3}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Aatrox" }) }, p2.cookie);
    check(repetido.body?.erro === "campeao_indisponivel", "5v5: campeao repetido recusado", repetido.body?.erro);

    const b2 = await api(`/api/matches/${s3}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Ahri" }) }, p2.cookie);
    check(b2.body?.ok === true, "5v5: vermelho baniu Ahri");

    // Completa os turnos restantes (2..19) na ordem do 5v5.
    let completou = true;
    for (let i = 2; i < TURN_ORDER_5V5.length; i++) {
      const [team, phase] = TURN_ORDER_5V5[i];
      const cookie = team === "blue" ? p1.cookie : p2.cookie;
      const r = await api(`/api/matches/${s3}/draft/${phase}`, { method: "POST", body: JSON.stringify({ championId: `Champ${i}` }) }, cookie);
      if (r.body?.ok !== true) { completou = false; console.log(`    turno ${i} (${team}/${phase}) falhou: ${r.body?.erro}`); break; }
    }
    check(completou, "5v5: 20 turnos completados");
    await sleep(300);

    const final1 = await q1(`SELECT status, codigo_partida FROM matches WHERE sala_num=${s3}`);
    check(final1?.status === "iniciando_partida", "5v5: draft fechado -> iniciando_partida", final1?.status);
    check(!!final1?.codigo_partida && final1.codigo_partida !== "SEM-CODIGO-AGUARDE", "5v5: codigo atribuido no fim do draft");
    det = (await api(`/api/matches/${s3}`, {}, p1.cookie)).body;
    check(det?.draft?.status === "finished", "5v5: draft marcado como finished");
    check(det?.draft?.blue_picks?.length === 5 && det?.draft?.red_picks?.length === 5, "5v5: 5 picks por lado persistidos");
    check(det?.draft?.blue_bans?.length === 5 && det?.draft?.red_bans?.length === 5, "5v5: 5 bans por lado persistidos");
  }

  // ── Fase 4: timeouts do 5v5 (ban vazio/catch-up + pick cancela) ───────────
  {
    const [p1, p2] = await preparaJogadores("drafttovps_", 2);
    const s4 = await montarSala("5v5", "JG", [p1, p2], "Smoke 5v5 timeout VPS");
    check((await q1(`SELECT status FROM matches WHERE sala_num=${s4}`))?.status === "draft", "timeout: sala em draft");

    // Prazo 45s no passado (> 1 turno): o catch-up resolve DOIS bans vencidos
    // (turnos 0 e 1) e para no turno 2 (ban do azul).
    await psql(`UPDATE match_drafts SET turn_deadline_at = now() - interval '45 seconds' WHERE match_id = (SELECT id FROM matches WHERE sala_num=${s4})`);
    await api(`/api/matches/${s4}/tick`, { method: "POST", body: "{}" }, p1.cookie);
    await sleep(300);
    const d = await q1(`SELECT blue_bans::text AS bb, red_bans::text AS rb, current_turn AS ct FROM match_drafts WHERE match_id = (SELECT id FROM matches WHERE sala_num=${s4})`);
    check(String(d?.bb).includes("null") && String(d?.rb).includes("null"), "timeout: bans vencidos viraram bans vazios (catch-up)", `${d?.bb} / ${d?.rb}`);
    check(String(d?.ct) === "2", "timeout: catch-up parou no turno 2", String(d?.ct));

    // Pick vencido → cancela o draft e a sala reabre.
    await psql(`UPDATE match_drafts SET current_turn = 6, current_phase = 'pick', current_team = 'blue', turn_deadline_at = now() - interval '45 seconds' WHERE match_id = (SELECT id FROM matches WHERE sala_num=${s4})`);
    await api(`/api/matches/${s4}/tick`, { method: "POST", body: "{}" }, p1.cookie);
    await sleep(300);
    const statusTimeout = (await q1(`SELECT status FROM matches WHERE sala_num=${s4}`))?.status;
    check(statusTimeout === "confirmacao" || statusTimeout === "preenchendo", "timeout: pick vencido cancelou o draft e reabriu", statusTimeout);
    const restou = (await q1(`SELECT count(*)::int AS n FROM match_drafts WHERE match_id = (SELECT id FROM matches WHERE sala_num=${s4})`))?.n;
    check(restou === 0, "timeout: linha do draft removida no cancelamento", String(restou));
  }

  // ── Limpeza: libera códigos, apaga salas e jogadores de teste ─────────────
  for (const num of salasCriadas) {
    await psql(`UPDATE match_codes SET used=false, match_id=NULL WHERE match_id = (SELECT id FROM matches WHERE sala_num=${num})`);
    await psql(`DELETE FROM matches WHERE sala_num=${num}`);
  }
  const idsLimpar = jogadoresCriados.map((id) => `'${id}'`).join(",");
  await psql(`DELETE FROM game_accounts WHERE user_id IN (${idsLimpar})`);
  await psql(`DELETE FROM user_wallets WHERE user_id IN (${idsLimpar})`);
  await psql(`DELETE FROM users WHERE id IN (${idsLimpar})`);
  console.log(`  (limpeza: ${salasCriadas.length} sala(s) + ${jogadoresCriados.length} jogador(es) de teste removidos, códigos liberados)`);

  console.log(`\n=== RESULTADO VPS: ${ok} PASS / ${falhas} FAIL ===\n`);
  await dbClient.end();
  process.exit(falhas > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error("ERRO FATAL:", e?.message || e); try { await dbClient.end(); } catch {} process.exit(1); });
