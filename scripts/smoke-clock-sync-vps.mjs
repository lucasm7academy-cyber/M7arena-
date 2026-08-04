// scripts/smoke-clock-sync-vps.mjs — REGRA DE TIMER COM RELÓGIOS DIFERENTES
//
// Valida o cenário real do bug B com dados da VPS: cria uma sala 1v1, dois
// jogadores entram (a sala vai para confirmacao), captura o deadline REAL
// (confirmacao_expires_at) e o relógio REAL (server_time) do servidor. Depois
// simula N clientes — cada um com um relógio local diferente (skew de -5min
// até +8min, cobrindo fuso/relógio dessincronizado) — e verifica que TODOS
// derivam o MESMO tempo restante usando o código REAL de clockSync.ts.
//
// Rodar na pasta api/ (tem o tsx): npx tsx ../scripts/smoke-clock-sync-vps.mjs

const BASE = "https://dev.m7arena.pro";
const sufixo = Date.now();

const clock = await import("../web/src/lib/clockSync.js");
const { registrarServerTime, agoraServidor, _resetOffset } = clock;

async function api(path, opts = {}, token) {
  const headers = { ...(opts.body ? { "Content-Type": "application/json" } : {}) };
  if (token) headers["Cookie"] = token;
  const r = await fetch(BASE + path, { ...opts, headers });
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("json") ? await r.json() : await r.text();
  return { status: r.status, body, setCookie: r.headers.get("set-cookie") || "" };
}
const extraiCookie = (sc) => (sc.match(/m7_session=[^;]+/) || [])[0] || "";

async function registrar(email) {
  const r = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password: "Smoke@12345", displayName: "Clock " + email.split("@")[0] }) });
  if (r.status !== 201) throw new Error(`register ${email} falhou: ${r.status}`);
  return { id: r.body.user.id, cookie: extraiCookie(r.setCookie) };
}

let ok = 0, falhas = 0;
const check = (c, l, e = "") => { if (c) { ok++; console.log(`  ok ${l}${e ? ` - ${e}` : ""}`); } else { falhas++; console.log(`  X ${l}${e ? ` - ${e}` : ""}`); } };

// Instala um Date.now simulado POR CLIENTE (não afeta o servidor).
function clienteComSkew(skewMs, relogioRealBase) {
  const orig = Date.now;
  return {
    skewMs,
    // Este cliente "vê" o mundo com o relógio dele deslocado.
    agoraLocal: () => relogioRealBase + skewMs + (Date.now() - relogioRealBase),
    // Reaplica o Date.now deslocado para o clockSync deste cliente.
    usar: () => { Date.now = () => relogioRealBase + skewMs + (orig() - relogioRealBase); },
    restaurar: () => { Date.now = orig; },
  };
}

async function main() {
  console.log(`\n=== REGRA DE TIMER: RELÓGIOS DIFERENTES (VPS real) ===\n`);

  // 1. Cria sala 1v1 e dois jogadores (a sala vai para confirmacao).
  const p1 = await registrar(`rel1_${sufixo}@teste.com`);
  const p2 = await registrar(`rel2_${sufixo}@teste.com`);
  console.log("  2 jogadores registrados");

  const criar = await api("/api/matches", { method: "POST", body: JSON.stringify({ mode: "1v1", entryMp: 0, nome: "Clock sync vps", maxJogadores: 2 }) }, p1.cookie);
  check(criar.status === 201, "sala 1v1 criada");
  const salaNum = criar.body.id;

  await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: true }) }, p1.cookie);
  await api(`/api/matches/${salaNum}/join`, { method: "POST", body: JSON.stringify({ roleSlot: "MID", is_time_a: false }) }, p2.cookie);

  const det = await api(`/api/matches/${salaNum}`, {}, p1.cookie);
  check(det.body?.estado === "confirmacao", "sala em confirmacao", det.body?.estado);

  const serverTime = det.body.server_time;                 // relógio do servidor (ms)
  const deadline = new Date(det.body.confirmacao_expires_at).getTime(); // prazo absoluto
  const tempoRealServidor = Math.round((deadline - serverTime) / 1000);
  check(tempoRealServidor === 60, `deadline real = ${tempoRealServidor}s a partir do server_time`);

  // 2. Simula N clientes com relógios DIFERENTES (cobrindo fusos e NTP ruim).
  const relogios = [
    { nome: "A (mesmo wifi)", skew: 0 },
    { nome: "B (relogio +5min)", skew: 300_000 },
    { nome: "C (relogio -3min)", skew: -180_000 },
    { nome: "D (relogio +8min)", skew: 480_000 },
    { nome: "E (relogio -8min)", skew: -480_000 },
    { nome: "F (relogio +30s)", skew: 30_000 },
    { nome: "G (relogio -25s)", skew: -25_000 },
  ];

  // Usa o relógio REAL da máquina como base (o servidor está a alguns ms).
  const baseLocal = Date.now();

  console.log("\n  SEM correção, cada cliente vê o tempo restante do relógio dele:\n");
  const semCorrecao = [];
  for (const r of relogios) {
    const restante = Math.max(0, Math.round((deadline - (baseLocal + r.skew)) / 1000));
    semCorrecao.push(restante);
    console.log(`    ${r.nome.padEnd(18)} -> ${restante}s`);
  }
  check(new Set(semCorrecao).size > 1, "sem correção os clientes DIVERGEM (é o bug B)");

  // 3. COM a correção: cada cliente registra o server_time e usa agoraServidor().
  console.log("\n  COM correção (clockSync), todos derivam o mesmo tempo:\n");
  const comCorrecao = [];
  const origDateNow = Date.now;
  for (const r of relogios) {
    // Simula o relógio deste cliente: o Date.now dele está deslocado.
    const skew = r.skew;
    Date.now = () => baseLocal + skew;
    _resetOffset();
    registrarServerTime(serverTime); // recebe o server_time real da resposta
    const restante = Math.max(0, Math.round((deadline - agoraServidor()) / 1000));
    comCorrecao.push(restante);
    console.log(`    ${r.nome.padEnd(18)} -> ${restante}s`);
  }
  Date.now = origDateNow;

  check(new Set(comCorrecao).size === 1, `todos os clientes veem o MESMO tempo restante (${comCorrecao[0]}s)`);
  check(comCorrecao[0] <= 60 && comCorrecao[0] >= 50, `tempo coerente com o prazo do servidor (${comCorrecao[0]}s de 60s)`);

  console.log(`\n=== RESULTADO: ${ok} ok, ${falhas} falhas ===\n`);
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
