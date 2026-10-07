/**
 * draft-flow.ts — ban/pick da sala (estado `draft`), 100% server-authoritative.
 *
 * Portado do sistema antigo (M7AcademySite, commit e4b7457 — último com o draft
 * renderizado), corrigindo a causa raiz dos problemas de timer: no site antigo
 * o `timer_end` era um `Date.now()` DO CLIENTE, então relógios diferentes (fuso,
 * NTP, aba aberta há horas) desregulavam o prazo. Aqui o prazo é
 * `turn_deadline_at` — timestamp do SERVIDOR. O front deriva o restante com o
 * clockSync (`agoraServidor()`), igual às salas (ajustarsala F2).
 *
 * Regras (todas decididas aqui, nunca no cliente):
 *  - Turno/fase/time vêm da TURN_ORDER do modo; o cliente só desenha.
 *  - Só participante CONFIRMADO do time da vez age; campeão repetido é recusado.
 *  - Ban vencido → ban vazio (null) e avança (mesmo comportamento do antigo).
 *  - Pick vencido → cancela o draft e a sala volta para `preenchendo` (o AFK
 *    cai no timeout de confirmação existente, que remove quem não confirma).
 *  - Último turno aplicado → draft `finished`; a sala vira `iniciando_partida`
 *    com o código atribuído (avaliarTransicoes em match-flow.ts).
 *
 * Catch-up: avaliarDraft avança TODOS os turnos vencidos em sequência (prazo
 * seguinte = prazo anterior + 30s), então uma sala largada por minutos resolve
 * numa única avaliação — sem depender de cliente nenhum estar aberto (o cron
 * chama a mesma função).
 */

import { eq, and } from "drizzle-orm";
import { matchDrafts, matchPlayers } from "../../../db/schema/matches.js";

/** Duração de um turno (o que o cliente mostra). */
export const DRAFT_TURN_MS = 30_000;
/**
 * Tolerância de rede DEPOIS do prazo: aceita a ação que saiu antes do fim mas
 * chegou alguns ms depois. Depois disso, a avaliação automática age.
 */
export const DRAFT_GRACE_MS = 2_000;

type DraftTeam = "blue" | "red";
type DraftPhase = "ban" | "pick";
export interface TurnInfo {
  team: DraftTeam;
  phase: DraftPhase;
}

// ─── Draft tournament 5v5 / time_vs_time (20 turnos) ─────────────────────────
// Fase 1 bans (6) → Fase 1 picks (6) → Fase 2 bans (4) → Fase 2 picks (4).
export const TURN_ORDER_5V5: TurnInfo[] = [
  { team: "blue", phase: "ban" }, // 0
  { team: "red", phase: "ban" }, // 1
  { team: "blue", phase: "ban" }, // 2
  { team: "red", phase: "ban" }, // 3
  { team: "blue", phase: "ban" }, // 4
  { team: "red", phase: "ban" }, // 5
  { team: "blue", phase: "pick" }, // 6
  { team: "red", phase: "pick" }, // 7
  { team: "red", phase: "pick" }, // 8
  { team: "blue", phase: "pick" }, // 9
  { team: "blue", phase: "pick" }, // 10
  { team: "red", phase: "pick" }, // 11
  { team: "red", phase: "ban" }, // 12
  { team: "blue", phase: "ban" }, // 13
  { team: "red", phase: "ban" }, // 14
  { team: "blue", phase: "ban" }, // 15
  { team: "red", phase: "pick" }, // 16
  { team: "blue", phase: "pick" }, // 17
  { team: "blue", phase: "pick" }, // 18
  { team: "red", phase: "pick" }, // 19
];

// ─── Draft 1v1 / ARAM (4 turnos) ─────────────────────────────────────────────
// 1 ban por lado + 1 pick por lado.
export const TURN_ORDER_1V1: TurnInfo[] = [
  { team: "blue", phase: "ban" }, // 0
  { team: "red", phase: "ban" }, // 1
  { team: "blue", phase: "pick" }, // 2
  { team: "red", phase: "pick" }, // 3
];

export function getTurnOrder(mode: string): TurnInfo[] {
  return mode === "1v1" || mode === "aram" ? TURN_ORDER_1V1 : TURN_ORDER_5V5;
}

/**
 * Cria o draft da sala (limpa qualquer sobra antes — igual ao criarDraft antigo,
 * que garantia reset completo). PRÉ-CONDIÇÃO: linha de `matches` travada.
 */
export async function criarDraft(tx: any, matchId: string, mode: string) {
  await tx.delete(matchDrafts).where(eq(matchDrafts.matchId, matchId));
  const ordem = getTurnOrder(mode);
  const primeiro = ordem[0];
  const [row] = await tx
    .insert(matchDrafts)
    .values({
      matchId,
      blueBans: [],
      bluePicks: [],
      redBans: [],
      redPicks: [],
      currentTurn: 0,
      currentPhase: primeiro.phase,
      currentTeam: primeiro.team,
      turnDeadlineAt: new Date(Date.now() + DRAFT_TURN_MS),
      status: "ongoing",
    })
    .returning();
  return row;
}

/**
 * Aplica `valor` no array do time/fase da vez e avança o turno. No último
 * turno, fecha o draft (`status = 'finished'`). PRÉ-CONDIÇÃO: draft travado.
 */
async function aplicarEAvancar(
  tx: any,
  draft: any,
  mode: string,
  valor: string | null,
  proximoDeadline: Date
): Promise<{ finalizado: boolean }> {
  const key =
    draft.currentPhase === "ban"
      ? draft.currentTeam === "blue"
        ? "blueBans"
        : "redBans"
      : draft.currentTeam === "blue"
        ? "bluePicks"
        : "redPicks";

  const novos = [...(draft[key] ?? []), valor];
  const ordem = getTurnOrder(mode);
  const proximo = draft.currentTurn + 1;

  if (proximo >= ordem.length) {
    await tx
      .update(matchDrafts)
      .set({ [key]: novos, status: "finished", updatedAt: new Date() })
      .where(eq(matchDrafts.matchId, draft.matchId));
    return { finalizado: true };
  }

  const info = ordem[proximo];
  await tx
    .update(matchDrafts)
    .set({
      [key]: novos,
      currentTurn: proximo,
      currentPhase: info.phase,
      currentTeam: info.team,
      turnDeadlineAt: proximoDeadline,
      updatedAt: new Date(),
    })
    .where(eq(matchDrafts.matchId, draft.matchId));
  return { finalizado: false };
}

/**
 * Avalia os prazos vencidos do draft (lazy, idempotente). PRÉ-CONDIÇÃO: linha de
 * `matches` travada pelo chamador (evita corrida entre ticks de 10 clientes).
 *
 * Retorna o que aconteceu para o chamador decidir a transição da SALA:
 *  - `mudou`: algum turno avançou ou o draft fechou/cancelou;
 *  - `finalizado`: draft completo (sala deve ir para `iniciando_partida`);
 *  - `cancelou`: pick venceu (sala volta para `preenchendo`).
 */
export async function avaliarDraft(
  tx: any,
  match: any
): Promise<{ mudou: boolean; finalizado: boolean; cancelou: boolean }> {
  const [draftInicial] = await tx
    .select()
    .from(matchDrafts)
    .where(eq(matchDrafts.matchId, match.id))
    .limit(1)
    .for("update");
  if (!draftInicial) return { mudou: false, finalizado: false, cancelou: false };

  let draft: any = draftInicial;
  if (draft.status === "finished") return { mudou: false, finalizado: true, cancelou: false };

  const ordem = getTurnOrder(match.mode);
  let mudou = false;

  // Teto = quantidade de turnos: cobre o catch-up completo de uma sala largada.
  for (let i = 0; i <= ordem.length; i++) {
    if (!draft || draft.status !== "ongoing") break;

    const limite = new Date(draft.turnDeadlineAt).getTime() + DRAFT_GRACE_MS;
    if (Date.now() <= limite) break;

    if (draft.currentPhase === "pick") {
      // Pick vencido: sem pick válido o draft não fecha — cancela e a sala
      // volta a `preenchendo` (o AFK cai no timeout de confirmação).
      return { mudou: true, finalizado: false, cancelou: true };
    }

    // Ban vencido: ban vazio (null) e avança. O próximo prazo segue a régua do
    // turno anterior (+30s) para a sala largada alcançar o tempo real.
    const proximoDeadline = new Date(new Date(draft.turnDeadlineAt).getTime() + DRAFT_TURN_MS);
    const r = await aplicarEAvancar(tx, draft, match.mode, null, proximoDeadline);
    mudou = true;
    if (r.finalizado) return { mudou, finalizado: true, cancelou: false };

    const [d2] = await tx.select().from(matchDrafts).where(eq(matchDrafts.matchId, match.id)).limit(1);
    draft = d2;
  }

  if (draft?.status === "finished") return { mudou, finalizado: true, cancelou: false };
  return { mudou, finalizado: false, cancelou: false };
}

/**
 * Ação de ban/pick disparada por um cliente. PRÉ-CONDIÇÃO: `avaliarTransicoes`
 * já rodou (prazos saneados) e a linha de `matches` está travada.
 */
export async function aplicarAcaoDraft(
  tx: any,
  match: any,
  userId: string,
  tipo: "ban" | "pick",
  championId: unknown
): Promise<{ ok: boolean; erro: string | null; estado: string | null; mudou: boolean; finalizado?: boolean }> {
  const [draft] = await tx
    .select()
    .from(matchDrafts)
    .where(eq(matchDrafts.matchId, match.id))
    .limit(1)
    .for("update");
  if (!draft || draft.status !== "ongoing") {
    return { ok: false, erro: "draft_indisponivel", estado: match.status, mudou: false };
  }

  const limite = new Date(draft.turnDeadlineAt).getTime() + DRAFT_GRACE_MS;
  if (Date.now() > limite) {
    return { ok: false, erro: "tempo_expirado", estado: match.status, mudou: false };
  }

  const [jogador] = await tx
    .select()
    .from(matchPlayers)
    .where(
      and(
        eq(matchPlayers.matchId, match.id),
        eq(matchPlayers.userId, userId),
        eq(matchPlayers.confirmed, true)
      )
    )
    .limit(1);
  if (!jogador) return { ok: false, erro: "nao_participante", estado: match.status, mudou: false };
  if (jogador.side !== draft.currentTeam) {
    return { ok: false, erro: "fora_do_turno", estado: match.status, mudou: false };
  }
  if (draft.currentPhase !== tipo) {
    return { ok: false, erro: "fase_invalida", estado: match.status, mudou: false };
  }

  const champ = typeof championId === "string" ? championId.trim() : "";
  if (!champ || champ.length > 50) {
    return { ok: false, erro: "campeao_invalido", estado: match.status, mudou: false };
  }
  const usados = [...draft.blueBans, ...draft.bluePicks, ...draft.redBans, ...draft.redPicks];
  if (usados.includes(champ)) {
    return { ok: false, erro: "campeao_indisponivel", estado: match.status, mudou: false };
  }

  const r = await aplicarEAvancar(tx, draft, match.mode, champ, new Date(Date.now() + DRAFT_TURN_MS));
  return { ok: true, erro: null, estado: match.status, mudou: true, finalizado: r.finalizado };
}
