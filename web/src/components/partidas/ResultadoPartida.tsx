// src/components/partidas/ResultadoPartida.tsx
// Tela de resultado de uma partida finalizada (estado `encerrada`): mantém a
// sala visível ao fundo e mostra no centro quem venceu (Time A/B ou Empate),
// os jogadores vencedores e os prints de prova anexados (mesmo padrão de
// miniatura + lightbox do AguardandoRevisao). Quem venceu vem do servidor
// (`sala.vencedor`) — aqui só apresentamos o resultado, em preto e branco.
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, X, ImageIcon, Loader, Crown, Users, Scale } from 'lucide-react';
import { api } from '../../lib/api';

interface ResultadoPartidaProps {
  sala: any;
}

export function ResultadoPartida({ sala }: ResultadoPartidaProps) {
  const matchId = sala?.match_id as string | undefined;
  const [prints, setPrints] = useState<any[]>([]);
  const [carregandoPrints, setCarregandoPrints] = useState(false);
  const [lightboxPrint, setLightboxPrint] = useState<any>(null);

  const vencedor = sala?.vencedor; // 'A' | 'B' | 'empate' | null
  const jogadores = Array.isArray(sala?.jogadores) ? sala.jogadores : [];
  const timeANome = sala?.time_a_nome || 'Time Azul';
  const timeBNome = sala?.time_b_nome || 'Time Vermelho';
  const timeA = jogadores.filter((j: any) => j.is_time_a);
  const timeB = jogadores.filter((j: any) => !j.is_time_a);

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
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest">
            {sala?.mpoints > 0 ? `${sala.mpoints} MC` : 'Casual'}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Lineup — cards estilo VagaSlot (preto + borda da cor da side).
              Lado que venceu: cor da side + coroa + "Vencedores". Lado que
              perdeu: preto e branco (grayscale), sem cor. */}
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
              ].map(({ venceu, cor, rotulo, time, avatarBorder }) => {
                const corBorda = venceu ? cor : 'rgba(255,255,255,0.18)';
                const corNick = venceu ? cor : '#9ca3af';
                return (
                  <div key={rotulo} className="relative p-[1px] overflow-hidden"
                    style={{
                      backgroundColor: corBorda,
                      clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                    }}>
                    <div className="bg-[#050505] p-2"
                      style={{
                        clipPath: 'polygon(11.4px 0, 100% 0, 100% calc(100% - 11.4px), calc(100% - 11.4px) 100%, 0 100%, 0 11.4px)',
                      }}>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 text-center flex items-center justify-center gap-1"
                        style={{ color: venceu ? cor : '#6b7280' }}>
                        {venceu && <Crown className="w-3 h-3" style={{ color: cor }} />}
                        {venceu ? 'Vencedores' : rotulo}
                      </p>
                      <div className="space-y-1.5">
                        {time.map((j: any) => (
                          <div key={j.user_id || j.id} className="flex items-center gap-2">
                            {j.avatar ? (
                              <img src={j.avatar} alt={j.nome}
                                className={`w-6 h-6 rounded-full object-cover shrink-0 border ${venceu ? avatarBorder : 'border-white/15'} ${venceu ? '' : 'grayscale'}`}
                                loading="lazy" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-white/10 shrink-0" />
                            )}
                            <span className="flex-1 truncate text-xs font-black uppercase tracking-tight"
                              style={{ color: corNick, textShadow: venceu ? `0 0 10px ${cor}44` : 'none' }}>{j.nome}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
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
        </div>
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
    </motion.div>
  );
}
