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
import { and, eq, inArray } from "drizzle-orm";
import { matches, matchPlayers, campeonatoSalaEstado } from "../../../db/schema/matches.js";
import { tournaments, tournamentMatches, bracketMatches, tournamentTeams, tournamentSeriesGames } from "../../../db/schema/tournaments.js";
import { teams } from "../../../db/schema/teams.js";
import { userRoles } from "../../../db/schema/identidade.js";
import { atribuirCodigoSerie } from "./serie-campeonato.js";
import { findUserTeamMemberships } from "./team-membership.js";
import { instanteJogo } from "./streams.js";
import { notifyMatchChange } from "./match-flow.js";
import { getRoles, eStaffSala } from "./acesso-sala.js";

/** Fases "vivas" da sala campeonato (fora delas, a sala não é mais a ativa). */
export const FASES_ATIVAS_CAMPEONATO = ["camp_vagas", "camp_prontos", "camp_lado", "camp_draft", "camp_jogo"];

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
async function ladoDoUsuarioNaSala(d: any, sala: any, userId: string): Promise<"blue" | "red" | null> {
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
    const bestOf = serie.phase === "finals" ? 5 : 3;

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

/** Entrar na vaga do seu time (time A = azul, time B = vermelho). */
export async function entrarNaVaga(
  d: any,
  opts: { salaNum: number; userId: string; side: "blue" | "red" }
): Promise<Resultado<{ estado: string }>> {
  const r: any = await d.transaction(async (tx: any) => {
    const [sala] = await tx.select().from(matches).where(eq(matches.salaNum, opts.salaNum)).limit(1).for("update");
    if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
    if (sala.mode !== "campeonato") return { ok: false, erro: "nao_e_sala_campeonato" };
    if (sala.status !== "camp_vagas") return { ok: false, erro: "estado_invalido" };

    const serie = await carregarSerieDaSala(tx, sala);
    if (!serie) return { ok: false, erro: "serie_nao_encontrada" };
    const { teamAId, teamBId } = await resolverTimesDaSerie(tx, serie);
    const teamId = opts.side === "blue" ? teamAId : teamBId;
    if (!teamId) return { ok: false, erro: "times_incompletos" };
    if (!(await usuarioNoTime(tx, opts.userId, teamId))) return { ok: false, erro: "nao_e_do_time" };

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
    if (sala.mode !== "campeonato") return { ok: false, erro: "nao_e_sala_campeonato" };
    if (!["camp_vagas", "camp_prontos"].includes(sala.status)) return { ok: false, erro: "estado_invalido" };

    const [jogador] = await tx
      .select()
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, sala.id), eq(matchPlayers.userId, opts.userId)))
      .limit(1);
    if (!jogador) return { ok: false, erro: "nao_esta_na_sala" };

    await tx.delete(matchPlayers).where(and(eq(matchPlayers.matchId, sala.id), eq(matchPlayers.userId, opts.userId)));
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
    if (sala.mode !== "campeonato") return { ok: false, erro: "nao_e_sala_campeonato" };
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
        // Jogo 1: a plataforma sorteia quem escolhe primeiro (ADR-079).
        const sorteio = Math.random() < 0.5 ? "blue" : "red";
        set.sorteioVencedor = sorteio;
        escolhaTime = sorteio;
      } else {
        // Jogos 2+: o perdedor do jogo anterior escolhe o lado.
        const serie = await carregarSerieDaSala(tx, sala);
        if (!serie) return { ok: false, erro: "serie_nao_encontrada" };
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
      }
      set.escolhaTime = escolhaTime;
      set.ladoEscolhido = null;
      set.pickOrderEscolhido = null;
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
 * Escolha de LADO (ADR-079): só o time da vez (`escolha_time`) escolhe, e a vez
 * passa para o adversário escolher o first/last pick. `lado_escolhido` é o lado
 * que o time ESCOLHEDOR joga; o adversário fica com o outro.
 */
export async function escolherLado(
  d: any,
  opts: { salaNum: number; userId: string; lado: "blue" | "red" }
): Promise<Resultado<{ estado: string }>> {
  const r: any = await d.transaction(async (tx: any) => {
    const [sala] = await tx.select().from(matches).where(eq(matches.salaNum, opts.salaNum)).limit(1).for("update");
    if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
    if (sala.mode !== "campeonato") return { ok: false, erro: "nao_e_sala_campeonato" };
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
    await tx
      .update(campeonatoSalaEstado)
      .set({ ladoEscolhido: opts.lado, escolhaTime: outro, updatedAt: new Date() })
      .where(eq(campeonatoSalaEstado.matchId, sala.id));
    return { ok: true, estado: "camp_lado" };
  });

  if (r?.ok) await notifyMatchChange(String(opts.salaNum));
  return r;
}

/**
 * Escolha do FIRST/LAST PICK: só o adversário do escolhedor (a vez atual). Ao
 * concluir, a sala vai para `camp_draft`. `escolha_time` fica com o time que
 * escolheu o pick order — o draft (passo 5) usa isso para montar a ordem.
 */
export async function escolherPickOrder(
  d: any,
  opts: { salaNum: number; userId: string; ordem: "first" | "last" }
): Promise<Resultado<{ estado: string }>> {
  const r: any = await d.transaction(async (tx: any) => {
    const [sala] = await tx.select().from(matches).where(eq(matches.salaNum, opts.salaNum)).limit(1).for("update");
    if (!sala) return { ok: false, erro: "sala_nao_encontrada" };
    if (sala.mode !== "campeonato") return { ok: false, erro: "nao_e_sala_campeonato" };
    if (sala.status !== "camp_lado") return { ok: false, erro: "estado_invalido" };

    const [estado] = await tx
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, sala.id))
      .limit(1);
    if (!estado?.escolhaTime || !estado.ladoEscolhido || estado.pickOrderEscolhido) {
      return { ok: false, erro: "estado_invalido" };
    }

    const meuLado = await ladoDoUsuarioNaSala(tx, sala, opts.userId);
    if (!meuLado) return { ok: false, erro: "nao_e_do_time" };
    if (meuLado !== estado.escolhaTime) return { ok: false, erro: "fora_da_vez" };

    await tx
      .update(campeonatoSalaEstado)
      .set({ pickOrderEscolhido: opts.ordem, updatedAt: new Date() })
      .where(eq(campeonatoSalaEstado.matchId, sala.id));
    await tx.update(matches).set({ status: "camp_draft", updatedAt: new Date() }).where(eq(matches.id, sala.id));
    return { ok: true, estado: "camp_draft" };
  });

  if (r?.ok) await notifyMatchChange(String(opts.salaNum));
  return r;
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
  return {
    jogo: estado?.jogo ?? 1,
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
        }
      : null,
  };
}
