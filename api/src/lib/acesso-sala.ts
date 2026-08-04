/**
 * Acesso a salas para leitura sensível (prints, disputas, revisão).
 *
 * Regra do design v3 §6: prints/disputas só são visíveis para participantes da
 * sala e para revisores (admin/moderador por role, não por usuário fixo). Este
 * helper é compartilhado entre `prints.ts`, `disputas.ts` e `revisao.ts` para
 * não haver duas implementações divergentes da mesma checagem.
 */
import { eq, and } from "drizzle-orm";
import { matchPlayers } from "../../../db/schema/matches.js";
import { userRoles } from "../../../db/schema/identidade.js";

export type AcessoSala = "revisor" | "participante" | "nenhum";

/**
 * Roles de quem revisa a partida (gargalo humano sem ponto único de falha).
 * `proprietario` (dono do site) também decide — ele tem o mesmo poder do admin
 * em /admin-cargos, então não fica de fora da fila de revisão.
 */
export function eRevisor(roles: string[]): boolean {
  return (
    roles.includes("admin") ||
    roles.includes("moderador") ||
    roles.includes("proprietario")
  );
}

/** Roles do usuário em user_roles. */
export async function getRoles(db: any, userId: string): Promise<string[]> {
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r: any) => r.role);
}

/**
 * Participante confirmado ou não da sala? Para ler prints/disputas basta estar
 * na sala; para enviar print a regra exige confirmado (validado no upload).
 */
export async function eParticipante(db: any, userId: string, matchId: string): Promise<boolean> {
  const [player] = await db
    .select({ id: matchPlayers.userId })
    .from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId)))
    .limit(1);
  return Boolean(player);
}

/**
 * Quem pode ver os dados sensíveis da sala. Revisor enxerga qualquer sala;
 * participante enxerga só a própria. Ninguém mais.
 */
export async function acessoSala(db: any, userId: string, matchId: string): Promise<AcessoSala> {
  const roles = await getRoles(db, userId);
  if (eRevisor(roles)) return "revisor";
  if (await eParticipante(db, userId, matchId)) return "participante";
  return "nenhum";
}
