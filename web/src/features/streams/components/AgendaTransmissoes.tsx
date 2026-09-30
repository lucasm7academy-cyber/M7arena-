// Agenda de transmissões (spec 2026-09-29): o streamer pega um jogo confirmado,
// entra no ar (recebendo o código da partida) e a plataforma desliga a live no
// fim da série. Duas listas compactas: "Minhas Transmissões" (jogos que o
// usuário pegou, com os controles) e "Agenda de Jogos" (disponíveis para pegar;
// pegar migra para cima, soltar devolve para a agenda). Componente próprio
// porque Streamers.tsx é herdado.
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

function nomeDe(time: AgendaJogo['time_a']): string {
  return time?.nome || (time?.tag ? `#${time.tag.replace(/^#/, '')}` : 'TBD');
}

interface LinhaProps {
  jogo: AgendaJogo;
  isStreamer: boolean;
  temTwitch: boolean;
  acaoId: string | null;
  copiado: string | null;
  onPegar: (jogo: AgendaJogo) => void;
  onSoltar: (jogo: AgendaJogo) => void;
  onEntrarNoAr: (jogo: AgendaJogo) => void;
  onEncerrar: (jogo: AgendaJogo) => void;
  onCopiar: (codigo: string) => void;
}

const BOTAO = 'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';

function LinhaJogo({ jogo, isStreamer, temTwitch, acaoId, copiado, onPegar, onSoltar, onEntrarNoAr, onEncerrar, onCopiar }: LinhaProps) {
  const carregandoAcao = acaoId === jogo.match_id;
  const noAr = !!jogo.transmissao_id && jogo.meu;

  return (
    <div
      className={`flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3 rounded-xl bg-[#050505]/90 backdrop-blur-md shadow-lg transition-all ${
        noAr ? 'border-2 border-purple-500/60 shadow-lg shadow-purple-500/10' : 'border border-white/10 hover:border-white/20'
      }`}
    >
      <span className="shrink-0 self-start lg:self-center px-2.5 py-1 bg-[#9146FF] text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider lg:w-32 text-center rounded-md shadow-md shadow-[#9146FF]/20">
        {(jogo.data_label || 'A COMBINAR')} • {jogo.hora || '--:--'}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-black uppercase text-white truncate">{nomeDe(jogo.time_a)}</span>
          <span className="text-white/40 font-black text-sm">x</span>
          <span className="text-base font-black uppercase text-white truncate">{nomeDe(jogo.time_b)}</span>
          {jogo.ao_vivo && (
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              AO VIVO
            </span>
          )}
        </div>
        <p className="text-xs text-white/50 uppercase font-bold tracking-wider truncate mt-0.5">
          {jogo.campeonato.titulo} • {jogo.fase}
        </p>
      </div>

      <div className="shrink-0 lg:w-48 text-left lg:text-right">
        {!jogo.meu && jogo.streamer ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-purple-400 font-bold">
            <FaTwitch className="w-3.5 h-3.5 shrink-0" /> /{jogo.streamer.twitch ? jogo.streamer.twitch.replace(/^[@/]/, '') : jogo.streamer.nome} vai transmitir
          </span>
        ) : jogo.meu ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-purple-400 font-bold uppercase">
            <FaTwitch className="w-3.5 h-3.5" /> Sua transmissão
          </span>
        ) : jogo.status === 'em_andamento' ? (
          <span className="text-xs font-black uppercase tracking-widest text-[#00FF41]">Em andamento</span>
        ) : (
          <span className="text-xs text-white/25 font-black uppercase tracking-widest">Sem streamer</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {jogo.meu && noAr && (
          <>
            {jogo.codigo_partida ? (
              <button
                onClick={() => onCopiar(jogo.codigo_partida!)}
                title="Copiar código da partida"
                className={`${BOTAO} bg-white/5 border border-white/10 text-white/80 font-mono hover:border-purple-500/50`}
              >
                <span className="max-w-[160px] truncate">{jogo.codigo_partida}</span>
                {copiado === jogo.codigo_partida ? (
                  <Check className="w-3 h-3 text-green-400 shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 text-white/50 shrink-0" />
                )}
              </button>
            ) : (
              <span className="text-[10px] text-white/30 uppercase font-black tracking-widest">
                Aguardando o organizador iniciar a série
              </span>
            )}
            <button
              onClick={() => onEncerrar(jogo)}
              disabled={carregandoAcao}
              className={`${BOTAO} bg-white hover:bg-zinc-100 text-black`}
            >
              {carregandoAcao ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
              Encerrar
            </button>
          </>
        )}

        {jogo.meu && !noAr && (
          <>
            <button
              onClick={() => onEntrarNoAr(jogo)}
              disabled={!jogo.pode_entrar_no_ar || carregandoAcao}
              title={jogo.pode_entrar_no_ar ? undefined : 'Disponível 30 min antes do horário'}
              className={`${BOTAO} bg-purple-600 hover:bg-purple-500 text-white`}
            >
              {carregandoAcao ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              Estou no ar
            </button>
            <button
              onClick={() => onSoltar(jogo)}
              disabled={carregandoAcao}
              className={`${BOTAO} bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600`}
            >
              Soltar
            </button>
          </>
        )}

        {!jogo.meu && jogo.streamer && jogo.ao_vivo && (
          <a
            href={`https://twitch.tv/${jogo.streamer.twitch}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BOTAO} border border-[#9146FF]/40 text-[#9146FF] hover:text-white hover:border-[#9146FF]`}
          >
            <FaTwitch className="w-3 h-3" /> Assistir agora
          </a>
        )}

        {!jogo.meu && !jogo.streamer && isStreamer && temTwitch && jogo.pode_assumir && (
          <button
            onClick={() => onPegar(jogo)}
            disabled={carregandoAcao}
            className={`${BOTAO} bg-white/5 border border-white/10 hover:bg-purple-600 hover:border-purple-500 text-white`}
          >
            {carregandoAcao ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Quero transmitir
          </button>
        )}
      </div>
    </div>
  );
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

  const executar = async (jogo: AgendaJogo, fn: () => Promise<unknown>, mensagem: string) => {
    setAcaoId(jogo.match_id);
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

  const meus = jogos.filter((j) => j.meu);
  const agenda = jogos.filter((j) => !j.meu);

  const linhaProps = {
    isStreamer,
    temTwitch,
    acaoId,
    copiado,
    onPegar: (j: AgendaJogo) => executar(j, () => api.streams.pegar(j.match_id), 'Jogo movido para Minhas Transmissões!'),
    onSoltar: (j: AgendaJogo) => executar(j, () => api.streams.soltar(j.match_id), 'Vaga liberada — o jogo voltou para a agenda.'),
    onEntrarNoAr: (j: AgendaJogo) => executar(j, () => api.streams.entrarNoAr(j.match_id), 'Você está no ar!'),
    onEncerrar: (j: AgendaJogo) =>
      j.transmissao_id && executar(j, () => api.streams.parar(j.transmissao_id!), 'Transmissão encerrada!'),
    onCopiar: copiarCodigo,
  };

  return (
    <div className="mb-12 space-y-10">
      {meus.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <FaTwitch className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-black uppercase tracking-widest">Minhas Transmissões</h2>
            <span className="text-[10px] text-white/30 uppercase font-black tracking-widest hidden sm:inline">
              Jogos que você pegou — entre no ar no horário
            </span>
          </div>

          <div className="space-y-2">
            {meus.map((jogo) => (
              <LinhaJogo key={jogo.match_id} jogo={jogo} {...linhaProps} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-[#9146FF]" />
          <h2 className="text-xl font-black uppercase tracking-widest">Agenda de Jogos</h2>
          <span className="text-[10px] text-white/30 uppercase font-black tracking-widest hidden sm:inline">
            Jogos de campeonato agendados — pegue um para transmitir
          </span>
        </div>

        {agenda.length > 0 ? (
          <div className="space-y-2">
            {agenda.map((jogo) => (
              <LinhaJogo key={jogo.match_id} jogo={jogo} {...linhaProps} />
            ))}
          </div>
        ) : (
          <p className="text-center py-8 border border-dashed border-white/10 bg-[#050505]/90 backdrop-blur-md rounded-2xl text-white/30 text-xs font-black uppercase tracking-widest shadow-xl">
            Nenhum jogo disponível na agenda — os que você pegar aparecem em Minhas Transmissões
          </p>
        )}
      </section>
    </div>
  );
}
