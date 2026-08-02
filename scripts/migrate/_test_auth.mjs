import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bfsusctegzvfrlehhink.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tenta ler auth.users com a service role key (schema auth)
const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 3 });
if (error) {
  console.log("ERRO admin.listUsers:", error.message);
} else {
  console.log("OK admin.listUsers total:", data.total);
  console.log(JSON.stringify(data.users[0], null, 2).slice(0, 600));
}
