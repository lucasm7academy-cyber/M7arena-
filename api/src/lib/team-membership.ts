import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "../../../db/schema/identidade.js";
import { gameAccounts } from "../../../db/schema/games.js";
import { teamMembers } from "../../../db/schema/teams.js";

/**
 * ADR-056 — participação no time de convidado sem conta.
 *
 * O roster pode ter vagas de convidado (guest_*) sem user_id: não é obrigatório
 * ter os 8 jogadores cadastrados. O front só conhece o time do usuário via
 * team_members.user_id, então quem estava como convidado mas tinha conta
 * vinculada ficava de fora — não via o botão Iniciar Série nem o Copiar Código,
 * e o servidor negava a série com 403. Aqui a vaga é resolvida pelo vínculo
 * Riot da conta: PUUID (estável a mudança de nick) e Riot ID (fallback).
 */

export type RiotIdentities = {
  puuids: string[];
  handles: string[];
};

type TeamMemberRow = typeof teamMembers.$inferSelect;

/** Identidades Riot da conta do usuário: PUUID e Riot ID (handle/users.riot_id). */
export async function getRiotIdentities(d: any, userId: string): Promise<RiotIdentities> {
  const [user] = await d
    .select({ riotId: users.riotId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const accounts = await d
    .select({ externalId: gameAccounts.externalId, handle: gameAccounts.handle })
    .from(gameAccounts)
    .where(and(eq(gameAccounts.userId, userId), eq(gameAccounts.gameId, "lol")));

  const puuids = new Set<string>();
  const handles = new Set<string>();
  for (const conta of accounts) {
    if (conta.externalId) puuids.add(conta.externalId);
    const handle = (conta.handle || "").trim().toLowerCase();
    if (handle) handles.add(handle);
  }
  const riotId = (user?.riotId || "").trim().toLowerCase();
  if (riotId) handles.add(riotId);

  return { puuids: [...puuids], handles: [...handles] };
}

/**
 * Vagas do usuário nos times: por user_id OU por vínculo Riot na vaga de
 * convidado (guest_puuid/guest_riot_id/guest_handle). `onlyAccepted` limita às
 * aceitas — a permissão de série exige aceito; o shape do front aceita
 * qualquer status. Vagas com user_id vêm primeiro para o front preferir o
 * vínculo real quando o usuário for convidado em um time e membro de outro.
 */
export async function findUserTeamMemberships(
  d: any,
  userId: string,
  opts: { teamIds?: string[]; onlyAccepted?: boolean } = {}
): Promise<TeamMemberRow[]> {
  const { puuids, handles } = await getRiotIdentities(d, userId);

  const guestClauses: any[] = [];
  if (puuids.length) guestClauses.push(inArray(teamMembers.guestPuuid, puuids));
  for (const handle of handles) {
    guestClauses.push(sql`lower(trim(coalesce(${teamMembers.guestRiotId}, ''))) = ${handle}`);
    guestClauses.push(sql`lower(trim(coalesce(${teamMembers.guestHandle}, ''))) = ${handle}`);
  }

  const identityClauses: any[] = [eq(teamMembers.userId, userId)];
  if (guestClauses.length) {
    identityClauses.push(and(isNull(teamMembers.userId), or(...guestClauses)));
  }

  const filters: any[] = [or(...identityClauses)];
  if (opts.onlyAccepted) filters.push(eq(teamMembers.status, "accepted"));
  if (opts.teamIds?.length) filters.push(inArray(teamMembers.teamId, opts.teamIds));

  return d
    .select()
    .from(teamMembers)
    .where(and(...filters))
    .orderBy(sql`(${teamMembers.userId} IS NULL) ASC`);
}
