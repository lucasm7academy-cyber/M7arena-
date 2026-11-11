import React from 'react';
import { motion } from 'motion/react';
import { Settings2, X, Layout, Check, Upload, Image as ImageIcon, Users, Diamond, Save } from 'lucide-react';

interface FormularioConfiguracoes {
  titulo: string;
  frase: string;
  formato: 'liga' | 'mata_mata';
  vagas: number;
  timesPorGrupo: number;
  classificadosPorGrupo: number;
  tier: string;
  premiacao: string;
  taxa: string;
  data: string;
  temOutrosPremios: boolean;
  outrosPremios: string;
  logoUrl: string;
  bannerUrl: string;
  orgPhotoUrl: string;
  organizacao: string;
  regulamento: string;
  themeColor: string;
}

interface CampeonatoConfiguravel {
  id: string;
  tier: string;
  status: 'inscricoes_em_breve' | 'inscricoes_abertas' | 'em_andamento' | 'finalizado';
}

interface ConfiguracoesCampeonatoModalProps<T extends CampeonatoConfiguravel> {
  formData: FormularioConfiguracoes;
  setFormData: React.Dispatch<React.SetStateAction<FormularioConfiguracoes>>;
  selectedTournament: T;
  setSelectedTournament: React.Dispatch<React.SetStateAction<T | null>>;
  setIsEditModalOpen: (open: boolean) => void;
  orgInputRef: React.RefObject<HTMLInputElement | null>;
  bannerInputRef: React.RefObject<HTMLInputElement | null>;
  orgPhotoInputRef: React.RefObject<HTMLInputElement | null>;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleStatusChange: (id: string, status: CampeonatoConfiguravel['status']) => void;
  handleDeleteTournament: (id: string) => void;
  handleSaveEdit: (event: React.FormEvent) => void;
}

export function ConfiguracoesCampeonatoModal<T extends CampeonatoConfiguravel>({
  formData, setFormData, selectedTournament, setSelectedTournament,
  setIsEditModalOpen, orgInputRef, bannerInputRef, orgPhotoInputRef,
  handleInputChange, handleStatusChange, handleDeleteTournament, handleSaveEdit,
}: ConfiguracoesCampeonatoModalProps<T>) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => setIsEditModalOpen(false)}
      />

      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 md:p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-600/20 text-xl font-black">
              <Settings2 className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight">Configurações</h3>
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Ajuste os parâmetros</p>
            </div>
          </div>
          <button
            onClick={() => setIsEditModalOpen(false)}
            className="p-2 md:p-3 hover:bg-slate-200 rounded-xl md:rounded-2xl text-slate-400 transition-colors"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-10 custom-scrollbar text-slate-800">
          {/* Identidade Grid */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Layout className="w-4 h-4 text-teal-600" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identidade Visual</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
                <input name="titulo" value={formData.titulo} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:border-teal-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Slogan</label>
                <input name="frase" value={formData.frase} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:border-teal-500 outline-none font-bold text-sm" />
              </div>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor Tema</label>
               <div className="flex flex-wrap gap-2 items-center">
                 {[
                   { name: 'Amarelo', hex: '#FFB700' },
                   { name: 'Roxo', hex: '#D500FF' },
                   { name: 'Verde', hex: '#00FF41' },
                   { name: 'Vermelho', hex: '#FF003C' },
                   { name: 'Laranja', hex: '#FF4D00' },
                   { name: 'Azul', hex: '#00FFFF' },
                 ].map(color => (
                   <button
                     key={color.hex}
                     type="button"
                     onClick={() => setFormData(prev => ({ ...prev, themeColor: color.hex }))}
                     className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                       formData.themeColor === color.hex
                         ? 'border-teal-500 scale-110 shadow-lg'
                         : 'border-white'
                     }`}
                     style={{ backgroundColor: color.hex }}
                     title={color.name}
                   >
                     {formData.themeColor === color.hex && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                   </button>
                 ))}
               </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div onClick={() => orgInputRef.current?.click()} className="group relative h-28 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-teal-400 flex flex-col items-center justify-center bg-slate-50/30">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-4 h-4 text-slate-400" />
                )}
                <div className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-[8px] font-black text-white text-center opacity-0 group-hover:opacity-100 transition-opacity">LOGO</div>
              </div>
              <div onClick={() => bannerInputRef.current?.click()} className="group relative h-28 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-teal-400 flex flex-col items-center justify-center bg-slate-50/30">
                {formData.bannerUrl ? (
                  <img src={formData.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                )}
                <div className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-[8px] font-black text-white text-center opacity-0 group-hover:opacity-100 transition-opacity">BANNER</div>
              </div>
              <div onClick={() => orgPhotoInputRef.current?.click()} className="group relative h-28 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-teal-400 flex flex-col items-center justify-center bg-slate-50/30">
                {formData.orgPhotoUrl ? (
                  <img src={formData.orgPhotoUrl} alt="Org" className="w-full h-full object-contain p-2" />
                ) : (
                  <Users className="w-4 h-4 text-slate-400" />
                )}
                <div className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-[8px] font-black text-white text-center opacity-0 group-hover:opacity-100 transition-opacity">ORG PHOTO</div>
              </div>
            </div>
          </div>

          {/* Logística Grid */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Diamond size={16} color="#0d9488" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logística e Premiação</h4>
            </div>
            <div className="space-y-4">
            {/* List-style rows for parameters */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Formato</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Estrutura do torneio</p>
              </div>
              <select name="formato" value={formData.formato} onChange={handleInputChange} className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs appearance-none cursor-pointer">
                <option value="mata_mata">Mata-Mata</option>
                <option value="liga">Liga (Grupos)</option>
              </select>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Vagas</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total de equipes</p>
              </div>
              <select name="vagas" value={formData.vagas} onChange={handleInputChange} className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs appearance-none cursor-pointer">
                <option value={4}>4 Equipes</option>
                <option value={8}>8 Equipes</option>
                <option value={16}>16 Equipes</option>
                <option value={32}>32 Equipes</option>
              </select>
            </div>

            {formData.formato === 'liga' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-teal-50/30 border border-teal-100 rounded-2xl p-4 flex flex-col justify-between gap-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Times p/ Grupo</label>
                  <select name="timesPorGrupo" value={formData.timesPorGrupo} onChange={handleInputChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs cursor-pointer">
                    <option value={3}>3 Times</option>
                    <option value={4}>4 Times</option>
                    <option value={6}>6 Times</option>
                    <option value={8}>8 Times</option>
                  </select>
                </div>
                <div className="bg-teal-50/30 border border-teal-100 rounded-2xl p-4 flex flex-col justify-between gap-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Classificados</label>
                  <select name="classificadosPorGrupo" value={formData.classificadosPorGrupo} onChange={handleInputChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs cursor-pointer">
                    <option value={1}>Top 1</option>
                    <option value={2}>Top 2</option>
                    <option value={4}>Top 4</option>
                  </select>
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Restrição / Limite de Elo</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Free Elo ou Teto de Pontos</p>
                </div>
                <input
                  type="text"
                  name="tier"
                  value={formData.tier}
                  onChange={handleInputChange}
                  placeholder="Ex: Free Elo ou 300 Pontos"
                  className="w-full sm:w-56 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs shadow-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60">
                {['Free Elo', '300 Pontos', '500 Pontos', '700 Pontos', '1000 Pontos'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, tier: preset }));
                      if (selectedTournament) {
                        setSelectedTournament(prev => prev ? { ...prev, tier: preset } : null);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      formData.tier === preset
                        ? 'bg-teal-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Data de Início</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Calendário do evento</p>
              </div>
              <input type="date" name="data" value={formData.data} onChange={handleInputChange} className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs" />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-teal-500">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Premiação Cash</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Prêmio em dinheiro</p>
              </div>
              <input name="premiacao" value={formData.premiacao} onChange={handleInputChange} className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs text-teal-600" />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Link do Regulamento</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">URL do documento / regras (abre em nova aba)</p>
              </div>
              <input
                type="url"
                name="regulamento"
                value={formData.regulamento || ''}
                onChange={handleInputChange}
                placeholder="Ex: https://docs.google.com/document/d/..."
                className="w-full sm:w-64 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:border-teal-500 outline-none font-bold text-xs shadow-sm"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Premiações Extras</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Skins, MVP, brindes...</p>
                </div>
                <div
                  onClick={() => setFormData(prev => ({ ...prev, temOutrosPremios: !prev.temOutrosPremios }))}
                  className={`w-10 h-5 rounded-full cursor-pointer transition-all relative ${formData.temOutrosPremios ? 'bg-teal-600 shadow-[0_0_10px_rgba(13,148,136,0.3)]' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${formData.temOutrosPremios ? 'left-5.5' : 'left-0.5'}`} />
                </div>
              </div>
              {formData.temOutrosPremios && (
                <textarea
                  name="outrosPremios"
                  value={formData.outrosPremios}
                  onChange={handleInputChange}
                  placeholder="Ex: Skin épica para MVP, 500 de Essência Azul para o 2º lugar..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-teal-500 font-bold text-xs h-24 resize-none shadow-sm"
                />
              )}
            </div>
          </div>

          </div>

          {/* Status Toggle Area */}
          <div className="bg-slate-50 p-5 md:p-6 rounded-[2rem] border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Status da Arena</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Estágio atual do evento</p>
            </div>
            <div className="flex bg-white p-1 rounded-xl shadow-sm gap-1 border border-slate-100 overflow-x-auto w-full sm:w-auto">
              {(['inscricoes_em_breve', 'inscricoes_abertas', 'em_andamento', 'finalizado'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleStatusChange(selectedTournament.id, st)}
                  className={`flex-1 sm:flex-none px-3 md:px-4 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    selectedTournament.status === st ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {st === 'inscricoes_em_breve' ? 'Breve' : st === 'inscricoes_abertas' ? 'Aberta' : st === 'em_andamento' ? 'Arena' : 'End'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 md:p-10 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 md:gap-6">
          <div>
            {selectedTournament.status === 'inscricoes_em_breve' && (
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  handleDeleteTournament(selectedTournament.id);
                }}
                className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 flex items-center gap-2"
              >
                <X className="w-3.5 h-3.5" /> Excluir Torneio
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 w-full sm:w-auto">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 order-2 sm:order-1"
            >
              Descartar Alterações
            </button>
            <button
              onClick={handleSaveEdit}
              className="w-full sm:w-auto bg-teal-600 text-white px-8 md:px-10 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-teal-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
