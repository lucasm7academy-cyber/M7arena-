CREATE TABLE "mc_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_brl" numeric(10, 2) NOT NULL,
	"base_mc" integer NOT NULL,
	"bonus_mc" integer DEFAULT 0 NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mc_packages_price_brl_unique" UNIQUE("price_brl")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "mc_credit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "mc_packages_active_idx" ON "mc_packages" USING btree ("active","sort_order");
--> statement-breakpoint
-- Seed dos pacotes de MC (ADR-031). R$1 = 100 MC base; bônus a partir de R$50
-- (6 MC por real). ON CONFLICT mantém a migration idempotente.
INSERT INTO "mc_packages" ("price_brl", "base_mc", "bonus_mc", "is_popular", "active", "sort_order")
VALUES
  ('5.00', 500, 0, false, true, 1),
  ('10.00', 1000, 0, false, true, 2),
  ('20.00', 2000, 0, false, true, 3),
  ('50.00', 5000, 300, true, true, 4),
  ('100.00', 10000, 600, false, true, 5),
  ('200.00', 20000, 1200, false, true, 6)
ON CONFLICT ("price_brl") DO NOTHING;