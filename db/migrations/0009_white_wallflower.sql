CREATE TABLE "match_disputas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"motivo" text NOT NULL,
	"status" varchar(20) DEFAULT 'aberta' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_prints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_strikes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"motivo" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"removido_por" uuid,
	"removido_em" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_wallets" ADD COLUMN "mc_reservado" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "riot_id" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspensa_ate" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "termos_aceitos_em" timestamp;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "aposta_mc" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "taxa_pct" numeric(5, 2) DEFAULT '8.99' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "resultado" varchar(10);--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "cancelado_em" timestamp;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "revisado_por" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "revisado_em" timestamp;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "decisao_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "revisao_desde" timestamp;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD COLUMN "mc_fee_rounding" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "match_disputas" ADD CONSTRAINT "match_disputas_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_disputas" ADD CONSTRAINT "match_disputas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_prints" ADD CONSTRAINT "match_prints_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_prints" ADD CONSTRAINT "match_prints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_strikes" ADD CONSTRAINT "user_strikes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_strikes" ADD CONSTRAINT "user_strikes_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_strikes" ADD CONSTRAINT "user_strikes_removido_por_users_id_fk" FOREIGN KEY ("removido_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disputas_match_idx" ON "match_disputas" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "prints_match_idx" ON "match_prints" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "strikes_user_recentes_idx" ON "user_strikes" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_revisado_por_users_id_fk" FOREIGN KEY ("revisado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- ── Constraints manuais (Task 1 Step 8 do P1) ───────────────────────────────
-- UNIQUE (match_id, user_id) em match_disputas (1 contestação por jogador)
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputas_match_user
  ON match_disputas (match_id, user_id);--> statement-breakpoint

-- Idempotência do ledger: nunca paga/perde/devolve 2x a mesma coisa na mesma partida.
-- A tabela não tem coluna match_id — a referência é ref_id + ref_type='match'.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_match_unico
  ON wallet_transactions (ref_id, user_id, kind)
  WHERE kind IN ('match_prize', 'match_loss', 'match_entry_refund') AND ref_type = 'match';--> statement-breakpoint

-- Riot ID único (case-insensitive), só quando preenchido
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_riot_id
  ON users (lower(riot_id)) WHERE riot_id IS NOT NULL;--> statement-breakpoint

-- Cron: kick de ociosidade + partida fantasma
CREATE INDEX IF NOT EXISTS idx_matches_status_updated
  ON matches (status, updated_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_matches_revisao
  ON matches (status, revisao_desde)
  WHERE status = 'aguardando_revisao';