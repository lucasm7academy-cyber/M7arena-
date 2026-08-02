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
    // ── Colunas legadas (ADR-014) — o fork do front consome este shape 1:1.
    //    A normalização para tournament_matches/tournament_teams fica para a
    //    Fase 5; por isso estas colunas espelham o schema `campeonatos` antigo.
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
    timesInscritos: jsonb("times_inscritos").$type<unknown[]>().default([]).notNull(),
    classificacao: jsonb("classificacao").$type<unknown[]>().default([]).notNull(),
    grupos: jsonb("grupos").$type<Record<string, unknown>>().default({}).notNull(),
    cronograma: jsonb("cronograma").$type<unknown[]>().default([]).notNull(),
    timesOrdemSorteio: jsonb("times_ordem_sorteio").$type<unknown[]>().default([]).notNull(),
    gruposSorteados: jsonb("grupos_sorteados").$type<unknown>().default([]).notNull(),
    chavesSorteados: jsonb("chaves_sorteados").$type<unknown>().default([]).notNull(),
    bracketData: jsonb("bracket_data").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("tournaments_slug_idx").on(table.slug),
    index("tournaments_status_idx").on(table.status),
    index("tournaments_game_idx").on(table.gameId),
  ]
);

export const tournamentTeams = pgTable(
  "tournament_teams",
  {
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).default("registered").notNull(), // 'registered' | 'approved' | 'rejected'
    registeredAt: timestamp("registered_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tournamentId, table.teamId] }),
    index("tournament_teams_team_idx").on(table.teamId),
  ]
);

export const tournamentGroups = pgTable("tournament_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(), // e.g. 'Grupo A'
});

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
    status: varchar("status", { length: 50 }).default("pending").notNull(), // 'pending' | 'in_progress' | 'finished'
    bracketSlot: varchar("bracket_slot", { length: 50 }),
    nextMatchId: uuid("next_match_id").references((): any => tournamentMatches.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("tournament_matches_tournament_idx").on(table.tournamentId),
    index("tournament_matches_group_idx").on(table.groupId),
    index("tournament_matches_scheduled_idx").on(table.tournamentId, table.phase, table.scheduledAt),
  ]
);
