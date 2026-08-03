/**
 * Notificação Discord para revisores (design v3 §6). Disparada quando uma sala
 * apostada entra em `aguardando_revisao` — a comunidade já vive no Discord.
 * Sem `DISCORD_WEBHOOK_URL` no ambiente, é no-op com log (ausência de webhook
 * nunca pode quebrar o fluxo de dinheiro).
 */
export async function notificarRevisao(sala: {
  salaNum: number;
  apostaMc: number;
  timeANome?: string | null;
  timeBNome?: string | null;
}): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.log(`[discord] DISCORD_WEBHOOK_URL ausente — revisão da sala #${sala.salaNum} não notificada`);
    return;
  }
  const a = sala.timeANome ?? "Time A";
  const b = sala.timeBNome ?? "Time B";
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🛡️ Sala **#${sala.salaNum}** entrou em revisão — ${a} vs ${b} (${sala.apostaMc} MC). Prints enviados, aguardando decisão.`,
      }),
    });
    if (!resp.ok) console.warn(`[discord] webhook respondeu ${resp.status}`);
  } catch (e: any) {
    console.error(`[discord] webhook falhou: ${e?.message}`);
  }
}
