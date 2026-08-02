import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./identidade.js";

export const games = pgTable("games", {
  id: varchar("id", { length: 50 }).primaryKey(), // slug: 'lol'
  name: varchar("name", { length: 100 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const gameAccounts = pgTable(
  "game_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: varchar("game_id", { length: 50 })
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    externalId: text("external_id").notNull(), // puuid para LoL
    handle: varchar("handle", { length: 100 }).notNull(), // Riot ID (GameName#TagLine)
    verified: boolean("verified").default(false).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}), // elo_cache, champions_cache
    syncedAt: timestamp("synced_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_game_idx").on(table.userId, table.gameId),
    uniqueIndex("game_external_id_idx").on(table.gameId, table.externalId),
  ]
);
