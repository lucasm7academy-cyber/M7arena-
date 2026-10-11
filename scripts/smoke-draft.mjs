// scripts/smoke-draft.mjs — valida o DRAFT por modo de ponta a ponta no stack
// local (http://localhost:3000):
//
//   1. 1v1 pula a fase: confirmou → iniciando_partida com código, sem draft;
//   2. ARAM pula a fase: idem;
//   3. 5v5 abre o draft de 20 turnos e só fecha no último pick;
//   4. timeouts do 5v5: ban vencido vira ban vazio (com catch-up) e pick
//      vencido cancela a sala (volta para confirmacao).
//
// A ordem do draft mora em api/src/lib/draft/modos/5v5.ts — este smoke é
// independente do código e espelha a ordem na constante abaixo; se o registry
// mudar, atualize aqui.
//
// O PSQL executa no container m7arena_local_postgres — via docker CLI (WSL)
// quando necessário.
const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
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

// psql: tenta docker direto (PATH com docker CLI) e cai para `wsl -d Ubuntu`
// (Docker Desktop engine) quando o docker não existe no Windows.
import { execSync } from "node:child_process";
function psql(sql) {
  const cmd = `docker exec m7arena_local_postgres psql -U postgres -d m7arena -t -A -c "${sql.replace(/"/g, '\\"')}"`;
  try {
    return execSync(cmd, { encoding: "utf8", shell: "cmd.exe" }).trim();
  } catch {
    const cmd2 = `wsl -d Ubuntu -e bash -c 'docker exec m7arena_local_postgres psql -U postgres -d m7arena -t -A -c "${sql.replace(/"/g, '\\"')}"'`;
    return execSync(cmd2, { encoding: "utf8" }).trim();
  }
}

let ok = 0, falhas = 0;
const check = (c, l, e = "") => { if (c) { ok++; console.log(`  PASS ${l}${e ? ` — ${e}` : ""}`); } else { falhas++; console.log(`  FAIL ${l}${e ? ` — ${e}` : ""}`); } };

async function preparaJogadores(prefixo, n) {
  const players = [];
  for (let i = 0; i < n; i++) {
    const p = await registrar(`${prefixo}${i + 1}_${sufixo}@teste.com`);
    players.push(p);
  }
  const ids = players.map((p) => p.id).join("','");
  psql(`UPDATE user_wallets SET mc=0 WHERE user_id IN ('${ids}')`);
  psql(`UPDATE users SET riot_id='Dft'||substr(id::text,1,8)||'#BR1', termos_aceitos_em=now() WHERE id IN ('${ids}')`);
  psql(`INSERT INTO game_accounts (user_id, game_id, external_id, handle, verified) SELECT u.id,'lol','puuid-'||u.id,'Dft'||substr(u.id::text,1,8)||'#BR1',true FROM users u WHERE u.id IN ('${ids}') ON CONFLICT (user_id,game_id) DO UPDATE SET handle=EXCLUDED.handle, verified=true`);
  return players;
}

async function detalheSala(salaNum, cookie) {
  const r = await api(`/api/matches/${salaNum}`, {}, cookie);
  return r.body;
}

/** Cria sala, entra com os 2 jogadores e confirma os dois. */
async function montarSala(modo, roleSlot, jogadores, nome, salas) {
  const criar = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: modo, entryMp: 0, nome, maxJogadores: 2 }) }, jogadores[0].cookie);
  if (criar.status !== 201) throw new Error(`criar ${modo} falhou: ${criar.status} ${JSON.stringify(criar.body)}`);
  const salaNum = criar.body.id;
  salas.push(salaNum);
  await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot, is_time_a: true }) }, jogadores[0].cookie);
  await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot, is_time_a: false }) }, jogadores[1].cookie);
  await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, jogadores[0].cookie);
  await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, jogadores[1].cookie);
  await sleep(300);
  return salaNum;
}

async function main() {
  console.log(`\n=== SMOKE DRAFT POR MODO ===\n`);
  const salas = [];

  // ── Fase 1: 1v1 PULA o draft ──────────────────────────────────────────────
  {
    const [p1, p2] = await preparaJogadores("draft1v1_", 2);
    const s1 = await montarSala("1v1", "MID", [p1, p2], "Smoke 1v1 skip", salas);
    check(psql(`SELECT status FROM matches WHERE sala_num=${s1}`) === "iniciando_partida", "1v1: confirmou → iniciando_partida (pulou o draft)");
    check(psql(`SELECT count(*) FROM match_drafts WHERE match_id=(SELECT id FROM matches WHERE sala_num=${s1})`) === "0", "1v1: nenhuma linha de draft criada");
    check(psql(`SELECT codigo_partida IS NOT NULL AND codigo_partida <> 'SEM-CODIGO-AGUARDE' FROM matches WHERE sala_num=${s1}`) === "t", "1v1: código atribuído ao pular");
    const det = await detalheSala(s1, p1.cookie);
    check(det?.draft === null, "1v1: shape.draft null");
    check(det?.estado === "iniciando_partida", "1v1: shape com estado certo", det?.estado);
  }

  // ── Fase 2: ARAM PULA o draft ─────────────────────────────────────────────
  {
    const [p1, p2] = await preparaJogadores("draftaram_", 2);
    const s2 = await montarSala("aram", "MID", [p1, p2], "Smoke ARAM skip", salas);
    check(psql(`SELECT status FROM matches WHERE sala_num=${s2}`) === "iniciando_partida", "aram: confirmou → iniciando_partida (pulou o draft)");
    check(psql(`SELECT count(*) FROM match_drafts WHERE match_id=(SELECT id FROM matches WHERE sala_num=${s2})`) === "0", "aram: nenhuma linha de draft criada");
    const det = await detalheSala(s2, p1.cookie);
    check(det?.draft === null, "aram: shape.draft null");
  }

  // ── Fase 3: 5v5 TEM draft (20 turnos) ─────────────────────────────────────
  {
    const [p1, p2] = await preparaJogadores("draft5v5_", 2);
    const s3 = await montarSala("5v5", "JG", [p1, p2], "Smoke 5v5 draft", salas);
    check(psql(`SELECT status FROM matches WHERE sala_num=${s3}`) === "draft", "5v5: confirmou → draft");

    let sala = await detalheSala(s3, p1.cookie);
    check(!!sala.draft, "5v5: shape traz o draft");
    check(sala.draft.current_phase === "ban" && sala.draft.current_team === "blue" && sala.draft.current_turn === 0, "5v5: turno 0 = ban do azul");
    check(!!sala.draft.turn_deadline_at, "5v5: prazo do turno no relógio do servidor");
    check(sala.draft.regras?.max_bans_por_lado === 5 && sala.draft.regras?.max_picks_por_lado === 5, "5v5: regras do modo no shape (5/5 slots)");
    check(sala.draft.regras?.esconder_picks_adversario === false, "5v5: picks visíveis para todos");
    check(sala.draft.regras?.role_controladora === "JG", "5v5: vitrine do JG");
    check(sala.draft.duracao_turno_ms === 30000, "5v5: duração do turno publicada", String(sala.draft.duracao_turno_ms));
    check(sala.codigo_partida === null, "5v5: código ainda não atribuído (só no fim do draft)");

    // Ações inválidas recusadas pelo servidor.
    const errado = await api(`/api/matches/${s3}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Aatrox" }) }, p2.cookie);
    check(errado.body?.erro === "fora_do_turno", "5v5: ban do time errado recusado", errado.body?.erro);

    const b1 = await api(`/api/matches/${s3}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Aatrox" }) }, p1.cookie);
    check(b1.body?.ok === true, "5v5: azul baniu Aatrox");

    const faseErrada = await api(`/api/matches/${s3}/draft/pick`, { method: "POST", body: JSON.stringify({ championId: "Zed" }) }, p2.cookie);
    check(faseErrada.body?.erro === "fase_invalida", "5v5: pick na fase de ban recusado", faseErrada.body?.erro);

    const repetido = await api(`/api/matches/${s3}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Aatrox" }) }, p2.cookie);
    check(repetido.body?.erro === "campeao_indisponivel", "5v5: campeão repetido recusado", repetido.body?.erro);

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

    check(psql(`SELECT status FROM matches WHERE sala_num=${s3}`) === "iniciando_partida", "5v5: draft fechado → iniciando_partida");
    check(psql(`SELECT codigo_partida IS NOT NULL AND codigo_partida <> 'SEM-CODIGO-AGUARDE' FROM matches WHERE sala_num=${s3}`) === "t", "5v5: código atribuído no fim do draft");

    sala = await detalheSala(s3, p1.cookie);
    check(sala.draft?.status === "finished", "5v5: draft marcado como finished");
    check(sala.draft?.blue_picks?.length === 5 && sala.draft?.red_picks?.length === 5, "5v5: 5 picks por lado persistidos");
    check(sala.draft?.blue_bans?.length === 5 && sala.draft?.red_bans?.length === 5, "5v5: 5 bans por lado persistidos");
  }

  // ── Fase 4: timeouts do 5v5 (ban vazio/catch-up + pick cancela) ───────────
  {
    const [p1, p2] = await preparaJogadores("draftto_", 2);
    const s4 = await montarSala("5v5", "JG", [p1, p2], "Smoke 5v5 timeout", salas);
    check(psql(`SELECT status FROM matches WHERE sala_num=${s4}`) === "draft", "timeout: sala em draft");

    // Prazo 45s no passado (> 1 turno): o catch-up resolve DOIS bans vencidos
    // (turnos 0 e 1) e para no turno 2 (ban do azul).
    psql(`UPDATE match_drafts SET turn_deadline_at = now() - interval '45 seconds' WHERE match_id = (SELECT id FROM matches WHERE sala_num=${s4})`);
    await api(`/api/matches/${s4}/tick`, { method: "POST", body: "{}" }, p1.cookie);
    await sleep(300);
    const d = psql(`SELECT blue_bans::text, red_bans::text, current_turn, current_phase FROM match_drafts WHERE match_id = (SELECT id FROM matches WHERE sala_num=${s4})`);
    check(d.includes("null"), "timeout: ban vencido virou ban vazio (com catch-up)", d);
    check(psql(`SELECT current_turn FROM match_drafts WHERE match_id = (SELECT id FROM matches WHERE sala_num=${s4})`) === "2", "timeout: catch-up parou no turno 2");

    // Pick vencido → cancela o draft e a sala reabre (confirmacao/preenchendo).
    psql(`UPDATE match_drafts SET current_turn = 6, current_phase = 'pick', current_team = 'blue', turn_deadline_at = now() - interval '45 seconds' WHERE match_id = (SELECT id FROM matches WHERE sala_num=${s4})`);
    await api(`/api/matches/${s4}/tick`, { method: "POST", body: "{}" }, p1.cookie);
    await sleep(300);
    const statusTimeout = psql(`SELECT status FROM matches WHERE sala_num=${s4}`);
    check(statusTimeout === "confirmacao" || statusTimeout === "preenchendo", "timeout: pick vencido cancelou o draft e reabriu", statusTimeout);
    check(psql(`SELECT count(*) FROM match_drafts WHERE match_id = (SELECT id FROM matches WHERE sala_num=${s4})`) === "0", "timeout: linha do draft removida no cancelamento");
  }

  // ── Limpeza: libera códigos presos e apaga as salas de teste ──────────────
  for (const num of salas) {
    psql(`UPDATE match_codes SET used=false, match_id=NULL WHERE match_id = (SELECT id FROM matches WHERE sala_num=${num})`);
    psql(`DELETE FROM matches WHERE sala_num=${num}`);
  }
  console.log(`  (limpeza: ${salas.length} sala(s) de teste removida(s) e códigos liberados)`);

  console.log(`\n=== RESULTADO: ${ok} PASS / ${falhas} FAIL ===\n`);
  process.exit(falhas > 0 ? 1 : 0);
}

main().catch((e) => { console.error("ERRO FATAL:", e?.message || e); process.exit(1); });
