CREATE TABLE "poker_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(40) NOT NULL,
	"sb" integer NOT NULL,
	"bb" integer NOT NULL,
	"buy_in" integer DEFAULT 0 NOT NULL,
	"seats" integer NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "poker_rooms_seats_check" CHECK ("poker_rooms"."seats" between 2 and 6)
);
--> statement-breakpoint
ALTER TABLE "poker_rooms" ADD CONSTRAINT "poker_rooms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poker_rooms_status_created_idx" ON "poker_rooms" USING btree ("status","created_at" DESC NULLS LAST);