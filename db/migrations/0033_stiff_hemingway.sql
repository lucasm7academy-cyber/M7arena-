CREATE TABLE "tierlist_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"riot_id" varchar(100) NOT NULL,
	"puuid" varchar(100) NOT NULL,
	"game_name" varchar(100) NOT NULL,
	"tag_line" varchar(20) NOT NULL,
	"summoner_level" integer,
	"profile_icon_id" integer,
	"solo_tier" varchar(20),
	"solo_rank" varchar(5),
	"solo_lp" integer,
	"solo_wins" integer,
	"solo_losses" integer,
	"flex_tier" varchar(20),
	"flex_rank" varchar(5),
	"flex_lp" integer,
	"flex_wins" integer,
	"flex_losses" integer,
	"full_name" varchar(150) NOT NULL,
	"contact" varchar(20) NOT NULL,
	"contact_type" varchar(20) DEFAULT 'whatsapp' NOT NULL,
	"email" varchar(255),
	"discord" varchar(100),
	"primary_role" varchar(10) NOT NULL,
	"secondary_role" varchar(10),
	"availability" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"champion_pool" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"status" varchar(30) DEFAULT 'novo' NOT NULL,
	"source" varchar(30) DEFAULT 'site' NOT NULL,
	"consented_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tierlist_submissions" ADD CONSTRAINT "tierlist_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tierlist_submissions_puuid_idx" ON "tierlist_submissions" USING btree ("puuid");--> statement-breakpoint
CREATE INDEX "tierlist_submissions_created_idx" ON "tierlist_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tierlist_submissions_status_idx" ON "tierlist_submissions" USING btree ("status");