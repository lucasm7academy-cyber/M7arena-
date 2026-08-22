import { BracketMatch } from "./BracketMatch";

export const UpperRound = ({
  count,
  title,
  roundKey,
  colorScheme = "upper",
  roundIndex = 0,
  showConnectors = true,
  themeColor,
  bracketData,
  availableTeams,
  isAdmin,
  onScoreChange,
}: any) => {
  const MATCH_HEIGHT = 104;
  const BASE_GAP = 32;
  const step = Math.pow(2, roundIndex);
  const topPadding = ((step - 1) * (MATCH_HEIGHT + BASE_GAP)) / 2;
  const matchGap = (MATCH_HEIGHT + BASE_GAP) * step - MATCH_HEIGHT;

  return (
    <div className="flex flex-col w-64 shrink-0">
      {title && (
        <div className="h-12 flex flex-col items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-1">
            {title}
          </span>
          <div className="w-8 h-[1px] bg-white/10" />
        </div>
      )}
      <div
        className="flex flex-col relative"
        style={{ paddingTop: `${topPadding}px`, gap: `${matchGap}px` }}
      >
        {[...Array(count)].map((_, i) => {
          const match = bracketData?.upper?.[roundKey]?.[i] || {};
          return (
            <div
              key={i}
              className="relative z-10 flex items-center justify-center"
              style={{ height: `${MATCH_HEIGHT}px` }}
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
                colorScheme={colorScheme}
                onScoreChange={(team: any, delta: any) =>
                  onScoreChange("upper", "none", roundKey, i, team, delta)
                }
              />

              {showConnectors && (
                <>
                  {/* Horizontal exit line */}
                  <div className="absolute top-1/2 -right-10 md:-right-14 lg:-right-20 w-[42px] md:w-[58px] lg:w-[82px] h-[2px] bg-white/10 pointer-events-none" />

                  {/* Vertical and horizontal step connector */}
                  {i % 2 === 0 && count > 1 && (
                    <div className="absolute top-1/2 -right-10 md:-right-14 lg:-right-20 pointer-events-none">
                      <div
                        className="absolute right-0 w-[2px] bg-white/10"
                        style={{
                          height: `${matchGap + MATCH_HEIGHT}px`,
                          top: "1px",
                        }}
                      />
                      <div
                        className="absolute right-0 w-[38px] md:w-[50px] lg:w-[68px] h-[2px] translate-x-full bg-white/10"
                        style={{ top: `${(matchGap + MATCH_HEIGHT) / 2}px` }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};