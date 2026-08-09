import { eq, and, gt, ne, isNull, inArray } from "drizzle-orm";
import { users, userRoles, userWallets } from "../../../db/schema/identidade.js";
import { matches, matchPlayers } from "../../../db/schema/matches.js";
import { userAdvertencias } from "../../../db/schema/apostas.js";

/**
 * elegibilidade.ts — regras de acesso às salas e punições (ADR-033).
 * A fonte da verdade é o servidor: `validarElegibilidade` é re-checado dentro
 * da transação com FOR UPDATE nas rotas de join/criar.
 *
 * Punições são MANUAIS: o admin/proprietário aplica advertências (viram um
 * contador no perfil) ou ban. 3 advertências ativas → ban automático, que só
 * sai quando o admin desbana (mesmo o automático). O ban bloqueia CASUAL E
 * APOSTADA. O sistema antigo de strikes automáticos (kick de ociosidade e
 * abandono) e a suspensão temporária foram removidos.
 *
 * Casuais (aposta 0) só exigem conta ativa + Riot ID; apostadas exigem as
 * checagens adicionais. Admin (role admin/proprietário) sempre pode entrar —
 * não é bloqueado por punição, outra sala ativa ou termos.
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
 * Limites das punições (ADR-033). Centralizados aqui para ajuste fácil
 * enquanto não existe tabela app_config.
 */
export const LIMITES = {
  ADVERTENCIAS_PARA_BAN: 3,
};

/**
 * Conta advertências ATIVAS (não removidas) do usuário. Advertência não
 * expira — fica até o admin remover. É o contador que o perfil mostra.
 */
export async function contarAdvertenciasAtivas(tx: any, userId: string) {
  const rows = await tx
    .select({ id: userAdvertencias.id })
    .from(userAdvertencias)
    .where(and(eq(userAdvertencias.userId, userId), isNull(userAdvertencias.removidoEm)));
  return rows.length;
}

/**
 * Aplica ban AUTOMÁTICO quando o jogador atinge o teto de advertências
 * (3). `ban_automatico=true` registra a origem (as advertências), mas o ban
 * em si é permanente até o admin desbanir — não reverte sozinho ao remover
 * uma advertência (ADR-033).
 */
export async function aplicarBanAutomaticoSeNecessario(tx: any, userId: string) {
  const total = await contarAdvertenciasAtivas(tx, userId);
  if (total >= LIMITES.ADVERTENCIAS_PARA_BAN) {
    await tx
      .update(users)
      .set({
        status: "banida",
        banidoEm: new Date(),
        banAutomatico: true,
        banMotivo: "3 advertências",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
  return total;
}

/**
 * Remove uma advertência (admin). Seta `removido_por`/`removido_em` — o
 * contador cai, mas NÃO desbana sozinho: ban (mesmo automático) só sai com o
 * admin chamando o unban. Retorna o total de advertências ativas depois, ou
 * null se a advertência não existe.
 */
export async function removerAdvertencia(tx: any, advertenciaId: string, removidoPor: string) {
  const [advertencia] = await tx.select().from(userAdvertencias).where(eq(userAdvertencias.id, advertenciaId)).limit(1);
  if (!advertencia) return null;
  if (!advertencia.removidoEm) {
    await tx
      .update(userAdvertencias)
      .set({ removidoPor, removidoEm: new Date() })
      .where(eq(userAdvertencias.id, advertencia.id));
  }
  return contarAdvertenciasAtivas(tx, advertencia.userId);
}

/**
 * Regras de acesso a salas (ADR-033) — a fonte da verdade é o servidor,
 * re-checadas dentro da transação com FOR UPDATE. `apostaMc` é o valor da
 * sala: casuais (0) só exigem conta ativa + Riot ID; apostadas exigem as
 * checagens adicionais. Admin (role admin/proprietário) sempre pode entrar —
 * não é bloqueado por punição, outra sala ativa ou termos.
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

  // 1. Conta ativa — vale para toda sala (casual e apostada). Ban bloqueia
  //    tudo; não existe mais suspensão temporária (ADR-033).
  if (user.status === "banida") return { ok: false as const, erro: "conta_banida" };

  const apostada = Number(apostaMc ?? 0) > 0;

  // 2. Riot ID vinculado — obrigatório para TODA sala (casual e apostada).
  //    Decisão do dono (2026-08-04): até casual exige conta vinculada; é o que
  //    amarra o print ao jogador e previne multi-conta. Anti-multi-conta para
  //    todos, não só apostadas.
  if (!user.riotId) return { ok: false as const, erro: "riot_id_obrigatorio" };

  if (!apostada) return { ok: true as const };

  // 3. Saldo suficiente — o modal mostra exatamente quanto falta.
  const [w] = await tx.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1).for("update");
  const saldo = w?.mc ?? 0;
  if (saldo < apostaMc) return { ok: false as const, erro: "saldo_insuficiente", faltam: apostaMc - saldo };

  // 4. Uma sala apostada ativa por vez.
  if (!isAdmin) {
    const [outra] = await tx
      .select({ salaNum: matches.salaNum, modo: matches.mode })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .where(and(
        eq(matchPlayers.userId, userId),
        gt(matches.apostaMc, 0),
        inArray(matches.status, ESTADOS_ATIVOS),
        ...(ignorarMatchId ? [ne(matches.id, ignorarMatchId)] : []),
      ))
      .limit(1);
    if (outra) return { ok: false as const, erro: "ja_em_sala_apostada", extra: { sala_num: outra.salaNum, modo: outra.modo } };
  }

  // 5. Termos aceitos (declaração de 18+ no cadastro).
  if (!isAdmin && !user.termosAceitosEm) return { ok: false as const, erro: "termos_nao_aceitos" };

  return { ok: true as const };
}
