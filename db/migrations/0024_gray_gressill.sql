CREATE TABLE "escalas_transmissao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escalas_transmissao_match_id_unique" UNIQUE("match_id")
);
--> statement-breakpoint
ALTER TABLE "transmissoes" ADD COLUMN "match_id" uuid;--> statement-breakpoint
ALTER TABLE "escalas_transmissao" ADD CONSTRAINT "escalas_transmissao_match_id_tournament_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalas_transmissao" ADD CONSTRAINT "escalas_transmissao_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "escalas_transmissao_user_idx" ON "escalas_transmissao" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "transmissoes" ADD CONSTRAINT "transmissoes_match_id_tournament_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transmissoes_match_idx" ON "transmissoes" USING btree ("match_id");