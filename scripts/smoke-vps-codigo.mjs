// scripts/smoke-vps-codigo.mjs — E2E do sec.codigo-campeonato na VPS. Roda
// DENTRO do container:
//   docker cp scripts/smoke-vps-codigo.mjs m7arena_app:/tmp/smoke-codigo.mjs
//   docker exec -w /app m7arena_app node /tmp/smoke-codigo.mjs
//
// Cobre: codigo_partida redigido para anônimo e para não-participante (detalhe
// + lista), verificar sem sessão = 401 e como estranho = 403. Cria um usuário
// de teste e o remove no final (o banco não fica sujo).
const BASE = process.env.BASE || "http://localhost:3000";
const sufixo = Date.now();

const pg = (await import("pg")).default;
const dbClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
const q1 = async (sql) => (await dbClient.query(sql)).rows[0];

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
const codigosDoPayload = (obj) => [...JSON.stringify(obj).matchAll(/"codigo_partida":"([^"]+)"/g)].map((m) => m[1]);

let usuarioTeste = null;

async function main() {
  console.log(`\n=== SMOKE VPS: CODIGO DA SERIE (sec.codigo-campeonato) ===\n`);
  await dbClient.connect();

  // Uma série viva com código: cronograma ou chave.
  const serie = await q1(
    `SELECT id, tournament_id FROM tournament_matches WHERE codigo_partida IS NOT NULL AND status NOT IN ('finalizada') LIMIT 1`
  );
  const bracket = serie
    ? null
    : await q1(`SELECT id, tournament_id FROM bracket_matches WHERE codigo_partida IS NOT NULL LIMIT 1`);
  const alvo = serie || bracket;

  if (!alvo) {
    console.log("  SKIP: nenhuma série com código ativo no banco agora (rodar de novo durante uma série ao vivo).");
  } else {
    // 1) Anônimo: detalhe e lista não trazem NENHUM código.
    const det = await api(`/api/tournaments/${alvo.tournament_id}`);
    check(det.status === 200, "GET detalhe responde 200");
    const codigosDet = codigosDoPayload(det.body);
    check(codigosDet.length === 0, "anônimo: detalhe sem nenhum codigo_partida", codigosDet.slice(0, 3).join(", "));

    const lista = await api(`/api/tournaments?ids=${alvo.tournament_id}`);
    const codigosLista = codigosDoPayload(lista.body);
    check(codigosLista.length === 0, "anônimo: lista sem nenhum codigo_partida", codigosLista.slice(0, 3).join(", "));

    // 2) Usuário logado NÃO participante: também não vê código.
    const email = `seccod${sufixo}@teste.com`;
    const reg = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: "Smoke@12345", displayName: "Sec Smoke" }),
    });
    check(reg.status === 201, "registro do usuário de teste", String(reg.status));
    const cookie = extraiCookie(reg.setCookie);
    usuarioTeste = reg.body?.user?.id ?? null;

    const detLogado = await api(`/api/tournaments/${alvo.tournament_id}`, {}, cookie);
    const codigosLogado = codigosDoPayload(detLogado.body);
    check(codigosLogado.length === 0, "não-participante logado: detalhe sem código", codigosLogado.slice(0, 3).join(", "));

    // 3) Verificar: sem sessão = 401; estranho = 403.
    const semSessao = await api(`/api/tournaments/${alvo.tournament_id}/jogo/${alvo.id}/verificar`, {
      method: "POST",
      body: "{}",
    });
    check(semSessao.status === 401, "verificar sem sessão → 401", String(semSessao.status));
    const estranho = await api(
      `/api/tournaments/${alvo.tournament_id}/jogo/${alvo.id}/verificar`,
      { method: "POST", body: "{}" },
      cookie
    );
    check(estranho.status === 403, "verificar como estranho → 403", String(estranho.status));

    // 4) Gerar-codigo como estranho → 403 (mesma régua, agora centralizada na lib).
    const gerar = await api(
      `/api/tournaments/${alvo.tournament_id}/jogo/${alvo.id}/gerar-codigo`,
      { method: "POST", body: "{}" },
      cookie
    );
    check(gerar.status === 403, "gerar-codigo como estranho → 403", String(gerar.status));
  }

  if (usuarioTeste) {
    await dbClient.query(`DELETE FROM user_sessions WHERE user_id='${usuarioTeste}'`);
    await dbClient.query(`DELETE FROM user_roles WHERE user_id='${usuarioTeste}'`);
    await dbClient.query(`DELETE FROM game_accounts WHERE user_id='${usuarioTeste}'`);
    await dbClient.query(`DELETE FROM user_wallets WHERE user_id='${usuarioTeste}'`);
    await dbClient.query(`DELETE FROM users WHERE id='${usuarioTeste}'`);
    console.log("  (limpeza: usuário de teste removido)");
  }

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
