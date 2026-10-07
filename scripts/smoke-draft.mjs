// scripts/smoke-draft.mjs — valida o DRAFT (ban/pick) de ponta a ponta no
// stack local: confirmacao → draft → bans/picks → iniciando_partida, mais os
// timeouts (ban vencido vira ban vazio; pick vencido cancela e reabre).
//
// Roda contra http://localhost:3000 (stack docker local). O PSQL executa no
// container m7arena_local_postgres — via docker CLI (WSL) quando necessário.
const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
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

async function main() {
  console.log(`\n=== SMOKE DRAFT (ban/pick) ===\n`);
  const [p1, p2] = await preparaJogadores("draft", 2);
  console.log("  2 jogadores registrados\n");

  // ── Fase 1: fluxo feliz (1v1) ─────────────────────────────────────────────
  const criar = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: "1v1", entryMp: 0, nome: "Smoke draft", maxJogadores: 2 }) }, p1.cookie);
  check(criar.status === 201, "sala 1v1 criada");
  const salaNum = criar.body.id;

  await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: true }) }, p1.cookie);
  await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: false }) }, p2.cookie);
  check(psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`) === "confirmacao", "sala em confirmacao");

  await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, p1.cookie);
  await api(`/api/matches/${salaNum}/confirm`, { method: "POST", body: "{}" }, p2.cookie);
  await new Promise((r) => setTimeout(r, 300));

  // NOVO: confirmacao → draft (nao vai mais direto para iniciando_partida)
  check(psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`) === "draft", "confirmacao → draft");

  let sala = await detalheSala(salaNum, p1.cookie);
  check(!!sala.draft, "shape da sala traz o draft");
  check(sala.draft.current_phase === "ban" && sala.draft.current_team === "blue" && sala.draft.current_turn === 0, "turno 0 = ban do azul");
  check(!!sala.draft.turn_deadline_at, "prazo do turno no relogio do servidor");
  check(sala.codigo_partida === null, "codigo ainda nao atribuido (so no fim do draft)");

  // Ação do time errado é recusada pelo servidor.
  const errado = await api(`/api/matches/${salaNum}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Aatrox" }) }, p2.cookie);
  check(errado.body?.erro === "fora_do_turno", "ban do time errado recusado", errado.body?.erro);

  // Bans e picks na ordem 1v1: ban blue, ban red, pick blue, pick red.
  const b1 = await api(`/api/matches/${salaNum}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Aatrox" }) }, p1.cookie);
  check(b1.body?.ok === true, "azul baniu Aatrox");

  const repetido = await api(`/api/matches/${salaNum}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Aatrox" }) }, p2.cookie);
  check(repetido.body?.erro === "campeao_indisponivel", "campeao repetido recusado", repetido.body?.erro);

  const b2 = await api(`/api/matches/${salaNum}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Ahri" }) }, p2.cookie);
  check(b2.body?.ok === true, "vermelho baniu Ahri");

  const pickErrado = await api(`/api/matches/${salaNum}/draft/ban`, { method: "POST", body: JSON.stringify({ championId: "Zed" }) }, p1.cookie);
  check(pickErrado.body?.erro === "fase_invalida", "ban na fase de pick recusado", pickErrado.body?.erro);

  const k1 = await api(`/api/matches/${salaNum}/draft/pick`, { method: "POST", body: JSON.stringify({ championId: "Zed" }) }, p1.cookie);
  check(k1.body?.ok === true, "azul pickou Zed");

  const k2 = await api(`/api/matches/${salaNum}/draft/pick`, { method: "POST", body: JSON.stringify({ championId: "Yasuo" }) }, p2.cookie);
  check(k2.body?.ok === true, "vermelho pickou Yasuo");
  await new Promise((r) => setTimeout(r, 300));

  // Fim do draft → iniciando_partida com código atribuído.
  const statusFinal = psql(`SELECT status FROM matches WHERE sala_num=${salaNum}`);
  check(statusFinal === "iniciando_partida", "draft fechado → iniciando_partida", statusFinal);
  check(psql(`SELECT codigo_partida IS NOT NULL AND codigo_partida <> 'SEM-CODIGO-AGUARDE' FROM matches WHERE sala_num=${salaNum}`) === "t", "codigo atribuido no fim do draft");

  sala = await detalheSala(salaNum, p1.cookie);
  check(sala.draft?.status === "finished", "draft marcado como finished");
  check(sala.draft?.blue_picks?.[0] === "Zed" && sala.draft?.red_picks?.[0] === "Yasuo", "picks persistidos no shape");

  // ── Fase 2: timeouts (sala nova) ──────────────────────────────────────────
  const criar2 = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: "1v1", entryMp: 0, nome: "Smoke draft timeout", maxJogadores: 2 }) }, p1.cookie);
  const sala2 = criar2.body.id;
  await api(`/api/matches/${sala2}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: true }) }, p1.cookie);
  await api(`/api/matches/${sala2}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: false }) }, p2.cookie);
  await api(`/api/matches/${sala2}/confirm`, { method: "POST", body: "{}" }, p1.cookie);
  await api(`/api/matches/${sala2}/confirm`, { method: "POST", body: "{}" }, p2.cookie);
  await new Promise((r) => setTimeout(r, 300));
  check(psql(`SELECT status FROM matches WHERE sala_num=${sala2}`) === "draft", "sala 2 em draft");

  // Ban vencido (prazo no passado) → tick aplica ban vazio e avança.
  psql(`UPDATE match_drafts SET turn_deadline_at = now() - interval '40 seconds' WHERE match_id = (SELECT id FROM matches WHERE sala_num=${sala2})`);
  await api(`/api/matches/${sala2}/tick`, { method: "POST", body: "{}" }, p1.cookie);
  await new Promise((r) => setTimeout(r, 200));
  const banVazio = psql(`SELECT blue_bans::text FROM match_drafts WHERE match_id = (SELECT id FROM matches WHERE sala_num=${sala2})`);
  check(banVazio.includes("null"), "ban vencido virou ban vazio", banVazio);
  check(psql(`SELECT current_turn FROM match_drafts WHERE match_id = (SELECT id FROM matches WHERE sala_num=${sala2})`) === "1", "turno avancou para 1");

  // Segundo ban vencido → turno vira pick do azul.
  psql(`UPDATE match_drafts SET turn_deadline_at = now() - interval '40 seconds' WHERE match_id = (SELECT id FROM matches WHERE sala_num=${sala2})`);
  await api(`/api/matches/${sala2}/tick`, { method: "POST", body: "{}" }, p1.cookie);
  await new Promise((r) => setTimeout(r, 200));
  check(psql(`SELECT current_phase FROM match_drafts WHERE match_id = (SELECT id FROM matches WHERE sala_num=${sala2})`) === "pick", "turno 2 = pick do azul");

  // Pick vencido → cancela o draft e a sala reabre (confirmacao/preenchendo).
  psql(`UPDATE match_drafts SET turn_deadline_at = now() - interval '40 seconds' WHERE match_id = (SELECT id FROM matches WHERE sala_num=${sala2})`);
  await api(`/api/matches/${sala2}/tick`, { method: "POST", body: "{}" }, p1.cookie);
  await new Promise((r) => setTimeout(r, 300));
  const statusTimeout = psql(`SELECT status FROM matches WHERE sala_num=${sala2}`);
  check(statusTimeout === "confirmacao" || statusTimeout === "preenchendo", "pick vencido cancelou o draft e reabriu", statusTimeout);
  check(psql(`SELECT count(*) FROM match_drafts WHERE match_id = (SELECT id FROM matches WHERE sala_num=${sala2})`) === "0", "linha do draft removida no cancelamento");

  console.log(`\n=== RESULTADO: ${ok} PASS / ${falhas} FAIL ===\n`);
  process.exit(falhas > 0 ? 1 : 0);
}

main().catch((e) => { console.error("ERRO FATAL:", e?.message || e); process.exit(1); });
