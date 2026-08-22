import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import { CUT_BADGE } from "./cut-edge";
import { BracketMatch } from "./BracketMatch";
import { UpperRound } from "./UpperRound";
import { LowerRound } from "./LowerRound";

export const DoubleEliminationBracket = ({
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

  const timesPorGrupo = tournament.timesPorGrupo || 8;
  const classificados = tournament.classificadosPorGrupo || 4;
  const totalParticipants = parseVagas(tournament.vagas);
  const numGrupos = Math.ceil(totalParticipants / timesPorGrupo);
  const totalClassificados = numGrupos * classificados;
  const bracketTeams =
    tournament.formato === "liga" ? totalClassificados : totalParticipants;
  const startDepth =
    bracketTeams >= 64
      ? 0
      : bracketTeams >= 32
        ? 1
        : bracketTeams >= 16
          ? 2
          : bracketTeams >= 8
            ? 3
            : 4;

  // Total width of a column including gap
  const COL_WIDTH = 280;

  // Dynamic height based on number of matches in the largest round
  const maxMatchesInRange = bracketTeams / 2;
  const BRACKET_HEIGHT = Math.max(600, maxMatchesInRange * 125);

  const grandFinalMatch = bracketData?.grandFinal || {};

  const MATCH_HEIGHT = 104;
  const BASE_GAP = 32;
  const UPPER_HEADER_Y = 24; // height of "Upper/Lower" label + gap
  const GF_HEADER_Y = 64; // height of "Grande Final" header area

  const finalRoundIndex =
    bracketTeams >= 64
      ? 5
      : bracketTeams >= 32
        ? 4
        : bracketTeams >= 16
          ? 3
          : bracketTeams >= 8
            ? 2
            : bracketTeams >= 4
              ? 1
              : 0;
  const lowerFinalRoundIndex =
    bracketTeams >= 64
      ? 3
      : bracketTeams >= 32
        ? 3
        : bracketTeams >= 16
          ? 2
          : bracketTeams >= 8
            ? 1
            : 0;

  const step = Math.pow(2, finalRoundIndex);
  const upperFinalPadding = ((step - 1) * (MATCH_HEIGHT + BASE_GAP)) / 2;

  // Absolute Y of the center of the Upper Final match card
  const upperFinalCenterY = UPPER_HEADER_Y + upperFinalPadding + 52;

  // Align Slot 1 of Grand Final with Upper Final Center for straight horizontal connection
  const gfOffset = bracketTeams > 2 ? upperFinalCenterY - GF_HEADER_Y - 52 : 0;

  // New Slot locations for Grand Final
  const gfSlot1CenterY = gfOffset + GF_HEADER_Y + 26;
  const gfSlot2CenterY = gfOffset + GF_HEADER_Y + 78;

  // Calculate position for Lower bracket connection
  const firstRoundMatches = Math.max(1, bracketTeams / 2);
  const upperContentHeight =
    firstRoundMatches * MATCH_HEIGHT + (firstRoundMatches - 1) * BASE_GAP;

  // Gap between Upper and Lower
  const lowerBaseY = UPPER_HEADER_Y + upperContentHeight + 56 + UPPER_HEADER_Y;
  const stepLower = Math.pow(2, lowerFinalRoundIndex);
  const lowerFinalPadding = ((stepLower - 1) * (MATCH_HEIGHT + BASE_GAP)) / 2;
  const lowerFinalCenterY = lowerBaseY + lowerFinalPadding + 52;

  const lowerConnectorHeight = lowerFinalCenterY - gfSlot2CenterY;

  return (
    <div className="flex flex-col items-center w-full py-16 min-w-max">
      <div className="mb-14 flex flex-col items-center">
        <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-2">
          {tournament.titulo || tournament.nome || tournament.name}
        </h2>
        <div
          className="h-1 w-32 shadow-[0_0_25px_rgba(255,183,0,0.3)]"
          style={{
            clipPath: CUT_BADGE,
            backgroundColor: themeColor,
            boxShadow: `0 0 25px ${themeColor}4D`,
          }}
        />
      </div>

      <div className="flex items-start justify-center gap-8 md:gap-16 lg:gap-24 w-full px-12 md:px-20">
        <div className="flex flex-col gap-14">
          {/* Upper Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-6">
              <div
                className="w-1.5 h-1.5 shadow-[0_0_10px_rgba(255,183,0,0.5)]"
                style={{
                  clipPath: CUT_BADGE,
                  backgroundColor: themeColor,
                  boxShadow: `0 0 10px ${themeColor}80`,
                }}
              />
              <span className="text-[11px] font-black text-white uppercase tracking-[0.5em]">
                Upper
              </span>
            </div>
            <div className="flex items-start justify-start gap-10 md:gap-14 lg:gap-20">
              {bracketTeams >= 64 && (
                <UpperRound
                  themeColor={themeColor}
                  title=""
                  count={32}
                  roundKey="r64"
                  roundIndex={0}
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams >= 32 && (
                <UpperRound
                  themeColor={themeColor}
                  title=""
                  count={16}
                  roundKey="r32"
                  roundIndex={bracketTeams === 32 ? 0 : 1}
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams >= 16 && (
                <UpperRound
                  themeColor={themeColor}
                  title=""
                  count={8}
                  roundKey="r16"
                  roundIndex={
                    bracketTeams === 16 ? 0 : bracketTeams === 32 ? 1 : 2
                  }
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams >= 8 && (
                <UpperRound
                  themeColor={themeColor}
                  title=""
                  count={4}
                  roundKey="qf"
                  roundIndex={
                    bracketTeams === 8
                      ? 0
                      : bracketTeams === 16
                        ? 1
                        : bracketTeams === 32
                          ? 2
                          : 3
                  }
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams >= 4 && (
                <UpperRound
                  themeColor={themeColor}
                  title=""
                  count={2}
                  roundKey="sf"
                  roundIndex={
                    bracketTeams === 4
                      ? 0
                      : bracketTeams === 8
                        ? 1
                        : bracketTeams === 16
                          ? 2
                          : bracketTeams === 32
                            ? 3
                            : 4
                  }
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams > 2 && (
                <UpperRound
                  themeColor={themeColor}
                  title=""
                  count={1}
                  roundKey="final"
                  roundIndex={finalRoundIndex}
                  showConnectors={false}
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
            </div>
          </div>

          {/* Lower Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-6">
              <div
                className="w-1.5 h-1.5 bg-[#FF0000] shadow-[0_0_10px_rgba(255,0,0,0.5)]"
                style={{ clipPath: CUT_BADGE }}
              />
              <span className="text-[11px] font-black text-white uppercase tracking-[0.5em]">
                Lower
              </span>
            </div>
            <div className="flex items-start justify-start gap-10 md:gap-14 lg:gap-20">
              {bracketTeams >= 32 && (
                <LowerRound
                  themeColor={themeColor}
                  title=""
                  count={8}
                  roundKey="r1"
                  colorScheme="lower"
                  roundIndex={0}
                  nextRoundCount={8}
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams >= 32 && (
                <LowerRound
                  themeColor={themeColor}
                  title=""
                  count={8}
                  roundKey="r2"
                  colorScheme="lower"
                  roundIndex={0}
                  nextRoundCount={4}
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams >= 16 && (
                <LowerRound
                  themeColor={themeColor}
                  title=""
                  count={4}
                  roundKey="r3"
                  colorScheme="lower"
                  roundIndex={bracketTeams === 16 ? 0 : 1}
                  nextRoundCount={4}
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams >= 16 && (
                <LowerRound
                  themeColor={themeColor}
                  title=""
                  count={4}
                  roundKey="r4"
                  colorScheme="lower"
                  roundIndex={bracketTeams === 16 ? 0 : 1}
                  nextRoundCount={2}
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams >= 8 && (
                <LowerRound
                  themeColor={themeColor}
                  title=""
                  count={2}
                  roundKey="r5"
                  colorScheme="lower"
                  roundIndex={
                    bracketTeams === 8 ? 0 : bracketTeams === 16 ? 1 : 2
                  }
                  nextRoundCount={2}
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams >= 8 && (
                <LowerRound
                  themeColor={themeColor}
                  title=""
                  count={2}
                  roundKey="r6"
                  colorScheme="lower"
                  roundIndex={
                    bracketTeams === 8 ? 0 : bracketTeams === 16 ? 1 : 2
                  }
                  nextRoundCount={1}
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              {bracketTeams >= 4 && (
                <LowerRound
                  themeColor={themeColor}
                  title=""
                  count={1}
                  roundKey="r7"
                  colorScheme="lower"
                  roundIndex={
                    bracketTeams === 8 ? 1 : bracketTeams === 16 ? 2 : 3
                  }
                  nextRoundCount={1}
                  bracketData={bracketData}
                  availableTeams={availableTeams}
                  isAdmin={isAdmin}
                  onScoreChange={onScoreChange}
                />
              )}
              <LowerRound
                themeColor={themeColor}
                title=""
                count={1}
                roundKey="final"
                colorScheme="lower"
                roundIndex={lowerFinalRoundIndex}
                showConnectors={false}
                bracketData={bracketData}
                availableTeams={availableTeams}
                isAdmin={isAdmin}
                onScoreChange={onScoreChange}
              />
            </div>
          </div>
        </div>

        {/* Final & Grand Final Center - Integrated at the end of flows */}
        <div
          className={`flex items-start shrink-0 relative ${bracketTeams > 2 ? "lg:ml-[-336px] md:ml-[-240px] ml-[-200px]" : ""}`}
        >
          {/* Grand Final Column */}
          <div
            className="flex flex-col items-center relative"
            style={{ paddingTop: `${gfOffset}px` }}
          >
            {/* New Upper Bracket Winner Connector (Upper Final to GF Slot 1) */}
            {bracketTeams > 2 && (
              <div className="absolute top-0 left-0 w-full pointer-events-none z-10">
                {/* Straight horizontal line from Upper Final to Grand Final Slot 1 */}
                <div
                  className="absolute left-[-109px] w-[111px] h-[2px] bg-white/20"
                  style={{
                    top: `${upperFinalCenterY}px`,
                  }}
                />
              </div>
            )}

            {/* New Lower Bracket Winner Connector (Lower Final to GF Slot 2) */}
            {bracketTeams > 4 && (
              <div className="absolute top-0 left-0 w-full pointer-events-none z-10">
                {/* Straight vertical line from bottom of Grand Final card to top of Lower Final card */}
                <div
                  className="absolute left-[128px] w-[2px] bg-white/20"
                  style={{
                    top: `${gfOffset + GF_HEADER_Y + 104}px`,
                    height: `${(lowerFinalCenterY - 52) - (gfOffset + GF_HEADER_Y + 104)}px`,
                  }}
                />
              </div>
            )}
            <div className="mb-4 h-12 flex flex-col items-center justify-center">
              {grandFinalMatch.winner ? (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-2"
                >
                  <Trophy
                    size={32}
                    style={{
                      color: themeColor,
                      filter: `drop-shadow(0 0 15px ${themeColor}66)`,
                    }}
                  />
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em]">
                      Campeão
                    </span>
                    <span
                      className="text-sm font-black uppercase tracking-wider"
                      style={{ color: themeColor }}
                    >
                      {grandFinalMatch.winner}
                    </span>
                  </div>
                </motion.div>
              ) : (
                <>
                  <span
                    className="text-[12px] font-black uppercase tracking-[0.6em] mb-1 text-center"
                    style={{ color: themeColor }}
                  >
                    Grande Final <span className="opacity-50">(MD5)</span>
                  </span>
                  <div
                    className="w-12 h-[1px]"
                    style={{ backgroundColor: `${themeColor}4D` }}
                  />
                </>
              )}
            </div>

            <div className="relative z-20">
              <div
                className="absolute -inset-10 blur-3xl rounded-full"
                style={{ backgroundColor: `${themeColor}0D` }}
              />
              <BracketMatch
                themeColor={themeColor}
                availableTeams={availableTeams}
                t1={grandFinalMatch.t1}
                t2={grandFinalMatch.t2}
                s1={grandFinalMatch.s1}
                s2={grandFinalMatch.s2}
                winner={grandFinalMatch.winner}
                isAdmin={isAdmin}
                onScoreChange={(team: any, delta: any) =>
                  onScoreChange("grandFinal", "none", "none", 0, team, delta)
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};