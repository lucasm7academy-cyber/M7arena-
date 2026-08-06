ALTER TABLE "user_strikes" RENAME TO "user_advertencias";--> statement-breakpoint
ALTER TABLE "user_advertencias" DROP CONSTRAINT "user_strikes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_advertencias" DROP CONSTRAINT "user_strikes_match_id_matches_id_fk";
--> statement-breakpoint
ALTER TABLE "user_advertencias" DROP CONSTRAINT "user_strikes_removido_por_users_id_fk";
--> statement-breakpoint
DROP INDEX "strikes_user_recentes_idx";--> statement-breakpoint
ALTER TABLE "user_advertencias" ALTER COLUMN "match_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_advertencias" ALTER COLUMN "motivo" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banido_por" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banido_em" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_motivo" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_automatico" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_advertencias" ADD COLUMN "criado_por" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_banido_por_users_id_fk" FOREIGN KEY ("banido_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_advertencias" ADD CONSTRAINT "user_advertencias_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_advertencias" ADD CONSTRAINT "user_advertencias_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_advertencias" ADD CONSTRAINT "user_advertencias_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_advertencias" ADD CONSTRAINT "user_advertencias_removido_por_users_id_fk" FOREIGN KEY ("removido_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advertencias_user_recentes_idx" ON "user_advertencias" USING btree ("user_id","created_at");