import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BADGE, CUT_BADGE_INNER, CUT_BUTTON, CUT_BUTTON_INNER } from "./cut-edge";

export const VisaoGeral = ({ campeonato, getIcon }: any) => {
  return (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-12 w-full"
                >
                  {/* O START TOURNAMENT BANNER FOI REMOVIDO PARA PRODUÇÃO */}

                  <div
                    className="relative p-[1.5px] shadow-2xl transition-all"
                    style={{
                      clipPath: CUT_FRAME,
                      background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.05) 100%)`,
                      boxShadow: `0 0 40px -10px ${campeonato.themeColor || '#FFB700'}26`
                    }}
                  >
                    <div
                      className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-4 sm:p-6 space-y-4 sm:space-y-6"
                      style={{ clipPath: CUT_FRAME_INNER }}
                    >
                      <div className="flex items-center gap-4 mb-2">
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
                            <Trophy className="w-6 h-6" style={{ color: campeonato.themeColor }} />
                          </div>
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-white uppercase tracking-widest leading-none">
                            Classificação
                          </h2>
                          <p
                            className="text-[10px] font-black uppercase tracking-[0.3em] mt-1"
                            style={{ color: campeonato.themeColor }}
                          >
                            Ranking geral do campeonato
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {(campeonato.classificacao || []).map((time, i) => {
                          const Icon = getIcon((time as any).icone);
                          return (
                            <div
                              key={i}
                              className="relative p-[1px] transition-all hover:scale-[1.005]"
                              style={{
                                clipPath: CUT_BUTTON,
                                background: i < 4
                                  ? `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}80, rgba(255,255,255,0.05))`
                                  : 'rgba(255, 255, 255, 0.05)',
                              }}
                            >
                              <div
                                className={`w-full p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                                  i < 4 ? 'bg-[#0b0b10]' : 'bg-[#08080a] hover:bg-[#0c0c10]'
                                }`}
                                style={{ clipPath: CUT_BUTTON_INNER }}
                              >
                                <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
                                  <div
                                    className="w-8 text-center font-black text-2xl shrink-0"
                                    style={{
                                      color:
                                        i < 4
                                          ? campeonato.themeColor
                                          : "rgba(255,255,255,0.4)",
                                    }}
                                  >
                                    {time.rank}º
                                  </div>
                                  <div
                                    className="w-14 h-14 p-[1.5px] flex items-center justify-center shrink-0"
                                    style={{
                                      clipPath: CUT_BADGE,
                                      background: (time as any).cor || "#FFB700",
                                      boxShadow: `0 8px 24px -6px ${(time as any).cor || "#FFB700"}60`,
                                    }}
                                  >
                                    <div
                                      className="w-full h-full bg-black flex items-center justify-center overflow-hidden"
                                      style={{ clipPath: CUT_BADGE_INNER }}
                                    >
                                      {(time as any).logo ? (
                                        <img
                                          src={(time as any).logo} loading="lazy"
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <Icon
                                          className="w-7 h-7"
                                          style={{
                                            color: (time as any).cor || "#FFB700",
                                          }}
                                        />
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <h3 className="text-white font-black text-lg sm:text-xl tracking-tight leading-tight truncate uppercase">
                                        {time.nome}
                                      </h3>
                                      <span
                                        className="inline-block text-[9px] sm:text-[10px] font-black px-2 py-0.5 tracking-widest shrink-0"
                                        style={{
                                          clipPath: CUT_BADGE,
                                          color: (time as any).cor || "#FFB700",
                                          background: `${(time as any).cor}18`,
                                          border: `1px solid ${(time as any).cor}40`,
                                        }}
                                      >
                                        #{time.tag}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 md:gap-6 min-w-[220px]">
                                  <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-wider">
                                      V
                                    </span>
                                    <span
                                      className="text-2xl font-black"
                                      style={{ color: "#00FF41" }}
                                    >
                                      {(time as any).v}
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-wider">
                                      D
                                    </span>
                                    <span
                                      className="text-2xl font-black"
                                      style={{ color: "#FF3131" }}
                                    >
                                      {(time as any).d}
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-wider">
                                      J
                                    </span>
                                    <span
                                      className="text-2xl font-black"
                                      style={{ color: campeonato.themeColor }}
                                    >
                                      {(time as any).j}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
  );
};
