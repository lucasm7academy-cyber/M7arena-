-- 0017_vitoria_motivo_1v1
-- Motivo da vitória no modo 1v1 (win condition da partida abortada): o motor
-- decide o vencedor por 'first_blood' ou '100_cs' (ADR-039). A coluna guarda
-- o motivo para a tela da sala finalizada mostrar POR QUE o jogador venceu.
-- Nos demais modos (5v5/aram/time_vs_time) permanece NULL — a vitória vem do
-- win da Riot (nexus/surrender), sem motivo específico.
ALTER TABLE "matches" ADD COLUMN "vitoria_motivo" varchar(20);--> statement-breakpoint
