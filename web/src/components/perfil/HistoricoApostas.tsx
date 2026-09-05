import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { LoaderCircle, Swords, Shield, TrendingUp, TrendingDown, History, Minus } from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';
import { api, type ApiBetHistoryItem } from '../../lib/api';
import { CutCard } from '../ui/CutCard';

/**
 * Histórico de apostas (MC) do jogador: apostas individuais (self-bet) e salas
 * apostadas / modo desafio. Mostra o campeão jogado, a fila (SOLO/DUO ou RANK FLEXÍVEL),
 * mercados apostados, status do resultado e delta de MC real.
 */

const FLAG_LABEL: Record<string, string> = {
  preenchendo: 'Aberta',
  confirmacao: 'Confirmando',
  iniciando_partida: 'Iniciando',
  partida_iniciada: 'Em jogo',
  aguardando_revisao: 'Em análise',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
  anulada: 'Anulada',
  aguardando: 'Aguardando fila',
  em_jogo: 'Em jogo',
  finalizada: 'Finalizada',
};

function statusBadgeStyle(it: ApiBetHistoryItem): string {
  if (it.resultado === 'ganha') {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  }
  if (it.resultado === 'perdida') {
    return 'bg-red-500/15 text-red-400 border-red-500/30';
  }
  if (it.status === 'em_jogo') {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/40 animate-pulse';
  }
  if (it.status === 'aguardando' || it.status === 'aguardando_revisao') {
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  }
  if (it.status === 'cancelada' || it.status === 'anulada') {
    return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25';
  }
  return 'bg-white/10 text-white/70 border-white/15';
}

function statusBadgeText(it: ApiBetHistoryItem): string {
  if (it.resultado === 'ganha') return 'Vitória';
  if (it.resultado === 'perdida') return 'Derrota';
  if (it.status === 'em_jogo') return 'Em Jogo';
  if (it.status === 'aguardando') return 'Aguardando';
  if (it.status === 'cancelada') return 'Cancelada';
  if (it.status === 'anulada') return 'Anulada';
  return FLAG_LABEL[it.status] ?? it.status;
}

function legTag(id: string): string {
  if (!id) return '';
  if (id === 'result_vitoria') return 'Vitória';
  if (id === 'result_derrota') return 'Derrota';
  if (id === 'first_blood_sim') return 'First Blood';
  if (id === 'first_blood_nao') return 'Sem First Blood';
  return id
    .replace(/kills_over_(\d+)/i, 'Matar +$1')
    .replace(/kills_under_(\d+)/i, 'Matar até $1')
    .replace(/cs_over_(\d+)/i, '+$1 CS')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatarData(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <div className="flex flex-col items-end shrink-0">
        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-black text-base tabular-nums">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> +{delta} <GiTwoCoins className="w-4 h-4 text-[#FFB700]" />
        </span>
        <span className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-widest">Lucro MC</span>
      </div>
    );
  }
  if (delta < 0) {
    return (
      <div className="flex flex-col items-end shrink-0">
        <span className="inline-flex items-center gap-1.5 text-red-400 font-black text-base tabular-nums">
          <TrendingDown className="w-4 h-4 text-red-400" /> {delta} <GiTwoCoins className="w-4 h-4 text-[#FFB700]" />
        </span>
        <span className="text-[10px] font-bold text-red-400/70 uppercase tracking-widest">Perda MC</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end shrink-0">
      <span className="inline-flex items-center gap-1.5 text-zinc-400 font-bold text-sm tabular-nums">
        <Minus className="w-4 h-4 text-zinc-500" /> 0 <GiTwoCoins className="w-3.5 h-3.5 text-zinc-500" />
      </span>
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Devolvido</span>
    </div>
  );
}

export function HistoricoApostas() {
  const [itens, setItens] = useState<ApiBetHistoryItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setCarregando(true);
    api.bets
      .history()
      .then((rows) => {
        if (!mounted) return;
        setItens(rows);
        setErro(null);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setErro(e?.message || 'Erro ao carregar histórico.');
      })
      .finally(() => mounted && setCarregando(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Título do Bloco */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center"
            style={{ clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' }}
          >
            <History className="w-3.5 h-3.5 text-[#FFB700]" />
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Histórico de Partidas e Apostas</h3>
        </div>
        {itens.length > 0 && (
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">
            {itens.length} {itens.length === 1 ? 'partida' : 'partidas'}
          </span>
        )}
      </div>

      {carregando ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="w-6 h-6 animate-spin text-white/40" />
        </div>
      ) : erro ? (
        <div className="py-8 text-center text-white/40 text-xs font-bold uppercase tracking-widest">{erro}</div>
      ) : itens.length === 0 ? (
        <div className="py-10 text-center">
          <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 font-black uppercase tracking-widest text-xs">Nenhuma aposta ainda</p>
          <p className="text-white/20 text-[10px] uppercase mt-2">Participe de uma sala apostada ou faça um desafio individual.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {itens.map((it) => {
            const ehHero = it.tipo === 'aposta_individual';
            const filaLabel = ehHero
              ? it.fila === 'flex'
                ? 'RANK FLEXÍVEL'
                : 'SOLO/DUO'
              : (it.modo?.toUpperCase() || 'SALA APOSTADA');

            const championName = it.championName;
            const displayChampion = championName === 'MonkeyKing' ? 'Wukong' : championName;
            const championImgUrl = championName
              ? `https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/${championName}.png`
              : null;

            return (
              <CutCard
                key={`${it.tipo}-${it.id}`}
                className="overflow-hidden hover:border-white/20 transition-all duration-200"
                borderColor="rgba(255,255,255,0.08)"
              >
                <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Ícone do Campeão jogado ou ícone temático */}
                    {championImgUrl ? (
                      <div
                        className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-black/60 border border-white/20 relative flex items-center justify-center shadow-lg"
                        style={{ clipPath: 'polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)' }}
                        title={displayChampion || undefined}
                      >
                        <img
                          src={championImgUrl}
                          alt={displayChampion || 'Campeão'}
                          className="w-full h-full object-cover scale-105"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className="w-12 h-12 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-md"
                        style={{ clipPath: 'polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)' }}
                      >
                        {ehHero ? (
                          <Shield className="w-5 h-5 text-[#FFB700]" />
                        ) : (
                          <Swords className="w-5 h-5 text-purple-400" />
                        )}
                      </div>
                    )}

                    {/* Informações detalhadas da partida e aposta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {/* Fila: SOLO/DUO ou RANK FLEXÍVEL com alta visibilidade */}
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-black tracking-wider uppercase border shadow-sm ${
                            it.fila === 'flex'
                              ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                              : 'bg-[#FFB700]/15 border-[#FFB700]/40 text-[#FFB700]'
                          }`}
                        >
                          {filaLabel}
                        </span>

                        {/* Nome do Campeão */}
                        {displayChampion && (
                          <span className="text-xs font-black text-white tracking-wide uppercase">
                            {displayChampion}
                          </span>
                        )}

                        {/* Status de Vitória / Derrota / Em Jogo */}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${statusBadgeStyle(it)}`}>
                          {statusBadgeText(it)}
                        </span>
                      </div>

                      {/* Mercados e Legs apostadas (legíveis e destacadas) */}
                      <div className="flex items-center gap-1.5 flex-wrap my-1">
                        {ehHero && it.legs && it.legs.length > 0 ? (
                          it.legs.map((l, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 bg-white/[0.08] border border-white/15 px-2 py-0.5 rounded text-[11px] font-semibold text-zinc-100 shadow-sm"
                            >
                              <span>{legTag(l.marketKey)}</span>
                              {l.odd && <span className="text-[#FFB700] font-black text-[10px]">@{l.odd}</span>}
                            </span>
                          ))
                        ) : ehHero ? (
                          <span className="text-white/80 text-xs font-medium">Desafio Individual</span>
                        ) : (
                          <span className="text-white/90 text-xs font-semibold">
                            Sala #{it.salaNum} • Aposta: <span className="text-[#FFB700] font-black">{it.apostaMc ?? 0} MC</span>
                          </span>
                        )}
                      </div>

                      {/* Data / Hora da partida */}
                      <p className="text-[11px] text-white/50 font-medium mt-0.5 flex items-center gap-2">
                        <span>{formatarData(it.criadoEm)}</span>
                        {it.stakeTotal ? (
                          <>
                            <span className="text-white/20">•</span>
                            <span className="text-white/40">Stake: {it.stakeTotal} MC</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  {/* Saldo Ganho/Perdido em MC */}
                  <DeltaBadge delta={it.deltaMc} />
                </div>
              </CutCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HistoricoApostas;
