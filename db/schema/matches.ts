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
} from "drizzle-orm/pg-core";
import { users } from "./identidade";
import { games } from "./games";

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: varchar("game_id", { length: 50 })
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    mode: varchar("mode", { length: 50 }).notNull(), // '5v5' | '1v1' | 'tournament'
    status: varchar("status", { length: 50 }).default("preenchendo").notNull(),
    // 'preenchendo' | 'confirmacao' | 'iniciando' | 'em_andamento' | 'finalizacao' | 'encerrada' | 'cancelada'
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    roomCode: varchar("room_code", { length: 20 }),
    winnerSide: varchar("winner_side", { length: 10 }), // 'blue' | 'red' | 'draw'
    entryMp: integer("entry_mp").default(0).notNull(),
    stateDeadlineAt: timestamp("state_deadline_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { mode: "date" }),
  },
  (table) => [
    index("matches_status_idx").on(table.status),
    index("matches_game_idx").on(table.gameId),
    index("matches_created_by_idx").on(table.createdBy),
  ]
);

export const matchPlayers = pgTable(
  "match_players",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    side: varchar("side", { length: 10 }).notNull(), // 'blue' | 'red'
    slot: integer("slot").notNull(), // 0..4
    roleSlot: varchar("role_slot", { length: 50 }), // 'top' | 'jungle' | 'mid' | 'adc' | 'support'
    confirmed: boolean("confirmed").default(false).notNull(),
    linked: boolean("linked").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.userId] }),
    index("match_players_user_idx").on(table.userId),
  ]
);

export const matchResults = pgTable("match_results", {
  matchId: uuid("match_id")
    .primaryKey()
    .references(() => matches.id, { onDelete: "cascade" }),
  winnerSide: varchar("winner_side", { length: 10 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(), // Histórico imutável de stats da partida da Riot API
  settledAt: timestamp("settled_at", { mode: "date" }).defaultNow().notNull(),
});

export const matchCodes = pgTable("match_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
