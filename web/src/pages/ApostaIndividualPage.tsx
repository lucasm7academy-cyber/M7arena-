import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Zap, Minus, Plus, AlertTriangle, Swords, Gamepad2, RefreshCw, X, Trophy, Medal, Clock, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, type ApiBetCatalog, type ApiBetQueue, type ApiBetTicket, type ApiBetGroup } from '../lib/api';
import { usePerfil } from '../contexts/PerfilContext';
import { buildProfileIconUrl } from '../api/riot';
import { ItemMercado } from '../components/partidas/ItemMercado';

const ACCENT = '#FFB700';

const GROUP_ORDER: ApiBetGroup[] = ['resultado', 'kills', 'first_blood'];
const GROUP_LABEL: Record<ApiBetGroup, string> = {
  resultado: 'Resultado da Partida',
  kills: 'Abates (Kills)',
  first_blood: 'First Blood',
};

// Cards de escolha de fila (img de fundo do LoL). `bg` é o fundo; `accent` a cor.
const FILAS: { id: ApiBetQueue; label: string; sub: string; bg: string; accent: string }[] = [
  { id: 'solo', label: 'Solo Duo', sub: 'Ranqueada Solo/Duo', bg: '/images/fundoCard5v5.webp', accent: '#3b82f6' },
  { id: 'flex', label: 'Ranqueada Flexível', sub: 'Flex', bg: '/images/fundoCardAram.webp', accent: '#a855f7' },
];

interface Selecao {
  marketKey: string;
  odd: number;
  stake: number;
}

export default function ApostaIndividualPage() {
  const navigate = useNavigate();
  const { perfil } = usePerfil();
  const [catalog, setCatalog] = useState<ApiBetCatalog | null>(null);
  const [queue, setQueue] = useState<ApiBetQueue>('solo');
  const [stake, setStake] = useState(100);
  const [selecoes, setSelecoes] = useState<Record<string, Selecao>>({});
  const [ativo, setAtivo] = useState<ApiBetTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submeter, setSubmeter] = useState(false);
  // Fila ainda NÃO escolhida: mostra a tela de seleção antes dos mercados.
  const [filaEscolhida, setFilaEscolhida] = useState<ApiBetQueue | null>(null);

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
    setStake((s) => Math.max(100, Math.min(5000, s + delta)));
  }, []);

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
  const payoutTotal = useMemo(() => legs.reduce((acc, l) => acc + Math.floor(l.stake * l.odd), 0), [legs]);
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
      else if (cod === 'ja_em_jogo_ranqueada') toast.error('Você já está em partida ranqueada — termine antes de apostar.');
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
  const nick = perfil?.nome || 'Jogador';
  const tag = perfil?.tag || '';
  const iconId = perfil?.iconId || 0;

  return (
    <div className="flex-1 w-full min-h-screen bg-[#050505] font-sans relative overflow-x-hidden text-white">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,183,0,0.05)_0%,#050505_100%)]" />
      </div>

      {/* ── TOP BAR (padrão sala) ── */}
      <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-20 w-full flex items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 bg-black/60 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl flex-wrap md:flex-nowrap">
        <div className="flex items-center gap-3 z-10">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
            onClick={() => navigate('/jogar')}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-red-500/40 transition-colors flex items-center justify-center text-white/70 hover:text-red-400 shrink-0 cursor-pointer"
            title="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div className="min-w-0">
            <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black mb-0.5 rounded-md" style={{ background: ACCENT }}>
              Aposta Individual
            </span>
            <h1 className="text-white font-black uppercase tracking-tight text-lg sm:text-xl leading-none truncate" style={{ fontFamily: '"Anton","Arial Narrow","Bahnschrift Condensed",Impact,sans-serif', letterSpacing: '0.02em' }}>
              Aposte em Você
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 z-10">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-[10px] font-black uppercase text-[#FFB700] inline-flex items-center gap-1">
              <Coins className="w-3 h-3" /> Saldo: {perfil?.saldo ?? 0} MC
            </span>
          </div>
        </div>
      </motion.div>

      <div className="relative z-10 max-w-[1400px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        {/* ── COLUNA JOGADOR (ícone + nick) ── */}
        <div className="rounded-2xl bg-[#0a0a0d] border border-white/10 p-5 flex flex-col items-center text-center h-fit">
          <span className="inline-block px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black mb-4 rounded-md" style={{ background: ACCENT }}>
            Seu Summoner
          </span>
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-40" style={{ background: ACCENT }} />
            {iconId ? (
              <img src={buildProfileIconUrl(iconId)} alt="Ícone do invocador" className="relative w-24 h-24 rounded-full object-cover border-2 border-[#FFB700]/60 shadow-[0_0_25px_-5px_rgba(255,183,0,0.6)]" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <div className="relative w-24 h-24 rounded-full bg-[#121217] flex items-center justify-center border-2 border-white/10">
                <Zap className="w-10 h-10 text-white/20" />
              </div>
            )}
          </div>
          <h2 className="text-white font-black text-2xl truncate max-w-full" style={{ fontFamily: '"Anton","Arial Narrow","Bahnschrift Condensed",Impact,sans-serif' }}>
            {nick}
          </h2>
          {tag && <p className="text-white/50 text-sm font-bold">{tag}</p>}
          {perfil?.elo && (
            <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-wider">
              <Medal className="w-3.5 h-3.5 text-[#FFB700]" /> {perfil.elo}
            </span>
          )}

          <div className="w-full mt-5 space-y-2.5 border-t border-white/5 pt-4">
            <div className="flex justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Fila</span>
              <span className="text-[10px] font-black uppercase text-white/80">{queue === 'flex' ? 'Flex' : 'Solo Duo'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Mercados</span>
              <span className="text-[10px] font-black uppercase text-white/80">{legs.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Total apostado</span>
              <span className="text-[10px] font-black uppercase text-white/80">{stakeTotal} MC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Retorno potencial</span>
              <span className="text-[10px] font-black uppercase text-[#FFB700]">{payoutTotal} MC</span>
            </div>
          </div>
        </div>

        {/* ── COLUNA MERCADOS ── */}
        <div className="rounded-2xl bg-[#0a0a0d] border border-white/10 p-4 sm:p-6 flex flex-col min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#FFB700] border-t-transparent" />
            </div>
          ) : ativo ? (
            // ── Bilhete ativo ──
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#121217] border border-white/10">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: ativo.status === 'em_jogo' ? 'rgba(34,197,94,0.15)' : 'rgba(255,183,0,0.12)' }}>
                  {ativo.status === 'em_jogo' ? <Gamepad2 className="w-5 h-5 text-green-400" /> : <Clock className="w-5 h-5 text-[#FFB700]" />}
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/60">
                    {ativo.status === 'em_jogo' ? 'Em jogo — detectado!' : 'Aguardando sua próxima partida'}
                  </p>
                  <p className="text-xs text-white/40">{catalog?.queues.find((q) => q.id === ativo.queue)?.label} • espera até {new Date(ativo.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              {ativoLegs.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-3 rounded-xl bg-[#111116] border border-white/8">
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
                <button onClick={handleSync} className="rounded-xl bg-[#121217] border border-white/10 py-2.5 flex items-center justify-center gap-2 text-zinc-200 text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> Verificar
                </button>
                <button onClick={handleCancelarAtivo} className="rounded-xl bg-[#121217] border border-red-500/30 py-2.5 flex items-center justify-center gap-2 text-red-400 text-xs font-black uppercase tracking-wider hover:bg-red-500/10 transition-colors cursor-pointer">
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              </div>
            </div>
          ) : catalog ? (
            // ── Etapa 1: escolher a fila (Solo Duo / Flex) em cards ──
            !filaEscolhida ? (
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Swords className="w-5 h-5 text-[#FFB700]" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">Escolha a Fila Ranqueada</h2>
                </div>
                <p className="text-[11px] text-white/40 mb-4 leading-relaxed">
                  Selecione a fila da sua próxima partida para liberar as apostas. Aposte em você mesmo: Vitória, Derrota, abates e First Blood.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {FILAS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setFilaEscolhida(f.id); setQueue(f.id); }}
                      className="relative rounded-2xl overflow-hidden cursor-pointer group transition-all hover:scale-[1.02] border border-white/10"
                    >
                      <div className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity"
                        style={{ backgroundImage: `url(${f.bg})` }} />
                      <div className="absolute inset-0 opacity-70" style={{ background: `linear-gradient(135deg, ${f.accent}33, transparent 50%, #000 100%)` }} />
                      <div className="relative z-10 p-5 flex flex-col items-start justify-between h-40">
                        <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md bg-black/60 text-white/80 border border-white/10">
                          Ranqueada
                        </span>
                        <div className="mt-auto text-left">
                          <h3 className="text-white font-black text-xl uppercase tracking-tight drop-shadow">{f.label}</h3>
                          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">Clique para apostar →</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // ── Etapa 2: fila escolhida → mercados ──
              <>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    {FILAS.filter((f) => f.id === filaEscolhida).map((f) => (
                      <button key={f.id} onClick={() => setFilaEscolhida(null)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                        <span className="w-2 h-2 rounded-full" style={{ background: f.accent }} />
                        <span className="text-[11px] font-black uppercase tracking-wider text-white">{f.label}</span>
                        <span className="text-[10px] text-white/40">trocar</span>
                      </button>
                    ))}
                    <Swords className="w-4 h-4 text-[#FFB700]" />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Fila selecionada</div>
                </div>

                {/* Stake */}
                <div className="mb-4">
                  <label className="text-zinc-400 text-[10px] uppercase tracking-widest font-black mb-1.5 block">Valor por mercado (MC) — mín. {catalog.minStake}</label>
                  <div className="flex items-center rounded-xl bg-[#121217] border border-white/10 overflow-hidden">
                    <button onClick={() => mudarStake(-100)} className="p-3 text-white/60 hover:text-[#FFB700] transition-colors cursor-pointer"><Minus className="w-4 h-4" /></button>
                    <div className="flex-1 text-center py-2.5 text-white font-black text-sm">{stake} MC</div>
                    <button onClick={() => mudarStake(100)} className="p-3 text-white/60 hover:text-[#FFB700] transition-colors cursor-pointer"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Mercados por grupo */}
                <div className="space-y-4">
                  {GROUP_ORDER.map((g) => (
                    <div key={g}>
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="w-4 h-4 text-[#FFB700]" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-white/70">{GROUP_LABEL[g]}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {catalog.markets[g].map((m) => (
                          <ItemMercado key={m.key} market={m} odd={`${m.odd}x`} selecionado={!!selecoes[m.key]} onClick={() => toggle(m.key, m.odd)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Limite */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-[#0c0c10] border border-white/5 mt-4">
                  <AlertTriangle className="w-4 h-4 text-[#FFB700] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-white/40 leading-snug">
                    Retorno máximo por bilhete: {catalog.maxPayout} MC. Se a partida não começar em {catalog.lockMinutes} min, a aposta é cancelada e o MC volta.
                  </p>
                </div>
              </>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center py-24 text-white/40 text-xs font-bold uppercase tracking-widest">
              Não foi possível carregar os mercados.
            </div>
          )}

          {/* Rodapé apostar — só na etapa de mercados */}
          {!ativo && catalog && filaEscolhida && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Total apostado</span>
                <span className="text-sm font-black text-white">{stakeTotal} MC</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Retorno potencial</span>
                <span className="text-lg font-black" style={{ color: ACCENT }}>{payoutTotal} MC</span>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleApostar} disabled={submeter}
                className="w-full rounded-xl py-3.5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:bg-[#e0a000] transition-colors cursor-pointer disabled:opacity-50 shadow-[0_0_25px_-5px_rgba(255,183,0,0.6)]">
                <Zap className="w-4 h-4" /> {submeter ? 'Apostando...' : 'Apostar Agora'}
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
