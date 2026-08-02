ALTER TABLE "tournaments" ADD COLUMN "frase" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "org_photo_url" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "theme_color" varchar(20);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "regulamento" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "vagas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "times_por_grupo" integer;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "classificados_por_grupo" integer;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "tier" varchar(50);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "data" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "premiacao" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "taxa" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "tem_outros_premios" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "outros_premios" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "organizacao" varchar(255);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "times_inscritos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "classificacao" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "grupos" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "cronograma" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "times_ordem_sorteio" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "grupos_sorteados" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "chaves_sorteados" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "bracket_data" jsonb DEFAULT '{}'::jsonb NOT NULL;