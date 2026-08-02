'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function TutorialPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050506] via-black to-[#0a0b1a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-2xl w-full"
      >
        {/* Balão Principal com Poro */}
        <div className="relative mb-8">
          <div className="bg-[#1a1b23] border-4 border-primary/60 rounded-3xl p-8 md:p-12 shadow-2xl shadow-primary/30 relative">
            {/* Glow Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-3xl -z-10"></div>

            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* Poro Image */}
              <motion.div
                className="flex-shrink-0"
                animate={{
                  scale: [1, 1.15, 1, 1.15, 1, 1],
                }}
                transition={{
                  duration: 2.5,
                  times: [0, 0.1, 0.2, 0.3, 0.4, 1],
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                <img
                  src="/images/poro1.png"
                  alt="Poro"
                  className="w-32 h-32 md:w-40 md:h-40 object-contain"
                />
              </motion.div>

              {/* Text Content */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white mb-3 font-headline"
                  style={{
                    textShadow: '2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000'
                  }}
                >
                  Ei, você ainda não<br />
                  vinculou sua conta!
                </h1>
                <p className="text-white/70 text-lg mb-6">
                  Para aproveitar toda a experiência da M7 Arena e participar de partidas, você precisa vincular sua conta Riot.
                </p>

                {/* Decorative Line */}
                <div className="h-1 w-16 md:w-24 bg-gradient-to-r from-primary to-transparent mb-6 md:mb-0 mx-auto md:mx-0"></div>
              </div>
            </div>

            {/* Arrow pointing down */}
            <motion.div
              className="absolute -bottom-4 left-1/2 -translate-x-1/2"
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="w-6 h-6 bg-[#1a1b23] border-r-2 border-b-2 border-primary/60 rotate-45"></div>
            </motion.div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-4 mt-12">
          <button
            onClick={() => router.push('/vincular')}
            className="w-full bg-gradient-to-r from-primary to-[#E6A600] text-black py-4 px-6 rounded-xl font-black text-lg uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-primary/30 flex items-center justify-center gap-3 group cursor-pointer"
          >
            Vincular Conta Riot
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => router.push('/lobby')}
            className="w-full bg-white/10 text-white py-4 px-6 rounded-xl font-bold text-lg uppercase tracking-widest hover:bg-white/20 transition-all border border-white/20 cursor-pointer"
          >
            Continuar sem vincular
          </button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
          {[
            { title: 'Perfil Sincronizado', desc: 'Seus dados Riot integrados' },
            { title: 'Acesso Total', desc: 'Participe de todas as partidas' },
            { title: 'Ranqueamento', desc: 'Acompanhe sua progressão' }
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white/5 border border-primary/20 rounded-xl p-4 text-center hover:border-primary/40 hover:bg-white/10 transition-all"
            >
              <p className="text-primary font-bold text-sm uppercase tracking-wider mb-1 font-headline">{item.title}</p>
              <p className="text-white/60 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
