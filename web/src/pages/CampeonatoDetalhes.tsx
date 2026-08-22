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
  Coins,
  CreditCard,
  Calendar,
  Diamond,
  Users,
  ShieldCheck,
  UserCheck,
  Trophy,
  AlertCircle,
} from "lucide-react";

import { CUT_FRAME, CUT_FRAME_INNER, CUT_BUTTON, CUT_BUTTON_INNER, CUT_BADGE, CUT_BADGE_INNER } from "../components/campeonatos/cut-edge";
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
    isPendingMatchesOpen,
    setIsPendingMatchesOpen,
    isAllPendingOpen,
    setIsAllPendingOpen,
    editingMatchIndex,
    setEditingMatchIndex,
    jogoStatusAtStart,
    setJogoStatusAtStart,
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
    filteredCronograma,
    myPendingMatches,
    allPendingMatches,
    role,
    user,
    getMyTeamInMatch,
    getDynamicStandings,
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
          className="group relative p-[1px] transition-all hover:scale-105 active:scale-95 cursor-pointer inline-block"
          style={{
            clipPath: CUT_BUTTON,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))',
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5 bg-[#08080a] text-white/60 group-hover:text-white font-black text-xs uppercase tracking-widest transition-colors"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Voltar para Campeonatos</span>
          </div>
        </button>

        {/* HERO SECTION */}
        <div
          className="relative p-[1.5px] w-full shadow-2xl transition-all"
          style={{
            clipPath: CUT_FRAME,
            background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, ${campeonato.themeColor || '#FFB700'}40 50%, rgba(255,255,255,0.08) 100%)`,
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
                <div className="flex items-center gap-2">
                  <div className="w-8 h-px" style={{ backgroundColor: campeonato.themeColor || '#FFB700' }} />
                  <span className="text-[10px] md:text-sm font-black uppercase tracking-[0.3em]" style={{ color: campeonato.themeColor || '#FFB700' }}>
                    CAMPEONATO OFICIAL • M7 ARENA
                  </span>
                </div>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase leading-[0.95] sm:leading-[0.85] text-white">
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
                    onClick={() => setIsRulesModalOpen(true)}
                    className="relative p-[1px] group transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(255,183,0,0.15)]"
                    style={{
                      clipPath: CUT_BUTTON,
                      background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                    }}
                    title="Regulamento"
                  >
                    <div
                      className="w-14 h-14 bg-[#0c0c10] flex items-center justify-center"
                      style={{ clipPath: CUT_BUTTON_INNER }}
                    >
                      <FileText
                        className="w-6 h-6 group-hover:scale-110 transition-transform"
                        style={{ color: campeonato.themeColor }}
                      />
                    </div>
                  </button>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Regulamento
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Dynamic Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* CONTENT TABS */}
            <div
              className="relative p-[1px] w-full"
              style={{
                clipPath: CUT_FRAME,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))'
              }}
            >
              <div
                className="w-full p-1.5 bg-[#08080a] flex items-center gap-1.5 overflow-x-auto no-scrollbar"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className="relative p-[1px] flex-none sm:flex-1 transition-all cursor-pointer"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: isActive
                          ? `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, ${campeonato.themeColor || '#FFB700'}80)`
                          : 'transparent'
                      }}
                    >
                      <div
                        className={`flex items-center justify-center gap-2 px-4 py-3 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors ${
                          isActive
                            ? 'bg-[#08080a]'
                            : 'bg-transparent text-white/40 hover:text-white/80 hover:bg-white/5'
                        }`}
                        style={{
                          clipPath: CUT_BUTTON_INNER,
                          color: isActive ? (campeonato.themeColor || '#FFB700') : undefined
                        }}
                      >
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="tracking-wider whitespace-nowrap">{tab.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "overview" && <VisaoGeral key="overview" campeonato={campeonato} getDynamicStandings={getDynamicStandings} getIcon={getIcon} />}

              {activeTab === "history" && <Historico key="history" campeonato={campeonato} getDynamicStandings={getDynamicStandings} expandedTeam={expandedTeam} setExpandedTeam={setExpandedTeam} />}

              {activeTab === "groups" && <Grupos campeonato={campeonato} />}

              {activeTab === "schedule" && (
                <Cronograma campeonato={campeonato} isAdmin={isAdmin} myPendingMatches={myPendingMatches} allPendingMatches={allPendingMatches} filteredCronograma={filteredCronograma} getMyTeamInMatch={getMyTeamInMatch} getIcon={getIcon} formatDayOfWeek={formatDayOfWeek} formatFullDate={formatFullDate} handleDeleteMatch={handleDeleteMatch} isPendingMatchesOpen={isPendingMatchesOpen} setIsPendingMatchesOpen={setIsPendingMatchesOpen} isAllPendingOpen={isAllPendingOpen} setIsAllPendingOpen={setIsAllPendingOpen} setEditingMatchIndex={setEditingMatchIndex} setJogoStatusAtStart={setJogoStatusAtStart} setEditFormData={setEditFormData} setIsScheduleEditModalOpen={setIsScheduleEditModalOpen} setAdminMatchData={setAdminMatchData} adminMatchData={adminMatchData} setIsAdminMatchModalOpen={setIsAdminMatchModalOpen} />
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
                      Configurações da Arena
                    </h2>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] mt-1">
                      Ajuste os detalhes e a identidade do seu campeonato
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Identidade Visual */}
                    <div
                      className="relative p-[1.5px] shadow-2xl transition-all"
                      style={{
                        clipPath: CUT_FRAME,
                        background: 'linear-gradient(135deg, rgba(0, 255, 212, 0.3), rgba(255,255,255,0.05) 100%)',
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-6 sm:p-8 space-y-6"
                        style={{ clipPath: CUT_FRAME_INNER }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-12 h-12 p-[1px] flex items-center justify-center shrink-0"
                            style={{
                              clipPath: CUT_BADGE,
                              background: 'linear-gradient(135deg, #00FFD4, rgba(255,255,255,0.1))'
                            }}
                          >
                            <div
                              className="w-full h-full bg-[#08080a] flex items-center justify-center"
                              style={{ clipPath: CUT_BADGE_INNER }}
                            >
                              <Sparkles
                                className="w-6 h-6"
                                style={{ color: "#00FFD4" }}
                              />
                            </div>
                          </div>
                          <div>
                            <h3 className="font-black text-lg uppercase tracking-wider text-white">
                              Identidade Visual
                            </h3>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
                              Defina a cor tema que será aplicada em todo o
                              campeonato
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
                                className="relative p-[1px] transition-all cursor-pointer hover:scale-105 active:scale-95"
                                style={{
                                  clipPath: CUT_BADGE,
                                  background: campeonato.themeColor === color.hex
                                    ? `linear-gradient(135deg, ${color.hex}, rgba(255,255,255,0.2))`
                                    : 'rgba(255, 255, 255, 0.08)'
                                }}
                              >
                                <div
                                  className={`flex items-center gap-2 px-3.5 py-2 ${
                                    campeonato.themeColor === color.hex ? 'bg-[#0c0c10]' : 'bg-[#08080a]'
                                  }`}
                                  style={{ clipPath: CUT_BADGE_INNER }}
                                >
                                  <div
                                    className="w-2.5 h-2.5 shadow-sm"
                                    style={{
                                      clipPath: CUT_BADGE,
                                      backgroundColor: color.hex,
                                    }}
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
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card: Gestão do Chaveamento */}
                    <div
                      className="relative p-[1.5px] shadow-2xl transition-all md:col-span-2"
                      style={{
                        clipPath: CUT_FRAME,
                        background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.05) 100%)`,
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-6 sm:p-8 space-y-6"
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
                              <GitBranch className="w-6 h-6" style={{ color: campeonato.themeColor }} />
                            </div>
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
                            <span
                              className="ml-auto text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20"
                              style={{ clipPath: CUT_BADGE }}
                            >
                              ✓ Gerado
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-4">
                          {!campeonato.chavesSorteados ? (
                            <button
                              onClick={handleAbrirChaveamento}
                              className="px-6 py-4 font-black uppercase tracking-widest text-xs text-black flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
                              style={{
                                clipPath: CUT_BUTTON,
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
                              className="px-5 py-3 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 cursor-pointer"
                              style={{ clipPath: CUT_BUTTON }}
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AgendamentoModal isOpen={isScheduleEditModalOpen} onClose={() => setIsScheduleEditModalOpen(false)} campeonato={campeonato} editFormData={editFormData} setEditFormData={setEditFormData} jogoStatusAtStart={jogoStatusAtStart} editingMatchIndex={editingMatchIndex} onSubmit={handleUpdateSchedule} onDelete={handleDeleteMatch} myTeams={myTeams} isAdmin={isAdmin} id={id} setCampeonato={setCampeonato} />

            <AdminMatchModal isOpen={isAdminMatchModalOpen} onClose={() => setIsAdminMatchModalOpen(false)} campeonato={campeonato} isAdmin={isAdmin} adminMatchData={adminMatchData} setAdminMatchData={setAdminMatchData} onSubmit={handleCreateAdminMatch} myTeams={myTeams} />
          </div>

          {/* Right Column: Statistics & Info */}
          <div className="space-y-6">
            <div
              className="relative p-[1.5px] shadow-2xl transition-all sticky top-10"
              style={{
                clipPath: CUT_FRAME,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))',
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-6 space-y-5"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5 pb-4 text-center">
                  Informações
                </h3>

                <div className="space-y-4">
                  {/* 1. Premiação */}
                  <div className="flex items-center gap-4 py-1">
                    <div
                      className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Coins
                          className="w-5 h-5"
                          style={{ color: campeonato.themeColor || '#FFB700' }}
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                        Premiação Total
                      </h4>
                      <p className="text-sm font-bold text-white/80">
                        {campeonato.premio}
                      </p>
                      {campeonato.temOutrosPremios && (
                        <p className="text-[9px] font-medium text-white/40 mt-1 leading-tight">
                          {campeonato.outrosPremios}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 2. Taxa */}
                  <div className="flex items-center gap-4 py-1">
                    <div
                      className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #00D4FF, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <CreditCard
                          className="w-5 h-5"
                          style={{ color: "#00D4FF" }}
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                        Taxa de Inscrição
                      </h4>
                      <p className="text-sm font-bold text-white/80">
                        {campeonato.taxa}
                      </p>
                    </div>
                  </div>

                  {/* 3. Data */}
                  <div className="flex items-center gap-4 py-1">
                    <div
                      className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #FF6600, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Calendar
                          className="w-5 h-5"
                          style={{ color: "#FF6600" }}
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                        Data
                      </h4>
                      <p className="text-sm font-bold text-white/80">
                        {formatFullDate(campeonato.data)}
                      </p>
                    </div>
                  </div>

                  {/* Tier */}
                  <div className="flex items-center gap-4 py-1">
                    <div
                      className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #00FFD4, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Diamond size={18} color="#00FFD4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                        Tier
                      </h4>
                      <p className="text-sm font-bold text-white/80">
                        {(campeonato as any).tier || "Free Elo"}
                      </p>
                    </div>
                  </div>

                  {/* 4. Vagas */}
                  <div className="flex items-center gap-4 py-1">
                    <div
                      className="w-10 h-10 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: 'linear-gradient(135deg, #BF00FF, rgba(255,255,255,0.1))'
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0c0c10] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <Users className="w-5 h-5" style={{ color: "#BF00FF" }} />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                        Vagas / Times
                      </h4>
                      <p className="text-sm font-bold text-white/80">
                        {
                          (campeonato.timesInscritos || []).filter(
                            (t: any) => t.status === "approved" || !t.status,
                          ).length
                        }{" "}
                        / {campeonato.vagas}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Organization Card */}
            <div
              className="relative p-[1.5px] shadow-2xl transition-all"
              style={{
                clipPath: CUT_FRAME,
                background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}40, rgba(255,255,255,0.03) 100%)`,
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-6 space-y-4"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5 pb-4 text-center">
                  Responsável
                </h3>

                <div className="flex flex-col items-center justify-center py-4 w-full">
                  {/* Organization Logo */}
                  <div
                    className="w-44 h-44 p-[1.5px] flex items-center justify-center mb-5 relative overflow-hidden group hover:scale-105 transition-transform"
                    style={{
                      clipPath: CUT_FRAME,
                      background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`
                    }}
                  >
                    <div
                      className="w-full h-full bg-[#0c0c10] flex items-center justify-center overflow-hidden p-3"
                      style={{ clipPath: CUT_FRAME_INNER }}
                    >
                      {campeonato.orgPhotoUrl ? (
                        <img
                          src={campeonato.orgPhotoUrl} loading="lazy"
                          alt="Logo Org"
                          className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                        />
                      ) : (
                        <img
                          src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400" loading="lazy"
                          alt="Logo Default"
                          className="w-full h-full object-cover opacity-50"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center text-center">
                    <p className="text-lg font-black text-white uppercase tracking-widest leading-tight mb-2">
                      {campeonato.org}
                    </p>
                    <div
                      className="flex items-center gap-2 py-1.5 px-3 bg-white/5 border border-white/5 opacity-60"
                      style={{ clipPath: CUT_BADGE }}
                    >
                      <ShieldCheck
                        className="w-3.5 h-3.5"
                        style={{ color: "#00FF41" }}
                      />
                      <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">
                        Organizador Oficial
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Regulamento no Mobile */}
            <button
              onClick={() => setIsRulesModalOpen(true)}
              className="md:hidden w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              style={{ clipPath: CUT_BUTTON }}
            >
              <FileText className="w-4 h-4 text-white/60" />
              <span>Regulamento Oficial</span>
            </button>

            {/* Ação de Inscrição */}
            {(role as string) !== "spectator" && (
              <div className="space-y-4">
                {isRegistered ? (
                  <div
                    className="w-full py-4.5 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 bg-[#00FF41]/10 border border-[#00FF41]/30"
                    style={{
                      clipPath: CUT_BUTTON,
                      color: "#00FF41",
                      boxShadow: '0 0 30px -5px rgba(0,255,65,0.2)'
                    }}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Time Inscrito</span>
                  </div>
                ) : campeonato.status === "abertas" ||
                  campeonato.status === "inscricoes_abertas" ? (
                  <button
                    onClick={() => setIsRegistrationModalOpen(true)}
                    className="w-full py-4.5 text-black font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      clipPath: CUT_BUTTON,
                      backgroundColor: campeonato.themeColor || '#FFB700',
                      boxShadow: `0 0 40px -5px ${campeonato.themeColor || '#FFB700'}66`,
                    }}
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Garantir Vaga Agora</span>
                  </button>
                ) : (
                  <div
                    className="w-full py-4.5 bg-white/5 border border-white/10 text-white/30 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 cursor-not-allowed"
                    style={{ clipPath: CUT_BUTTON }}
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      {campeonato.status === "breve" ||
                      campeonato.status === "inscricoes_em_breve"
                        ? "Inscrições em Breve"
                        : "Inscrições Encerradas"}
                    </span>
                  </div>
                )}
                <p className="text-[9px] text-white/30 text-center uppercase font-bold px-4 leading-relaxed tracking-wider">
                  {isRegistered
                    ? "Sua inscrição está sendo processada pela organização. Acompanhe pelo seu perfil."
                    : "Vagas confirmadas pela organização. Sem custo surpresa: você vê a taxa antes de confirmar."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampeonatoDetalhes;
