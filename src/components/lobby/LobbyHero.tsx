'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export default function LobbyHero() {
  const router = useRouter();

  return (
    <section className="pt-6 pb-4 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden border border-white/10 aspect-[4/5] sm:aspect-video lg:aspect-[2.4/1] w-full flex group bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-black/20 z-10" />
          <img
            src="/images/fundoryzecortado.png"
            alt="Ryze"
            className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
          />
        </div>

        <div className="relative z-20 flex flex-col justify-end sm:justify-center px-6 sm:px-12 md:px-20 pb-8 pt-20 sm:py-10 max-w-4xl w-full h-full">
          <div className="space-y-4 md:space-y-6">
            <span className="text-[#FFB700] text-xs md:text-sm font-black uppercase tracking-[0.3em] font-headline">
              M7 Arena • Campeonatos 2026
            </span>
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-black uppercase leading-[0.9] tracking-tighter font-headline">
              Seu Time está <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40">
                preparado?
              </span>
            </h1>
            <p className="text-white/60 text-xs sm:text-sm md:text-lg font-medium max-w-xl leading-relaxed">
              Participe dos maiores torneios de elite, conquiste prêmios reais e escreva seu nome na história da M7 Arena.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
              <button
                onClick={() => router.push('/campeonatos')}
                className="px-8 py-4 bg-[#FFB700] text-black font-black text-xs uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,183,0,0.3)] cursor-pointer font-headline flex items-center justify-center gap-2 rounded-xl"
              >
                Explorar Torneios <ChevronRight size={16} />
              </button>
              <button
                onClick={() => router.push('/times')}
                className="px-8 py-4 border border-white/20 text-white font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-white/5 active:scale-95 cursor-pointer font-headline flex items-center justify-center gap-2 rounded-xl"
              >
                Crie seu Time <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
