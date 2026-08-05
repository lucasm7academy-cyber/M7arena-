/**
 * Transform: Campeonatos (mig.campeonatos)
 * Explode o JSONB legado de campeonatos nas tabelas relacionais do schema Drizzle
 * (ADR-016), preservando o shape 1:1 que a API reconstrói (tournament-shape.ts):
 *  - times_inscritos       → tournament_teams (paid/discord/whatsapp/status)
 *  - grupos                → tournament_groups + tournament_teams.group_id
 *  - cronograma            → tournament_matches (snapshot de tags + exibição)
 *  - bracket_data          → bracket_matches (células da árvore)
 *  - classificacao         → tournament_standings (fallback manual)
 *  - times_ordem_sorteio   → tournaments.seed_order (text[])
 *  - grupos_sorteados/chaves_sorteados → booleanos
 *
 * IDs de linhas geradas (grupos/jogos/chaves/classificação) são DERIVADOS de
 * (tournament_id + chave legada) via sha256 → uuid estável. Isso torna o load
 * idempotente: re-rodar load.js não duplica nada (ON CONFLICT (id)).
 *
 * Divergências (tag que não casa com times_inscritos, campo sem lar no schema)
 * NÃO são silenciadas: vão para o array `divergencias` e aparecem no relatório.
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dumpDir = path.join(__dirname, "dump");
const outDir = path.join(__dirname, "transformed");

// Tradução legado → novo (mesma da API em api/src/lib/tournament-shape.ts)
const LEGACY_TO_NEW_STATUS = {
  inscricoes_em_breve: "draft",
  inscricoes_abertas: "open",
  em_andamento: "in_progress",
  finalizado: "finished",
  cancelled: "cancelled",
};
const LEGACY_TO_NEW_FORMAT = {
  liga: "groups",
  mata_mata: "single_elimination",
};

/** uuid v4-like estável a partir de uma seed (não usa random). */
function stableUuid(seed) {
  const h = createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function slugify(title) {
  const base = (title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "campeonato";
}

/** "2026-06-15" → ISO; "A COMBINAR"/inválido → null. */
function toDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "2 - 0" → [2, 0]. */
function parsePlacar(placar) {
  const parts = String(placar || "0 - 0").split(" - ");
  return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0];
}

export function transformCampeonatos() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const campsPath = path.join(dumpDir, "campeonatos.json");
  const camps = fs.existsSync(campsPath)
    ? JSON.parse(fs.readFileSync(campsPath, "utf8"))
    : [];

  const tournaments = [];
  const tournamentGroups = [];
  const tournamentTeams = [];
  const tournamentMatches = [];
  const bracketMatches = [];
  const tournamentStandings = [];

  const report = {
    tournament_teams: 0,
    tournament_groups: 0,
    tournament_matches: 0,
    bracket_matches: 0,
    tournament_standings: 0,
  };
  const divergencias = [];

  for (const c of camps) {
    const tournamentId = c.id;
    const createdAt = toDateOrNull(c.created_at) || new Date().toISOString();
    const updatedAt = toDateOrNull(c.updated_at) || createdAt;

    const tagToTeamId = Object.fromEntries(
      (c.times_inscritos || []).map((ti) => [ti.tag, ti.id])
    );

    tournaments.push({
      id: tournamentId,
      gameId: "lol",
      slug: slugify(c.titulo),
      name: c.titulo,
      format: LEGACY_TO_NEW_FORMAT[c.formato] || "single_elimination",
      status: LEGACY_TO_NEW_STATUS[c.status] || "draft",
      organizerId: c.criado_por,
      // premiacao/taxa são texto de exibição (o fork renderiza essas strings);
      // o prize estruturado não tem origem no dump — fica {}.
      prize: {},
      registrationOpensAt: toDateOrNull(c.inscricoes_abertas_em),
      startsAt: toDateOrNull(c.inicio_em),
      endsAt: toDateOrNull(c.fim_em),
      frase: c.frase ?? null,
      logoUrl: c.logo_url ?? null,
      bannerUrl: c.banner_url ?? null,
      orgPhotoUrl: c.org_photo_url ?? null,
      themeColor: c.theme_color ?? null,
      regulamento: c.regulamento ?? null,
      vagas: c.vagas ?? 0,
      timesPorGrupo: c.times_por_grupo ?? null,
      classificadosPorGrupo: c.classificados_por_grupo ?? null,
      tier: c.tier ?? null,
      data: c.data ?? null,
      premiacao: c.premiacao ?? null,
      taxa: c.taxa ?? null,
      temOutrosPremios: !!c.tem_outros_premios,
      outrosPremios: c.outros_premios ?? null,
      organizacao: c.organizacao ?? null,
      seedOrder: c.times_ordem_sorteio || [],
      gruposSorteados: !!c.grupos_sorteados,
      chavesSorteados: !!c.chaves_sorteados,
      createdAt,
      updatedAt,
    });

    // ── tournament_teams (times_inscritos) ────────────────────────────────
    for (const ti of c.times_inscritos || []) {
      tournamentTeams.push({
        tournamentId,
        teamId: ti.id,
        status:
          ti.status === "approved" ? "approved"
          : ti.status === "rejected" ? "rejected"
          : "registered",
        paid: !!ti.paid,
        discord: ti.discord ?? null,
        whatsapp: ti.whatsapp ?? null,
        groupId: null,
        registeredAt: createdAt,
      });
      report.tournament_teams++;
    }

    // ── tournament_groups (grupos) + group_id nas inscrições ──────────────
    const gruposObj =
      c.grupos && typeof c.grupos === "object" && !Array.isArray(c.grupos)
        ? c.grupos
        : {};
    const groupIdByName = {};
    for (const [name, teamList] of Object.entries(gruposObj)) {
      const groupId = stableUuid(`${tournamentId}:grupo:${name}`);
      groupIdByName[name] = groupId;
      tournamentGroups.push({ id: groupId, tournamentId, name });
      report.tournament_groups++;
      if (!Array.isArray(teamList)) continue;
      for (const gTeam of teamList) {
        const teamId = gTeam.id || tagToTeamId[gTeam.tag];
        if (!teamId) {
          divergencias.push(`[${c.titulo}] grupo "${name}": time sem id/tag: ${JSON.stringify(gTeam)}`);
          continue;
        }
        const row = tournamentTeams.find((r) => r.teamId === teamId);
        if (row) row.groupId = groupId;
      }
    }

    // ── tournament_matches (cronograma) ───────────────────────────────────
    for (const j of c.cronograma || []) {
      const key = j.id || "";
      const [scoreA, scoreB] = parsePlacar(j.placar);
      if (j.timeA && !tagToTeamId[j.timeA]) divergencias.push(`[${c.titulo}] cronograma ${key}: tag timeA "${j.timeA}" sem time inscrito`);
      if (j.timeB && !tagToTeamId[j.timeB]) divergencias.push(`[${c.titulo}] cronograma ${key}: tag timeB "${j.timeB}" sem time inscrito`);
      tournamentMatches.push({
        id: stableUuid(`${tournamentId}:match:${key}`),
        tournamentId,
        phase: "group_stage",
        round: 0,
        groupId: null,
        teamAId: tagToTeamId[j.timeA] ?? null,
        teamBId: tagToTeamId[j.timeB] ?? null,
        scoreA,
        scoreB,
        scheduledAt: toDateOrNull(j.data),
        matchKey: j.id ?? null,
        phaseLabel: j.fase ?? null,
        teamATag: j.timeA ?? null,
        teamBTag: j.timeB ?? null,
        displayDate: j.data ?? null,
        displayTime: j.hora ?? null,
        scoreDisplay: j.placar ?? "0 - 0",
        proposedBy: j.proposedBy ?? "",
        status: j.status ?? "combinando",
        bracketSlot: null,
        nextMatchId: null,
        createdAt,
        updatedAt,
      });
      report.tournament_matches++;
    }

    // ── bracket_matches (bracket_data) ────────────────────────────────────
    const b = c.bracket_data;
    if (b && typeof b === "object") {
      const pushCell = (section, round, slot, cell) => {
        if (!cell || typeof cell !== "object") return;
        const t1 = cell.t1 ?? "";
        const t2 = cell.t2 ?? "";
        if (!t1 && !t2) return;
        if (t1 && !tagToTeamId[t1]) divergencias.push(`[${c.titulo}] bracket ${section}.${round}[${slot}]: tag "${t1}" sem time inscrito`);
        if (t2 && !tagToTeamId[t2]) divergencias.push(`[${c.titulo}] bracket ${section}.${round}[${slot}]: tag "${t2}" sem time inscrito`);
        bracketMatches.push({
          id: stableUuid(`${tournamentId}:bracket:${section}:${round}:${slot}`),
          tournamentId,
          section,
          round,
          slot,
          teamATag: t1 || null,
          teamBTag: t2 || null,
          teamAId: tagToTeamId[t1] ?? null,
          teamBId: tagToTeamId[t2] ?? null,
          scoreA: cell.s1 || 0,
          scoreB: cell.s2 || 0,
          winnerSide: cell.winner ?? null,
          createdAt,
          updatedAt,
        });
        report.bracket_matches++;
      };

      // upper/lower: { r64: [...], qf: [...], final: [...] } — round = chave
      for (const section of ["upper", "lower"]) {
        const tree = b[section];
        if (!tree || typeof tree !== "object") continue;
        for (const [round, arr] of Object.entries(tree)) {
          if (Array.isArray(arr)) arr.forEach((cell, slot) => pushCell(section, round, slot, cell));
        }
      }

      // side: left/right/grandFinal. O round carrega o lado ('left_qf',
      // 'right_qf') porque o unique index (tournament_id, section, round, slot)
      // colide entre left e right no encoding do storeBracket ('side','qf',slot).
      // TODO(migracao): alinhar com a API quando o shape.campeonatos for tocado.
      if (b.side && typeof b.side === "object") {
        for (const side of ["left", "right"]) {
          const tree = b.side[side];
          if (!tree || typeof tree !== "object") continue;
          for (const [round, arr] of Object.entries(tree)) {
            if (Array.isArray(arr)) arr.forEach((cell, slot) => pushCell("side", `${side}_${round}`, slot, cell));
          }
        }
        if (b.side.grandFinal && typeof b.side.grandFinal === "object") {
          pushCell("side", "grand_final", 0, b.side.grandFinal);
        }
      }
      if (b.preFinal && typeof b.preFinal === "object") pushCell("preFinal", "final", 0, b.preFinal);
      if (b.grandFinal && typeof b.grandFinal === "object") pushCell("grandFinal", "final", 0, b.grandFinal);
    }

    // ── tournament_standings (classificacao) ──────────────────────────────
    for (const s of c.classificacao || []) {
      const teamId = tagToTeamId[s.tag] || s.id || null;
      if (!teamId) {
        divergencias.push(`[${c.titulo}] classificacao rank ${s.rank}: time sem tag resolvível: ${JSON.stringify(s)}`);
        continue;
      }
      tournamentStandings.push({
        id: stableUuid(`${tournamentId}:stand:${teamId}`),
        tournamentId,
        teamId,
        rank: s.rank ?? 0,
        v: s.v ?? 0,
        d: s.d ?? 0,
        wo: s.wo ?? 0,
        j: s.j ?? 0,
        cor: s.cor ?? null,
        logo: s.logo ?? null,
        createdAt,
      });
      report.tournament_standings++;
    }
  }

  // ── Saída ────────────────────────────────────────────────────────────────
  const write = (name, rows) => fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(rows, null, 2));
  write("tournaments", tournaments);
  write("tournament_groups", tournamentGroups);
  write("tournament_teams", tournamentTeams);
  write("tournament_matches", tournamentMatches);
  write("bracket_matches", bracketMatches);
  write("tournament_standings", tournamentStandings);

  console.log(`[ETL Transform] ${tournaments.length} campeonatos transformados`);
  console.log(`[ETL Transform] tournament_teams: ${report.tournament_teams} | tournament_groups: ${report.tournament_groups}`);
  console.log(`[ETL Transform] tournament_matches: ${report.tournament_matches} | bracket_matches: ${report.bracket_matches} | tournament_standings: ${report.tournament_standings}`);
  if (divergencias.length) {
    console.log(`[ETL Transform] DIVERGÊNCIAS (${divergencias.length}):`);
    divergencias.forEach((d) => console.log(`  - ${d}`));
  } else {
    console.log("[ETL Transform] Sem divergências");
  }

  return { tournaments, tournamentGroups, tournamentTeams, tournamentMatches, bracketMatches, tournamentStandings, divergencias };
}

transformCampeonatos();
