ALTER TABLE "transmissoes" ADD COLUMN "sala_id" uuid REFERENCES "matches"("id") ON DELETE CASCADE;
