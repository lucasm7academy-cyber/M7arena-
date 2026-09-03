import { notifications } from "../../../db/schema/conteudo.js";

/**
 * notifications.ts — gravação de notificações do usuário (tabela `notifications`).
 *
 * É a única porta de escrita das notificações do sino. O chamador (ex.: cron de
 * liquidação de aposta) passa apenas o essencial; o `payload` é um JSONB opaco
 * para o front não precisar entender o domínio de cada tipo. A leitura/marcação
 * de lida vive em routes/notifications.ts.
 *
 * Segurança: nunca exponha PII nem dado sensível no `message` — ele é
 * renderizado cru no sino. O `id`/`userId` são controlados pelo servidor.
 */

export type NotificationType = "bet" | "wallet" | "match" | "team" | "system" | "tournament";

export interface CriarNotificacaoInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
}

/**
 * Cria uma notificação. `db` pode ser a conexão ou uma transação (`tx`) do
 * Drizzle — o chamador decide a atomicidade. Retorna o id gerado.
 */
export async function criarNotificacao(db: any, input: CriarNotificacaoInput): Promise<string | null> {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      payload: input.payload ?? {},
    })
    .returning({ id: notifications.id });

  return row?.id ?? null;
}
