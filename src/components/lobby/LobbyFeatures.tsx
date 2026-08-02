'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users, Shield, Target, Swords, Crown } from 'lucide-react';

const features = [
  {
    icon: Trophy,
    title: 'Torneios Diários',
    description: 'Dispute premiações em dinheiro real todos os dias na plataforma com os melhores times.',
    delay: 0.1,
  },
  {
    icon: Users,
    title: 'Ranking de Equipes',
    description: 'Suba no ranking da comunidade, acumule PDL e prove o valor do seu time na Summoner’s Rift.',
    delay: 0.2,
  },
  {
    icon: Shield,
    title: 'Ambiente Seguro & Verificado',
    description: 'Partidas com estatísticas verificadas via Riot API e suporte dedicado em tempo real.',
    delay: 0.3,
  },
];

export default function LobbyFeatures() {
  return (
    <section className="py-12 px-4 max-w-7xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter font-headline text-white">
          Por que jogar na <span className="text-[#FFB700]">M7 Arena?</span>
        </h2>
        <p className="text-white/40 text-sm md:text-base font-medium max-w-xl mx-auto">
          Tudo o que você precisa para vivenciar o cenário competitivo amador como um profissional.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((item) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: item.delay }}
            className="group relative p-8 bg-white/[0.02] border border-white/10 rounded-2xl hover:border-[#FFB700]/40 transition-all duration-500 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
              <item.icon size={120} />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="w-12 h-12 bg-[#FFB700]/10 border border-[#FFB700]/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <item.icon className="w-6 h-6 text-[#FFB700]" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white font-headline">
                {item.title}
              </h3>
              <p className="text-white/40 text-sm leading-relaxed">{item.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
