import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  passwordHash: text("password_hash"),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  socials: jsonb("socials").$type<Record<string, string>>().default({}),
  // Rotas preferidas do jogador (TOP/JUNGLE/MID/ADC/SUPPORT), vindas de
  // profiles.lane_primaria e lane_secundaria do schema antigo. A UI mostra as
  // duas no card do jogador, e o schema novo tinha esquecido delas (BLK-002).
  // Ficam em users, e não em game_accounts, porque é preferência do usuário —
  // ele escolhe a rota mesmo sem ter conta da Riot vinculada.
  lanePrimary: varchar("lane_primary", { length: 20 }),
  laneSecondary: varchar("lane_secondary", { length: 20 }),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  isVip: boolean("is_vip").default(false).notNull(),
  vipExpiresAt: timestamp("vip_expires_at", { mode: "date" }),
  referredBy: uuid("referred_by").references((): any => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
});

export const userIdentities = pgTable(
  "user_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // 'google' | 'discord' | 'credentials'
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("provider_account_idx").on(table.provider, table.providerAccountId),
  ]
);

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull(), // 'admin' | 'organizer' | 'streamer' | 'caster' | 'user'
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
  ]
);

export const userWallets = pgTable("user_wallets", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  mp: integer("mp").default(0).notNull(),
  mc: integer("mc").default(0).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const userPayoutInfo = pgTable("user_payout_info", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  pixType: varchar("pix_type", { length: 50 }).notNull(), // 'cpf' | 'email' | 'phone' | 'random'
  pixKey: text("pix_key").notNull(),
  pixName: text("pix_name").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
