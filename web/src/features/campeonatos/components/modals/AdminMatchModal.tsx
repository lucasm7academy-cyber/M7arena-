import { motion, AnimatePresence } from "motion/react";
import { X, Swords, Check } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BUTTON, CUT_BUTTON_INNER, CUT_BADGE, CUT_BADGE_INNER } from "../../../../components/campeonatos/cut-edge";

export const AdminMatchModal = ({ isOpen, onClose, campeonato, isAdmin, adminMatchData, setAdminMatchData, onSubmit, myTeams }: any) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="relative p-[1.5px] w-full max-w-sm shadow-2xl"
            style={{
              clipPath: CUT_FRAME,
              background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.08) 100%)`,
              boxShadow: `0 0 50px -10px ${campeonato.themeColor || '#FFB700'}33`
            }}
          >
            <div
              className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-5 sm:p-6"
              style={{ clipPath: CUT_FRAME_INNER }}
            >
              <div className="border-b border-white/5 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
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
                        className="w-5 h-5"
                        style={{ color: campeonato.themeColor }}
                      />
                    </div>
                  </div>
                  <h3
                    className="text-base sm:text-lg font-black uppercase tracking-widest"
                    style={{ color: campeonato.themeColor }}
                  >
                    {isAdmin ? "Criar Confronto" : "Agendar Desafio"}
                  </h3>
                </div>
                <button
                  onClick={() => onClose()}
                  className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  style={{ clipPath: CUT_BADGE }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={onSubmit}
                className="pt-5 space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                    {isAdmin ? "Time A" : "Seu Time"}
                  </label>
                  <div
                    className="relative p-[1px]"
                    style={{
                      clipPath: CUT_BUTTON,
                      background: 'rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <select
                      value={adminMatchData.timeA}
                      onChange={(e) =>
                        setAdminMatchData({
                          ...adminMatchData,
                          timeA: e.target.value,
                        })
                      }
                      className={`w-full bg-[#0c0c10] px-4 py-3 text-white focus:outline-none transition-all font-black text-xs ${!isAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      style={{ clipPath: CUT_BUTTON_INNER }}
                      required
                      disabled={!isAdmin && myTeams.length <= 1}
                    >
                      {isAdmin ? (
                        <>
                          <option value="" className="bg-[#0A0A0A]">
                            SELECIONE O TIME A
                          </option>
                          {(
                            campeonato.timesInscritos ||
                            campeonato.classificacao ||
                            []
                          )?.map((t: any) => (
                            <option
                              key={t.tag}
                              value={t.tag}
                              className="bg-[#0A0A0A]"
                            >
                              {t.name || t.nome} [{t.tag}]
                            </option>
                          ))}
                        </>
                      ) : (
                        myTeams.map((t: any) => (
                          <option
                            key={t.tag}
                            value={t.tag}
                            className="bg-[#0A0A0A]"
                          >
                            {t.nome || t.name} [{t.tag}]
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="text-center text-[10px] font-black text-white/20 uppercase tracking-[0.5em] py-1">
                  VS
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                    Time Rival
                  </label>
                  <div
                    className="relative p-[1px]"
                    style={{
                      clipPath: CUT_BUTTON,
                      background: 'rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <select
                      value={adminMatchData.timeB}
                      onChange={(e) =>
                        setAdminMatchData({
                          ...adminMatchData,
                          timeB: e.target.value,
                        })
                      }
                      className="w-full bg-[#0c0c10] px-4 py-3 text-white focus:outline-none transition-all font-black text-xs cursor-pointer"
                      style={{ clipPath: CUT_BUTTON_INNER }}
                      required
                    >
                      <option value="" className="bg-[#0A0A0A]">
                        SELECIONE O RIVAL
                      </option>
                      {(
                        campeonato.timesInscritos ||
                        campeonato.classificacao ||
                        []
                      )
                        ?.filter((t: any) => t.tag !== adminMatchData.timeA)
                        .map((t: any) => (
                          <option
                            key={t.tag}
                            value={t.tag}
                            className="bg-[#0A0A0A]"
                          >
                            {t.name || t.nome} [{t.tag}]
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 text-black font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer hover:scale-[1.02] active:scale-[0.98] mt-4"
                  style={{
                    clipPath: CUT_BUTTON,
                    backgroundColor: campeonato.themeColor || '#FFB700',
                    boxShadow: `0 0 30px -5px ${campeonato.themeColor || '#FFB700'}66`,
                  }}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isAdmin
                      ? "Criar Jogo Oficial"
                      : "Confirmar e Propor Horário"}
                  </span>
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
