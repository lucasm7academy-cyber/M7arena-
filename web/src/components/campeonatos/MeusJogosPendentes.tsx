import { motion, AnimatePresence } from "motion/react";
import { Swords, ChevronDown, Clock, Zap, Calendar } from "lucide-react";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";
import { sameTeamRef } from "../../features/campeonatos/domain/team-ref";

export const MeusJogosPendentes = () => {
  const { campeonato, myPendingMatches, getMyTeamInMatch, isPendingMatchesOpen, setIsPendingMatchesOpen, setEditingMatchIndex, setJogoStatusAtStart, setEditFormData, setIsScheduleEditModalOpen } = useCampeonato();
  if (myPendingMatches.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full rounded-2xl border border-white/10 bg-[#08080a] shadow-2xl p-4 sm:p-6 transition-all"
    >
      <div
        className="flex items-center justify-between mb-4 cursor-pointer select-none"
        onClick={() =>
          setIsPendingMatchesOpen(!isPendingMatchesOpen)
        }
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Swords
              className="w-6 h-6"
              style={{ color: campeonato.themeColor }}
            />
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
                  sameTeamRef(t.tag, teamATag) || sameTeamRef(t.name, teamATag) || sameTeamRef(t.nome, teamATag)
                ) || { name: teamATag, tag: teamATag, cor: (jogo as any).corA || "#FFB700", icone: "ShieldCheck" };
                const teamBData = allTeamsPend.find((t: any) =>
                  sameTeamRef(t.tag, teamBTag) || sameTeamRef(t.name, teamBTag) || sameTeamRef(t.nome, teamBTag)
                ) || { name: teamBTag, tag: teamBTag, cor: (jogo as any).corB || "#FFB700", icone: "ShieldCheck" };

                const isWaitingForMyResponse =
                  jogo.status === "proposto" &&
                  myTeamInMatch &&
                  !sameTeamRef(jogo.proposedBy, myTeamInMatch.tag);
                const amITheProposer =
                  jogo.status === "proposto" &&
                  myTeamInMatch &&
                  sameTeamRef(jogo.proposedBy, myTeamInMatch.tag);

                return (
                  <div
                    key={i}
                    className="w-full rounded-xl border border-white/10 bg-[#0c0c10] p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-all"
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
                                : "",
                            action:
                              jogo.status === "proposto"
                                ? "accept"
                                : "propose",
                            placar: "",
                          });
                          setIsScheduleEditModalOpen(true);
                        }}
                        disabled={amITheProposer}
                        className={`w-full px-4 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl flex items-center justify-center gap-2 ${
                          amITheProposer
                            ? "bg-white/10 text-white/40 cursor-not-allowed"
                            : "text-black hover:scale-105 active:scale-95 cursor-pointer"
                        }`}
                        style={{
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
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
