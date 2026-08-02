CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid,
	"riot_id" text,
	"role" varchar(50) NOT NULL,
	"message" text,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "guest_riot_id" text;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "guest_puuid" text;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "guest_profile_icon_id" integer;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "guest_elo_cache" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "gradient_from" varchar(50);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "gradient_to" varchar(50);--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_invites_team_idx" ON "team_invites" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_invites_from_user_idx" ON "team_invites" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "team_invites_to_user_idx" ON "team_invites" USING btree ("to_user_id");