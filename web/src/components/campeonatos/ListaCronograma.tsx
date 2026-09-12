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

              const isFinalizado = jogo.status === "finalizado";
              const scores = ((jogo as any).placar || "0 - 0").split(" - ");
              const scoreA = parseInt(scores[0]) || 0;
              const scoreB = parseInt(scores[1]) || 0;

              // Regra: para partida finalizada, manter quem GANHOU na ESQUERDA e quem PERDEU na DIREITA
              const teamBWon = scoreB > scoreA;
              const isTie = scoreA === scoreB;

              const leftTeam = isFinalizado && teamBWon ? timeB : timeA;
              const LeftIcon = isFinalizado && teamBWon ? IconB : IconA;
              const leftCor = isFinalizado && teamBWon ? corB : corA;
              const leftScore = isFinalizado && teamBWon ? scoreB : scoreA;

              const rightTeam = isFinalizado && teamBWon ? timeA : timeB;
              const RightIcon = isFinalizado && teamBWon ? IconA : IconB;
              const rightCor = isFinalizado && teamBWon ? corA : corB;
              const rightScore = isFinalizado && teamBWon ? scoreA : scoreB;

              const leftScoreColor = isTie ? "#FFFFFF" : "#00FF41";
              const rightScoreColor = isTie ? "#FFFFFF" : "#FF3131";
              const primaryColor = campeonato.themeColor || "#FFB700";

              const statusLabel = isFinalizado
                ? "FINALIZADA"
                : isSeriesLive
                  ? "AO VIVO"
                  : jogo.status === "confirmado"
                    ? "AGENDADA"
                    : jogo.status === "proposto"
                      ? "PROPOSTA"
                      : (jogo.status || "JOGO").toUpperCase();

              const statusColor = isSeriesLive
                ? "#00FF41"
                : jogo.status === "proposto"
                  ? "#00F0FF"
                  : primaryColor;

              const canClickCard =
                isAdmin ||
                (canUserEdit && !isFinalizado && !isSeriesLive && !(jogo.status === "confirmado" && !isAdmin));

              return (
                <div
                  key={i}
                  onClick={() => {
                    if (!canClickCard) return;
                    const realIdx = campeonato.cronograma.findIndex(
                      (c: any) => c === jogo,
                    );
                    setEditingMatchIndex(realIdx);
                    setJogoStatusAtStart(jogo.status);

                    if (isAdmin && (isFinalizado || jogo.status === "confirmado" || isSeriesLive)) {
                      setEditFormData({
                        data: jogo.data,
                        hora: jogo.hora,
                        action: "finish",
                        placar: jogo.placar || "0 - 0",
                      });
                    } else if (jogo.status === "proposto" && isMyTurn) {
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
                  }}
                  className={`group relative w-full rounded-xl border bg-[#09090d] flex flex-col overflow-hidden transition-all ${
                    canClickCard ? "cursor-pointer hover:bg-[#0c0c14] hover:border-white/20" : ""
                  }`}
                  style={{
                    boxShadow: isSeriesLive
                      ? "0 0 30px -5px rgba(0, 255, 65, 0.25)"
                      : "0 4px 24px -4px rgba(0, 0, 0, 0.6)",
                    borderColor: isSeriesLive
                      ? "rgba(0, 255, 65, 0.4)"
                      : jogo.status === "confirmado"
                        ? `${primaryColor}40`
                        : "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  {/* TOPO: LARGURA INTEIRA (w-full) com PALAVRA EM ANTON e DATA/HORA */}
                  <div
                    className="w-full flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b border-white/10 select-none"
                    style={{
                      background: isSeriesLive
                        ? "linear-gradient(90deg, rgba(0,255,65,0.2) 0%, rgba(15,15,22,0.95) 50%, rgba(10,10,15,0.6) 100%)"
                        : `linear-gradient(90deg, ${statusColor}22 0%, rgba(15,15,22,0.95) 50%, rgba(10,10,15,0.6) 100%)`,
                    }}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span
                        className="text-2xl sm:text-3xl md:text-4xl uppercase tracking-wider leading-none flex items-center gap-2 sm:gap-2.5"
                        style={{
                          fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                          color: statusColor,
                          textShadow: `0 0 25px ${statusColor}66`,
                        }}
                      >
                        {isSeriesLive && (
                          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#00FF41] animate-ping shrink-0" />
                        )}
                        {statusLabel}
                      </span>

                      {!isFinalizado && jogo.best_of && (
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

                  {/* CORPO DO CARD: MATCHUP (Esquerda: Time A/Vencedor, Centro: Placar/VS, Direita: Time B/Perdedor) */}
                  <div className="w-full flex items-center justify-between gap-3 sm:gap-8 px-4 sm:px-8 py-4 sm:py-5">
                    {/* Left Team */}
                    <div className="flex items-center gap-2.5 sm:gap-4 flex-1 justify-end min-w-0">
                      <div className="flex flex-col items-end text-right min-w-0">
                        <span className="text-xs sm:text-base font-black text-white uppercase truncate tracking-tight">
                          {leftTeam.name || leftTeam.nome}
                        </span>
                        {leftTeam.tag && (
                          <div
                            className="p-[1px] shrink-0 mt-0.5 sm:mt-1"
                            style={{
                              clipPath: CUT_BADGE,
                              background: `${leftCor}80`,
                            }}
                          >
                            <div
                              className="text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 tracking-wider bg-[#0c0c10]"
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
                        className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-black shadow-lg"
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
                            className="w-5 h-5 sm:w-7 sm:h-7"
                            style={{ color: leftCor }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Scoreboard / VS Box */}
                    <div className="shrink-0 flex flex-col items-center justify-center px-3.5 sm:px-6 py-2 rounded-xl bg-black/60 border border-white/10 shadow-inner min-w-[70px] sm:min-w-[90px]">
                      {isFinalizado ? (
                        <div className="flex items-center gap-2 sm:gap-3.5">
                          <span
                            className="text-xl sm:text-3xl lg:text-4xl font-black tabular-nums font-mono leading-none"
                            style={{ color: leftScoreColor }}
                          >
                            {leftScore}
                          </span>
                          <span className="text-white/20 text-base sm:text-xl font-black select-none leading-none">
                            :
                          </span>
                          <span
                            className="text-xl sm:text-3xl lg:text-4xl font-black tabular-nums font-mono leading-none"
                            style={{ color: rightScoreColor }}
                          >
                            {rightScore}
                          </span>
                        </div>
                      ) : isSeriesLive ? (
                        <div className="flex items-center gap-2 sm:gap-3.5">
                          <span className="text-xl sm:text-3xl lg:text-4xl font-black tabular-nums font-mono leading-none text-white">
                            {scoreA}
                          </span>
                          <span className="text-white/20 text-base sm:text-xl font-black select-none leading-none">
                            :
                          </span>
                          <span className="text-xl sm:text-3xl lg:text-4xl font-black tabular-nums font-mono leading-none text-white">
                            {scoreB}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xl sm:text-3xl lg:text-4xl font-black tracking-widest text-white/30 font-mono select-none leading-none">
                          VS
                        </span>
                      )}

                      {jogo.irregular && (
                        <span
                          className="text-[8px] font-black uppercase text-amber-400 bg-amber-400/10 px-1.5 py-0.5 border border-amber-400/30 tracking-widest flex items-center gap-1 rounded mt-1.5"
                          title="Partida jogada com membro fora do elenco oficial"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Irregular
                        </span>
                      )}
                    </div>

                    {/* Right Team */}
                    <div className="flex items-center gap-2.5 sm:gap-4 flex-1 justify-start min-w-0">
                      <div
                        className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-black shadow-lg"
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
                            className="w-5 h-5 sm:w-7 sm:h-7"
                            style={{ color: rightCor }}
                          />
                        )}
                      </div>

                      <div className="flex flex-col items-start text-left min-w-0">
                        <span className="text-xs sm:text-base font-black text-white uppercase truncate tracking-tight">
                          {rightTeam.name || rightTeam.nome}
                        </span>
                        {rightTeam.tag && (
                          <div
                            className="p-[1px] shrink-0 mt-0.5 sm:mt-1"
                            style={{
                              clipPath: CUT_BADGE,
                              background: `${rightCor}80`,
                            }}
                          >
                            <div
                              className="text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 tracking-wider bg-[#0c0c10]"
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

                  {/* AÇÕES / BARRAS INFERIORES */}
                  {isSeriesLive && (
                    <div className="w-full flex items-center justify-center gap-2 sm:gap-3 px-4 py-2 sm:py-2.5 border-t border-white/10 bg-black/40">
                      {canAccessSeries ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (jogo.codigo_partida) handleCopyCode(jogo.codigo_partida, jogo.id);
                            }}
                            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 border rounded-lg cursor-pointer"
                            style={{
                              background: copiedMatchId === jogo.id ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              borderColor: copiedMatchId === jogo.id ? '#00FF41' : 'rgba(255, 255, 255, 0.15)',
                              color: copiedMatchId === jogo.id ? '#00FF41' : '#FFFFFF',
                            }}
                            title="Copiar código de torneio da Riot para colar no LoL"
                          >
                            {copiedMatchId === jogo.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#00FF41]" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-[#00F0FF]" />
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
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${
                                verifyingMatchId === (jogo.match_id || jogo.id) ? 'animate-spin text-[#00F0FF]' : ''
                              }`}
                            />
                          </button>
                        </>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1.5 rounded-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Partida em Andamento
                        </span>
                      )}
                    </div>
                  )}

                  {canStartSeries && !isSeriesLive && (
                    <div className="w-full flex items-center justify-center px-4 py-2 sm:py-2.5 border-t border-white/10 bg-black/40">
                      <button
                        type="button"
                        disabled={startingMatchId === (jogo.match_id || jogo.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartSeries(jogo);
                        }}
                        className="px-4 py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 text-black rounded-lg shadow-lg cursor-pointer"
                        style={{
                          backgroundColor: primaryColor,
                        }}
                      >
                        {startingMatchId === (jogo.match_id || jogo.id) ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Iniciando Série...</span>
                          </>
                        ) : (
                          <>
                            <Swords className="w-3.5 h-3.5" />
                            <span>Iniciar Série</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {!canStartSeries && !isSeriesLive && !isFinalizado && canUserEdit && !(jogo.status === "confirmado" && !isAdmin) && (
                    <div className="w-full flex items-center justify-center px-4 py-1.5 sm:py-2 border-t border-white/10 bg-black/40">
                      <div className="text-[9px] font-black uppercase text-white/70 tracking-widest flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-md">
                        {jogo.status === "proposto" && isMyTurn ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF41]" />
                            <span>Clique para Responder Proposta</span>
                          </>
                        ) : jogo.status === "confirmado" && isAdmin ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-[#00F0FF]" />
                            <span>Clique para Gerenciar / Finalizar</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3.5 h-3.5 text-[#FFB700]" />
                            <span>{jogo.status === "proposto" ? "Aguardando Resposta do Adversário" : "Clique para Agendar"}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
  );
};