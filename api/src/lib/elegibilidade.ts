import { eq, and, gt, ne, isNull, inArray } from "drizzle-orm";
import { users, userRoles, userWallets } from "../../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";
import { userStrikes } from "../../../db/schema/apostas.js";

/**
 * elegibilidade.ts — regras de acesso e strikes das salas apostadas
 * (design v3 §2.1). A fonte da verdade é o servidor: `validarElegibilidade`
 * é re-checado dentro da transação com FOR UPDATE nas rotas de join/criar.
 *
 * Casuais (aposta 0) só exigem conta ativa + Riot ID; apostadas exigem todas
 * as 6 checagens. Admin (role admin/proprietário) sempre pode entrar — não é
 * bloqueado por punição, outra sala ativa ou termos.
 */

/** Estados em que a sala está "viva" (contagem do painel admin). */
export const ESTADOS_ATIVOS = [
  "preenchendo",
  "confirmacao",
  "iniciando_partida",
  "partida_iniciada",
  "aguardando_revisao",
];

/**
 * Limites operacionais das salas apostadas (design v3 §2.1). Centralizados aqui
 * para ajuste fácil enquanto não existe tabela app_config.
 */
export const LIMITES = {
  STRIKES_PARA_SUSPENSAO: 3,
  JANELA_STRIKES_DIAS: 30,
  SUSPENSAO_HORAS: 12,
};

/**
 * Conta strikes ativos (não removidos) do usuário dentro da janela configurada
 * (30 dias). O que decide o perfil do jogador é a contagem, não o estado.
 */
export async function contarStrikesAtivos(tx: any, userId: string, agora = new Date()) {
  const janela = new Date(agora.getTime() - LIMITES.JANELA_STRIKES_DIAS * 24 * 60 * 60 * 1000);
  const rows = await tx
    .select({ id: userStrikes.id })
    .from(userStrikes)
    .where(and(eq(userStrikes.userId, userId), isNull(userStrikes.removidoEm), gt(userStrikes.createdAt, janela)));
  return rows.length;
}

/**
 * Aplica suspensão de salas apostadas quando o jogador atinge o teto de strikes
 * (3 em 30 dias → `status='suspensa'` por 12h). O cron reativa ao expirar.
 * Retorna o total de strikes ativos após a checagem.
 */
export async function aplicarSuspensaoSeNecessario(tx: any, userId: string, agora = new Date()) {
  const total = await contarStrikesAtivos(tx, userId, agora);
  if (total >= LIMITES.STRIKES_PARA_SUSPENSAO) {
    await tx
      .update(users)
      .set({
        status: "suspensa",
        suspensaAte: new Date(agora.getTime() + LIMITES.SUSPENSAO_HORAS * 60 * 60 * 1000),
        updatedAt: agora,
      })
      .where(eq(users.id, userId));
  }
  return total;
}

/**
 * Perdoa um strike (admin): seta `removido_por`/`removido_em`. Se a contagem
 * cair abaixo do teto, reativa a conta que foi suspensa POR CAUSA dos strikes
 * (status 'suspensa' → 'active'). Retorna o total de strikes ativos depois, ou
 * null se o strike não existe.
 */
export async function removerStrike(tx: any, strikeId: string, removidoPor: string) {
  const [strike] = await tx.select().from(userStrikes).where(eq(userStrikes.id, strikeId)).limit(1);
  if (!strike) return null;
  if (!strike.removidoEm) {
    await tx
      .update(userStrikes)
      .set({ removidoPor, removidoEm: new Date() })
      .where(eq(userStrikes.id, strike.id));
  }
  const total = await contarStrikesAtivos(tx, strike.userId);
  if (total < LIMITES.STRIKES_PARA_SUSPENSAO) {
    const [u] = await tx.select().from(users).where(eq(users.id, strike.userId)).limit(1);
    if (u?.status === "suspensa") {
      await tx
        .update(users)
        .set({ status: "active", suspensaAte: null, updatedAt: new Date() })
        .where(eq(users.id, u.id));
    }
  }
  return total;
}

/**
 * Regras de acesso a salas (design v3 §2.1) — a fonte da verdade é o servidor,
 * re-checadas dentro da transação com FOR UPDATE. `apostaMc` é o valor da sala:
 * casuais (0) só exigem conta ativa + Riot ID; apostadas exigem todas as 6
 * checagens. Admin (role admin/proprietário) sempre pode entrar — não é
 * bloqueado por punição, outra sala ativa ou termos.
 *
 * `ignorarMatchId` exclui a sala atual da regra "uma sala apostada ativa por
 * vez" (troca de vaga na mesma sala). Retorno:
 * `{ ok: true }` ou `{ ok: false, erro, faltam?, extra? }`.
 */
export async function validarElegibilidade(tx: any, userId: string, apostaMc: number, ignorarMatchId?: string) {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { ok: false as const, erro: "conta_nao_encontrada" };

  const roles = await tx.select().from(userRoles).where(eq(userRoles.userId, userId));
  const isAdmin = roles.some((r: any) => r.role === "admin" || r.role === "proprietario");

  // 1. Conta ativa — vale para toda sala (casual incluída).
  if (user.status === "banida") return { ok: false as const, erro: "conta_banida" };
  if (!isAdmin && user.status === "suspensa" && user.suspensaAte && user.suspensaAte.getTime() > Date.now()) {
    return { ok: false as const, erro: "conta_suspensa", extra: { suspensa_ate: user.suspensaAte } };
  }

  const apostada = Number(apostaMc ?? 0) > 0;

  // 2. Riot ID vinculado — obrigatório para TODA sala (casual e apostada).
  // Decisão do dono (2026-08-04): até casual exige conta vinculada; é o que
  // amarra o print ao jogador e previne multi-conta. Anti-multi-conta para
  // todos, não só apostadas.
  if (!user.riotId) return { ok: false as const, erro: "riot_id_obrigatorio" };

  if (!apostada) return { ok: true as const };

  // 3. Saldo suficiente — o modal mostra exatamente quanto falta.
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  const saldo = w?.mc ?? 0;
  if (saldo < apostaMc) return { ok: false as const, erro: "saldo_insuficiente", faltam: apostaMc - saldo };

  // 4. Uma sala apostada ativa por vez.
  if (!isAdmin) {
    const [outra] = await tx
      .select({ salaNum: matches.salaNum })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .where(and(
        eq(matchPlayers.userId, userId),
        gt(matches.apostaMc, 0),
        inArray(matches.status, ESTADOS_ATIVOS),
        ...(ignorarMatchId ? [ne(matches.id, ignorarMatchId)] : []),
      ))
      .limit(1);
    if (outra) return { ok: false as const, erro: "ja_em_sala_apostada", extra: { sala_num: outra.salaNum } };
  }

  // 5. Sem punição ativa — 3 strikes em 30 dias suspendem salas apostadas.
  if (!isAdmin) {
    const strikes = await contarStrikesAtivos(tx, userId);
    if (strikes >= LIMITES.STRIKES_PARA_SUSPENSAO) {
      await aplicarSuspensaoSeNecessario(tx, userId);
      const [u] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      const liberadoEm = u?.suspensaAte ?? new Date(Date.now() + LIMITES.SUSPENSAO_HORAS * 60 * 60 * 1000);
      return { ok: false as const, erro: "suspenso_por_strikes", extra: { liberado_em: liberadoEm } };
    }
  }

  // 6. Termos aceitos (declaração de 18+ no cadastro).
  if (!isAdmin && !user.termosAceitosEm) return { ok: false as const, erro: "termos_nao_aceitos" };

  return { ok: true as const };
}
