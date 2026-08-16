-- 0020_separar_fila_codigos_x1
-- Separa o pool de tournament codes por modo (ADR-041): o x1 (1v1 ARAM) tem
-- fila própria com os 2 códigos BR050c8-*; os 6 códigos BR04fa2-* (Summoner's
-- Rift 5v5 Tournament Draft) ficam como genéricos (mode NULL) servindo
-- 5v5/aram/time_vs_time. A atribuição em match-flow.ts filtra por modo.
ALTER TABLE "match_codes" ADD COLUMN "mode" varchar(50);--> statement-breakpoint

-- Códigos exclusivos do x1 (1v1 ARAM) fornecidos pelo usuário.
INSERT INTO "match_codes" ("code", "mode") VALUES
  ('BR050c8-1f49db56-5565-4f80-95cb-3588bdd5f3c5', '1v1'),
  ('BR050c8-5f98c458-5d16-4381-bb4b-165fe09fb85e', '1v1')
ON CONFLICT ("code") DO UPDATE SET "mode" = '1v1';