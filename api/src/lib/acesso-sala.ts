/**
 * Acesso à sala para leitura sensível (código da partida, chat, draft).
 *
 * O fluxo de revisão por prints/disputas foi removido na simplificação de
 * 2026-11; restaram apenas os helpers que as rotas ativas usam: roles do
 * usuário, staff da sala e participante. Não reintroduza aqui a checagem de
 * revisor sem um fluxo de revisão real por trás.
 */
import { eq, and } from "drizzle-orm";
import { matchPlayers } from "../../../db/schema/matches.js";
import { userRoles } from "../../../db/schema/identidade.js";

/**
 * Staff da sala (streamer/organizador/admin/proprietário). O staff pode ver o
 * código da partida e disparar a verificação mesmo sem estar na vaga — o
 * usuário quer que esses cargos consigam auditar/entrar na partida (pedido
 * 2026-08-17). `organizer`/`organizador` cobrem os dois vocabulários que já
 * aparecem em user_roles (admin.ts grava `organizer`; dados antigos usam
 * `organizador`).
 */
const ROLES_STAFF_SALA = ["proprietario", "admin", "organizer", "organizador", "streamer"];

export function eStaffSala(roles: string[]): boolean {
  return roles.some((r) => ROLES_STAFF_SALA.includes(r));
}

/** Roles do usuário em user_roles. */
export async function getRoles(db: any, userId: string): Promise<string[]> {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r: any) => r.role);
}

/** O usuário ocupa alguma vaga da sala (confirmada ou não)? */
export async function eParticipante(db: any, userId: string, matchId: string): Promise<boolean> {
  const [player] = await db
    .select({ id: matchPlayers.userId })
    .from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId)))
    .limit(1);
  return Boolean(player);
}
