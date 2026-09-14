import { useState } from "react";
import { ShieldCheck, Edit2, Plus, Minus } from "lucide-react";

export const BracketMatch = ({
  t1,
  t2,
  s1,
  s2,
  winner,
  onScoreChange,
  isAdmin,
  themeColor = "#FFB700",
  availableTeams = [],
}: any) => {
  const [editingSlot, setEditingSlot] = useState<"t1" | "t2" | null>(null);

  // Busca dados do time pelo tag ou nome
  const findTeam = (ref: string) => {
    if (!ref || ref === "TBD") return null;
    return (availableTeams || []).find(
      (tm: any) =>
        tm.tag?.toLowerCase() === ref.toLowerCase() ||
        tm.nome?.toLowerCase() === ref.toLowerCase() ||
        tm.name?.toLowerCase() === ref.toLowerCase()
    );
  };

  const team1Data = findTeam(t1);
  const team2Data = findTeam(t2);

  const isWinner1 =
    winner !== null &&
    typeof winner !== "undefined" &&
    String(winner || "").trim() === String(t1 || "").trim() &&
    (String(t1 || "").trim() !== String(t2 || "").trim() ||
      Number(s1) > Number(s2));

  const isWinner2 =
    winner !== null &&
    typeof winner !== "undefined" &&
    String(winner || "").trim() === String(t2 || "").trim() &&
    (String(t1 || "").trim() !== String(t2 || "").trim() ||
      Number(s2) > Number(s1));

  const hasValidWinner = isWinner1 || isWinner2;

  return (
    <div
      className="relative group transition-all duration-300"
      style={
        hasValidWinner
          ? {
              filter: `drop-shadow(0 0 16px ${themeColor}40)`,
            }
          : {}
      }
    >
      <div
        className={`w-64 h-[104px] rounded-xl border transition-all duration-300 flex flex-col overflow-hidden bg-[#161622]/95 backdrop-blur-md shadow-2xl ${
          hasValidWinner
            ? "border-2"
            : "border-white/10 hover:border-white/20"
        }`}
        style={
          hasValidWinner
            ? {
                borderColor: themeColor,
                boxShadow: `0 8px 24px -6px rgba(0, 0, 0, 0.8), 0 0 16px ${themeColor}30`,
              }
            : {
                boxShadow: "0 8px 24px -6px rgba(0, 0, 0, 0.7)",
              }
        }
      >
        {/* TIME A */}
        <div
          onClick={() => isAdmin && onScoreChange?.("winner", t1)}
          className={`flex-1 flex items-center justify-between px-3 border-b border-white/10 transition-all relative select-none ${
            isAdmin ? "cursor-pointer hover:opacity-90" : ""
          } ${isWinner2 ? "opacity-35 hover:opacity-60" : "opacity-100"}`}
          style={
            isWinner1
              ? {
                  backgroundColor: themeColor,
                }
              : {}
          }
        >
          {/* Time e Logo */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-8 h-8 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 shadow-inner"
              style={{
                borderColor: isWinner1 ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.1)",
                backgroundColor: isWinner1 ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.5)",
              }}
            >
              {team1Data?.logo ? (
                <img
                  src={team1Data.logo}
                  loading="lazy"
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <ShieldCheck
                  className="w-4 h-4"
                  style={{
                    color: isWinner1 ? "#000000" : "rgba(255,255,255,0.3)",
                  }}
                />
              )}
            </div>

            {editingSlot === "t1" ? (
              <select
                autoFocus
                value={t1 || ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  onScoreChange?.("t1", e.target.value);
                  setEditingSlot(null);
                }}
                onBlur={() => setEditingSlot(null)}
                className="bg-[#111] text-white text-[11px] font-bold px-2 py-1 max-w-[130px] focus:outline-none border border-white/30 rounded-lg cursor-pointer shadow-lg"
              >
                <option value="">— vazio (TBD) —</option>
                {(availableTeams || []).map((tm: any) => (
                  <option key={tm.tag} value={tm.tag}>
                    {tm.nome || tm.name} [{tm.tag}]
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  className={`text-[13px] uppercase tracking-wide truncate ${
                    isWinner1
                      ? "font-black text-black"
                      : !t1 || t1 === "TBD"
                        ? "font-mono text-[11px] text-white/30 italic tracking-widest"
                        : "font-bold text-white/85"
                  }`}
                >
                  {!t1 || t1 === "TBD" ? "A DEFINIR" : (team1Data?.nome || team1Data?.name || t1)}
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSlot("t1");
                    }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md shrink-0 cursor-pointer ${
                      isWinner1
                        ? "hover:bg-black/20 text-black/70 hover:text-black"
                        : "hover:bg-white/10 text-white/40 hover:text-white"
                    }`}
                    title="Trocar time desta vaga"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Placar */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onScoreChange?.("s1", -1);
                }}
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer text-xs ${
                  isWinner1
                    ? "bg-black/15 hover:bg-black/30 text-black"
                    : "bg-white/5 hover:bg-white/15 text-white/50 hover:text-white"
                }`}
                title="Diminuir placar"
              >
                <Minus className="w-3 h-3" />
              </button>
            )}

            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs sm:text-sm shrink-0 border transition-all ${
                isWinner1
                  ? "bg-black/20 text-black border-black/20"
                  : "bg-black/50 border-white/5 text-white/40"
              }`}
            >
              {s1 || "0"}
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onScoreChange?.("s1", 1);
                }}
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer text-xs ${
                  isWinner1
                    ? "bg-black/15 hover:bg-black/30 text-black"
                    : "bg-white/5 hover:bg-white/15 text-white/50 hover:text-white"
                }`}
                title="Aumentar placar"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* TIME B */}
        <div
          onClick={() => isAdmin && onScoreChange?.("winner", t2)}
          className={`flex-1 flex items-center justify-between px-3 transition-all relative select-none ${
            isAdmin ? "cursor-pointer hover:opacity-90" : ""
          } ${isWinner1 ? "opacity-35 hover:opacity-60" : "opacity-100"}`}
          style={
            isWinner2
              ? {
                  backgroundColor: themeColor,
                }
              : {}
          }
        >
          {/* Time e Logo */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-8 h-8 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 shadow-inner"
              style={{
                borderColor: isWinner2 ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.1)",
                backgroundColor: isWinner2 ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.5)",
              }}
            >
              {team2Data?.logo ? (
                <img
                  src={team2Data.logo}
                  loading="lazy"
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <ShieldCheck
                  className="w-4 h-4"
                  style={{
                    color: isWinner2 ? "#000000" : "rgba(255,255,255,0.3)",
                  }}
                />
              )}
            </div>

            {editingSlot === "t2" ? (
              <select
                autoFocus
                value={t2 || ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  onScoreChange?.("t2", e.target.value);
                  setEditingSlot(null);
                }}
                onBlur={() => setEditingSlot(null)}
                className="bg-[#111] text-white text-[11px] font-bold px-2 py-1 max-w-[130px] focus:outline-none border border-white/30 rounded-lg cursor-pointer shadow-lg"
              >
                <option value="">— vazio (TBD) —</option>
                {(availableTeams || []).map((tm: any) => (
                  <option key={tm.tag} value={tm.tag}>
                    {tm.nome || tm.name} [{tm.tag}]
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  className={`text-[13px] uppercase tracking-wide truncate ${
                    isWinner2
                      ? "font-black text-black"
                      : !t2 || t2 === "TBD"
                        ? "font-mono text-[11px] text-white/30 italic tracking-widest"
                        : "font-bold text-white/85"
                  }`}
                >
                  {!t2 || t2 === "TBD" ? "A DEFINIR" : (team2Data?.nome || team2Data?.name || t2)}
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSlot("t2");
                    }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md shrink-0 cursor-pointer ${
                      isWinner2
                        ? "hover:bg-black/20 text-black/70 hover:text-black"
                        : "hover:bg-white/10 text-white/40 hover:text-white"
                    }`}
                    title="Trocar time desta vaga"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Placar */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onScoreChange?.("s2", -1);
                }}
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer text-xs ${
                  isWinner2
                    ? "bg-black/15 hover:bg-black/30 text-black"
                    : "bg-white/5 hover:bg-white/15 text-white/50 hover:text-white"
                }`}
                title="Diminuir placar"
              >
                <Minus className="w-3 h-3" />
              </button>
            )}

            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs sm:text-sm shrink-0 border transition-all ${
                isWinner2
                  ? "bg-black/20 text-black border-black/20"
                  : "bg-black/50 border-white/5 text-white/40"
              }`}
            >
              {s2 || "0"}
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onScoreChange?.("s2", 1);
                }}
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer text-xs ${
                  isWinner2
                    ? "bg-black/15 hover:bg-black/30 text-black"
                    : "bg-white/5 hover:bg-white/15 text-white/50 hover:text-white"
                }`}
                title="Aumentar placar"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
