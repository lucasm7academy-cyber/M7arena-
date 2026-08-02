import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bfsusctegzvfrlehhink.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "fake";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
  "profiles", "contas_riot", "wallets", "times", "time_membros",
  "time_convites", "discord_links", "campeonatos", "partidas",
  "salas", "sala_jogadores", "noticias", "highlights",
];

for (const t of TABLES) {
  const { data, error, count } = await supabase.from(t).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`${t}: ERRO ${error.code} ${error.message}`);
  } else {
    console.log(`${t}: ${count} registros`);
  }
}
