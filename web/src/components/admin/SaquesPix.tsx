// Painel admin "Saques PIX" (spec saque-mc-pix). Fila das solicitações por
// antiguidade (mais antigas primeiro) com a chave PIX completa para o admin
// pagar fora do sistema e confirmar. Decisão idempotente via decisionId.
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check, X, Loader2, AlertTriangle, RefreshCw, Clock, Coins, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react';
import { api, type ApiWithdrawal } from '../../lib/api';

function CardStyle() {
  return { border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)' };
}

function gerarUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback manual para uuid v4 válido (sem crypto.randomUUID)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function horasDesde(iso?: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h${min % 60 ? ` ${min % 60}min` : ''}`;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' },
  paid: { label: 'Pago', cls: 'bg-green-500/10 border-green-500/20 text-green-400' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-500/10 border-red-500/20 text-red-400' },
};

export function SaquesPix() {
  const [pedidos, setPedidos] = useState<ApiWithdrawal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; msg: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPedidos(await api.withdrawals.admin());
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar saques.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const decidir = useCallback(
    async (pedido: ApiWithdrawal, action: 'paid' | 'rejected') => {
      setProcessandoId(pedido.id);
      try {
        const r = await api.withdrawals.decide(pedido.id, action, gerarUuid());
        if (r.ok) {
          setPopup({
            tipo: 'sucesso',
            msg: action === 'paid'
              ? `Saque de ${brl(pedido.amountBrl)} marcado como pago.`
              : `Saque de ${brl(pedido.amountBrl)} rejeitado — MC devolvido.`,
          });
        }
      } catch (e: any) {
        if (e?.message === 'pedido_ja_decidido') {
          setPopup({ tipo: 'info', msg: 'Este saque já foi decidido por outro admin.' });
        } else {
          setPopup({ tipo: 'erro', msg: `Falha ao decidir: ${e?.message || 'erro'}` });
        }
      } finally {
        setProcessandoId(null);
        setTimeout(() => setPopup(null), 4000);
        carregar();
      }
    },
    [carregar]
  );

  const pendentes = pedidos
    .filter((p) => p.status === 'pending')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const historico = pedidos
    .filter((p) => p.status !== 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white uppercase">Saques PIX</h2>
        <button
          onClick={carregar}
          disabled={carregando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <AnimatePresence>
        {popup && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold ${
              popup.tipo === 'sucesso' ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : popup.tipo === 'info' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {popup.tipo === 'sucesso' ? <Check className="w-4 h-4" /> : popup.tipo === 'info' ? <AlertTriangle className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {popup.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {carregando && pendentes.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={CardStyle()}>
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-white/40 text-sm font-bold">Carregando solicitações...</p>
        </div>
      )}

      {!carregando && erro && (
        <div className="rounded-2xl p-8 border border-red-500/20 bg-red-500/5 text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-red-300 text-sm font-bold">{erro}</p>
        </div>
      )}

      {/* Fila dos pendentes */}
      <div>
        <p className="text-white/40 text-xs font-black uppercase mb-3">
          Pendentes ({pendentes.length})
        </p>
        {pendentes.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={CardStyle()}>
            <Check className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-white/40 text-sm font-bold">Nenhum saque aguardando pagamento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendentes.map((p) => {
              const processando = processandoId === p.id;
              return (
                <div key={p.id} className="rounded-2xl p-5 space-y-4" style={CardStyle()}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center shrink-0">
                        <ArrowDownCircle className="w-5 h-5 text-[#FFD700]" />
                      </div>
                      <div>
                        <p className="text-white font-black text-sm">
                          {p.displayName || p.riotId || 'Jogador'}
                          {p.riotId && <span className="text-white/40 text-xs ml-2">{p.riotId}</span>}
                        </p>
                        <p className="text-white/40 text-xs flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Solicitado {horasDesde(p.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700] text-[10px] font-black uppercase tracking-widest">
                        <Coins className="w-3 h-3" />
                        {p.mcAmount.toLocaleString('pt-BR')} MC
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest">
                        {brl(p.amountBrl)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Chave PIX de destino</p>
                    <p className="text-white font-black text-sm">{p.pixName}</p>
                    <p className="text-white/60 text-xs mt-0.5">
                      [{p.pixType}] <span className="font-bold">{p.pixKey}</span>
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => decidir(p, 'paid')}
                      disabled={processando}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border bg-green-500/15 border-green-500/30 text-green-300 hover:bg-green-500/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Marcar como Pago
                    </button>
                    <button
                      onClick={() => decidir(p, 'rejected')}
                      disabled={processando}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border bg-red-500/5 border-red-500/20 text-red-400/80 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Rejeitar (devolve MC)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico recente */}
      {historico.length > 0 && (
        <div>
          <p className="text-white/40 text-xs font-black uppercase mb-3">Histórico recente</p>
          <div className="space-y-2">
            {historico.slice(0, 20).map((p) => {
              const st = STATUS[p.status] || STATUS.pending;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 border border-white/5 bg-white/[0.02]">
                  <div className="min-w-0">
                    <p className="text-white font-black text-sm truncate">
                      {p.displayName || p.riotId || 'Jogador'}
                      <span className="text-white/40 text-xs ml-2">{p.mcAmount.toLocaleString('pt-BR')} MC · {brl(p.amountBrl)}</span>
                    </p>
                    <p className="text-white/30 text-[10px] mt-0.5 truncate">{p.pixKey}</p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
