CREATE TABLE "sala_mensagens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sala_mensagens_body_len" CHECK (char_length("sala_mensagens"."body") BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "sala_mensagens" ADD CONSTRAINT "sala_mensagens_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sala_mensagens" ADD CONSTRAINT "sala_mensagens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sala_mensagens_match_id_id_idx" ON "sala_mensagens" USING btree ("match_id","id");--> statement-breakpoint
CREATE INDEX "sala_mensagens_created_at_idx" ON "sala_mensagens" USING btree ("created_at");