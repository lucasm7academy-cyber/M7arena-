import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Minus, Plus, AlertTriangle, Check, Clock, Swords, Gamepad2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, type ApiBetCatalog, type ApiBetQueue, type ApiBetTicket, type ApiBetGroup } from '../../lib/api';
import { usePerfil } from '../../contexts/PerfilContext';
import { ItemMercado } from './ItemMercado';

const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
const CUT_FRAME_INNER = 'polygon(13.8px 0, 100% 0, 100% calc(100% - 13.8px), calc(100% - 13.8px) 100%, 0 100%, 0 13.8px)';
const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';
const CUT_BUTTON_INNER = 'polygon(8.8px 0, 100% 0, 100% calc(100% - 8.8px), calc(100% - 8.8px) 100%, 0 100%, 0 8.8px)';

const ACCENT = '#FFB700';
const PROFILE_ICON_URL = (id: number) =>
  `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${id}.png`;

const GROUP_ORDER: ApiBetGroup[] = ['resultado', 'kills', 'first_blood'];
const GROUP_LABEL: Record<ApiBetGroup, string> = {
  resultado: 'Resultado',
  kills: 'Abates (Kills)',
  first_blood: 'First Blood',
};

interface Selecao {
  marketKey: string;
  odd: number;
  stake: number;
}

interface Propriedades {
  onClose: () => void;
}

export const ApostaIndividual: React.FC<Propriedades> = ({ onClose }) => {
  const { perfil } = usePerfil();
  const [catalog, setCatalog] = useState<ApiBetCatalog | null>(null);
  const [queue, setQueue] = useState<ApiBetQueue>('solo');
  const [stake, setStake] = useState(100);
  const [selecoes, setSelecoes] = useState<Record<string, Selecao>>({});
  const [ativo, setAtivo] = useState<ApiBetTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submeter, setSubmeter] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, act] = await Promise.all([api.bets.catalog(), api.bets.active()]);
      setCatalog(cat);
      setAtivo(act);
    } catch (e: any) {
      console.error('[ApostaIndividual] falha ao carregar:', e?.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // O usuário vê o "stake" digitado; preseleção usa o mesmo valor do input.
  const toggle = useCallback((marketKey: string, odd: number) => {
    if (ativo) return;
    setSelecoes((prev) => {
      const has = !!prev[marketKey];
      const next = { ...prev };
      if (has) { delete next[marketKey]; return next; }
      next[marketKey] = { marketKey, odd, stake };
      return next;
    });
  }, [ativo, stake]);

  const mudarStake = useCallback((delta: number) => {
    setStake((s) => {
      const novo = Math.max(100, Math.min(5000, s + delta));
      return novo;
    });
  }, []);

  // Sincroniza o stake do input para as seleções ainda não confirmadas.
  useEffect(() => {
    if (!stake) return;
    setSelecoes((prev) => {
      let mudou = false;
      const next: Record<string, Selecao> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = { ...v, stake };
        if (v.stake !== stake) mudou = true;
      }
      return mudou ? next : prev;
    });
  }, [stake]);

  const legs = useMemo(() => Object.values(selecoes), [selecoes]);
  const payoutTotal = useMemo(() => {
    return legs.reduce((acc, l) => acc + Math.floor(l.stake * l.odd), 0);
  }, [legs]);
  const stakeTotal = useMemo(() => legs.reduce((acc, l) => acc + l.stake, 0), [legs]);

  const handleApostar = async () => {
    if (!catalog) return;
    if (legs.length === 0) { toast.error('Selecione pelo menos um mercado.'); return; }
    if (stakeTotal < catalog.minStake) { toast.error(`Aposta mínima de ${catalog.minStake} MC por mercado.`); return; }
    if ((perfil?.saldo ?? 0) < stakeTotal) { toast.error('Saldo insuficiente de MC.'); return; }
    setSubmeter(true);
    try {
      const legsBody = legs.map((l) => ({ marketKey: l.marketKey, stake: l.stake }));
      await api.bets.create({ queue, legs: legsBody });
      toast.success('Aposta registrada! Boa sorte na partida.');
      setSelecoes({});
      await carregar();
    } catch (e: any) {
      const cod = e?.message;
      if (cod === 'ja_tem_bilhete_aguardando') toast.error('Você já tem uma aposta aguardando entrar em jogo.');
      else if (cod === 'riot_id_obrigatorio' || cod === 'termos_nao_aceitos') toast.error('Vincule sua conta Riot e aceite os termos para apostar.');
      else if (cod === 'saldo_insuficiente') toast.error('Saldo insuficiente de MC.');
      else toast.error(e?.message || 'Erro ao apostar.');
    }
    setSubmeter(false);
  };

  const handleCancelarAtivo = async () => {
    if (!ativo) return;
    const confirmou = window.confirm('Cancelar esta aposta? O MC reservado será devolvido.');
    if (!confirmou) return;
    try {
      await api.bets.cancel(ativo.id);
      toast.success('Aposta cancelada. MC devolvido.');
      setAtivo(null);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao cancelar.');
    }
  };

  const handleSync = async () => {
    if (!ativo) return;
    try {
      const r = await api.bets.sync(ativo.id);
      if (r.status === 'em_jogo') toast.success('Partida detectada! Aposta em andamento.');
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao verificar.');
    }
  };

  const ativoLegs = ativo?.legs ?? [];
  const totalPayoutAtivo = ativoLegs.reduce((a, l) => a + l.payout, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.08 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.08 }}
        className="relative p-[1.5px] w-full max-w-md shadow-2xl flex flex-col max-h-[92vh]"
        style={{ clipPath: CUT_FRAME, background: `linear-gradient(135deg, ${ACCENT}, #FFE082 50%, rgba(255,255,255,0.15))`, boxShadow: '0 0 45px -10px rgba(255,183,0,0.35), 0 25px 50px -12px rgba(0,0,0,0.9)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full bg-[#09090c] flex flex-col overflow-hidden min-h-0" style={{ clipPath: CUT_FRAME_INNER }}>
          {/* Header */}
          <div className="p-4 sm:p-5 pb-3">
            <button onClick={onClose} className="absolute top-4 right-4 p-[1px] bg-white/10 hover:bg-white/20 transition-colors z-20 cursor-pointer" style={{ clipPath: CUT_BUTTON }} title="Fechar">
              <div className="w-7 h-7 bg-[#141418] hover:bg-[#202028] flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors" style={{ clipPath: CUT_BUTTON_INNER }}>
                <X className="w-4 h-4" />
              </div>
            </button>
            <div className="flex items-center gap-3.5 pr-8">
              <div className="relative p-[1px] shrink-0" style={{ clipPath: CUT_BUTTON, background: 'linear-gradient(135deg, #FFB700, transparent)' }}>
                <div className="w-11 h-11 flex items-center justify-center bg-[#121217]" style={{ clipPath: CUT_BUTTON_INNER }}>
                  <Zap className="w-6 h-6" style={{ color: ACCENT }} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black mb-1" style={{ clipPath: CUT_BUTTON, background: ACCENT }}>
                  Aposta Individual
                </span>
                <h2 className="text-[#EDEDEE] uppercase tracking-tight text-xl leading-none truncate select-none" style={{ fontFamily: '"Anton","Arial Narrow","Bahnschrift Condensed",Impact,sans-serif', letterSpacing: '0.02em' }}>
                  Aposte em Você
                </h2>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#FFB700] border-t-transparent" />
            </div>
          ) : ativo ? (
            // ── Status do bilhete ativo ──
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-5 pb-5">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-[#121217] border border-white/10" style={{ clipPath: CUT_BUTTON }}>
                  <div className="w-10 h-10 p-[1px] shrink-0" style={{ clipPath: CUT_BUTTON, background: ativo.status === 'em_jogo' ? 'linear-gradient(135deg,#22c55e,transparent)' : 'linear-gradient(135deg,#FFB700,transparent)' }}>
                    <div className="w-full h-full bg-[#0c0c10] flex items-center justify-center" style={{ clipPath: CUT_BUTTON_INNER }}>
                      {ativo.status === 'em_jogo' ? <Gamepad2 className="w-5 h-5 text-green-400" /> : <Clock className="w-5 h-5 text-[#FFB700]" />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-white/60">
                      {ativo.status === 'em_jogo' ? 'Em jogo — detectado!' : 'Aguardando sua próxima partida'}
                    </p>
                    <p className="text-xs text-white/40">{catalog?.queues.find((q) => q.id === ativo.queue)?.label} • espera até {new Date(ativo.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                {ativoLegs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-3 bg-[#111116] border border-white/8" style={{ clipPath: CUT_BUTTON }}>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">{l.label}</span>
                    <span className="text-[10px] font-black text-white/40">{l.odd}x • {l.stake} MC</span>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Retorno potencial</span>
                  <span className="text-lg font-black" style={{ color: ACCENT }}>{totalPayoutAtivo} MC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Status geral</span>
                  <span className="text-xs font-black text-white/80">{ativo.resultado?.toUpperCase() ?? 'Aguardando'}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3">
                  <button onClick={handleSync} className="p-[1px] cursor-pointer" style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.1)' }}>
                    <div className="w-full py-2.5 flex items-center justify-center gap-2 bg-[#121217] text-zinc-200 text-xs font-black uppercase tracking-wider" style={{ clipPath: CUT_BUTTON_INNER }}>
                      <RefreshCw className="w-3.5 h-3.5" /> Verificar
                    </div>
                  </button>
                  <button onClick={handleCancelarAtivo} className="p-[1px] cursor-pointer" style={{ clipPath: CUT_BUTTON, background: 'rgba(239,68,68,0.4)' }}>
                    <div className="w-full py-2.5 flex items-center justify-center gap-2 bg-[#121217] text-red-400 text-xs font-black uppercase tracking-wider" style={{ clipPath: CUT_BUTTON_INNER }}>
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : catalog ? (
            // ── Seletor de mercados ──
            <>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-5 pb-4">
                <div className="space-y-4">
                  {/* Fila */}
                  <div>
                    <label className="text-zinc-400 text-[10px] uppercase tracking-widest font-black mb-1.5 block">Fila ranqueada</label>
                    <div className="grid grid-cols-2 gap-2">
                      {catalog.queues.map((q) => (
                        <button key={q.id} onClick={() => setQueue(q.id)} className="p-[1px] transition-all cursor-pointer" style={{ clipPath: CUT_BUTTON, background: queue === q.id ? 'linear-gradient(135deg,#FFB700,#FFE082)' : 'rgba(255,255,255,0.1)' }}>
                          <div className="w-full py-2.5 flex items-center justify-center gap-2 bg-[#121217] text-xs font-black uppercase tracking-wider" style={{ clipPath: CUT_BUTTON_INNER, color: queue === q.id ? '#FFB700' : 'rgba(255,255,255,0.6)' }}>
                            <Swords className="w-3.5 h-3.5" /> {q.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stake */}
                  <div>
                    <label className="text-zinc-400 text-[10px] uppercase tracking-widest font-black mb-1.5 block">Valor por mercado (MC) — mín. {catalog.minStake}</label>
                    <div className="relative p-[1px]" style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.15)' }}>
                      <div className="flex items-center bg-[#111116]" style={{ clipPath: CUT_BUTTON_INNER }}>
                        <button onClick={() => mudarStake(-100)} className="p-3 text-white/60 hover:text-[#FFB700] transition-colors cursor-pointer">
                          <Minus className="w-4 h-4" />
                        </button>
                        <div className="flex-1 text-center py-2.5 text-white font-black text-sm">{stake} MC</div>
                        <button onClick={() => mudarStake(100)} className="p-3 text-white/60 hover:text-[#FFB700] transition-colors cursor-pointer">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mercados por grupo */}
                  {GROUP_ORDER.map((g) => (
                    <div key={g}>
                      <label className="text-zinc-400 text-[10px] uppercase tracking-widest font-black mb-1.5 block">{GROUP_LABEL[g]}</label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {catalog.markets[g].map((m) => (
                          <ItemMercado key={m.key} market={m} odd={`${m.odd}x`} selecionado={!!selecoes[m.key]} onClick={() => toggle(m.key, m.odd)} />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Limite */}
                  <div className="flex items-start gap-2 p-3 bg-[#0c0c10] border border-white/5" style={{ clipPath: CUT_BUTTON }}>
                    <AlertTriangle className="w-4 h-4 text-[#FFB700] shrink-0 mt-0.5" />
                    <p className="text-[10px] text-white/40 leading-snug">
                      Retorno máximo por bilhete: {catalog.maxPayout} MC. Se a partida não começar em {catalog.lockMinutes} min, a aposta é cancelada e o MC volta.
                    </p>
                  </div>
                </div>
              </div>

              {/* Rodapé apostar */}
              <div className="p-4 sm:p-5 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Total apostado</span>
                  <span className="text-sm font-black text-white">{stakeTotal} MC</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Retorno potencial</span>
                  <span className="text-lg font-black" style={{ color: ACCENT }}>{payoutTotal} MC</span>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleApostar} disabled={submeter}
                  className="w-full relative p-[1px] cursor-pointer disabled:opacity-50" style={{ clipPath: CUT_BUTTON, background: 'linear-gradient(135deg,#FFB700,#FFE082,#FFB700)', boxShadow: '0 0 25px -5px rgba(255,183,0,0.6)' }}>
                  <div className="w-full py-3.5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black transition-all" style={{ clipPath: CUT_BUTTON_INNER, background: ACCENT }}>
                    <Zap className="w-4 h-4" /> {submeter ? 'Apostando...' : 'Apostar Agora'}
                  </div>
                </motion.button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center py-16 text-white/40 text-xs font-bold uppercase tracking-widest">
              Não foi possível carregar os mercados.
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ApostaIndividual;
