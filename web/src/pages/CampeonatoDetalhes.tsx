import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  RefreshCw,
  ChevronLeft,
  FileText,
  Sparkles,
  Check,
  GitBranch,
  X,
} from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER } from "../components/campeonatos/cut-edge";

import { getIcon } from "../components/campeonatos/icons";
import { formatDayOfWeek, formatFullDate, formatDate } from "../components/campeonatos/dates";
import { GroupStage } from "../components/campeonatos/GroupStage";
import { DoubleSideBracket } from "../components/campeonatos/DoubleSideBracket";
import { DoubleEliminationBracket } from "../components/campeonatos/DoubleEliminationBracket";
import { VisaoGeral } from "../components/campeonatos/VisaoGeral";
import { Grupos } from "../components/campeonatos/Grupos";
import { Cronograma } from "../components/campeonatos/Cronograma";
import { Chaves } from "../components/campeonatos/Chaves";
import { Historico } from "../components/campeonatos/Historico";
import { RegrasModal } from "../features/campeonatos/components/modals/RegrasModal";
import { BracketModal } from "../features/campeonatos/components/modals/BracketModal";
import { InscricaoModal } from "../features/campeonatos/components/modals/InscricaoModal";
import { AgendamentoModal } from "../features/campeonatos/components/modals/AgendamentoModal";
import { AdminMatchModal } from "../features/campeonatos/components/modals/AdminMatchModal";
import { CampeonatoProvider, useCampeonato } from "../features/campeonatos/CampeonatoContext";
import { INITIAL_BRACKET_DATA } from "../features/campeonatos/domain/bracket";

const CampeonatoDetalhes = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <CampeonatoProvider id={id}>
      <CampeonatoDetalhesInner navigate={navigate} />
    </CampeonatoProvider>
  );
};

const CampeonatoDetalhesInner = ({
  navigate,
}: {
  navigate: (path: string) => void;
}) => {
  const {
    id,
    campeonato,
    campeonatoLoading,
    activeTab,
    setActiveTab,
    tabs,
    isBracketModalOpen,
    setIsBracketModalOpen,
    isRegistrationModalOpen,
    setIsRegistrationModalOpen,
    isRulesModalOpen,
    setIsRulesModalOpen,
    isScheduleEditModalOpen,
    setIsScheduleEditModalOpen,
    isAdminMatchModalOpen,
    setIsAdminMatchModalOpen,
    editingMatchIndex,
    jogoStatusAtStart,
    editFormData,
    setEditFormData,
    adminMatchData,
    setAdminMatchData,
    registrationData,
    setRegistrationData,
    isRegistered,
    isAdmin,
    bracketData,
    setBracketData,
    bracketScale,
    bracketRef,
    bracketHandlers,
    modalBracketScale,
    modalBracketRef,
    modalBracketHandlers,
    bracketAvailableTeams,
    myTeams,
    expandedTeam,
    setExpandedTeam,
    role,
    user,
    handleTabClick,
    handleBracketScoreChange,
    handleUpdateSchedule,
    handleCreateAdminMatch,
    handleRegisterSubmit,
    handleUpdateThemeColor,
    handleAbrirChaveamento,
    handleDeleteMatch,
    saveToSupabase,
    saveBracketToSupabase,
    setCampeonato,
  } = useCampeonato();

  const handleAbrirRegulamento = () => {
    const raw = (campeonato?.regulamento || '').trim();
    if (!raw) {
      alert('Nenhum regulamento cadastrado para este campeonato.');
      return;
    }
    const isUrl =
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('www.') ||
      raw.includes('docs.google.com') ||
      raw.includes('drive.google.com') ||
      raw.includes('.pdf') ||
      raw.includes('/');
    if (isUrl) {
      const urlFinal = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
      window.open(urlFinal, '_blank', 'noopener,noreferrer');
    } else {
      setIsRulesModalOpen(true);
    }
  };

  if (campeonatoLoading || !campeonato) {
    return (
      <div className="min-h-screen bg-[#060608] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/40">
          <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#FFB700' }} />
          <span className="text-xs font-black uppercase tracking-widest">
            Carregando campeonato...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white font-sans overflow-x-hidden relative">
      {/* Background Decor & Depth Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute -top-[10%] left-[20%] w-[600px] h-[600px] rounded-full blur-[140px]"
          style={{ backgroundColor: `${campeonato.themeColor || '#FFB700'}0D` }}
        />
        <div className="absolute top-[35%] right-[10%] w-[500px] h-[500px] bg-[#9146FF]/5 rounded-full blur-[140px]" />
        <div className="absolute top-[65%] left-[15%] w-[550px] h-[550px] bg-[#00F0FF]/4 rounded-full blur-[150px]" />
      </div>

      {/* Bracket Modal (Full-Screen Popup) */}
      <BracketModal isOpen={isBracketModalOpen} onClose={() => setIsBracketModalOpen(false)} campeonato={campeonato} bracketData={bracketData} onScoreChange={handleBracketScoreChange} isAdmin={isAdmin} availableTeams={bracketAvailableTeams} modalBracketRef={modalBracketRef} modalBracketHandlers={modalBracketHandlers} modalBracketScale={modalBracketScale} />

      <InscricaoModal isOpen={isRegistrationModalOpen} onClose={() => setIsRegistrationModalOpen(false)} campeonato={campeonato} user={user} myTeams={myTeams} registrationData={registrationData} setRegistrationData={setRegistrationData} onSubmit={handleRegisterSubmit} />

      {/* Modal de Regulamento */}
      <RegrasModal isOpen={isRulesModalOpen} onClose={() => setIsRulesModalOpen(false)} campeonato={campeonato} />

      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6 sm:py-10 relative z-10 space-y-6 sm:space-y-8">
        {/* Top Navigation */}
        <button
          onClick={() => navigate("/campeonatos")}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 bg-[#08080a] text-white/60 hover:text-white hover:border-white/20 font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer inline-block"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform inline" />
          <span>Voltar para Campeonatos</span>
        </button>

        {/* HERO SECTION */}
        <div
          className="relative p-[2px] w-full shadow-2xl transition-all"
          style={{
            clipPath: CUT_FRAME,
            background: campeonato.themeColor || '#FFB700',
            boxShadow: `0 0 50px -10px ${campeonato.themeColor || '#FFB700'}33`
          }}
        >
          <div
            className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col justify-end min-h-[250px]"
            style={{ clipPath: CUT_FRAME_INNER }}
          >
            {/* Hero Image */}
            <div
              className="absolute inset-0 z-0 bg-cover bg-center opacity-40"
              style={{
                backgroundImage: `url(${campeonato.bannerUrl || "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2070"})`,
              }}
            />
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/60 to-transparent" />

            <div className="relative z-10 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-end md:justify-between gap-8 pt-24 pb-6 md:py-10">
              <div className="space-y-4 max-w-3xl">
                <h1 
                  className="text-2xl sm:text-4xl md:text-5xl font-normal tracking-tighter uppercase leading-[0.95] sm:leading-[0.85] text-white drop-shadow-lg"
                  style={{
                    fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                    textShadow: '0 2px 12px rgba(0,0,0,0.65), 0 0 20px rgba(0,0,0,0.4)',
                  }}
                >
                  {campeonato.titulo || campeonato.nome || campeonato.name}
                </h1>

                {campeonato.descricao && (
                  <p className="text-white/60 text-xs sm:text-sm md:text-base font-medium leading-relaxed max-w-2xl">
                    {campeonato.descricao}
                  </p>
                )}
              </div>

              <div className="hidden md:flex flex-col gap-4 w-full md:w-auto shrink-0 items-center">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleAbrirRegulamento}
                    className="relative w-14 h-14 rounded-lg border border-white/10 bg-[#0c0c10] hover:border-white/20 group transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(255,183,0,0.15)] flex items-center justify-center"
                    title="Regulamento"
                  >
                    <FileText
                      className="w-6 h-6 group-hover:scale-110 transition-transform"
                      style={{ color: campeonato.themeColor || '#FFB700' }}
                    />
                  </button>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Regulamento
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN GRID — bloco único full-width */}
        <div className="w-full space-y-8">
            {/* CONTENT TABS */}
            <div className="w-full p-1.5 bg-[#08080a] border border-white/10 rounded-lg flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex-none sm:flex-1 ${
                      isActive
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                    }`}
                    style={isActive && campeonato.themeColor ? { color: campeonato.themeColor } : undefined}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="tracking-wider whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "overview" && <VisaoGeral key="overview" campeonato={campeonato} getIcon={getIcon} isRegistrado={isRegistered} setAbrirInscricao={() => setIsRegistrationModalOpen(true)} setAbrirRegulamento={handleAbrirRegulamento} ehEspectador={role === "spectator"} />}

              {activeTab === "history" && <Historico key="history" campeonato={campeonato} expandedTeam={expandedTeam} setExpandedTeam={setExpandedTeam} />}

              {activeTab === "groups" && <Grupos campeonato={campeonato} />}

              {activeTab === "schedule" && (
                <Cronograma />
              )}

              {activeTab === "bracket" && <Chaves key="bracket" campeonato={campeonato} isAdmin={isAdmin} isBracketModalOpen={isBracketModalOpen} setIsBracketModalOpen={setIsBracketModalOpen} bracketRef={bracketRef} bracketHandlers={bracketHandlers} bracketScale={bracketScale} bracketData={bracketData} handleBracketScoreChange={handleBracketScoreChange} bracketAvailableTeams={bracketAvailableTeams} />}

              {activeTab === "admin_settings" && isAdmin && (
                <motion.div
                  key="admin_settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full space-y-8"
                >
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white">
                      ConfiguraÃ§Ãµes da Arena
                    </h2>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] mt-1">
                      Ajuste os detalhes e a identidade do seu campeonato
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Identidade Visual */}
                    <div className="w-full rounded-xl border border-white/10 bg-[#08080a] p-6 sm:p-8 space-y-6 shadow-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <Sparkles
                            className="w-6 h-6"
                            style={{ color: "#00FFD4" }}
                          />
                        </div>
                        <div>
                          <h3 className="font-black text-lg uppercase tracking-wider text-white">
                            Identidade Visual
                          </h3>
                          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
                            Defina a cor tema que será aplicada em todo o campeonato
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                          Cor Tema
                        </label>
                        <div className="flex flex-wrap gap-3">
                          {[
                            { name: "Amarelo", hex: "#FFB700" },
                            { name: "Roxo", hex: "#D500FF" },
                            { name: "Verde", hex: "#00FF41" },
                            { name: "Vermelho", hex: "#FF003C" },
                            { name: "Laranja", hex: "#FF4D00" },
                            { name: "Azul", hex: "#00FFFF" },
                          ].map((color) => (
                            <button
                              key={color.hex}
                              onClick={() => handleUpdateThemeColor(color.hex)}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                campeonato.themeColor === color.hex
                                  ? 'bg-[#0c0c10] border-white/20'
                                  : 'bg-[#08080a] border-white/5 hover:border-white/10'
                              }`}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full shadow-sm"
                                style={{ backgroundColor: color.hex }}
                              />
                              <span className="text-[10px] font-black uppercase tracking-widest text-white/70">
                                {color.name}
                              </span>
                              {campeonato.themeColor === color.hex && (
                                <Check
                                  className="w-3 h-3"
                                  style={{ color: color.hex }}
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card: Gestão do Chaveamento */}
                    <div className="w-full rounded-xl border border-white/10 bg-[#08080a] p-6 sm:p-8 space-y-6 shadow-2xl md:col-span-2">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <GitBranch className="w-6 h-6" style={{ color: campeonato.themeColor }} />
                        </div>
                        <div>
                          <h3 className="font-black text-lg uppercase tracking-wider text-white">
                            Chaveamento Eliminatório
                          </h3>
                          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
                            {campeonato.chavesSorteados
                              ? "Chaveamento manual — preencha os times e avance pela edição (lápis) de cada vaga"
                              : "Abra o chaveamento e preencha os times manualmente quando quiser"}
                          </p>
                        </div>
                        {campeonato.chavesSorteados && (
                          <span className="ml-auto text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md">
                            ✓ Gerado
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4">
                        {!campeonato.chavesSorteados ? (
                          <button
                            onClick={handleAbrirChaveamento}
                            className="px-6 py-4 font-black uppercase tracking-widest text-xs text-black flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer rounded-xl"
                            style={{
                              backgroundColor: campeonato.themeColor || '#FFB700',
                              boxShadow: `0 8px 30px ${campeonato.themeColor || '#FFB700'}44`
                            }}
                          >
                            <GitBranch className="w-4 h-4" />
                            <span>Abrir Chaveamento (Manual)</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (window.confirm("Resetar o chaveamento? Isso limpa todos os times preenchidos na chave.")) {
                                const reset = { ...campeonato, chavesSorteados: false };
                                setCampeonato(reset);
                                saveToSupabase(reset);
                                setBracketData(INITIAL_BRACKET_DATA);
                                saveBracketToSupabase(INITIAL_BRACKET_DATA);
                              }
                            }}
                            className="px-5 py-3 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 cursor-pointer rounded-xl"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Resetar Chave</span>
                          </button>
                        )}
                      </div>

                      {campeonato.chavesSorteados && (
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                          Preencha os times pela edição (lápis) de cada vaga. Defina o placar para finalizar — o vencedor não avança sozinho.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AgendamentoModal isOpen={isScheduleEditModalOpen} onClose={() => setIsScheduleEditModalOpen(false)} campeonato={campeonato} editFormData={editFormData} setEditFormData={setEditFormData} jogoStatusAtStart={jogoStatusAtStart} editingMatchIndex={editingMatchIndex} onSubmit={handleUpdateSchedule} onDelete={handleDeleteMatch} myTeams={myTeams} isAdmin={isAdmin} id={id} setCampeonato={setCampeonato} />

            <AdminMatchModal isOpen={isAdminMatchModalOpen} onClose={() => setIsAdminMatchModalOpen(false)} campeonato={campeonato} isAdmin={isAdmin} adminMatchData={adminMatchData} setAdminMatchData={setAdminMatchData} onSubmit={handleCreateAdminMatch} myTeams={myTeams} />
          </div>
      </div>
    </div>
  );
};

export default CampeonatoDetalhes;
