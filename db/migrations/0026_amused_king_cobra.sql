CREATE TABLE "campeonato_sala_estado" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"jogo" integer DEFAULT 1 NOT NULL,
	"pronto_blue" boolean DEFAULT false NOT NULL,
	"pronto_red" boolean DEFAULT false NOT NULL,
	"sorteio_vencedor" varchar(10),
	"escolha_time" varchar(10),
	"lado_escolhido" varchar(10),
	"pick_order_escolhido" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_drafts" ADD COLUMN "jogo" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "match_drafts" DROP CONSTRAINT "match_drafts_pkey";--> statement-breakpoint
ALTER TABLE "match_drafts" ADD CONSTRAINT "match_drafts_match_id_jogo_pk" PRIMARY KEY("match_id","jogo");--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "tournament_match_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "bracket_match_id" uuid;--> statement-breakpoint
ALTER TABLE "campeonato_sala_estado" ADD CONSTRAINT "campeonato_sala_estado_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_match_id_tournament_matches_id_fk" FOREIGN KEY ("tournament_match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_bracket_match_id_bracket_matches_id_fk" FOREIGN KEY ("bracket_match_id") REFERENCES "public"."bracket_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_tournament_match_idx" ON "matches" USING btree ("tournament_match_id");--> statement-breakpoint
CREATE INDEX "matches_bracket_match_idx" ON "matches" USING btree ("bracket_match_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_campeonato_link_unico" CHECK ("matches"."tournament_match_id" is null or "matches"."bracket_match_id" is null);
