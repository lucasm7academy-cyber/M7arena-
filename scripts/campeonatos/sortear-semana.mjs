/**
 * sortear-semana.mjs — sorteio semanal das copas em fase de grupos (ADR-068).
 *
 * Convenção: cada time enfrenta 2 adversários INÉDITOS por semana (8 jogos por
 * copa com 8 times). Os jogos entram como pendentes de fase de grupos
 * (status 'combinando', 'A COMBINAR' / '--:--') e aparecem em "Meus Jogos
 * Pendentes" para os capitães agendarem.
 *
 * Roda DENTRO do container da API (tem DATABASE_URL e o módulo pg):
 *   docker cp scripts/campeonatos/sortear-semana.mjs m7arena_app:/app/sortear-semana.mjs
 *   docker exec -w /app m7arena_app node sortear-semana.mjs --dry-run
 *   docker exec -w /app m7arena_app node sortear-semana.mjs
 *   docker exec -w /app m7arena_app node sortear-semana.mjs kraken
 *   docker exec -w /app m7arena_app node sortear-semana.mjs tesouro --dry-run
 *
 * "Já sorteado" = qualquer jogo existente do torneio (pendente, agendado ou
 * finalizado) — um confronto pendente da semana anterior não pode repetir.
 */
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filtro = (args.find((a) => !a.startsWith("--")) || "").toLowerCase() || null;
const RODADAS = 2; // adversários inéditos por time no mesmo sorteio

const pg = (await import("pg")).default;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const pairKey = (a, b) => [a, b].sort().join("|");

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Emparelhamento perfeito aleatório (backtracking sobre arestas embaralhadas). */
function emparelhamentoPerfeito(vertices, arestas) {
  const ordem = shuffle(arestas);
  const usados = new Set();
  const escolhidos = [];
  const precisa = vertices.length / 2;

  function backtrack(i) {
    if (escolhidos.length === precisa) return true;
    if (i >= ordem.length) return false;
    const [a, b] = ordem[i];
    if (!usados.has(a) && !usados.has(b)) {
      usados.add(a);
      usados.add(b);
      escolhidos.push([a, b]);
      if (backtrack(i + 1)) return true;
      escolhidos.pop();
      usados.delete(a);
      usados.delete(b);
    }
    return backtrack(i + 1);
  }

  return backtrack(0) ? escolhidos : null;
}

/** Reserva: emparelhamento maximal guloso (avisa quando não cobre todos). */
function emparelhamentoGuloso(arestas) {
  const usados = new Set();
  const escolhidos = [];
  for (const [a, b] of shuffle(arestas)) {
    if (usados.has(a) || usados.has(b)) continue;
    usados.add(a);
    usados.add(b);
    escolhidos.push([a, b]);
  }
  return escolhidos;
}

async function sortearCopa(t) {
  const times = (
    await db.query(
      `SELECT tm.id, tm.tag FROM tournament_teams tt
       JOIN teams tm ON tm.id = tt.team_id
       WHERE tt.tournament_id = $1 AND tt.status = 'approved'
       ORDER BY tm.tag`,
      [t.id],
    )
  ).rows;

  if (times.length < 4 || times.length % 2 !== 0) {
    throw new Error(`${t.name}: ${times.length} times aprovados — não dá para emparelhar`);
  }

  const idPorTag = new Map(times.map((x) => [x.tag, x.id]));
  const jogos = (
    await db.query(
      `SELECT team_a_tag a, team_b_tag b FROM tournament_matches
       WHERE tournament_id = $1 AND team_a_tag IS NOT NULL AND team_b_tag IS NOT NULL`,
      [t.id],
    )
  ).rows;
  const jaSorteados = new Set(jogos.map((j) => pairKey(j.a, j.b)));

  const restantes = [];
  for (let i = 0; i < times.length; i++) {
    for (let j = i + 1; j < times.length; j++) {
      if (!jaSorteados.has(pairKey(times[i].tag, times[j].tag))) {
        restantes.push([times[i].tag, times[j].tag]);
      }
    }
  }

  console.log(`\n=== ${t.name} ===`);
  if (!restantes.length) {
    console.log("  todos os pares já foram sorteados — nada a fazer.");
    return;
  }

  const novos = [];
  let sobra = restantes;
  for (let r = 0; r < RODADAS; r++) {
    if (sobra.length < times.length / 2) break; // não há arestas nem para uma rodada completa
    let escolhido = null;
    for (let tent = 0; tent < 300 && !escolhido; tent++) {
      escolhido = emparelhamentoPerfeito(times, sobra);
    }
    if (!escolhido) {
      escolhido = emparelhamentoGuloso(sobra);
      if (escolhido.length * 2 < times.length) {
        console.log("  aviso: sem emparelhamento perfeito — sorteio parcial (nem todos jogam nesta rodada)");
      }
    }
    if (!escolhido.length) break;
    const usadosNaRodada = new Set(escolhido.map(([a, b]) => pairKey(a, b)));
    sobra = sobra.filter(([a, b]) => !usadosNaRodada.has(pairKey(a, b)));
    novos.push(...escolhido);
    if (escolhido.length * 2 < times.length) break; // rodada parcial: não tenta a próxima
  }

  const sorteados = novos.map(([a, b]) => (Math.random() < 0.5 ? [a, b] : [b, a]));

  console.log(`  sorteio desta semana (${sorteados.length} jogos):`);
  for (const [a, b] of sorteados) console.log(`    ${a} x ${b}`);
  const grau = {};
  for (const [a, b] of sorteados) {
    grau[a] = (grau[a] || 0) + 1;
    grau[b] = (grau[b] || 0) + 1;
  }
  console.log(`  jogos por time: ${Object.entries(grau).map(([x, g]) => `${x}=${g}`).join(" ")}`);
  if (sobra.length) {
    console.log(`  ficam para a próxima semana (${sobra.length}): ${sobra.map(([a, b]) => `${a}x${b}`).join(", ")}`);
  }

  if (dryRun) {
    console.log("  (dry-run — nada foi gravado)");
    return;
  }

  const ts = Date.now();
  const rows = sorteados.map(([a, b], i) => ({ a, b, key: `manual-${ts}-${i + 1}` }));

  await db.query("BEGIN");
  try {
    for (const r of rows) {
      await db.query(
        `INSERT INTO tournament_matches
           (tournament_id, phase, round, team_a_id, team_b_id, team_a_tag, team_b_tag,
            match_key, phase_label, display_date, display_time, score_display,
            score_a, score_b, proposed_by, status, best_of)
         VALUES ($1, 'group_stage', 0, $2, $3, $4, $5, $6, 'Fase de Grupos', 'A COMBINAR', '--:--',
                 '0 - 0', 0, 0, '', 'combinando', 3)`,
        [t.id, idPorTag.get(r.a), idPorTag.get(r.b), r.a, r.b, r.key],
      );
    }

    const inseridos = (
      await db.query(
        `SELECT count(*)::int c FROM tournament_matches WHERE tournament_id = $1 AND match_key = ANY($2)`,
        [t.id, rows.map((r) => r.key)],
      )
    ).rows[0].c;
    if (inseridos !== rows.length) throw new Error(`inseridos ${inseridos} de ${rows.length}`);

    const duplicados = (
      await db.query(
        `SELECT count(*)::int c FROM (
           SELECT LEAST(team_a_tag, team_b_tag) a, GREATEST(team_a_tag, team_b_tag) b
           FROM tournament_matches
           WHERE tournament_id = $1 AND team_a_tag IS NOT NULL AND team_b_tag IS NOT NULL
           GROUP BY 1, 2 HAVING count(*) > 1
         ) d`,
        [t.id],
      )
    ).rows[0].c;
    if (duplicados !== 0) throw new Error(`${duplicados} pares repetidos`);

    await db.query("COMMIT");
    console.log(`  gravados ${rows.length} jogos (transação validada: 0 pares repetidos).`);
  } catch (err) {
    await db.query("ROLLBACK");
    throw new Error(`${t.name}: rollback — ${err.message}`);
  }
}

const torneios = (
  await db.query(
    `SELECT id, name, slug FROM tournaments
     WHERE format = 'groups' AND status = 'in_progress'
     ORDER BY name`,
  )
).rows;

const alvo = torneios.filter(
  (t) => !filtro || t.name.toLowerCase().includes(filtro) || t.slug.toLowerCase().includes(filtro),
);

if (!alvo.length) {
  console.error(
    `Nenhum campeonato em andamento encontrado${filtro ? ` para "${filtro}"` : ""}. ` +
      `Disponíveis: ${torneios.map((t) => t.name).join(" | ") || "nenhum"}`,
  );
  await db.end();
  process.exit(1);
}

for (const t of alvo) {
  await sortearCopa(t);
}

await db.end();
