import { pgTable, uuid, varchar, text, integer, numeric, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./identidade.js";

/**
 * Aposta individual (self-bet) — o jogador aposta em si mesmo sobre a própria
 * próxima partida RANQUEADA (Solo Duo / Flex), contra a plataforma como casa
 * (odds fixas). Diferente das salas apostadas (escrow entre jogadores), aqui
 * cada mercador tem uma odd que a casa paga ao acertar (stake × odd) e retém
 * o stake se errar.
 *
 * Modelo de bilhete: 1 ticket = 1 partida ranqueada futura (Solo=420 / Flex=440).
 * Dentro do ticket, o jogador monta N legs (mercados) independentes, cada um com
 * o seu próprio stake e odd. Cada leg liquida separadamente ao fim da partida.
 */

/** Tipos de fila ranqueada suportados. */
export type BetQueue = "solo" | "flex";

export const betTickets = pgTable(
  "bet_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 'solo' (Ranked Solo/Duo, queue 420) | 'flex' (Ranked Flex, queue 440).
    queue: varchar("queue", { length: 10 }).notNull(),
    // Agendado/pendente de detecção da partida.
    status: varchar("status", { length: 30 }).default("aguardando").notNull(),
    // 'aguardando' | 'em_jogo' (partida detectada no espectador) | 'finalizada'
    // | 'cancelada' (timeout sem partida / desistência) | 'anulada'.
    stakeTotal: integer("stake_total").default(0).notNull(), // soma dos stakes
    resultado: varchar("resultado", { length: 30 }), // 'ganha' | 'perdida' | 'anulada'
    // ── Dados da partida detectada (preenchidos quando entra em jogo) ──
    summonerId: varchar("summoner_id", { length: 100 }), // encryptedSummonerId da Riot
    matchRiotId: varchar("match_riot_id", { length: 100 }), // id da partida (match-v5)
    queueId: integer("queue_id"), // 420 | 440
    gameStartAt: timestamp("game_start_at", { mode: "date" }),
    // ── Tempos ──
    // Deadline para DETECTAR a partida: se passar e não entrou em jogo, cancela
    // e devolve o MC (reserva já feita no escrow). Pós-detecção vira o teto de
    // espera da liquidação (partida fantasma).
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { mode: "date" }),
  },
  (table) => [
    index("bet_tickets_user_idx").on(table.userId, table.createdAt),
    index("bet_tickets_status_idx").on(table.status),
  ]
);

export const betLegs = pgTable(
  "bet_legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => betTickets.id, { onDelete: "cascade" }),
    // Chave canônica do mercado na config (ex.: 'result_vitoria' | 'kills_over_13'
    // | 'first_blood_sim'). A API devolve o rotulo/odd da config sem duplicar.
    marketKey: varchar("market_key", { length: 60 }).notNull(),
    // Snapshot da odd no momento da aposta (a config pode mudar depois sem
    // alterar bilhetes já feitos).
    odd: numeric("odd", { precision: 6, scale: 3 }).notNull(),
    stake: integer("stake").notNull(),
    // Payout esperado se a leg ganhar (stake × odd, arredondado para baixo).
    payout: integer("payout").default(0).notNull(),
    // 'aberta' | 'ganha' | 'perdida' | 'anulada'
    status: varchar("status", { length: 20 }).default("aberta").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("bet_legs_ticket_idx").on(table.ticketId),
  ]
);
