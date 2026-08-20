import { motion, AnimatePresence } from "motion/react";
import { History, ChevronLeft } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BADGE, CUT_BADGE_INNER, CUT_BUTTON, CUT_BUTTON_INNER } from "./cut-edge";

export const Historico = ({ campeonato, getDynamicStandings, expandedTeam, setExpandedTeam }: any) => {
  return (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full"
                >
                  <div
                    className="relative p-[1.5px] shadow-2xl transition-all"
                    style={{
                      clipPath: CUT_FRAME,
                      background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.05) 100%)`,
                      boxShadow: `0 0 40px -10px ${campeonato.themeColor || '#FFB700'}26`
                    }}
                  >
                    <div
                      className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-4 sm:p-6"
                      style={{ clipPath: CUT_FRAME_INNER }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 p-[1px] flex items-center justify-center shrink-0"
                          style={{
                            clipPath: CUT_BADGE,
                            background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                          }}
                        >
                          <div
                            className="w-full h-full bg-[#08080a] flex items-center justify-center"
                            style={{ clipPath: CUT_BADGE_INNER }}
                          >
                            <History className="w-6 h-6" style={{ color: campeonato.themeColor }} />
                          </div>
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-white uppercase tracking-widest leading-none">
                            Histórico de Partidas
                          </h2>
                          <p
                            className="text-[10px] font-black uppercase tracking-[0.3em] mt-1"
                            style={{ color: campeonato.themeColor }}
                          >
                            Acompanhe o desempenho detalhado de cada equipe
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 mt-6">
                        {(getDynamicStandings() || []).map((time, idx) => (
                          <div
                            key={idx}
                            className="relative p-[1px] transition-all"
                            style={{
                              clipPath: CUT_BUTTON,
                              background: expandedTeam === time.nome
                                ? `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}80, rgba(255,255,255,0.05))`
                                : 'rgba(255, 255, 255, 0.08)'
                            }}
                          >
                            <div
                              className="w-full bg-[#0c0c10] overflow-hidden"
                              style={{ clipPath: CUT_BUTTON_INNER }}
                            >
                              <button
                                onClick={() =>
                                  setExpandedTeam(
                                    expandedTeam === time.nome ? null : time.nome,
                                  )
                                }
                                className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-white/5 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-4 sm:gap-6">
                                  <span className="text-xl sm:text-2xl font-black text-white/20 w-8">
                                    0{idx + 1}
                                  </span>
                                  <div className="flex items-center gap-4">
                                    <div className="text-left">
                                      <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                                        {time.nome}{" "}
                                        <span className="text-[10px] text-white/40 ml-2">
                                          [{time.tag}]
                                        </span>
                                      </h3>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6">
                                  <div className="hidden md:flex items-center gap-6">
                                    <div className="text-center">
                                      <p className="text-[9px] font-black text-white/30 uppercase mb-0.5">
                                        V / D
                                      </p>
                                      <p className="text-xs sm:text-sm font-black text-white">
                                        {time.v}V - {time.d}D
                                      </p>
                                    </div>
                                  </div>
                                  <div
                                    className={`transition-transform duration-300 ${expandedTeam === time.nome ? "rotate-180" : ""}`}
                                  >
                                    <ChevronLeft className="w-5 h-5 text-white/30 -rotate-90" />
                                  </div>
                                </div>
                              </button>

                              <AnimatePresence>
                                {expandedTeam === time.nome && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-black/60 border-t border-white/5"
                                  >
                                    <div className="p-4 sm:p-6 space-y-3">
                                      {/* Histórico Real de Partidas */}
                                      {(() => {
                                        const teamMatches = (campeonato.cronograma || [])
                                          .filter(
                                            (m: any) =>
                                              (m.timeA === time.tag ||
                                               m.timeA === time.nome ||
                                               m.timeB === time.tag ||
                                               m.timeB === time.nome) &&
                                              m.status === "finalizado",
                                          )
                                          .sort((a: any, b: any) => {
                                            const dA = new Date(
                                              `${a.data || "2000-01-01"}T${a.hora || "00:00"}`,
                                            ).getTime();
                                            const dB = new Date(
                                              `${b.data || "2000-01-01"}T${b.hora || "00:00"}`,
                                            ).getTime();
                                            return dB - dA;
                                          });

                                        if (teamMatches.length === 0) {
                                          return (
                                            <div className="py-8 text-center">
                                              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                                                Nenhuma partida registrada para este campeonato
                                              </p>
                                            </div>
                                          );
                                        }

                                        return teamMatches.map(
                                          (match: any, mIdx: number) => {
                                            const isT1 = match.timeA === time.tag || match.timeA === time.nome;
                                            const opponentTag = isT1
                                              ? match.timeB
                                              : match.timeA;
                                            const opponentName =
                                              (
                                                campeonato.timesInscritos ||
                                                campeonato.classificacao ||
                                                []
                                              ).find((t: any) => t.tag === opponentTag)
                                                ?.name || opponentTag;

                                            const scores = (
                                              match.placar || "0 - 0"
                                            ).split(" - ");
                                            const score1 = parseInt(scores[0]) || 0;
                                            const score2 = parseInt(scores[1]) || 0;
                                            const myScore = isT1 ? score1 : score2;
                                            const oppScore = isT1 ? score2 : score1;

                                            const result =
                                              myScore > oppScore
                                                ? "V"
                                                : myScore < oppScore
                                                  ? "D"
                                                  : "E";

                                            return (
                                              <div
                                                key={mIdx}
                                                className="relative p-[1px]"
                                                style={{
                                                  clipPath: CUT_BUTTON,
                                                  background: 'rgba(255, 255, 255, 0.05)',
                                                }}
                                              >
                                                <div
                                                  className="flex items-center justify-between p-3 sm:p-4 bg-[#08080a]"
                                                  style={{ clipPath: CUT_BUTTON_INNER }}
                                                >
                                                  <div className="flex items-center gap-3.5">
                                                    <div
                                                      className="w-8 h-8 flex items-center justify-center text-xs font-black"
                                                      style={{
                                                        clipPath: CUT_BADGE,
                                                        backgroundColor: result === "V"
                                                          ? "rgba(0, 255, 65, 0.15)"
                                                          : result === "D"
                                                            ? "rgba(255, 49, 49, 0.15)"
                                                            : "rgba(0, 212, 255, 0.15)",
                                                        color: result === "V"
                                                          ? "#00FF41"
                                                          : result === "D"
                                                            ? "#FF3131"
                                                            : "#00D4FF",
                                                      }}
                                                    >
                                                      {result}
                                                    </div>
                                                    <div>
                                                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                                                        {match.fase} •{" "}
                                                        {(() => {
                                                          const raw = match.data || match.timestamp;
                                                          if (!raw || raw === "A COMBINAR") return "—";
                                                          const d = new Date(typeof raw === "string" && raw.length === 10 ? raw + "T00:00:00" : raw);
                                                          return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                                                        })()}
                                                      </p>
                                                      <p className="text-sm font-black text-white uppercase">
                                                        vs {opponentName}
                                                      </p>
                                                    </div>
                                                  </div>
                                                  <div className="text-right">
                                                    <p className="text-base sm:text-lg font-black text-white tracking-tighter">
                                                      {myScore} - {oppScore}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          },
                                        );
                                      })()}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
  );
};
