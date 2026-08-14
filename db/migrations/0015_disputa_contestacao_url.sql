-- 0015_disputa_contestacao_url
-- Contestação de partida finalizada (spec verificacao-partida-riot): o print de
-- evidência do contestante é amarrado à disputa (URL autenticada servida por
-- /api/prints/:id/arquivo). Uma disputa = um print de contestação.
ALTER TABLE "match_disputas" ADD COLUMN "contestacao_url" text;--> statement-breakpoint
