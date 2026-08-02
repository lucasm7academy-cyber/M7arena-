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
import { users } from "./identidade";
import { games } from "./games";

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
