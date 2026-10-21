/**
 * match-flow.ts — máquina de estados de sala e economia das partidas.
 *
 * Portado da migration `20260731000002_maquina_estados_sala_servidor.sql` do
 * site antigo (RPCs `sala_*` SECURITY DEFINER) para a API Node. Invariante do
 * projeto: **transição de estado, débito e payout são decididos aqui, no
 * servidor** — o cliente só dispara ações e exibe o resultado.
 *
 * Convenção: toda função recebe `tx` (a transação Drizzle) para que a chamada
 * route rode atômica — lock de linha em `matches`, débito e lançamentos no
 * mesmo commit.
 *
 * Códigos de erro estáveis que o front traduz (ERROS_SALA em salamod1.ts):
 * nao_autenticado, sala_nao_encontrada, estado_invalido, vaga_ocupada,
 * ja_em_outra_sala, nao_esta_na_sala, ja_confirmado, nao_pode_sair,
 * saldo_insuficiente.
 */

import { eq, and, gt, sql, isNull } from "drizzle-orm";
import { db, pool } from "../db.js";
import { users, userSessions } from "../../../db/schema/identidade.js";
import { matches, matchPlayers, matchCodes, matchDrafts } from "../../../db/schema/matches.js";
import { roleSlotToSlot } from "./match-shape.js";
import { reservarEntrada as reservarEntradaEscrow, devolverEntrada } from "./escrow.js";
import { avaliarDraft, criarDraft, temDraft } from "./draft/index.js";
import { CONFIRMACAO_SERIE_MS, estadoSerie, jogoAtualSerie } from "./serie-sala.js";

const TEMPO_CONFIRMACAO_MS = 75_000;
const TEMPO_INICIO_MS = 90_000;

/** Usuário autenticado pela sessão (cookie httpOnly) ou Bearer token. */
export async function getAuthUser(req: any) {
  const token = req.cookies?.m7_session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;

  const [session] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.sessionToken, token), gt(userSessions.expires, new Date())))
    .limit(1);

  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user || null;
}

/** Dispara notificação Postgres para o serviço WebSocket (realtime). */
export async function notifyMatchChange(matchId: string) {
  try {
    const client = await pool.connect();
    await client.query("SELECT pg_notify('matches_channel', $1)", [JSON.stringify({ matchId, timestamp: Date.now() })]);
    client.release();
  } catch (error: any) {
    // Não derruba a ação por causa do realtime (fallback é polling HTTP).
    console.error(`[matches] pg_notify falhou: ${error?.message}`);
  }
}

function resultado(ok: boolean, erro: string | null, estado: string | null, mudou = false) {
  return { ok, erro, estado, mudou };
}

/** Conta jogadores da sala. */
async function totalJogadores(tx: any, matchId: string): Promise<number> {
  const rows = await tx
    .select({ id: matchPlayers.userId })
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, matchId));
  return rows.length;
}

/** Soma os confirmados da sala. */
async function totalConfirmados(tx: any, matchId: string): Promise<number> {
  const rows = await tx
    .select({ id: matchPlayers.userId })
    .from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.confirmed, true)));
  return rows.length;
}

/**
 * Janela de confirmação. Entre jogos da SÉRIE 5v5 é maior (5 min) de propósito:
 * é a janela em que os jogadores podem "Recusar" (sair) e outro entrar no lugar
 * antes do próximo draft. No primeiro jogo — e nos demais modos — segue os 75s
 * históricos.
 */
async function janelaConfirmacao(tx: any, m: any): Promise<number> {
  if (m.mode !== "5v5") return TEMPO_CONFIRMACAO_MS;
  const st = await estadoSerie(tx, m.id);
  return st && (st.jogo ?? 1) > 1 ? CONFIRMACAO_SERIE_MS : TEMPO_CONFIRMACAO_MS;
}

// ── ECONOMIA ────────────────────────────────────────────────────────────────

/**
 * Alias de transição: `debitarEntrada` agora reserva (escrow). As rotas novas
 * usam `reservarEntrada` diretamente; este nome fica para não quebrar chamadas
 * existentes enquanto a troca acontece. O ledger passa a gravar
 * `match_entry_reserve` (não mais `match_entry`).
 */
export async function debitarEntrada(tx: any, userId: string, entryMp: number, matchId: string) {
  await reservarEntradaEscrow(tx, userId, entryMp, matchId);
}

/**
 * Reembolsa o stake quando a partida não acontece (sair/cancelar antes do
 * vínculo). Idempotente via `devolverEntrada` (no-op se nada está reservado).
 */
export async function reembolsarSeNecessario(tx: any, userId: string, entryMp: number, matchId: string) {
  await devolverEntrada(tx, userId, entryMp, matchId);
}

// ── POOL DE CÓDIGOS DE PARTIDA ──────────────────────────────────────────────

/**
 * Reserva um tournament code real do pool (`match_codes`) com lock de linha
 * (FOR UPDATE SKIP LOCKED). Código é valor real da Riot que o jogador cola no
 * cliente do LoL — inventar um número quebra.
 *
 * Fila por modo (ADR-041): o modo 1v1 (x1) só usa códigos com `mode='1v1'`
 * (os 2 códigos ARAM BR050c8-*); os demais modos (5v5/aram/time_vs_time) usam
 * os códigos genéricos (`mode IS NULL`, os 6 BR04fa2-* 5v5 Tournament Draft).
 * Um modo nunca pega código da fila do outro.
 *
 * Rodízio LRU (ADR-040): pega o código livre usado há MAIS tempo (NULLS FIRST
 * = nunca usado entra primeiro). Com N códigos e partidas que terminam, o
 * ciclo natural é 1→2→…→N→1 — quando todos já foram usados, volta ao primeiro,
 * que já teve tempo de terminar. Teto do pool: N partidas simultâneas.
 */
export async function atribuirCodigoPartida(tx: any, matchId: string, mode: string): Promise<string> {
  const [row]: any[] = await tx
    .select({ id: matchCodes.id, code: matchCodes.code })
    .from(matchCodes)
    .where(
      and(
        eq(matchCodes.used, false),
        mode === "1v1" ? eq(matchCodes.mode, "1v1") : isNull(matchCodes.mode)
      )
    )
    .orderBy(sql`${matchCodes.lastUsedAt} ASC NULLS FIRST`)
    .limit(1)
    .for("update", { skipLocked: true });

  if (!row) return "SEM-CODIGO-AGUARDE";

  await tx
    .update(matchCodes)
    .set({ used: true, matchId, lastUsedAt: new Date() })
    .where(eq(matchCodes.id, row.id));
  return row.code;
}

/**
 * Coloca a sala em `iniciando_partida` com o código atribuído. Dois caminhos
 * chegam aqui: o draft FECHOU (5v5/time_vs_time) ou o modo NÃO TEM draft
 * (1v1/ARAM — confirmou, pulou a fase). PRÉ-CONDIÇÃO: linha travada.
 */
async function iniciarPartidaComCodigo(tx: any, m: any, matchId: string) {
  let codigo = m.codigoPartida;
  if (!codigo || codigo === "") {
    codigo = await atribuirCodigoPartida(tx, matchId, m.mode);
  }
  const agora = new Date();
  await tx
    .update(matches)
    .set({
      status: "iniciando_partida",
      iniciandoPartidaAt: agora,
      confirmacaoExpiresAt: null,
      codigoPartida: codigo,
      stateDeadlineAt: new Date(agora.getTime() + TEMPO_INICIO_MS),
    })
    .where(eq(matches.id, matchId));
}

// ── MÁQUINA DE ESTADOS ──────────────────────────────────────────────────────

/**
 * Núcleo da máquina de estados. PRÉ-CONDIÇÃO: quem chama já travou a linha em
 * `matches` com FOR UPDATE. Roda até estabilizar (teto de 4 voltas) para que
 * uma ação encadeie transições na mesma transação (ex.: preencher a última
 * vaga já dispara 'confirmacao' antes da rota retornar).
 */
export async function avaliarTransicoes(tx: any, matchId: string): Promise<{ estado: string | null; mudou: boolean }> {
  let mudou = false;
  for (let i = 0; i < 4; i++) {
    const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!m) return { estado: null, mudou };

    const total = await totalJogadores(tx, matchId);
    const confirmados = await totalConfirmados(tx, matchId);
    const max = m.maxJogadores ?? 10;
    let avancou = false;

    if (m.status === "preenchendo") {
      if (total > 0 && total >= max) {
        await tx
          .update(matchPlayers)
          .set({ confirmed: false })
          .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.confirmed, true)));
        const janela = await janelaConfirmacao(tx, m);
        await tx
          .update(matches)
          .set({
            status: "confirmacao",
            confirmacaoExpiresAt: new Date(Date.now() + janela),
            iniciandoPartidaAt: null,
            stateDeadlineAt: new Date(Date.now() + janela),
          })
          .where(eq(matches.id, matchId));
        avancou = true;
      }
    } else if (m.status === "confirmacao") {
      if (m.confirmacaoExpiresAt == null) {
        const janela = await janelaConfirmacao(tx, m);
        await tx
          .update(matches)
          .set({
            confirmacaoExpiresAt: new Date(Date.now() + janela),
            stateDeadlineAt: new Date(Date.now() + janela),
          })
          .where(eq(matches.id, matchId));
        avancou = true;
      } else if (total < max) {
        await tx
          .update(matchPlayers)
          .set({ confirmed: false })
          .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.confirmed, true)));
        await tx
          .update(matches)
          .set({
            status: "preenchendo",
            confirmacaoExpiresAt: null,
            iniciandoPartidaAt: null,
            stateDeadlineAt: null,
          })
          .where(eq(matches.id, matchId));
        avancou = true;
      } else if (total > 0 && confirmados >= total) {
        await tx
          .update(matchPlayers)
          .set({ linked: true })
          .where(eq(matchPlayers.matchId, matchId));
        if (temDraft(m.mode)) {
          // Modo com draft (5v5/time_vs_time): abre o ban/pick do JOGO corrente
          // da série (jogo 1 nas salas normais). O código da partida só é
          // atribuído quando o draft FECHA (iniciando_partida).
          await criarDraft(tx, matchId, m.mode, await jogoAtualSerie(tx, m));
          await tx
            .update(matches)
            .set({
              status: "draft",
              confirmacaoExpiresAt: null,
              iniciandoPartidaAt: null,
              stateDeadlineAt: null,
            })
            .where(eq(matches.id, matchId));
        } else {
          // Modo sem draft (1v1/ARAM, registry api/src/lib/draft): pula a fase
          // e vai direto para `iniciando_partida` com o código.
          await iniciarPartidaComCodigo(tx, m, matchId);
        }
        avancou = true;
      } else if (new Date(m.confirmacaoExpiresAt).getTime() < Date.now()) {
        // Escrow: jogadores removidos pelo timeout de confirmação NÃO podem
        // perder o stake. Devolver primeiro, deletar depois — a carteira é a
        // fonte da verdade (escrow.ts: invariante mc + mc_reservado = total).
        const removidos = await tx
          .select({ userId: matchPlayers.userId })
          .from(matchPlayers)
          .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.confirmed, false), eq(matchPlayers.linked, false)));
        const aposta = m.apostaMc ?? m.entryMp ?? 0;
        for (const p of removidos) {
          await devolverEntrada(tx, p.userId, aposta, matchId);
        }
        await tx
          .delete(matchPlayers)
          .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.confirmed, false), eq(matchPlayers.linked, false)));
        await tx
          .update(matchPlayers)
          .set({ confirmed: false })
          .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.confirmed, true)));
        await tx
          .update(matches)
          .set({
            status: "preenchendo",
            confirmacaoExpiresAt: null,
            iniciandoPartidaAt: null,
            stateDeadlineAt: null,
          })
          .where(eq(matches.id, matchId));
        avancou = true;
      }
    } else if (m.status === "draft") {
      // Draft em andamento (ban/pick). A avaliação só usa o PRAZO DO SERVIDOR
      // (turn_deadline_at): ban vencido vira ban vazio; pick vencido cancela o
      // draft e a sala volta a `preenchendo`. Quando o draft fecha, o código é
      // atribuído e a sala segue para `iniciando_partida`.
      const d = await avaliarDraft(tx, m);
      if (d.cancelou) {
        const jogo = await jogoAtualSerie(tx, m);
        await tx
          .delete(matchDrafts)
          .where(and(eq(matchDrafts.matchId, matchId), eq(matchDrafts.jogo, jogo)));
        await tx
          .update(matchPlayers)
          .set({ confirmed: false, linked: false })
          .where(eq(matchPlayers.matchId, matchId));
        await tx
          .update(matches)
          .set({
            status: "preenchendo",
            confirmacaoExpiresAt: null,
            iniciandoPartidaAt: null,
            stateDeadlineAt: null,
          })
          .where(eq(matches.id, matchId));
        avancou = true;
      } else if (d.finalizado) {
        // Draft fechou: atribui o código (se ainda não tem) e inicia a partida.
        await iniciarPartidaComCodigo(tx, m, matchId);
        avancou = true;
      } else if (d.mudou) {
        avancou = true; // turno avançou por timeout; a linha já está no banco
      }
    } else if (m.status === "iniciando_partida") {
      if (m.iniciandoPartidaAt == null) {
        const agora = new Date();
        await tx
          .update(matches)
          .set({
            iniciandoPartidaAt: agora,
            stateDeadlineAt: new Date(agora.getTime() + TEMPO_INICIO_MS),
          })
          .where(eq(matches.id, matchId));
        avancou = true;
      } else if (new Date(m.iniciandoPartidaAt).getTime() + TEMPO_INICIO_MS < Date.now()) {
        await tx
          .update(matches)
          .set({ status: "partida_iniciada", stateDeadlineAt: null })
          .where(eq(matches.id, matchId));
        avancou = true;
      }
    }

    if (!avancou) break;
    mudou = true;
  }

  const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  return { estado: m?.status ?? null, mudou };
}

/**
 * Entra em `aguardando_revisao` (design v3 §6). PRÉ-CONDIÇÃO: quem chama já
 * travou a linha em `matches` com FOR UPDATE.
 *
 * Decisão do usuário (2026-08-03): TODAS as salas — casuais e apostadas —
 * passam pelo admin. A votação red/blue no cliente foi removida; o resultado
 * é decidido por print + aprovação no painel (apostadas pagam escrow, casuais
 * só marcam o resultado). Zera o deadline: a revisão não tem timeout técnico,
 * o SLA é humano (admin decide).
 */
export async function entrarEmRevisao(tx: any, matchId: string) {
  const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
  if (!m) return { ok: false, erro: "sala_nao_encontrada" };
  if (m.status !== "partida_iniciada") return { ok: false, erro: "estado_invalido", estado: m.status };
  await tx
    .update(matches)
    .set({ status: "aguardando_revisao", revisaoDesde: new Date(), stateDeadlineAt: null })
    .where(eq(matches.id, matchId));
  return { ok: true, estado: "aguardando_revisao" };
}

/** Retorna a sala (linha de `matches`) por sala_num, ou null. */
export async function buscarSalaPorNumero(dbOrTx: any, salaNum: number) {
  const [m] = await dbOrTx.select().from(matches).where(eq(matches.salaNum, salaNum)).limit(1);
  return m || null;
}

/** Retorna a sala por id (uuid), ou null. */
export async function buscarSalaPorId(dbOrTx: any, id: string) {
  const [m] = await dbOrTx.select().from(matches).where(eq(matches.id, id)).limit(1);
  return m || null;
}

/** Normaliza um vínculo de vaga (role + lado) — usado pela rota join. */
export function normalizarVaga(role: string | undefined, isTimeA: boolean) {
  const roleLimpo = (role || "RES").trim().toUpperCase() || "RES";
  return {
    roleSlot: roleLimpo,
    slot: roleSlotToSlot(roleLimpo),
    side: isTimeA ? "blue" : "red",
  };
}

// ── ELEGIBILIDADE E PUNIÇÕES (ADR-033) ───────────────────────────────────────
// Vivem em `lib/elegibilidade.ts` (regras puras de acesso). Re-exportados aqui
// para as rotas manterem o import antigo de match-flow sem quebra.
export {
  ESTADOS_ATIVOS,
  ESTADOS_BLOQUEIO_NOVA_APOSTA,
  LIMITES,
  contarAdvertenciasAtivas,
  aplicarBanAutomaticoSeNecessario,
  removerAdvertencia,
  validarElegibilidade,
} from "./elegibilidade.js";
