import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  boolean,
  text,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identidade.js";

export const pokerRooms = pgTable("poker_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 40 }).notNull(),
  sb: integer("sb").notNull(),
  bb: integer("bb").notNull(),
  buyIn: integer("buy_in").default(0).notNull(),
  seats: integer("seats").notNull(),
  isPrivate: boolean("is_private").default(false).notNull(),
  passwordHash: text("password_hash"),
  status: varchar("status", { length: 20 }).default("open").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  index("poker_rooms_status_created_idx").on(table.status, table.createdAt.desc()),
  check("poker_rooms_seats_check", sql`${table.seats} between 2 and 6`),
]);

/**
 * Sessão de mesa da Sala M7 (poker Texas Hold'em). A mesa roda no cliente; o
 * servidor guarda só o que precisa de autoridade: o buy-in debitado da
 * essência (EA) ao sentar e o caixa devolvido ao encerrar. Uma sessão aberta
 * (`open`) não pode ser fechada duas vezes — o cashout fecha com `closed`.
 */
export const pokerSessions = pgTable(
  "poker_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roomId: varchar("room_id", { length: 40 }).notNull(),
    buyIn: integer("buy_in").notNull(),
    payout: integer("payout").default(0).notNull(),
    status: varchar("status", { length: 20 }).default("open").notNull(), // 'open' | 'closed'
    openedAt: timestamp("opened_at", { mode: "date" }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { mode: "date" }),
  },
  (table) => [index("poker_sessions_user_status_idx").on(table.userId, table.status)]
);
