/**
 * sala-campeonato-draft.ts — draft do modo campeonato (passo 5, ADRs 079/081/083).
 *
 * Diferenças para o draft das salas (api/src/lib/draft/):
 *  - a ordem ban/pick sai do FIRST/LAST PICK escolhido na sala (não do azul fixo):
 *    o template abaixo é escrito em papéis ['F' = primeiro pick, 'L' = último] e
 *    cada papel é mapeado para o LADO (blue/red) do time que o escolheu;
 *  - FEARLESS: campeão PICKADO em jogo anterior da série fica indisponível nos
 *    jogos seguintes (bans NÃO carregam — decisão do usuário 2026-10-11);
 *  - timeout: ban vencido vira ban vazio; pick vencido TRAVA o draft até alguém
 *    escolher (nunca cancela a sala — ADR-083);
 *  - um draft POR JOGO (match_drafts jogo = estado.jogo).
 */
import { and, eq, lt } from "drizzle-orm";
import { matches, matchDrafts, campeonatoSalaEstado } from "../../../db/schema/matches.js";
import { db } from "../db.js";
import { ladoDoUsuarioNaSala, carregarSerieDaSala } from "./sala-campeonato.js";
import { atribuirCodigoPartida } from "./match-flow.js";

/** Duração de um turno (mesmo relógio do servidor do draft das salas). */
export const DRAFT_TURNO_MS_CAMPEONATO = 30_000;
const DRAFT_GRACE_MS = 2_000;

/** Regras publicadas no shape (o front desenha a partir daqui). */
export const REGRAS_SHAPE_CAMPEONATO = {
  max_bans_por_lado: 5,
  max_picks_por_lado: 5,
  esconder_picks_adversario: false,
  role_controladora: "JG",
};

/** Ordem do tournament draft em papéis: F = primeiro pick, L = último (20 turnos). */
const TURN_TEMPLATE: { papel: "F" | "L"; phase: "ban" | "pick" }[] = [
  { papel: "F", phase: "ban" },
  { papel: "L", phase: "ban" },
  { papel: "F", phase: "ban" },
  { papel: "L", phase: "ban" },
  { papel: "F", phase: "ban" },
  { papel: "L", phase: "ban" },
  { papel: "F", phase: "pick" },
  { papel: "L", phase: "pick" },
  { papel: "L", phase: "pick" },
  { papel: "F", phase: "pick" },
  { papel: "F", phase: "pick" },
  { papel: "L", phase: "pick" },
  { papel: "L", phase: "ban" },
  { papel: "F", phase: "ban" },
  { papel: "L", phase: "ban" },
  { papel: "F", phase: "ban" },
  { papel: "L", phase: "pick" },
  { papel: "F", phase: "pick" },
  { papel: "F", phase: "pick" },
  { papel: "L", phase: "pick" },
];

/**
 * Lado que tem o FIRST PICK (ADR-091). `escolha_time` fica com quem fez a
 * ÚLTIMA escolha; o dono do pick order depende da ORDEM:
 *  - primeiraEscolha = 'lado' (ou null, fluxo antigo): o pick veio por último →
 *    o dono é o próprio escolha_time;
 *  - primeiraEscolha = 'pick': o pick veio primeiro → o dono é o OUTRO.
 * 'first' = o dono mesmo; 'last' = o outro.
 */
export function ladoPrimeiroPick(estado: any): "blue" | "red" {
  if (!estado?.escolhaTime || !estado?.pickOrderEscolhido) return "blue";
  const o = estado.escolhaTime as "blue" | "red";
  const s = o === "blue" ? "red" : "blue";
  const dono = (estado.primeiraEscolha ?? "lado") === "lado" ? o : s;
  const outro = dono === "blue" ? "red" : "blue";
  return estado.pickOrderEscolhido === "first" ? dono : outro;
}

function ladoDoPapel(papel: "F" | "L", estado: any): "blue" | "red" {
  const primeiro = ladoPrimeiroPick(estado);
  if (papel === "F") return primeiro;
  return primeiro === "blue" ? "red" : "blue";
}

/** Campeões PICKADOS em jogos anteriores da série (Fearless). */
export async function campeoesTravados(d: any, matchId: string, jogoAtual: number): Promise<string[]> {
  const rows = await d
    .select()
    .from(matchDrafts)
    .where(and(eq(matchDrafts.matchId, matchId), lt(matchDrafts.jogo, jogoAtual)));
  const travados = new Set<string>();
  for (const row of rows) {
    for (const c of [...(row.bluePicks ?? []), ...(row.redPicks ?? [])]) if (c) travados.add(c);
  }
  return [...travados];
}

/** Cria o draft do jogo corrente se ainda não existir (idempotente). */
export async function garantirDraftSalaCampeonato(tx: any, sala: any, estado: any) {
  const jogo = estado?.jogo ?? 1;
  const [existente] = await tx
    .select()
    .from(matchDrafts)
    .where(and(eq(matchDrafts.matchId, sala.id), eq(matchDrafts.jogo, jogo)))
    .limit(1);
  if (existente) return existente;

  const primeiro = TURN_TEMPLATE[0];
  const [row] = await tx
    .insert(matchDrafts)
    .values({
      matchId: sala.id,
      jogo,
      blueBans: [],
      bluePicks: [],
      redBans: [],
      redPicks: [],
      currentTurn: 0,
      currentPhase: primeiro.phase,
      currentTeam: ladoDoPapel(primeiro.papel, estado),
      turnDeadlineAt: new Date(Date.now() + DRAFT_TURNO_MS_CAMPEONATO),
      status: "ongoing",
    })
    .returning();
  return row;
}

/** Aplica o valor no time/fase da vez e avança (fecha no último turno). */
async function aplicarEAvancar(tx: any, draft: any, estado: any, valor: string | null, proximoDeadline: Date) {
  const key =
    draft.currentPhase === "ban"
      ? draft.currentTeam === "blue"
        ? "blueBans"
        : "redBans"
      : draft.currentTeam === "blue"
        ? "bluePicks"
        : "redPicks";
  const novos = [...(draft[key] ?? []), valor];
  const where = and(eq(matchDrafts.matchId, draft.matchId), eq(matchDrafts.jogo, draft.jogo));
  const proximo = draft.currentTurn + 1;

  if (proximo >= TURN_TEMPLATE.length) {
    await tx.update(matchDrafts).set({ [key]: novos, status: "finished", updatedAt: new Date() }).where(where);
    return { finalizado: true };
  }
  const t = TURN_TEMPLATE[proximo];
  await tx
    .update(matchDrafts)
    .set({
      [key]: novos,
      currentTurn: proximo,
      currentPhase: t.phase,
      currentTeam: ladoDoPapel(t.papel, estado),
      turnDeadlineAt: proximoDeadline,
      updatedAt: new Date(),
    })
    .where(where);
  return { finalizado: false };
}

async function aoFinalizar(tx: any, sala: any) {
  const serie = await carregarSerieDaSala(tx, sala);
  const agora = new Date();
  if (serie) {
    await tx.update(matches).set({ status: "camp_jogo", updatedAt: agora }).where(eq(matches.id, sala.id));
    return;
  }
  // Sala LIVRE (sem campeonato): ciclo normal da sala — código do pool +
  // iniciando_partida (daqui o motor de verificação da Riot assume).
  let codigo = sala.codigoPartida ?? null;
  if (!codigo) codigo = await atribuirCodigoPartida(tx, sala.id, sala.mode);
  await tx
    .update(matches)
    .set({
      status: "iniciando_partida",
      codigoPartida: codigo,
      iniciandoPartidaAt: agora,
      confirmacaoExpiresAt: null,
      stateDeadlineAt: new Date(agora.getTime() + 90_000),
      updatedAt: agora,
    })
    .where(eq(matches.id, sala.id));
}

/**
 * Saneia os prazos do draft do campeonato (catch-up). Ban vencido → ban vazio e
 * avança; pick vencido → TRAVA (break). PRÉ-CONDIÇÃO: linha de `matches` travada.
 */
export async function avaliarDraftSalaCampeonato(tx: any, sala: any): Promise<{ mudou: boolean; finalizado: boolean }> {
  const [estado] = await tx
    .select()
    .from(campeonatoSalaEstado)
    .where(eq(campeonatoSalaEstado.matchId, sala.id))
    .limit(1);
  if (!estado) return { mudou: false, finalizado: false };

  let [draft] = await tx
    .select()
    .from(matchDrafts)
    .where(and(eq(matchDrafts.matchId, sala.id), eq(matchDrafts.jogo, estado.jogo)))
    .limit(1)
    .for("update");
  if (!draft) return { mudou: false, finalizado: false };
  if (draft.status === "finished") return { mudou: false, finalizado: true };

  let mudou = false;
  // Teto = total de turnos: cobre o catch-up completo de uma sala largada.
  for (let i = 0; i <= TURN_TEMPLATE.length; i++) {
    if (!draft || draft.status !== "ongoing") break;
    const limite = new Date(draft.turnDeadlineAt).getTime() + DRAFT_GRACE_MS;
    if (Date.now() <= limite) break;
    // PICK VENCIDO TRAVA (ADR-083): espera alguém escolher; nunca cancela.
    if (draft.currentPhase === "pick") break;

    const proximoDeadline = new Date(new Date(draft.turnDeadlineAt).getTime() + DRAFT_TURNO_MS_CAMPEONATO);
    const r = await aplicarEAvancar(tx, draft, estado, null, proximoDeadline);
    mudou = true;
    if (r.finalizado) {
      await aoFinalizar(tx, sala);
      return { mudou, finalizado: true };
    }
    [draft] = await tx
      .select()
      .from(matchDrafts)
      .where(and(eq(matchDrafts.matchId, sala.id), eq(matchDrafts.jogo, estado.jogo)))
      .limit(1);
  }

  if (draft?.status === "finished") {
    await aoFinalizar(tx, sala);
    return { mudou, finalizado: true };
  }
  return { mudou, finalizado: false };
}

/**
 * Tick preguiçoso do draft de times: chamado em toda LEITURA do shape da sala
 * (o polling de 5s de qualquer aba cai aqui). Resolve o turno VENCIDO na hora:
 * ban vencido vira ban VAZIO e passa a vez automaticamente; pick vencido NÃO
 * anda (trava até alguém escolher — ADR-083). Sem isso a sala só destravava no
 * cron de 10 min. Abre a própria transação com lock — nunca chamar de dentro
 * de outra transação. Idempotente: sem turno vencido, é no-op.
 */
export async function tickDraftSalaCampeonato(salaId: string): Promise<boolean> {
  return db.transaction(async (tx: any) => {
    const [m] = await tx.select().from(matches).where(eq(matches.id, salaId)).limit(1).for("update");
    if (!m || m.status !== "camp_draft") return false;
    const [estado] = await tx
      .select()
      .from(campeonatoSalaEstado)
      .where(eq(campeonatoSalaEstado.matchId, m.id))
      .limit(1);
    if (!estado) return false;
    await garantirDraftSalaCampeonato(tx, m, estado);
    const r = await avaliarDraftSalaCampeonato(tx, m);
    return r.mudou;
  });
}

/**
 * Ação de ban/pick da sala campeonato. Valida a vez pelo LADO (blue/red) e pelo
 * vínculo do usuário com o time daquele lado (dono/membro aceito/convidado).
 * PRÉ-CONDIÇÃO: prazos saneados (`avaliarDraftSalaCampeonato` antes) e linha de
 * `matches` travada.
 */
export async function aplicarAcaoSalaCampeonato(
  tx: any,
  sala: any,
  userId: string,
  tipo: "ban" | "pick",
  championId: unknown
): Promise<{ ok: boolean; erro: string | null; finalizado?: boolean }> {
  const [estado] = await tx
    .select()
    .from(campeonatoSalaEstado)
    .where(eq(campeonatoSalaEstado.matchId, sala.id))
    .limit(1);
  if (!estado) return { ok: false, erro: "estado_ausente" };

  const [draft] = await tx
    .select()
    .from(matchDrafts)
    .where(and(eq(matchDrafts.matchId, sala.id), eq(matchDrafts.jogo, estado.jogo)))
    .limit(1)
    .for("update");
  if (!draft || draft.status !== "ongoing") return { ok: false, erro: "draft_indisponivel" };
  if (draft.currentPhase !== tipo) return { ok: false, erro: "fase_invalida" };

  const meuLado = await ladoDoUsuarioNaSala(tx, sala, userId);
  if (!meuLado) return { ok: false, erro: "nao_e_do_time" };
  if (meuLado !== draft.currentTeam) return { ok: false, erro: "fora_do_turno" };

  // Ban vencido: quem sanea é o avaliador (chamado ANTES da ação); se ainda
  // assim venceu, a ação chegou tarde. Pick vencido: TRAVA — aceita.
  if (draft.currentPhase === "ban" && Date.now() > new Date(draft.turnDeadlineAt).getTime() + DRAFT_GRACE_MS) {
    return { ok: false, erro: "tempo_expirado" };
  }

  const champ = typeof championId === "string" ? championId.trim() : "";
  if (!champ || champ.length > 50) return { ok: false, erro: "campeao_invalido" };
  const usados = [...draft.blueBans, ...draft.bluePicks, ...draft.redBans, ...draft.redPicks];
  if (usados.includes(champ)) return { ok: false, erro: "campeao_indisponivel" };
  // FEARLESS: picks de jogos anteriores da série também estão travados.
  const travados = await campeoesTravados(tx, sala.id, draft.jogo);
  if (travados.includes(champ)) return { ok: false, erro: "campeao_indisponivel" };

  const r = await aplicarEAvancar(tx, draft, estado, champ, new Date(Date.now() + DRAFT_TURNO_MS_CAMPEONATO));
  if (r.finalizado) await aoFinalizar(tx, sala);
  return { ok: true, erro: null, finalizado: r.finalizado };
}
