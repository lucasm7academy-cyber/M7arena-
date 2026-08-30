import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./identidade.js";
import { games } from "./games.js";
import { teams } from "./teams.js";

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: varchar("game_id", { length: 50 })
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    format: varchar("format", { length: 50 }).notNull(), // 'single_elimination' | 'double_elimination' | 'groups' | 'swiss'
    status: varchar("status", { length: 50 }).default("draft").notNull(), // 'draft' | 'open' | 'in_progress' | 'finished' | 'cancelled'
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    prize: jsonb("prize").$type<Record<string, unknown>>().default({}),
    registrationOpensAt: timestamp("registration_opens_at", { mode: "date" }),
    startsAt: timestamp("starts_at", { mode: "date" }),
    endsAt: timestamp("ends_at", { mode: "date" }),
    // ── Campos legados (ADR-016) — o fork do front consome este shape 1:1.
    //    A normalização completa (ADR-016, antes ADR-014) moveu os 8 blobs JSONB
    //    para tabelas relacionais; estes scalares permanecem em tournaments
    //    porque são campos de exibição sem granularidade de entidade.
    frase: text("frase"),
    logoUrl: text("logo_url"),
    bannerUrl: text("banner_url"),
    orgPhotoUrl: text("org_photo_url"),
    themeColor: varchar("theme_color", { length: 20 }),
    regulamento: text("regulamento"),
    vagas: integer("vagas").default(0).notNull(),
    timesPorGrupo: integer("times_por_grupo"),
    classificadosPorGrupo: integer("classificados_por_grupo"),
    tier: varchar("tier", { length: 50 }),
    data: text("data"), // string de exibição legada ex.: "22/08/2025" — não é timestamp
    premiacao: text("premiacao"),
    taxa: text("taxa"),
    temOutrosPremios: boolean("tem_outros_premios").default(false).notNull(),
    outrosPremios: text("outros_premios"),
    organizacao: varchar("organizacao", { length: 255 }),
    // Ordem do sorteio (legado times_ordem_sorteio): array nativo de tags, não jsonb.
    seedOrder: text("seed_order").array(),
    gruposSorteados: boolean("grupos_sorteados").default(false).notNull(),
    chavesSorteados: boolean("chaves_sorteados").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("tournaments_slug_idx").on(table.slug),
    index("tournaments_status_idx").on(table.status),
    index("tournaments_game_idx").on(table.gameId),
  ]
);

export const tournamentGroups = pgTable("tournament_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(), // e.g. 'Grupo A'
});

export const tournamentTeams = pgTable(
  "tournament_teams",
  {
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    // Legado times_inscritos (ADR-016): 'pending' vira 'registered'.
    status: varchar("status", { length: 50 }).default("registered").notNull(), // 'registered' | 'approved' | 'rejected'
    paid: boolean("paid").default(false).notNull(),
    discord: text("discord"),
    whatsapp: text("whatsapp"),
    groupId: uuid("group_id").references(() => tournamentGroups.id, { onDelete: "set null" }),
    registeredAt: timestamp("registered_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tournamentId, table.teamId] }),
    index("tournament_teams_team_idx").on(table.teamId),
    index("tournament_teams_group_idx").on(table.groupId),
  ]
);

export const tournamentMatches = pgTable(
  "tournament_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    phase: varchar("phase", { length: 50 }).notNull(), // 'group_stage' | 'playoffs' | 'finals'
    round: integer("round").notNull(),
    groupId: uuid("group_id").references(() => tournamentGroups.id, { onDelete: "set null" }),
    teamAId: uuid("team_a_id").references(() => teams.id, { onDelete: "set null" }),
    teamBId: uuid("team_b_id").references(() => teams.id, { onDelete: "set null" }),
    scoreA: integer("score_a").default(0).notNull(),
    scoreB: integer("score_b").default(0).notNull(),
    scheduledAt: timestamp("scheduled_at", { mode: "date" }),
    // ── Colunas de exibição do cronograma legado (ADR-016) ─────────────────
    // O fork renderiza estas strings exatamente como o Supabase as devolvia
    // (data "A COMBINAR", hora "--:--", placar "0 - 0", status "combinando").
    // match_key carrega o id de string do jogo legado (ex. "<camp>-Grupo A-0-1").
    matchKey: text("match_key"),
    phaseLabel: text("phase_label"), // label livre de fase legada: 'Grupo A', 'MATA-MATA (CHAVEAMENTO)', ...
    teamATag: text("team_a_tag"), // snapshot de exibição (o fork resolve por tag)
    teamBTag: text("team_b_tag"),
    displayDate: text("display_date"),
    displayTime: text("display_time"),
    scoreDisplay: text("score_display"), // ex.: '0 - 0'
    proposedBy: text("proposed_by"), // quem propôs o horário (texto livre no fork)
    status: varchar("status", { length: 50 }).default("pending").notNull(), // 'pending' | 'in_progress' | 'finished' | valores legados do cronograma
    bracketSlot: varchar("bracket_slot", { length: 50 }),
    nextMatchId: uuid("next_match_id").references((): any => tournamentMatches.id, { onDelete: "set null" }),
    // ── Verificação de série via código Riot (ADR-047) ──────────────────────
    // A série (MD3/MD5) usa 1 tournament code. O código é gerado ao entrar em
    // 'em_andamento'. `bestOf` = vitórias necessárias para fechar (3=md3, 5=md5).
    // `irregular` = jogou alguém fora do roster (titulares+reservas) — a série
    // conta normal, mas fica sinalizada para o ADM decidir punição depois.
    codigoPartida: text("codigo_partida"),
    bestOf: integer("best_of").default(3).notNull(),
    serieIniciadaAt: timestamp("serie_iniciada_at", { mode: "date" }),
    irregular: boolean("irregular").default(false).notNull(),
    resultadoRiot: jsonb("resultado_riot").$type<Record<string, unknown>>() ,
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("tournament_matches_tournament_idx").on(table.tournamentId),
    index("tournament_matches_group_idx").on(table.groupId),
    index("tournament_matches_scheduled_idx").on(table.tournamentId, table.phase, table.scheduledAt),
    index("tournament_matches_match_key_idx").on(table.matchKey),
  ]
);

/**
 * Chaveamento visual (legado bracket_data, ADR-016). Cada célula da árvore
 * double-elimination vira uma linha: section/round/slot localizam a célula no
 * shape fixo que o fork espera (`upper.r64[0]`, `side.left.qf[1]`, ...).
 * team_a_tag/team_b_tag são snapshot de exibição (o fork guarda tags); os ids
 * são resolvidos quando a tag casa com um time do torneio.
 */
export const bracketMatches = pgTable(
  "bracket_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    section: varchar("section", { length: 30 }).notNull(),
    round: varchar("round", { length: 20 }).notNull(),
    slot: integer("slot").notNull(),
    teamATag: text("team_a_tag"),
    teamBTag: text("team_b_tag"),
    teamAId: uuid("team_a_id").references(() => teams.id, { onDelete: "set null" }),
    teamBId: uuid("team_b_id").references(() => teams.id, { onDelete: "set null" }),
    scoreA: integer("score_a").default(0).notNull(),
    scoreB: integer("score_b").default(0).notNull(),
    winnerSide: varchar("winner_side", { length: 10 }), // 'a' | 'b'
    // ── Verificação de série via código Riot (ADR-047) ──────────────────────
    codigoPartida: text("codigo_partida"),
    bestOf: integer("best_of").default(3).notNull(),
    serieIniciadaAt: timestamp("serie_iniciada_at", { mode: "date" }),
    irregular: boolean("irregular").default(false).notNull(),
    resultadoRiot: jsonb("resultado_riot").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("bracket_matches_cell_idx").on(table.tournamentId, table.section, table.round, table.slot),
    index("bracket_matches_tournament_idx").on(table.tournamentId),
  ]
);

/**
 * Classificação manual (legado classificacao, ADR-016). O fork usa classificação
 * derivada do cronograma na maioria dos casos (regra que agora também roda no
 * servidor) e cai nesta tabela como fallback quando não há jogos finalizados
 * (ex.: mata_mata antes de começar). nome/tag resolvem via join com teams.
 */
export const tournamentStandings = pgTable(
  "tournament_standings",
  {

    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    v: integer("v").default(0).notNull(),
    d: integer("d").default(0).notNull(),
    wo: integer("wo").default(0).notNull(),
    j: integer("j").default(0).notNull(),
    cor: text("cor"),
    logo: text("logo"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tournament_standings_team_idx").on(table.tournamentId, table.teamId),
    index("tournament_standings_rank_idx").on(table.tournamentId, table.rank),
  ]
);

/**
 * Partida individual de uma série de campeonato (ADR-047). Uma série MD3 tem
 * até 3 linhas; MD5 até 5. Guarda o resultado de CADA jogo da Riot (winnerSide
 * 'a'|'b', payload completo) para o histórico exibir stats por partida e para
 * o motor saber quantas vitórias cada time acumulou. `irregular` marca jogo
 * que teve jogador fora do roster.
 */
export const tournamentSeriesGames = pgTable(
  "tournament_series_games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Linha da série (ou bracket). Apenas UM dos dois preenchido conforme o
    // formato do jogo: cronograma/grupos → matchId; mata-mata → bracketMatchId.
    matchId: uuid("match_id").references(() => tournamentMatches.id, { onDelete: "cascade" }),
    bracketMatchId: uuid("bracket_match_id").references(() => bracketMatches.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    gameNumber: integer("game_number").notNull(), // 1..n dentro da série
    winnerSide: varchar("winner_side", { length: 10 }).notNull(), // 'a' | 'b'
    matchIdRiot: text("match_id_riot"),
    killA: integer("kill_a").default(0).notNull(),
    killB: integer("kill_b").default(0).notNull(),
    duracaoS: integer("duracao_s").default(0).notNull(),
    irregular: boolean("irregular").default(false).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(), // stats completos da partida (Riot)
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("tournament_series_games_match_idx").on(table.matchId),
    index("tournament_series_games_bracket_idx").on(table.bracketMatchId),
    index("tournament_series_games_tournament_idx").on(table.tournamentId),
  ]
);
