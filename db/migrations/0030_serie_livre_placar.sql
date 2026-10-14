ALTER TABLE "campeonato_sala_estado" ADD COLUMN "placar_a" integer DEFAULT 0 NOT NULL;
ALTER TABLE "campeonato_sala_estado" ADD COLUMN "placar_b" integer DEFAULT 0 NOT NULL;
ALTER TABLE "campeonato_sala_estado" ADD COLUMN "ultimo_vencedor" varchar(1);
