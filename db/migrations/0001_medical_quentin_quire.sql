CREATE TABLE "aim_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" varchar(20) NOT NULL,
	"score" integer NOT NULL,
	"accuracy_pct" integer NOT NULL,
	"apm" integer NOT NULL,
	"combo" integer DEFAULT 0 NOT NULL,
	"grade" varchar(2) NOT NULL,
	"duration_ms" integer DEFAULT 60000 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poker_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"room_id" varchar(40) NOT NULL,
	"buy_in" integer NOT NULL,
	"payout" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_wallets" ADD COLUMN "ea" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "aim_scores" ADD CONSTRAINT "aim_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poker_sessions" ADD CONSTRAINT "poker_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aim_scores_mode_score_idx" ON "aim_scores" USING btree ("mode","score" desc);--> statement-breakpoint
CREATE INDEX "aim_scores_user_created_idx" ON "aim_scores" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "poker_sessions_user_status_idx" ON "poker_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ledger_poker_grant_unico" ON "wallet_transactions" USING btree ("user_id","kind") WHERE "wallet_transactions"."kind" = 'poker_grant' and "wallet_transactions"."currency" = 'ea';--> statement-breakpoint
-- GRANT_INICIAL_2000_EA
-- Concessão silenciosa de 2.000 EA para cada jogador já cadastrado. Idempotente:
-- só credita quem ainda não tem o lançamento `poker_grant` em `ea`, e o índice
-- único parcial acima impede duplicata. Sem notificação, banner ou e-mail.
INSERT INTO "user_wallets" ("user_id", "ea") SELECT u."id", 0 FROM "users" u ON CONFLICT ("user_id") DO NOTHING;--> statement-breakpoint
WITH creditados AS (
  UPDATE "user_wallets" w SET "ea" = w."ea" + 2000, "updated_at" = now()
  WHERE NOT EXISTS (
    SELECT 1 FROM "wallet_transactions" t
    WHERE t."user_id" = w."user_id" AND t."kind" = 'poker_grant' AND t."currency" = 'ea'
  )
  RETURNING w."user_id", w."ea"
)
INSERT INTO "wallet_transactions" ("user_id","currency","amount","kind","ref_type","ref_id","balance_after")
SELECT "user_id", 'ea', 2000, 'poker_grant', 'poker_grant', 'grant_inicial_2000_ea', "ea" FROM creditados;