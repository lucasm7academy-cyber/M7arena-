-- 0005_campeonatos_normalize (ADR-016)
-- Normalização completa de campeonatos: elimina os 8 blobs JSONB legados
-- (times_inscritos, classificacao, grupos, cronograma, bracket_data,
--  times_ordem_sorteio, grupos_sorteados, chaves_sorteados) para tabelas
-- relacionais / colunas nativas. O fork do front é servido 1:1 pela API.
--
-- Ordem: 1) criar tabelas novas e colunas, 2) BACKFILL dos blobs existentes,
--        3) DROP das colunas jsonb (só depois do backfill).

-- ── 1. Colunas novas em tournaments ─────────────────────────────────────────
ALTER TABLE "tournaments" ADD COLUMN "seed_order" text[];--> statement-breakpoint
-- O DEFAULT jsonb original impede a conversão de tipo; dropa antes, aplica e restaura.
ALTER TABLE "tournaments" ALTER COLUMN "grupos_sorteados" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "grupos_sorteados" SET DATA TYPE boolean USING ("grupos_sorteados" = 'true'::jsonb);--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "grupos_sorteados" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "grupos_sorteados" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "chaves_sorteados" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "chaves_sorteados" SET DATA TYPE boolean USING ("chaves_sorteados" = 'true'::jsonb);--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "chaves_sorteados" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "chaves_sorteados" SET NOT NULL;--> statement-breakpoint

-- ── 2. Colunas novas em tournament_teams (legado times_inscritos) ──────────
ALTER TABLE "tournament_teams" ADD COLUMN "paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD COLUMN "discord" text;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD COLUMN "group_id" uuid;--> statement-breakpoint

-- ── 3. Colunas de exibição em tournament_matches (legado cronograma) ───────
ALTER TABLE "tournament_matches" ADD COLUMN "match_key" text;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "phase_label" text;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "team_a_tag" text;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "team_b_tag" text;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "display_date" text;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "display_time" text;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "score_display" text;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "proposed_by" text;--> statement-breakpoint

-- ── 4. Tabelas novas ───────────────────────────────────────────────────────
CREATE TABLE "bracket_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"section" varchar(30) NOT NULL,
	"round" varchar(20) NOT NULL,
	"slot" integer NOT NULL,
	"team_a_tag" text,
	"team_b_tag" text,
	"team_a_id" uuid,
	"team_b_id" uuid,
	"score_a" integer DEFAULT 0 NOT NULL,
	"score_b" integer DEFAULT 0 NOT NULL,
	"winner_side" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "tournament_standings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"v" integer DEFAULT 0 NOT NULL,
	"d" integer DEFAULT 0 NOT NULL,
	"wo" integer DEFAULT 0 NOT NULL,
	"j" integer DEFAULT 0 NOT NULL,
	"cor" text,
	"logo" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ── 5. BACKFILL: transforma os blobs jsonb existentes em linhas ────────────
-- tournament_teams ← times_inscritos (TeamRegistration[])
INSERT INTO "tournament_teams" ("tournament_id", "team_id", "status", "paid", "discord", "whatsapp", "registered_at")
SELECT
  t.id,
  tm.id,
  CASE
    WHEN te->>'status' = 'pending' THEN 'registered'
    ELSE COALESCE(te->>'status', 'registered')
  END,
  COALESCE((te->>'paid')::boolean, false),
  te->>'discord',
  te->>'whatsapp',
  COALESCE((te->>'registered_at')::timestamp, t.created_at)
FROM "tournaments" t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t.times_inscritos) = 'array' THEN t.times_inscritos ELSE '[]'::jsonb END
) te
LEFT JOIN "teams" tm ON tm.tag = te->>'tag';
--> statement-breakpoint
-- tournament_groups ← grupos ({"Grupo A": [teams...]})
-- O grupo legado NÃO carrega id — a chave do objeto É o nome ("Grupo A").
INSERT INTO "tournament_groups" ("tournament_id", "name")
SELECT t.id, g.name
FROM "tournaments" t
CROSS JOIN LATERAL jsonb_each_text(
  CASE WHEN jsonb_typeof(t.grupos) = 'object' THEN t.grupos ELSE '{}'::jsonb END
) g(name, group_json);
--> statement-breakpoint
-- Ajusta tournament_teams.group_id a partir de grupos
UPDATE "tournament_teams" tt
SET "group_id" = tg.id
FROM "tournaments" t
CROSS JOIN LATERAL jsonb_each_text(
  CASE WHEN jsonb_typeof(t.grupos) = 'object' THEN t.grupos ELSE '{}'::jsonb END
) g(name, group_json)
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(group_json::jsonb) = 'array' THEN group_json::jsonb ELSE '[]'::jsonb END
) elem
JOIN "tournament_groups" tg ON tg.tournament_id = t.id AND tg.name = g.name
JOIN "teams" tm ON tm.tag = elem->>'tag'
WHERE tt.tournament_id = t.id AND tt.team_id = tm.id;
--> statement-breakpoint
-- tournament_standings ← classificacao (Standing[])
INSERT INTO "tournament_standings" ("tournament_id", "team_id", "rank", "v", "d", "wo", "j", "cor", "logo")
SELECT
  t.id,
  tm.id,
  (s->>'rank')::integer,
  COALESCE((s->>'v')::integer, 0),
  COALESCE((s->>'d')::integer, 0),
  COALESCE((s->>'wo')::integer, 0),
  COALESCE((s->>'j')::integer, 0),
  s->>'cor',
  s->>'logo'
FROM "tournaments" t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t.classificacao) = 'array' THEN t.classificacao ELSE '[]'::jsonb END
) s
LEFT JOIN "teams" tm ON tm.tag = s->>'tag' OR tm.name = s->>'nome' OR tm.name = s->>'name';
--> statement-breakpoint
-- tournament_matches ← cronograma (cronograma legado)
INSERT INTO "tournament_matches"
  ("tournament_id", "phase", "round", "group_id", "team_a_id", "team_b_id",
   "score_a", "score_b", "status", "match_key", "phase_label",
   "team_a_tag", "team_b_tag", "display_date", "display_time", "score_display", "proposed_by")
SELECT
  t.id,
  'group_stage',
  0,
  NULL,
  tma.id,
  tmb.id,
  COALESCE(COALESCE(NULLIF(split_part(c->>'placar', ' - ', 1), ''), '0')::integer, 0),
  COALESCE(COALESCE(NULLIF(split_part(c->>'placar', ' - ', 2), ''), '0')::integer, 0),
  COALESCE(c->>'status', 'pending'),
  c->>'id',
  c->>'fase',
  c->>'timeA',
  c->>'timeB',
  COALESCE(c->>'data', 'A COMBINAR'),
  COALESCE(c->>'hora', '--:--'),
  COALESCE(c->>'placar', '0 - 0'),
  c->>'proposedBy'
FROM "tournaments" t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(t.cronograma) = 'array' THEN t.cronograma ELSE '[]'::jsonb END
) c
LEFT JOIN "teams" tma ON tma.tag = c->>'timeA'
LEFT JOIN "teams" tmb ON tmb.tag = c->>'timeB';
--> statement-breakpoint
-- bracket_matches ← bracket_data (árvore double-elimination)
-- Reescreve a árvore em células (section, round, slot). Ignora células vazias
-- e campos não-árvore (ex.: winner de conveniência na raiz).
INSERT INTO "bracket_matches" ("tournament_id", "section", "round", "slot",
  "team_a_tag", "team_b_tag", "team_a_id", "team_b_id", "score_a", "score_b", "winner_side")
WITH exploded AS (
  SELECT t.id AS tournament_id, cells.key AS section, cells.value AS cell, meta.key AS round, meta.value AS cell_arr
  FROM "tournaments" t
  CROSS JOIN LATERAL jsonb_each(t.bracket_data) cells
  CROSS JOIN LATERAL jsonb_each(cells.value) meta
)
SELECT
  e.tournament_id,
  e.section,
  e.round,
  ord.ord - 1 AS slot,
  (e.cell_arr->(ord.ord - 1)->>'t1')::text,
  (e.cell_arr->(ord.ord - 1)->>'t2')::text,
  tma.id,
  tmb.id,
  COALESCE((e.cell_arr->(ord.ord - 1)->>'s1')::integer, 0),
  COALESCE((e.cell_arr->(ord.ord - 1)->>'s2')::integer, 0),
  e.cell_arr->(ord.ord - 1)->>'winner'
FROM exploded e
CROSS JOIN LATERAL generate_series(
  1,
  CASE WHEN jsonb_typeof(e.cell_arr) = 'array' THEN jsonb_array_length(e.cell_arr) ELSE 0 END
) AS ord(ord)
LEFT JOIN "teams" tma ON tma.tag = e.cell_arr->(ord.ord - 1)->>'t1'
LEFT JOIN "teams" tmb ON tmb.tag = e.cell_arr->(ord.ord - 1)->>'t2'
WHERE (e.cell_arr->(ord.ord - 1)->>'t1')::text IS NOT NULL
   OR (e.cell_arr->(ord.ord - 1)->>'t2')::text IS NOT NULL;
--> statement-breakpoint
-- seed_order ← times_ordem_sorteio (array de tags/objetos)
UPDATE "tournaments"
SET "seed_order" = COALESCE(
  (
    SELECT array_agg(CASE WHEN jsonb_typeof(e) = 'string' THEN e #>> '{}' ELSE e->>'tag' END)
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(times_ordem_sorteio) = 'array' THEN times_ordem_sorteio ELSE '[]'::jsonb END
    ) e
  ),
  '{}'::text[]
)
WHERE jsonb_typeof(times_ordem_sorteio) = 'array'
  AND jsonb_array_length(times_ordem_sorteio) > 0;
--> statement-breakpoint

-- ── 6. DROP das colunas jsonb legadas (backfill já feito) ──────────────────
ALTER TABLE "tournaments" DROP COLUMN "times_inscritos";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "classificacao";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "grupos";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "cronograma";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "bracket_data";--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "times_ordem_sorteio";--> statement-breakpoint

-- ── 7. FKs e índices ───────────────────────────────────────────────────────
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_group_id_tournament_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_match_key_unique" UNIQUE ("tournament_id", "match_key");--> statement-breakpoint
CREATE INDEX "tournament_matches_match_key_idx" ON "tournament_matches" USING btree ("match_key");--> statement-breakpoint
CREATE INDEX "tournament_teams_group_idx" ON "tournament_teams" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bracket_matches_cell_idx" ON "bracket_matches" USING btree ("tournament_id", "section", "round", "slot");--> statement-breakpoint
CREATE INDEX "bracket_matches_tournament_idx" ON "bracket_matches" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_standings_team_idx" ON "tournament_standings" USING btree ("tournament_id", "team_id");--> statement-breakpoint
CREATE INDEX "tournament_standings_rank_idx" ON "tournament_standings" USING btree ("tournament_id", "rank");--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_standings" ADD CONSTRAINT "tournament_standings_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_standings" ADD CONSTRAINT "tournament_standings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
