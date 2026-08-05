/**
 * Load de campeonatos (mig.campeonatos) — tabelas relacionais do schema Drizzle.
 * Ordem de FK: tournaments → tournament_groups → tournament_teams →
 * tournament_matches → bracket_matches → tournament_standings.
 *
 * Importado por load.js. As linhas de groups/matches/brackets/standings trazem
 * ids derivados do transform-campeonatos.js (sha256 estável), então re-rodar o
 * load não duplica nada (ON CONFLICT).
 */
export async function loadCampeonatos(pool, readTransformed, supabaseToDbId) {
  const tournaments = readTransformed("tournaments");
  const tournamentGroups = readTransformed("tournament_groups");
  const tournamentTeams = readTransformed("tournament_teams");
  const tournamentMatches = readTransformed("tournament_matches");
  const bracketMatches = readTransformed("bracket_matches");
  const tournamentStandings = readTransformed("tournament_standings");

  const loadedTournamentIds = await loadTournaments(pool, tournaments, supabaseToDbId);
  await loadTournamentGroups(pool, tournamentGroups, loadedTournamentIds);
  await loadTournamentTeams(pool, tournamentTeams, loadedTournamentIds);
  await loadTournamentMatches(pool, tournamentMatches, loadedTournamentIds);
  await loadBracketMatches(pool, bracketMatches, loadedTournamentIds);
  await loadTournamentStandings(pool, tournamentStandings, loadedTournamentIds);
}

async function loadTournaments(pool, tournaments, supabaseToDbId) {
  const loadedIds = new Set();
  let n = 0;
  for (const t of tournaments) {
    const organizerId = supabaseToDbId[t.organizerId];
    if (!organizerId) {
      console.log(`[ETL Load] campeonato "${t.name}" sem organizador no dump, pulando`);
      continue;
    }
    const r = await pool.query(
      `INSERT INTO tournaments
         (id, game_id, slug, name, format, status, organizer_id, prize,
          registration_opens_at, starts_at, ends_at,
          frase, logo_url, banner_url, org_photo_url, theme_color, regulamento,
          vagas, times_por_grupo, classificados_por_grupo, tier, data, premiacao, taxa,
          tem_outros_premios, outros_premios, organizacao,
          seed_order, grupos_sorteados, chaves_sorteados, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
               $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
       ON CONFLICT (id) DO NOTHING`,
      [
        t.id, "lol", t.slug, t.name, t.format, t.status, organizerId, t.prize ?? {},
        t.registrationOpensAt ?? null, t.startsAt ?? null, t.endsAt ?? null,
        t.frase ?? null, t.logoUrl ?? null, t.bannerUrl ?? null, t.orgPhotoUrl ?? null,
        t.themeColor ?? null, t.regulamento ?? null,
        t.vagas ?? 0, t.timesPorGrupo ?? null, t.classificadosPorGrupo ?? null,
        t.tier ?? null, t.data ?? null, t.premiacao ?? null, t.taxa ?? null,
        t.temOutrosPremios ?? false, t.outrosPremios ?? null, t.organizacao ?? null,
        t.seedOrder ?? [], t.gruposSorteados ?? false, t.chavesSorteados ?? false,
        t.createdAt ?? new Date(), t.updatedAt ?? new Date(),
      ]
    );
    // Já existindo no banco, o id ainda conta como presente para as filhas.
    loadedIds.add(t.id);
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] tournaments inseridos: ${n}`);
  return loadedIds;
}

async function loadTournamentGroups(pool, groups, loadedTournamentIds) {
  let n = 0;
  for (const g of groups) {
    if (!loadedTournamentIds.has(g.tournamentId)) continue;
    const r = await pool.query(
      `INSERT INTO tournament_groups (id, tournament_id, name)
       VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
      [g.id, g.tournamentId, g.name]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] tournament_groups inseridos: ${n}`);
}

async function loadTournamentTeams(pool, rows, loadedTournamentIds) {
  let n = 0;
  for (const t of rows) {
    if (!loadedTournamentIds.has(t.tournamentId)) continue;
    const r = await pool.query(
      `INSERT INTO tournament_teams
         (tournament_id, team_id, status, paid, discord, whatsapp, group_id, registered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tournament_id, team_id) DO NOTHING`,
      [t.tournamentId, t.teamId, t.status ?? "registered", t.paid ?? false,
       t.discord ?? null, t.whatsapp ?? null, t.groupId ?? null, t.registeredAt ?? new Date()]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] tournament_teams inseridos: ${n}`);
}

async function loadTournamentMatches(pool, rows, loadedTournamentIds) {
  let n = 0;
  for (const m of rows) {
    if (!loadedTournamentIds.has(m.tournamentId)) continue;
    const r = await pool.query(
      `INSERT INTO tournament_matches
         (id, tournament_id, phase, round, group_id, team_a_id, team_b_id, score_a, score_b,
          scheduled_at, match_key, phase_label, team_a_tag, team_b_tag, display_date,
          display_time, score_display, proposed_by, status, bracket_slot, next_match_id,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       ON CONFLICT (id) DO NOTHING`,
      [
        m.id, m.tournamentId, m.phase ?? "group_stage", m.round ?? 0,
        m.groupId ?? null, m.teamAId ?? null, m.teamBId ?? null,
        m.scoreA ?? 0, m.scoreB ?? 0, m.scheduledAt ?? null,
        m.matchKey ?? null, m.phaseLabel ?? null, m.teamATag ?? null, m.teamBTag ?? null,
        m.displayDate ?? null, m.displayTime ?? null, m.scoreDisplay ?? "0 - 0",
        m.proposedBy ?? "", m.status ?? "combinando", m.bracketSlot ?? null, m.nextMatchId ?? null,
        m.createdAt ?? new Date(), m.updatedAt ?? new Date(),
      ]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] tournament_matches inseridos: ${n}`);
}

async function loadBracketMatches(pool, rows, loadedTournamentIds) {
  let n = 0;
  for (const b of rows) {
    if (!loadedTournamentIds.has(b.tournamentId)) continue;
    const r = await pool.query(
      `INSERT INTO bracket_matches
         (id, tournament_id, section, round, slot, team_a_tag, team_b_tag,
          team_a_id, team_b_id, score_a, score_b, winner_side, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO NOTHING`,
      [b.id, b.tournamentId, b.section, b.round, b.slot,
       b.teamATag ?? null, b.teamBTag ?? null, b.teamAId ?? null, b.teamBId ?? null,
       b.scoreA ?? 0, b.scoreB ?? 0, b.winnerSide ?? null,
       b.createdAt ?? new Date(), b.updatedAt ?? new Date()]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] bracket_matches inseridos: ${n}`);
}

async function loadTournamentStandings(pool, rows, loadedTournamentIds) {
  let n = 0;
  for (const s of rows) {
    if (!loadedTournamentIds.has(s.tournamentId)) continue;
    const r = await pool.query(
      `INSERT INTO tournament_standings
         (id, tournament_id, team_id, rank, v, d, wo, j, cor, logo, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [s.id, s.tournamentId, s.teamId, s.rank ?? 0, s.v ?? 0, s.d ?? 0, s.wo ?? 0,
       s.j ?? 0, s.cor ?? null, s.logo ?? null, s.createdAt ?? new Date()]
    );
    if (r.rowCount > 0) n++;
  }
  console.log(`[ETL Load] tournament_standings inseridos: ${n}`);
}
