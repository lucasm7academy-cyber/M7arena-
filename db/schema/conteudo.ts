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
} from "drizzle-orm/pg-core";
import { users } from "./identidade";

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
  },
  (table) => [
    index("highlights_active_idx").on(table.active),
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
