// scripts/smoke-vps-sala-campeonato.mjs — E2E da Sala Campeonato na VPS. Roda
// DENTRO do container (o script vive em /app para o ESM resolver o pacote `pg`):
//   docker cp scripts/smoke-vps-sala-campeonato.mjs m7arena_app:/app/smoke-sala.mjs
//   docker exec -w /app m7arena_app node smoke-sala.mjs
//
// Cobre: criação AUTOMÁTICA (T-10min via varredura de 1 min), criação MANUAL
// (A COMBINAR via endpoint), vagas (membro/anon), PRONTOs → sorteio do jogo 1,
// shape com bloco `campeonato` e código redigido para anônimo. Cria dados de
// teste e limpa tudo no final (inclusive devolvendo os códigos ao pool).
const BASE = process.env.BASE || "http://localhost:3000";
const sufixo = Date.now();

const pg = (await import("pg")).default;
const dbClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
const psql = async (sql) => (await dbClient.query(sql)).rows;
const q1 = async (sql) => (await psql(sql))[0];

let ok = 0,
  falhas = 0;
const check = (c, l, e = "") => {
  if (c) {
    ok++;
    console.log(`  PASS ${l}${e ? ` - ${e}` : ""}`);
  } else {
    falhas++;
    console.log(`  FAIL ${l}${e ? ` - ${e}` : ""}`);
  }
};

async function api(path, opts = {}, cookie) {
  const headers = { ...(opts.body ? { "Content-Type": "application/json" } : {}) };
  if (cookie) headers["Cookie"] = cookie;
  const r = await fetch(BASE + path, { ...opts, headers });
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("json") ? await r.json() : await r.text();
  return { status: r.status, body, setCookie: r.headers.get("set-cookie") || "" };
}
const extraiCookie = (sc) => (sc.match(/m7_session=[^;]+/) || [])[0] || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function registrar(email) {
  const r = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "Smoke@12345", displayName: "Sala " + email.split("@")[0] }),
  });
  if (r.status !== 201) throw new Error(`register ${email} falhou: ${r.status} ${JSON.stringify(r.body)}`);
  return { id: r.body.user.id, cookie: extraiCookie(r.setCookie) };
}

function daquiMinSP(min) {
  const d = new Date(Date.now() + min * 60000);
  const data = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const hora = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return { data, hora };
}

const usuarios = [];
let torneioId = null;

async function main() {
  console.log(`\n=== SMOKE VPS: SALA CAMPEONATO ===\n`);
  await dbClient.connect();

  // ── Dados de teste (times, membros, campeonato e 2 séries) ───────────────
  const org = await registrar(`salacorg${sufixo}@teste.com`);
  const membA = await registrar(`salacma${sufixo}@teste.com`);
  const membB = await registrar(`salacmb${sufixo}@teste.com`);
  usuarios.push(org.id, membA.id, membB.id);

  const tag = "S" + String(sufixo).slice(-3);
  const [t1] = await psql(
    `INSERT INTO teams (game_id, name, tag, owner_id) VALUES ('lol','Smoke Sala A','${tag}A','${org.id}') RETURNING id`
  );
  const [t2] = await psql(
    `INSERT INTO teams (game_id, name, tag, owner_id) VALUES ('lol','Smoke Sala B','${tag}B','${org.id}') RETURNING id`
  );
  await psql(
    `INSERT INTO team_members (team_id, user_id, role_slot, status) VALUES ('${t1.id}','${membA.id}','mid','accepted'), ('${t2.id}','${membB.id}','coach','accepted')`
  );
  const [torneio] = await psql(
    `INSERT INTO tournaments (game_id, slug, name, format, status, organizer_id) VALUES ('lol','smk-${sufixo}','Smoke Sala ${sufixo}','groups','in_progress','${org.id}') RETURNING id`
  );
  torneioId = torneio.id;
  const { data, hora } = daquiMinSP(5);
  const [serieAuto] = await psql(
    `INSERT INTO tournament_matches (tournament_id, phase, round, team_a_id, team_b_id, team_a_tag, team_b_tag, status, display_date, display_time) VALUES ('${torneio.id}','group_stage',0,'${t1.id}','${t2.id}','${tag}A','${tag}B','confirmado','${data}','${hora}') RETURNING id`
  );
  const [serieManual] = await psql(
    `INSERT INTO tournament_matches (tournament_id, phase, round, team_a_id, team_b_id, team_a_tag, team_b_tag, status, display_date, display_time) VALUES ('${torneio.id}','group_stage',0,'${t1.id}','${t2.id}','${tag}A','${tag}B','confirmado','A COMBINAR','--:--') RETURNING id`
  );
  await psql(`INSERT INTO match_codes (code, used) VALUES ('BR-SMOKE-SALA-${sufixo}-1', false), ('BR-SMOKE-SALA-${sufixo}-2', false)`);

  // ── 1) Criação AUTOMÁTICA (varredura de 1 min, T-10) ─────────────────────
  let salaAuto = null;
  for (let i = 0; i < 20 && !salaAuto; i++) {
    await sleep(5000);
    salaAuto = await q1(`SELECT id, sala_num, status, codigo_partida FROM matches WHERE tournament_match_id='${serieAuto.id}' LIMIT 1`);
  }
  check(!!salaAuto, "auto: sala criada pela varredura (T-10min)", salaAuto ? `#${salaAuto.sala_num}` : "não apareceu em 100s");
  if (salaAuto) {
    check(salaAuto.status === "camp_vagas", "auto: nasce em camp_vagas", salaAuto.status);
    check(!!salaAuto.codigo_partida, "auto: código Riot atribuído", salaAuto.codigo_partida);
    const serieDb = await q1(`SELECT status, codigo_partida FROM tournament_matches WHERE id='${serieAuto.id}'`);
    check(serieDb.status === "em_andamento", "auto: série em_andamento (equivale ao Iniciar Série)", serieDb.status);
    const dup = await q1(`SELECT count(*)::int AS n FROM matches WHERE tournament_match_id='${serieAuto.id}'`);
    check(dup.n === 1, "auto: não duplica em novas varreduras", String(dup.n));
  }

  // ── 2) Criação MANUAL (A COMBINAR, pelo participante) ────────────────────
  const anon = await api(`/api/tournaments/${torneio.id}/jogo/${serieManual.id}/sala`, { method: "POST", body: "{}" });
  check(anon.status === 401, "manual: anônimo → 401", String(anon.status));
  const manual = await api(`/api/tournaments/${torneio.id}/jogo/${serieManual.id}/sala`, { method: "POST", body: "{}" }, membA.cookie);
  check(manual.status === 200 && manual.body?.criada === true, "manual: membro cria a sala (A COMBINAR)", JSON.stringify(manual.body));
  const manual2 = await api(`/api/tournaments/${torneio.id}/jogo/${serieManual.id}/sala`, { method: "POST", body: "{}" }, membA.cookie);
  check(manual2.body?.criada === false, "manual: 2ª chamada devolve a existente (idempotente)");

  // ── 3) Vagas + PRONTOs (na sala do caminho automático) ───────────────────
  const salaNum = salaAuto?.sala_num ?? manual.body?.sala_num;
  const salaId = salaAuto?.id ?? manual.body?.sala_id;
  const vagaAnon = await api(`/api/matches/${salaNum}/sala-campeonato/entrar`, { method: "POST", body: JSON.stringify({ side: "blue" }) });
  check(vagaAnon.status === 401, "vaga: anônimo → 401", String(vagaAnon.status));
  const entrarA = await api(`/api/matches/${salaNum}/sala-campeonato/entrar`, { method: "POST", body: JSON.stringify({ side: "blue" }) }, membA.cookie);
  check(entrarA.body?.ok === true, "vaga: membro A entra no azul", JSON.stringify(entrarA.body));
  const ladoErrado = await api(`/api/matches/${salaNum}/sala-campeonato/entrar`, { method: "POST", body: JSON.stringify({ side: "red" }) }, membA.cookie);
  check(ladoErrado.body?.erro === "nao_e_do_time" || ladoErrado.body?.erro === "ja_esta_na_sala", "vaga: lado de outro time recusado", ladoErrado.body?.erro);
  const entrarB = await api(`/api/matches/${salaNum}/sala-campeonato/entrar`, { method: "POST", body: JSON.stringify({ side: "red" }) }, membB.cookie);
  check(entrarB.body?.ok === true && entrarB.body?.estado === "camp_prontos", "vaga: coach B entra no vermelho → camp_prontos", JSON.stringify(entrarB.body));

  const prontoA = await api(`/api/matches/${salaNum}/sala-campeonato/pronto`, { method: "POST", body: "{}" }, membA.cookie);
  check(prontoA.body?.ok === true && prontoA.body?.estado === "camp_prontos", "pronto: 1º PRONTO fica em camp_prontos");
  const prontoB = await api(`/api/matches/${salaNum}/sala-campeonato/pronto`, { method: "POST", body: "{}" }, membB.cookie);
  check(prontoB.body?.ok === true && prontoB.body?.estado === "camp_lado", "pronto: os DOIS → camp_lado", JSON.stringify(prontoB.body));
  const estado = await q1(`SELECT jogo, sorteio_vencedor, escolha_time FROM campeonato_sala_estado WHERE match_id='${salaId}'`);
  check(
    !!estado && ["blue", "red"].includes(estado.sorteio_vencedor) && estado.escolha_time === estado.sorteio_vencedor,
    "sorteio: jogo 1 com quem escolhe primeiro persistido",
    estado ? `${estado.sorteio_vencedor} → ${estado.escolha_time}` : "sem estado"
  );

  // ── 4) Shape: bloco campeonato + código redigido para anônimo ────────────
  const detAnon = await api(`/api/matches/${salaNum}`);
  check(!!detAnon.body?.campeonato, "shape: bloco campeonato presente");
  check(detAnon.body?.campeonato?.jogo === 1, "shape: jogo corrente 1", String(detAnon.body?.campeonato?.jogo));
  check(detAnon.body?.codigo_partida === null, "shape: anônimo NÃO vê o código");
  const detMembro = await api(`/api/matches/${salaNum}`, {}, membA.cookie);
  check(typeof detMembro.body?.codigo_partida === "string" && detMembro.body.codigo_partida.length > 0, "shape: membro do time vê o código");

  // ── Limpeza ──────────────────────────────────────────────────────────────
  await psql(`UPDATE match_codes SET used=false, match_id=NULL WHERE code LIKE 'BR-SMOKE-SALA-${sufixo}'`);
  if (torneioId) await psql(`DELETE FROM tournaments WHERE id='${torneioId}'`); // cascata: séries + salas + estado
  await psql(`DELETE FROM team_members WHERE team_id IN ('${t1.id}','${t2.id}')`);
  await psql(`DELETE FROM teams WHERE id IN ('${t1.id}','${t2.id}')`);
  const ids = usuarios.map((id) => `'${id}'`).join(",");
  await psql(`DELETE FROM user_sessions WHERE user_id IN (${ids})`);
  await psql(`DELETE FROM user_roles WHERE user_id IN (${ids})`);
  await psql(`DELETE FROM game_accounts WHERE user_id IN (${ids})`);
  await psql(`DELETE FROM user_wallets WHERE user_id IN (${ids})`);
  await psql(`DELETE FROM users WHERE id IN (${ids})`);
  console.log(`  (limpeza: torneio de teste + times + 3 usuários removidos, código devolvido)`);

  console.log(`\n=== RESULTADO VPS: ${ok} PASS / ${falhas} FAIL ===\n`);
  await dbClient.end();
  process.exit(falhas > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("ERRO FATAL:", e?.message || e);
  try {
    await dbClient.end();
  } catch {}
  process.exit(1);
});
