import { Trophy, ShieldCheck } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BADGE, CUT_BADGE_INNER } from "./cut-edge";

export const GroupStage = ({ tournament }: { tournament: any }) => {
  const classificados = tournament.classificadosPorGrupo || 2;

  const getStatsForTeam = (teamName: string) => {
    let v = 0,
      d = 0,
      matches = 0,
      j = 0;
    (tournament.cronograma || []).forEach((m: any) => {
      // Jogos da fase de grupos E desempates contam pontos para a liga
      const faseStr = (m.fase || m.grupo || "").toUpperCase();
      const isGroupMatch = faseStr.includes("GRUPO");
      const isTieBreaker = faseStr.includes("DESEMPATE");
      if (!isGroupMatch && !isTieBreaker) return;
      if (m.status !== "finalizado") return;
      if (m.timeA !== teamName && m.timeB !== teamName) return;

      matches++;
      const scores = (m.placar || "0 - 0").split(" - ");
      const s1 = parseInt(scores[0]) || 0;
      const s2 = parseInt(scores[1]) || 0;
      const isMatchA = m.timeA === teamName;
      const myScore = isMatchA ? s1 : s2;
      const oppScore = isMatchA ? s2 : s1;

      // Cada partida vencida (mapa) na série vale vitórias
      v += myScore;
      d += oppScore;
      j += s1 + s2;
    });
    return { v, d, matches, j };
  };

  const groups = tournament.grupos
    ? (Array.isArray(tournament.grupos)
        ? tournament.grupos
        : Object.entries(tournament.grupos).map(([name, teams]) => ({
            name,
            teams: Array.isArray(teams) ? teams : [],
          }))
      ).map((group: any) => ({
        name: group.name,
        teams: group.teams
          .map((t: any) => {
            const teamTag = typeof t === "string" ? t : t.tag;
            const teamData =
              typeof t === "object"
                ? t
                : (tournament.timesInscritos || []).find(
                    (ti: any) => ti.tag === t,
                  ) || { name: t, tag: t };
            return {
              ...teamData,
              ...getStatsForTeam(teamTag),
            };
          })
          .sort((a: any, b: any) => {
            // TIE BREAKER LOGIC: Wins > Losses (less is better) > Matches Played
            if (b.v !== a.v) return b.v - a.v;
            if (a.d !== b.d) return a.d - b.d;
            return a.j - b.j;
          }),
      }))
    : [];

  if (groups.length === 0) {
    return (
      <div className="py-20 text-center">
        <Trophy className="w-16 h-16 text-white/5 mx-auto mb-4" />
        <p className="text-sm font-black text-white/20 uppercase tracking-[0.3em]">
          Os grupos ainda não foram sorteados
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {groups.map((group, idx) => (
        <div
          key={idx}
          className="relative p-[1.5px] shadow-2xl transition-all"
          style={{
            clipPath: CUT_FRAME,
            background: `linear-gradient(135deg, ${tournament.themeColor || '#FFB700'}60, rgba(255,255,255,0.05) 100%)`,
          }}
        >
          <div
            className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col"
            style={{ clipPath: CUT_FRAME_INNER }}
          >
            <div className="bg-[#0c0c10] px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2"
                  style={{
                    clipPath: CUT_BADGE,
                    backgroundColor: tournament.themeColor || "#FFB700",
                    boxShadow: `0 0 10px ${tournament.themeColor || "#FFB700"}80`,
                  }}
                />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                  {group.name}
                </h3>
              </div>
              <div
                className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/40 bg-white/5 border border-white/10"
                style={{ clipPath: CUT_BADGE }}
              >
                Top {classificados} Classificam
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] font-black text-white/20 uppercase tracking-widest">
                    <th className="px-4 py-3">Equipe</th>
                    <th className="px-4 py-3 text-center">V</th>
                    <th className="px-4 py-3 text-center">D</th>
                    <th className="px-4 py-3 text-center">J</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold">
                  {group.teams.map((team, tIdx) => (
                    <tr
                      key={tIdx}
                      className={`border-t border-white/[0.04] transition-colors hover:bg-white/[0.02] ${tIdx < classificados ? "bg-[#00FF41]/[0.03]" : ""}`}
                    >
                      <td className="px-4 py-3.5 flex items-center gap-3">
                        <span className="text-[10px] font-black text-white/20 w-4">
                          {tIdx + 1}
                        </span>
                        <div className="flex items-center gap-3 truncate">
                          <div
                            className="w-7 h-7 p-[1px] flex items-center justify-center shrink-0"
                            style={{
                              clipPath: CUT_BADGE,
                              background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))',
                            }}
                          >
                            <div
                              className="w-full h-full bg-black flex items-center justify-center overflow-hidden"
                              style={{ clipPath: CUT_BADGE_INNER }}
                            >
                              {team.logo ? (
                                <img
                                  src={team.logo} loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ShieldCheck className="w-3.5 h-3.5 text-white/20" />
                              )}
                            </div>
                          </div>
                          <span className="text-white uppercase truncate max-w-[120px]">
                            {team.name}{" "}
                            <span className="text-[9px] text-white/20 ml-1">
                              [{team.tag}]
                            </span>
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-4 py-3.5 text-center font-black"
                        style={{ color: "#00FF41" }}
                      >
                        {team.v}
                      </td>
                      <td className="px-4 py-3.5 text-center text-white/60">
                        {team.d}
                      </td>
                      <td 
                        className="px-4 py-3.5 text-center font-black"
                        style={{ color: tournament.themeColor || "#FFB700" }}
                      >
                        {team.j}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
