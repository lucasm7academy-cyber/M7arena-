import { motion, AnimatePresence } from "motion/react";
import { Swords, ChevronDown, Clock, Zap, Calendar } from "lucide-react";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";
import { sameTeamRef } from "../../features/campeonatos/domain/team-ref";
import { getIcon } from "./icons";
import { formatDayOfWeek, formatFullDate } from "./dates";
import { CUT_BADGE, CUT_BADGE_INNER } from "./cut-edge";

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

                const IconA = getIcon(teamAData.icone || "ShieldCheck");
                const IconB = getIcon(teamBData.icone || "ShieldCheck");
                const corA = teamAData.cor || (jogo as any).corA || "#FFB700";
                const corB = teamBData.cor || (jogo as any).corB || "#FFB700";
                const primaryColor = campeonato.themeColor || "#FFB700";

                const statusLabel = isWaitingForMyResponse
                  ? "PROPOSTA RECEBIDA"
                  : amITheProposer
                    ? "PROPOSTA ENVIADA"
                    : jogo.status === "confirmado"
                      ? "AGENDADA"
                      : "A AGENDAR";

                const statusColor = isWaitingForMyResponse
                  ? "#00FF41"
                  : amITheProposer
                    ? "#00F0FF"
                    : primaryColor;

                const canClickCard = !amITheProposer;

                const handleOpenModal = () => {
                  if (amITheProposer) return;
                  const realIdx = campeonato.cronograma.findIndex((c: any) => c === jogo);
                  setEditingMatchIndex(realIdx);
                  setJogoStatusAtStart(jogo.status);
                  setEditFormData({
                    data:
                      jogo.data && jogo.data !== "A COMBINAR"
                        ? jogo.data
                        : new Date().toISOString().split("T")[0],
                    hora:
                      jogo.hora && jogo.hora !== "--:--"
                        ? jogo.hora
                        : "",
                    action:
                      jogo.status === "proposto"
                        ? "accept"
                        : "propose",
                    placar: "",
                  });
                  setIsScheduleEditModalOpen(true);
                };

                return (
                  <div
                    key={i}
                    onClick={handleOpenModal}
                    className={`group relative w-full rounded-xl border bg-[#09090d] flex flex-col overflow-hidden transition-all shadow-lg ${
                      canClickCard ? "cursor-pointer hover:bg-[#0c0c14] hover:border-white/20" : ""
                    }`}
                    style={{
                      borderColor: isWaitingForMyResponse
                        ? "rgba(0, 255, 65, 0.4)"
                        : amITheProposer
                          ? "rgba(0, 240, 255, 0.3)"
                          : "rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    {/* TOPO: LARGURA INTEIRA COM ANTON E DATA/HORA */}
                    <div
                      className="w-full flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b border-white/10 select-none"
                      style={{
                        background: `linear-gradient(90deg, ${statusColor}22 0%, rgba(15,15,22,0.95) 50%, rgba(10,10,15,0.6) 100%)`,
                      }}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <span
                          className="text-2xl sm:text-3xl md:text-4xl uppercase tracking-wider leading-none flex items-center gap-2"
                          style={{
                            fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                            color: statusColor,
                            textShadow: `0 0 25px ${statusColor}66`,
                          }}
                        >
                          {statusLabel}
                        </span>

                        {jogo.best_of && (
                          <span
                            className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border"
                            style={{
                              color: statusColor,
                              backgroundColor: `${statusColor}15`,
                              borderColor: `${statusColor}30`,
                            }}
                          >
                            MD{jogo.best_of}
                          </span>
                        )}

                        {jogo.fase && (
                          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/50">
                            {jogo.fase}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-black tracking-wider text-white/70">
                        {jogo.data && jogo.data !== "A COMBINAR" && (
                          <div className="flex items-center gap-1.5">
                            <span className="hidden sm:inline-block text-white/40 uppercase text-[10px] tracking-[0.15em]">
                              {formatDayOfWeek(jogo.data)} •
                            </span>
                            <span className="text-white font-bold">
                              {formatFullDate(jogo.data)}
                            </span>
                          </div>
                        )}
                        {jogo.hora && jogo.hora !== "--:--" && (
                          <span
                            className="font-bold pl-2 border-l border-white/15"
                            style={{ color: statusColor }}
                          >
                            {/^\d{2}:\d{2}/.test(jogo.hora) ? jogo.hora.substring(0, 5) : jogo.hora}
                          </span>
                        )}
                        {(!jogo.data || jogo.data === "A COMBINAR") && (
                          <span className="text-white/40 uppercase text-[10px] tracking-[0.15em]">
                            A Definir
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CORPO DO CARD: MATCHUP NA ESQUERDA/CENTRO E BOTÕES NA LATERAL DIREITA */}
                    <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 px-4 sm:px-6 py-4">
                      {/* Matchup */}
                      <div className="flex-1 flex items-center justify-center gap-3 sm:gap-6 w-full min-w-0">
                        {/* Left Team */}
                        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 justify-end min-w-0">
                          <div className="flex flex-col items-end text-right min-w-0">
                            <span className="text-xs sm:text-base font-black text-white uppercase truncate tracking-tight">
                              {teamAData.name || teamAData.nome}
                            </span>
                            {teamAData.tag && (
                              <div
                                className="p-[1px] shrink-0 mt-0.5"
                                style={{
                                  clipPath: CUT_BADGE,
                                  background: `${corA}80`,
                                }}
                              >
                                <div
                                  className="text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 tracking-wider bg-[#0c0c10]"
                                  style={{
                                    clipPath: CUT_BADGE_INNER,
                                    color: corA,
                                  }}
                                >
                                  #{teamAData.tag}
                                </div>
                              </div>
                            )}
                          </div>

                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-black shadow-lg"
                            style={{ borderColor: `${corA}80` }}
                          >
                            {teamAData.logo ? (
                              <img
                                src={teamAData.logo}
                                alt={teamAData.tag}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <IconA
                                className="w-5 h-5 sm:w-6 sm:h-6"
                                style={{ color: corA }}
                              />
                            )}
                          </div>
                        </div>

                        {/* VS Box */}
                        <div className="shrink-0 flex items-center justify-center px-3 sm:px-4 py-1.5 rounded-xl bg-black/60 border border-white/10 shadow-inner">
                          <span className="text-base sm:text-xl font-black tracking-widest text-white/30 font-mono select-none leading-none">
                            VS
                          </span>
                        </div>

                        {/* Right Team */}
                        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 justify-start min-w-0">
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-black shadow-lg"
                            style={{ borderColor: `${corB}80` }}
                          >
                            {teamBData.logo ? (
                              <img
                                src={teamBData.logo}
                                alt={teamBData.tag}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <IconB
                                className="w-5 h-5 sm:w-6 sm:h-6"
                                style={{ color: corB }}
                              />
                            )}
                          </div>

                          <div className="flex flex-col items-start text-left min-w-0">
                            <span className="text-xs sm:text-base font-black text-white uppercase truncate tracking-tight">
                              {teamBData.name || teamBData.nome}
                            </span>
                            {teamBData.tag && (
                              <div
                                className="p-[1px] shrink-0 mt-0.5"
                                style={{
                                  clipPath: CUT_BADGE,
                                  background: `${corB}80`,
                                }}
                              >
                                <div
                                  className="text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 tracking-wider bg-[#0c0c10]"
                                  style={{
                                    clipPath: CUT_BADGE_INNER,
                                    color: corB,
                                  }}
                                >
                                  #{teamBData.tag}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* LATERAL DIREITA: BOTÕES DE AÇÃO */}
                      <div className="w-full md:w-[180px] shrink-0 flex flex-col gap-1.5 md:border-l md:border-white/10 md:pl-4">
                        {amITheProposer ? (
                          <>
                            <div className="w-full py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-white/40 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Aguardando</span>
                            </div>
                            <p className="text-[8px] font-black text-white/20 uppercase text-center tracking-widest">
                              Aguardando resposta
                            </p>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal();
                            }}
                            className="w-full px-4 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl flex items-center justify-center gap-2 text-black hover:scale-105 active:scale-95 cursor-pointer"
                            style={{
                              backgroundColor: isWaitingForMyResponse ? "#00FF41" : primaryColor,
                              boxShadow: isWaitingForMyResponse
                                ? "0 4px 20px rgba(0, 255, 65, 0.35)"
                                : `0 4px 20px ${primaryColor}40`,
                            }}
                          >
                            {isWaitingForMyResponse ? (
                              <>
                                <Zap className="w-3.5 h-3.5" />
                                <span>Responder</span>
                              </>
                            ) : (
                              <>
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Propor Data</span>
                              </>
                            )}
                          </button>
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
    </motion.div>
  );
};
