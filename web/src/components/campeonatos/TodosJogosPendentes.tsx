import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ShieldCheck, X } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BADGE, CUT_BADGE_INNER, CUT_BUTTON, CUT_BUTTON_INNER } from "./cut-edge";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";

export const TodosJogosPendentes = () => {
  const { campeonato, isAdmin, allPendingMatches, isAllPendingOpen, setIsAllPendingOpen, setEditingMatchIndex, setJogoStatusAtStart, setEditFormData, setIsScheduleEditModalOpen, handleDeleteMatch } = useCampeonato();
  if (!isAdmin || allPendingMatches.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative p-[1.5px] shadow-2xl transition-all"
      style={{
        clipPath: CUT_FRAME,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.03))',
      }}
    >
      <div
        className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-4 sm:p-6"
        style={{ clipPath: CUT_FRAME_INNER }}
      >
        <div
          className="flex items-center justify-between mb-4 cursor-pointer select-none"
          onClick={() => setIsAllPendingOpen(!isAllPendingOpen)}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 p-[1px] flex items-center justify-center shrink-0"
              style={{
                clipPath: CUT_BADGE,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))',
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] flex items-center justify-center"
                style={{ clipPath: CUT_BADGE_INNER }}
              >
                <ShieldCheck className="w-6 h-6 text-white/60" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-black uppercase tracking-widest text-white leading-none">
                  Todos os Jogos Pendentes
                </h3>
                <ChevronDown
                  className={`w-6 h-6 text-white/30 transition-transform duration-300 ${isAllPendingOpen ? "" : "-rotate-90"}`}
                />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2 text-white/40">
                Painel de arbitragem — gerencie todos os jogos
              </p>
            </div>
          </div>
          <span
            className="text-[9px] font-black text-white/40 uppercase tracking-widest px-2.5 py-1 bg-white/5 border border-white/10"
            style={{ clipPath: CUT_BADGE }}
          >
            {allPendingMatches.length} jogos
          </span>
        </div>

        <AnimatePresence>
          {isAllPendingOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-3 pt-2">
                {allPendingMatches.map((jogo: any, i: number) => {
                  const teamATag = jogo.timeA;
                  const teamBTag = jogo.timeB;
                  const teamAData = (campeonato.timesInscritos || campeonato.classificacao || []).find(
                    (t: any) => t.tag === teamATag || t.nome === teamATag || t.name === teamATag
                  ) || { name: teamATag, tag: teamATag, cor: "#FFB700" };
                  const teamBData = (campeonato.timesInscritos || campeonato.classificacao || []).find(
                    (t: any) => t.tag === teamBTag || t.nome === teamBTag || t.name === teamBTag
                  ) || { name: teamBTag, tag: teamBTag, cor: "#FFB700" };

                  const statusLabel =
                    jogo.status === "proposto" ? "Proposta enviada" :
                    jogo.status === "confirmado" ? "Confirmado" :
                    jogo.status === "combinando" ? "A combinar" : jogo.status;

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
                        <div className="flex-1 flex items-center gap-3 w-full">
                          <span
                            className="text-[9px] font-black text-white/40 uppercase tracking-widest bg-white/5 px-2 py-1 shrink-0"
                            style={{ clipPath: CUT_BADGE }}
                          >
                            {jogo.fase || "Grupo"}
                          </span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <p className="text-sm font-black text-white uppercase truncate max-w-[110px]">
                              {teamAData.name || teamAData.nome || teamATag}
                            </p>
                            <span className="text-[10px] font-black text-white/20">VS</span>
                            <p className="text-sm font-black text-white uppercase truncate max-w-[110px]">
                              {teamBData.name || teamBData.nome || teamBTag}
                            </p>
                          </div>
                          <span className="text-[8px] font-black text-white/30 uppercase tracking-widest shrink-0">
                            {statusLabel}
                          </span>
                        </div>

                        <div className="w-full md:w-[180px] shrink-0 flex items-center gap-2">
                          <button
                            onClick={() => {
                              const realIdx = campeonato.cronograma.findIndex((c: any) => c === jogo);
                              setEditingMatchIndex(realIdx);
                              setJogoStatusAtStart(jogo.status);
                              setEditFormData({
                                data: jogo.data && jogo.data !== "A COMBINAR"
                                  ? jogo.data
                                  : new Date().toISOString().split("T")[0],
                                hora: jogo.hora && jogo.hora !== "--:--" ? jogo.hora : "20:00",
                                action: "accept",
                                placar: "",
                              });
                              setIsScheduleEditModalOpen(true);
                            }}
                            className="flex-1 px-4 py-2.5 bg-white text-black font-black uppercase tracking-widest text-[9px] hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-1.5 cursor-pointer"
                            style={{ clipPath: CUT_BUTTON }}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Arbitrar
                          </button>
                          <button
                            onClick={() => handleDeleteMatch(jogo)}
                            title="Excluir jogo"
                            className="px-3 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                            style={{ clipPath: CUT_BADGE }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
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