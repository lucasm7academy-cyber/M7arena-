import { motion, AnimatePresence } from "motion/react";
import { X, Clock, Minus, Plus } from "lucide-react";
import { api } from "../../../../lib/api";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BUTTON, CUT_BUTTON_INNER, CUT_BADGE, CUT_BADGE_INNER } from "../../../../components/campeonatos/cut-edge";

export const AgendamentoModal = ({ isOpen, onClose, campeonato, editFormData, setEditFormData, jogoStatusAtStart, editingMatchIndex, onSubmit, onDelete, myTeams, isAdmin, id, setCampeonato }: any) => {
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
            className="relative p-[1.5px] w-full max-w-md shadow-2xl"
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
                      <Clock
                        className="w-5 h-5"
                        style={{ color: campeonato.themeColor }}
                      />
                    </div>
                  </div>
                  <div>
                    <h3
                      className="text-base sm:text-lg font-black uppercase tracking-widest leading-tight"
                      style={{ color: campeonato.themeColor }}
                    >
                      {editFormData.action === "accept"
                        ? "Responder Proposta"
                        : editFormData.action === "finish"
                          ? jogoStatusAtStart === "finalizado"
                            ? "Editar Resultado"
                            : "Finalizar Jogo"
                          : "Propor Horário"}
                    </h3>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                      Defina o status e horário do jogo
                    </p>
                  </div>
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
                {editFormData.action !== "finish" && (
                  <div
                    className="p-3.5 mb-2 flex items-center justify-center transition-all"
                    style={{
                      clipPath: CUT_BUTTON,
                      backgroundColor:
                        editFormData.action === "accept"
                          ? "rgba(0, 255, 65, 0.1)"
                          : `${campeonato.themeColor}1A`,
                      border: `1px solid ${editFormData.action === "accept" ? "rgba(0, 255, 65, 0.2)" : `${campeonato.themeColor}33`}`,
                    }}
                  >
                    <p
                      className="text-[10px] font-black leading-relaxed uppercase tracking-widest text-center"
                      style={{
                        color:
                          editFormData.action === "accept"
                            ? "#00FF41"
                            : campeonato.themeColor,
                      }}
                    >
                      {editFormData.action === "accept"
                        ? "Aceite ou altere para enviar uma contra-proposta."
                        : "Selecione a data e o horário para o confronto."}
                    </p>
                  </div>
                )}

                {editFormData.action !== "finish" && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                        Data do Confronto
                      </label>
                      <div
                        className="relative p-[1px]"
                        style={{
                          clipPath: CUT_BUTTON,
                          background: 'rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        <input
                          type="date"
                          value={editFormData.data}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              data: e.target.value,
                              action:
                                editFormData.action === "accept"
                                  ? "propose"
                                  : editFormData.action,
                            })
                          }
                          className="w-full bg-[#0c0c10] px-4 py-3.5 text-white focus:outline-none transition-all font-bold appearance-none [color-scheme:dark] text-xs"
                          style={{ clipPath: CUT_BUTTON_INNER }}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                        Horário Previsto
                      </label>
                      <div
                        className="relative p-[1px]"
                        style={{
                          clipPath: CUT_BUTTON,
                          background: 'rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        <input
                          type="time"
                          value={editFormData.hora}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              hora: e.target.value,
                              action:
                                editFormData.action === "accept"
                                  ? "propose"
                                  : editFormData.action,
                            })
                          }
                          className="w-full bg-[#0c0c10] px-4 py-3.5 text-white focus:outline-none transition-all font-bold appearance-none [color-scheme:dark] text-xs"
                          style={{ clipPath: CUT_BUTTON_INNER }}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {editFormData.action === "finish" && isAdmin && (
                  <div className="space-y-5 py-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center block">
                      Resultado da Partida
                    </label>

                    <div className="flex items-center justify-center gap-6 sm:gap-8">
                      {/* Team A Score */}
                      <div className="flex flex-col items-center gap-3">
                        <div
                          className="text-[11px] font-black text-white uppercase truncate w-28 text-center bg-white/5 py-1.5 px-2.5 border border-white/10"
                          style={{ clipPath: CUT_BADGE }}
                        >
                          {
                            campeonato.cronograma[editingMatchIndex!]
                              ?.timeA
                          }
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              const [sA, sB] = (
                                editFormData.placar || "0 - 0"
                              )
                                .split(" - ")
                                .map((s) => parseInt(s) || 0);
                              if (sA > 0)
                                setEditFormData({
                                  ...editFormData,
                                  placar: `${sA - 1} - ${sB}`,
                                });
                            }}
                            className="w-9 h-9 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10"
                            style={{ clipPath: CUT_BADGE }}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-3xl sm:text-4xl font-black text-white w-10 text-center">
                            {
                              (editFormData.placar || "0 - 0").split(
                                " - ",
                              )[0]
                            }
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const [sA, sB] = (
                                editFormData.placar || "0 - 0"
                              )
                                .split(" - ")
                                .map((s) => parseInt(s) || 0);
                              setEditFormData({
                                ...editFormData,
                                placar: `${sA + 1} - ${sB}`,
                              });
                            }}
                            className="w-9 h-9 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10"
                            style={{ clipPath: CUT_BADGE }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-white/20 text-xl font-black italic">
                        VS
                      </div>

                      {/* Team B Score */}
                      <div className="flex flex-col items-center gap-3">
                        <div
                          className="text-[11px] font-black text-white uppercase truncate w-28 text-center bg-white/5 py-1.5 px-2.5 border border-white/10"
                          style={{ clipPath: CUT_BADGE }}
                        >
                          {
                            campeonato.cronograma[editingMatchIndex!]
                              ?.timeB
                          }
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              const [sA, sB] = (
                                editFormData.placar || "0 - 0"
                              )
                                .split(" - ")
                                .map((s) => parseInt(s) || 0);
                              if (sB > 0)
                                setEditFormData({
                                  ...editFormData,
                                  placar: `${sA} - ${sB - 1}`,
                                });
                            }}
                            className="w-9 h-9 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10"
                            style={{ clipPath: CUT_BADGE }}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-3xl sm:text-4xl font-black text-white w-10 text-center">
                            {
                              (editFormData.placar || "0 - 0").split(
                                " - ",
                              )[1]
                            }
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const [sA, sB] = (
                                editFormData.placar || "0 - 0"
                              )
                                .split(" - ")
                                .map((s) => parseInt(s) || 0);
                              setEditFormData({
                                ...editFormData,
                                placar: `${sA} - ${sB + 1}`,
                              });
                            }}
                            className="w-9 h-9 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10"
                            style={{ clipPath: CUT_BADGE }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2.5 pt-3">
                  {editFormData.action === "accept" && (
                    <button
                      type="button"
                      onClick={() => {
                        const match =
                          campeonato.cronograma[editingMatchIndex!];
                        const isChanged =
                          editFormData.data !== match.data ||
                          editFormData.hora !== match.hora;

                        if (isChanged) {
                          const form = document.querySelector("form");
                          if (form) form.requestSubmit();
                          return;
                        }

                        let actingTeamTag = "ADMIN";
                        const myTeamForAccept = myTeams.find(
                          (t) =>
                            t.tag === match.timeA ||
                            t.tag === match.timeB ||
                            t.nome === match.timeA ||
                            t.nome === match.timeB,
                        );
                        if (myTeamForAccept) actingTeamTag = myTeamForAccept.tag;

                        match.status = "confirmado";
                        match.lastActionBy = actingTeamTag;
                        const updatedCampeonato = {
                          ...campeonato,
                          cronograma: [...campeonato.cronograma],
                        };
                        setCampeonato(updatedCampeonato);
                        api.tournaments.atualizarCronograma(id, updatedCampeonato.cronograma)
                          .catch((error: any) => console.error('Erro ao aceitar:', error.message));
                        onClose();
                      }}
                      className="w-full py-3.5 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        clipPath: CUT_BUTTON,
                        backgroundColor: editFormData.data !==
                          campeonato.cronograma[editingMatchIndex!]?.data ||
                        editFormData.hora !==
                          campeonato.cronograma[editingMatchIndex!]?.hora
                          ? "#FFB700"
                          : "#00FF41",
                        color: "#000000",
                        boxShadow: editFormData.data !==
                          campeonato.cronograma[editingMatchIndex!]?.data ||
                        editFormData.hora !==
                          campeonato.cronograma[editingMatchIndex!]?.hora
                          ? "0 0 25px rgba(255,183,0,0.3)"
                          : "0 0 25px rgba(0,255,65,0.3)"
                      }}
                    >
                      {editFormData.data !==
                        campeonato.cronograma[editingMatchIndex!]?.data ||
                      editFormData.hora !==
                        campeonato.cronograma[editingMatchIndex!]?.hora
                        ? "Propor Novo Horário"
                        : "Aceitar Horário"}
                    </button>
                  )}

                  {editFormData.action !== "accept" && (
                    <button
                      type="submit"
                      className="w-full py-3.5 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        clipPath: CUT_BUTTON,
                        backgroundColor: editFormData.action === "finish"
                          ? "#00FF41"
                          : (campeonato.themeColor || "#FFB700"),
                        color: "#000000",
                        boxShadow: editFormData.action === "finish"
                          ? "0 0 25px rgba(0,255,65,0.3)"
                          : `0 0 25px ${campeonato.themeColor || '#FFB700'}4D`
                      }}
                    >
                      {editFormData.action === "finish"
                        ? "Confirmar Resultado"
                        : jogoStatusAtStart === "proposto"
                          ? "Enviar Contra-Proposta"
                          : "Enviar Proposta de Horário"}
                    </button>
                  )}

                  {isAdmin && editingMatchIndex !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        const jogo = campeonato.cronograma[editingMatchIndex!];
                        if (jogo) {
                          onDelete(jogo);
                          onClose();
                        }
                      }}
                      className="w-full py-2.5 mt-1 font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-1.5 border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Excluir Jogo</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
