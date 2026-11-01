-- Códigos Riot "às cegas" (blind pick) para a sala Campeonato e a sala
-- Time vs Time / Scrim. O draft é feito no site; no LoL a partida é blind.
-- A sala 5x5 continua usando os códigos Tournament Draft antigos (mode IS NULL)
-- e o 1v1 tem a fila própria (mode = '1v1').
--
-- Idempotente: se o código já existir e não estiver preso a uma sala, só
-- garante a fila blind; não mexe em código em uso.

INSERT INTO match_codes (code, mode) VALUES
  ('BR05116-a3f7a6fa-2354-41f3-933e-2ca8b94184be', 'blind'),
  ('BR05116-438742d6-1069-4457-b602-f7753013cdfd', 'blind'),
  ('BR05116-b47a5cd7-7b8c-4494-b043-8ce796c67675', 'blind'),
  ('BR05116-cad6ecdd-6dec-408b-908e-d453c23eb91e', 'blind'),
  ('BR05116-11231a11-e70a-471b-a6f7-34e2e2ac3b53', 'blind'),
  ('BR05116-0f497dad-f1e6-4f6b-a82c-b0eab5f6fb6f', 'blind'),
  ('BR05116-79675dd2-1001-4298-a851-c28453f6baec', 'blind')
ON CONFLICT (code) DO UPDATE
  SET mode = 'blind'
  WHERE match_codes.match_id IS NULL;
