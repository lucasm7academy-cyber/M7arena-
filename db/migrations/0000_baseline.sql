-- Baseline M7Arena para banco novo. Nao executar manualmente em banco existente.
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "bet_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"market_key" varchar(60) NOT NULL,
	"odd" numeric(6, 3) NOT NULL,
	"stake" integer NOT NULL,
	"payout" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'aberta' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "bet_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"queue" varchar(10) NOT NULL,
	"status" varchar(30) DEFAULT 'aguardando' NOT NULL,
	"stake_total" integer DEFAULT 0 NOT NULL,
	"resultado" varchar(30),
	"summoner_id" varchar(100),
	"match_riot_id" varchar(100),
	"queue_id" integer,
	"champion_name" varchar(50),
	"champion_id" integer,
	"game_start_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);

--> statement-breakpoint
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
	"codigo_partida" text,
	"best_of" integer DEFAULT 3 NOT NULL,
	"serie_iniciada_at" timestamp,
	"irregular" boolean DEFAULT false NOT NULL,
	"resultado_riot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"streamer_id" uuid NOT NULL,
	"channel_name" varchar(100) NOT NULL,
	"title" varchar(255),
	"game_name" varchar(100),
	"is_live" boolean DEFAULT false NOT NULL,
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"thumbnail_url" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "campeonato_sala_estado" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"jogo" integer DEFAULT 1 NOT NULL,
	"pronto_blue" boolean DEFAULT false NOT NULL,
	"pronto_red" boolean DEFAULT false NOT NULL,
	"sorteio_vencedor" varchar(10),
	"escolha_time" varchar(10),
	"lado_escolhido" varchar(10),
	"pick_order_escolhido" varchar(10),
	"primeira_escolha" varchar(10),
	"formato" varchar(4) DEFAULT 'md3' NOT NULL,
	"placar_a" integer DEFAULT 0 NOT NULL,
	"placar_b" integer DEFAULT 0 NOT NULL,
	"ultimo_vencedor" varchar(1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "escalas_transmissao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escalas_transmissao_match_id_unique" UNIQUE("match_id")
);

--> statement-breakpoint
CREATE TABLE "game_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" varchar(50) NOT NULL,
	"external_id" text NOT NULL,
	"handle" varchar(100) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "games" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"video_url" text NOT NULL,
	"thumbnail_url" text,
	"author_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"categoria" varchar(50) DEFAULT 'highlight' NOT NULL
);

--> statement-breakpoint
CREATE TABLE "match_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"match_id" uuid,
	"used" boolean DEFAULT false NOT NULL,
	"mode" varchar(50),
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_codes_code_unique" UNIQUE("code")
);

--> statement-breakpoint
CREATE TABLE "match_disputas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"motivo" text NOT NULL,
	"contestacao_url" text,
	"status" varchar(20) DEFAULT 'aberta' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "match_drafts" (
	"match_id" uuid NOT NULL,
	"jogo" integer DEFAULT 1 NOT NULL,
	"blue_bans" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blue_picks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"red_bans" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"red_picks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_turn" integer DEFAULT 0 NOT NULL,
	"current_phase" varchar(10) DEFAULT 'ban' NOT NULL,
	"current_team" varchar(10) DEFAULT 'blue' NOT NULL,
	"turn_deadline_at" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'ongoing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_drafts_match_id_jogo_pk" PRIMARY KEY("match_id","jogo")
);

--> statement-breakpoint
CREATE TABLE "match_players" (
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"side" varchar(10) NOT NULL,
	"slot" integer NOT NULL,
	"role_slot" varchar(50),
	"confirmed" boolean DEFAULT false NOT NULL,
	"linked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_players_match_id_user_id_pk" PRIMARY KEY("match_id","user_id")
);

--> statement-breakpoint
CREATE TABLE "match_prints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "match_results" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"winner_side" varchar(10) NOT NULL,
	"payload" jsonb NOT NULL,
	"settled_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sala_num" integer GENERATED BY DEFAULT AS IDENTITY (sequence name "matches_sala_num_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_id" varchar(50) NOT NULL,
	"mode" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'preenchendo' NOT NULL,
	"created_by" uuid NOT NULL,
	"room_code" varchar(20),
	"winner_side" varchar(10),
	"entry_mp" integer DEFAULT 0 NOT NULL,
	"nome" text,
	"descricao" text,
	"max_jogadores" integer DEFAULT 10 NOT NULL,
	"tem_senha" boolean DEFAULT false NOT NULL,
	"senha" text,
	"elo_minimo" varchar(50),
	"time_a_nome" text,
	"time_a_tag" text,
	"time_a_logo" text,
	"time_b_nome" text,
	"time_b_tag" text,
	"time_b_logo" text,
	"codigo_partida" text,
	"vitoria_motivo" varchar(20),
	"confirmacao_expires_at" timestamp,
	"iniciando_partida_at" timestamp,
	"state_deadline_at" timestamp,
	"tournament_match_id" uuid,
	"bracket_match_id" uuid,
	"aposta_mc" integer DEFAULT 0 NOT NULL,
	"taxa_pct" numeric(5, 2) DEFAULT '8.99' NOT NULL,
	"resultado" varchar(10),
	"cancelado_em" timestamp,
	"revisado_por" uuid,
	"revisado_em" timestamp,
	"decisao_id" uuid,
	"revisao_desde" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	CONSTRAINT "matches_campeonato_link_unico" CHECK ("matches"."tournament_match_id" is null or "matches"."bracket_match_id" is null)
);

--> statement-breakpoint
CREATE TABLE "mc_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_brl" numeric(10, 2) NOT NULL,
	"base_mc" integer NOT NULL,
	"bonus_mc" integer DEFAULT 0 NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mc_packages_price_brl_unique" UNIQUE("price_brl")
);

--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"image_url" text,
	"author_id" uuid NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"categoria" varchar(50) DEFAULT 'Torneios' NOT NULL,
	"destaque" boolean DEFAULT false NOT NULL,
	"link_url" text,
	"link_texto" text,
	"autor" varchar(120),
	CONSTRAINT "news_slug_unique" UNIQUE("slug")
);

--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);

--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gateway" varchar(50) NOT NULL,
	"gateway_ref" text NOT NULL,
	"product" varchar(100) NOT NULL,
	"amount_brl" numeric(10, 2) NOT NULL,
	"mc_credit" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp
);

--> statement-breakpoint
CREATE TABLE "platform_revenue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"mc_fee" integer NOT NULL,
	"mc_fee_rounding" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
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
);

--> statement-breakpoint
CREATE TABLE "recruitment_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"role_slot" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "referral_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "sala_mensagens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"cor" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sala_mensagens_body_len" CHECK (char_length("sala_mensagens"."body") BETWEEN 1 AND 200)
);

--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid,
	"riot_id" text,
	"role" varchar(50) NOT NULL,
	"message" text,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_handle" varchar(100),
	"guest_riot_id" text,
	"guest_puuid" text,
	"guest_profile_icon_id" integer,
	"guest_elo_cache" text,
	"role_slot" varchar(50) NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	"status" varchar(50) DEFAULT 'accepted' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "team_stats" (
	"team_id" uuid NOT NULL,
	"season_id" varchar(50) DEFAULT 's1' NOT NULL,
	"pdl" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"ranking" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_stats_team_id_season_id_pk" PRIMARY KEY("team_id","season_id")
);

--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"tag" varchar(10) NOT NULL,
	"logo_url" text,
	"gradient_from" varchar(50),
	"gradient_to" varchar(50),
	"owner_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"contacts" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "tierlist_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"riot_id" varchar(100) NOT NULL,
	"puuid" varchar(100) NOT NULL,
	"game_name" varchar(100) NOT NULL,
	"tag_line" varchar(20) NOT NULL,
	"summoner_level" integer,
	"profile_icon_id" integer,
	"solo_tier" varchar(20),
	"solo_rank" varchar(5),
	"solo_lp" integer,
	"solo_wins" integer,
	"solo_losses" integer,
	"flex_tier" varchar(20),
	"flex_rank" varchar(5),
	"flex_lp" integer,
	"flex_wins" integer,
	"flex_losses" integer,
	"full_name" varchar(150) NOT NULL,
	"contact" varchar(20) NOT NULL,
	"contact_type" varchar(20) DEFAULT 'whatsapp' NOT NULL,
	"email" varchar(255),
	"discord" varchar(100),
	"primary_role" varchar(10) NOT NULL,
	"secondary_role" varchar(10),
	"availability" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"champion_pool" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"status" varchar(30) DEFAULT 'novo' NOT NULL,
	"source" varchar(30) DEFAULT 'site' NOT NULL,
	"consented_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "tournament_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL
);

--> statement-breakpoint
CREATE TABLE "tournament_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"phase" varchar(50) NOT NULL,
	"round" integer NOT NULL,
	"group_id" uuid,
	"team_a_id" uuid,
	"team_b_id" uuid,
	"score_a" integer DEFAULT 0 NOT NULL,
	"score_b" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp,
	"match_key" text,
	"phase_label" text,
	"team_a_tag" text,
	"team_b_tag" text,
	"display_date" text,
	"display_time" text,
	"score_display" text,
	"proposed_by" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"bracket_slot" varchar(50),
	"next_match_id" uuid,
	"codigo_partida" text,
	"best_of" integer DEFAULT 3 NOT NULL,
	"serie_iniciada_at" timestamp,
	"irregular" boolean DEFAULT false NOT NULL,
	"resultado_riot" jsonb,
	"sorteio_forcado" varchar(1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_matches_match_key_unique" UNIQUE("tournament_id","match_key")
);

--> statement-breakpoint
CREATE TABLE "tournament_series_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid,
	"bracket_match_id" uuid,
	"tournament_id" uuid NOT NULL,
	"game_number" integer NOT NULL,
	"winner_side" varchar(10) NOT NULL,
	"match_id_riot" text,
	"kill_a" integer DEFAULT 0 NOT NULL,
	"kill_b" integer DEFAULT 0 NOT NULL,
	"duracao_s" integer DEFAULT 0 NOT NULL,
	"irregular" boolean DEFAULT false NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
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
);

--> statement-breakpoint
CREATE TABLE "tournament_teams" (
	"tournament_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'registered' NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"discord" text,
	"whatsapp" text,
	"group_id" uuid,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_teams_tournament_id_team_id_pk" PRIMARY KEY("tournament_id","team_id")
);

--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" varchar(50) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"name" varchar(255) NOT NULL,
	"format" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"organizer_id" uuid NOT NULL,
	"prize" jsonb DEFAULT '{}'::jsonb,
	"registration_opens_at" timestamp,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"frase" text,
	"logo_url" text,
	"banner_url" text,
	"org_photo_url" text,
	"theme_color" varchar(20),
	"regulamento" text,
	"vagas" integer DEFAULT 0 NOT NULL,
	"times_por_grupo" integer,
	"classificados_por_grupo" integer,
	"tier" varchar(50),
	"data" text,
	"premiacao" text,
	"taxa" text,
	"tem_outros_premios" boolean DEFAULT false NOT NULL,
	"outros_premios" text,
	"organizacao" varchar(255),
	"seed_order" text[],
	"grupos_sorteados" boolean DEFAULT false NOT NULL,
	"chaves_sorteados" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_slug_unique" UNIQUE("slug")
);

--> statement-breakpoint
CREATE TABLE "transmissoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"twitch_channel" varchar(100) NOT NULL,
	"titulo" text,
	"campeonato_id" uuid,
	"duracao_horas" integer DEFAULT 1 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"expira_em" timestamp,
	"modo" varchar(20) DEFAULT 'padrao' NOT NULL,
	"time1_id" uuid,
	"time2_id" uuid,
	"match_id" uuid,
	"sala_id" uuid
);

--> statement-breakpoint
CREATE TABLE "user_advertencias" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"criado_por" uuid,
	"match_id" uuid,
	"motivo" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"removido_por" uuid,
	"removido_em" timestamp,
	CONSTRAINT "user_strikes_pkey" PRIMARY KEY("id")
);

--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "user_payout_info" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"pix_type" varchar(50) NOT NULL,
	"pix_key" text NOT NULL,
	"pix_name" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);

--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token")
);

--> statement-breakpoint
CREATE TABLE "user_wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"mp" integer DEFAULT 0 NOT NULL,
	"mc" integer DEFAULT 0 NOT NULL,
	"mc_reservado" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp,
	"password_hash" text,
	"display_name" varchar(100) NOT NULL,
	"avatar_url" text,
	"bio" text,
	"socials" jsonb DEFAULT '{}'::jsonb,
	"lane_primary" varchar(20),
	"lane_secondary" varchar(20),
	"riot_id" varchar(100),
	"suspensa_ate" timestamp,
	"termos_aceitos_em" timestamp,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"banido_por" uuid,
	"banido_em" timestamp,
	"ban_motivo" text,
	"ban_automatico" boolean DEFAULT false NOT NULL,
	"is_vip" boolean DEFAULT false NOT NULL,
	"vip_expires_at" timestamp,
	"referred_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"currency" varchar(10) NOT NULL,
	"amount" integer NOT NULL,
	"kind" varchar(50) NOT NULL,
	"ref_type" varchar(50),
	"ref_id" text,
	"balance_after" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mc_amount" integer NOT NULL,
	"amount_brl" numeric(10, 2) NOT NULL,
	"pix_type" varchar(50) NOT NULL,
	"pix_key" text NOT NULL,
	"pix_name" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"admin_id" uuid,
	"decision_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp
);

--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_ticket_id_bet_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."bet_tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bet_tickets" ADD CONSTRAINT "bet_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_streamer_id_users_id_fk" FOREIGN KEY ("streamer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "campeonato_sala_estado" ADD CONSTRAINT "campeonato_sala_estado_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "escalas_transmissao" ADD CONSTRAINT "escalas_transmissao_match_id_tournament_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "escalas_transmissao" ADD CONSTRAINT "escalas_transmissao_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_accounts" ADD CONSTRAINT "game_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_accounts" ADD CONSTRAINT "game_accounts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "match_codes" ADD CONSTRAINT "match_codes_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "match_disputas" ADD CONSTRAINT "match_disputas_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "match_disputas" ADD CONSTRAINT "match_disputas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "match_drafts" ADD CONSTRAINT "match_drafts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "match_prints" ADD CONSTRAINT "match_prints_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "match_prints" ADD CONSTRAINT "match_prints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_match_id_tournament_matches_id_fk" FOREIGN KEY ("tournament_match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_bracket_match_id_bracket_matches_id_fk" FOREIGN KEY ("bracket_match_id") REFERENCES "public"."bracket_matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_revisado_por_users_id_fk" FOREIGN KEY ("revisado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recruitment_posts" ADD CONSTRAINT "recruitment_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_referred_id_users_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sala_mensagens" ADD CONSTRAINT "sala_mensagens_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sala_mensagens" ADD CONSTRAINT "sala_mensagens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_stats" ADD CONSTRAINT "team_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tierlist_submissions" ADD CONSTRAINT "tierlist_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_groups" ADD CONSTRAINT "tournament_groups_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_group_id_tournament_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_next_match_id_tournament_matches_id_fk" FOREIGN KEY ("next_match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_series_games" ADD CONSTRAINT "tournament_series_games_match_id_tournament_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_series_games" ADD CONSTRAINT "tournament_series_games_bracket_match_id_bracket_matches_id_fk" FOREIGN KEY ("bracket_match_id") REFERENCES "public"."bracket_matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_series_games" ADD CONSTRAINT "tournament_series_games_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_standings" ADD CONSTRAINT "tournament_standings_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_standings" ADD CONSTRAINT "tournament_standings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_group_id_tournament_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transmissoes" ADD CONSTRAINT "transmissoes_match_id_tournament_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transmissoes" ADD CONSTRAINT "transmissoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transmissoes" ADD CONSTRAINT "transmissoes_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_advertencias" ADD CONSTRAINT "user_advertencias_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_advertencias" ADD CONSTRAINT "user_advertencias_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_advertencias" ADD CONSTRAINT "user_advertencias_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_advertencias" ADD CONSTRAINT "user_advertencias_removido_por_users_id_fk" FOREIGN KEY ("removido_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_payout_info" ADD CONSTRAINT "user_payout_info_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_banido_por_users_id_fk" FOREIGN KEY ("banido_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_users_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");
--> statement-breakpoint
CREATE INDEX "audit_created_at_idx" ON "audit_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "bet_legs_ticket_idx" ON "bet_legs" USING btree ("ticket_id");
--> statement-breakpoint
CREATE INDEX "bet_tickets_user_idx" ON "bet_tickets" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "bet_tickets_status_idx" ON "bet_tickets" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "bracket_matches_cell_idx" ON "bracket_matches" USING btree ("tournament_id","section","round","slot");
--> statement-breakpoint
CREATE INDEX "bracket_matches_tournament_idx" ON "bracket_matches" USING btree ("tournament_id");
--> statement-breakpoint
CREATE INDEX "broadcasts_is_live_idx" ON "broadcasts" USING btree ("is_live");
--> statement-breakpoint
CREATE INDEX "escalas_transmissao_user_idx" ON "escalas_transmissao" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_game_idx" ON "game_accounts" USING btree ("user_id","game_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "game_external_id_idx" ON "game_accounts" USING btree ("game_id","external_id");
--> statement-breakpoint
CREATE INDEX "highlights_active_idx" ON "highlights" USING btree ("active");
--> statement-breakpoint
CREATE INDEX "disputas_match_idx" ON "match_disputas" USING btree ("match_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_disputas_match_user" ON "match_disputas" USING btree ("match_id","user_id");
--> statement-breakpoint
CREATE INDEX "match_players_user_idx" ON "match_players" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "prints_match_idx" ON "match_prints" USING btree ("match_id");
--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "matches_game_idx" ON "matches" USING btree ("game_id");
--> statement-breakpoint
CREATE INDEX "matches_created_by_idx" ON "matches" USING btree ("created_by");
--> statement-breakpoint
CREATE UNIQUE INDEX "matches_sala_num_unique" ON "matches" USING btree ("sala_num");
--> statement-breakpoint
CREATE INDEX "idx_matches_status_updated" ON "matches" USING btree ("status","updated_at");
--> statement-breakpoint
CREATE INDEX "idx_matches_revisao" ON "matches" USING btree ("status","revisao_desde") WHERE "matches"."status" = 'aguardando_revisao';
--> statement-breakpoint
CREATE INDEX "matches_tournament_match_idx" ON "matches" USING btree ("tournament_match_id");
--> statement-breakpoint
CREATE INDEX "matches_bracket_match_idx" ON "matches" USING btree ("bracket_match_id");
--> statement-breakpoint
CREATE INDEX "mc_packages_active_idx" ON "mc_packages" USING btree ("active","sort_order");
--> statement-breakpoint
CREATE INDEX "news_slug_idx" ON "news" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "news_published_idx" ON "news" USING btree ("published");
--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read");
--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "player_stats_user_idx" ON "player_stats" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "recruitment_type_idx" ON "recruitment_posts" USING btree ("type");
--> statement-breakpoint
CREATE INDEX "recruitment_active_idx" ON "recruitment_posts" USING btree ("active");
--> statement-breakpoint
CREATE INDEX "referral_referrer_idx" ON "referral_events" USING btree ("referrer_id");
--> statement-breakpoint
CREATE INDEX "referral_referred_idx" ON "referral_events" USING btree ("referred_id");
--> statement-breakpoint
CREATE INDEX "sala_mensagens_match_id_id_idx" ON "sala_mensagens" USING btree ("match_id","id");
--> statement-breakpoint
CREATE INDEX "sala_mensagens_created_at_idx" ON "sala_mensagens" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "team_invites_team_idx" ON "team_invites" USING btree ("team_id");
--> statement-breakpoint
CREATE INDEX "team_invites_from_user_idx" ON "team_invites" USING btree ("from_user_id");
--> statement-breakpoint
CREATE INDEX "team_invites_to_user_idx" ON "team_invites" USING btree ("to_user_id");
--> statement-breakpoint
CREATE INDEX "team_members_team_idx" ON "team_members" USING btree ("team_id");
--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "team_stats_ranking_idx" ON "team_stats" USING btree ("season_id","pdl");
--> statement-breakpoint
CREATE INDEX "teams_game_idx" ON "teams" USING btree ("game_id");
--> statement-breakpoint
CREATE INDEX "teams_owner_idx" ON "teams" USING btree ("owner_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "teams_game_tag_idx" ON "teams" USING btree ("game_id","tag");
--> statement-breakpoint
CREATE UNIQUE INDEX "tierlist_submissions_puuid_idx" ON "tierlist_submissions" USING btree ("puuid");
--> statement-breakpoint
CREATE INDEX "tierlist_submissions_created_idx" ON "tierlist_submissions" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "tierlist_submissions_status_idx" ON "tierlist_submissions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "tournament_matches_tournament_idx" ON "tournament_matches" USING btree ("tournament_id");
--> statement-breakpoint
CREATE INDEX "tournament_matches_group_idx" ON "tournament_matches" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX "tournament_matches_scheduled_idx" ON "tournament_matches" USING btree ("tournament_id","phase","scheduled_at");
--> statement-breakpoint
CREATE INDEX "tournament_matches_match_key_idx" ON "tournament_matches" USING btree ("match_key");
--> statement-breakpoint
CREATE INDEX "tournament_series_games_match_idx" ON "tournament_series_games" USING btree ("match_id");
--> statement-breakpoint
CREATE INDEX "tournament_series_games_bracket_idx" ON "tournament_series_games" USING btree ("bracket_match_id");
--> statement-breakpoint
CREATE INDEX "tournament_series_games_tournament_idx" ON "tournament_series_games" USING btree ("tournament_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_standings_team_idx" ON "tournament_standings" USING btree ("tournament_id","team_id");
--> statement-breakpoint
CREATE INDEX "tournament_standings_rank_idx" ON "tournament_standings" USING btree ("tournament_id","rank");
--> statement-breakpoint
CREATE INDEX "tournament_teams_team_idx" ON "tournament_teams" USING btree ("team_id");
--> statement-breakpoint
CREATE INDEX "tournament_teams_group_idx" ON "tournament_teams" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX "tournaments_slug_idx" ON "tournaments" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "tournaments_status_idx" ON "tournaments" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "tournaments_game_idx" ON "tournaments" USING btree ("game_id");
--> statement-breakpoint
CREATE INDEX "transmissoes_ativo_idx" ON "transmissoes" USING btree ("ativo");
--> statement-breakpoint
CREATE INDEX "transmissoes_user_idx" ON "transmissoes" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "transmissoes_match_idx" ON "transmissoes" USING btree ("match_id");
--> statement-breakpoint
CREATE INDEX "advertencias_user_recentes_idx" ON "user_advertencias" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_account_idx" ON "user_identities" USING btree ("provider","provider_account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_riot_id" ON "users" USING btree (lower("riot_id")) WHERE "users"."riot_id" is not null;
--> statement-breakpoint
CREATE INDEX "wallet_tx_user_idx" ON "wallet_transactions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "wallet_tx_created_at_idx" ON "wallet_transactions" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ledger_match_unico" ON "wallet_transactions" USING btree ("ref_id","user_id","kind") WHERE "wallet_transactions"."kind" in ('match_prize'::varchar, 'match_loss'::varchar) and "wallet_transactions"."ref_type" = 'match';
--> statement-breakpoint
CREATE INDEX "withdrawals_user_idx" ON "withdrawals" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "withdrawals_status_idx" ON "withdrawals" USING btree ("status");
--> statement-breakpoint
INSERT INTO "games" ("id", "name", "active")
VALUES ('lol', 'League of Legends', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "mc_packages" ("price_brl", "base_mc", "bonus_mc", "is_popular", "active", "sort_order")
VALUES
  ('5.00', 500, 0, false, true, 1),
  ('10.00', 1000, 0, false, true, 2),
  ('20.00', 2000, 0, false, true, 3),
  ('50.00', 5000, 300, true, true, 4),
  ('100.00', 10000, 600, false, true, 5),
  ('200.00', 20000, 1200, false, true, 6)
ON CONFLICT ("price_brl") DO NOTHING;
