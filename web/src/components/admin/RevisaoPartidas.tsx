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
  Swords, Clock, Coins,
} from 'lucide-react';
import { api, type ApiRevisaoSala } from '../../lib/api';

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

  useEffect(() => {
    carregar();
  }, [carregar]);

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
                      <div key={p.id} className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
                        <img
                          src={api.prints.file(p.id)}
                          alt={`Print de ${p.nomeJogador}`}
                          loading="lazy"
                          className="w-full h-32 lg:h-40 object-contain bg-black/60"
                        />
                        <p className="px-2 py-1.5 text-[10px] font-black text-white/40 truncate">{p.nomeJogador}</p>
                      </div>
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
    </div>
  );
}
