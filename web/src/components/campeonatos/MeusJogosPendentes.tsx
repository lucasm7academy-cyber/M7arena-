import { motion, AnimatePresence } from "motion/react";
import { Swords, ChevronDown, Clock, Zap, Calendar } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BADGE, CUT_BADGE_INNER, CUT_BUTTON, CUT_BUTTON_INNER } from "./cut-edge";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";

export const MeusJogosPendentes = () => {
  const { campeonato, myPendingMatches, getMyTeamInMatch, isPendingMatchesOpen, setIsPendingMatchesOpen, setEditingMatchIndex, setJogoStatusAtStart, setEditFormData, setIsScheduleEditModalOpen } = useCampeonato();
  if (myPendingMatches.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
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
        <div
          className="flex items-center justify-between mb-4 cursor-pointer select-none"
          onClick={() =>
            setIsPendingMatchesOpen(!isPendingMatchesOpen)
          }
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
                <Swords
                  className="w-6 h-6"
                  style={{ color: campeonato.themeColor }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-black uppercase tracking-widest text-white leading-none">
                  Meus Jogos Pendentes
                </h3>
                <ChevronDown
                  className={`w-6 h-6 text-white/30 transition-transform duration-300 ${isPendingMatchesOpen ? "" : "-rotate-90"}`}
                />
              </div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.3em] mt-2"
                style={{ color: campeonato.themeColor }}
              >
                Capitão, selecione um rival para propor data
              </p>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isPendingMatchesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-3 pt-2">
                {myPendingMatches.map((jogo: any, i: number) => {
                  const myTeamInMatch = getMyTeamInMatch(jogo);
                  const teamATag = jogo.timeA;
                  const teamBTag = jogo.timeB;

                  const allTeamsPend = campeonato.timesInscritos || campeonato.classificacao || [];
                  const teamAData = allTeamsPend.find((t: any) =>
                    t.tag === teamATag || t.name === teamATag || t.nome === teamATag
                  ) || { name: teamATag, tag: teamATag, cor: (jogo as any).corA || "#FFB700", icone: "ShieldCheck" };
                  const teamBData = allTeamsPend.find((t: any) =>
                    t.tag === teamBTag || t.name === teamBTag || t.nome === teamBTag
                  ) || { name: teamBTag, tag: teamBTag, cor: (jogo as any).corB || "#FFB700", icone: "ShieldCheck" };

                  const isWaitingForMyResponse =
                    jogo.status === "proposto" &&
                    myTeamInMatch &&
                    jogo.proposedBy !== myTeamInMatch.tag;
                  const amITheProposer =
                    jogo.status === "proposto" &&
                    myTeamInMatch &&
                    jogo.proposedBy === myTeamInMatch.tag;

                  return (
                    <div
                      key={i}
                      className="relative p-[1px] transition-all"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: 'rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div
                        className="p-4 bg-[#0c0c10] flex flex-col md:flex-row items-center justify-between gap-4"
                        style={{ clipPath: CUT_BUTTON_INNER }}
                      >
                        <div className="flex-1 flex items-center gap-4 w-full">
                          {myTeamInMatch ? (
                            <div className="flex items-center gap-2">
                              <div className="text-white text-[10px] font-black select-none">
                                VS
                              </div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-base sm:text-lg font-black text-white uppercase truncate max-w-[150px]">
                                  {myTeamInMatch.tag === teamATag
                                    ? teamBData.name ||
                                      teamBData.nome
                                    : teamAData.name ||
                                      teamAData.nome}
                                </p>
                                <span
                                  className="text-base sm:text-lg font-black"
                                  style={{
                                    color: campeonato.themeColor,
                                  }}
                                >
                                  #
                                  {myTeamInMatch.tag === teamATag
                                    ? teamBData.tag
                                    : teamAData.tag}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-black text-white uppercase truncate max-w-[100px]">
                                  {teamAData.name ||
                                    teamAData.nome}
                                </p>
                                <span
                                  className="text-sm font-black"
                                  style={{
                                    color: campeonato.themeColor,
                                  }}
                                >
                                  #{teamAData.tag}
                                </span>
                              </div>
                              <div className="text-white text-[10px] font-black">
                                VS
                              </div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-black text-white uppercase truncate max-w-[100px]">
                                  {teamBData.name ||
                                    teamBData.nome}
                                </p>
                                <span
                                  className="text-sm font-black"
                                  style={{
                                    color: campeonato.themeColor,
                                  }}
                                >
                                  #{teamBData.tag}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Botões de ação */}
                        <div className="flex flex-col gap-2 w-full md:w-[180px] shrink-0">
                          <button
                            onClick={() => {
                              if (amITheProposer) return;
                              const realIdx =
                                campeonato.cronograma.findIndex(
                                  (c: any) => c === jogo,
                                );
                              setEditingMatchIndex(realIdx);
                              setJogoStatusAtStart(jogo.status);
                              setEditFormData({
                                data:
                                  jogo.data &&
                                  jogo.data !== "A COMBINAR"
                                    ? jogo.data
                                    : new Date()
                                        .toISOString()
                                        .split("T")[0],
                                hora:
                                  jogo.hora &&
                                  jogo.hora !== "--:--"
                                    ? jogo.hora
                                    : "20:00",
                                action:
                                  jogo.status === "proposto"
                                    ? "accept"
                                    : "propose",
                                placar: "",
                              });
                              setIsScheduleEditModalOpen(true);
                            }}
                            disabled={amITheProposer}
                            className={`w-full px-4 py-3 text-black font-black uppercase tracking-widest text-[10px] transition-all shadow-xl flex items-center justify-center gap-2 ${
                              amITheProposer
                                ? "bg-white/10 text-white/40 cursor-not-allowed"
                                : "hover:scale-105 active:scale-95 cursor-pointer"
                            }`}
                            style={{
                              clipPath: CUT_BUTTON,
                              backgroundColor: amITheProposer
                                ? undefined
                                : isWaitingForMyResponse
                                  ? "#00FF41"
                                  : (campeonato.themeColor || '#FFB700'),
                              boxShadow: amITheProposer
                                ? undefined
                                : isWaitingForMyResponse
                                  ? "0 10px 40px rgba(0, 255, 65, 0.3)"
                                  : `0 10px 40px ${campeonato.themeColor || '#FFB700'}33`,
                            }}
                          >
                            {amITheProposer ? (
                              <Clock className="w-3.5 h-3.5" />
                            ) : isWaitingForMyResponse ? (
                              <Zap className="w-3.5 h-3.5" />
                            ) : (
                              <Calendar className="w-3.5 h-3.5" />
                            )}
                            {jogo.status === "proposto"
                              ? amITheProposer
                                ? "Aguardando"
                                : "Responder"
                              : "Propor Data"}
                          </button>
                          {amITheProposer && (
                            <p className="text-[8px] font-black text-white/20 uppercase text-center tracking-widest">
                              Aguardando resposta
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};