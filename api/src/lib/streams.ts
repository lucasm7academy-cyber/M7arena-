// api/src/lib/streams.ts
// Regras das transmissões (spec 2026-09-29): agenda de jogos de campeonato
// (pegar vaga, entrar no ar) e consultas da vitrine/painel com o vínculo
// live ↔ jogo. As rotas só autenticam e mapeiam erro → HTTP; o que decide
// fica aqui, testável com PGlite (api/test/streams.test.ts).
import { and, eq, gt, inArray, isNotNull, isNull, not, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { users, userRoles } from "../../../db/schema/identidade.js";
import { teams } from "../../../db/schema/teams.js";
import { tournaments, tournamentMatches } from "../../../db/schema/tournaments.js";
import { escalasTransmissao, transmissoes } from "../../../db/schema/conteudo.js";
import { STATUS_JOGO_FINALIZADO } from "./transmissoes.js";

export const TZ_TRANSMISSAO = "America/Sao_Paulo";
export const JANELA_ANTES_MS = 30 * 60 * 1000;
const ATRASO_MAX_MS = 2 * 60 * 60 * 1000;
const LIMITE_AGENDA = 50;

export type Resultado<T = {}> = ({ ok: true } & T) | { ok: false; erro: string };

/** Shape legado do front + match_id (rotas antigas de /streams). */
export function toLegacyTransmissao(t: any) {
  return {
    id: t.id,
    user_id: t.userId,
    twitch_channel: t.twitchChannel,
    titulo: t.titulo,
    campeonato_id: t.campeonatoId,
    duracao_horas: t.duracaoHoras,
    ativo: t.ativo,
    criado_em: t.criadoEm ? new Date(t.criadoEm).toISOString() : null,
    expira_em: t.expiraEm ? new Date(t.expiraEm).toISOString() : null,
    modo: t.modo,
    time1_id: t.time1Id,
    time2_id: t.time2Id,
    match_id: t.matchId ?? null,
  };
}

/** Data "YYYY-MM-DD" no fuso de São Paulo. */
export function diaSP(dt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_TRANSMISSAO, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(dt);
}

/** Instante UTC do jogo: display_date/display_time são hora local de SP. */
export function instanteJogo(
  data: string | null | undefined,
  hora: string | null | undefined
): Date | null {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  if (!hora || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const d = new Date(`${data}T${hora}:00-03:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** Label do dia para exibição: HOJE | AMANHÃ | "30 SET". */
export function dataLabelSP(data: string, agora: Date = new Date()): string {
  const d = new Date(`${data}T12:00:00-03:00`);
  if (diaSP(d) === diaSP(agora)) return "HOJE";
  if (diaSP(d) === diaSP(new Date(agora.getTime() + 24 * 60 * 60 * 1000))) return "AMANHÃ";
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ_TRANSMISSAO, day: "2-digit" }).format(d);
  const mes = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ_TRANSMISSAO, month: "short" })
    .format(d).replace(".", "").toUpperCase();
  return `${dia} ${mes}`;
}

/** Título no formato do painel: "<campeonato>\n<TAG_A> x <TAG_B>". */
export function montarTituloJogo(
  campeonato: string | null | undefined,
  tagA: string | null | undefined,
  tagB: string | null | undefined
): string {
  const confronto = `${tagA || "TBD"} x ${tagB || "TBD"}`;
  return campeonato ? `${campeonato}\n${confronto}` : confronto;
}

/** Jogo entra na agenda? (confirmado com horário até 2h atrás, ou em andamento) */
export function jogoNaAgenda(jogo: any, agora: Date = new Date()): boolean {
  if (STATUS_JOGO_FINALIZADO.includes(jogo.status)) return false;
  if (jogo.status === "em_andamento") return true;
  if (jogo.status !== "confirmado") return false;
  const instante = instanteJogo(jogo.displayDate, jogo.displayTime);
  return !!instante && instante.getTime() >= agora.getTime() - ATRASO_MAX_MS;
}

/** Janela do "Estou no ar": em andamento ou 30 min antes do horário. */
export function dentroDaJanela(jogo: any, agora: Date = new Date()): boolean {
  if (jogo.status === "em_andamento") return true;
  const instante = instanteJogo(jogo.displayDate, jogo.displayTime);
  if (!instante) return false;
  return agora.getTime() >= instante.getTime() - JANELA_ANTES_MS;
}

/** Cargo streamer + twitch no perfil (mesma regra do POST /streams). */
export async function validarStreamer(d: any, userId: string): Promise<Resultado<{ twitch: string }>> {
  const roles = await d.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  if (!roles.some((r: any) => r.role === "streamer")) return { ok: false, erro: "sem_cargo_streamer" };
  const [u] = await d.select({ socials: users.socials }).from(users).where(eq(users.id, userId)).limit(1);
  const twitch = (u?.socials as Record<string, string> | null)?.["twitch"] ?? "";
  if (!twitch) return { ok: false, erro: "sem_twitch_no_perfil" };
  return { ok: true, twitch };
}

async function carregarJogoDaAgenda(d: any, matchId: string) {
  const [jogo] = await d.select().from(tournamentMatches).where(eq(tournamentMatches.id, matchId)).limit(1);
  if (!jogo) return null;
  const [camp] = await d
    .select({ id: tournaments.id, nome: tournaments.name })
    .from(tournaments).where(eq(tournaments.id, jogo.tournamentId)).limit(1);
  return { jogo, camp };
}

/** Jogos agendáveis + streamer escalado + flags da sessão. */
export async function listarAgenda(d: any, opts: { userId?: string | null; agora?: Date } = {}) {
  const agora = opts.agora ?? new Date();
  const timeA = alias(teams, "time_a");
  const timeB = alias(teams, "time_b");

  const rows = await d
    .select({
      m: tournamentMatches,
      campNome: tournaments.name,
      campCor: tournaments.themeColor,
      aId: timeA.id, aTag: timeA.tag, aNome: timeA.name, aLogo: timeA.logoUrl, aCor: timeA.gradientFrom,
      bId: timeB.id, bTag: timeB.tag, bNome: timeB.name, bLogo: timeB.logoUrl, bCor: timeB.gradientFrom,
      escalaUserId: escalasTransmissao.userId,
      streamerNome: users.displayName,
      streamerSocials: users.socials,
      txId: transmissoes.id,
      txUserId: transmissoes.userId,
    })
    .from(tournamentMatches)
    .innerJoin(tournaments, eq(tournamentMatches.tournamentId, tournaments.id))
    .leftJoin(timeA, eq(tournamentMatches.teamAId, timeA.id))
    .leftJoin(timeB, eq(tournamentMatches.teamBId, timeB.id))
    .leftJoin(escalasTransmissao, eq(escalasTransmissao.matchId, tournamentMatches.id))
    .leftJoin(users, eq(escalasTransmissao.userId, users.id))
    .leftJoin(transmissoes, and(eq(transmissoes.matchId, tournamentMatches.id), eq(transmissoes.ativo, true)))
    .where(or(eq(tournamentMatches.status, "em_andamento"), eq(tournamentMatches.status, "confirmado")));

  const agenda = rows
    .filter((r: any) => jogoNaAgenda(r.m, agora))
    .sort((a: any, b: any) => {
      const ia = instanteJogo(a.m.displayDate, a.m.displayTime)?.getTime() ?? Infinity;
      const ib = instanteJogo(b.m.displayDate, b.m.displayTime)?.getTime() ?? Infinity;
      return ia - ib;
    })
    .slice(0, LIMITE_AGENDA);

  let isStreamerComTwitch = false;
  let isStaff = false;
  if (opts.userId) {
    const roles = await d.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, opts.userId));
    const roleNames = roles.map((r: any) => r.role);
    isStaff = roleNames.some((r: string) => ["admin", "proprietario", "moderador", "organizer"].includes(r));
    if (roleNames.includes("streamer")) {
      const [u] = await d.select({ socials: users.socials }).from(users).where(eq(users.id, opts.userId)).limit(1);
      isStreamerComTwitch = !!(u?.socials as Record<string, string> | null)?.["twitch"];
    }
  }

  return agenda.map((r: any) => {
    const meu = !!opts.userId && r.escalaUserId === opts.userId;
    return {
      match_id: r.m.id,
      tournament_id: r.m.tournamentId,
      campeonato: { id: r.m.tournamentId, titulo: r.campNome, cor: r.campCor ?? "#FFB700" },
      fase: r.m.phaseLabel || r.m.phase,
      time_a: r.aId ? { id: r.aId, tag: r.aTag, nome: r.aNome, logo: r.aLogo, cor: r.aCor } : null,
      time_b: r.bId ? { id: r.bId, tag: r.bTag, nome: r.bNome, logo: r.bLogo, cor: r.bCor } : null,
      data: r.m.displayDate,
      hora: r.m.displayTime,
      data_label: r.m.displayDate ? dataLabelSP(r.m.displayDate, agora) : null,
      status: r.m.status,
      ao_vivo: !!r.txId,
      streamer: r.escalaUserId
        ? {
            user_id: r.escalaUserId,
            nome: r.streamerNome,
            twitch: (r.streamerSocials as Record<string, string> | null)?.["twitch"] ?? "",
          }
        : null,
      meu,
      codigo_partida: meu || isStaff ? (r.m.codigoPartida ?? null) : null,
      transmissao_id: r.txId && r.txUserId === opts.userId ? r.txId : null,
      pode_assumir: !r.escalaUserId && isStreamerComTwitch,
      pode_entrar_no_ar: meu && dentroDaJanela(r.m, agora),
    };
  });
}

/** Pega a vaga do jogo (1 por jogo; idempotente para o dono). */
export async function pegarVaga(d: any, matchId: string, userId: string): Promise<Resultado> {
  const carregado = await carregarJogoDaAgenda(d, matchId);
  if (!carregado) return { ok: false, erro: "jogo_nao_encontrado" };
  if (!jogoNaAgenda(carregado.jogo)) {
    return {
      ok: false,
      erro: STATUS_JOGO_FINALIZADO.includes(carregado.jogo.status) ? "jogo_finalizado" : "jogo_nao_confirmado",
    };
  }
  const [existente] = await d
    .select({ userId: escalasTransmissao.userId })
    .from(escalasTransmissao).where(eq(escalasTransmissao.matchId, matchId)).limit(1);
  if (existente && existente.userId !== userId) return { ok: false, erro: "vaga_ocupada" };
  if (!existente) await d.insert(escalasTransmissao).values({ matchId, userId });
  return { ok: true };
}

/** Solta a vaga (bloqueado com a live no ar — encerra primeiro). */
export async function soltarVaga(d: any, matchId: string, userId: string): Promise<Resultado> {
  const [escala] = await d
    .select({ userId: escalasTransmissao.userId })
    .from(escalasTransmissao).where(eq(escalasTransmissao.matchId, matchId)).limit(1);
  if (!escala || escala.userId !== userId) return { ok: false, erro: "nao_e_o_streamer" };
  const [live] = await d
    .select({ id: transmissoes.id })
    .from(transmissoes)
    .where(and(eq(transmissoes.matchId, matchId), eq(transmissoes.userId, userId), eq(transmissoes.ativo, true)))
    .limit(1);
  if (live) return { ok: false, erro: "live_no_ar" };
  await d.delete(escalasTransmissao).where(eq(escalasTransmissao.matchId, matchId));
  return { ok: true };
}

/** Entra no ar: cria a transmissão vinculada ao jogo (idempotente). */
export async function entrarNoAr(
  d: any,
  matchId: string,
  userId: string,
  opts: { agora?: Date } = {}
): Promise<Resultado<{ transmissao: any; codigo_partida: string | null }>> {
  const agora = opts.agora ?? new Date();
  const v = await validarStreamer(d, userId);
  if (!v.ok) return v;

  const [escala] = await d
    .select({ userId: escalasTransmissao.userId })
    .from(escalasTransmissao).where(eq(escalasTransmissao.matchId, matchId)).limit(1);
  if (!escala || escala.userId !== userId) return { ok: false, erro: "nao_e_o_streamer" };

  const carregado = await carregarJogoDaAgenda(d, matchId);
  if (!carregado) return { ok: false, erro: "jogo_nao_encontrado" };
  const { jogo, camp } = carregado;
  if (STATUS_JOGO_FINALIZADO.includes(jogo.status)) return { ok: false, erro: "jogo_finalizado" };

  const [jaAtiva] = await d
    .select()
    .from(transmissoes)
    .where(and(eq(transmissoes.matchId, matchId), eq(transmissoes.userId, userId), eq(transmissoes.ativo, true)))
    .limit(1);
  if (jaAtiva) return { ok: true, transmissao: jaAtiva, codigo_partida: jogo.codigoPartida ?? null };

  if (!dentroDaJanela(jogo, agora)) return { ok: false, erro: "fora_da_janela" };

  // Uma live por usuário: encerra as anteriores antes de abrir a do jogo.
  await d
    .update(transmissoes)
    .set({ ativo: false })
    .where(and(eq(transmissoes.userId, userId), eq(transmissoes.ativo, true)));

  const [row] = await d
    .insert(transmissoes)
    .values({
      userId,
      twitchChannel: v.twitch,
      titulo: montarTituloJogo(camp?.nome, jogo.teamATag, jogo.teamBTag),
      campeonatoId: jogo.tournamentId,
      duracaoHoras: 1,
      ativo: true,
      expiraEm: null,
      modo: "campeonato",
      time1Id: jogo.teamAId ?? null,
      time2Id: jogo.teamBId ?? null,
      matchId,
    })
    .returning();
  return { ok: true, transmissao: row, codigo_partida: jogo.codigoPartida ?? null };
}

/** Vitrine pública: live livre não expirada OU live de jogo não finalizado. */
export async function listarVitrine(d: any, agora: Date = new Date()) {
  const rows = await d
    .select({ t: transmissoes, jogoStatus: tournamentMatches.status })
    .from(transmissoes)
    .leftJoin(tournamentMatches, eq(transmissoes.matchId, tournamentMatches.id))
    .where(and(
      eq(transmissoes.ativo, true),
      or(
        and(isNull(transmissoes.matchId), isNotNull(transmissoes.expiraEm), gt(transmissoes.expiraEm, agora)),
        and(isNotNull(transmissoes.matchId), not(inArray(tournamentMatches.status, [...STATUS_JOGO_FINALIZADO])))
      )
    ));
  return rows.map((r: any) => r.t);
}

/** Live ativa do usuário; desativa lazy as mortas (expirada ou jogo finalizado). */
export async function minhaTransmissao(d: any, userId: string, agora: Date = new Date()) {
  const rows = await d
    .select({ t: transmissoes, jogoStatus: tournamentMatches.status })
    .from(transmissoes)
    .leftJoin(tournamentMatches, eq(transmissoes.matchId, tournamentMatches.id))
    .where(and(eq(transmissoes.userId, userId), eq(transmissoes.ativo, true)));
  const vivas = rows.filter((r: any) =>
    r.t.matchId
      ? !STATUS_JOGO_FINALIZADO.includes(r.jogoStatus)
      : r.t.expiraEm && new Date(r.t.expiraEm) > agora
  );
  const mortas = rows.filter((r: any) => !vivas.includes(r));
  if (mortas.length > 0) {
    await d
      .update(transmissoes)
      .set({ ativo: false })
      .where(inArray(transmissoes.id, mortas.map((m: any) => m.t.id)));
  }
  const viva = vivas.sort(
    (a: any, b: any) => new Date(b.t.criadoEm).getTime() - new Date(a.t.criadoEm).getTime()
  )[0];
  return viva?.t ?? null;
}
