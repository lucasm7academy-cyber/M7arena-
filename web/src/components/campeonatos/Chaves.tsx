import { motion } from "motion/react";
import { Eye, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { DoubleSideBracket } from "./DoubleSideBracket";
import { DoubleEliminationBracket } from "./DoubleEliminationBracket";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";

export const Chaves = ({ campeonato, isAdmin, isBracketModalOpen, setIsBracketModalOpen, bracketRef, bracketHandlers, bracketScale, bracketData, handleBracketScoreChange, bracketAvailableTeams }: any) => {
  const campCtx = useCampeonato();
  const setBracketScale = campCtx?.setBracketScale;
  const currentScale = bracketScale ?? 1;

  return (
    <motion.div
      key="bracket"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full"
    >
      <div className="w-full rounded-2xl border border-white/15 bg-[#101018] shadow-2xl h-[72vh] min-h-[520px] flex flex-col overflow-hidden relative">
        {/* Background do Campeonato com Imagem */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: `url(${campeonato?.bannerUrl || "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2070"})`,
            opacity: 0.32,
            filter: "blur(1.5px)",
          }}
        />
        {/* Overlay escuro esportivo para legibilidade e contraste */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0e0e18]/90 via-[#0a0a14]/80 to-[#0e0e18]/95 pointer-events-none" />

        {/* Header com Título e Controles de Zoom */}
        <div className="relative z-10 px-5 py-4 sm:px-7 sm:py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#12121d]/85 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  backgroundColor: campeonato?.themeColor || "#FFB700",
                  boxShadow: `0 0 10px ${campeonato?.themeColor || "#FFB700"}`,
                }}
              />
              <h2
                className="text-lg sm:text-xl font-black uppercase tracking-[0.2em]"
                style={{ color: campeonato?.themeColor || "#FFB700" }}
              >
                Chaveamento Oficial
              </h2>
            </div>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5">
              Confrontos eliminatórios em tempo real • Arraste para navegar
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Controles de Zoom */}
            {setBracketScale && (
              <div className="flex items-center bg-[#181827] border border-white/10 rounded-xl p-1 gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setBracketScale((s: number) => Math.max(+(s - 0.1).toFixed(2), 0.35))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Diminuir Zoom (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setBracketScale(1)}
                  className="px-2 h-7 rounded-lg flex items-center justify-center text-[11px] font-mono font-bold text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Resetar Zoom (100%)"
                >
                  {Math.round(currentScale * 100)}%
                </button>

                <button
                  type="button"
                  onClick={() => setBracketScale((s: number) => Math.min(+(s + 0.1).toFixed(2), 2.0))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Aumentar Zoom (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

                <button
                  type="button"
                  onClick={() => setBracketScale(1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Redefinir Zoom para o padrão"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Botão de Tela Cheia */}
            <button
              type="button"
              onClick={() => setIsBracketModalOpen(true)}
              className="h-9 px-3.5 rounded-xl border border-white/10 bg-[#181827] flex items-center gap-2 transition-all cursor-pointer group text-white/70 hover:text-white hover:border-white/25 hover:bg-[#202034] text-xs font-semibold shadow-sm"
              title="Abrir em Tela Cheia"
            >
              <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Tela Cheia</span>
            </button>
          </div>
        </div>

        {/* Viewport de Navegação com Zoom Centrado */}
        <div
          ref={bracketRef}
          {...bracketHandlers}
          className="relative z-10 flex-1 overflow-auto no-scrollbar bg-transparent cursor-grab active:cursor-grabbing flex select-none"
          style={{ touchAction: "none" }}
        >
          <div className="min-w-full min-h-full flex items-center justify-center p-8 md:p-14 m-auto">
            <div
              style={{
                transform: `scale(${currentScale})`,
                transformOrigin: "center center",
                transition: "transform 0.08s ease-out",
                width: "max-content",
              }}
            >
                          {(() => {
                            const parseVagas = (vStr: any) => {
                              if (typeof vStr === "number") return vStr;
                              const s = String(vStr || "16");
                              if (s.includes("/"))
                                return parseInt(s.split("/")[1]) || 16;
                              return parseInt(s) || 16;
                            };
                            const totalParticipants = parseVagas(
                              campeonato.vagas,
                            );
                            const timesPorGrupo = campeonato.timesPorGrupo || 8;
                            const classificados =
                              campeonato.classificadosPorGrupo || 4;
                            const numGrupos = Math.ceil(
                              totalParticipants / timesPorGrupo,
                            );
                            const totalClassificados = numGrupos * classificados;
                            const useDoubleElim =
                              campeonato.formato === "liga" &&
                              totalClassificados > 4;

                            if (useDoubleElim) {
                              return (
                                <DoubleEliminationBracket
                                  tournament={campeonato}
                                  bracketData={bracketData}
                                  onScoreChange={handleBracketScoreChange}
                                  isAdmin={isAdmin}
                                  availableTeams={bracketAvailableTeams}
                                />
                              );
                            } else {
                              return (
                                <DoubleSideBracket
                                  tournament={campeonato}
                                  bracketData={bracketData}
                                  onScoreChange={handleBracketScoreChange}
                                  isAdmin={isAdmin}
                                  availableTeams={bracketAvailableTeams}
                                />
                              );
                            }
                          })()}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
