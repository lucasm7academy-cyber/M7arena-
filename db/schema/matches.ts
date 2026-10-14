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
import { tournamentMatches, bracketMatches } from "./tournaments.js";

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
    // 'preenchendo' | 'confirmacao' | 'draft' | 'iniciando_partida' | 'partida_iniciada' | 'finalizacao' | 'encerrada' | 'cancelada'
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
    // ── Sala Campeonato V1 (ADR-085): vínculo com a SÉRIE do campeonato
    //    (cronograma ou chave). As fases camp_* vivem em `status`; o estado por
    //    jogo fica em campeonato_sala_estado. No máximo UM dos dois vínculos.
    tournamentMatchId: uuid("tournament_match_id").references(() => tournamentMatches.id, { onDelete: "cascade" }),
    bracketMatchId: uuid("bracket_match_id").references(() => bracketMatches.id, { onDelete: "cascade" }),
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
    // Sala campeonato: buscar a sala pela série (criação T-10 / shape).
    index("matches_tournament_match_idx").on(table.tournamentMatchId),
    index("matches_bracket_match_idx").on(table.bracketMatchId),
    // A sala aponta para UMA série (cronograma OU chave), nunca as duas.
    check("matches_campeonato_link_unico", sql`${table.tournamentMatchId} is null or ${table.bracketMatchId} is null`),
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
  // Fila do código por modo (ADR-041): '1v1' = só usado em salas 1v1 (ARAM x1);
  // NULL = genérico, entra em qualquer modo que não tenha fila própria
  // (os 6 códigos 5v5 Tournament Draft servem 5v5/aram/time_vs_time).
  mode: varchar("mode", { length: 50 }),
  // Rodízio LRU (ADR-040): ao liberar, `last_used_at` fica salvo; a atribuição
  // pega o código livre usado há MAIS tempo (nulls first = nunca usado primeiro).
  // Quando todos já foram usados, volta ao primeiro — tempo dos anteriores terminarem.
  lastUsedAt: timestamp("last_used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Draft de sala (ban/pick): uma linha por sala, criada quando todos confirmam
// (confirmacao → draft). O servidor é a autoridade: turno, fase, time e prazo
// vivem AQUI — o cliente só desenha e pede a ação. `turnDeadlineAt` é o
// relógio do servidor (epoch) — o mesmo clockSync das salas corrige o skew no
// front, então ninguém depende do relógio local.
export const matchDrafts = pgTable(
  "match_drafts",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    // Draft por jogo da série (ADR-085): salas normais usam jogo=1; a sala
    // campeonato guarda uma linha por jogo. O Fearless é derivado dos picks
    // das linhas com jogo < atual — sem tabela extra.
    jogo: integer("jogo").default(1).notNull(),
    blueBans: jsonb("blue_bans").$type<(string | null)[]>().default([]).notNull(),
    bluePicks: jsonb("blue_picks").$type<(string | null)[]>().default([]).notNull(),
    redBans: jsonb("red_bans").$type<(string | null)[]>().default([]).notNull(),
    redPicks: jsonb("red_picks").$type<(string | null)[]>().default([]).notNull(),
    currentTurn: integer("current_turn").default(0).notNull(),
    currentPhase: varchar("current_phase", { length: 10 }).default("ban").notNull(), // 'ban' | 'pick'
    currentTeam: varchar("current_team", { length: 10 }).default("blue").notNull(), // 'blue' | 'red'
    turnDeadlineAt: timestamp("turn_deadline_at", { mode: "date" }).notNull(),
    status: varchar("status", { length: 20 }).default("ongoing").notNull(), // 'ongoing' | 'finished'
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.matchId, table.jogo] })]
);

/**
 * Estado por jogo da Sala Campeonato (ADR-085): uma linha por sala. O `jogo`
 * corrente avança junto com a série; PRONTO e as escolhas de lado são
 * SERVIDOR-AUTORITATIVOS (o front só desenha). Sem timer em V1 (ADR-083):
 * o adm destrava se precisar.
 */
export const campeonatoSalaEstado = pgTable("campeonato_sala_estado", {
  matchId: uuid("match_id")
    .primaryKey()
    .references(() => matches.id, { onDelete: "cascade" }),
  jogo: integer("jogo").default(1).notNull(),
  // PRONTO do jogo corrente, repetido a cada jogo (ADR-081).
  prontoBlue: boolean("pronto_blue").default(false).notNull(),
  prontoRed: boolean("pronto_red").default(false).notNull(),
  // Jogo 1: sorteio decide quem escolhe primeiro. Jogos 2+: o perdedor do jogo
  // anterior escolhe o lado (derivado do motor de série).
  sorteioVencedor: varchar("sorteio_vencedor", { length: 10 }), // 'blue' | 'red'
  // Quem está escolhendo AGORA (exibido a todos: "TIME X ESTÁ ESCOLHENDO...").
  escolhaTime: varchar("escolha_time", { length: 10 }), // 'blue' | 'red'
  ladoEscolhido: varchar("lado_escolhido", { length: 10 }), // 'blue' | 'red'
  pickOrderEscolhido: varchar("pick_order_escolhido", { length: 10 }), // 'first' | 'last'
  // O que o PRIMEIRO escolhedor escolheu ('lado' | 'pick'): o sorteado (jogo 1)
  // ou o perdedor (jogos 2+) escolhe lado OU pick order, e o adversário completa
  // o que sobrar. NULL = fluxo antigo (lado vinha primeiro sempre).
  primeiraEscolha: varchar("primeira_escolha", { length: 10 }),
  // Formato da SÉRIE da sala LIVRE (time_vs_time_livre): 'md1' | 'md3' | 'md5'
  // (md3 presetado). No campeonato o formato vem do bestOf da série.
  formato: varchar("formato", { length: 4 }).default("md3").notNull(),
  // SÉRIE LOCAL da sala LIVRE (scrim MD1/MD3/MD5): placar próprio por jogo e
  // quem venceu o jogo anterior ('a'|'b' — vaga do time) pro perdedor escolher
  // o lado nos jogos 2+. No campeonato o placar/vencedor vêm da série.
  placarA: integer("placar_a").default(0).notNull(),
  placarB: integer("placar_b").default(0).notNull(),
  ultimoVencedor: varchar("ultimo_vencedor", { length: 1 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
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
