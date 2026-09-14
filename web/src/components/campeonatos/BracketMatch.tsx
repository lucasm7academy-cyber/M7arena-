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
              filter: `drop-shadow(0 0 16px ${themeColor}35)`,
            }
          : {}
      }
    >
      <div
        className={`w-64 h-[104px] rounded-xl border transition-all duration-300 flex flex-col overflow-hidden bg-[#0a0a0f] shadow-2xl ${
          hasValidWinner
            ? "border-white/20"
            : "border-white/10 hover:border-white/25"
        }`}
        style={
          hasValidWinner
            ? {
                borderColor: `${themeColor}60`,
                boxShadow: `0 8px 24px -6px rgba(0, 0, 0, 0.9), inset 0 0 20px -10px ${themeColor}25`,
              }
            : {
                boxShadow: "0 8px 24px -6px rgba(0, 0, 0, 0.9)",
              }
        }
      >
        {/* TIME A */}
        <div
          onClick={() => isAdmin && onScoreChange?.("winner", t1)}
          className={`flex-1 flex items-center justify-between px-3 border-b border-white/[0.08] transition-all relative select-none ${
            isAdmin ? "cursor-pointer hover:bg-white/5" : ""
          } ${isWinner2 ? "opacity-35 hover:opacity-60" : "opacity-100"}`}
          style={
            isWinner1
              ? {
                  background: `linear-gradient(90deg, ${themeColor}22 0%, rgba(255,255,255,0.03) 70%, transparent 100%)`,
                }
              : {}
          }
        >
          {/* Indicador de vitória na lateral esquerda */}
          {isWinner1 && (
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-r shadow-lg"
              style={{
                backgroundColor: themeColor,
                boxShadow: `0 0 10px ${themeColor}`,
              }}
            />
          )}

          {/* Time e Logo */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-8 h-8 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 bg-black/80 shadow-inner"
              style={{
                borderColor: isWinner1 ? `${themeColor}70` : "rgba(255,255,255,0.1)",
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
                    color: isWinner1 ? themeColor : "rgba(255,255,255,0.25)",
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
                      ? "font-black text-white"
                      : !t1 || t1 === "TBD"
                        ? "font-mono text-[11px] text-white/25 italic tracking-widest"
                        : "font-bold text-white/70"
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
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-md shrink-0 cursor-pointer"
                    title="Trocar time desta vaga"
                  >
                    <Edit2 className="w-3 h-3 text-white/40 hover:text-white" />
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
                className="w-5 h-5 rounded flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors cursor-pointer text-xs"
                title="Diminuir placar"
              >
                <Minus className="w-3 h-3" />
              </button>
            )}

            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs sm:text-sm shrink-0 border transition-all ${
                isWinner1
                  ? "border-transparent"
                  : "bg-black/50 border-white/5 text-white/30"
              }`}
              style={
                isWinner1
                  ? {
                      backgroundColor: `${themeColor}25`,
                      borderColor: `${themeColor}60`,
                      color: themeColor,
                      boxShadow: `0 0 10px ${themeColor}30`,
                    }
                  : {}
              }
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
                className="w-5 h-5 rounded flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors cursor-pointer text-xs"
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
            isAdmin ? "cursor-pointer hover:bg-white/5" : ""
          } ${isWinner1 ? "opacity-35 hover:opacity-60" : "opacity-100"}`}
          style={
            isWinner2
              ? {
                  background: `linear-gradient(90deg, ${themeColor}22 0%, rgba(255,255,255,0.03) 70%, transparent 100%)`,
                }
              : {}
          }
        >
          {/* Indicador de vitória na lateral esquerda */}
          {isWinner2 && (
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-r shadow-lg"
              style={{
                backgroundColor: themeColor,
                boxShadow: `0 0 10px ${themeColor}`,
              }}
            />
          )}

          {/* Time e Logo */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-8 h-8 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 bg-black/80 shadow-inner"
              style={{
                borderColor: isWinner2 ? `${themeColor}70` : "rgba(255,255,255,0.1)",
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
                    color: isWinner2 ? themeColor : "rgba(255,255,255,0.25)",
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
                      ? "font-black text-white"
                      : !t2 || t2 === "TBD"
                        ? "font-mono text-[11px] text-white/25 italic tracking-widest"
                        : "font-bold text-white/70"
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
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-md shrink-0 cursor-pointer"
                    title="Trocar time desta vaga"
                  >
                    <Edit2 className="w-3 h-3 text-white/40 hover:text-white" />
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
                className="w-5 h-5 rounded flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors cursor-pointer text-xs"
                title="Diminuir placar"
              >
                <Minus className="w-3 h-3" />
              </button>
            )}

            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs sm:text-sm shrink-0 border transition-all ${
                isWinner2
                  ? "border-transparent"
                  : "bg-black/50 border-white/5 text-white/30"
              }`}
              style={
                isWinner2
                  ? {
                      backgroundColor: `${themeColor}25`,
                      borderColor: `${themeColor}60`,
                      color: themeColor,
                      boxShadow: `0 0 10px ${themeColor}30`,
                    }
                  : {}
              }
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
                className="w-5 h-5 rounded flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors cursor-pointer text-xs"
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
