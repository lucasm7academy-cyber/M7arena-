CREATE TABLE "tournament_series_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid,
	"bracket_match_id" uuid,
	"tournament_id" uuid NOT NULL,
	"game_number" integer NOT NULL,
	"winner_side" varchar(10) NOT NULL,
	"match_id_riot" text,
	"kill_a" integer DEFAULT 0 NOT NULL,
	"kill_b" integer DEFAULT 0 NOT NULL,
	"duracao_s" integer DEFAULT 0 NOT NULL,
	"irregular" boolean DEFAULT false NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD COLUMN "codigo_partida" text;--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD COLUMN "best_of" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD COLUMN "serie_iniciada_at" timestamp;--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD COLUMN "irregular" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD COLUMN "resultado_riot" jsonb;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "codigo_partida" text;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "best_of" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "serie_iniciada_at" timestamp;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "irregular" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "resultado_riot" jsonb;--> statement-breakpoint
ALTER TABLE "tournament_series_games" ADD CONSTRAINT "tournament_series_games_match_id_tournament_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_series_games" ADD CONSTRAINT "tournament_series_games_bracket_match_id_bracket_matches_id_fk" FOREIGN KEY ("bracket_match_id") REFERENCES "public"."bracket_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_series_games" ADD CONSTRAINT "tournament_series_games_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournament_series_games_match_idx" ON "tournament_series_games" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "tournament_series_games_bracket_idx" ON "tournament_series_games" USING btree ("bracket_match_id");--> statement-breakpoint
CREATE INDEX "tournament_series_games_tournament_idx" ON "tournament_series_games" USING btree ("tournament_id");