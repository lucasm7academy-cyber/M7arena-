-- 0006_content_swap (app.swap.conteudo)
-- Swap do domínio conteúdo: o fork do front (Admin/Lobby/Streamers) ainda
-- consome o shape legado snake_case das tabelas `noticias`/`highlights`/
-- `player_stats` do Supabase. O schema novo (news/highlights) nasceu sem as
-- colunas de exibição legadas, então o swap exige:
--   1. news      → categoria, destaque, link_url, link_texto, autor
--   2. highlights→ ordem, categoria
--   3. player_stats → tabela nova (PK user_id+modo, como no schema antigo)

-- ── 1. Colunas legadas em news ──────────────────────────────────────────────
ALTER TABLE "news" ADD COLUMN "categoria" varchar(50) DEFAULT 'Torneios' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "destaque" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "link_url" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "link_texto" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "autor" varchar(120);--> statement-breakpoint

-- ── 2. Colunas legadas em highlights ────────────────────────────────────────
ALTER TABLE "highlights" ADD COLUMN "ordem" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "highlights" ADD COLUMN "categoria" varchar(50) DEFAULT 'highlight' NOT NULL;--> statement-breakpoint

-- ── 3. Tabela player_stats ──────────────────────────────────────────────────
CREATE TABLE "player_stats" (
	"user_id" uuid NOT NULL,
	"modo" varchar(20) NOT NULL,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	"total_games" integer DEFAULT 0 NOT NULL,
	"winrate" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_stats_user_id_modo_pk" PRIMARY KEY("user_id","modo")
);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_stats_user_idx" ON "player_stats" USING btree ("user_id");--> statement-breakpoint
