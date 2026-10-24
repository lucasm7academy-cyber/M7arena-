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

/**
 * Ao VINCULAR a conta Riot, promove as vagas de CONVIDADO que casam o Riot ID/
 * PUUID para vínculo de MEMBRO (`user_id`) — decisão 24/10: quem tem conta é
 * membro, não convidado (é como se já tivesse aceitado). Só promove se o
 * usuário ainda NÃO estiver em outro time (regra um time só) e não tiver vaga
 * no mesmo time. Devolve quantas vagas foram promovidas.
 */
export async function vincularVagasConvidado(
  d: any,
  userId: string,
  handle: string | null | undefined,
  puuid: string | null | undefined
): Promise<number> {
  const alvoHandle = (handle || "").trim().toLowerCase();
  if (!alvoHandle && !puuid) return 0;
  const clausulas: any[] = [];
  if (puuid) clausulas.push(eq(teamMembers.guestPuuid, puuid));
  if (alvoHandle) clausulas.push(sql`lower(trim(coalesce(${teamMembers.guestRiotId}, ''))) = ${alvoHandle}`);
  if (!clausulas.length) return 0;

  const candidatas = await d
    .select({ id: teamMembers.id, teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(isNull(teamMembers.userId), or(...clausulas)));
  if (!candidatas.length) return 0;

  const minhas = await d
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.status, "accepted")));
  const times = new Set<string>(minhas.map((m: any) => m.teamId));
  let promovidas = 0;
  for (const c of candidatas) {
    if (times.has(c.teamId)) continue; // já tem vaga neste time — não duplica
    if (times.size > 0) continue; // já está em outro time — mantém como convidado
    await d
      .update(teamMembers)
      .set({
        userId,
        guestHandle: null,
        guestRiotId: null,
        guestPuuid: null,
        guestProfileIconId: null,
        guestEloCache: null,
      })
      .where(eq(teamMembers.id, c.id));
    times.add(c.teamId);
    promovidas++;
  }
  return promovidas;
}

/**
 * Resolve um Riot ID ("Nick#TAG") para a CONTA da plataforma.
 *
 * Usado ao salvar o lineup: o capitão adiciona a pessoa pelo Riot ID; se ela
 * tem conta, a vaga é de MEMBRO (`user_id`, status accepted) — não de
 * "convidado". Decisão do usuário (24/10): quem o capitão adiciona é membro,
 * e é como se já tivesse aceitado. "Convidado" fica só para Riot ID sem conta.
 * Procura no handle da conta LoL e, sem achar, no users.riot_id.
 */
export async function resolverUserIdPorRiotId(d: any, riotId: string | null | undefined): Promise<string | null> {
  const alvo = (riotId || "").trim().toLowerCase();
  if (!alvo) return null;
  const [conta] = await d
    .select({ userId: gameAccounts.userId })
    .from(gameAccounts)
    .where(and(eq(gameAccounts.gameId, "lol"), sql`lower(trim(${gameAccounts.handle})) = ${alvo}`))
    .limit(1);
  if (conta?.userId) return conta.userId;
  const [u] = await d
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(trim(coalesce(${users.riotId}, ''))) = ${alvo}`)
    .limit(1);
  return u?.id ?? null;
}

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

/**
 * ADR-087 — um time só por jogador.
 *
 * Um jogador pode estar num time como CONVIDADO (`user_id` NULL, casado por
 * Riot ID) e em outro como vínculo real. Metade dos rosters migrados é guest,
 * então toda checagem que olha só `user_id` enxerga um mundo errado: a vaga
 * da sala negava com "você precisa participar de um time" (sala 196), o
 * `/jogador` escondia o time e o "já pertence a um time" passava batido.
 *
 * Aqui a entrada de um time limpa as saídas dos outros — nos dois
 * identificadores, para o jogador não ficar pendurado como convidado.
 */

/**
 * Remove o jogador de TODOS os times exceto `excetoTeamId`.
 *
 * Com `userId`, usa a resolução completa de membership (vínculo real E vaga de
 * convidado resolvida pelo Riot ID — caso macoinha07#fck13, que está no M7W só
 * como guest). Com só `riotId`, o Riot ID é resolvido para a conta do dono
 * (users.riot_id ou handle da conta LoL); se existir, o vínculo real também
 * sai dos outros times. Sem conta, caem só as vagas de convidado que casam o
 * Riot ID (sem depender de caixa/espaço) — nunca o vínculo real de outra
 * conta que casou por coincidência. Devolve quantas vagas foram liberadas.
 */
export async function sairDeOutrosTimes(
  d: any,
  identidade: { userId?: string | null; riotId?: string | null },
  excetoTeamId: string
): Promise<number> {
  const userId = identidade.userId || (identidade.riotId ? await resolveUserIdPorRiotId(d, identidade.riotId) : null);

  let rows: any[];
  if (userId) {
    rows = await findUserTeamMemberships(d, userId);
  } else {
    const handle = (identidade.riotId || "").trim().toLowerCase();
    if (!handle) return 0;
    const igualGuest = sql`lower(trim(coalesce(${teamMembers.guestRiotId}, ''))) = ${handle}`;
    const igualHandle = sql`lower(trim(coalesce(${teamMembers.guestHandle}, ''))) = ${handle}`;
    rows = await d
      .select({ id: teamMembers.id, teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(isNull(teamMembers.userId), or(igualGuest, igualHandle)));
  }

  const alvos = rows.filter((r: any) => r.teamId !== excetoTeamId).map((r: any) => r.id);
  if (!alvos.length) return 0;

  await d.delete(teamMembers).where(inArray(teamMembers.id, alvos));
  return alvos.length;
}

/** Riot ID ("nick#tag") -> user_id da conta, por users.riot_id ou handle da conta LoL. */
async function resolveUserIdPorRiotId(d: any, riotId: string): Promise<string | null> {
  const handle = (riotId || "").trim().toLowerCase();
  if (!handle) return null;

  const [peloUsuario] = await d
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(trim(coalesce(${users.riotId}, ''))) = ${handle}`)
    .limit(1);
  if (peloUsuario) return peloUsuario.id;

  const [pelaConta] = await d
    .select({ userId: gameAccounts.userId })
    .from(gameAccounts)
    .where(and(eq(gameAccounts.gameId, "lol"), sql`lower(trim(coalesce(${gameAccounts.handle}, ''))) = ${handle}`))
    .limit(1);
  return pelaConta?.userId ?? null;
}
