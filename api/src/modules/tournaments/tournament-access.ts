/**
 * tournament-access.ts — quem vê e quem usa o código de uma série (sec.codigo-campeonato).
 *
 * O `codigo_partida` de uma série vale o confronto inteiro (MD3/MD5): exposto a
 * qualquer visitante, permitia que um estranho entrasse no lobby do jogo. A
 * regra espelha as salas (ADR-043) e o botão Iniciar Série (ADR-056): enxerga o
 * código quem é STAFF (organizador do campeonato, admin, proprietário,
 * moderador, organizer) ou quem joga a SÉRIE — dono do time, membro aceito,
 * inclusive vaga de convidado reconhecida pelo vínculo Riot.
 */
import { and, eq, inArray } from "drizzle-orm";
import { userRoles } from "../../../../db/schema/identidade.js";
import { teams, teamMembers } from "../../../../db/schema/teams.js";
import { tournamentTeams } from "../../../../db/schema/tournaments.js";
import { findUserTeamMemberships } from "../teams/team-membership.js";

export const STAFF_ROLES_CAMPEONATO = ["admin", "proprietario", "moderador", "organizer"];

export type IdentidadeAcesso = {
  isStaffRole: boolean;
  /** Times do usuário: dono OU membro aceito (inclui convidado por vínculo Riot). */
  teamIds: Set<string>;
};

/** Identidade de acesso do usuário: cargos globais + times (dono/membro aceito). */
export async function identidadeAcessoCampeonato(d: any, userId: string): Promise<IdentidadeAcesso> {
  const roleRows = await d
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  const isStaffRole = roleRows.some((r: any) => STAFF_ROLES_CAMPEONATO.includes(r.role));

  const [memberships, owned] = await Promise.all([
    findUserTeamMemberships(d, userId, { onlyAccepted: true }),
    d.select({ id: teams.id }).from(teams).where(eq(teams.ownerId, userId)),
  ]);

  const teamIds = new Set<string>();
  for (const m of memberships) if (m?.teamId) teamIds.add(m.teamId);
  for (const o of owned) teamIds.add(o.id);

  return { isStaffRole, teamIds };
}

/**
 * Permissão de ESCRITA no campeonato: organizador dono ou cargo staff global
 * (admin/proprietário/moderador/organizer). Usada por edição, cronograma,
 * inscrições, PDL, reabertura e aprovação de times.
 */
export async function podeGerenciarCampeonato(
  d: any,
  opts: { userId?: string | null; organizerId?: string | null }
): Promise<boolean> {
  if (!opts.userId) return false;
  if (opts.organizerId && opts.organizerId === opts.userId) return true;

  const roleRows = await d
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, opts.userId));
  return roleRows.some((r: any) => STAFF_ROLES_CAMPEONATO.includes(r.role));
}

/** Acesso no contexto de um campeonato: cargo staff OU ser o organizador dele. */
export function acessoNoCampeonato(
  ident: IdentidadeAcesso | null,
  opts: { userId?: string | null; organizerId?: string | null }
) {
  const staff =
    !!ident?.isStaffRole || (!!opts.userId && !!opts.organizerId && opts.organizerId === opts.userId);
  return { staff, teamIds: ident?.teamIds ?? new Set<string>() };
}

/**
 * Redige (`codigo_partida: null`) as séries que o espectador NÃO joga.
 * Muta o shape recém-construído (uma cópia por resposta) e o devolve.
 * Série com tag fora de `times_inscritos` fica redigida — conservador.
 */
export function redigirCodigosDaSerie(legacy: any, acesso: { staff: boolean; teamIds: Set<string> }) {
  if (!legacy || acesso.staff) return legacy;

  const tagToTeam = new Map<string, string>();
  for (const inscrito of legacy.times_inscritos || []) {
    if (inscrito?.tag && inscrito?.id) {
      tagToTeam.set(String(inscrito.tag).trim().toLowerCase(), String(inscrito.id));
    }
  }

  const jogaASerie = (tag?: unknown) => {
    if (!tag) return false;
    const teamId = tagToTeam.get(String(tag).trim().toLowerCase());
    return !!teamId && acesso.teamIds.has(teamId);
  };

  const percorrer = (node: any) => {
    if (Array.isArray(node)) {
      for (const item of node) percorrer(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (node.codigo_partida != null) {
      const timeA = node.timeA || node.t1;
      const timeB = node.timeB || node.t2;
      if (!jogaASerie(timeA) && !jogaASerie(timeB)) node.codigo_partida = null;
    }
    for (const key of Object.keys(node)) percorrer(node[key]);
  };

  percorrer(legacy.cronograma);
  percorrer(legacy.bracket_data);
  return legacy;
}

/**
 * Devolve "A" | "B" | null: o lado da série a que o usuário pertence (dono ou
 * membro aceito do time A/B). Usado para liberar propostas/aceites de cronograma
 * a qualquer integrante do time, sem dar poderes de staff.
 */
export async function timeDoUsuarioNaSerie(
  d: any,
  userId: string,
  serie: { teamAId?: string | null; teamBId?: string | null; teamATag?: string | null; teamBTag?: string | null }
): Promise<"A" | "B" | null> {
  const ident = await identidadeAcessoCampeonato(d, userId);
  let aId = serie.teamAId ?? null;
  let bId = serie.teamBId ?? null;
  if (!aId && serie.teamATag) {
    const [t] = await d.select({ id: teams.id }).from(teams).where(eq(teams.tag, serie.teamATag)).limit(1);
    aId = t?.id ?? null;
  }
  if (!bId && serie.teamBTag) {
    const [t] = await d.select({ id: teams.id }).from(teams).where(eq(teams.tag, serie.teamBTag)).limit(1);
    bId = t?.id ?? null;
  }
  if (aId && ident.teamIds.has(aId)) return "A";
  if (bId && ident.teamIds.has(bId)) return "B";
  return null;
}

/** Permissão para iniciar/verificar a série — mesma regra do botão Iniciar Série. */
export async function resolverPermissaoSerie(
  d: any,
  opts: { userId: string; organizerId?: string | null; tournamentId: string; serie: any; permitirStreamer?: boolean }
): Promise<{ isStaff: boolean; isParticipant: boolean }> {
  const roleRows = await d
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, opts.userId));
  const rolesStaff = opts.permitirStreamer
    ? [...STAFF_ROLES_CAMPEONATO, "streamer"]
    : STAFF_ROLES_CAMPEONATO;
  const isStaff =
    opts.organizerId === opts.userId ||
    roleRows.some((r: any) => rolesStaff.includes(r.role));
  if (isStaff) return { isStaff: true, isParticipant: false };

  // Resolve os times da série (se não preenchidos, tenta pelas tags do snapshot).
  let teamAId = opts.serie.teamAId;
  let teamBId = opts.serie.teamBId;

  if (!teamAId || !teamBId) {
    const teamRows = await d
      .select({ id: teams.id, tag: teams.tag })
      .from(teams)
      .innerJoin(tournamentTeams, eq(tournamentTeams.teamId, teams.id))
      .where(eq(tournamentTeams.tournamentId, opts.tournamentId));

    if (!teamAId && opts.serie.teamATag) {
      teamAId = teamRows.find((r: any) => r.tag.toLowerCase() === opts.serie.teamATag?.toLowerCase())?.id ?? null;
    }
    if (!teamBId && opts.serie.teamBTag) {
      teamBId = teamRows.find((r: any) => r.tag.toLowerCase() === opts.serie.teamBTag?.toLowerCase())?.id ?? null;
    }
  }

  const relevantTeamIds = [teamAId, teamBId].filter(Boolean) as string[];
  if (!relevantTeamIds.length) return { isStaff: false, isParticipant: false };

  const [owned] = await d
    .select({ id: teams.id })
    .from(teams)
    .where(and(inArray(teams.id, relevantTeamIds), eq(teams.ownerId, opts.userId)))
    .limit(1);
  if (owned) return { isStaff: false, isParticipant: true };

  // Qualquer membro aceito do time da série (titular, reserva ou coach) pode
  // disparar a verificação. A checagem direta por user_id cobre o caso em que
  // a vaga é real; o fallback abaixo cobre convidado reconhecido por PUUID.
  const [membro] = await d
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(
      inArray(teamMembers.teamId, relevantTeamIds),
      eq(teamMembers.userId, opts.userId),
      eq(teamMembers.status, "accepted")
    ))
    .limit(1);
  if (membro) return { isStaff: false, isParticipant: true };

  const memberships = await findUserTeamMemberships(d, opts.userId, {
    teamIds: relevantTeamIds,
    onlyAccepted: true,
  });
  return { isStaff: false, isParticipant: memberships.length > 0 };
}
