import { pgTable, uuid, text, varchar, timestamp, index, integer } from "drizzle-orm/pg-core";
import { users } from "./identidade.js";
import { matches } from "./matches.js";

/**
 * Salas apostadas (ADR-019 / design v3 §5): strikes anti no-show, prints de
 * prova e disputas de resultado. As constraints UNIQUE que o Drizzle não
 * expressa nativamente (disputas por jogador) são adicionadas no SQL da
 * migration.
 */

/** Punição por kick de ociosidade ou abandono de partida iniciada. */
export const userStrikes = pgTable(
  "user_strikes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    motivo: varchar("motivo", { length: 50 }).notNull(), // 'kick_ociosidade' | 'abandono'
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    removidoPor: uuid("removido_por").references(() => users.id),
    removidoEm: timestamp("removido_em", { mode: "date" }),
  },
  (table) => [
    index("strikes_user_recentes_idx").on(table.userId, table.createdAt),
  ]
);

/** Print de prova do resultado enviado por um jogador confirmado. */
export const matchPrints = pgTable(
  "match_prints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("prints_match_idx").on(table.matchId),
  ]
);

/** Contestação de resultado (design v3 §6.1). UNIQUE (match_id, user_id) na migration. */
export const matchDisputas = pgTable(
  "match_disputas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    motivo: text("motivo").notNull(),
    status: varchar("status", { length: 20 }).default("aberta").notNull(), // 'aberta' | 'resolvida'
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("disputas_match_idx").on(table.matchId),
  ]
);
