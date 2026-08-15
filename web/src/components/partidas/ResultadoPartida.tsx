// src/components/partidas/ResultadoPartida.tsx
// Tela de resultado de uma partida finalizada (estado `encerrada`): mantém a
// sala visível ao fundo e mostra no centro quem venceu (Time A/B ou Empate),
// os jogadores vencedores e os prints de prova anexados (mesmo padrão de
// miniatura + lightbox do AguardandoRevisao). Quem venceu vem do servidor
// (`sala.vencedor`) — aqui só apresentamos o resultado, em preto e branco.
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, X, ImageIcon, Loader, Crown, Users, Scale, AlertTriangle, Gavel, CheckCircle2 } from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { CardJogador } from './CardJogador';

interface ResultadoPartidaProps {
  sala: any;
  usuarioId?: string;
}

export function ResultadoPartida({ sala, usuarioId }: ResultadoPartidaProps) {
  const matchId = sala?.match_id as string | undefined;
  const [prints, setPrints] = useState<any[]>([]);
  const [carregandoPrints, setCarregandoPrints] = useState(false);
  const [lightboxPrint, setLightboxPrint] = useState<any>(null);

  const [contestando, setContestando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [minhaDisputa, setMinhaDisputa] = useState<any>(null);

  const vencedor = sala?.vencedor; // 'A' | 'B' | 'empate' | null
  const jogadores = Array.isArray(sala?.jogadores) ? sala.jogadores : [];
  const timeANome = sala?.time_a_nome || 'Time Azul';
  const timeBNome = sala?.time_b_nome || 'Time Vermelho';
  const timeA = jogadores.filter((j: any) => j.is_time_a);
  const timeB = jogadores.filter((j: any) => !j.is_time_a);

  // Dados reais da partida puxados da Riot (matchResults.payload → resumoRiot).
  // `null` quando a sala foi encerrada sem verificação automática.
  const rr = sala?.resultado_riot;
  const statsPorPuuid = new Map<string, any>(
    (rr?.participantes ?? []).map((p: any) => [p.puuid, p])
  );
  const formatarDuracao = (s: number) =>
    s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : null;

  const corVencedor = vencedor === 'A' ? '#3b82f6' : vencedor === 'B' ? '#ef4444' : '#fbbf24';
  const nomeVencedor = vencedor === 'A' ? timeANome : vencedor === 'B' ? timeBNome : 'Empate';
  const ladoVencedor = vencedor === 'A' ? 'Time A' : vencedor === 'B' ? 'Time B' : null;

  const carregarPrints = useCallback(async () => {
    if (!matchId) return;
    setCarregandoPrints(true);
    try {
      setPrints(await api.prints.list(matchId));
    } catch (e: any) {
      // Nunca engola erro: sem permissão não há prints para mostrar.
      console.error('[Resultado] falha ao listar prints:', e?.message);
      setPrints([]);
    } finally {
      setCarregandoPrints(false);
    }
  }, [matchId]);

  useEffect(() => {
    carregarPrints();
  }, [carregarPrints]);

  useEffect(() => {
    if (!matchId) return;
    api.disputas.list(matchId)
      .then((d) => setMinhaDisputa(d.find((x: any) => x.userId === usuarioId) ?? null))
      .catch((e: any) => console.error('[Resultado] falha ao listar disputas:', e?.message));
  }, [matchId, usuarioId]);

  const abrirContestacao = async () => {
    if (!matchId) return;
    if (motivo.trim().length < 5) { toast.error('Descreva o motivo (mínimo 5 caracteres).'); return; }
    setEnviando(true);
    try {
      let contestacaoUrl: string | undefined;
      if (arquivo) {
        const up = await api.prints.upload(matchId, arquivo, 'contestacao');
        contestacaoUrl = up.url;
      }
      await api.disputas.abrir(matchId, motivo.trim(), contestacaoUrl);
      toast.success('Contestação registrada — o admin vai analisar.');
      // Esconde o formulário imediatamente (bloco vira o banner verde); o
      // useEffect re-busca a lista real na próxima montagem da tela.
      setMinhaDisputa({ userId: usuarioId, status: 'aberta' });
      setContestando(false);
      setMotivo('');
      setArquivo(null);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível registrar a contestação.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[65] w-[min(94vw,640px)]"
    >
      <div
        className="rounded-2xl overflow-hidden border shadow-[0_0_60px_rgba(255,183,0,0.15)]"
        style={{ background: 'rgba(10,10,10,0.94)', backdropFilter: 'blur(16px)', borderColor: `${corVencedor}50` }}
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${corVencedor}20`, border: `1px solid ${corVencedor}50` }}>
              <Trophy className="w-4 h-4" style={{ color: corVencedor }} />
            </div>
            <div>
              <p className="text-white font-black text-sm uppercase tracking-widest">Partida Finalizada</p>
              <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: corVencedor }}>
                {vencedor === 'empate' ? '⚖️ Empate' : `${nomeVencedor} venceu${ladoVencedor ? ` — ${ladoVencedor}` : ''}`}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
            style={{ color: sala?.mpoints > 0 ? '#FFB700' : '#ffffff99' }}>
            {sala?.mpoints > 0 ? (<><GiTwoCoins className="w-3.5 h-3.5" /> {sala.mpoints} MC</>) : 'Casual'}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Placar e duração reais da partida (Riot) — quando disponível */}
          {rr && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="flex-1 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Blue</p>
                <p className="text-2xl font-black text-white tabular-nums">{rr.placar.blue.kills}</p>
              </div>
              <div className="text-center px-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  {formatarDuracao(rr.duracao_s) ? `Partida · ${formatarDuracao(rr.duracao_s)}` : 'Partida'}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-0.5">Abates</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-400">Red</p>
                <p className="text-2xl font-black text-white tabular-nums">{rr.placar.red.kills}</p>
              </div>
            </div>
          )}

          {/* Lineup — cada jogador em card individual estilo VagaSlot (preto +
              borda da cor da side + ícone da rota + avatar + nick). Lado que
              venceu: cor da side + coroa + "Vencedores". Lado que perdeu:
              preto e branco (grayscale), sem cor. */}
          {jogadores.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  lado: 'A' as const,
                  venceu: vencedor === 'A',
                  cor: '#3b82f6',
                  rotulo: 'Blue-Side',
                  time: timeA,
                  avatarBorder: 'border-blue-500/40',
                },
                {
                  lado: 'B' as const,
                  venceu: vencedor === 'B',
                  cor: '#ef4444',
                  rotulo: 'Red-Side',
                  time: timeB,
                  avatarBorder: 'border-red-500/40',
                },
              ].map(({ venceu, cor, rotulo, time, avatarBorder }) => (
                <div key={rotulo} className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 text-center flex items-center justify-center gap-1"
                    style={{ color: venceu ? cor : '#6b7280' }}>
                    {venceu && <Crown className="w-3 h-3" style={{ color: cor }} />}
                    {venceu ? 'Vencedores' : rotulo}
                  </p>
                  {time.map((j: any) => {
                    const stats = statsPorPuuid.get(j.puuid);
                    return (
                      <CardJogador
                        key={j.user_id || j.id}
                        jogador={j}
                        cor={venceu ? cor : null}
                        avatarBorder={avatarBorder}
                        grayscale={!venceu}
                        kda={stats ? `${stats.kills}/${stats.deaths}/${stats.assists}` : null}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          ) : vencedor === 'empate' ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.02] text-white/60 text-xs font-bold">
              <Scale className="w-4 h-4" />
              Partida empatada — nenhum lado venceu.
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] text-white/30 text-xs">
              <Users className="w-4 h-4" />
              Sem jogadores registrados nesta partida.
            </div>
          )}

          {/* Prints anexados */}
          <div>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Prints de prova {prints.length > 0 && `(${prints.length})`}
            </p>
            {carregandoPrints && prints.length === 0 ? (
              <div className="flex items-center justify-center py-3 text-white/30">
                <Loader className="w-4 h-4 animate-spin" />
              </div>
            ) : prints.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] text-white/25 text-xs">
                <ImageIcon className="w-4 h-4" />
                Nenhum print anexado nesta partida.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {prints.map((p) => (
                  <button key={p.id} onClick={() => setLightboxPrint(p)}
                    className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group text-left cursor-pointer"
                    title={`Print de ${p.nomeJogador} — clique para ampliar`}>
                    <img src={api.prints.file(p.id)} alt={`Print de ${p.nomeJogador}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white/70 text-[8px] font-black uppercase tracking-widest px-1 py-0.5 truncate">
                      {p.nomeJogador}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contestação — só participante confirmado da partida finalizada */}
          {jogadores.some((j: any) => j.user_id === usuarioId) && (
            <div className="pt-3 border-t border-white/10">
              {minhaDisputa ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-500/5 border border-green-500/20 text-green-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Contestação registrada — aguardando análise
                </div>
              ) : contestando ? (
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs text-white/50 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-white/10 file:text-white/70 file:font-bold" />
                  <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Descreva o motivo da contestação (ex.: não fui eu que joguei, o nick não confere)..."
                    rows={3} maxLength={500}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFB700]/50 placeholder:text-white/25" />
                  <div className="flex gap-2">
                    <button onClick={() => setContestando(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-bold hover:bg-white/10">Cancelar</button>
                    <button onClick={abrirContestacao} disabled={enviando} className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-black uppercase tracking-widest hover:bg-red-500/25 disabled:opacity-50 flex items-center justify-center gap-1.5">
                      <Gavel className="w-3.5 h-3.5" /> {enviando ? 'Enviando...' : 'Enviar contestação'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setContestando(true)}
                  className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white/50 hover:text-red-300 hover:border-red-500/30 text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Contestar resultado
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox do print (mesmo padrão dos logos de time). Renderizado via
          portal no body: o card raiz tem transform (translate do Tailwind +
          animação y), que quebraria o position: fixed e prenderia o popup ao
          tamanho do card. */}
      {createPortal(
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
      </AnimatePresence>,
      document.body,
      )}
    </motion.div>
  );
}
