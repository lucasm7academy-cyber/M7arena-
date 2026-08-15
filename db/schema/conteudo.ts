import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  integer,
  primaryKey,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { users } from "./identidade.js";

export const news = pgTable(
  "news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    summary: text("summary"),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    published: boolean("published").default(false).notNull(),
    publishedAt: timestamp("published_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    // Campos legados da tabela `noticias` do Supabase (ADR-005 — o fork consome
    // snake_case: categoria/destaque/link_url/link_texto/autor). Sem eles a tela
    // de Admin perde o badge de categoria e o Destaque no Lobby.
    categoria: varchar("categoria", { length: 50 }).default("Torneios").notNull(),
    destaque: boolean("destaque").default(false).notNull(),
    linkUrl: text("link_url"),
    linkText: text("link_texto"),
    autor: varchar("autor", { length: 120 }),
  },
  (table) => [
    index("news_slug_idx").on(table.slug),
    index("news_published_idx").on(table.published),
  ]
);

export const highlights = pgTable(
  "highlights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    videoUrl: text("video_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    // Campos legados da tabela `highlights` do Supabase: `ordem` controla a
    // ordem de exibição no Lobby/Streamers e `categoria` alimenta o badge.
    ordem: integer("ordem").default(0).notNull(),
    categoria: varchar("categoria", { length: 50 }).default("highlight").notNull(),
  },
  (table) => [
    index("highlights_active_idx").on(table.active),
  ]
);

// Stats de jogador por modo de partida — espelha a tabela `player_stats` do
// Supabase (swap app.swap.conteudo). `victories` corrige o typo `vitories`
// legado; o adaptador do SDK mapeia. PK (user_id, modo) como no schema antigo.
export const playerStats = pgTable(
  "player_stats",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modo: varchar("modo", { length: 20 }).notNull(),
    victories: integer("victories").default(0).notNull(),
    defeats: integer("defeats").default(0).notNull(),
    totalGames: integer("total_games").default(0).notNull(),
    winrate: doublePrecision("winrate").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.modo] }),
    index("player_stats_user_idx").on(table.userId),
  ]
);

export const broadcasts = pgTable(
  "broadcasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamerId: uuid("streamer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelName: varchar("channel_name", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }),
    gameName: varchar("game_name", { length: 100 }),
    isLive: boolean("is_live").default(false).notNull(),
    viewerCount: integer("viewer_count").default(0).notNull(),
    thumbnailUrl: text("thumbnail_url"),
    syncedAt: timestamp("synced_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("broadcasts_is_live_idx").on(table.isLive),
  ]
);

// Transmissões de streamer — espelha a tabela `transmissoes` do Supabase (swap
// app.swap.conteudo). O streamer abre a live pelo painel em /streamers e ela
// aparece na vitrine pública enquanto `ativo` e não expirada.
export const transmissoes = pgTable(
  "transmissoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    twitchChannel: varchar("twitch_channel", { length: 100 }).notNull(),
    titulo: text("titulo"),
    campeonatoId: uuid("campeonato_id"),
    duracaoHoras: integer("duracao_horas").default(1).notNull(),
    ativo: boolean("ativo").default(true).notNull(),
    criadoEm: timestamp("criado_em", { mode: "date" }).defaultNow().notNull(),
    expiraEm: timestamp("expira_em", { mode: "date" }),
    modo: varchar("modo", { length: 20 }).default("padrao").notNull(), // 'padrao' | 'amistoso' | 'campeonato'
    time1Id: uuid("time1_id"),
    time2Id: uuid("time2_id"),
  },
  (table) => [
    index("transmissoes_ativo_idx").on(table.ativo),
    index("transmissoes_user_idx").on(table.userId),
  ]
);

export const recruitmentPosts = pgTable(
  "recruitment_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(), // 'lft' (looking for team) | 'lfp' (looking for player)
    roleSlot: varchar("role_slot", { length: 50 }).notNull(), // 'top' | 'jungle' | 'mid' | 'adc' | 'support'
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("recruitment_type_idx").on(table.type),
    index("recruitment_active_idx").on(table.active),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(), // 'system' | 'match' | 'team' | 'tournament' | 'wallet'
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_read_idx").on(table.read),
  ]
);
