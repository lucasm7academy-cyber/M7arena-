import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  numeric,
  bigserial,
  primaryKey,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identidade.js";
import { games } from "./games.js";

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Número público da sala (herdado de `salas.id` bigint). O fork navega em
    // `/sala-mod1/:id` e deriva o código de exibição `#${String(id).padStart(6,'0')}`,
    // então o id público precisa ser numérico — o uuid fica interno.
    salaNum: integer("sala_num").generatedByDefaultAsIdentity().notNull().unique(),
    gameId: varchar("game_id", { length: 50 })
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    mode: varchar("mode", { length: 50 }).notNull(), // '5v5' | 'aram' | '1v1' | 'time_vs_time'
    status: varchar("status", { length: 50 }).default("preenchendo").notNull(),
    // 'preenchendo' | 'confirmacao' | 'iniciando_partida' | 'partida_iniciada' | 'finalizacao' | 'encerrada' | 'cancelada'
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    roomCode: varchar("room_code", { length: 20 }),
    winnerSide: varchar("winner_side", { length: 10 }), // 'blue' | 'red' | 'draw'
    entryMp: integer("entry_mp").default(0).notNull(),
    // ── Shape legado de `salas` que o fork do front consome 1:1 (ADR-005/010).
    //    Adicionado pelo swap app.swap.salas (migration 0006): a API devolve
    //    estes nomes para o JSX não mudar uma linha.
    nome: text("nome"),
    descricao: text("descricao"),
    maxJogadores: integer("max_jogadores").default(10).notNull(),
    temSenha: boolean("tem_senha").default(false).notNull(),
    senha: text("senha"),
    eloMinimo: varchar("elo_minimo", { length: 50 }),
    timeANome: text("time_a_nome"),
    timeATag: text("time_a_tag"),
    timeALogo: text("time_a_logo"),
    timeBNome: text("time_b_nome"),
    timeBTag: text("time_b_tag"),
    timeBLogo: text("time_b_logo"),
    codigoPartida: text("codigo_partida"),
    // Motivo da vitória no 1v1 (win condition): 'first_blood' | '100_cs'. Null
    // nos demais modos (partida completa/surrender decide por win da Riot).
    vitoriaMotivo: varchar("vitoria_motivo", { length: 20 }),
    confirmacaoExpiresAt: timestamp("confirmacao_expires_at", { mode: "date" }),
    iniciandoPartidaAt: timestamp("iniciando_partida_at", { mode: "date" }),
    stateDeadlineAt: timestamp("state_deadline_at", { mode: "date" }),
    // ── Salas apostadas (ADR-019 / design v3 §5) ──
    apostaMc: integer("aposta_mc").default(0).notNull(),   // 0 = casual
    taxaPct: numeric("taxa_pct", { precision: 5, scale: 2 }).default("8.99").notNull(),
    resultado: varchar("resultado", { length: 10 }),        // 'blue' | 'red' | 'draw'
    canceladoEm: timestamp("cancelado_em", { mode: "date" }),
    revisadoPor: uuid("revisado_por").references(() => users.id),
    revisadoEm: timestamp("revisado_em", { mode: "date" }),
    decisaoId: uuid("decisao_id"),
    revisaoDesde: timestamp("revisao_desde", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { mode: "date" }),
  },
  (table) => [
    index("matches_status_idx").on(table.status),
    index("matches_game_idx").on(table.gameId),
    index("matches_created_by_idx").on(table.createdBy),
  ]
);

export const matchPlayers = pgTable(
  "match_players",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    side: varchar("side", { length: 10 }).notNull(), // 'blue' | 'red'
    slot: integer("slot").notNull(), // 0..4
    roleSlot: varchar("role_slot", { length: 50 }), // 'top' | 'jungle' | 'mid' | 'adc' | 'support'
    confirmed: boolean("confirmed").default(false).notNull(),
    linked: boolean("linked").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.userId] }),
    index("match_players_user_idx").on(table.userId),
  ]
);

export const matchResults = pgTable("match_results", {
  matchId: uuid("match_id")
    .primaryKey()
    .references(() => matches.id, { onDelete: "cascade" }),
  winnerSide: varchar("winner_side", { length: 10 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(), // Histórico imutável de stats da partida da Riot API
  settledAt: timestamp("settled_at", { mode: "date" }).defaultNow().notNull(),
});

export const matchCodes = pgTable("match_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
  used: boolean("used").default(false).notNull(),
  // Rodízio LRU (ADR-040): ao liberar, `last_used_at` fica salvo; a atribuição
  // pega o código livre usado há MAIS tempo (nulls first = nunca usado primeiro).
  // Quando todos já foram usados, volta ao primeiro — tempo dos anteriores terminarem.
  lastUsedAt: timestamp("last_used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Chat da sala (ADR-040): conversa geral entre participantes. Mensagens são
// autoexcluídas após 5 min (cron + purge preguiçoso) — a tabela nunca acumula.
export const salaMensagens = pgTable(
  "sala_mensagens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    // Cor do time do remetente no MOMENTO do envio (ADR-040): a mensagem nasce
    // com a cor ('#3B82F6' blue, '#ef4444' red, '#FFB700' fora da vaga) e ela
    // não muda se o jogador trocar de lado depois. Qualquer um que entrar vê.
    cor: varchar("cor", { length: 10 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("sala_mensagens_match_id_id_idx").on(table.matchId, table.id),
    index("sala_mensagens_created_at_idx").on(table.createdAt),
    check("sala_mensagens_body_len", sql`char_length(${table.body}) BETWEEN 1 AND 200`),
  ]
);
