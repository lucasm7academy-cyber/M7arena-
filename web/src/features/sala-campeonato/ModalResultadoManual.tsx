import { motion } from 'motion/react';
import { Trophy, X } from 'lucide-react';

interface ModalResultadoManualProps {
  aberto: boolean;
  sala: any;
  camp: any;
  ocupado?: boolean;
  onFechar: () => void;
  onConfirmar: (vencedor: 'A' | 'B') => void;
}

/**
 * ADM/proprietário insere manualmente quem venceu o jogo atual da série.
 * O servidor soma 1 e decide se a sala volta ao PRONTO ou se a série fecha.
 */
export function ModalResultadoManual({
  aberto,
  sala,
  camp,
  ocupado,
  onFechar,
  onConfirmar,
}: ModalResultadoManualProps) {
  if (!aberto) return null;

  const scoreA = camp?.serie ? (camp.serie.placar_a ?? 0) : (camp?.placar_a ?? 0);
  const scoreB = camp?.serie ? (camp.serie.placar_b ?? 0) : (camp?.placar_b ?? 0);
  const formato = camp?.serie
    ? `MD${camp.serie.best_of ?? 3}`
    : String(camp?.formato ?? 'md3').toUpperCase();
  const jogo = camp?.jogo ?? 1;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Inserir resultado manual"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-lg border border-[#FFB700]/30 bg-[#0b0a0e] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FFB700]" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Inserir Resultado</h2>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                {formato} · jogo {jogo} · série {scoreA} - {scoreB}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={ocupado}
            className="p-1.5 text-white/50 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-center text-sm font-bold text-white/80">
            Quem venceu o jogo {jogo}?
          </p>
          <p className="mt-1 text-center text-[11px] font-bold uppercase tracking-wider text-white/40">
            O servidor soma 1 vitória para o time escolhido.
          </p>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => onConfirmar('A')}
              className="group flex flex-col items-center gap-2 border border-[#3B82F6]/40 bg-[#3B82F6]/5 px-3 py-4 hover:bg-[#3B82F6]/15 hover:border-[#3B82F6] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {sala?.time_a_logo ? (
                <img src={sala.time_a_logo} alt="" className="w-14 h-14 object-contain" />
              ) : (
                <div className="w-14 h-14" />
              )}
              <span className="text-xs font-black uppercase tracking-wider text-white text-center line-clamp-2">
                {sala?.time_a_nome || 'Time A'}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3B82F6]">
                Vitória A
              </span>
            </button>

            <button
              type="button"
              disabled={ocupado}
              onClick={() => onConfirmar('B')}
              className="group flex flex-col items-center gap-2 border border-[#ef4444]/40 bg-[#ef4444]/5 px-3 py-4 hover:bg-[#ef4444]/15 hover:border-[#ef4444] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {sala?.time_b_logo ? (
                <img src={sala.time_b_logo} alt="" className="w-14 h-14 object-contain" />
              ) : (
                <div className="w-14 h-14" />
              )}
              <span className="text-xs font-black uppercase tracking-wider text-white text-center line-clamp-2">
                {sala?.time_b_nome || 'Time B'}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ef4444]">
                Vitória B
              </span>
            </button>
          </div>

          <p className="mt-4 text-center text-[11px] font-bold text-[#FFB700]/80">
            Se a série ainda não fechou, a sala volta para o PRONTO do próximo jogo.
          </p>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onFechar}
              disabled={ocupado}
              className="px-5 py-2 border border-white/15 text-xs font-black uppercase tracking-widest text-white/70 hover:text-white hover:border-white/40 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {ocupado ? 'Inserindo...' : 'Cancelar'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
