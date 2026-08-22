import React from "react";
import { motion } from "motion/react";
import { Layout, Check, Upload, Image, Users, Diamond, Settings2, Trophy, Calendar, Wallet, CreditCard, Gift } from "lucide-react";

interface FormCriarCampeonatoProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'org' | 'banner' | 'orgPhoto') => Promise<void>;
  orgInputRef: React.RefObject<HTMLInputElement>;
  bannerInputRef: React.RefObject<HTMLInputElement>;
  orgPhotoInputRef: React.RefObject<HTMLInputElement>;
}

export const FormCriarCampeonato = ({
  formData,
  setFormData,
  handleInputChange,
  handleFileChange,
  orgInputRef,
  bannerInputRef,
  orgPhotoInputRef,
}: FormCriarCampeonatoProps) => {
  return (
    <>
      {/* Seção 1: Identidade Visual */}
      <div className="space-y-8">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <Layout className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Identidade do Evento</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capas e títulos oficiais</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-800">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Campeonato</label>
            <input name="titulo" value={formData.titulo} onChange={handleInputChange} placeholder="Ex: Master League S1" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 transition-all font-bold text-base" required />
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
            <input name="frase" value={formData.frase} onChange={handleInputChange} placeholder="Ex: O maior torneio de League of Legends do cenário" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 transition-all font-bold text-base" />
          </div>

          <div className="space-y-4 md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cor Tema do Campeonato</label>
            <div className="flex flex-wrap gap-4 items-center">
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
                  className={`group flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                    formData.themeColor === color.hex
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-100 bg-slate-50 hover:border-teal-200'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: color.hex }} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{color.name}</span>
                  {formData.themeColor === color.hex && <Check className="w-3 h-3 text-teal-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Regulamento do Campeonato</label>
            <textarea
              name="regulamento"
              value={formData.regulamento}
              onChange={handleInputChange}
              placeholder="Cole aqui todas as regras, termos e condições do seu campeonato..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 transition-all font-bold text-base min-h-[150px] resize-y"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Logo Arena (Preview Card)</label>
            <div
              onClick={() => orgInputRef.current?.click()}
              className="group relative h-48 border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden cursor-pointer hover:border-teal-300 transition-all bg-slate-50/50 flex flex-col items-center justify-center"
            >
              {formData.logoUrl ? (
                <>
                  <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 text-teal-600 transition-transform group-hover:scale-110">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo Principal</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Banner Card</label>
            <div
              onClick={() => bannerInputRef.current?.click()}
              className="group relative h-48 border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden cursor-pointer hover:border-teal-300 transition-all bg-slate-50/50 flex flex-col items-center justify-center"
            >
              {formData.bannerUrl ? (
                <>
                  <img src={formData.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Image className="w-6 h-6 text-white" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 text-teal-600 transition-transform group-hover:scale-110">
                    <Image className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Imagem Banner</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 text-teal-600">Foto Org (PNG Sugerida)</label>
            <div
              onClick={() => orgPhotoInputRef.current?.click()}
              className="group relative h-48 border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden cursor-pointer hover:border-teal-300 transition-all bg-slate-50/50 flex flex-col items-center justify-center"
            >
              {formData.orgPhotoUrl ? (
                <>
                  <img src={formData.orgPhotoUrl} alt="Org" className="w-24 h-24 object-contain" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-4 text-teal-600 transition-transform group-hover:scale-110">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto Responsável</span>
                </>
              )}
            </div>
            <input
              type="text"
              name="organizacao"
              value={formData.organizacao}
              onChange={handleInputChange}
              placeholder="Nome da organização (ex: M7 Arena)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>
      </div>

      {/* Seção 2: Logística e Arena */}
      <div className="space-y-8">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <Diamond size={20} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Configuração de Arena</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parâmetros técnicos e premiações</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                <Settings2 size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Formato do Torneio</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Defina a estrutura da competição</p>
              </div>
            </div>
            <select name="formato" value={formData.formato} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm cursor-pointer shadow-sm">
              <option value="mata_mata">Mata-Mata (Eliminação Direta)</option>
              <option value="liga">Liga (Grupos + Playoffs)</option>
            </select>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                <Users size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Vagas (Equipes)</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capacidade total de times</p>
              </div>
            </div>
            <select name="vagas" value={formData.vagas} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm cursor-pointer shadow-sm">
              <option value={4}>4 Times</option>
              <option value={8}>8 Times</option>
              <option value={16}>16 Times</option>
              <option value={32}>32 Times</option>
            </select>
          </div>

          {formData.formato === 'liga' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4 pt-2"
            >
              <div className="bg-teal-50/30 border border-teal-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                    <Layout size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Equipes por Grupo</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Divisão da fase inicial</p>
                  </div>
                </div>
                <select name="timesPorGrupo" value={formData.timesPorGrupo} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm cursor-pointer shadow-sm">
                  <option value={2}>2 Equipes</option>
                  <option value={4}>4 Equipes</option>
                  <option value={8}>8 Equipes</option>
                  <option value={16}>16 Equipes</option>
                </select>
              </div>

              <div className="bg-teal-50/30 border border-teal-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Passam p/ Chaveamento</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipes classificadas p/ grupo</p>
                  </div>
                </div>
                <select name="classificadosPorGrupo" value={formData.classificadosPorGrupo} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm cursor-pointer shadow-sm">
                  <option value={1}>Top 1 (Apenas o Líder)</option>
                  <option value={2}>Top 2 (Líder e Vice)</option>
                  <option value={4}>Top 4</option>
                  <option value={8}>Top 8</option>
                </select>
              </div>
            </motion.div>
          )}

          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                <Diamond size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Tier / Categoria</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nível de habilidade exigido</p>
              </div>
            </div>
            <select name="tier" value={formData.tier} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm cursor-pointer shadow-sm">
              <option value="Free Elo">Free Elo</option>
              <option value="Tier I">Tier 1</option>
              <option value="Tier II">Tier 2</option>
              <option value="Tier III">Tier 3</option>
              <option value="Tier IV">Tier 4</option>
            </select>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                <Calendar size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Data Início</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Início das competições</p>
              </div>
            </div>
            <input type="date" name="data" value={formData.data} onChange={handleInputChange} className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm shadow-sm" />
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors border-l-4 border-l-teal-500">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                <Wallet size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Prêmio em Dinheiro</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor principal do torneio</p>
              </div>
            </div>
            <input name="premiacao" value={formData.premiacao} onChange={handleInputChange} placeholder="Ex: R$ 2.000" className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm shadow-sm" />
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                <CreditCard size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Taxa de Inscrição</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo para participar</p>
              </div>
            </div>
            <input name="taxa" value={formData.taxa} onChange={handleInputChange} placeholder="Ex: R$ 50" className="w-full md:w-64 bg-white border border-slate-200 rounded-2xl px-6 py-4 focus:outline-none focus:border-teal-500 font-bold text-sm shadow-sm" />
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-6 hover:bg-slate-100/50 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-teal-600">
                  <Gift size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Prêmios Adicionais</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Skins, MVP, Brindes...</p>
                </div>
              </div>
              <div
                onClick={() => setFormData(prev => ({ ...prev, temOutrosPremios: !prev.temOutrosPremios }))}
                className={`w-14 h-7 rounded-full cursor-pointer transition-all relative ${formData.temOutrosPremios ? 'bg-teal-600 shadow-[0_0_15px_rgba(13,148,136,0.4)]' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${formData.temOutrosPremios ? 'left-8' : 'left-1'}`} />
              </div>
            </div>
            {formData.temOutrosPremios && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <textarea
                  name="outrosPremios"
                  value={formData.outrosPremios}
                  onChange={handleInputChange}
                  placeholder="Descreva aqui os prêmios extras (Ex: Skin Lendária para o MVP, MP Coins para Top 2...)"
                  className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-6 focus:outline-none focus:border-teal-500 font-bold text-sm h-32 resize-none shadow-sm"
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};