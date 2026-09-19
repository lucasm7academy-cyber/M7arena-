import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";
import { sameTeamRef } from "../../features/campeonatos/domain/team-ref";
import { getIcon } from "./icons";
import { formatDayOfWeek, formatFullDate, isMatchToday } from "./dates";
import { CUT_BADGE, CUT_BADGE_INNER } from "./cut-edge";

export const TodosJogosPendentes = () => {
  const { campeonato, isAdmin, allPendingMatches, isAllPendingOpen, setIsAllPendingOpen, setEditingMatchIndex, setJogoStatusAtStart, setEditFormData, setIsScheduleEditModalOpen } = useCampeonato();
  if (!isAdmin || allPendingMatches.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full rounded-2xl border border-white/10 bg-[#08080a] shadow-2xl p-4 sm:p-6 transition-all"
    >
      <div
        className="flex items-center justify-between mb-4 cursor-pointer select-none"
        onClick={() => setIsAllPendingOpen(!isAllPendingOpen)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-white/60" />
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
        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest px-2.5 py-1 bg-white/5 border border-white/10 rounded-md">
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
                const allTeamsPend = campeonato.timesInscritos || campeonato.classificacao || [];
                const teamAData = allTeamsPend.find(
                  (t: any) => sameTeamRef(t.tag, teamATag) || sameTeamRef(t.nome, teamATag) || sameTeamRef(t.name, teamATag)
                ) || { name: teamATag, tag: teamATag, cor: (jogo as any).corA || "#FFB700", icone: "ShieldCheck" };
                const teamBData = allTeamsPend.find(
                  (t: any) => sameTeamRef(t.tag, teamBTag) || sameTeamRef(t.nome, teamBTag) || sameTeamRef(t.name, teamBTag)
                ) || { name: teamBTag, tag: teamBTag, cor: (jogo as any).corB || "#FFB700", icone: "ShieldCheck" };

                const IconA = getIcon(teamAData.icone || "ShieldCheck");
                const IconB = getIcon(teamBData.icone || "ShieldCheck");
                const corA = teamAData.cor || (jogo as any).corA || "#FFB700";
                const corB = teamBData.cor || (jogo as any).corB || "#FFB700";
                const primaryColor = campeonato.themeColor || (campeonato as any).theme_color || "#FFB700";

                const isProposto = jogo.status === "proposto";
                const isConfirmado = jogo.status === "confirmado";
                const isToday = isMatchToday(jogo.data);

                const statusLabel = isProposto
                  ? "PROPOSTA ENVIADA"
                  : isConfirmado
                    ? (isToday ? "HOJE" : "CONFIRMADO")
                    : jogo.status === "combinando"
                      ? "A COMBINAR"
                      : (jogo.status || "PENDENTE").toUpperCase();

                const statusColor = isProposto
                  ? primaryColor
                  : (isConfirmado && isToday)
                    ? "#00FF41"
                    : primaryColor;

                const handleOpenArbitrate = () => {
                  const realIdx = campeonato.cronograma.findIndex((c: any) => c === jogo);
                  setEditingMatchIndex(realIdx);
                  setJogoStatusAtStart(jogo.status);
                  setEditFormData({
                    data:
                      jogo.data && jogo.data !== "A COMBINAR"
                        ? jogo.data
                        : new Date().toISOString().split("T")[0],
                    hora: jogo.hora && jogo.hora !== "--:--" ? jogo.hora : "",
                    action: "arbitrate",
                    placar: "",
                  });
                  setIsScheduleEditModalOpen(true);
                };

                return (
                  <div
                    key={i}
                    onClick={handleOpenArbitrate}
                    className="w-full rounded-xl border bg-[#09090d] flex flex-col overflow-hidden transition-all shadow-lg cursor-pointer hover:bg-[#0c0c14] hover:border-white/20"
                    style={{
                      borderColor: isProposto
                        ? `${primaryColor}50`
                        : (isConfirmado && isToday)
                          ? "rgba(0, 255, 65, 0.4)"
                          : isConfirmado
                            ? `${primaryColor}40`
                            : "rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    {/* TOPO: STATUS E DATA/HORA RESPONSIVOS */}
                    <div
                      className="w-full flex flex-wrap items-center justify-between gap-1.5 sm:gap-3 px-3 sm:px-6 py-2 sm:py-2.5 border-b border-white/10 select-none"
                      style={{
                        background: `linear-gradient(90deg, ${statusColor}22 0%, rgba(15,15,22,0.95) 50%, rgba(10,10,15,0.6) 100%)`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-lg sm:text-2xl md:text-3xl uppercase tracking-wider leading-none flex items-center gap-2"
                          style={{
                            fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                            color: statusColor,
                            textShadow: `0 0 25px ${statusColor}66`,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs md:text-sm font-bold tracking-wider text-white/70">
                        {jogo.data && jogo.data !== "A COMBINAR" && (
                          <div className="flex items-center gap-1">
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
                            className="font-bold pl-1.5 sm:pl-2 border-l border-white/15"
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

                    {/* CORPO DO CARD: TIME VS TIME CENTRALIZADO NO CARD E BOTÃO NA LATERAL DIREITA NO DESKTOP / ABAIXO NO MOBILE */}
                    <div className="w-full flex flex-col md:grid md:grid-cols-[160px_1fr_160px] items-center gap-3 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4">
                      {/* Espaçador esquerdo invisível para manter o confronto centralizado no desktop */}
                      <div className="hidden md:block w-[160px]" />

                      {/* Matchup Centralizado */}
                      <div className="flex items-center justify-between sm:justify-center gap-1.5 sm:gap-4 md:gap-6 w-full min-w-0">
                        {/* Left Team */}
                        <div className="flex items-center gap-1.5 sm:gap-3 flex-1 justify-end min-w-0">
                          <div className="flex flex-col items-end text-right min-w-0">
                            <span className="text-xs sm:text-sm md:text-base font-black text-white uppercase truncate tracking-tight">
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
                                  className="text-[8px] sm:text-[9px] md:text-[10px] font-black px-1 sm:px-1.5 py-0.5 tracking-wider bg-[#0c0c10]"
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
                            className="w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-black shadow-lg"
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
                                className="w-4 h-4 sm:w-6 sm:h-6"
                                style={{ color: corA }}
                              />
                            )}
                          </div>
                        </div>

                        {/* VS Box */}
                        <div className="shrink-0 flex flex-col items-center justify-center px-2.5 sm:px-4 md:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-black/60 border border-white/10 shadow-inner min-w-[50px] sm:min-w-[65px] md:min-w-[80px]">
                          <span className="text-base sm:text-2xl md:text-3xl font-black tracking-widest text-white/30 font-mono select-none leading-none">
                            VS
                          </span>
                        </div>

                        {/* Right Team */}
                        <div className="flex items-center gap-1.5 sm:gap-3 flex-1 justify-start min-w-0">
                          <div
                            className="w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-black shadow-lg"
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
                                className="w-4 h-4 sm:w-6 sm:h-6"
                                style={{ color: corB }}
                              />
                            )}
                          </div>

                          <div className="flex flex-col items-start text-left min-w-0">
                            <span className="text-xs sm:text-sm md:text-base font-black text-white uppercase truncate tracking-tight">
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
                                  className="text-[8px] sm:text-[9px] md:text-[10px] font-black px-1 sm:px-1.5 py-0.5 tracking-wider bg-[#0c0c10]"
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

                      {/* LATERAL DIREITA: BOTÃO DE ARBITRAR */}
                      <div className="w-full md:w-[160px] shrink-0 flex flex-col justify-center items-stretch md:border-l md:border-white/10 md:pl-4 pt-2.5 md:pt-0 border-t border-white/5 md:border-t-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenArbitrate();
                          }}
                          className="w-full px-4 py-2.5 sm:py-3 rounded-xl font-black uppercase tracking-wider text-xs sm:text-[11px] transition-all shadow-xl flex items-center justify-center gap-2 text-black hover:scale-105 active:scale-95 cursor-pointer border border-black/10"
                          style={{
                            backgroundColor: primaryColor,
                            boxShadow: `0 4px 20px ${primaryColor}40`,
                          }}
                        >
                          <ShieldCheck className="w-4 h-4 text-black" />
                          <span>Arbitrar</span>
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
    </motion.div>
  );
};
