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

  // ── 3b) Escolha de lado → first/last pick (passo 4) ─────────────────────
  const cookieDoLado = (lado) => (lado === "blue" ? membA.cookie : membB.cookie);
  const ladoSorteado = estado?.escolha_time;
  const ladoOutro = ladoSorteado === "blue" ? "red" : "blue";
  const foraDaVez = await api(
    `/api/matches/${salaNum}/sala-campeonato/lado`,
    { method: "POST", body: JSON.stringify({ lado: "blue" }) },
    cookieDoLado(ladoOutro)
  );
  check(foraDaVez.body?.erro === "fora_da_vez", "lado: fora da vez recusado", foraDaVez.body?.erro);
  const escolheuLado = await api(
    `/api/matches/${salaNum}/sala-campeonato/lado`,
    { method: "POST", body: JSON.stringify({ lado: "red" }) },
    cookieDoLado(ladoSorteado)
  );
  check(escolheuLado.body?.ok === true, "lado: sorteado escolheu (red)", JSON.stringify(escolheuLado.body));
  const pickOrder = await api(
    `/api/matches/${salaNum}/sala-campeonato/pick-order`,
    { method: "POST", body: JSON.stringify({ ordem: "first" }) },
    cookieDoLado(ladoOutro)
  );
  check(
    pickOrder.body?.ok === true && pickOrder.body?.estado === "camp_draft",
    "pick order: adversário escolheu first → camp_draft",
    JSON.stringify(pickOrder.body)
  );
  const estadoPos = await q1(
    `SELECT lado_escolhido, pick_order_escolhido, escolha_time FROM campeonato_sala_estado WHERE match_id='${salaId}'`
  );
  check(
    estadoPos?.lado_escolhido === "red" && estadoPos?.pick_order_escolhido === "first" && estadoPos?.escolha_time === ladoOutro,
    "estado: lado + pick order persistidos",
    JSON.stringify(estadoPos)
  );

  // ── 3c) Draft do campeonato (passo 5): 20 turnos via HTTP ────────────────
  const cookieDoSide = (s) => (s === "blue" ? membA.cookie : membB.cookie);
  const detIni = (await api(`/api/matches/${salaNum}`, {}, membA.cookie)).body;
  const draftIni = detIni?.campeonato?.draft;
  check(
    !!draftIni && draftIni.current_turn === 0 && draftIni.current_phase === "ban",
    "draft: criado na entrada de camp_draft",
    JSON.stringify({ turn: draftIni?.current_turn, phase: draftIni?.current_phase, team: draftIni?.current_team })
  );

  let turnos = 0;
  const usados = [];
  let erroLadoTestado = false;
  let repetidoTestado = false;
  for (let i = 0; i < 20; i++) {
    const d = (await api(`/api/matches/${salaNum}`, {}, membA.cookie)).body?.campeonato?.draft;
    if (!d || d.status !== "ongoing") break;
    if (!erroLadoTestado) {
      const outro = cookieDoSide(d.current_team === "blue" ? "red" : "blue");
      const er = await api(
        `/api/matches/${salaNum}/sala-campeonato/${d.current_phase}`,
        { method: "POST", body: JSON.stringify({ championId: `XX${i}` }) },
        outro
      );
      check(er.body?.erro === "fora_do_turno", "draft: ação do lado errado recusada", er.body?.erro);
      erroLadoTestado = true;
    }
    if (!repetidoTestado && usados.length >= 2) {
      const rep = await api(
        `/api/matches/${salaNum}/sala-campeonato/${d.current_phase}`,
        { method: "POST", body: JSON.stringify({ championId: usados[0] }) },
        cookieDoSide(d.current_team)
      );
      check(rep.body?.erro === "campeao_indisponivel", "draft: campeão repetido recusado", rep.body?.erro);
      repetidoTestado = true;
    }
    const champ = `SmkD${i}`;
    const r = await api(
      `/api/matches/${salaNum}/sala-campeonato/${d.current_phase}`,
      { method: "POST", body: JSON.stringify({ championId: champ }) },
      cookieDoSide(d.current_team)
    );
    if (r.body?.ok !== true) {
      check(false, `draft: turno ${i} falhou`, r.body?.erro);
      break;
    }
    usados.push(champ);
    turnos++;
  }
  check(turnos === 20, "draft: 20 turnos completados via HTTP", String(turnos));
  const detFim = (await api(`/api/matches/${salaNum}`, {}, membA.cookie)).body;
  check(detFim?.campeonato?.draft?.status === "finished", "draft: finished", detFim?.campeonato?.draft?.status);
  check(detFim?.estado === "camp_jogo", "draft: sala → camp_jogo", detFim?.estado);

  // ── 3d) Live do streamer (passo 6) ───────────────────────────────────────
  const streamer = await registrar(`salacstr${sufixo}@teste.com`);
  usuarios.push(streamer.id);
  const semCargo = await api(`/api/matches/${salaNum}/sala-campeonato/live`, { method: "POST", body: "{}" }, streamer.cookie);
  check(semCargo.body?.erro === "sem_cargo_streamer", "live: sem cargo recusado", semCargo.body?.erro);
  await psql(`INSERT INTO user_roles (user_id, role) VALUES ('${streamer.id}','streamer')`);
  await psql(`UPDATE users SET socials = '{"twitch":"smoke_canal"}'::jsonb WHERE id='${streamer.id}'`);
  const live = await api(`/api/matches/${salaNum}/sala-campeonato/live`, { method: "POST", body: "{}" }, streamer.cookie);
  check(live.body?.ok === true && live.body?.twitch === "smoke_canal", "live: streamer abre a live do jogo", JSON.stringify(live.body));
  const detLive = (await api(`/api/matches/${salaNum}`)).body;
  check(detLive?.campeonato?.live?.twitch === "smoke_canal", "live: shape expõe 'assista ao vivo'", JSON.stringify(detLive?.campeonato?.live));

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
