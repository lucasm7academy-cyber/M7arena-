import type { TierlistPayload } from "./types";

/**
 * Envia a resposta para a API da VPS (Node + Drizzle), nunca para o Supabase.
 * O cookie de sessão vai junto: se a pessoa estiver logada, o servidor vincula
 * o registro à conta sem exigir cadastro para quem não está.
 */
export async function submitTierlist(payload: TierlistPayload): Promise<{ id: string }> {
  const response = await fetch("/api/tierlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Não foi possível enviar (HTTP ${response.status}).`);
  }

  return data as { id: string };
}
