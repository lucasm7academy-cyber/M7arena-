import { Swords } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BADGE, CUT_BADGE_INNER, CUT_BUTTON } from "./cut-edge";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";

export const AdminCriarJogo = () => {
  const { campeonato, isAdmin, adminMatchData, setAdminMatchData, setIsAdminMatchModalOpen } = useCampeonato();
  if (!isAdmin) return null;
  return (
    <div
      className="relative p-[1.5px] shadow-2xl transition-all group"
      style={{
        clipPath: CUT_FRAME,
        background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.05) 100%)`,
        boxShadow: `0 0 40px -10px ${campeonato.themeColor || '#FFB700'}26`
      }}
    >
      <div
        className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 p-4 sm:p-6"
        style={{ clipPath: CUT_FRAME_INNER }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 p-[1px] flex items-center justify-center shrink-0"
            style={{
              clipPath: CUT_BADGE,
              background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
            }}
          >
            <div
              className="w-full h-full bg-[#08080a] flex items-center justify-center"
              style={{ clipPath: CUT_BADGE_INNER }}
            >
              <Swords
                className="w-6 h-6"
                style={{ color: campeonato.themeColor }}
              />
            </div>
          </div>
          <div>
            <h4 className="text-xl font-black text-white uppercase tracking-widest leading-none">
              Painel de Arbitragem
            </h4>
            <p
              className="text-[10px] font-black uppercase tracking-[0.3em] mt-2"
              style={{ color: campeonato.themeColor }}
            >
              Capitão, insira confrontos manuais no campeonato
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setAdminMatchData({
              ...adminMatchData,
              timeA: "",
              timeB: "",
            });
            setIsAdminMatchModalOpen(true);
          }}
          className="px-8 py-3.5 bg-white text-black font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
          style={{ clipPath: CUT_BUTTON }}
        >
          Criar Novo Jogo
        </button>
      </div>
    </div>
  );
};