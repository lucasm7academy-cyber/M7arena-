import { motion } from "motion/react";
import { Trophy } from "lucide-react";

import { BracketMatch } from "./BracketMatch";

export const DoubleSideBracket = ({
  tournament,
  bracketData,
  onScoreChange,
  isAdmin,
  availableTeams = [],
}: any) => {
  const themeColor = tournament.themeColor || "#FFB700";
  const parseVagas = (vStr: any) => {
    if (typeof vStr === "number") return vStr;
    const s = String(vStr || "16");
    if (s.includes("/")) return parseInt(s.split("/")[1]) || 16;
    return parseInt(s) || 16;
  };

  const totalParticipants = parseVagas(tournament.vagas);
  const timesPorGrupo = tournament.timesPorGrupo || 8;
  const classificados = tournament.classificadosPorGrupo || 4;
  const numGrupos = Math.ceil(totalParticipants / timesPorGrupo);
  const totalClassificados = numGrupos * classificados;
  let bracketTeams =
    tournament.formato === "liga" ? totalClassificados : totalParticipants;

  const is64 = bracketTeams >= 64;
  const is32 = bracketTeams >= 32;
  const is16 = bracketTeams >= 16;
  const is8 = bracketTeams >= 8;

  // Combined height of the bracket area
  const TOTAL_HEIGHT = is64 ? 2200 : is32 ? 1100 : 800;

  const RoundColumn = ({ count, title, side, roundKey }: any) => {
    return (
      <div
        className="flex flex-col w-64 shrink-0"
        style={{ height: `${TOTAL_HEIGHT}px` }}
      >
        {title && (
          <div className="h-16 flex flex-col items-center justify-center shrink-0 select-none">
            <div className="px-3.5 py-1 rounded-full bg-[#0d0d14] border border-white/10 flex items-center gap-2 shadow-md">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor: themeColor,
                  boxShadow: `0 0 8px ${themeColor}`,
                }}
              />
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/90">
                {title}
              </span>
            </div>
            <div className="w-8 h-[1px] bg-white/10 mt-1.5" />
          </div>
        )}
        <div className="flex-1 flex flex-col justify-around relative px-2">
          {[...Array(count)].map((_, i) => {
            const match = bracketData?.side?.[side]?.[roundKey]?.[i] || {};
            return (
              <div
                key={i}
                className="relative z-10 flex items-center justify-center"
                style={{ height: "104px" }}
              >
                <BracketMatch
                  themeColor={themeColor}
                  availableTeams={availableTeams}
                  t1={match.t1}
                  t2={match.t2}
                  s1={match.s1}
                  s2={match.s2}
                  winner={match.winner}
                  isAdmin={isAdmin}
                  onScoreChange={(team: any, delta: any) => {
                    if (team === "winner") {
                      onScoreChange("side", side, roundKey, i, "winner", delta);
                    } else {
                      onScoreChange("side", side, roundKey, i, team, delta);
                    }
                  }}
                />

                {/* Horizontal exit line */}
                <div
                  className={`absolute top-1/2 ${side === "left" ? "-right-10 md:-right-14" : "-left-10 md:-left-14"} w-10 md:w-14 h-[2px] bg-white/20 pointer-events-none`}
                />

                {/* Vertical and horizontal step connector */}
                {i % 2 === 0 && count > 1 && (
                  <div
                    className={`absolute top-1/2 ${side === "left" ? "-right-10 md:-right-14" : "-left-10 md:-left-14"} pointer-events-none`}
                  >
                    <div
                      className={`absolute ${side === "left" ? "right-0" : "left-0"} w-[2px] bg-white/20`}
                      style={{
                        height: `${(TOTAL_HEIGHT - 64) / count}px`,
                        top: "1px",
                      }}
                    />
                    <div
                      className={`absolute ${side === "left" ? "right-0 w-8 md:w-12 h-[2px] translate-x-full" : "left-0 w-8 md:w-12 h-[2px] -translate-x-full"} bg-white/20`}
                      style={{ top: `${(TOTAL_HEIGHT - 64) / count / 2}px` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const finalMatch = bracketData?.side?.grandFinal || {};

  return (
    <div className="flex flex-col items-center w-full py-16 min-w-max select-none">
      <div className="mb-14 flex flex-col items-center text-center">
        <span
          className="text-[11px] font-black uppercase tracking-[0.35em] mb-1.5 opacity-80"
          style={{ color: themeColor }}
        >
          Chaveamento Eliminatório
        </span>
        <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight mb-2.5">
          {tournament.titulo || tournament.nome || tournament.name}
        </h2>
        <div
          className="h-1 w-28 rounded-full"
          style={{
            backgroundColor: themeColor,
            boxShadow: `0 0 20px ${themeColor}`,
          }}
        />
      </div>

      <div
        className="flex items-center justify-center gap-4 md:gap-8 lg:gap-16 relative"
        style={{ height: `${TOTAL_HEIGHT}px` }}
      >
        {/* Left Side */}
        <div className="flex items-center gap-6 md:gap-10 lg:gap-12 h-full">
          {is64 && (
            <RoundColumn
              title="Rodada 64"
              count={16}
              side="left"
              roundKey="r64"
            />
          )}
          {is32 && (
            <RoundColumn
              title="Rodada 32"
              count={8}
              side="left"
              roundKey="r32"
            />
          )}
          {is16 && (
            <RoundColumn title="Oitavas" count={4} side="left" roundKey="r16" />
          )}
          {is8 && (
            <RoundColumn title="Quartas" count={2} side="left" roundKey="qf" />
          )}
          {bracketTeams > 2 && (
            <RoundColumn
              title="Semi-Final"
              count={1}
              side="left"
              roundKey="sf"
            />
          )}
        </div>

        {/* Center: Grand Final */}
        <div
          className="flex flex-col w-64 shrink-0 z-30"
          style={{ height: `${TOTAL_HEIGHT}px` }}
        >
          <div className="h-16 flex flex-col items-center justify-center shrink-0">
            <div
              className="px-3.5 py-1 rounded-full border flex items-center gap-2 shadow-lg"
              style={{
                backgroundColor: `${themeColor}15`,
                borderColor: `${themeColor}40`,
              }}
            >
              <Trophy className="w-3.5 h-3.5" style={{ color: themeColor }} />
              <span
                className="text-[11px] font-black uppercase tracking-[0.2em]"
                style={{ color: themeColor }}
              >
                Decisão do Título
              </span>
            </div>
            <div
              className="w-10 h-[1px] mt-1.5"
              style={{ backgroundColor: `${themeColor}60` }}
            />
          </div>

          <div className="flex-1 flex flex-col justify-around items-center relative px-4">
            {bracketTeams > 2 && (
              <>
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-4 md:w-8 lg:w-16 h-[2px] bg-white/20" />
                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-4 md:w-8 lg:w-16 h-[2px] bg-white/20" />
              </>
            )}

            <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-full flex flex-col items-center justify-center">
              {finalMatch.winner ? (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative">
                    <Trophy
                      size={68}
                      style={{
                        color: themeColor,
                        filter: `drop-shadow(0 0 24px ${themeColor}90)`,
                      }}
                    />
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-0 blur-2xl rounded-full -z-10"
                      style={{ backgroundColor: `${themeColor}40` }}
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 mb-1.5 shadow">
                      <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.25em]">
                        🏆 Campeão do Torneio
                      </span>
                    </div>
                    <span
                      className="text-2xl md:text-3xl font-black uppercase tracking-wider text-center max-w-[260px] truncate"
                      style={{
                        color: themeColor,
                        textShadow: `0 0 24px ${themeColor}60`,
                      }}
                    >
                      {finalMatch.winner}
                    </span>
                  </div>
                  <div
                    className="w-44 h-1 rounded-full shadow-[0_0_25px_rgba(255,183,0,0.8)] mt-2"
                    style={{
                      backgroundColor: themeColor,
                      boxShadow: `0 0 25px ${themeColor}CC`,
                    }}
                  />
                </motion.div>
              ) : (
                <div className="flex flex-col items-center">
                  <div
                    className="px-4 py-1.5 rounded-full border flex items-center gap-2 shadow-xl backdrop-blur-sm"
                    style={{
                      backgroundColor: `${themeColor}12`,
                      borderColor: `${themeColor}35`,
                    }}
                  >
                    <Trophy className="w-4 h-4" style={{ color: themeColor }} />
                    <span
                      className="text-xs font-black uppercase tracking-[0.2em]"
                      style={{ color: themeColor }}
                    >
                      Grande Final <span className="text-white/40 font-mono font-normal text-[10px]">(MD5)</span>
                    </span>
                  </div>
                  <div
                    className="w-12 h-[1px] mt-2.5"
                    style={{ backgroundColor: `${themeColor}40` }}
                  />
                </div>
              )}
            </div>

            <div className="relative group">
              {finalMatch.winner && (
                <div
                  className="absolute -inset-10 blur-3xl rounded-full animate-pulse"
                  style={{ backgroundColor: `${themeColor}1A` }}
                />
              )}
              <div
                className="absolute -inset-4 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                style={{ backgroundColor: `${themeColor}0D` }}
              />
              <BracketMatch
                themeColor={themeColor}
                availableTeams={availableTeams}
                t1={finalMatch.t1}
                t2={finalMatch.t2}
                s1={finalMatch.s1}
                s2={finalMatch.s2}
                winner={finalMatch.winner}
                isAdmin={isAdmin}
                onScoreChange={(team: any, delta: any) => {
                  if (team === "winner") {
                    onScoreChange(
                      "side",
                      "final",
                      "grandFinal",
                      0,
                      "winner",
                      delta,
                    );
                  } else {
                    onScoreChange(
                      "side",
                      "final",
                      "grandFinal",
                      0,
                      team,
                      delta,
                    );
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center flex-row-reverse gap-6 md:gap-10 lg:gap-12 h-full">
          {is64 && (
            <RoundColumn
              title="Rodada 64"
              count={16}
              side="right"
              roundKey="r64"
            />
          )}
          {is32 && (
            <RoundColumn
              title="Rodada 32"
              count={8}
              side="right"
              roundKey="r32"
            />
          )}
          {is16 && (
            <RoundColumn
              title="Oitavas"
              count={4}
              side="right"
              roundKey="r16"
            />
          )}
          {is8 && (
            <RoundColumn title="Quartas" count={2} side="right" roundKey="qf" />
          )}
          {bracketTeams > 2 && (
            <RoundColumn
              title="Semi-Final"
              count={1}
              side="right"
              roundKey="sf"
            />
          )}
        </div>
      </div>
    </div>
  );
};
