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

import { eq, and, gt } from "drizzle-orm";
import { db, pool } from "../db.js";
import { users, userSessions } from "../../../db/schema/identidade.js";
import { matches, matchPlayers, matchCodes } from "../../../db/schema/matches.js";
import { roleSlotToSlot } from "./match-shape.js";
import { reservarEntrada as reservarEntradaEscrow, devolverEntrada } from "./escrow.js";

const TEMPO_CONFIRMACAO_MS = 60_000;
const TEMPO_INICIO_MS = 30_000;

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
 * cliente do LoL — inventar um número quebra. Teto do pool: 4 partidas.
 */
export async function atribuirCodigoPartida(tx: any, matchId: string, _mode: string): Promise<string> {
  const [row]: any[] = await tx
    .select({ id: matchCodes.id, code: matchCodes.code })
    .from(matchCodes)
    .where(eq(matchCodes.used, false))
    .orderBy(matchCodes.createdAt)
    .limit(1)
    .for("update", { skipLocked: true });

  if (!row) return "SEM-CODIGO-AGUARDE";

  await tx
    .update(matchCodes)
    .set({ used: true, matchId })
    .where(eq(matchCodes.id, row.id));
  return row.code;
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
        await tx
          .update(matches)
          .set({
            status: "confirmacao",
            confirmacaoExpiresAt: new Date(Date.now() + TEMPO_CONFIRMACAO_MS),
            iniciandoPartidaAt: null,
            stateDeadlineAt: new Date(Date.now() + TEMPO_CONFIRMACAO_MS),
          })
          .where(eq(matches.id, matchId));
        avancou = true;
      }
    } else if (m.status === "confirmacao") {
      if (m.confirmacaoExpiresAt == null) {
        await tx
          .update(matches)
          .set({
            confirmacaoExpiresAt: new Date(Date.now() + TEMPO_CONFIRMACAO_MS),
            stateDeadlineAt: new Date(Date.now() + TEMPO_CONFIRMACAO_MS),
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
        avancou = true;
      } else if (new Date(m.confirmacaoExpiresAt).getTime() < Date.now()) {
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

// ── ELEGIBILIDADE E STRIKES (design v3 §2.1) ─────────────────────────────────
// Vivem em `lib/elegibilidade.ts` (regras puras de acesso). Re-exportados aqui
// para as rotas manterem o import antigo de match-flow sem quebra.
export {
  ESTADOS_ATIVOS,
  LIMITES,
  contarStrikesAtivos,
  aplicarSuspensaoSeNecessario,
  removerStrike,
  validarElegibilidade,
} from "./elegibilidade.js";
