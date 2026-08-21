import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { CUT_BADGE } from "../../../../components/campeonatos/cut-edge";
import { DoubleEliminationBracket } from "../../../../components/campeonatos/DoubleEliminationBracket";
import { DoubleSideBracket } from "../../../../components/campeonatos/DoubleSideBracket";

export const BracketModal = ({ isOpen, onClose, campeonato, bracketData, onScoreChange, isAdmin, availableTeams, modalBracketRef, modalBracketHandlers, modalBracketScale }: any) => {
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
              className="absolute inset-0 bg-black/95 backdrop-blur-3xl"
            />

            {/* Fixed Exit Button */}
            <button
              onClick={() => onClose()}
              className="fixed top-20 right-8 z-[110] w-12 h-12 flex items-center justify-center text-white/40 hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition-all shadow-2xl bg-white/5 border border-white/10 cursor-pointer"
              style={{ clipPath: CUT_BADGE }}
            >
              <X className="w-6 h-6" />
            </button>

            {/* Modal Content - Dynamic Bracket based on format */}
            <div
              ref={modalBracketRef}
              {...modalBracketHandlers}
              className="relative w-full h-full overflow-auto p-12 md:p-20 no-scrollbar cursor-grab z-10"
              style={{ backgroundColor: "#060608" }}
            >
              <div
                style={{
                  transform: `scale(${modalBracketScale})`,
                  transformOrigin: "0 0",
                  transition: "transform 0.1s ease-out",
                  padding: "100px 480px",
                  width: "max-content",
                  minWidth: "100%",
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
          </motion.div>
        )}
      </AnimatePresence>
  );
};
