import { motion, AnimatePresence } from "motion/react";
import { Trophy, TrendingDown, RefreshCw, Coins, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ApiBetTicket } from "../../lib/api";

/**
 * Modal de resultado de um desafio (aposta individual). Mostra o desfecho —
 * ganhou (+X MC), perdeu (–X MC) ou anulado (devolvido) — com o resumo das legs
 * e ações para fechar ou ver o histórico completo no perfil. Puro de exibição:
 * todo o dado vem do bilhete já finalizado.
 */

const LEG_STATUS_LABEL: Record<string, string> = {
  ganha: "Ganha",
  perdida: "Perdida",
  anulada: "Anulada",
  aberta: "Aberta",
};

export default function ModalResultadoAposta({
  ticket,
  deltaMc,
  onClose,
}: {
  ticket: ApiBetTicket;
  deltaMc: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const ganhou = deltaMc > 0;
  const perdeu = deltaMc < 0;
  const titulo = ganhou ? "Desafio Ganho!" : perdeu ? "Desafio Perdido" : "Desafio Anulado";
  const cor = ganhou ? "#22c55e" : perdeu ? "#ef4444" : "#94a3b8";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-[#0c0c10] border border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Header do resultado */}
          <div className="relative p-5 sm:p-6 text-center border-b border-white/5">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className="mx-auto mb-3 w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: `${cor}1a`, border: `1px solid ${cor}40` }}
            >
              {ganhou ? (
                <Trophy className="w-8 h-8" style={{ color: cor }} />
              ) : perdeu ? (
                <TrendingDown className="w-8 h-8" style={{ color: cor }} />
              ) : (
                <RefreshCw className="w-8 h-8" style={{ color: cor }} />
              )}
            </div>

            <h2 className="text-white font-black uppercase tracking-tight text-2xl leading-none" style={{ fontFamily: '"Anton","Arial Narrow","Bahnschrift Condensed",Impact,sans-serif' }}>
              {titulo}
            </h2>

            <div className="mt-3 flex items-center justify-center gap-1.5">
              <span className="text-3xl font-black tabular-nums" style={{ color: cor }}>
                {ganhou ? `+${deltaMc}` : perdeu ? deltaMc : "0"}
              </span>
              <Coins className="w-6 h-6" style={{ color: cor }} />
            </div>
            <p className="text-[11px] text-white/40 uppercase tracking-widest mt-1">
              {ganhou ? "para sua carteira" : perdeu ? "da sua carteira" : "MC devolvido"}
            </p>
          </div>

          {/* Corpo: fila + legs */}
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#121217] border border-white/8 mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Fila</span>
              <span className="text-xs font-black text-white">{ticket.queue === "flex" ? "Flex" : "Solo Duo"}</span>
            </div>

            <div className="space-y-2">
              {ticket.legs.map((leg) => (
                <div key={leg.id} className="flex items-center justify-between p-3 rounded-xl bg-[#121217] border border-white/8">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">{leg.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-white/40">{leg.odd}x • {leg.stake} MC</span>
                    <span
                      className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                      style={{
                        color: leg.status === "ganha" ? "#22c55e" : leg.status === "perdida" ? "#ef4444" : "#94a3b8",
                        background: leg.status === "ganha" ? "rgba(34,197,94,0.12)" : leg.status === "perdida" ? "rgba(239,68,68,0.12)" : "rgba(148,163,184,0.12)",
                      }}
                    >
                      {LEG_STATUS_LABEL[leg.status] ?? leg.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-[#0c0c10] border border-white/5">
              <Coins className="w-4 h-4 text-[#FFB700] shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/40 leading-snug">
                Resultado validado pelo servidor. Confira seu saldo de MC e o histórico completo no perfil.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={onClose}
                className="rounded-xl py-3 bg-[#121217] border border-white/10 text-white/70 text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={() => { onClose(); navigate("/perfil"); }}
                className="rounded-xl py-3 bg-[#FFB700] hover:bg-[#e0a000] text-black text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Ver histórico
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
