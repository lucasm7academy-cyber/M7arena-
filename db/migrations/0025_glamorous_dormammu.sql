CREATE TABLE "match_drafts" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"blue_bans" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blue_picks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"red_bans" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"red_picks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_turn" integer DEFAULT 0 NOT NULL,
	"current_phase" varchar(10) DEFAULT 'ban' NOT NULL,
	"current_team" varchar(10) DEFAULT 'blue' NOT NULL,
	"turn_deadline_at" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'ongoing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_drafts" ADD CONSTRAINT "match_drafts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;