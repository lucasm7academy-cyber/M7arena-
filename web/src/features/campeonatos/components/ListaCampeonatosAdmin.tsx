import React from 'react';
import { motion } from 'motion/react';
import { Plus, X, Trophy, ChevronRight, Users, Calendar } from 'lucide-react';

interface CampeonatoDaLista {
  id: string;
  titulo: string;
  status: 'inscricoes_em_breve' | 'inscricoes_abertas' | 'em_andamento' | 'finalizado';
  logoUrl?: string;
  data: string;
  vagas: number;
  timesInscritos: readonly unknown[];
}

interface ListaCampeonatosAdminProps<T extends CampeonatoDaLista> {
  myTournaments: readonly T[];
  setActiveTab: (tab: 'create' | 'manage') => void;
  setSelectedTournament: (tournament: T) => void;
  handleDeleteTournament: (id: string) => void;
}

export function ListaCampeonatosAdmin<T extends CampeonatoDaLista>({
  myTournaments,
  setActiveTab,
  setSelectedTournament,
  handleDeleteTournament,
}: ListaCampeonatosAdminProps<T>) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {/* Plus Card */}
      <motion.div
        onClick={() => setActiveTab('create')}
        whileHover={{ scale: 1.02, y: -4 }}
        className="min-h-[280px] border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-white flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-teal-400 hover:bg-teal-50/10 transition-all group"
      >
        <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center transition-transform group-hover:scale-110">
          <Plus className="w-7 h-7" />
        </div>
        <div className="text-center">
          <span className="text-xs font-black uppercase tracking-widest text-slate-800 block mb-1">Novo Campeonato</span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Build a new arena</span>
        </div>
      </motion.div>

      {myTournaments.map(tournament => (
        <motion.div
          key={tournament.id}
          onClick={() => setSelectedTournament(tournament)}
          className="bg-white border border-slate-200 rounded-[2.5rem] cursor-pointer relative group transition-all overflow-hidden"
        >
          {/* Banner area */}
          <div className="h-40 relative bg-slate-900">
            {tournament.logoUrl ? (
              <img src={tournament.logoUrl} loading="lazy" alt="Banner" className="w-full h-full object-cover opacity-60" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 opacity-60" />
            )}

            {/* Status Tag */}
            <div className="absolute top-6 left-8 right-8 flex items-center justify-between">
              <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border backdrop-blur-md shadow-xl ${
                tournament.status === 'inscricoes_abertas' ? 'bg-teal-500/10 text-teal-500 border-teal-500/20' :
                tournament.status === 'inscricoes_em_breve' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                tournament.status === 'em_andamento' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-white border-slate-800'
              }`}>
                {tournament.status.replace('_', ' ')}
              </div>

              {tournament.status === 'inscricoes_em_breve' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Deseja realmente excluir este campeonato? Esta ação não pode ser desfeita.')) {
                      handleDeleteTournament(tournament.id);
                    }
                  }}
                  className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all backdrop-blur-md border border-red-500/20 flex items-center justify-center"
                  title="Excluir Campeonato"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Logo Overlay */}
            <div className="absolute -bottom-6 left-8">
              <div className="w-16 h-16 rounded-2xl bg-white p-1 border-4 border-white shadow-xl">
                <div className="w-full h-full rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                  {tournament.logoUrl ? (
                    <img src={tournament.logoUrl} loading="lazy" alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Trophy className="w-6 h-6 text-teal-600" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 pt-12">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-tight truncate">
                {tournament.titulo}
              </h3>
              <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-teal-600 transition-colors shrink-0" />
            </div>

            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Inscritos</span>
                <div className="flex items-center gap-2 font-black text-sm text-slate-800">
                  <Users className="w-4 h-4 text-teal-600" />
                  {tournament.timesInscritos.length}/{tournament.vagas}
                </div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Kick-off</span>
                <div className="flex items-center gap-2 font-black text-sm text-slate-800">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  {new Date(tournament.data).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
