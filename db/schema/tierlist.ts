import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./identidade.js";

/**
 * Página pública de tier list da M7 Academy.
 *
 * O jogador não precisa de conta: o registro nasce anônimo e, se ele estiver
 * logado no site, `user_id` é preenchido automaticamente. A chave natural é o
 * `puuid` da Riot — uma pessoa pode reenviar o formulário e o registro é
 * atualizado, sem criar duplicata para a importação no app desktop.
 */

export const TIERLIST_ROLES = ["TOP", "JG", "MID", "ADC", "SUP"] as const;
export type TierlistRole = (typeof TIERLIST_ROLES)[number];

export const TIERLIST_TIERS = ["S", "A", "B", "C", "D"] as const;
export type TierlistTier = (typeof TIERLIST_TIERS)[number];

export interface TierlistAvailabilityWindow {
  /** 1 = segunda ... 7 = domingo (mesmo contrato do app desktop). */
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
}

export interface TierlistChampionEntry {
  championId: string;
  championName: string;
  role: TierlistRole;
  tier: TierlistTier;
}

export const tierlistSubmissions = pgTable(
  "tierlist_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    // Snapshot da Riot no momento do envio. Guardar os valores evita uma nova
    // chamada à Riot quando o manager abrir a resposta depois.
    riotId: varchar("riot_id", { length: 100 }).notNull(),
    puuid: varchar("puuid", { length: 100 }).notNull(),
    gameName: varchar("game_name", { length: 100 }).notNull(),
    tagLine: varchar("tag_line", { length: 20 }).notNull(),
    summonerLevel: integer("summoner_level"),
    profileIconId: integer("profile_icon_id"),

    soloTier: varchar("solo_tier", { length: 20 }),
    soloRank: varchar("solo_rank", { length: 5 }),
    soloLp: integer("solo_lp"),
    soloWins: integer("solo_wins"),
    soloLosses: integer("solo_losses"),

    flexTier: varchar("flex_tier", { length: 20 }),
    flexRank: varchar("flex_rank", { length: 5 }),
    flexLp: integer("flex_lp"),
    flexWins: integer("flex_wins"),
    flexLosses: integer("flex_losses"),

    // Contato e identificação pessoal.
    fullName: varchar("full_name", { length: 150 }).notNull(),
    contact: varchar("contact", { length: 20 }).notNull(), // somente dígitos
    contactType: varchar("contact_type", { length: 20 }).default("whatsapp").notNull(),
    email: varchar("email", { length: 255 }),
    discord: varchar("discord", { length: 100 }),

    primaryRole: varchar("primary_role", { length: 10 }).notNull(),
    secondaryRole: varchar("secondary_role", { length: 10 }),

    availability: jsonb("availability")
      .$type<TierlistAvailabilityWindow[]>()
      .default([])
      .notNull(),
    championPool: jsonb("champion_pool")
      .$type<TierlistChampionEntry[]>()
      .default([])
      .notNull(),

    notes: text("notes"),
    status: varchar("status", { length: 30 }).default("novo").notNull(),
    source: varchar("source", { length: 30 }).default("site").notNull(),
    consentedAt: timestamp("consented_at", { mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tierlist_submissions_puuid_idx").on(table.puuid),
    index("tierlist_submissions_created_idx").on(table.createdAt),
    index("tierlist_submissions_status_idx").on(table.status),
  ]
);
