import { motion, AnimatePresence } from "motion/react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { DoubleEliminationBracket } from "../../../../components/campeonatos/DoubleEliminationBracket";
import { DoubleSideBracket } from "../../../../components/campeonatos/DoubleSideBracket";
import { useCampeonato } from "../../CampeonatoContext";

export const BracketModal = ({
  isOpen,
  onClose,
  campeonato,
  bracketData,
  onScoreChange,
  isAdmin,
  availableTeams,
  modalBracketRef,
  modalBracketHandlers,
  modalBracketScale,
}: any) => {
  const campCtx = useCampeonato();
  const setModalBracketScale = campCtx?.setModalBracketScale;
  const currentScale = modalBracketScale ?? 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Backdrop with extreme blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onClose()}
            className="absolute inset-0 bg-black/85 backdrop-blur-2xl"
          />

          {/* Background Layer Oficial (Mesma imagem das salas e lobby) */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute inset-0 bg-[#050508]" />
            <div className="absolute inset-0">
              <img
                src="/images/fundo_elite.jpg"
                alt=""
                className="w-full h-full object-cover object-center opacity-45"
              />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,183,0,0.06)_0%,#050508_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.75)_100%)]" />
          </div>

          {/* Floating Controls Toolbar */}
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-2 bg-[#12121e]/90 backdrop-blur-xl border border-white/15 rounded-2xl px-3 py-2 shadow-2xl">
            <div className="flex items-center gap-2 pr-3 border-r border-white/10 hidden sm:flex">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  backgroundColor: campeonato?.themeColor || "#FFB700",
                  boxShadow: `0 0 10px ${campeonato?.themeColor || "#FFB700"}`,
                }}
              />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {campeonato?.titulo || campeonato?.nome || "Chaveamento"}
              </span>
            </div>

            {/* Controles de Zoom */}
            {setModalBracketScale && (
              <div className="flex items-center bg-[#181827] border border-white/10 rounded-xl p-1 gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() =>
                    setModalBracketScale((s: number) =>
                      Math.max(+(s - 0.1).toFixed(2), 0.35),
                    )
                  }
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Diminuir Zoom (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setModalBracketScale(1)}
                  className="px-2 h-7 rounded-lg flex items-center justify-center text-[11px] font-mono font-bold text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Resetar Zoom (100%)"
                >
                  {Math.round(currentScale * 100)}%
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModalBracketScale((s: number) =>
                      Math.min(+(s + 0.1).toFixed(2), 2.0),
                    )
                  }
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Aumentar Zoom (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

                <button
                  type="button"
                  onClick={() => setModalBracketScale(1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Redefinir Zoom para o padrão"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Fixed Exit Button */}
          <button
            onClick={() => onClose()}
            className="fixed top-6 right-6 z-[110] w-11 h-11 rounded-2xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all shadow-2xl bg-[#12121e]/90 backdrop-blur-xl border border-white/15 cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Content - Dynamic Bracket based on format */}
          <div
            ref={modalBracketRef}
            {...modalBracketHandlers}
            className="relative w-full h-full overflow-auto no-scrollbar cursor-grab active:cursor-grabbing z-10 select-none flex"
            style={{ backgroundColor: "transparent", touchAction: "none" }}
          >
            <div className="min-w-full min-h-full flex items-center justify-center p-12 md:p-24 m-auto">
              <div
                style={{
                  transform: `scale(${currentScale})`,
                  transformOrigin: "center center",
                  transition: "transform 0.08s ease-out",
                  width: "max-content",
                }}
              >
                {(() => {
                  const parseVagas = (vStr: any) => {
                    if (typeof vStr === "number") return vStr;
                    const s = String(vStr || "16");
                    if (s.includes("/")) return parseInt(s.split("/")[1]) || 16;
                    return parseInt(s) || 16;
                  };
                  const totalParticipants = parseVagas(campeonato.vagas);
                  const timesPorGrupo = campeonato.timesPorGrupo || 8;
                  const classificados = campeonato.classificadosPorGrupo || 4;
                  const numGrupos = Math.ceil(
                    totalParticipants / timesPorGrupo,
                  );
                  const totalClassificados = numGrupos * classificados;
                  const useDoubleElim =
                    campeonato.formato === "liga" && totalClassificados > 4;

                  if (useDoubleElim) {
                    return (
                      <DoubleEliminationBracket
                        tournament={campeonato}
                        bracketData={bracketData}
                        onScoreChange={onScoreChange}
                        isAdmin={isAdmin}
                        availableTeams={availableTeams}
                      />
                    );
                  } else {
                    return (
                      <DoubleSideBracket
                        tournament={campeonato}
                        bracketData={bracketData}
                        onScoreChange={onScoreChange}
                        isAdmin={isAdmin}
                        availableTeams={availableTeams}
                      />
                    );
                  }
                })()}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
