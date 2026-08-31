import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { LoaderCircle, Swords, Zap, TrendingUp, TrendingDown, History, Minus } from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';
import { api, type ApiBetHistoryItem } from '../../lib/api';
import { CutCard } from '../ui/CutCard';

/**
 * Histórico de apostas (MC) do jogador: apostas individuais (self-bet) e salas
 * apostadas / modo desafio. Cada linha mostra o resultado e o delta de MC real
 * do ledger (ganhou +, perdeu -, anulada = devolveu 0). É a resposta ao pedido
 * "quero saber o que perdeu/ganhou em MC" — fonte única: /api/bets/history.
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

function statusLabel(s: string): string {
  return FLAG_LABEL[s] ?? s;
}

function legTag(id: string): string {
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Kills Over (\d+)/, 'Matar +$1')
    .replace(/Kills Under (\d+)/, 'Matar até $1');
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-green-400 font-black text-sm tabular-nums">
        <TrendingUp className="w-4 h-4" /> +{delta} <GiTwoCoins className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-400 font-black text-sm tabular-nums">
        <TrendingDown className="w-4 h-4" /> {delta} <GiTwoCoins className="w-3.5 h-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-white/40 font-bold text-sm tabular-nums">
      <Minus className="w-4 h-4" /> 0 <GiTwoCoins className="w-3.5 h-3.5" />
    </span>
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

  const somaGanho = itens.filter((i) => i.deltaMc > 0).reduce((a, i) => a + i.deltaMc, 0);
  const somaPerda = itens.filter((i) => i.deltaMc < 0).reduce((a, i) => a + i.deltaMc, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-1">Total ganho (MC)</p>
          <p className="text-xl font-black text-green-300 tabular-nums">{somaGanho}</p>
        </div>
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Total perdido (MC)</p>
          <p className="text-xl font-black text-red-300 tabular-nums">{somaPerda}</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center" style={{ clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' }}>
          <History className="w-3.5 h-3.5 text-[#FFB700]" />
        </div>
        <h3 className="text-sm font-black text-white uppercase tracking-widest">Histórico de Apostas</h3>
      </div>

      {carregando ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="w-6 h-6 animate-spin text-white/40" />
        </div>
      ) : erro ? (
        <div className="py-8 text-center text-white/40 text-xs font-bold uppercase tracking-widest">{erro}</div>
      ) : itens.length === 0 ? (
        <div className="py-10 text-center">
          <Zap className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 font-black uppercase tracking-widest text-xs">Nenhuma aposta ainda</p>
          <p className="text-white/20 text-[10px] uppercase mt-2">Participe de uma sala apostada ou faça uma aposta individual.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {itens.map((it) => {
            const ehHero = it.tipo === 'aposta_individual';
            const cor = ehHero ? '#FFB700' : '#a855f7';
            return (
              <CutCard key={`${it.tipo}-${it.id}`} className="overflow-hidden" borderColor="rgba(255,255,255,0.08)">
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-white/5 border border-white/10" style={{ clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' }}>
                      {ehHero ? <Zap className="w-4 h-4" style={{ color: cor }} /> : <Swords className="w-4 h-4" style={{ color: cor }} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-white uppercase tracking-wider truncate">
                          {ehHero ? 'Aposta Individual' : `Sala #${it.salaNum ?? ''}`}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-white/40">
                          {statusLabel(it.status)}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/35 mt-0.5 truncate">
                        {ehHero
                          ? `Solo Duo / Flex • ${it.legs?.map((l) => legTag(l.marketKey)).join(' + ') || ''}`
                          : `${it.modo?.toUpperCase() ?? ''} • ${it.apostaMc ?? 0} MC`}
                      </p>
                      <p className="text-[9px] text-white/25 mt-0.5">
                        {new Date(it.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
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
