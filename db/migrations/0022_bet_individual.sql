CREATE TABLE "bet_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"market_key" varchar(60) NOT NULL,
	"odd" numeric(6, 3) NOT NULL,
	"stake" integer NOT NULL,
	"payout" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'aberta' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bet_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"queue" varchar(10) NOT NULL,
	"status" varchar(30) DEFAULT 'aguardando' NOT NULL,
	"stake_total" integer DEFAULT 0 NOT NULL,
	"resultado" varchar(30),
	"summoner_id" varchar(100),
	"match_riot_id" varchar(100),
	"queue_id" integer,
	"game_start_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_ticket_id_bet_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."bet_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_tickets" ADD CONSTRAINT "bet_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bet_legs_ticket_idx" ON "bet_legs" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "bet_tickets_user_idx" ON "bet_tickets" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bet_tickets_status_idx" ON "bet_tickets" USING btree ("status");