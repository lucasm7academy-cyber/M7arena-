import { Swords } from "lucide-react";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";

export const AdminCriarJogo = () => {
  const { campeonato, isAdmin, adminMatchData, setAdminMatchData, setIsAdminMatchModalOpen } = useCampeonato();
  if (!isAdmin) return null;
  return (
    <div className="w-full rounded-xl border border-white/10 bg-[#08080a] shadow-2xl p-3 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
      <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Swords
            className="w-5 h-5 sm:w-6 sm:h-6"
            style={{ color: campeonato.themeColor }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-base sm:text-xl font-black text-white uppercase tracking-widest leading-none truncate">
            Painel de Arbitragem
          </h4>
          <p
            className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1.5 sm:mt-2"
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
        className="w-full md:w-auto px-6 sm:px-8 py-2.5 sm:py-3.5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-lg hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
      >
        Criar Novo Jogo
      </button>
    </div>
  );
};
