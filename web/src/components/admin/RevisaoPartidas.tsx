// src/components/admin/RevisaoPartidas.tsx
// Painel "Revisão de Partidas" (design v3 §6). Fila de salas apostadas em
// `aguardando_revisao` por antiguidade de revisao_desde (mais antiga primeiro),
// com prints lado a lado (servidos por endpoint autenticado), disputas abertas
// destacadas e decisão idempotente (decisionId gerado aqui, §4.3). A regra de
// autorização (admin/moderador) vive no servidor — a API responde 403 se o
// cargo não pode revisar.
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check, X, Scale, Loader2, AlertTriangle, RefreshCw, Image as ImageIcon,
  Swords, Clock, Coins, Gavel, User,
} from 'lucide-react';
import { api, type ApiRevisaoSala, type ApiDisputaAdmin } from '../../lib/api';

type Lado = 'blue' | 'red';

const MODO_LABEL: Record<string, string> = {
  '5v5': '5v5',
  '1v1': '1v1',
  aram: 'ARAM',
  time_vs_time: 'Time vs Time',
};

const LADO_LABEL: Record<Lado, string> = {
  blue: 'Azul',
  red: 'Vermelho',
};

function gerarUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'dec-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function CardStyle() {
  return { border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)' };
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

function BotaoDecidir({
  lado,
  label,
  cor,
  icone: Icon,
  processando,
  onClick,
}: {
  lado: Lado | 'cancel' | 'draw';
  label: string;
  cor: string;
  icone: React.ElementType;
  processando: boolean;
  onClick: (lado: Lado | 'cancel' | 'draw') => void;
}) {
  return (
    <button
      onClick={() => onClick(lado)}
      disabled={processando}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${cor}`}
    >
      {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

export function RevisaoPartidas() {
  const [salas, setSalas] = useState<ApiRevisaoSala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; msg: string } | null>(null);
  // Print em exibição ampliada (lightbox, mesmo padrão dos logos de time).
  const [lightboxPrint, setLightboxPrint] = useState<{ id: string; nomeJogador: string } | null>(null);

  // Contestações de resultado (spec verificacao-partida-riot §6.1).
  const [disputas, setDisputas] = useState<ApiDisputaAdmin[]>([]);
  const [carregandoDisputas, setCarregandoDisputas] = useState(true);
  const [processandoDisputaId, setProcessandoDisputaId] = useState<string | null>(null);
  const [saldoInsuficienteId, setSaldoInsuficienteId] = useState<string | null>(null);
  const [lightboxContestacao, setLightboxContestacao] = useState<{ url: string; nomeJogador: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setSalas(await api.revisao.pendentes());
    } catch (e: any) {
      setErro(e?.message === 'sem_permissao' ? 'Sem permissão para revisar partidas (admin/moderador).' : e?.message || 'Erro ao carregar a fila.');
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarDisputas = useCallback(async () => {
    setCarregandoDisputas(true);
    try {
      setDisputas(await api.revisao.disputas());
      setSaldoInsuficienteId(null);
    } catch (e: any) {
      setDisputas([]);
      setPopup({ tipo: 'erro', msg: `Falha ao carregar contestações: ${e?.message || 'erro'}` });
    } finally {
      setCarregandoDisputas(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    carregarDisputas();
  }, [carregar, carregarDisputas]);

  const decidir = useCallback(
    async (sala: ApiRevisaoSala, lado: Lado | 'cancel' | 'draw') => {
      setProcessandoId(sala.id);
      try {
        const r = await api.revisao.decidir(sala.id, { winnerSide: lado, decisionId: gerarUuid() });
        if (r.ok) {
          setPopup({ tipo: 'sucesso', msg: `Partida #${sala.salaNum} ${lado === 'cancel' ? 'cancelada' : lado === 'draw' ? 'empatada' : `aprovada para o Time ${LADO_LABEL[lado]}`}.` });
        }
      } catch (e: any) {
        if (e?.message === 'partida_ja_decidida') {
          setPopup({ tipo: 'info', msg: `A partida #${sala.salaNum} já foi decidida por outro revisor.` });
        } else {
          setPopup({ tipo: 'erro', msg: `Falha ao decidir #${sala.salaNum}: ${e?.message || 'erro'}` });
        }
      } finally {
        setProcessandoId(null);
        setTimeout(() => setPopup(null), 4000);
        carregar();
      }
    },
    [carregar]
  );

  const decidirDisputa = useCallback(
    async (d: ApiDisputaAdmin, procedente: boolean) => {
      setProcessandoDisputaId(d.id);
      setSaldoInsuficienteId(null);
      try {
        const r = await api.revisao.decidirDisputa(d.id, { procedente });
        if (r.ok) {
          setPopup({ tipo: 'sucesso', msg: procedente ? 'Resultado revertido e sala cancelada.' : 'Contestação resolvida.' });
        }
      } catch (e: any) {
        if (e?.message === 'saldo_insuficiente') {
          setSaldoInsuficienteId(d.id);
          setPopup({ tipo: 'erro', msg: 'Estorno bloqueado: vencedor sem saldo. Decida manualmente.' });
        } else if (e?.message === 'disputa_ja_resolvida') {
          setPopup({ tipo: 'info', msg: 'Esta contestação já foi resolvida por outro revisor.' });
        } else {
          setPopup({ tipo: 'erro', msg: `Falha ao decidir: ${e?.message || 'erro'}` });
        }
      } finally {
        setProcessandoDisputaId(null);
        setTimeout(() => setPopup(null), 4000);
        carregarDisputas();
      }
    },
    [carregarDisputas]
  );

  return (
    <div className="space-y-4">
      {/* Toast (mesmo padrão das abas do Admin.tsx) */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-black text-sm uppercase tracking-widest text-white/70">Revisão de Partidas</h2>
        <button
          onClick={carregar}
          disabled={carregando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Contestações de resultado (spec verificacao-partida-riot §6.1) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Gavel className="w-4 h-4 text-amber-400" />
          <h3 className="text-white font-black text-sm uppercase tracking-widest text-white/70">Contestações</h3>
          {!carregandoDisputas && disputas.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
              <AlertTriangle className="w-3 h-3" />
              {disputas.length} aberta{disputas.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {carregandoDisputas && disputas.length === 0 && (
          <div className="rounded-2xl p-8 flex items-center justify-center gap-3" style={CardStyle()}>
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <p className="text-white/40 text-sm font-bold">Carregando contestações...</p>
          </div>
        )}

        {!carregandoDisputas && disputas.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={CardStyle()}>
            <Check className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-white/40 text-sm font-bold">Nenhuma contestação pendente.</p>
          </div>
        )}

        {disputas.map((d) => {
          const processando = processandoDisputaId === d.id;
          const semSaldo = saldoInsuficienteId === d.id;
          return (
            <div key={d.id} className="rounded-2xl p-5 lg:p-6 space-y-5" style={CardStyle()}>
              {/* Cabeçalho da disputa */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Gavel className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white font-black text-sm uppercase tracking-tight">Sala #{d.salaNum} · {MODO_LABEL[d.mode] || d.mode}</p>
                    <p className="text-white/40 text-xs flex items-center gap-1.5 mt-0.5">
                      <User className="w-3 h-3" />
                      {d.nomeJogador} contestou {horasDesde(d.createdAt)}
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest">
                  <Coins className="w-3 h-3" />
                  {d.apostaMc} MC
                </span>
              </div>

              {/* Resultado verificado */}
              <div className="rounded-xl p-4 bg-white/5 border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Resultado verificado</p>
                <p className="text-white font-black text-sm">
                  {d.winnerSide ? (
                    <span className={d.winnerSide === 'blue' ? 'text-blue-300' : 'text-red-300'}>
                      Vitória do Time {LADO_LABEL[d.winnerSide as Lado]}
                    </span>
                  ) : (
                    <span className="text-white/60">{d.resultado || '—'}</span>
                  )}
                </p>
              </div>

              {/* Motivo da contestação */}
              <div className="rounded-xl p-4 bg-amber-500/5 border border-amber-500/15">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 mb-1">Motivo</p>
                <p className="text-amber-100/90 text-sm">{d.motivo}</p>
              </div>

              {/* Print da contestação */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Print da contestação</p>
                {d.contestacaoUrl ? (
                  <button
                    onClick={() => setLightboxContestacao({ url: d.contestacaoUrl, nomeJogador: d.nomeJogador })}
                    className="rounded-xl overflow-hidden border border-white/10 bg-black/40 text-left cursor-pointer group"
                    title={`Print de ${d.nomeJogador} — clique para ampliar`}
                  >
                    <img
                      src={d.contestacaoUrl}
                      alt={`Print de ${d.nomeJogador}`}
                      loading="lazy"
                      className="w-full max-w-sm aspect-video object-cover bg-black/60 group-hover:opacity-80 transition-opacity"
                    />
                    <p className="px-2 py-1.5 text-[10px] font-black text-white/40">Clique para ampliar</p>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] text-white/25 text-xs">
                    <ImageIcon className="w-4 h-4" />
                    Sem print anexado.
                  </div>
                )}
              </div>

              {/* Estorno bloqueado */}
              {semSaldo && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Estorno bloqueado: vencedor sem saldo. Decida manualmente.
                </div>
              )}

              {/* Decisão da contestação */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  onClick={() => decidirDisputa(d, false)}
                  disabled={processando}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                >
                  {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Improcedente
                </button>
                <button
                  onClick={() => decidirDisputa(d, true)}
                  disabled={processando}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-green-500/15 border-green-500/30 text-green-300 hover:bg-green-500/25"
                >
                  {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Procedente
                </button>
              </div>
            </div>
          );
        })}
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

      {carregando && salas.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={CardStyle()}>
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-white/40 text-sm font-bold">Carregando fila de revisão...</p>
        </div>
      )}

      {!carregando && erro && (
        <div className="rounded-2xl p-8 border border-red-500/20 bg-red-500/5 text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-red-300 text-sm font-bold">{erro}</p>
        </div>
      )}

      {!carregando && !erro && salas.length === 0 && (
        <div className="rounded-2xl p-10 text-center" style={CardStyle()}>
          <Check className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-white/40 text-sm font-bold">Nenhuma partida aguardando revisão.</p>
        </div>
      )}

      <div className="space-y-4">
        {salas.map((sala) => {
          const processando = processandoId === sala.id;
          return (
            <div key={sala.id} className="rounded-2xl p-5 lg:p-6 space-y-5" style={CardStyle()}>
              {/* Cabeçalho da sala */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <Swords className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-white font-black text-sm uppercase tracking-tight">Sala #{sala.salaNum}</p>
                    <p className="text-white/40 text-xs flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3" />
                      Em revisão {horasDesde(sala.revisaoDesde)} · {MODO_LABEL[sala.mode] || sala.mode}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest">
                    <Coins className="w-3 h-3" />
                    {sala.apostaMc} MC
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[10px] font-black uppercase tracking-widest">
                    <Scale className="w-3 h-3" />
                    Taxa {Number(sala.taxaPct).toFixed(2).replace('.', ',')}%
                  </span>
                </div>
              </div>

              {/* Time A vs Time B */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4 bg-blue-500/5 border border-blue-500/15">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-300/80 mb-1">Time A</p>
                  <p className="text-white font-black text-sm truncate">{sala.timeANome || 'Time A'}</p>
                  {sala.timeATag && <p className="text-white/30 text-[10px]">{sala.timeATag}</p>}
                </div>
                <div className="rounded-xl p-4 bg-red-500/5 border border-red-500/15">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-300/80 mb-1">Time B</p>
                  <p className="text-white font-black text-sm truncate">{sala.timeBNome || 'Time B'}</p>
                  {sala.timeBTag && <p className="text-white/30 text-[10px]">{sala.timeBTag}</p>}
                </div>
              </div>

              {/* Jogadores */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">
                  Jogadores ({sala.jogadores.length}/{sala.maxJogadores})
                </p>
                <div className="flex flex-wrap gap-2">
                  {sala.jogadores.map((j) => (
                    <span
                      key={j.userId}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                        j.side === 'blue' ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
                      }`}
                    >
                      {j.nome}
                      <span className="text-[9px] font-black uppercase opacity-60">{LADO_LABEL[j.side as Lado]}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Prints lado a lado (servidos por endpoint autenticado) */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">
                  Prints de prova ({sala.prints.length}/3)
                </p>
                {sala.prints.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] text-white/25 text-xs">
                    <ImageIcon className="w-4 h-4" />
                    Nenhum print enviado ainda.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {sala.prints.map((p) => (
                      <button key={p.id} onClick={() => setLightboxPrint({ id: p.id, nomeJogador: p.nomeJogador })}
                        className="rounded-xl overflow-hidden border border-white/10 bg-black/40 text-left cursor-pointer group"
                        title={`Print de ${p.nomeJogador} — clique para ampliar`}>
                        <img
                          src={api.prints.file(p.id)}
                          alt={`Print de ${p.nomeJogador}`}
                          loading="lazy"
                          className="w-full h-32 lg:h-40 object-contain bg-black/60 group-hover:opacity-80 transition-opacity"
                        />
                        <p className="px-2 py-1.5 text-[10px] font-black text-white/40 truncate">{p.nomeJogador}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Disputas abertas (não bloqueiam a decisão — só destacam, §6.1) */}
              {sala.disputas.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Disputas abertas ({sala.disputas.length})
                  </p>
                  {sala.disputas.map((d) => (
                    <div key={d.id} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-300 font-black shrink-0">{d.nomeJogador}:</span>
                      <span className="text-amber-100/80">{d.motivo}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Decisão (idempotente via decisionId, §4.3) */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <BotaoDecidir
                  lado="blue"
                  label="Aprovar Time A"
                  cor="bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25"
                  icone={Check}
                  processando={processando}
                  onClick={(l) => decidir(sala, l)}
                />
                <BotaoDecidir
                  lado="red"
                  label="Aprovar Time B"
                  cor="bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25"
                  icone={Check}
                  processando={processando}
                  onClick={(l) => decidir(sala, l)}
                />
                <BotaoDecidir
                  lado="draw"
                  label="Empate"
                  cor="bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                  icone={Scale}
                  processando={processando}
                  onClick={(l) => decidir(sala, l)}
                />
                <BotaoDecidir
                  lado="cancel"
                  label="Cancelar"
                  cor="bg-red-500/5 border-red-500/20 text-red-400/80 hover:bg-red-500/10"
                  icone={X}
                  processando={processando}
                  onClick={(l) => decidir(sala, l)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox do print (mesmo padrão dos logos de time) */}
      <AnimatePresence>
        {lightboxPrint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxPrint(null)}
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center cursor-zoom-out"
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              src={api.prints.file(lightboxPrint.id)}
              alt={`Print de ${lightboxPrint.nomeJogador}`}
              className="w-full max-w-[min(1600px,96vw)] max-h-[94vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxPrint(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm">
              <span className="text-white/80 text-xs font-black uppercase tracking-widest">
                Print de {lightboxPrint.nomeJogador}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox do print da contestação */}
      <AnimatePresence>
        {lightboxContestacao && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxContestacao(null)}
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center cursor-zoom-out"
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              src={lightboxContestacao.url}
              alt={`Print de ${lightboxContestacao.nomeJogador}`}
              className="w-full max-w-[min(1600px,96vw)] max-h-[94vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxContestacao(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm">
              <span className="text-white/80 text-xs font-black uppercase tracking-widest">
                Print de {lightboxContestacao.nomeJogador}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
