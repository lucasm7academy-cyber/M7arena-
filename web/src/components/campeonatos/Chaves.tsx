import { motion } from "motion/react";
import { Eye } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BADGE, CUT_BADGE_INNER } from "./cut-edge";
import { DoubleSideBracket } from "./DoubleSideBracket";
import { DoubleEliminationBracket } from "./DoubleEliminationBracket";

export const Chaves = ({ campeonato, isAdmin, isBracketModalOpen, setIsBracketModalOpen, bracketRef, bracketHandlers, bracketScale, bracketData, handleBracketScoreChange, bracketAvailableTeams }: any) => {
  return (
                <motion.div
                  key="bracket"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full"
                >
                  <div
                    className="relative p-[1.5px] shadow-2xl transition-all h-[70vh] min-h-[500px] flex flex-col"
                    style={{
                      clipPath: CUT_FRAME,
                      background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}60, rgba(255,255,255,0.05) 100%)`,
                      boxShadow: `0 0 50px -10px ${campeonato.themeColor || '#FFB700'}26`
                    }}
                  >
                    <div
                      className="w-full h-full bg-[#060608] relative overflow-hidden flex flex-col"
                      style={{ clipPath: CUT_FRAME_INNER }}
                    >
                      <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between bg-[#0c0c10]">
                        <div>
                          <h2
                            className="text-xl font-black uppercase tracking-[0.2em]"
                            style={{ color: campeonato.themeColor }}
                          >
                            Chaveamento Oficial
                          </h2>
                          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">
                            Confrontos eliminatórios em tempo real
                          </p>
                        </div>
                        <button
                          onClick={() => setIsBracketModalOpen(true)}
                          className="w-10 h-10 p-[1px] flex items-center justify-center transition-all cursor-pointer group"
                          style={{
                            clipPath: CUT_BADGE,
                            background: isBracketModalOpen
                              ? `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                              : 'rgba(255, 255, 255, 0.1)',
                          }}
                          title="Ver em Tela Cheia"
                        >
                          <div
                            className="w-full h-full bg-[#08080a] flex items-center justify-center text-white/40 group-hover:text-white"
                            style={{ clipPath: CUT_BADGE_INNER }}
                          >
                            <Eye
                              className="w-4 h-4 group-hover:scale-110 transition-transform"
                              style={{ color: "inherit" }}
                            />
                          </div>
                        </button>
                      </div>

                      <div
                        ref={bracketRef}
                        {...bracketHandlers}
                        className="flex-1 p-4 md:p-8 overflow-auto no-scrollbar bg-[#060608] cursor-grab"
                      >
                        <div
                          style={{
                            transform: `scale(${bracketScale})`,
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
                              if (s.includes("/"))
                                return parseInt(s.split("/")[1]) || 16;
                              return parseInt(s) || 16;
                            };
                            const totalParticipants = parseVagas(
                              campeonato.vagas,
                            );
                            const timesPorGrupo = campeonato.timesPorGrupo || 8;
                            const classificados =
                              campeonato.classificadosPorGrupo || 4;
                            const numGrupos = Math.ceil(
                              totalParticipants / timesPorGrupo,
                            );
                            const totalClassificados = numGrupos * classificados;
                            const useDoubleElim =
                              campeonato.formato === "liga" &&
                              totalClassificados > 4;

                            if (useDoubleElim) {
                              return (
                                <DoubleEliminationBracket
                                  tournament={campeonato}
                                  bracketData={bracketData}
                                  onScoreChange={handleBracketScoreChange}
                                  isAdmin={isAdmin}
                                  availableTeams={bracketAvailableTeams}
                                />
                              );
                            } else {
                              return (
                                <DoubleSideBracket
                                  tournament={campeonato}
                                  bracketData={bracketData}
                                  onScoreChange={handleBracketScoreChange}
                                  isAdmin={isAdmin}
                                  availableTeams={bracketAvailableTeams}
                                />
                              );
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
  );
};
