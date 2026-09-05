import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Zap, Minus, Plus, AlertTriangle, Swords, Trophy, Target, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, betDeltaMc, type ApiBetCatalog, type ApiBetQueue, type ApiBetTicket, type ApiBetGroup } from '../lib/api';
import { usePerfil } from '../contexts/PerfilContext';
import { ItemMercado } from '../components/partidas/ItemMercado';
import { SummonerCard } from '../components/partidas/SummonerCard';
import { FilaSelector, type FilaConfig } from '../components/partidas/FilaSelector';
import { BilheteAtivoView } from '../components/partidas/BilheteAtivoView';
import ModalResultadoAposta from '../components/partidas/ModalResultadoAposta';

const isSettled = (s: string) => ['finalizada', 'cancelada', 'anulada'].includes(s);

const ACCENT = '#FFB700';

const GROUP_ORDER: ApiBetGroup[] = ['resultado', 'kills', 'first_blood'];
const GROUP_META: Record<ApiBetGroup, { label: string; desc: string; icon: React.FC<{ className?: string }> }> = {
  resultado: {
    label: 'Resultado da Partida',
    desc: 'Vitória ou Derrota da sua equipe',
    icon: Trophy,
  },
  kills: {
    label: 'Abates (Kills)',
    desc: 'Meta de eliminações individuais no jogo',
    icon: Target,
  },
  first_blood: {
    label: 'First Blood',
    desc: 'Conquista do primeiro abate da partida',
    icon: Zap,
  },
};

const STAKE_PRESETS = [100, 250, 500, 1000];

const FILAS: FilaConfig[] = [
  {
    id: 'solo',
    label: 'Solo / Duo',
    sub: "Summoner's Rift Ranqueada",
    desc: 'Dispute partidas ranqueadas individuais ou em dupla. Cumpra suas metas no Rift e conquiste recompensas com o seu próprio desempenho.',
    tag: 'Solo / Dupla',
    bg: '/images/fundoCard5v5.webp',
    accent: '#3b82f6',
  },
  {
    id: 'flex',
    label: 'Ranqueada Flexível',
    sub: 'Equipe ou Grupo no Rift',
    desc: 'Jogue em grupo ou time fechado na fila flexível. Transforme a sinergia da sua equipe em conquistas reais.',
    tag: 'Grupo / Time',
    bg: '/images/fundoCardAram.webp',
    accent: '#a855f7',
  },
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
  const [syncing, setSyncing] = useState(false);
  const [submeter, setSubmeter] = useState(false);
  const [filaEscolhida, setFilaEscolhida] = useState<ApiBetQueue | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [resultadoTicket, setResultadoTicket] = useState<ApiBetTicket | null>(null);
  const [resultadoDeltaMc, setResultadoDeltaMc] = useState(0);
  const watchIdRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    carregar();
  }, [carregar]);

  const reactResultado = useCallback((ticket: ApiBetTicket) => {
    if (seenRef.current.has(ticket.id)) return;
    seenRef.current.add(ticket.id);
    const delta = betDeltaMc(ticket);
    setResultadoTicket(ticket);
    setResultadoDeltaMc(delta);
    if (delta > 0) toast.success(`Desafio ganhou! +${delta} MC`);
    else if (delta < 0) toast.error(`Desafio perdido! ${delta} MC`);
    else toast(`Desafio ${ticket.status === 'cancelada' ? 'cancelado' : 'anulado'} — MC devolvido.`);
  }, []);

  useEffect(() => {
    watchIdRef.current = ativo?.id ?? null;
  }, [ativo]);

  useEffect(() => {
    const timer = setInterval(async () => {
      const watchId = watchIdRef.current;
      if (!watchId) return;
      try {
        const nowActive = await api.bets.active();
        if (!nowActive || nowActive.id !== watchId) {
          const tickets = await api.bets.mine();
          const settled = tickets.find((t) => t.id === watchId) ?? null;
          if (settled) reactResultado(settled);
          watchIdRef.current = nowActive ? nowActive.id : null;
        }
      } catch {
        // Silencioso em falha de polling de rede
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [reactResultado]);

  const toggle = useCallback(
    (marketKey: string, odd: number) => {
      if (ativo) return;
      setSelecoes((prev) => {
        const has = !!prev[marketKey];
        const next = { ...prev };
        if (has) {
          delete next[marketKey];
          return next;
        }
        const mercado = catalog?.markets && Object.values(catalog.markets).flat().find((m) => m.key === marketKey);
        if (mercado) {
          for (const [k] of Object.entries(next)) {
            const outro = catalog && (Object.values(catalog.markets).flat().find((m) => m.key === k) as any);
            if (outro && mercado.group === outro.group && k !== marketKey) {
              delete next[k];
            }
          }
        }
        next[marketKey] = { marketKey, odd, stake };
        return next;
      });
    },
    [ativo, stake, catalog]
  );

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
    if (legs.length === 0) {
      toast.error('Selecione pelo menos um objetivo.');
      return;
    }
    if (stakeTotal < catalog.minStake) {
      toast.error(`Desafio mínimo de ${catalog.minStake} MC por objetivo.`);
      return;
    }
    if ((perfil?.saldo ?? 0) < stakeTotal) {
      toast.error('Saldo insuficiente de MC.');
      return;
    }
    setConfirmando(true);
  };

  const confirmarAposta = async () => {
    if (!catalog) return;
    setSubmeter(true);
    setConfirmando(false);
    try {
      const legsBody = legs.map((l) => ({ marketKey: l.marketKey, stake: l.stake }));
      await api.bets.create({ queue, legs: legsBody });
      toast.success('Desafio registrado! Boa sorte na partida.');
      setSelecoes({});
      await carregar();
    } catch (e: any) {
      const cod = e?.message;
      if (cod === 'ja_tem_bilhete_aguardando') toast.error('Você já tem um desafio aguardando entrar em jogo.');
      else if (cod === 'riot_id_obrigatorio' || cod === 'termos_nao_aceitos')
        toast.error('Vincule sua conta Riot e aceite os termos para participar do desafio.');
      else if (cod === 'saldo_insuficiente') toast.error('Saldo insuficiente de MC.');
      else if (cod === 'ja_em_jogo_ranqueada')
        toast.error('Você já está em partida ranqueada — termine antes de iniciar o desafio.');
      else if (cod === 'mercados_conflitantes')
        toast.error('Escolha apenas um objetivo por grupo (Vitória OU Derrota, etc.).');
      else toast.error(e?.message || 'Erro ao iniciar desafio.');
    }
    setSubmeter(false);
  };

  const handleSync = async () => {
    if (!ativo) return;
    setSyncing(true);
    try {
      const r = await api.bets.sync(ativo.id);
      if (r.ticket && isSettled(r.ticket.status)) {
        reactResultado(r.ticket);
      } else if (r.status === 'em_jogo') {
        toast.success('Partida detectada! Validação em andamento.');
      } else {
        toast('Nenhuma nova partida ranqueada concluída detectada.');
      }
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao verificar.');
    }
    setSyncing(false);
  };

  const filaAtual = FILAS.find((f) => f.id === filaEscolhida) ?? FILAS[0];
  const nick = perfil?.nome || 'Jogador';
  const tag = perfil?.tag || '';
  const iconId = perfil?.iconId || 0;

  return (
    <div className="flex-1 w-full min-h-screen bg-[#050505] font-sans relative overflow-x-hidden text-white">
      {/* Background ambiente */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,183,0,0.05)_0%,#050505_100%)]" />
      </div>

      {/* Top Bar */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 w-full flex items-center justify-between gap-3 p-3 sm:p-4 bg-black/70 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate('/jogar')}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white/80 hover:text-white shrink-0 cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <div className="w-9 h-9 rounded-xl bg-[#FFB700]/10 border border-[#FFB700]/30 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-[#FFB700]" />
          </div>
          <div className="min-w-0">
            <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black mb-0.5 rounded-md" style={{ background: ACCENT }}>
              Desafio Individual
            </span>
            <h1
              className="text-white font-black uppercase tracking-tight text-lg sm:text-xl leading-none truncate"
              style={{ fontFamily: '"Anton","Arial Narrow","Bahnschrift Condensed",Impact,sans-serif', letterSpacing: '0.02em' }}
            >
              Desafie a Si Mesmo
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-[#FFB700]" />
            <span className="text-xs font-black text-white">{perfil?.saldo ?? 0} MC</span>
          </div>
        </div>
      </motion.div>

      {/* Conteúdo Principal */}
      <div className="relative z-10 max-w-[1400px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-6">
        {/* Coluna do Jogador (SummonerCard modular) */}
        <SummonerCard
          nick={nick}
          tag={tag}
          iconId={iconId}
          elo={perfil?.elo}
          saldo={perfil?.saldo ?? 0}
          queue={queue}
          selectedLegsCount={legs.length}
          stakeTotal={stakeTotal}
          payoutTotal={payoutTotal}
        />

        {/* Coluna Principal dos Mercados / Fila / Bilhete */}
        <div className="rounded-2xl bg-[#0a0a0d] border border-white/10 p-5 sm:p-6 flex flex-col min-h-0 shadow-2xl relative">
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-28">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#FFB700] border-t-transparent" />
            </div>
          ) : ativo ? (
            <BilheteAtivoView
              ticket={ativo}
              catalog={catalog}
              onSync={handleSync}
              syncing={syncing}
            />
          ) : catalog ? (
            !filaEscolhida ? (
              <FilaSelector
                filas={FILAS}
                onSelect={(fId) => {
                  setFilaEscolhida(fId);
                  setQueue(fId);
                }}
              />
            ) : (
              /* Etapa 2: Fila Escolhida -> Configuração de Stake e Mercados */
              <div className="space-y-5">
                {/* Barra da Fila Escolhida com botão de retorno */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#121218] border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFilaEscolhida(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold uppercase transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Trocar</span>
                    </button>
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md"
                      style={{ background: `${filaAtual.accent}15`, borderColor: `${filaAtual.accent}40` }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: filaAtual.accent }} />
                      <span className="text-xs font-black uppercase text-white tracking-wider">
                        {filaAtual.label}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    Etapa 2 de 2 • Objetivos
                  </span>
                </div>

                {/* Seletor de Valor (Stake) com Presets Rápidos */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/8 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-black uppercase tracking-widest text-white block">
                        Valor por Objetivo (MC)
                      </label>
                      <span className="text-[10px] text-white/40">
                        Mínimo {catalog.minStake} MC • Máximo {catalog.maxPayout} MC de retorno
                      </span>
                    </div>
                    <span className="text-xs font-black text-[#FFB700] px-2.5 py-1 rounded-lg bg-[#FFB700]/10 border border-[#FFB700]/30">
                      {stake} MC / meta
                    </span>
                  </div>

                  {/* Stepper + Presets */}
                  <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 items-center">
                    <div className="flex items-center rounded-xl bg-[#121217] border border-white/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => mudarStake(-100)}
                        className="p-3 text-white/60 hover:text-[#FFB700] hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="flex-1 text-center py-2.5 text-white font-black text-sm">
                        {stake} MC
                      </div>
                      <button
                        type="button"
                        onClick={() => mudarStake(100)}
                        className="p-3 text-white/60 hover:text-[#FFB700] hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {STAKE_PRESETS.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setStake(val)}
                          className={`px-3 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                            stake === val
                              ? 'bg-[#FFB700] text-black shadow-md'
                              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                          }`}
                        >
                          {val} MC
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Grupos de Mercados */}
                <div className="space-y-5">
                  {GROUP_ORDER.map((g) => {
                    const meta = GROUP_META[g];
                    const IconComp = meta.icon;
                    return (
                      <div key={g} className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center">
                              <IconComp className="w-3.5 h-3.5 text-[#FFB700]" />
                            </div>
                            <div>
                              <span className="text-xs font-black uppercase tracking-wider text-white">
                                {meta.label}
                              </span>
                              <span className="text-[10px] text-white/40 block">
                                {meta.desc}
                              </span>
                            </div>
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-white/40 px-2 py-0.5 rounded bg-white/5 border border-white/8">
                            Escolha 1
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {catalog.markets[g]?.map((m) => (
                            <ItemMercado
                              key={m.key}
                              market={m}
                              odd={m.odd}
                              selecionado={!!selecoes[m.key]}
                              stake={stake}
                              onClick={() => toggle(m.key, m.odd)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Caixa de Regras e Limites */}
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-gradient-to-r from-[#FFB700]/10 to-transparent border border-[#FFB700]/20">
                  <AlertTriangle className="w-4 h-4 text-[#FFB700] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-white/60 leading-snug">
                    Teto de retorno: <strong>{catalog.maxPayout} MC</strong> por desafio. O resultado é apurado automaticamente após o término da sua partida ranqueada. Se você não jogar em até {catalog.lockMinutes} min, o valor é estornado integralmente.
                  </p>
                </div>

                {/* Rodapé de Ação */}
                <div className="pt-4 border-t border-white/8">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-bold uppercase tracking-widest text-white/50">Valor Total Reservado</span>
                    <span className="font-black text-white text-sm">{stakeTotal} MC</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black uppercase tracking-widest text-white/70">Recompensa Total Estimada</span>
                    <span className="text-xl font-black text-[#FFB700] drop-shadow">
                      {payoutTotal} MC
                    </span>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleApostar}
                    disabled={submeter}
                    className="w-full rounded-xl py-4 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black bg-gradient-to-r from-[#FFB700] via-[#ffd000] to-[#FFB700] hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 shadow-[0_0_30px_rgba(255,183,0,0.5)]"
                  >
                    <Zap className="w-4 h-4 fill-black" />
                    <span>{submeter ? 'Iniciando Desafio...' : 'Iniciar Desafio Agora'}</span>
                  </motion.button>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center py-28 text-white/40 text-xs font-bold uppercase tracking-widest">
              Não foi possível carregar os mercados do desafio.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação */}
      <AnimatePresence>
        {confirmando && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setConfirmando(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-[#0c0c10] border border-white/15 shadow-2xl overflow-hidden"
            >
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FFB700]/15 border border-[#FFB700]/40 flex items-center justify-center shrink-0">
                    <Swords className="w-5 h-5 text-[#FFB700]" />
                  </div>
                  <div>
                    <h2
                      className="text-white font-black uppercase tracking-tight text-lg leading-none"
                      style={{ fontFamily: '"Anton","Arial Narrow","Bahnschrift Condensed",Impact,sans-serif' }}
                    >
                      Confirmar Desafio Individual
                    </h2>
                    <p className="text-white/40 text-[11px] uppercase tracking-widest mt-1">
                      Revise suas metas antes de confirmar
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#121217] border border-white/8">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Fila</span>
                    <span className="text-xs font-black text-white">{filaAtual.label}</span>
                  </div>
                  {legs.map((l) => (
                    <div key={l.marketKey} className="flex items-center justify-between p-3 rounded-xl bg-[#121217] border border-white/8">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 truncate pr-2">
                        {catalog && (Object.values(catalog.markets).flat().find((m) => m.key === l.marketKey)?.label ?? l.marketKey)}
                      </span>
                      <span className="text-[10px] font-black text-white/60 shrink-0">
                        @{l.odd.toFixed(2)} • {l.stake} MC
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#121217] border border-white/8">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Valor Total Reservado</span>
                    <span className="text-sm font-black text-white">{stakeTotal} MC</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#121217] border border-white/8">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Recompensa Estimada</span>
                    <span className="text-lg font-black text-[#FFB700]">{payoutTotal} MC</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/8 mb-5">
                  <AlertTriangle className="w-4 h-4 text-[#FFB700] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-white/50 leading-snug">
                    O MC é reservado e o resultado será conferido via Riot API na sua próxima partida. Se não houver jogo dentro do tempo limite, o valor retorna à sua carteira.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    className="rounded-xl py-3 bg-[#121217] border border-white/10 text-white/70 text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Revisar
                  </button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={confirmarAposta}
                    disabled={submeter}
                    className="rounded-xl py-3 bg-[#FFB700] hover:bg-[#e0a000] text-black text-xs font-black uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {submeter ? 'Iniciando...' : 'Confirmar Desafio'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Resultado */}
      {resultadoTicket && (
        <ModalResultadoAposta
          ticket={resultadoTicket}
          deltaMc={resultadoDeltaMc}
          onClose={() => setResultadoTicket(null)}
        />
      )}
    </div>
  );
}
