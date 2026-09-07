import { Swords } from "lucide-react";
import { useCampeonato } from "../../features/campeonatos/CampeonatoContext";

export const AdminCriarJogo = () => {
  const { campeonato, isAdmin, adminMatchData, setAdminMatchData, setIsAdminMatchModalOpen } = useCampeonato();
  if (!isAdmin) return null;
  return (
    <div className="w-full rounded-xl border border-white/10 bg-[#08080a] shadow-2xl p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Swords
            className="w-6 h-6"
            style={{ color: campeonato.themeColor }}
          />
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
        className="px-8 py-3.5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-lg hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
      >
        Criar Novo Jogo
      </button>
    </div>
  );
};
