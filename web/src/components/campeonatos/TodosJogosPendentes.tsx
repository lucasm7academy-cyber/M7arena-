import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ShieldCheck, X } from "lucide-react";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";
import { sameTeamRef } from "../../features/campeonatos/domain/team-ref";
import { getIcon } from "./icons";
import { formatDayOfWeek, formatFullDate } from "./dates";
import { CUT_BADGE, CUT_BADGE_INNER } from "./cut-edge";

export const TodosJogosPendentes = () => {
  const { campeonato, isAdmin, allPendingMatches, isAllPendingOpen, setIsAllPendingOpen, setEditingMatchIndex, setJogoStatusAtStart, setEditFormData, setIsScheduleEditModalOpen, handleDeleteMatch } = useCampeonato();
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
                const primaryColor = campeonato.themeColor || "#FFB700";

                const isProposto = jogo.status === "proposto";
                const isConfirmado = jogo.status === "confirmado";

                const statusLabel = isProposto
                  ? "PROPOSTA ENVIADA"
                  : isConfirmado
                    ? "CONFIRMADO"
                    : jogo.status === "combinando"
                      ? "A COMBINAR"
                      : (jogo.status || "PENDENTE").toUpperCase();

                const statusColor = isProposto
                  ? "#00F0FF"
                  : isConfirmado
                    ? primaryColor
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
                    className="group relative w-full rounded-xl border bg-[#09090d] flex flex-col overflow-hidden transition-all shadow-lg cursor-pointer hover:bg-[#0c0c14] hover:border-white/20"
                    style={{
                      borderColor: isProposto
                        ? "rgba(0, 240, 255, 0.3)"
                        : isConfirmado
                          ? `${primaryColor}40`
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

                    {/* CORPO DO MATCHUP (TIME A | VS | TIME B) */}
                    <div className="w-full flex items-center justify-between gap-3 sm:gap-8 px-4 sm:px-8 py-4 sm:py-5">
                      {/* Left Team */}
                      <div className="flex items-center gap-2.5 sm:gap-4 flex-1 justify-end min-w-0">
                        <div className="flex flex-col items-end text-right min-w-0">
                          <span className="text-xs sm:text-base font-black text-white uppercase truncate tracking-tight">
                            {teamAData.name || teamAData.nome}
                          </span>
                          {teamAData.tag && (
                            <div
                              className="p-[1px] shrink-0 mt-0.5 sm:mt-1"
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
                          className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-black shadow-lg"
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
                              className="w-5 h-5 sm:w-7 sm:h-7"
                              style={{ color: corA }}
                            />
                          )}
                        </div>
                      </div>

                      {/* VS Box */}
                      <div className="shrink-0 flex flex-col items-center justify-center px-3.5 sm:px-6 py-2 rounded-xl bg-black/60 border border-white/10 shadow-inner min-w-[70px] sm:min-w-[90px]">
                        <span className="text-xl sm:text-3xl lg:text-4xl font-black tracking-widest text-white/30 font-mono select-none leading-none">
                          VS
                        </span>
                      </div>

                      {/* Right Team */}
                      <div className="flex items-center gap-2.5 sm:gap-4 flex-1 justify-start min-w-0">
                        <div
                          className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-black shadow-lg"
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
                              className="w-5 h-5 sm:w-7 sm:h-7"
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
                              className="p-[1px] shrink-0 mt-0.5 sm:mt-1"
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

                    {/* RODAPÉ: BOTÕES DE AÇÃO */}
                    <div className="w-full flex items-center justify-between gap-3 px-4 py-2 sm:py-2.5 border-t border-white/10 bg-black/40">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenArbitrate();
                        }}
                        className="px-4 py-1.5 bg-white text-black font-black uppercase tracking-wider text-[10px] rounded-lg hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-black" />
                        <span>Arbitrar Jogo</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMatch(jogo);
                        }}
                        title="Excluir confronto"
                        className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>
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
