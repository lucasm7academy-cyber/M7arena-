-- 0014_rodizio_codigos_lru
-- Pool de tournament codes com rodízio LRU (ADR-040): o código de partida
-- liberado volta ao pool com `last_used_at` preservado, e a atribuição pega o
-- código livre usado há mais tempo — quando todos já foram usados, volta ao
-- primeiro, dando tempo de os anteriores terminarem. `used=false` + o mesmo
-- `last_used_at` vira o "menos recentemente usado".
ALTER TABLE "match_codes" ADD COLUMN "last_used_at" timestamp;--> statement-breakpoint

-- Os 2 códigos novos fornecidos pelo usuário (verificados: não existem no pool).
INSERT INTO "match_codes" ("code") VALUES
  ('BR04fa2-c030f90e-866b-439f-9d19-53ed113c41f0'),
  ('BR04fa2-dd6e4394-e7fd-47fd-abbf-1409eed8c239')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
