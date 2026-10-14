/**
 * sala-campeonato.ts — Sala Campeonato V1 (ADRs 076-085): a sala da série.
 *
 * A sala reusa `matches` (mode='campeonato') com vínculo à série
 * (tournament_match_id OU bracket_match_id) e fases próprias:
 *   camp_vagas → camp_prontos → camp_lado → camp_draft → camp_jogo → camp_finalizada
 *
 * Criação AUTOMÁTICA 10 min antes do horário (ADR-084) + caminho manual
 * ("A COMBINAR"/imprevisto). A criação equivale ao "Iniciar Série": atribui o
 * código Riot, marca a série em_andamento e registra serie_iniciada_at.
 *
 * O estado por jogo (PRONTO, sorteio e escolhas de lado) vive em
 * campeonato_sala_estado — o SERVIDOR é a única autoridade; o front só desenha.
 * Sem timer em V1 (ADR-083): o adm destrava se precisar.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { matches, matchPlayers, campeonatoSalaEstado, matchDrafts } from "../../../db/schema/matches.js";
import { tournaments, tournamentMatches, bracketMatches, tournamentTeams, tournamentSeriesGames } from "../../../db/schema/tournaments.js";
import { teams, teamMembers } from "../../../db/schema/teams.js";
import { users, userRoles } from "../../../db/schema/identidade.js";
import { transmissoes } from "../../../db/schema/conteudo.js";
import { atribuirCodigoSerie, normalizarBestOf } from "./serie-campeonato.js";
import { findUserTeamMemberships } from "./team-membership.js";
import { instanteJogo, validarStreamer, montarTituloJogo } from "./streams.js";
import { notifyMatchChange } from "./match-flow.js";
import { getRoles, eStaffSala } from "./acesso-sala.js";
import {
  garantirDraftSalaCampeonato,
  campeoesTravados,
  ladoPrimeiroPick,
  REGRAS_SHAPE_CAMPEONATO,
  DRAFT_TURNO_MS_CAMPEONATO,
} from "./sala-campeonato-draft.js";

/** Fases "vivas" da sala (campeonato OU livre): fora delas, não é mais a ativa. */
export const FASES_ATIVAS_CAMPEONATO = ["camp_vagas", "camp_prontos", "camp_lado", "camp_draft", "camp_jogo"];

/** Modos que usam o fluxo de TIME vs TIME (2 vagas de time + PRONTO + draft). */
export function eSalaDeTimes(sala: any): boolean {
  return sala?.mode === "campeonato" || sala?.mode === "time_vs_time_livre";
}

/** Criação automática: sala nasce 10 min antes do horário agendado (ADR-084). */
export const JANELA_CRIACAO_MS = 10 * 60 * 1000;
/** Jogo atrasado no MESMO dia ainda ganha sala (evita sala de ontem). */
const ATRASO_CRIACAO_MS = 6 * 60 * 60 * 1000;
const STATUS_FINAIS_SERIE = ["finalizada", "finalizado", "finished"];

export type Resultado<T = {}> = ({ ok: true } & T) | { ok: false; erro: string };

/** Sala ativa (não finalizada) vinculada à série, se existir. */
export async function buscarSalaAtivaDaSerie(
  d: any,
  opts: { tournamentMatchId?: string | null; bracketMatchId?: string | null }
) {
  if (!opts.tournamentMatchId && !opts.bracketMatchId) return null;
  const cond = opts.tournamentMatchId
    ? eq(matches.tournamentMatchId, opts.tournamentMatchId)
    : eq(matches.bracketMatchId, opts.bracketMatchId!);
  const [sala] = await d
    .select()
    .from(matches)
    .where(and(cond, inArray(matches.status, FASES_ATIVAS_CAMPEONATO)))
    .limit(1);
  return sala ?? null;
}

/** Série da sala (cronograma ou chave) com a flag `isBracket`. */
export async function carregarSerieDaSala(d: any, sala: any): Promise<any | null> {
  if (sala?.tournamentMatchId) {
    const [serie] = await d.select().from(tournamentMatches).where(eq(tournamentMatches.id, sala.tournamentMatchId)).limit(1);
    return serie ? { ...serie, isBracket: false } : null;
  }
  if (sala?.bracketMatchId) {
    const [serie] = await d.select().from(bracketMatches).where(eq(bracketMatches.id, sala.bracketMatchId)).limit(1);
    return serie ? { ...serie, isBracket: true } : null;
  }
  return null;
}

/** IDs dos times da série: diretos ou resolvidos pelas tags do snapshot. */
async function resolverTimesDaSerie(d: any, serie: any): Promise<{ teamAId: string | null; teamBId: string | null }> {
  let teamAId = serie.teamAId ?? null;
  let teamBId = serie.teamBId ?? null;
  if (!teamAId || !teamBId) {
    const teamRows = await d
      .select({ id: teams.id, tag: teams.tag })
      .from(teams)
      .innerJoin(tournamentTeams, eq(tournamentTeams.teamId, teams.id))
      .where(eq(tournamentTeams.tournamentId, serie.tournamentId));
    if (!teamAId && serie.teamATag) {
      teamAId = teamRows.find((r: any) => r.tag?.toLowerCase() === serie.teamATag?.toLowerCase())?.id ?? null;
    }
    if (!teamBId && serie.teamBTag) {
      teamBId = teamRows.find((r: any) => r.tag?.toLowerCase() === serie.teamBTag?.toLowerCase())?.id ?? null;
    }
  }
  return { teamAId, teamBId };
}

/** Dono OU membro aceito do time (inclui vaga de convidado por vínculo Riot). */
async function usuarioNoTime(d: any, userId: string, teamId: string): Promise<boolean> {
  const [dono] = await d
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.ownerId, userId)))
    .limit(1);
  if (dono) return true;
  const ms = await findUserTeamMemberships(d, userId, { teamIds: [teamId], onlyAccepted: true });
  return ms.length > 0;
}

/** Lado (vaga) do usuário na sala: 'blue' (time A), 'red' (time B) ou null. */
export async function ladoDoUsuarioNaSala(d: any, sala: any, userId: string): Promise<"blue" | "red" | null> {
  // Vaga ocupada na sala vale para os dois fluxos (campeonato e livre).
  const [vaga] = await d
    .select({ side: matchPlayers.side })
    .from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, sala.id), eq(matchPlayers.userId, userId)))
    .limit(1);
  if (vaga?.side) return vaga.side as "blue" | "red";

  // Sem vaga: no campeonato ainda vale ser do roster do time (ADR-056).
  const serie = await carregarSerieDaSala(d, sala);
  if (!serie) return null;
  const { teamAId, teamBId } = await resolverTimesDaSerie(d, serie);
  if (teamAId && (await usuarioNoTime(d, userId, teamAId))) return "blue";
  if (teamBId && (await usuarioNoTime(d, userId, teamBId))) return "red";
  return null;
}

/**
 * Cria (ou devolve a existente) a Sala Campeonato da série. Equivale ao
 * "Iniciar Série": código atribuído + série em_andamento. O lock da série
 * serializa cron + clique manual simultâneos.
 */
export async function criarSalaCampeonato(
  d: any,
  opts: { torneio: any; serie: any; isBracket: boolean }
): Promise<Resultado<{ sala: any; criada: boolean }>> {
  const { torneio, isBracket } = opts;

  const out: any = await d.transaction(async (tx: any) => {
    const tabela = isBracket ? bracketMatches : tournamentMatches;
    const [serie] = await tx.select().from(tabela).where(eq(tabela.id, opts.serie.id)).limit(1).for("update");
    if (!serie) return { ok: false, erro: "serie_nao_encontrada" };
    if (STATUS_FINAIS_SERIE.includes(serie.status)) return { ok: false, erro: "serie_finalizada" };

    const existente = await buscarSalaAtivaDaSerie(
      tx,
      isBracket ? { bracketMatchId: serie.id } : { tournamentMatchId: serie.id }
    );
    if (existente) return { ok: true, sala: existente, criada: false };

    const { teamAId, teamBId } = await resolverTimesDaSerie(tx, serie);
    if (!teamAId || !teamBId) return { ok: false, erro: "times_incompletos" };
    const teamRows = await tx.select().from(teams).where(inArray(teams.id, [teamAId, teamBId]));
    const A = teamRows.find((t: any) => t.id === teamAId);
    const B = teamRows.find((t: any) => t.id === teamBId);

    // `created_by` é NOT NULL: usa o organizador; sem ele, um admin/proprietário.
    let createdBy = torneio.organizerId ?? null;
    if (!createdBy) {
      const [adm] = await tx
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(inArray(userRoles.role, ["proprietario", "admin"]))
        .limit(1);
      createdBy = adm?.userId ?? null;
    }
    if (!createdBy) return { ok: false, erro: "sem_organizador" };

    let codigo = serie.codigoPartida ?? null;
    if (!codigo) {
      codigo = await atribuirCodigoSerie(tx, "5v5");
      if (codigo === "SEM-CODIGO-AGUARDE") return { ok: false, erro: "sem_codigo" };
    }
    // Formato da série: `best_of` gravado na criação do jogo (MD1/MD3/MD5 no
    // Painel de Arbitragem). Sem valor válido → MD3. Não é mais heurística de
    // fase (phase não existe em bracket e é sempre group_stage no cronograma).
    const bestOf = normalizarBestOf(serie.bestOf) ?? 3;

    if (isBracket) {
      await tx
        .update(bracketMatches)
        .set({ codigoPartida: codigo, bestOf, serieIniciadaAt: serie.serieIniciadaAt ?? new Date(), updatedAt: new Date() })
        .where(eq(bracketMatches.id, serie.id));
    } else {
      await tx
        .update(tournamentMatches)
        .set({
          codigoPartida: codigo,
          bestOf,
          serieIniciadaAt: serie.serieIniciadaAt ?? new Date(),
          status: "em_andamento",
          updatedAt: new Date(),
        })
        .where(eq(tournamentMatches.id, serie.id));
    }

    const [sala] = await tx
      .insert(matches)
      .values({
        gameId: "lol",
        mode: "campeonato",
        status: "camp_vagas",
        createdBy,
        maxJogadores: 2,
        nome: `${A?.tag ?? "TBD"} x ${B?.tag ?? "TBD"}`,
        timeANome: A?.name ?? null,
        timeATag: A?.tag ?? null,
        timeALogo: A?.logoUrl ?? null,
        timeBNome: B?.name ?? null,
        timeBTag: B?.tag ?? null,
        timeBLogo: B?.logoUrl ?? null,
        codigoPartida: codigo,
        tournamentMatchId: isBracket ? null : serie.id,
        bracketMatchId: isBracket ? serie.id : null,
      })
      .returning();

    await tx.insert(campeonatoSalaEstado).values({ matchId: sala.id });
    return { ok: true, sala, criada: true };
  });

  if (out?.ok && out.criada) await notifyMatchChange(String(out.sala.salaNum));
  return out;
}

/**
 * Varredura da criação automática (roda a cada minuto no index.ts): jogos do
 * cronograma `confirmado` com horário dentro da janela de 10 min ganham sala.
 * "A COMBINAR" e a chave ficam no caminho manual.
 */
export async function criarSalasCampeonatoPendentes(d: any, agora: Date = new Date()): Promise<{ criadas: number; erros: string[] }> {
  const rows = await d
    .select({ m: tournamentMatches, t: tournaments })
    .from(tournamentMatches)
    .innerJoin(tournaments, eq(tournaments.id, tournamentMatches.tournamentId))
    .where(eq(tournamentMatches.status, "confirmado"));

  let criadas = 0;
  const erros: string[] = [];
  for (const { m, t } of rows) {
    if (!m.teamAId && !m.teamATag) continue; // sem times definidos ainda
    const instante = instanteJogo(m.displayDate, m.displayTime);
    if (!instante) continue; // "A COMBINAR" → botão manual
    const alvo = instante.getTime();
    if (agora.getTime() < alvo - JANELA_CRIACAO_MS) continue;
    if (agora.getTime() > alvo + ATRASO_CRIACAO_MS) continue;

    const r = await criarSalaCampeonato(d, { torneio: t, serie: m, isBracket: false });
    if (r.ok) {
      if (r.criada) criadas++;
    } else if (r.erro !== "serie_finalizada") {
      erros.push(`${m.id}: ${r.erro}`);
    }
  }
  return { criadas, erros };
}

/** Cria a sala TIME vs TIME LIVRE — mesmo fluxo, sem campeonato (ADR-086).
 *  `formato` = série da sala: md1 | md3 (padrão) | md5. */
export async function criarSalaTimeVsTime(d: any, opts: { userId: string; formato?: string }): Promise<Resultado<{ sala: any }>> {
  const formato = ["md1", "md3", "md5"].includes(String(opts.formato)) ? String(opts.formato) : "md3";
  const out: any = await d.transaction(async (tx: any) => {
    const [sala] = await tx
      .insert(matches)
      .values({
        gameId: "lol",
        mode: "time_vs_time_livre",
        status: "camp_vagas",
        createdBy: opts.userId,
        maxJogadores: 2,
        nome: "Time vs Time",
      })
      .returning();
    await tx.insert(campeonatoSalaEstado).values({ matchId: sala.id, formato });
    return { ok: true, sala };
  });
  if (out?.ok) await notifyMatchChange(String(out.sala.salaNum));
  return out;
}

/** Entrar na vaga (campeonato: só o time do lado; livre: qualquer usuário). */
export async function entrarNaVaga(
  d: any,
  opts: { salaNum: number; userId: string; side: "blue" | "red" }
): Promise<Resultado<{ estado: string }>> {
  const r: any = await d.transaction(async (tx: any) => {
    const [sala] = await tx.select().from(matches).where(eq(matches.salaNum, opts.salaNum)).limit(1).for("update");
    if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
    if (!eSalaDeTimes(sala)) return { ok: false, erro: "nao_e_sala_campeonato" };
    if (sala.status !== "camp_vagas") return { ok: false, erro: "estado_invalido" };

    // Campenato: a vaga é do time da série (dono/membro aceito/convidado).
    // Sala LIVRE (sem série): qualquer usuário logado ocupa a vaga do lado.
    const serie = await carregarSerieDaSala(tx, sala);
    if (serie) {
      const { teamAId, teamBId } = await resolverTimesDaSerie(tx, serie);
      const teamId = opts.side === "blue" ? teamAId : teamBId;
      if (!teamId) return { ok: false, erro: "times_incompletos" };
      if (!(await usuarioNoTime(tx, opts.userId, teamId))) return { ok: false, erro: "nao_e_do_time" };
    } else {
      // Sala LIVRE (personalizada): o jogador entra COM O TIME DELE — dono ou
      // membro aceito. Sem time → `sem_time` (o front mostra "crie ou entre em
      // um time"). O mesmo time nunca ocupa os dois lados.
      const cols = { id: teams.id, name: teams.name, tag: teams.tag, logoUrl: teams.logoUrl } as const;
      // Só MEMBERSHIP aceita (user_id), a mais recente — o MESMO critério da
      // página de time. Ser DONO sem vínculo de membro NÃO conta (caso real:
      // dono antigo que "saiu" e o time ainda era puxado na vaga — 13/10).
      const [t] = await tx
        .select(cols)
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(and(eq(teamMembers.userId, opts.userId), eq(teamMembers.status, "accepted")))
        .orderBy(desc(teamMembers.createdAt))
        .limit(1);
      const meuTime = t ?? null;
      if (!meuTime) return { ok: false, erro: "sem_time" };
      const outraTag = opts.side === "blue" ? sala.timeBTag : sala.timeATag;
      if (outraTag && meuTime.tag && outraTag === meuTime.tag) return { ok: false, erro: "mesmo_time" };

      await tx
        .update(matches)
        .set(
          opts.side === "blue"
            ? { timeANome: meuTime.name, timeATag: meuTime.tag, timeALogo: meuTime.logoUrl, updatedAt: new Date() }
            : { timeBNome: meuTime.name, timeBTag: meuTime.tag, timeBLogo: meuTime.logoUrl, updatedAt: new Date() }
        )
        .where(eq(matches.id, sala.id));
    }

    const [naVaga] = await tx
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, sala.id), eq(matchPlayers.userId, opts.userId)))
      .limit(1);
    if (naVaga) {
      if (naVaga.side === opts.side) return { ok: true, estado: sala.status };
      return { ok: false, erro: "ja_esta_na_sala" };
    }
    const [ocupada] = await tx
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, sala.id), eq(matchPlayers.side, opts.side)))
      .limit(1);
    if (ocupada) return { ok: false, erro: "vaga_ocupada" };

    await tx.insert(matchPlayers).values({
      matchId: sala.id,
      userId: opts.userId,
      side: opts.side,
      slot: 0,
      roleSlot: null,
      confirmed: false,
    });

    const total = await tx.select({ id: matchPlayers.userId }).from(matchPlayers).where(eq(matchPlayers.matchId, sala.id));
    if (total.length >= 2) {
      await tx.update(matches).set({ status: "camp_prontos", updatedAt: new Date() }).where(eq(matches.id, sala.id));
      return { ok: true, estado: "camp_prontos" };
    }
    return { ok: true, estado: sala.status };
  });

  if (r?.ok) await notifyMatchChange(String(opts.salaNum));
  return r;
}

/** Sair da vaga (antes do PRONTO; sair durante camp_prontos reseta os prontos). */
export async function sairDaVaga(d: any, opts: { salaNum: number; userId: string }): Promise<Resultado<{ estado: string }>> {
  const r: any = await d.transaction(async (tx: any) => {
    const [sala] = await tx.select().from(matches).where(eq(matches.salaNum, opts.salaNum)).limit(1).for("update");
    if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
    if (!eSalaDeTimes(sala)) return { ok: false, erro: "nao_e_sala_campeonato" };
    if (!["camp_vagas", "camp_prontos"].includes(sala.status)) return { ok: false, erro: "estado_invalido" };

    const [jogador] = await tx
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, sala.id), eq(matchPlayers.userId, opts.userId)))
      .limit(1);
    if (!jogador) return { ok: false, erro: "nao_esta_na_sala" };

    await tx.delete(matchPlayers).where(and(eq(matchPlayers.matchId, sala.id), eq(matchPlayers.userId, opts.userId)));

    // Sala LIVRE: o TIME sai junto com o jogador — a vaga reabre pra outro time.
    // (No campeonato o time é da série e não sai da sala.)
    if (!sala.tournamentMatchId && !sala.bracketMatchId) {
      await tx
        .update(matches)
        .set(
          jogador.side === "blue"
            ? { timeANome: null, timeATag: null, timeALogo: null, updatedAt: new Date() }
            : { timeBNome: null, timeBTag: null, timeBLogo: null, updatedAt: new Date() }
        )
        .where(eq(matches.id, sala.id));
    }
    await tx
      .update(campeonatoSalaEstado)
      .set({ prontoBlue: false, prontoRed: false, updatedAt: new Date() })
      .where(eq(campeonatoSalaEstado.matchId, sala.id));
    if (sala.status === "camp_prontos") {
      await tx.update(matches).set({ status: "camp_vagas", updatedAt: new Date() }).where(eq(matches.id, sala.id));
      return { ok: true, estado: "camp_vagas" };
    }
    return { ok: true, estado: sala.status };
  });

  if (r?.ok) await notifyMatchChange(String(opts.salaNum));
  return r;
}

/**
 * PRONTO do jogo corrente (um por lado, sem timer). Quando os DOIS marcam, a
 * sala vai para `camp_lado`: jogo 1 tem o sorteio; jogos 2+ o perdedor do jogo
 * anterior escolhe o lado (ADR-079/081).
 */
export async function marcarPronto(
  d: any,
  opts: { salaNum: number; userId: string }
): Promise<Resultado<{ estado: string; avancou: boolean }>> {
  const r: any = await d.transaction(async (tx: any) => {
    const [sala] = await tx.select().from(matches).where(eq(matches.salaNum, opts.salaNum)).limit(1).for("update");
    if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
    if (!eSalaDeTimes(sala)) return { ok: false, erro: "nao_e_sala_campeonato" };
    if (sala.status !== "camp_prontos") return { ok: false, erro: "estado_invalido" };

    const [estado] = await tx
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id))
      .limit(1);
    if (!estado) return { ok: false, erro: "estado_ausente" };

    const [jogador] = await tx
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, sala.id), eq(matchPlayers.userId, opts.userId)))
      .limit(1);
    if (!jogador) return { ok: false, erro: "nao_esta_na_sala" };

    const prontoBlue = jogador.side === "blue" ? true : estado.prontoBlue;
    const prontoRed = jogador.side === "red" ? true : estado.prontoRed;
    const set: any = { prontoBlue, prontoRed, updatedAt: new Date() };

    if (prontoBlue && prontoRed) {
      let escolhaTime: string;
      if ((estado.jogo ?? 1) <= 1) {
        // Jogo 1: a plataforma sorteia quem escolhe primeiro (ADR-079) — exceto
        // quando a série tem `sorteio_forcado` ('a'|'b': o time da série que
        // DEVE ser o sorteado; operação pontual combinada com os times).
        const serie = await carregarSerieDaSala(tx, sala);
        const forcado = serie?.sorteioForcado;
        const sorteio: "blue" | "red" =
          forcado === "a" ? "blue" : forcado === "b" ? "red" : Math.random() < 0.5 ? "blue" : "red";
        set.sorteioVencedor = sorteio;
        escolhaTime = sorteio;
      } else {
        // Jogos 2+: o perdedor do jogo anterior escolhe primeiro.
        const serie = await carregarSerieDaSala(tx, sala);
        if (serie) {
          const cond = serie.isBracket
            ? eq(tournamentSeriesGames.bracketMatchId, serie.id)
            : eq(tournamentSeriesGames.matchId, serie.id);
          const [anterior] = await tx
            .select()
            .from(tournamentSeriesGames)
            .where(and(cond, eq(tournamentSeriesGames.gameNumber, (estado.jogo ?? 1) - 1)))
            .limit(1);
          if (!anterior) return { ok: false, erro: "resultado_anterior_pendente" };
          escolhaTime = anterior.winnerSide === "a" ? "red" : "blue";
        } else {
          // Sala LIVRE (scrim MD1/MD3/MD5): o vencedor do jogo anterior fica no
          // estado LOCAL da sala (ultimo_vencedor) — o perdedor escolhe primeiro.
          const vencedor = estado.ultimoVencedor as "a" | "b" | null;
          if (!vencedor) return { ok: false, erro: "resultado_anterior_pendente" };
          escolhaTime = vencedor === "a" ? "red" : "blue";
        }
      }
      set.escolhaTime = escolhaTime;
      set.ladoEscolhido = null;
      set.pickOrderEscolhido = null;
      set.primeiraEscolha = null;
      await tx.update(campeonatoSalaEstado).set(set).where(eq(campeonatoSalaEstado.matchId, sala.id));
      await tx.update(matches).set({ status: "camp_lado", updatedAt: new Date() }).where(eq(matches.id, sala.id));
      return { ok: true, estado: "camp_lado", avancou: true };
    }

    await tx.update(campeonatoSalaEstado).set(set).where(eq(campeonatoSalaEstado.matchId, sala.id));
    return { ok: true, estado: sala.status, avancou: false };
  });

  if (r?.ok) await notifyMatchChange(String(opts.salaNum));
  return r;
}

/**
 * Escolha de LADO (ADR-092, ajusta a ADR-079): o time da vez (`escolha_time`)
 * pode escolher o LADO agora — ou o pick order primeiro (ver escolherPickOrder);
 * o adversário completa o que sobrar. `lado_escolhido` é o lado que o time
 * ESCOLHEDOR joga; o adversário fica com o outro. Se o pick order JÁ tiver sido
 * escolhido, esta escolha FECHA o par e a sala vai para o draft.
 */
export async function escolherLado(
  d: any,
  opts: { salaNum: number; userId: string; lado: "blue" | "red" }
): Promise<Resultado<{ estado: string }>> {
  const r: any = await d.transaction(async (tx: any) => {
    const [sala] = await tx.select().from(matches).where(eq(matches.salaNum, opts.salaNum)).limit(1).for("update");
    if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
    if (!eSalaDeTimes(sala)) return { ok: false, erro: "nao_e_sala_campeonato" };
    if (sala.status !== "camp_lado") return { ok: false, erro: "estado_invalido" };

    const [estado] = await tx
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id))
      .limit(1);
    if (!estado?.escolhaTime) return { ok: false, erro: "estado_invalido" };
    if (estado.ladoEscolhido) return { ok: false, erro: "lado_ja_escolhido" };

    const meuLado = await ladoDoUsuarioNaSala(tx, sala, opts.userId);
    if (!meuLado) return { ok: false, erro: "nao_e_do_time" };
    if (meuLado !== estado.escolhaTime) return { ok: false, erro: "fora_da_vez" };

    const outro = estado.escolhaTime === "blue" ? "red" : "blue";
    if (!estado.pickOrderEscolhido) {
      // Escolheu o LADO primeiro: o adversário ainda escolhe o pick order.
      await tx
        .update(campeonatoSalaEstado)
        .set({ ladoEscolhido: opts.lado, primeiraEscolha: "lado", escolhaTime: outro, updatedAt: new Date() })
        .where(eq(campeonatoSalaEstado.matchId, sala.id));
      return { ok: true, estado: "camp_lado" };
    }

    // O pick order já estava escolhido: esta escolha de lado FECHA o par.
    await tx
      .update(campeonatoSalaEstado)
      .set({ ladoEscolhido: opts.lado, updatedAt: new Date() })
      .where(eq(campeonatoSalaEstado.matchId, sala.id));
    await tx.update(matches).set({ status: "camp_draft", updatedAt: new Date() }).where(eq(matches.id, sala.id));
    const [estadoAtual] = await tx
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id))
      .limit(1);
    await garantirDraftSalaCampeonato(tx, sala, estadoAtual);
    return { ok: true, estado: "camp_draft" };
  });

  if (r?.ok) await notifyMatchChange(String(opts.salaNum));
  return r;
}

/**
 * Escolha do FIRST/LAST PICK (ADR-092, ajusta a ADR-079): o time da vez pode
 * escolher o pick order AGORA — ou o lado primeiro (ver escolherLado); o
 * adversário completa o que sobrar. Se o lado JÁ estiver escolhido, esta escolha
 * FECHA o par e a sala vai para `camp_draft`. `escolha_time` fica com quem fez
 * a última escolha — o draft usa isso + `primeira_escolha` para a ordem.
 */
export async function escolherPickOrder(
  d: any,
  opts: { salaNum: number; userId: string; ordem: "first" | "last" }
): Promise<Resultado<{ estado: string }>> {
  const r: any = await d.transaction(async (tx: any) => {
    const [sala] = await tx.select().from(matches).where(eq(matches.salaNum, opts.salaNum)).limit(1).for("update");
    if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
    if (!eSalaDeTimes(sala)) return { ok: false, erro: "nao_e_sala_campeonato" };
    if (sala.status !== "camp_lado") return { ok: false, erro: "estado_invalido" };

    const [estado] = await tx
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id))
      .limit(1);
    if (!estado?.escolhaTime || estado.pickOrderEscolhido) {
      return { ok: false, erro: "estado_invalido" };
    }

    const meuLado = await ladoDoUsuarioNaSala(tx, sala, opts.userId);
    if (!meuLado) return { ok: false, erro: "nao_e_do_time" };
    if (meuLado !== estado.escolhaTime) return { ok: false, erro: "fora_da_vez" };

    const outro = estado.escolhaTime === "blue" ? "red" : "blue";
    if (!estado.ladoEscolhido) {
      // Escolheu o PICK primeiro: o adversário ainda escolhe o LADO.
      await tx
        .update(campeonatoSalaEstado)
        .set({ pickOrderEscolhido: opts.ordem, primeiraEscolha: "pick", escolhaTime: outro, updatedAt: new Date() })
        .where(eq(campeonatoSalaEstado.matchId, sala.id));
      return { ok: true, estado: "camp_lado" };
    }

    // O lado já estava escolhido: esta escolha FECHA o par → draft.
    await tx
      .update(campeonatoSalaEstado)
      .set({ pickOrderEscolhido: opts.ordem, updatedAt: new Date() })
      .where(eq(campeonatoSalaEstado.matchId, sala.id));
    await tx.update(matches).set({ status: "camp_draft", updatedAt: new Date() }).where(eq(matches.id, sala.id));

    // Passo 5: o draft do jogo nasce junto com a fase — vai no shape da mesma
    // resposta e as ações de ban/pick já encontram a linha.
    const [estadoAtual] = await tx
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id))
      .limit(1);
    await garantirDraftSalaCampeonato(tx, sala, estadoAtual);

    return { ok: true, estado: "camp_draft" };
  });

  if (r?.ok) await notifyMatchChange(String(opts.salaNum));
  return r;
}

/**
 * Botão "Iniciar live" da sala (ADR-080): só streamer (cargo + Twitch no
 * perfil). Encerra qualquer live ativa do usuário e abre a live DO JOGO (modo
 * campeonato, times da série, sem expiração — o fim vem com a série pelo motor).
 * Idempotente para a mesma série.
 */
export async function iniciarLiveDaSala(
  d: any,
  opts: { salaNum: number; userId: string }
): Promise<Resultado<{ transmissao: any; twitch: string }>> {
  const [sala] = await d.select().from(matches).where(eq(matches.salaNum, opts.salaNum)).limit(1);
  if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
  if (sala.mode !== "campeonato") return { ok: false, erro: "nao_e_sala_campeonato" };
  if (!FASES_ATIVAS_CAMPEONATO.includes(sala.status)) return { ok: false, erro: "estado_invalido" };

  const serie = await carregarSerieDaSala(d, sala);
  if (!serie) return { ok: false, erro: "serie_nao_encontrada" };
  if (STATUS_FINAIS_SERIE.includes(serie.status)) return { ok: false, erro: "serie_finalizada" };

  const v = await validarStreamer(d, opts.userId);
  if (!v.ok) return v;

  const [jaAtiva] = await d
    .select()
    .from(transmissoes)
    .where(and(eq(transmissoes.matchId, serie.id), eq(transmissoes.userId, opts.userId), eq(transmissoes.ativo, true)))
    .limit(1);
  if (jaAtiva) return { ok: true, transmissao: jaAtiva, twitch: v.twitch };

  // Uma live por usuário: encerra as anteriores antes de abrir a do jogo.
  await d
    .update(transmissoes)
    .set({ ativo: false })
    .where(and(eq(transmissoes.userId, opts.userId), eq(transmissoes.ativo, true)));

  const [torneio] = await d
    .select({ nome: tournaments.name })
    .from(tournaments)
    .where(eq(tournaments.id, serie.tournamentId))
    .limit(1);

  const [row] = await d
    .insert(transmissoes)
    .values({
      userId: opts.userId,
      twitchChannel: v.twitch,
      titulo: montarTituloJogo(torneio?.nome, serie.teamATag, serie.teamBTag),
      campeonatoId: serie.tournamentId,
      duracaoHoras: 1,
      ativo: true,
      expiraEm: null,
      modo: "campeonato",
      time1Id: serie.teamAId ?? null,
      time2Id: serie.teamBId ?? null,
      matchId: serie.id,
    })
    .returning();
  return { ok: true, transmissao: row, twitch: v.twitch };
}

/**
 * Lado em jogo do TIME A depois das escolhas (ADR-092). `escolha_time` fica com
 * quem fez a ÚLTIMA escolha; quem escolheu o LADO depende da ORDEM:
 *  - primeiraEscolha = 'lado' (ou null, fluxo antigo): o lado veio primeiro →
 *    quem escolheu o lado é o OUTRO de escolha_time;
 *  - primeiraEscolha = 'pick': o pick veio primeiro → o lado foi escolhido por
 *    último, o próprio escolha_time.
 * `lado_escolhido` é o lado de quem escolheu o lado. Time A = vaga azul.
 */
function ladoEmJogoTimeA(estado: any): "blue" | "red" | null {
  if (!estado?.ladoEscolhido || !estado?.escolhaTime) return null;
  const oposto = (l: string) => (l === "blue" ? "red" : "blue");
  const sVaga = (estado.primeiraEscolha ?? "lado") === "lado"
    ? oposto(estado.escolhaTime)
    : estado.escolhaTime;
  return sVaga === "blue" ? estado.ladoEscolhido : oposto(estado.ladoEscolhido);
}

/**
 * Gancho do motor de série: jogada registrada → a sala volta a `camp_prontos`
 * com o jogo avançado (os dois marcam PRONTO de novo — ADR-081). Idempotente:
 * só avança se a sala ainda estiver atrás do contador de jogadas da série.
 */
export async function avancarSalaCampeonatoAposJogada(
  tx: any,
  opts: { serieId: string; isBracket: boolean; jogadas: number }
): Promise<void> {
  const cond = opts.isBracket ? eq(matches.bracketMatchId, opts.serieId) : eq(matches.tournamentMatchId, opts.serieId);
  const [sala] = await tx
    .select()
    .from(matches)
    .where(and(cond, inArray(matches.status, FASES_ATIVAS_CAMPEONATO)))
    .limit(1);
  if (!sala) return;
  const [estado] = await tx
    .select()
    .from(campeonatoSalaEstado)
    .where(eq(campeonatoSalaEstado.matchId, sala.id))
    .limit(1);
  if (!estado || (estado.jogo ?? 1) > opts.jogadas) return;

  await tx
    .update(campeonatoSalaEstado)
    .set({
      jogo: opts.jogadas + 1,
      prontoBlue: false,
      prontoRed: false,
      escolhaTime: null,
      ladoEscolhido: null,
      pickOrderEscolhido: null,
      updatedAt: new Date(),
    })
    .where(eq(campeonatoSalaEstado.matchId, sala.id));
  await tx.update(matches).set({ status: "camp_prontos", updatedAt: new Date() }).where(eq(matches.id, sala.id));
  await notifyMatchChange(String(sala.salaNum));
}

/** Fim da série (motor ou ADM): encerra a sala campeonato vinculada. */
export async function encerrarSalaCampeonato(tx: any, opts: { serieId: string; isBracket: boolean }): Promise<void> {
  const cond = opts.isBracket ? eq(matches.bracketMatchId, opts.serieId) : eq(matches.tournamentMatchId, opts.serieId);
  const [sala] = await tx
    .select()
    .from(matches)
    .where(and(cond, inArray(matches.status, FASES_ATIVAS_CAMPEONATO)))
    .limit(1);
  if (!sala) return;
  await tx
    .update(matches)
    .set({ status: "camp_finalizada", endedAt: new Date(), updatedAt: new Date() })
    .where(eq(matches.id, sala.id));
  await notifyMatchChange(String(sala.salaNum));
}

/** Quem vê o código da sala campeonato: staff OU membro/dono de um dos times. */
export async function podeVerCodigoSalaCampeonato(d: any, userId: string, sala: any): Promise<boolean> {
  const roles = await getRoles(d, userId);
  if (eStaffSala(roles)) return true;
  const serie = await carregarSerieDaSala(d, sala);
  if (!serie) return false;
  const [torneio] = await d
    .select({ organizerId: tournaments.organizerId })
    .from(tournaments)
    .where(eq(tournaments.id, serie.tournamentId))
    .limit(1);
  if (torneio?.organizerId === userId) return true;
  const { teamAId, teamBId } = await resolverTimesDaSerie(d, serie);
  for (const teamId of [teamAId, teamBId]) {
    if (teamId && (await usuarioNoTime(d, userId, teamId))) return true;
  }
  return false;
}

/** Bloco `campeonato` do shape da sala (estado por jogo + série). */
export async function shapeSalaCampeonato(d: any, sala: any) {
  const [estado] = await d
    .select()
    .from(campeonatoSalaEstado)
    .where(eq(campeonatoSalaEstado.matchId, sala.id))
    .limit(1);
  const serie = await carregarSerieDaSala(d, sala);
  let camp: any = null;
  if (serie) {
    const [t] = await d
      .select({ id: tournaments.id, nome: tournaments.name })
      .from(tournaments)
      .where(eq(tournaments.id, serie.tournamentId))
      .limit(1);
    camp = { id: t?.id ?? null, titulo: t?.nome ?? null };
  }

  // Passo 6: live ativa do jogo (botão "Iniciar live" / "Assista ao vivo").
  let live: any = null;
  if (serie) {
    const [tr] = await d
      .select({ id: transmissoes.id, twitch: transmissoes.twitchChannel, userId: transmissoes.userId })
      .from(transmissoes)
      .where(and(eq(transmissoes.matchId, serie.id), eq(transmissoes.ativo, true)))
      .limit(1);
    if (tr) {
      const [u] = await d.select({ nome: users.displayName }).from(users).where(eq(users.id, tr.userId)).limit(1);
      live = { id: tr.id, twitch: tr.twitch, streamer: u?.nome ?? null };
    }
  }
  const times = serie ? await resolverTimesDaSerie(d, serie) : { teamAId: null, teamBId: null };

  // Draft do jogo (passo 5): shape compatível com o DraftRoom (mesmos campos do
  // draft das salas) + extras do campeonato (Fearless e quem tem o first pick).
  let draft: any = null;
  if (sala.status === "camp_draft" || sala.status === "camp_jogo" || sala.status === "iniciando_partida" || sala.status === "partida_iniciada") {
    const [dr] = await d
      .select()
      .from(matchDrafts)
      .where(and(eq(matchDrafts.matchId, sala.id), eq(matchDrafts.jogo, estado?.jogo ?? 1)))
      .limit(1);
    if (dr) {
      draft = {
        blue_bans: dr.blueBans ?? [],
        blue_picks: dr.bluePicks ?? [],
        red_bans: dr.redBans ?? [],
        red_picks: dr.redPicks ?? [],
        current_turn: dr.currentTurn,
        current_phase: dr.currentPhase,
        current_team: dr.currentTeam,
        turn_deadline_at: dr.turnDeadlineAt ?? null,
        status: dr.status,
        duracao_turno_ms: DRAFT_TURNO_MS_CAMPEONATO,
        regras: REGRAS_SHAPE_CAMPEONATO,
        // Fearless: campeões travados por jogos anteriores (o front grelha) e
        // qual lado tem o first pick (a ordem não é do azul por definição).
        campeoes_travados: await campeoesTravados(d, sala.id, dr.jogo),
        primeiro_pick: ladoPrimeiroPick(estado),
      };
    }
  }

  return {
    jogo: estado?.jogo ?? 1,
    // Formato da série: sala livre tem o dela (md1/md3/md5); no campeonato o
    // placar/melhor-de vem da série — aqui serve pro front mostrar o rótulo.
    formato: estado?.formato ?? null,
    // Placar LOCAL da série da sala LIVRE (scrim). No campeonato o placar é da série.
    placar_a: estado?.placarA ?? 0,
    placar_b: estado?.placarB ?? 0,
    pronto_blue: estado?.prontoBlue ?? false,
    pronto_red: estado?.prontoRed ?? false,
    sorteio_vencedor: estado?.sorteioVencedor ?? null,
    escolha_time: estado?.escolhaTime ?? null,
    lado_escolhido: estado?.ladoEscolhido ?? null,
    pick_order_escolhido: estado?.pickOrderEscolhido ?? null,
    serie: serie
      ? {
          id: serie.id,
          tipo: serie.isBracket ? "chave" : "cronograma",
          best_of: serie.bestOf ?? 3,
          placar_a: serie.scoreA ?? 0,
          placar_b: serie.scoreB ?? 0,
          status: serie.status ?? null,
          campeonato_id: camp?.id ?? null,
          campeonato_titulo: camp?.titulo ?? null,
          time_a_id: times.teamAId,
          time_b_id: times.teamBId,
        }
      : null,
    live,
    lado_time_a: ladoEmJogoTimeA(estado),
    draft,
  };
}
