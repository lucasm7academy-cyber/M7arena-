'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Play, Trophy, Users, Shield, Swords, Sword, Snowflake, Crown, Search, Lock, Plus } from 'lucide-react';
import { usePerfil } from '@/contexts/PerfilContext';

export default function JogarPage() {
  const router = useRouter();
  const { perfil } = usePerfil();
  const [busca, setBusca] = useState('');
  const [filtroModo, setFiltroModo] = useState('todos');

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans p-6 md:p-10 relative">
      <div className="max-w-[1400px] mx-auto space-y-10 relative z-10">
        {/* HERO BANNER */}
        <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/10 p-8 md:p-14 flex items-center justify-between min-h-[320px] shadow-2xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-[#FFB700]" />
              <span className="text-white/40 text-xs font-bold uppercase tracking-widest font-headline">LOL TEAMS</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase italic leading-none tracking-tight font-headline">
              ENTRE NA <span className="text-[#FFB700]">ARENA</span>
            </h1>
            <p className="text-base md:text-xl text-white/60 font-medium">
              Crie ou encontre salas para jogar 5v5, 1v1, ARAM e Time vs Time em partidas competitivas.
            </p>
          </div>
        </div>

        {/* CARDS DE MODO */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-[#FFB700]" />
            <h2 className="text-xl font-black text-white uppercase tracking-widest font-headline">Escolha seu Modo de Jogo</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { titulo: '5v5 CLÁSSICO', subtitulo: "Summoner's Rift", icone: Swords, cor: '#fbbf24' },
              { titulo: 'ARAM', subtitulo: 'Howling Abyss', icone: Snowflake, cor: '#3b82f6' },
              { titulo: '1v1 DUELO', subtitulo: 'Howling Abyss', icone: Sword, cor: '#ef4444' },
              { titulo: 'TIME vs TIME', subtitulo: 'Competitivo', icone: Trophy, cor: '#a855f7' },
            ].map((card, i) => {
              const Icon = card.icone;
              return (
                <button
                  key={i}
                  onClick={() => {}}
                  className="w-full bg-black rounded-xl p-6 flex flex-col items-center text-center border border-white/10 hover:border-[#FFB700]/50 transition-all cursor-pointer font-headline group"
                >
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ background: `${card.cor}15`, border: `1px solid ${card.cor}30` }}>
                    <Icon className="w-7 h-7" style={{ color: card.cor }} />
                  </div>
                  <h3 className="text-white font-black text-lg uppercase tracking-tight mb-1 group-hover:text-[#FFB700]">{card.titulo}</h3>
                  <p className="text-white/40 text-xs uppercase tracking-widest">{card.subtitulo}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* BUSCA DE SALAS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-[#FFB700]" />
              <h2 className="text-xl font-black text-white uppercase tracking-widest font-headline">Salas Disponíveis</h2>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
            <input
              type="text"
              placeholder="BUSCAR POR NOME OU CÓDIGO..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm placeholder:text-white/20 focus:outline-none uppercase font-bold"
            />
          </div>

          <div className="w-full text-center py-20 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
            <Users className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 font-black uppercase tracking-widest font-headline">Nenhuma sala aberta no momento.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
