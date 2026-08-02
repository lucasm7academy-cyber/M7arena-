import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./identidade.js";
import { games } from "./games.js";

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: varchar("game_id", { length: 50 })
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 100 }).notNull(),
    tag: varchar("tag", { length: 10 }).notNull(),
    logoUrl: text("logo_url"),
    // Identidade visual do time. A UI (hero da TimePage, cards, modais) renderiza
    // essas duas cores em todo lugar — sem elas a ADR-005 quebra. Decisão do
    // usuário em 2026-08-02 durante o swap de times.
    gradientFrom: varchar("gradient_from", { length: 50 }),
    gradientTo: varchar("gradient_to", { length: 50 }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 50 }).default("active").notNull(), // 'active' | 'disbanded' | 'suspended'
    contacts: jsonb("contacts").$type<Record<string, string>>().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("teams_game_idx").on(table.gameId),
    index("teams_owner_idx").on(table.ownerId),
    uniqueIndex("teams_game_tag_idx").on(table.gameId, table.tag),
  ]
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // Nullable para convidados sem conta
    guestHandle: varchar("guest_handle", { length: 100 }),
    // Convidados sem conta (guest_*). O fork do front lê os quatro campos
    // separadamente (TimePage, players.tsx), então o schema novo guarda cada um
    // — não só o riot_id como previa o plano. Decisão do usuário em 2026-08-02.
    guestRiotId: text("guest_riot_id"),
    guestPuuid: text("guest_puuid"),
    guestProfileIconId: integer("guest_profile_icon_id"),
    guestEloCache: text("guest_elo_cache"),
    roleSlot: varchar("role_slot", { length: 50 }).notNull(), // 'top' | 'jungle' | 'mid' | 'adc' | 'support' | 'sub' | 'coach'
    isCaptain: boolean("is_captain").default(false).notNull(),
    status: varchar("status", { length: 50 }).default("accepted").notNull(), // 'pending' | 'accepted' | 'declined'
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("team_members_team_idx").on(table.teamId),
    index("team_members_user_idx").on(table.userId),
  ]
);

export const teamInvites = pgTable(
  "team_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id").references(() => users.id, { onDelete: "cascade" }),
    riotId: text("riot_id"),
    role: varchar("role", { length: 50 }).notNull(),
    message: text("message"),
    type: varchar("type", { length: 20 }).notNull(), // 'invite' | 'request'
    status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending' | 'accepted' | 'declined'
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("team_invites_team_idx").on(table.teamId),
    index("team_invites_from_user_idx").on(table.fromUserId),
    index("team_invites_to_user_idx").on(table.toUserId),
  ]
);

export const teamStats = pgTable(
  "team_stats",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: varchar("season_id", { length: 50 }).notNull().default("s1"),
    pdl: integer("pdl").default(0).notNull(),
    wins: integer("wins").default(0).notNull(),
    losses: integer("losses").default(0).notNull(),
    ranking: integer("ranking"),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.seasonId] }),
    index("team_stats_ranking_idx").on(table.seasonId, table.pdl),
  ]
);
