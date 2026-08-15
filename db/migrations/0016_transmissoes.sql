-- 0016_transmissoes
-- Transmissões de streamer (swap app.swap.conteudo): o Streamers.tsx passou a
-- falar com /api/streams em vez de supabase.from('transmissoes') — sem sessão
-- GoTrue o RLS do Supabase bloqueava o insert ("Erro ao iniciar transmissão").
-- Espelha o shape legado: titulo/duracao_horas/ativo/criado_em/expira_em/modo
-- + time1_id/time2_id/campeonato_id usados pelos cards da vitrine.
CREATE TABLE IF NOT EXISTS "transmissoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "twitch_channel" varchar(100) NOT NULL,
  "titulo" text,
  "campeonato_id" uuid,
  "duracao_horas" integer DEFAULT 1 NOT NULL,
  "ativo" boolean DEFAULT true NOT NULL,
  "criado_em" timestamp DEFAULT now() NOT NULL,
  "expira_em" timestamp,
  "modo" varchar(20) DEFAULT 'padrao' NOT NULL,
  "time1_id" uuid,
  "time2_id" uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "transmissoes_ativo_idx" ON "transmissoes" ("ativo");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "transmissoes_user_idx" ON "transmissoes" ("user_id");--> statement-breakpoint
