-- ── Fix leave 500: refund repetido ──────────────────────────────────────────
-- A UNIQUE idx_ledger_match_unico incluía 'match_entry_refund': um jogador que
-- sai e RE-ENTRA numa sala apostada gera um 2º refund na mesma partida → viola
-- a constraint → 500 no leave. Prize/loss continuam únicos (resultado de uma
-- partida só acontece 1x), mas refund precisa poder repetir (cada saída).
DROP INDEX IF EXISTS idx_ledger_match_unico;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_match_unico
  ON wallet_transactions (ref_id, user_id, kind)
  WHERE kind IN ('match_prize', 'match_loss') AND ref_type = 'match';
