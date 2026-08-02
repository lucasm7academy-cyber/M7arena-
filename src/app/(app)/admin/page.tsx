'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Trophy, Coins, Search, Users, Newspaper, LayoutDashboard } from 'lucide-react';
import { usePerfil } from '@/contexts/PerfilContext';

type Aba = 'dashboard' | 'saldos' | 'ranking' | 'noticias';

export default function AdminPage() {
  const { perfil } = usePerfil();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('dashboard');

  return (
    <div className="min-h-screen text-white font-sans p-6 md:p-10 relative">
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500/20 to-transparent border border-red-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <ShieldCheck className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter italic font-headline">
                Painel <span className="text-red-500">Administrativo</span>
              </h1>
              <p className="text-white/40 text-xs mt-1">Gestão da plataforma M7Arena</p>
            </div>
          </div>

          {/* Abas */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'saldos', label: 'Saldos', icon: Coins },
              { id: 'ranking', label: 'Ranking PDL', icon: Trophy },
              { id: 'noticias', label: 'Notícias', icon: Newspaper },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = abaAtiva === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setAbaAtiva(tab.id as Aba)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider border transition-all cursor-pointer font-headline ${
                    isActive
                      ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        {abaAtiva === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl p-6 bg-white/[0.02] border border-white/10">
                <p className="text-xs text-white/40 font-black uppercase tracking-widest font-headline">Total de Usuários</p>
                <p className="text-3xl font-black text-white mt-2 font-headline">1,248</p>
              </div>
              <div className="rounded-2xl p-6 bg-white/[0.02] border border-white/10">
                <p className="text-xs text-white/40 font-black uppercase tracking-widest font-headline">Times Cadastrados</p>
                <p className="text-3xl font-black text-white mt-2 font-headline">86</p>
              </div>
              <div className="rounded-2xl p-6 bg-white/[0.02] border border-white/10">
                <p className="text-xs text-white/40 font-black uppercase tracking-widest font-headline">Partidas Finalizadas</p>
                <p className="text-3xl font-black text-white mt-2 font-headline">412</p>
              </div>
            </div>
          </motion.div>
        )}

        {abaAtiva === 'saldos' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-8 border border-white/10 bg-white/[0.02] space-y-4">
            <h3 className="text-xl font-black uppercase text-white font-headline">Ajuste de Saldos MP/MC</h3>
            <p className="text-white/40 text-sm">Pesquise o jogador pelo Nick#TAG para creditar ou debitar saldo.</p>
          </motion.div>
        )}

        {abaAtiva === 'ranking' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-8 border border-white/10 bg-white/[0.02] space-y-4">
            <h3 className="text-xl font-black uppercase text-white font-headline">Gerenciar Ranking e PDL de Times</h3>
            <p className="text-white/40 text-sm">Ajuste PDL, vitórias e derrotas manualmente por time.</p>
          </motion.div>
        )}

        {abaAtiva === 'noticias' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-8 border border-white/10 bg-white/[0.02] space-y-4">
            <h3 className="text-xl font-black uppercase text-white font-headline">Publicar Notícias e Banners</h3>
            <p className="text-white/40 text-sm">Gerencie o conteúdo exibido nos cards da página inicial.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
