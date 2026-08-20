import { motion, AnimatePresence } from "motion/react";
import { Swords, ChevronDown, Clock, Zap, Calendar, ShieldCheck, X, CheckCircle2 } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BADGE, CUT_BADGE_INNER, CUT_BUTTON, CUT_BUTTON_INNER } from "./cut-edge";

export const Cronograma = ({ campeonato, isAdmin, myPendingMatches, allPendingMatches, filteredCronograma, getMyTeamInMatch, getIcon, formatDayOfWeek, formatFullDate, handleDeleteMatch, isPendingMatchesOpen, setIsPendingMatchesOpen, isAllPendingOpen, setIsAllPendingOpen, setEditingMatchIndex, setJogoStatusAtStart, setEditFormData, setIsScheduleEditModalOpen, setAdminMatchData, adminMatchData, setIsAdminMatchModalOpen }: any) => {
  return (
                <div className="space-y-6">
                  {/* ADMIN ACTION: CREATE GAME (Only admins create matchups, players just propose dates) */}
                  {isAdmin && (
                    <div
                      className="relative p-[1.5px] shadow-2xl transition-all group"
                      style={{
                        clipPath: CUT_FRAME,
                        background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.05) 100%)`,
                        boxShadow: `0 0 40px -10px ${campeonato.themeColor || '#FFB700'}26`
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 p-4 sm:p-6"
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
                              <Swords
                                className="w-6 h-6"
                                style={{ color: campeonato.themeColor }}
                              />
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xl font-black text-white uppercase tracking-widest leading-none">
                              Painel de Arbitragem
                            </h4>
                            <p
                              className="text-[10px] font-black uppercase tracking-[0.3em] mt-2"
                              style={{ color: campeonato.themeColor }}
                            >
                              Capitão, insira confrontos manuais no campeonato
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setAdminMatchData({
                              ...adminMatchData,
                              timeA: "",
                              timeB: "",
                            });
                            setIsAdminMatchModalOpen(true);
                          }}
                          className="px-8 py-3.5 bg-white text-black font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
                          style={{ clipPath: CUT_BUTTON }}
                        >
                          Criar Novo Jogo
                        </button>
                      </div>
                    </div>
                  )}

                  {/* MEUS JOGOS PENDENTES — somente jogos onde o time do usuário participa */}
                  {myPendingMatches.length > 0 && (
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
                  )}

                  {/* TODOS OS JOGOS PENDENTES — somente admin, botão Arbitrar */}
                  {isAdmin && allPendingMatches.length > 0 && (
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
                  )}

                  <motion.div
                    key="schedule"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="relative p-[1.5px] shadow-2xl transition-all w-full"
                    style={{
                      clipPath: CUT_FRAME,
                      background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.05) 100%)`,
                      boxShadow: `0 0 40px -10px ${campeonato.themeColor || '#FFB700'}26`
                    }}
                  >
                    <div
                      className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-4 sm:p-6 space-y-6"
                      style={{ clipPath: CUT_FRAME_INNER }}
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-6">
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
                              <Calendar className="w-6 h-6" style={{ color: campeonato.themeColor }} />
                            </div>
                          </div>
                          <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-widest leading-none">
                              Cronograma de Jogos
                            </h2>
                            <p
                              className="text-[10px] font-black uppercase tracking-[0.3em] mt-1"
                              style={{ color: campeonato.themeColor }}
                            >
                              Horário de Brasília (BRT)
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {filteredCronograma.length === 0 ? (
                          <div
                            className="py-16 text-center bg-white/[0.01] border border-dashed border-white/10"
                            style={{ clipPath: CUT_BUTTON }}
                          >
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
                              Nenhum jogo confirmado ou finalizado no momento
                            </p>
                          </div>
                        ) : (
                          filteredCronograma.map((jogo, i) => {
                            const allTeams = campeonato.timesInscritos || campeonato.classificacao || [];
                            const timeA = allTeams.find((t: any) =>
                              t.tag === jogo.timeA || t.name === jogo.timeA || t.nome === jogo.timeA
                            ) || { name: jogo.timeA, tag: jogo.timeA, cor: (jogo as any).corA || "#FFB700", icone: "ShieldCheck" };
                            const timeB = allTeams.find((t: any) =>
                              t.tag === jogo.timeB || t.name === jogo.timeB || t.nome === jogo.timeB
                            ) || { name: jogo.timeB, tag: jogo.timeB, cor: (jogo as any).corB || "#FFB700", icone: "ShieldCheck" };

                            const IconA = getIcon(timeA.icone || "ShieldCheck");
                            const IconB = getIcon(timeB.icone || "ShieldCheck");
                            const corA =
                              timeA.cor || (jogo as any).corA || "#FFB700";
                            const corB =
                              timeB.cor || (jogo as any).corB || "#FFB700";
                            const myTeam = getMyTeamInMatch(jogo);
                            const matchDateObj =
                              jogo.data && jogo.hora && jogo.hora !== "--:--"
                                ? new Date(`${jogo.data}T${jogo.hora}:00`)
                                : null;
                            const isWithin24Hours = matchDateObj
                              ? matchDateObj.getTime() - new Date().getTime() <=
                                24 * 60 * 60 * 1000
                              : false;
                            const isLockedForPlayer =
                              jogo.status === "confirmado" &&
                              !isAdmin &&
                              isWithin24Hours;
                            const canUserEdit =
                              (myTeam || isAdmin) && !isLockedForPlayer;
                            const isMyTurn =
                              jogo.status === "proposto" &&
                              jogo.proposedBy !== myTeam?.tag;

                            return (
                              <div
                                key={i}
                                onClick={() => {
                                  const canClick =
                                    canUserEdit &&
                                    (jogo.status !== "finalizado" || isAdmin);
                                  if (canClick) {
                                    const realIdx =
                                      campeonato.cronograma.findIndex(
                                        (c: any) => c === jogo,
                                      );
                                    setEditingMatchIndex(realIdx);
                                    setJogoStatusAtStart(jogo.status);
                                    if (isAdmin && jogo.status === "finalizado") {
                                      setEditFormData({
                                        data: jogo.data,
                                        hora: jogo.hora,
                                        action: "finish",
                                        placar: jogo.placar || "0 - 0",
                                      });
                                    } else if (isAdmin && jogo.status === "confirmado") {
                                      setEditFormData({
                                        data: jogo.data,
                                        hora: jogo.hora,
                                        action: "finish",
                                        placar: "0 - 0",
                                      });
                                    } else if (
                                      jogo.status === "proposto" &&
                                      isMyTurn
                                    ) {
                                      setEditFormData({
                                        data: jogo.data,
                                        hora: jogo.hora,
                                        action: "accept",
                                        placar: "",
                                      });
                                    } else {
                                      setEditFormData({
                                        data: jogo.data,
                                        hora: jogo.hora,
                                        action: "propose",
                                        placar: "",
                                      });
                                    }
                                    setIsScheduleEditModalOpen(true);
                                  }
                                }}
                                className="relative p-[1px] transition-all hover:scale-[1.003]"
                                style={{
                                  clipPath: CUT_BUTTON,
                                  background: jogo.status === "confirmado"
                                    ? `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.05))`
                                    : 'rgba(255, 255, 255, 0.08)',
                                  boxShadow: jogo.status === "confirmado"
                                    ? `0 0 30px -5px ${campeonato.themeColor || '#FFB700'}22`
                                    : undefined
                                }}
                              >
                                <div
                                  className={`w-full p-3.5 lg:p-4 bg-[#0c0c10] flex flex-col lg:flex-row items-center justify-between gap-4 ${
                                    isAdmin && jogo.status === "finalizado" ? "cursor-pointer hover:bg-[#101018]" : canUserEdit && jogo.status !== "finalizado" ? "cursor-pointer hover:bg-[#101018]" : ""
                                  }`}
                                  style={{ clipPath: CUT_BUTTON_INNER }}
                                >
                                  {/* Left: Info (Date) */}
                                  <div className="flex flex-col items-center justify-center shrink-0 min-w-[120px]">
                                    {jogo.status !== "finalizado" && (
                                      <div className="text-center flex flex-col items-center gap-0.5">
                                        {jogo.data &&
                                          jogo.data !== "A COMBINAR" && (
                                            <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">
                                              {formatDayOfWeek(jogo.data)}
                                            </p>
                                          )}
                                        <p className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                                          {formatFullDate(jogo.data) ||
                                            "A definir"}
                                        </p>
                                        {/* Hora no Mobile */}
                                        {jogo.hora && jogo.hora !== "--:--" && (
                                          <p 
                                            className="text-xs sm:text-sm font-black tracking-wider lg:hidden mt-0.5"
                                            style={{ color: campeonato.themeColor }}
                                          >
                                            {/^\d{2}:\d{2}/.test(jogo.hora) ? jogo.hora.substring(0, 5) : "--:--"}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Center: Matchup */}
                                  <div className="flex items-center justify-center gap-3 lg:gap-6 relative flex-1 w-full px-2">
                                    {/* Team A */}
                                    <div className="w-16 sm:w-20 lg:w-24 flex flex-col items-center gap-1.5 min-w-0 shrink-0">
                                      <div
                                        className="w-10 h-10 lg:w-12 lg:h-12 p-[1px] flex items-center justify-center shrink-0 shadow-xl"
                                        style={{
                                          clipPath: CUT_BADGE,
                                          background: `${corA}80`,
                                        }}
                                      >
                                        <div
                                          className="w-full h-full bg-black flex items-center justify-center overflow-hidden"
                                          style={{ clipPath: CUT_BADGE_INNER }}
                                        >
                                          {timeA.logo ? (
                                            <img
                                              src={timeA.logo} loading="lazy"
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <IconA
                                              className="w-6 h-6"
                                              style={{ color: corA }}
                                            />
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-center w-full">
                                        <p className="text-xs sm:text-sm font-black text-white uppercase truncate tracking-tight">
                                          {timeA.tag
                                            ? `#${timeA.tag}`
                                            : timeA.name || timeA.nome}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Score Indicator */}
                                    <div className="shrink-0 z-20 flex flex-col items-center justify-center min-w-[70px]">
                                      {jogo.status === "finalizado" ? (
                                        <div className="flex flex-col items-center">
                                          <div className="flex items-center gap-2.5">
                                            {(() => {
                                              const scores = (
                                                jogo as any
                                              ).placar.split(" - ");
                                              const scoreA = parseInt(scores[0]);
                                              const scoreB = parseInt(scores[1]);
                                              return (
                                                <>
                                                  <span
                                                    className="text-2xl lg:text-3xl font-black tabular-nums"
                                                    style={{
                                                      color:
                                                        scoreA > scoreB
                                                          ? "#00FF41"
                                                          : scoreA < scoreB
                                                            ? "#FF3131"
                                                            : "#FFFFFF",
                                                    }}
                                                  >
                                                    {scoreA}
                                                  </span>
                                                  <span className="text-white/20 text-xl font-black">
                                                    -
                                                  </span>
                                                  <span
                                                    className="text-2xl lg:text-3xl font-black tabular-nums"
                                                    style={{
                                                      color:
                                                        scoreB > scoreA
                                                          ? "#00FF41"
                                                          : scoreB < scoreA
                                                            ? "#FF3131"
                                                            : "#FFFFFF",
                                                    }}
                                                  >
                                                    {scoreB}
                                                  </span>
                                                </>
                                              );
                                            })()}
                                          </div>
                                          <span
                                            className="text-[9px] font-black uppercase text-white/50 tracking-widest mt-1.5 px-2 py-0.5 bg-white/5"
                                            style={{ clipPath: CUT_BADGE }}
                                          >
                                            Finalizado
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-xs font-black tracking-widest select-none text-white/30">
                                          VS
                                        </span>
                                      )}
                                    </div>

                                    {/* Team B */}
                                    <div className="w-16 sm:w-20 lg:w-24 flex flex-col items-center gap-1.5 min-w-0 shrink-0">
                                      <div
                                        className="w-10 h-10 lg:w-12 lg:h-12 p-[1px] flex items-center justify-center shrink-0 shadow-xl"
                                        style={{
                                          clipPath: CUT_BADGE,
                                          background: `${corB}80`,
                                        }}
                                      >
                                        <div
                                          className="w-full h-full bg-black flex items-center justify-center overflow-hidden"
                                          style={{ clipPath: CUT_BADGE_INNER }}
                                        >
                                          {timeB.logo ? (
                                            <img
                                              src={timeB.logo} loading="lazy"
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <IconB
                                              className="w-6 h-6"
                                              style={{ color: corB }}
                                            />
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-center w-full">
                                        <p className="text-xs sm:text-sm font-black text-white uppercase truncate tracking-tight">
                                          {timeB.tag
                                            ? `#${timeB.tag}`
                                            : timeB.name || timeB.nome}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: Info & Actions */}
                                  <div className="flex flex-col items-center justify-center lg:justify-end gap-2 shrink-0 min-w-[120px]">
                                    {jogo.status !== "finalizado" && (
                                      <div className="text-center flex flex-col items-center hidden lg:block">
                                        <p
                                          className="text-xl sm:text-2xl font-black tracking-tighter tabular-nums"
                                          style={{
                                            color: campeonato.themeColor,
                                          }}
                                        >
                                          {jogo.hora && jogo.hora !== "--:--" && /^\d{2}:\d{2}/.test(jogo.hora) ? jogo.hora.substring(0, 5) : "--:--"}
                                        </p>
                                      </div>
                                    )}

                                    {canUserEdit &&
                                    jogo.status !== "finalizado" &&
                                    !(
                                      jogo.status === "confirmado" && !isAdmin
                                    ) ? (
                                      <div
                                        className="text-[9px] font-black uppercase text-white/70 tracking-widest flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10"
                                        style={{ clipPath: CUT_BADGE }}
                                      >
                                        {jogo.status === "proposto" && isMyTurn ? (
                                          <>
                                            <CheckCircle2 className="w-3 h-3 text-[#00FF41]" />
                                            <span>Responder</span>
                                          </>
                                        ) : jogo.status === "confirmado" && isAdmin ? (
                                          <>
                                            <ShieldCheck className="w-3 h-3 text-[#00F0FF]" />
                                            <span>Finalizar</span>
                                          </>
                                        ) : jogo.status === "confirmado" ? (
                                          null
                                        ) : (
                                          <>
                                            <Calendar className="w-3 h-3 text-[#FFB700]" />
                                            <span>Agendar</span>
                                          </>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
  );
};
