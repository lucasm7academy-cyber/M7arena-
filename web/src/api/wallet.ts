/**
 * src/api/wallet.ts
 *
 * ✅ FONTE ÚNICA DE SALDO da plataforma — substitui:
 *   - profiles.balance
 *   - saldos.saldo
 *   - contas_riot.mp / contas_riot.mc
 *   - time_membros.balance
 *
 * Todas as leituras/escritas de MP (M Points) e MC (M Coins) passam por aqui.
 * Toda movimentação cria automaticamente uma linha em `transacoes` (auditoria).
 */

import { api } from '../lib/api';

export interface Wallet {
  user_id: string;
  mp: number;
  mc: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Leituras
// ────────────────────────────────────────────────────────────────────────────

/** Lê wallet do usuário; retorna {mp:0, mc:0} se não existir. */
export async function buscarWallet(userId: string): Promise<Wallet> {
  const list = await api.wallet.adminBalances([userId]);
  const w = list?.[0];
  return w ? { user_id: w.userId, mp: w.mp, mc: w.mc } : { user_id: userId, mp: 0, mc: 0 };
}

/** Lê wallets em lote (otimização para listagens). */
export async function buscarWalletsEmLote(userIds: string[]): Promise<Record<string, Wallet>> {
  if (userIds.length === 0) return {};
  const list = await api.wallet.adminBalances(userIds);

  const map: Record<string, Wallet> = {};
  for (const id of userIds) map[id] = { user_id: id, mp: 0, mc: 0 };
  (list ?? []).forEach((w) => { map[w.userId] = { user_id: w.userId, mp: w.mp, mc: w.mc }; });
  return map;
}

// ────────────────────────────────────────────────────────────────────────────
// Escritas
//
// 🔒 FASE 0 — Fechamento de segurança da carteira.
//
// As RPCs cruas `incrementar_saldo` e `ajustar_mp` são `SECURITY DEFINER` e não
// verificavam QUEM chamava. Estando liberadas para `authenticated`, qualquer
// usuário logado conseguia se creditar saldo infinito pelo console do navegador.
// Como MC vira dinheiro real sacável, elas passaram a ser exclusivas de
// `service_role` — o navegador não pode mais executá-las.
//
// A partir daqui, o cliente só tem UM caminho de escrita: `admin_ajustar_saldo`,
// que valida o cargo (`proprietario` / `admin` em `platform_roles`) dentro do
// próprio banco. Crédito automático de partida (aposta/ranking) migra para
// lógica server-side nas fases seguintes.
// ────────────────────────────────────────────────────────────────────────────

/** Motivos de recusa devolvidos por `admin_ajustar_saldo`. */
export type ErroAjusteAdmin = 'nao_autorizado' | 'rpc_indisponivel' | string;

/** Retorno normalizado da RPC `admin_ajustar_saldo`. */
export interface RespostaAjusteAdmin {
  ok: boolean;
  erro: ErroAjusteAdmin | null;
  mc: number;
  mp: number;
}

/** Mensagem única usada pelos stubs abaixo — evita divergir o texto. */
const MSG_SOMENTE_SERVIDOR =
  '[wallet] Escrita de saldo bloqueada no cliente. ' +
  'As RPCs `incrementar_saldo` / `ajustar_mp` agora são exclusivas de service_role. ' +
  'Use `ajustarSaldoAdmin()` (painel admin) ou mova a operação para o servidor.';

/**
 * ⛔ DESATIVADA NO CLIENTE (Fase 0).
 *
 * Somava `valor` em wallets.mc via RPC `incrementar_saldo`. Essa RPC agora só
 * aceita `service_role`, então a chamada falharia com erro de permissão do
 * Postgres — algo opaco e difícil de diagnosticar em produção.
 *
 * Mantida como stub (em vez de removida) porque `src/api/player.ts` ainda a
 * referencia em `processarApostaPartida`, que será substituída por lógica
 * server-side na Fase 2. Falha rápido, sem round-trip de rede, e loga o motivo.
 *
 * @deprecated Use `ajustarSaldoAdmin()` (admin) ou o backend (automação).
 * @returns sempre `null` (o valor documentado de falha desta função).
 */
export async function ajustarMC(_userId: string, _valor: number): Promise<number | null> {
  console.error(`${MSG_SOMENTE_SERVIDOR} (ajustarMC)`);
  return null;
}

/**
 * ⛔ DESATIVADA NO CLIENTE (Fase 0).
 *
 * Somava `valor` em wallets.mp via RPC `ajustar_mp`, hoje exclusiva de
 * `service_role`. Mesmo racional do `ajustarMC` acima: vira stub para não
 * quebrar `atualizarPontosPartida` em `src/api/player.ts`, cuja premiação de MP
 * também migra para o servidor.
 *
 * @deprecated Use `ajustarSaldoAdmin()` (admin) ou o backend (automação).
 * @returns sempre `null` (o valor documentado de falha desta função).
 */
export async function ajustarMP(
  _userId: string,
  _valor: number,
  _descricao?: string,
  _refId?: string,
  _refTipo?: string,
): Promise<number | null> {
  console.error(`${MSG_SOMENTE_SERVIDOR} (ajustarMP)`);
  return null;
}

/**
 * Ajuste administrativo de saldo por DELTA (uso do painel admin).
 *
 * Chama a RPC `admin_ajustar_saldo`, que valida o cargo do chamador dentro do
 * banco e audita em `transacoes`. Uma única chamada move MC e MP juntos.
 * Retorna os saldos finais devolvidos pela própria RPC — não é preciso reler
 * `wallets` depois.
 */
export async function ajustarSaldoAdmin(
  userId: string,
  deltaMC: number,
  deltaMP: number,
  motivo: string = 'ajuste_admin',
): Promise<RespostaAjusteAdmin> {
  try {
    const r = await api.wallet.adminAdjust(userId, deltaMC, deltaMP, motivo);
    return {
      ok:   r.ok === true,
      erro: r.erro ?? null,
      mc:   typeof r.mc === 'number' ? r.mc : 0,
      mp:   typeof r.mp === 'number' ? r.mp : 0,
    };
  } catch (e: any) {
    // 401/403/400 vêm com { error } no corpo; o SDK lança com a mensagem.
    return { ok: false, erro: e?.message || 'rpc_indisponivel', mc: 0, mp: 0 };
  }
}

/**
 * Define MP/MC ABSOLUTOS (uso administrativo). Lê o saldo atual, calcula os
 * deltas e aplica os dois numa ÚNICA chamada de `admin_ajustar_saldo` — antes
 * eram duas RPCs separadas, o que podia deixar MP e MC inconsistentes se a
 * segunda falhasse.
 *
 * Passe `null` num campo para não mexer nele.
 *
 * Agora devolve `RespostaAjusteAdmin` (e não mais `Wallet | null`) para que o
 * chamador consiga distinguir "falhou" de "falhou por falta de permissão"
 * (`erro: 'nao_autorizado'`). Os saldos finais vêm em `mc` / `mp`.
 */
export async function setarSaldoAdmin(
  userId: string,
  novoMP: number | null,
  novoMC: number | null,
  motivo: string = 'ajuste_admin',
): Promise<RespostaAjusteAdmin> {
  const atual = await buscarWallet(userId);
  const deltaMP = novoMP !== null ? novoMP - atual.mp : 0;
  const deltaMC = novoMC !== null ? novoMC - atual.mc : 0;

  // Nada a fazer — devolve o estado atual sem gastar uma chamada.
  if (deltaMP === 0 && deltaMC === 0) {
    return { ok: true, erro: null, mc: atual.mc, mp: atual.mp };
  }

  return ajustarSaldoAdmin(userId, deltaMC, deltaMP, motivo);
}
