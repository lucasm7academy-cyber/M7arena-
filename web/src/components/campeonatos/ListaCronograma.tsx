import { useState } from "react";
import { motion } from "motion/react";
import {
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Swords,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";
import { api } from "../../lib/api";
import { getIcon } from "./icons";
import { formatDayOfWeek, formatFullDate } from "./dates";
import { CUT_BADGE, CUT_BADGE_INNER } from "./cut-edge";

function parseMatchDateTime(dateStr?: string | null, timeStr?: string | null): Date | null {
  if (!dateStr || dateStr === "A COMBINAR" || dateStr === "A definir") return null;
  const time = (timeStr && timeStr !== "--:--" && /^\d{2}:\d{2}/.test(timeStr)) ? timeStr.substring(0, 5) : "00:00";

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(`${dateStr}T${time}:00`);
    if (!isNaN(d.getTime())) return d;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split("/").map(Number);
    const d = new Date(`${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}T${time}:00`);
    if (!isNaN(d.getTime())) return d;
  }
  try {
    const d = new Date(dateStr + (time ? ` ${time}` : ""));
    if (!isNaN(d.getTime())) return d;
  } catch {}
  return null;
}

export const ListaCronograma = () => {
  const {
    campeonato,
    isAdmin,
    filteredCronograma,
    getMyTeamInMatch,
    setEditingMatchIndex,
    setJogoStatusAtStart,
    setEditFormData,
    setIsScheduleEditModalOpen,
    refetchCampeonato,
  } = useCampeonato();

  const [startingMatchId, setStartingMatchId] = useState<string | null>(null);
  const [verifyingMatchId, setVerifyingMatchId] = useState<string | null>(null);
  const [copiedMatchId, setCopiedMatchId] = useState<string | null>(null);

  const handleStartSeries = async (jogo: any) => {
    const matchId = jogo.match_id || jogo.id;
    if (!matchId) return;
    setStartingMatchId(matchId);
    try {
      await api.tournaments.gerarCodigo(campeonato.id, matchId);
      toast.success("Série iniciada! Código Riot gerado com sucesso.");
      await refetchCampeonato();
    } catch (err: any) {
      console.error("Erro ao iniciar série:", err);
      toast.error(err?.message || "Não foi possível iniciar a série.");
    } finally {
      setStartingMatchId(null);
    }
  };

  const handleCopyCode = async (code: string, matchId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedMatchId(matchId);
      toast.success("Código Riot copiado! Cole no LoL em Jogar > Torneios > Código de Torneio.");
      setTimeout(() => {
        setCopiedMatchId((prev) => (prev === matchId ? null : prev));
      }, 2500);
    } catch {
      toast.error("Erro ao copiar código para a área de transferência.");
    }
  };

  const handleVerifySeries = async (jogo: any) => {
    const matchId = jogo.match_id || jogo.id;
    if (!matchId) return;
    setVerifyingMatchId(matchId);
    try {
      const res = await api.tournaments.verificarSerie(campeonato.id, matchId);
      if (res.motivo === "riot_indisponivel") {
        toast.error("Não foi possível consultar a Riot agora. Tente de novo em instantes.");
      } else if (res.estado === "finalizada") {
        toast.success(`Série finalizada! Placar: ${res.scoreA} - ${res.scoreB}`);
      } else if (res.estado === "em_andamento") {
        toast(`Série em andamento: ${res.scoreA} - ${res.scoreB}`, { icon: "⚔️" });
      } else if (res.motivo === "sem_codigo") {
        toast.error("Série ainda não possui código de torneio.");
      } else {
        toast("Nenhuma partida nova detectada na Riot ainda.", { icon: "ℹ️" });
      }
      await refetchCampeonato();
    } catch (err: any) {
      console.error("Erro ao verificar série:", err);
      toast.error(err?.message || "Erro ao verificar série na Riot.");
    } finally {
      setVerifyingMatchId(null);
    }
  };
  return (
    <motion.div
      key="schedule"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full rounded-xl border border-white/10 bg-[#08080a] p-4 sm:p-6 space-y-6 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" style={{ color: campeonato.themeColor }} />
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
          <div className="py-16 text-center bg-white/[0.01] border border-dashed border-white/10 rounded-lg">
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
              const isMatchParticipant = !!myTeam && (
                myTeam.tag?.toLowerCase() === jogo.timeA?.toLowerCase() ||
                myTeam.tag?.toLowerCase() === jogo.timeB?.toLowerCase() ||
                myTeam.name?.toLowerCase() === jogo.timeA?.toLowerCase() ||
                myTeam.name?.toLowerCase() === jogo.timeB?.toLowerCase() ||
                myTeam.nome?.toLowerCase() === jogo.timeA?.toLowerCase() ||
                myTeam.nome?.toLowerCase() === jogo.timeB?.toLowerCase()
              );
              const canAccessSeries = isMatchParticipant || isAdmin;

              const matchDateObj = parseMatchDateTime(jogo.data, jogo.hora);
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

              // 5 minutos antes do horário agendado ou horário já alcançado/passado
              const isTimeToStart = matchDateObj
                ? matchDateObj.getTime() - Date.now() <= 5 * 60 * 1000
                : true;

              const isSeriesLive =
                (jogo.status === "em_andamento" || !!jogo.codigo_partida) &&
                jogo.status !== "finalizado";

              const canStartSeries =
                canAccessSeries &&
                (jogo.status === "confirmado" || isAdmin) &&
                !jogo.codigo_partida &&
                isTimeToStart &&
                jogo.status !== "finalizado";

              if (jogo.status === "finalizado") {
                const scores = ((jogo as any).placar || "0 - 0").split(" - ");
                const scoreA = parseInt(scores[0]) || 0;
                const scoreB = parseInt(scores[1]) || 0;

                // Regra: manter quem GANHOU na ESQUERDA e quem PERDEU na DIREITA
                const teamBWon = scoreB > scoreA;
                const isTie = scoreA === scoreB;

                const leftTeam = teamBWon ? timeB : timeA;
                const LeftIcon = teamBWon ? IconB : IconA;
                const leftCor = teamBWon ? corB : corA;
                const leftScore = teamBWon ? scoreB : scoreA;

                const rightTeam = teamBWon ? timeA : timeB;
                const RightIcon = teamBWon ? IconA : IconB;
                const rightCor = teamBWon ? corA : corB;
                const rightScore = teamBWon ? scoreA : scoreB;

                const leftScoreColor = isTie ? "#FFFFFF" : "#00FF41";
                const rightScoreColor = isTie ? "#FFFFFF" : "#FF3131";
                const primaryColor = campeonato.themeColor || "#FFB700";

                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (isAdmin) {
                        const realIdx = campeonato.cronograma.findIndex(
                          (c: any) => c === jogo,
                        );
                        setEditingMatchIndex(realIdx);
                        setJogoStatusAtStart("finalizado");
                        setEditFormData({
                          data: jogo.data,
                          hora: jogo.hora,
                          action: "finish",
                          placar: jogo.placar || "0 - 0",
                        });
                        setIsScheduleEditModalOpen(true);
                      }
                    }}
                    className={`group relative w-full rounded-xl border border-white/10 bg-[#09090d] flex flex-col md:flex-row items-center justify-between overflow-hidden transition-all hover:border-white/20 ${
                      isAdmin ? "cursor-pointer hover:bg-[#0d0d14]" : ""
                    }`}
                    style={{
                      boxShadow: "0 4px 24px -4px rgba(0, 0, 0, 0.6)",
                    }}
                  >
                    {/* MOBILE (< md): Top bar with rounded badge and match date/time */}
                    <div className="w-full flex md:hidden items-center justify-between px-3.5 py-2 border-b border-white/10 bg-white/[0.02]">
                      <div
                        className="px-3 py-1 rounded-full flex items-center select-none border"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor}20 0%, rgba(25,25,35,0.95) 100%)`,
                          borderColor: `${primaryColor}40`,
                        }}
                      >
                        <span
                          className="text-xs uppercase tracking-wider leading-none"
                          style={{
                            fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                            color: primaryColor,
                            textShadow: `0 0 10px ${primaryColor}44`,
                          }}
                        >
                          FINALIZADA
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-black tracking-wider text-white/60">
                        {jogo.data && jogo.data !== "A COMBINAR" && (
                          <span>{formatFullDate(jogo.data)}</span>
                        )}
                        {jogo.hora && jogo.hora !== "--:--" && (
                          <span style={{ color: primaryColor }}>
                            {/^\d{2}:\d{2}/.test(jogo.hora) ? jogo.hora.substring(0, 5) : jogo.hora}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* DESKTOP (>= md): Left rounded badge with primary color */}
                    <div className="hidden md:flex items-center pl-4 lg:pl-5 shrink-0">
                      <div
                        className="px-3.5 py-1.5 rounded-full border flex items-center justify-center select-none"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor}20 0%, rgba(20,20,28,0.95) 100%)`,
                          borderColor: `${primaryColor}40`,
                        }}
                      >
                        <span
                          className="text-sm lg:text-base uppercase tracking-wider leading-none"
                          style={{
                            fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                            color: primaryColor,
                            textShadow: `0 0 15px ${primaryColor}55`,
                          }}
                        >
                          FINALIZADA
                        </span>
                      </div>
                    </div>

                    {/* DESKTOP (>= md): Date & Time (sem BRT) */}
                    <div className="hidden md:flex flex-col items-center lg:items-start justify-center px-4 lg:px-5 shrink-0 min-w-[115px] lg:min-w-[130px]">
                      {jogo.data && jogo.data !== "A COMBINAR" && (
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] leading-none mb-1">
                          {formatDayOfWeek(jogo.data)}
                        </span>
                      )}
                      <span className="text-xs lg:text-sm font-black text-white uppercase tracking-tight leading-none">
                        {formatFullDate(jogo.data) || "A definir"}
                      </span>
                      {jogo.hora && jogo.hora !== "--:--" && (
                        <span
                          className="text-[10px] lg:text-xs font-black tracking-wider mt-1"
                          style={{ color: primaryColor }}
                        >
                          {/^\d{2}:\d{2}/.test(jogo.hora)
                            ? jogo.hora.substring(0, 5)
                            : jogo.hora}
                        </span>
                      )}
                    </div>

                    {/* CENTER: Matchup (Left: Winner, Right: Loser) */}
                    <div className="flex items-center justify-center gap-3 sm:gap-6 flex-1 w-full px-3 py-3.5 md:py-3 min-w-0">
                      {/* Left Team (Quem ganhou) */}
                      <div className="flex items-center gap-2.5 sm:gap-3.5 flex-1 justify-end min-w-0">
                        <div className="flex flex-col items-end text-right min-w-0">
                          <span className="text-xs sm:text-sm font-black text-white uppercase truncate tracking-tight">
                            {leftTeam.name || leftTeam.nome}
                          </span>
                          {leftTeam.tag && (
                            <div
                              className="p-[1px] shrink-0 mt-0.5"
                              style={{
                                clipPath: CUT_BADGE,
                                background: `${leftCor}80`,
                              }}
                            >
                              <div
                                className="text-[9px] font-black px-1.5 py-0.5 tracking-wider bg-[#0c0c10]"
                                style={{
                                  clipPath: CUT_BADGE_INNER,
                                  color: leftCor,
                                }}
                              >
                                #{leftTeam.tag}
                              </div>
                            </div>
                          )}
                        </div>

                        <div
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-black"
                          style={{ borderColor: `${leftCor}80` }}
                        >
                          {leftTeam.logo ? (
                            <img
                              src={leftTeam.logo}
                              alt={leftTeam.tag}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <LeftIcon
                              className="w-5 h-5 sm:w-6 sm:h-6"
                              style={{ color: leftCor }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Scoreboard Box (Placar com verde apenas no vencedor) */}
                      <div className="shrink-0 flex flex-col items-center justify-center px-3.5 sm:px-4 py-1.5 rounded-lg bg-black/50 border border-white/10 shadow-inner">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <span
                            className="text-xl sm:text-2xl lg:text-3xl font-black tabular-nums font-mono leading-none"
                            style={{ color: leftScoreColor }}
                          >
                            {leftScore}
                          </span>
                          <span className="text-white/20 text-base sm:text-lg font-black select-none leading-none">
                            :
                          </span>
                          <span
                            className="text-xl sm:text-2xl lg:text-3xl font-black tabular-nums font-mono leading-none"
                            style={{ color: rightScoreColor }}
                          >
                            {rightScore}
                          </span>
                        </div>
                        {jogo.irregular && (
                          <span
                            className="text-[8px] font-black uppercase text-amber-400 bg-amber-400/10 px-1.5 py-0.5 border border-amber-400/30 tracking-widest flex items-center gap-1 rounded mt-1"
                            title="Partida jogada com membro fora do elenco oficial"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Irregular
                          </span>
                        )}
                      </div>

                      {/* Right Team (Quem perdeu) */}
                      <div className="flex items-center gap-2.5 sm:gap-3.5 flex-1 justify-start min-w-0">
                        <div
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-black"
                          style={{ borderColor: `${rightCor}80` }}
                        >
                          {rightTeam.logo ? (
                            <img
                              src={rightTeam.logo}
                              alt={rightTeam.tag}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <RightIcon
                              className="w-5 h-5 sm:w-6 sm:h-6"
                              style={{ color: rightCor }}
                            />
                          )}
                        </div>

                        <div className="flex flex-col items-start text-left min-w-0">
                          <span className="text-xs sm:text-sm font-black text-white uppercase truncate tracking-tight">
                            {rightTeam.name || rightTeam.nome}
                          </span>
                          {rightTeam.tag && (
                            <div
                              className="p-[1px] shrink-0 mt-0.5"
                              style={{
                                clipPath: CUT_BADGE,
                                background: `${rightCor}80`,
                              }}
                            >
                              <div
                                className="text-[9px] font-black px-1.5 py-0.5 tracking-wider bg-[#0c0c10]"
                                style={{
                                  clipPath: CUT_BADGE_INNER,
                                  color: rightCor,
                                }}
                              >
                                #{rightTeam.tag}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Spacer na direita no Desktop para manter o confronto centralizado */}
                    <div className="hidden md:block shrink-0 min-w-[115px] lg:min-w-[130px]" />
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  onClick={() => {
                    const canClick =
                      canUserEdit &&
                      ((jogo.status !== "finalizado" && !isSeriesLive) || isAdmin);
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
                      } else if (isAdmin && (jogo.status === "confirmado" || isSeriesLive)) {
                        setEditFormData({
                          data: jogo.data,
                          hora: jogo.hora,
                          action: "finish",
                          placar: jogo.placar || "0 - 0",
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
                  className={`w-full p-3.5 lg:p-4 rounded-lg border bg-[#0c0c10] flex flex-col lg:flex-row items-center justify-between gap-4 transition-all hover:scale-[1.003] ${
                    isAdmin && jogo.status === "finalizado" ? "cursor-pointer hover:bg-[#101018]" : canUserEdit && jogo.status !== "finalizado" ? "cursor-pointer hover:bg-[#101018]" : ""
                  }`}
                  style={{
                    borderColor: (jogo.status === "confirmado" || isSeriesLive)
                      ? `${campeonato.themeColor || '#FFB700'}66`
                      : 'rgba(255, 255, 255, 0.1)',
                    boxShadow: (jogo.status === "confirmado" || isSeriesLive)
                      ? `0 0 30px -5px ${campeonato.themeColor || '#FFB700'}22`
                      : undefined
                  }}
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
                        className="w-10 h-10 lg:w-12 lg:h-12 rounded-md border flex items-center justify-center shrink-0 shadow-xl overflow-hidden bg-black"
                        style={{ borderColor: `${corA}80` }}
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
                      <div className="text-center w-full flex flex-col items-center">
                        {timeA.tag ? (
                          <div
                            className="p-[1px] shrink-0"
                            style={{ clipPath: CUT_BADGE, background: `${corA}80` }}
                          >
                            <div
                              className="text-[9px] font-black px-1.5 py-0.5 tracking-wider bg-[#0c0c10]"
                              style={{ clipPath: CUT_BADGE_INNER, color: corA }}
                            >
                              #{timeA.tag}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm font-black text-white uppercase truncate tracking-tight">
                            {timeA.name || timeA.nome}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Score Indicator */}
                    <div className="shrink-0 z-20 flex flex-col items-center justify-center min-w-[70px]">
                      {jogo.status === "finalizado" ? (
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-2.5">
                            {(() => {
                              const scores = (
                                (jogo as any).placar || "0 - 0"
                              ).split(" - ");
                              const scoreA = parseInt(scores[0]) || 0;
                              const scoreB = parseInt(scores[1]) || 0;
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
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span
                              className="text-[9px] font-black uppercase text-white/50 tracking-widest px-2 py-0.5 bg-white/5 rounded-md border border-white/10"
                            >
                              Finalizado {jogo.best_of ? `(MD${jogo.best_of})` : ""}
                            </span>
                            {jogo.irregular && (
                              <span
                                className="text-[8px] font-black uppercase text-amber-400 bg-amber-400/10 px-1.5 py-0.5 border border-amber-400/30 tracking-widest flex items-center gap-1 rounded-md"
                                title="Partida jogada com membro fora do elenco oficial"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Irregular
                              </span>
                            )}
                          </div>
                        </div>
                      ) : isSeriesLive ? (
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const scores = (
                                (jogo as any).placar || "0 - 0"
                              ).split(" - ");
                              const scoreA = parseInt(scores[0]) || 0;
                              const scoreB = parseInt(scores[1]) || 0;
                              return (
                                <>
                                  <span className="text-xl lg:text-2xl font-black tabular-nums text-white">
                                    {scoreA}
                                  </span>
                                  <span className="text-white/20 text-lg font-black">-</span>
                                  <span className="text-xl lg:text-2xl font-black tabular-nums text-white">
                                    {scoreB}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span
                              className="text-[9px] font-black uppercase text-[#00FF41] tracking-widest px-2 py-0.5 bg-[#00FF41]/10 border border-[#00FF41]/20 flex items-center gap-1 rounded-md"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-ping" />
                              Ao Vivo {jogo.best_of ? `(MD${jogo.best_of})` : ""}
                            </span>
                            {jogo.irregular && (
                              <span
                                className="text-[8px] font-black uppercase text-amber-400 bg-amber-400/10 px-1.5 py-0.5 border border-amber-400/30 tracking-widest flex items-center gap-0.5 rounded-md"
                                title="Jogador fora do roster detectado"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Irreg.
                              </span>
                            )}
                          </div>
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
                        className="w-10 h-10 lg:w-12 lg:h-12 rounded-md border flex items-center justify-center shrink-0 shadow-xl overflow-hidden bg-black"
                        style={{ borderColor: `${corB}80` }}
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
                      <div className="text-center w-full flex flex-col items-center">
                        {timeB.tag ? (
                          <div
                            className="p-[1px] shrink-0"
                            style={{ clipPath: CUT_BADGE, background: `${corB}80` }}
                          >
                            <div
                              className="text-[9px] font-black px-1.5 py-0.5 tracking-wider bg-[#0c0c10]"
                              style={{ clipPath: CUT_BADGE_INNER, color: corB }}
                            >
                              #{timeB.tag}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm font-black text-white uppercase truncate tracking-tight">
                            {timeB.name || timeB.nome}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Info & Actions */}
                  <div className="flex flex-col items-center justify-center lg:justify-end gap-2 shrink-0 min-w-[140px]">
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

                    {/* Botão Iniciar Série */}
                    {canStartSeries && (
                      <button
                        type="button"
                        disabled={startingMatchId === (jogo.match_id || jogo.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartSeries(jogo);
                        }}
                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 text-black rounded-lg shadow-lg cursor-pointer"
                        style={{
                          backgroundColor: campeonato.themeColor || '#FFB700',
                        }}
                      >
                        {startingMatchId === (jogo.match_id || jogo.id) ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Iniciando...</span>
                          </>
                        ) : (
                          <>
                            <Swords className="w-3.5 h-3.5" />
                            <span>Iniciar Série</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Botões durante Série Ativa: Copiar Código Riot + Verificar */}
                    {isSeriesLive && (
                      canAccessSeries ? (
                        <div className="flex flex-col sm:flex-row items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (jogo.codigo_partida) handleCopyCode(jogo.codigo_partida, jogo.id);
                            }}
                            className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 border rounded-lg cursor-pointer"
                            style={{
                              background: copiedMatchId === jogo.id ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              borderColor: copiedMatchId === jogo.id ? '#00FF41' : 'rgba(255, 255, 255, 0.15)',
                              color: copiedMatchId === jogo.id ? '#00FF41' : '#FFFFFF',
                            }}
                            title="Copiar código de torneio da Riot para colar no LoL"
                          >
                            {copiedMatchId === jogo.id ? (
                              <>
                                <Check className="w-3 h-3 text-[#00FF41]" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-[#00F0FF]" />
                                <span>Copiar Código Riot</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={verifyingMatchId === (jogo.match_id || jogo.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerifySeries(jogo);
                            }}
                            className="p-1.5 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all rounded-lg cursor-pointer"
                            title="Verificar resultado da série na Riot agora"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${verifyingMatchId === (jogo.match_id || jogo.id) ? 'animate-spin text-[#00F0FF]' : ''}`} />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1.5 rounded-md"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Em Andamento
                        </span>
                      )
                    )}

                    {/* Ações de Agendamento */}
                    {canUserEdit &&
                    jogo.status !== "finalizado" &&
                    !canStartSeries &&
                    !isSeriesLive &&
                    !(
                      jogo.status === "confirmado" && !isAdmin
                    ) ? (
                    <div
                      className="text-[9px] font-black uppercase text-white/70 tracking-widest flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-md"
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
              );
            })
          )}
        </div>
      </motion.div>
  );
};