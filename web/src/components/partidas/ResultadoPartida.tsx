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

  const vencedores =
    vencedor === 'A' || vencedor === 'B'
      ? jogadores.filter((j: any) => (vencedor === 'A' ? j.is_time_a : !j.is_time_a))
      : [];

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
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[65] w-[min(90vw,520px)]"
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
          {/* Vencedores em destaque */}
          <div>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" style={{ color: corVencedor }} />
              Vencedores
            </p>
            {vencedores.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {vencedores.map((j: any) => (
                  <span key={j.user_id || j.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-black"
                    style={{ background: `${corVencedor}15`, borderColor: `${corVencedor}40`, color: '#fff' }}>
                    {j.nome}
                    <span className="text-[9px] font-black uppercase opacity-60" style={{ color: corVencedor }}>
                      {j.is_time_a ? 'Azul' : 'Vermelho'}
                    </span>
                  </span>
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
          </div>

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
                    className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group text-left cursor-pointer"
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
              className="max-w-[min(480px,90vw)] max-h-[80vh] object-contain rounded-2xl shadow-2xl"
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
