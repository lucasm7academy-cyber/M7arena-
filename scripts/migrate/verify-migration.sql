-- Verification SQL Script (mig.verify)
-- Valida contagens e integridade entre origem e destino

SELECT 'users' AS tabela, COUNT(*) AS total FROM users
UNION ALL
SELECT 'teams' AS tabela, COUNT(*) AS total FROM teams
UNION ALL
SELECT 'tournaments' AS tabela, COUNT(*) AS total FROM tournaments
UNION ALL
SELECT 'matches' AS tabela, COUNT(*) AS total FROM matches;
