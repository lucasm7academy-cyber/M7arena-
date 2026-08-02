-- Seed de games. O POST /api/teams insere game_id='lol' com FK para games.id,
-- mas nenhuma migration criava a linha — o time nunca podia ser criado num
-- banco limpo (achado do swap app.swap.times, 2026-08-02).
-- ON CONFLICT DO NOTHING mantém a migration idempotente.
INSERT INTO "games" ("id", "name", "active")
VALUES ('lol', 'League of Legends', true)
ON CONFLICT ("id") DO NOTHING;
