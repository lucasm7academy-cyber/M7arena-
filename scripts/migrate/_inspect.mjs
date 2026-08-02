import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = "https://bfsusctegzvfrlehhink.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
  "profiles", "contas_riot", "wallets", "times", "time_membros",
  "time_convites", "discord_links", "campeonatos",
];

for (const t of TABLES) {
  const { data, error } = await supabase.from(t).select("*").limit(1);
  if (error) {
    console.log(`\n===== ${t}: ERRO ${error.code} ${error.message}`);
  } else if (data.length === 0) {
    console.log(`\n===== ${t}: VAZIA`);
  } else {
    console.log(`\n===== ${t}: colunas => ${Object.keys(data[0]).join(", ")}`);
    console.log("     exemplo =>", JSON.stringify(data[0]).slice(0, 300));
  }
}
