ALTER TABLE "bet_tickets" ADD COLUMN IF NOT EXISTS "champion_name" varchar(50);--> statement-breakpoint
ALTER TABLE "bet_tickets" ADD COLUMN IF NOT EXISTS "champion_id" integer;
