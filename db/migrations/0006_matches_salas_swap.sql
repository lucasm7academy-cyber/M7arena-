-- 0006_matches_salas_swap (Task 3 app.swap.salas)
-- A máquina de estados de sala (preenchendo → confirmacao → iniciando_partida
-- → partida_iniciada → finalizacao → encerrada) roda na API (api/src/lib/
-- match-flow.ts) e o fork do front consome o shape legado de `salas` 1:1
-- (ADR-005/010). A tabela `matches` era mínima demais para isso — estas
-- colunas espelham os campos de exibição e os timers que o JSX já lê.

ALTER TABLE "matches" ADD COLUMN "nome" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "descricao" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "max_jogadores" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "tem_senha" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "senha" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "elo_minimo" varchar(50);--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "time_a_nome" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "time_a_tag" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "time_a_logo" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "time_b_nome" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "time_b_tag" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "time_b_logo" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "codigo_partida" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "confirmacao_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "iniciando_partida_at" timestamp;--> statement-breakpoint

-- ── 2. Pool de tournament codes (servidor) ────────────────────────────────
-- O código de partida é um tournament code REAL da Riot que o jogador cola no
-- cliente do LoL — um valor inventado não funciona. O fork do front consumia o
-- pool hardcoded em src/config/codigosPartida.ts (rodízio em localStorage, que
-- dois clientes da mesma sala divergiam). A API agora distribui com lock de
-- linha (FOR UPDATE SKIP LOCKED) sobre `match_codes`, único por partida. Seed
-- com os mesmos 4 códigos reais que o site antigo usava.
INSERT INTO "match_codes" ("code") VALUES
  ('BR04fa2-4611cfe4-f5fd-47da-8497-0b9edb308d83'),
  ('BR04fa2-ca5d28f8-28c3-4b03-a212-0ab9dbf237bc'),
  ('BR04fa2-8ad0a8b7-4d00-4ce9-9272-46c6a5ec7f53'),
  ('BR04fa2-4acc3d6d-923c-49b6-b9d8-2ebbb8acbad3')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
