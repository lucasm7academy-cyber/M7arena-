import { pgTable, uuid, text, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./identidade.js";
import { matches } from "./matches.js";

/**
 * Salas apostadas (ADR-019 / design v3 §5): prints de prova e disputas de
 * resultado. As constraints UNIQUE que o Drizzle não expressa nativamente
 * (disputas por jogador) são adicionadas no SQL da migration.
 *
 * Punições (ADR-033): advertências e ban são MANUAIS (admin/proprietário).
 * O sistema automático de strikes (kick de ociosidade / abandono) e a
 * suspensão temporária foram removidos. 3 advertências ativas → ban
 * automático, que só sai com o admin desbanindo.
 */

/** Advertência aplicada por admin/proprietário. 3 ativas → ban automático. */
export const userAdvertencias = pgTable(
  "user_advertencias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Quem aplicou a advertência (admin/proprietário). Auditado.
    criadoPor: uuid("criado_por").references(() => users.id),
    // Partida relacionada (histórico das punições antigas). Advertência manual
    // não precisa de partida — nullable.
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "cascade" }),
    motivo: text("motivo").notNull(), // razão escrita pelo admin (ex.: "Toxicidade no chat")
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    removidoPor: uuid("removido_por").references(() => users.id),
    removidoEm: timestamp("removido_em", { mode: "date" }),
  },
  (table) => [
    index("advertencias_user_recentes_idx").on(table.userId, table.createdAt),
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
