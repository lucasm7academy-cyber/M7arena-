import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { desc } from "drizzle-orm";
import { users } from "./identidade.js";

/**
 * Ranking geral do treino de mira. A mesa roda no cliente, mas a nota e a
 * posição são do servidor: `grade` é recalculada aqui e o leaderboard é lido
 * desta tabela, não de localStorage. Uma linha por partida enviada; o ranking
 * expõe só o melhor score de cada jogador.
 */
export const aimScores = pgTable(
  "aim_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: varchar("mode", { length: 20 }).notNull(), // 'flick' | 'track' | 'precision'
    score: integer("score").notNull(),
    accuracyPct: integer("accuracy_pct").notNull(), // percentual inteiro 0..100
    apm: integer("apm").notNull(),
    combo: integer("combo").default(0).notNull(),
    grade: varchar("grade", { length: 2 }).notNull(), // 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'
    durationMs: integer("duration_ms").default(60000).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("aim_scores_mode_score_idx").on(table.mode, desc(table.score)),
    index("aim_scores_user_created_idx").on(table.userId, table.createdAt),
  ]
);
