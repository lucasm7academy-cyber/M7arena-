import { useState } from "react";
import { ShieldCheck, Edit2 } from "lucide-react";
import { CUT_BADGE, CUT_BADGE_INNER } from "./cut-edge";

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
  const primaryBg = `bg-[${themeColor}]`;
  const primaryBorder = `border-[${themeColor}] shadow-[0_0_30px_${themeColor}4D]`;
  const primaryText = `text-[${themeColor}]`;
  const scoreHoverBg = `bg-[${themeColor}]/20 hover:bg-[${themeColor}]/40`;
  // Resolve a logo do time pela tag (vem de availableTeams).
  const logoOf = (tag: string) => (availableTeams || []).find((tm: any) => tm.tag === tag)?.logo || "";

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

  // Custom styles as Tailwind might not pick up dynamic arbitrary values well without full JIT
  const customStyles: any = {
    primaryBg: { backgroundColor: themeColor },
    primaryBgGradient: {
      background: `linear-gradient(90deg, ${themeColor}CC 0%, ${themeColor} 100%)`,
    },
    primaryBorder: {
      borderColor: themeColor,
      boxShadow: `0 0 30px ${themeColor}4D`,
    },
    primaryText: { color: themeColor },
    ring: { boxShadow: `0 0 0 4px ${themeColor}1A` },
    scoreHoverBg: { backgroundColor: `${themeColor}33` },
  };

  return (
    <div
      className="relative group"
      style={
        hasValidWinner
          ? { filter: `drop-shadow(0 0 10px ${themeColor}66)` }
          : {}
      }
    >
      <div
        className={`w-60 h-[104px] p-[1.5px] transition-all duration-300 flex flex-col overflow-hidden ${
          hasValidWinner ? "" : "bg-white/10"
        }`}
        style={{
          ...(hasValidWinner ? { backgroundColor: themeColor } : {}),
          clipPath:
            "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
        }}
      >
        <div
          className="w-full h-full bg-[#08080a] flex flex-col overflow-hidden relative"
          style={{
            clipPath:
              "polygon(11.8px 0, 100% 0, 100% calc(100% - 11.8px), calc(100% - 11.8px) 100%, 0 100%, 0 11.8px)",
          }}
        >
          {/* Time A */}
          <div
            className="flex-1 flex items-center justify-between px-4 border-b border-white/5 transition-colors cursor-pointer hover:bg-white/5"
            style={isWinner1 ? customStyles.primaryBgGradient : {}}
            onClick={() => isAdmin && onScoreChange?.("winner", t1)}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className="w-8 h-8 p-[1px] flex items-center justify-center shrink-0"
                style={{
                  clipPath: CUT_BADGE,
                  background: isWinner1 ? `linear-gradient(135deg, ${themeColor}, rgba(255,255,255,0.2))` : 'rgba(255,255,255,0.1)'
                }}
              >
                <div
                  className="w-full h-full bg-black flex items-center justify-center overflow-hidden"
                  style={{ clipPath: CUT_BADGE_INNER }}
                >
                  {logoOf(t1) ? (
                    <img src={logoOf(t1)} loading="lazy" alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShieldCheck
                      className={`w-4 h-4 ${isWinner1 ? "text-white" : isWinner2 ? "text-white/10" : "text-white/20"}`}
                    />
                  )}
                </div>
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
                  className="bg-[#111] text-white text-[11px] font-bold px-1 py-0.5 max-w-[130px] focus:outline-none border border-white/20 cursor-pointer"
                  style={{ clipPath: CUT_BADGE }}
                >
                  <option value="">— vazio (TBD) —</option>
                  {(availableTeams || []).map((tm: any) => (
                    <option key={tm.tag} value={tm.tag}>
                      {tm.nome} [{tm.tag}]
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <span
                    className={`text-[13px] font-black uppercase tracking-tight truncate ${isWinner1 ? "text-white" : "text-white/40"}`}
                  >
                    {!t1 || t1 === "TBD" ? "" : t1}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSlot("t1");
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-white/10 shrink-0 cursor-pointer"
                      style={{ clipPath: CUT_BADGE }}
                      title="Trocar time desta vaga"
                    >
                      <Edit2 className="w-3 h-3 text-white/40" />
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-1 ml-2">
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onScoreChange?.("s1", -1);
                  }}
                  className={`w-5 h-5 flex items-center justify-center text-[10px] transition-colors cursor-pointer ${isWinner1 ? "bg-black/20 hover:bg-black/40 text-black" : "bg-white/5 hover:bg-white/10 text-white/40"}`}
                  style={{ clipPath: CUT_BADGE }}
                >
                  -
                </button>
              )}
              <span
                className={`text-[15px] font-black w-4 text-center ${isWinner1 ? "text-white" : "text-white/20"}`}
              >
                {s1 || "0"}
              </span>
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onScoreChange?.("s1", 1);
                  }}
                  className={`w-5 h-5 flex items-center justify-center text-[10px] transition-colors cursor-pointer ${isWinner1 ? "bg-black/20 hover:bg-black/40 text-black" : isWinner2 ? "bg-transparent" : "bg-white/5 hover:bg-white/10 text-white/40"}`}
                  style={{ clipPath: CUT_BADGE }}
                >
                  +
                </button>
              )}
            </div>
          </div>

          {/* Time B */}
          <div
            className="flex-1 flex items-center justify-between px-4 transition-colors cursor-pointer hover:bg-white/5"
            style={isWinner2 ? customStyles.primaryBgGradient : {}}
            onClick={() => isAdmin && onScoreChange?.("winner", t2)}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className="w-8 h-8 p-[1px] flex items-center justify-center shrink-0"
                style={{
                  clipPath: CUT_BADGE,
                  background: isWinner2 ? `linear-gradient(135deg, ${themeColor}, rgba(255,255,255,0.2))` : 'rgba(255,255,255,0.1)'
                }}
              >
                <div
                  className="w-full h-full bg-black flex items-center justify-center overflow-hidden"
                  style={{ clipPath: CUT_BADGE_INNER }}
                >
                  {logoOf(t2) ? (
                    <img src={logoOf(t2)} loading="lazy" alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShieldCheck
                      className={`w-4 h-4 ${isWinner2 ? "text-white" : isWinner1 ? "text-white/10" : "text-white/20"}`}
                    />
                  )}
                </div>
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
                  className="bg-[#111] text-white text-[11px] font-bold px-1 py-0.5 max-w-[130px] focus:outline-none border border-white/20 cursor-pointer"
                  style={{ clipPath: CUT_BADGE }}
                >
                  <option value="">— vazio (TBD) —</option>
                  {(availableTeams || []).map((tm: any) => (
                    <option key={tm.tag} value={tm.tag}>
                      {tm.nome} [{tm.tag}]
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <span
                    className={`text-[13px] font-black uppercase tracking-tight truncate ${isWinner2 ? "text-white" : "text-white/40"}`}
                  >
                    {!t2 || t2 === "TBD" ? "" : t2}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSlot("t2");
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-white/10 shrink-0 cursor-pointer"
                      style={{ clipPath: CUT_BADGE }}
                      title="Trocar time desta vaga"
                    >
                      <Edit2 className="w-3 h-3 text-white/40" />
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-1 ml-2">
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onScoreChange?.("s2", -1);
                  }}
                  className={`w-5 h-5 flex items-center justify-center text-[10px] transition-colors cursor-pointer ${isWinner2 ? "bg-black/20 hover:bg-black/40 text-black" : "bg-white/5 hover:bg-white/10 text-white/40"}`}
                  style={{ clipPath: CUT_BADGE }}
                >
                  -
                </button>
              )}
              <span
                className={`text-[15px] font-black w-4 text-center ${isWinner2 ? "text-white" : "text-white/20"}`}
              >
                {s2 || "0"}
              </span>
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onScoreChange?.("s2", 1);
                  }}
                  className={`w-5 h-5 flex items-center justify-center text-[10px] transition-colors cursor-pointer ${isWinner2 ? "bg-black/20 hover:bg-black/40 text-black" : isWinner1 ? "bg-transparent" : "bg-white/5 hover:bg-white/10 text-white/40"}`}
                  style={{ clipPath: CUT_BADGE }}
                >
                  +
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
