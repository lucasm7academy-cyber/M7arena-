import { motion } from "motion/react";
import {
  Trophy,
  Coins,
  CreditCard,
  Calendar,
  Diamond,
  Users,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  FileText,
} from "lucide-react";

export const VisaoGeral = ({
  campeonato,
  getIcon,
  isRegistrado,
  setAbrirInscricao,
  setAbrirRegulamento,
  ehEspectador,
}: any) => {
  const theme = campeonato.themeColor || "#FFB700";

  const blocoInfo = (
    <>
      {/* Premiação */}
      <div className="flex items-center gap-4 py-1">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Coins className="w-5 h-5" style={{ color: theme }} />
        </div>
        <div>
          <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">Premiação Total</h4>
          <p className="text-sm font-bold text-white/80">{campeonato.premio}</p>
          {campeonato.temOutrosPremios && (
            <p className="text-[9px] font-medium text-white/40 mt-1 leading-tight">{campeonato.outrosPremios}</p>
          )}
        </div>
      </div>

      {/* Taxa */}
      <div className="flex items-center gap-4 py-1">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5" style={{ color: "#00D4FF" }} />
        </div>
        <div>
          <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">Taxa de Inscrição</h4>
          <p className="text-sm font-bold text-white/80">{campeonato.taxa}</p>
        </div>
      </div>

      {/* Data */}
      <div className="flex items-center gap-4 py-1">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5" style={{ color: "#FF6600" }} />
        </div>
        <div>
          <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">Data</h4>
          <p className="text-sm font-bold text-white/80">{campeonato.data}</p>
        </div>
      </div>

      {/* Tier */}
      <div className="flex items-center gap-4 py-1">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Diamond size={18} color="#00FFD4" />
        </div>
        <div>
          <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
            {(campeonato.tier || "").toLowerCase().includes("ponto") ? "Limite de Pontos" : "Tier"}
          </h4>
          <p className="text-sm font-bold text-white/80">{campeonato.tier || "Free Elo"}</p>
        </div>
      </div>

      {/* Vagas */}
      <div className="flex items-center gap-4 py-1">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5" style={{ color: "#BF00FF" }} />
        </div>
        <div>
          <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">Vagas / Times</h4>
          <p className="text-sm font-bold text-white/80">
            {(campeonato.timesInscritos || []).filter((t: any) => t.status === "approved" || !t.status).length} / {campeonato.vagas}
          </p>
        </div>
      </div>
    </>
  );

  const blocoResponsavel = (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full aspect-square rounded-2xl overflow-hidden mb-4 relative bg-[#0c0c10] border border-white/10 flex items-center justify-center">
        {campeonato.orgPhotoUrl ? (
          <img src={campeonato.orgPhotoUrl} loading="lazy" alt="Logo Org" className="w-full h-full object-cover" />
        ) : (
          <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400" loading="lazy" alt="Logo Default" className="w-full h-full object-cover opacity-50" />
        )}
      </div>
      <div className="flex flex-col items-center text-center">
        <p className="text-lg font-black text-white uppercase tracking-widest leading-tight mb-2">{campeonato.org}</p>
        <div className="flex items-center gap-2 py-1.5 px-3 bg-white/5 border border-white/10 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#00FF41" }} />
          <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Organizador Oficial</span>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full"
    >
      {/* O START TOURNAMENT BANNER FOI REMOVIDO PARA PRODUÇÃO */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* COLUNA PRINCIPAL — CLASSIFICAÇÃO */}
        <div className="lg:col-span-2">
          <div className="w-full rounded-2xl border border-white/10 bg-[#08080a] p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-2xl">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6" style={{ color: theme }} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-widest leading-none">Classificação</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-1" style={{ color: theme }}>
                  Ranking geral do campeonato
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {(campeonato.classificacao || []).map((time: any, i: number) => {
                const Icon = getIcon(time.icone);
                return (
                  <div
                    key={i}
                    className={`w-full p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:scale-[1.005] ${
                      i < 4 ? "bg-[#0b0b10] border-white/15" : "bg-[#08080a] border-white/5 hover:bg-[#0c0c10]"
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
                      <div className="w-8 text-center font-black text-2xl shrink-0" style={{ color: i < 4 ? theme : "rgba(255,255,255,0.4)" }}>
                        {time.rank}º
                      </div>
                      <div
                        className="w-14 h-14 rounded-xl border flex items-center justify-center shrink-0 shadow-xl overflow-hidden bg-black"
                        style={{ borderColor: `${time.cor || "#FFB700"}80` }}
                      >
                        {time.logo ? (
                          <img src={time.logo} loading="lazy" alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Icon className="w-7 h-7" style={{ color: time.cor || "#FFB700" }} />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-white font-black text-lg sm:text-xl tracking-tight leading-tight truncate uppercase">{time.nome}</h3>
                          <span
                            className="inline-block text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-md tracking-widest shrink-0"
                            style={{ color: time.cor || "#FFB700", background: `${time.cor}18`, border: `1px solid ${time.cor}40` }}
                          >
                            #{time.tag}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 md:gap-6 min-w-[220px]">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-wider">V</span>
                        <span className="text-2xl font-black" style={{ color: "#00FF41" }}>{time.v}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-wider">D</span>
                        <span className="text-2xl font-black" style={{ color: "#FF3131" }}>{time.d}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-wider">J</span>
                        <span className="text-2xl font-black" style={{ color: theme }}>{time.j}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUNA LATERAL — INFORMAÇÕES → RESPONSÁVEL → INSCRIÇÃO */}
        <div className="space-y-6">
          {/* Informações */}
          <div className="w-full rounded-2xl border border-white/10 bg-[#08080a] p-6 space-y-5 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5 pb-4 text-center">Informações</h3>
            <div className="space-y-4">{blocoInfo}</div>
          </div>

          {/* Responsável */}
          <div className="w-full rounded-2xl border border-white/10 bg-[#08080a] p-6 space-y-4 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5 pb-4 text-center">Responsável</h3>
            {blocoResponsavel}
          </div>

          {/* Regulamento (mobile) */}
          <button
            onClick={setAbrirRegulamento}
            className="md:hidden w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-white/60" />
            <span>Regulamento Oficial</span>
          </button>

          {/* Inscrição */}
          {!ehEspectador && (
            <div className="space-y-4">
              {isRegistrado ? (
                <div
                  className="w-full py-4.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 bg-[#00FF41]/10 border border-[#00FF41]/30"
                  style={{ color: "#00FF41", boxShadow: "0 0 30px -5px rgba(0,255,65,0.2)" }}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Time Inscrito</span>
                </div>
              ) : campeonato.status === "abertas" || campeonato.status === "inscricoes_abertas" ? (
                <button
                  onClick={setAbrirInscricao}
                  className="w-full py-4.5 rounded-xl text-black font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                  style={{ backgroundColor: theme, boxShadow: `0 0 40px -5px ${theme}66` }}
                >
                  <Trophy className="w-4 h-4" />
                  <span>Garantir Vaga Agora</span>
                </button>
              ) : (
                <div className="w-full py-4.5 rounded-xl bg-white/5 border border-white/10 text-white/30 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 cursor-not-allowed">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    {campeonato.status === "breve" || campeonato.status === "inscricoes_em_breve"
                      ? "Inscrições em Breve"
                      : "Inscrições Encerradas"}
                  </span>
                </div>
              )}
              <p className="text-[9px] text-white/30 text-center uppercase font-bold px-4 leading-relaxed tracking-wider">
                {isRegistrado
                  ? "Sua inscrição está sendo processada pela organização. Acompanhe pelo seu perfil."
                  : "Vagas confirmadas pela organização. Sem custo surpresa: você vê a taxa antes de confirmar."}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
