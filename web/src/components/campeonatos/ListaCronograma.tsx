import { motion } from "motion/react";
import { Calendar, CheckCircle2, ShieldCheck } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BADGE, CUT_BADGE_INNER, CUT_BUTTON, CUT_BUTTON_INNER } from "./cut-edge";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";
import { getIcon } from "./icons";
import { formatDayOfWeek, formatFullDate } from "./dates";

export const ListaCronograma = () => {
  const { campeonato, isAdmin, filteredCronograma, getMyTeamInMatch, setEditingMatchIndex, setJogoStatusAtStart, setEditFormData, setIsScheduleEditModalOpen } = useCampeonato();
  return (
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
  );
};