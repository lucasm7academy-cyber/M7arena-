import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./identidade.js";
import { matches } from "./matches.js";

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 10 }).notNull(), // 'mp' | 'mc'
    amount: integer("amount").notNull(), // Com sinal (ex.: +100 ou -50)
    kind: varchar("kind", { length: 50 }).notNull(), // 'match_entry' | 'match_prize' | 'deposit' | 'payout' | 'vip_purchase' | 'referral_bonus' | 'admin_adjustment'
    refType: varchar("ref_type", { length: 50 }), // 'match' | 'payment' | 'user'
    refId: text("ref_id"),
    balanceAfter: integer("balance_after").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("wallet_tx_user_idx").on(table.userId),
    index("wallet_tx_created_at_idx").on(table.createdAt),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gateway: varchar("gateway", { length: 50 }).notNull(), // 'mercadopago' | 'pix'
    gatewayRef: text("gateway_ref").notNull(),
    product: varchar("product", { length: 100 }).notNull(), // e.g. 'mc_pack_1000' | 'vip_monthly'
    amountBrl: numeric("amount_brl", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", { length: 50 }).default("pending").notNull(), // 'pending' | 'approved' | 'rejected' | 'refunded'
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { mode: "date" }),
  },
  (table) => [
    index("payments_user_idx").on(table.userId),
    index("payments_status_idx").on(table.status),
  ]
);

export const platformRevenue = pgTable("platform_revenue", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  mcFee: integer("mc_fee").notNull(),
  // Resto de arredondamento do payout (design v3 §4.1): a soma de prize + loss +
  // taxa + resto fecha exatamente com o pote. Lançamento próprio para auditoria.
  mcFeeRounding: integer("mc_fee_rounding").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const referralEvents = pgTable(
  "referral_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referredId: uuid("referred_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(), // 'signup' | 'first_deposit' | 'match_played'
    value: integer("value").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("referral_referrer_idx").on(table.referrerId),
    index("referral_referred_idx").on(table.referredId),
  ]
);
