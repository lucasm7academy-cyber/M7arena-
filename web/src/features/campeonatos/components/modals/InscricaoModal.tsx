import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { X, Trophy, Users, ShieldCheck, Plus, MessageCircle, Phone } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BUTTON, CUT_BUTTON_INNER, CUT_BADGE, CUT_BADGE_INNER } from "../../../../components/campeonatos/cut-edge";

export const InscricaoModal = ({ isOpen, onClose, campeonato, user, myTeams, registrationData, setRegistrationData, onSubmit }: any) => {
  const navigate = useNavigate();

  return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="relative p-[1.5px] w-full max-w-lg shadow-2xl"
              style={{
                clipPath: CUT_FRAME,
                background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, ${campeonato.themeColor || '#FFB700'}40 50%, rgba(255,255,255,0.08) 100%)`,
                boxShadow: `0 0 50px -10px ${campeonato.themeColor || '#FFB700'}33`
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-5 sm:p-8 space-y-6 sm:space-y-8"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`,
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Trophy
                          className="w-6 h-6"
                          style={{ color: campeonato.themeColor }}
                        />
                      </div>
                    </div>
                    <div>
                      <h2
                        className="text-xl font-black uppercase tracking-widest"
                        style={{ color: campeonato.themeColor }}
                      >
                        Inscrição de Time
                      </h2>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        Garanta sua vaga na arena
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onClose()}
                    className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 cursor-pointer"
                    style={{ clipPath: CUT_BADGE }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {!user ? (
                  <div className="text-center py-6 space-y-6">
                    <div
                      className="w-16 h-16 p-[1px] mx-auto flex items-center justify-center text-[#FFB700]"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #FFB700, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Users className="w-8 h-8" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase text-white tracking-tight">Login Necessário</h3>
                      <p className="text-xs text-white/50 mt-2 max-w-sm mx-auto leading-relaxed">
                        Você precisa estar conectado à sua conta para inscrever um time no campeonato.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        onClick={() => {
                          onClose();
                          navigate("/login");
                        }}
                        className="flex-1 py-4 px-4 bg-[#FFB700] hover:bg-[#E6A600] text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        Fazer Login
                      </button>
                    </div>
                  </div>
                ) : myTeams.length === 0 ? (
                  <div className="text-center py-6 space-y-6">
                    <div
                      className="w-16 h-16 p-[1px] mx-auto flex items-center justify-center text-[#00F0FF]"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #00F0FF, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <ShieldCheck className="w-8 h-8" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase text-white tracking-tight">Nenhuma Equipe Encontrada</h3>
                      <p className="text-xs text-white/50 mt-2 max-w-sm mx-auto leading-relaxed">
                        Você ainda não tem uma equipe cadastrada. Crie a sua agora e entre na disputa — leva menos de um minuto.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        navigate("/times?criar=true", { state: { openCreateModal: true } });
                      }}
                      className="w-full py-4 px-6 bg-[#00F0FF] hover:bg-[#00D8E6] text-black font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Criar Equipe Agora</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={onSubmit} className="space-y-6">
                    {/* Seleção de Time */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                          Selecione sua Equipe
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {myTeams.map((team) => (
                          <div
                            key={team.id}
                            onClick={() =>
                              setRegistrationData({
                                ...registrationData,
                                teamId: team.id,
                              })
                            }
                            className="relative p-[1px] transition-all cursor-pointer"
                            style={{
                              clipPath: CUT_BUTTON,
                              background: registrationData.teamId === team.id
                                ? `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                                : 'rgba(255, 255, 255, 0.08)'
                            }}
                          >
                            <div
                              className={`w-full p-3.5 flex items-center justify-between transition-colors ${
                                registrationData.teamId === team.id ? 'bg-[#0e0e14]' : 'bg-[#08080a] hover:bg-[#0c0c10]'
                              }`}
                              style={{ clipPath: CUT_BUTTON_INNER }}
                            >
                              <div className="flex items-center gap-3.5">
                                <div
                                  className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0 overflow-hidden"
                                  style={{
                                    clipPath: CUT_BADGE,
                                    background: 'rgba(255,255,255,0.1)'
                                  }}
                                >
                                  <div
                                    className="w-full h-full bg-black flex items-center justify-center overflow-hidden"
                                    style={{ clipPath: CUT_BADGE_INNER }}
                                  >
                                    {team.logo ? (
                                      <img
                                        src={team.logo} loading="lazy"
                                        alt="Logo"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <ShieldCheck className="w-5 h-5 text-white/20" />
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <h4
                                    className={`text-sm font-black uppercase tracking-tight ${registrationData.teamId === team.id ? "text-white" : "text-white/60"}`}
                                  >
                                    {team.nome}
                                  </h4>
                                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                                    #{team.tag}
                                  </p>
                                </div>
                              </div>
                              <div
                                className="w-5 h-5 flex items-center justify-center"
                                style={{
                                  clipPath: CUT_BADGE,
                                  backgroundColor: registrationData.teamId === team.id
                                    ? (campeonato.themeColor || '#FFB700')
                                    : 'rgba(255,255,255,0.05)'
                                }}
                              >
                                {registrationData.teamId === team.id && (
                                  <ShieldCheck className="w-3 h-3 text-black font-black" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contatos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                          Discord do Capitão
                        </label>
                        <div
                          className="relative p-[1px]"
                          style={{
                            clipPath: CUT_BUTTON,
                            background: 'rgba(255, 255, 255, 0.1)'
                          }}
                        >
                          <div
                            className="relative flex items-center bg-[#0c0c10]"
                            style={{ clipPath: CUT_BUTTON_INNER }}
                          >
                            <MessageCircle className="absolute left-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                            <input
                              required
                              type="text"
                              placeholder="Ex: nick#1234"
                              value={registrationData.discord}
                              onChange={(e) =>
                                setRegistrationData({
                                  ...registrationData,
                                  discord: e.target.value,
                                })
                              }
                              className="w-full bg-transparent pl-10 pr-3 py-3 text-white text-xs font-bold focus:outline-none placeholder:text-white/20"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                          WhatsApp
                        </label>
                        <div
                          className="relative p-[1px]"
                          style={{
                            clipPath: CUT_BUTTON,
                            background: 'rgba(255, 255, 255, 0.1)'
                          }}
                        >
                          <div
                            className="relative flex items-center bg-[#0c0c10]"
                            style={{ clipPath: CUT_BUTTON_INNER }}
                          >
                            <Phone className="absolute left-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                            <input
                              required
                              type="text"
                              placeholder="Ex: (11) 99999-9999"
                              value={registrationData.whatsapp}
                              onChange={(e) =>
                                setRegistrationData({
                                  ...registrationData,
                                  whatsapp: e.target.value,
                                })
                              }
                              className="w-full bg-transparent pl-10 pr-3 py-3 text-white text-xs font-bold focus:outline-none placeholder:text-white/20"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 text-black font-black flex items-center justify-center gap-3 transition-all text-xs uppercase tracking-widest shadow-xl mt-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        clipPath: CUT_BUTTON,
                        backgroundColor: campeonato.themeColor || '#FFB700',
                        boxShadow: `0 0 30px -5px ${campeonato.themeColor || '#FFB700'}66`,
                      }}
                    >
                      <Trophy className="w-4 h-4" />
                      <span>CONFIRMAR INSCRIÇÃO</span>
                    </button>
                    <p className="text-[9px] text-center text-white/30 font-bold uppercase tracking-widest px-4 leading-relaxed">
                      Ao confirmar, sua equipe será pré-inscrita e aguardará a
                      aprovação manual dos administradores da M7 ARENA.
                    </p>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
  );
};
