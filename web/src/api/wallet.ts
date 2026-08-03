/**
 * src/api/wallet.ts
 *
 * Saldo do usuário logado e ajuste administrativo. Toda leitura de MP/MC passa
 * pela API própria (`/wallet/*`); movimentação automática (aposta/ranking) é
 * decisão do servidor, nunca do navegador.
 */

import { api } from '../lib/api';

export interface Wallet {
  user_id: string;
  mp: number;
  mc: number;
}

/** Motivos de recusa devolvidos por `admin_ajustar_saldo`. */
export type ErroAjusteAdmin = 'nao_autorizado' | 'rpc_indisponivel' | string;

/** Retorno normalizado da RPC `admin_ajustar_saldo`. */
export interface RespostaAjusteAdmin {
  ok: boolean;
  erro: ErroAjusteAdmin | null;
  mc: number;
  mp: number;
}

/**
 * Ajuste administrativo de saldo por DELTA (uso do painel admin).
 * Chama a RPC `admin_ajustar_saldo`, que valida o cargo do chamador dentro do
 * banco e audita em `transacoes`. Retorna os saldos finais devolvidos pela
 * própria RPC — não é preciso reler `wallets` depois.
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
