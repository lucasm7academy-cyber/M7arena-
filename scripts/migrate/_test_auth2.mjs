import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bfsusctegzvfrlehhink.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 250 });
if (error) {
  console.log("ERRO:", error.message);
  process.exit(1);
}
const u = data.users[0];
console.log("Chaves do user:", Object.keys(u).join(", "));
console.log("encrypted_password:", u.encrypted_password);
console.log("Total:", data.total);
