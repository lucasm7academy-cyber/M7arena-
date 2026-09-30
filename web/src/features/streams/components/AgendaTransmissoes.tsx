// Agenda de transmissões (spec 2026-09-29): o streamer pega um jogo confirmado,
// entra no ar (recebendo o código da partida) e a plataforma desliga a live no
// fim da série. Fica em componente próprio porque Streamers.tsx é herdado.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Check, Copy, Loader, Play, StopCircle } from 'lucide-react';
import { FaTwitch } from 'react-icons/fa';
import { api } from '../../../lib/api';
import type { AgendaJogo } from '../types';

interface Props {
  isStreamer: boolean;
  temTwitch: boolean;
  onToast: (title: string, message: string, type: 'success' | 'info') => void;
  onChange: () => void;
}

function tagDe(time: AgendaJogo['time_a']): string {
  return time?.tag ? `#${time.tag.replace(/^#/, '')}` : 'TBD';
}

export function AgendaTransmissoes({ isStreamer, temTwitch, onToast, onChange }: Props) {
  const [jogos, setJogos] = useState<AgendaJogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [acaoId, setAcaoId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const aoVivoRef = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const data = await api.streams.agenda();
      setJogos(data);
      const meuAoVivo = data.find((j) => j.meu && j.transmissao_id)?.transmissao_id ?? null;
      if (aoVivoRef.current !== null && aoVivoRef.current !== meuAoVivo) onChange();
      aoVivoRef.current = meuAoVivo;
    } catch (err) {
      console.error('Erro ao carregar agenda de transmissões:', err);
    } finally {
      setCarregando(false);
    }
  }, [onChange]);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 60000);
    return () => clearInterval(interval);
  }, [carregar]);

  const executar = async (matchId: string, fn: () => Promise<unknown>, mensagem: string) => {
    setAcaoId(matchId);
    try {
      await fn();
      onToast('✅', mensagem, 'success');
      await carregar();
      onChange();
    } catch (err: any) {
      onToast('⚠️', err?.message || 'Não foi possível concluir a ação.', 'info');
    } finally {
      setAcaoId(null);
    }
  };

  const copiarCodigo = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 2000);
  };

  if (carregando || jogos.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-5 h-5 text-[#FFB700]" />
        <h2 className="text-xl font-black uppercase tracking-widest">Agenda de Transmissões</h2>
        <span className="text-[10px] text-white/30 uppercase font-black tracking-widest hidden sm:inline">
          Jogos de campeonato agendados
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {jogos.map((jogo) => (
          <div
            key={jogo.match_id}
            className={`relative border-2 rounded-2xl p-5 transition-all duration-300 ${
              jogo.meu && jogo.transmissao_id
                ? 'border-purple-500 shadow-purple-500/20 shadow-xl'
                : 'border-white/5 hover:border-white/10'
            }`}
          >
            {jogo.meu && jogo.transmissao_id && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-900/20 via-transparent to-transparent pointer-events-none" />
            )}

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 bg-[#FFB700] text-black text-[9px] font-black uppercase tracking-widest">
                  {jogo.data_label || 'A COMBINAR'} • {jogo.hora || '--:--'}
                </span>
                {jogo.ao_vivo ? (
                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-red-500">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    AO VIVO
                  </span>
                ) : jogo.status === 'em_andamento' ? (
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#00FF41]">EM ANDAMENTO</span>
                ) : null}
              </div>

              <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">
                {jogo.campeonato.titulo} • {jogo.fase}
              </p>

              <div className="flex items-center gap-2 mt-2">
                <span className="text-base font-black uppercase text-white truncate max-w-[45%]">{tagDe(jogo.time_a)}</span>
                <span className="text-white/30 font-black">x</span>
                <span className="text-base font-black uppercase text-white truncate max-w-[45%]">{tagDe(jogo.time_b)}</span>
              </div>

              {jogo.streamer && !jogo.meu && (
                <p className="flex items-center gap-1.5 text-xs text-purple-400 font-bold mt-3">
                  <FaTwitch className="w-3 h-3" /> {jogo.streamer.nome} vai transmitir
                </p>
              )}

              {jogo.meu && jogo.transmissao_id && (
                <div className="mt-4 space-y-2">
                  {jogo.codigo_partida ? (
                    <button
                      onClick={() => copiarCodigo(jogo.codigo_partida!)}
                      title="Copiar código da partida"
                      className="w-full flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white/80 hover:border-purple-500/50 transition-colors"
                    >
                      <span className="truncate">{jogo.codigo_partida}</span>
                      {copiado === jogo.codigo_partida ? (
                        <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-white/50 shrink-0" />
                      )}
                    </button>
                  ) : (
                    <p className="text-[10px] text-white/30 uppercase font-black tracking-widest text-center py-2">
                      Aguardando o organizador iniciar a série
                    </p>
                  )}
                  <button
                    onClick={() =>
                      executar(jogo.match_id, () => api.streams.parar(jogo.transmissao_id!), 'Transmissão encerrada!')
                    }
                    disabled={acaoId === jogo.match_id}
                    className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-black rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                  >
                    {acaoId === jogo.match_id ? <Loader className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                    Encerrar
                  </button>
                </div>
              )}

              {jogo.meu && !jogo.transmissao_id && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => executar(jogo.match_id, () => api.streams.entrarNoAr(jogo.match_id), 'Você está no ar!')}
                    disabled={!jogo.pode_entrar_no_ar || acaoId === jogo.match_id}
                    title={jogo.pode_entrar_no_ar ? undefined : 'Disponível 30 min antes do horário'}
                    className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {acaoId === jogo.match_id ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    Estou no ar
                  </button>
                  <button
                    onClick={() => executar(jogo.match_id, () => api.streams.soltar(jogo.match_id), 'Vaga liberada.')}
                    disabled={acaoId === jogo.match_id}
                    className="px-4 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    Soltar
                  </button>
                </div>
              )}

              {!jogo.streamer && !jogo.meu && (
                <div className="mt-4">
                  {isStreamer && temTwitch && jogo.pode_assumir ? (
                    <button
                      onClick={() => executar(jogo.match_id, () => api.streams.pegar(jogo.match_id), 'Jogo reservado para você!')}
                      disabled={acaoId === jogo.match_id}
                      className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-purple-600 border border-white/10 hover:border-purple-500 text-white rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                    >
                      {acaoId === jogo.match_id ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Quero transmitir
                    </button>
                  ) : (
                    <p className="text-[10px] text-white/25 uppercase font-black tracking-widest text-center py-2">
                      Sem streamer definido
                    </p>
                  )}
                </div>
              )}

              {jogo.streamer && !jogo.meu && jogo.ao_vivo && (
                <a
                  href={`https://twitch.tv/${jogo.streamer.twitch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#9146FF] hover:text-white transition-colors"
                >
                  <FaTwitch className="w-3 h-3" /> Assistir agora
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
