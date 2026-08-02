'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Crown, ArrowDownLeft, Sparkles } from 'lucide-react';
import { usePerfil } from '@/contexts/PerfilContext';
import { VipCrown } from '@/components/ui/VipBadge';
import DepositModal from '@/components/modals/deposit/DepositModal';
import VipModal from '@/components/modals/vip/VipModal';

export default function CarteiraPage() {
  const { perfil } = usePerfil();
  const [valorDeposito, setValorDeposito] = useState('20');
  const [depositOpen, setDepositOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);

  const isVip = perfil?.isVip || false;
  const mp = perfil?.wallet?.mp || 0;
  const mc = perfil?.wallet?.mc || 0;

  return (
    <div className="min-h-screen text-white font-sans p-6 md:p-10 relative">
      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        {/* HEADER */}
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FFB700]/20 to-transparent border border-[#FFB700]/30 flex items-center justify-center shadow-[0_0_30px_rgba(255,183,0,0.1)]">
              <Wallet className="w-7 h-7 text-[#FFB700]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic leading-none font-headline">
                Minha <span className="text-[#FFB700]">Carteira</span>
              </h1>
              <div className="h-1 w-20 bg-gradient-to-r from-[#FFB700] to-transparent mt-2 rounded-full" />
            </div>
          </div>
          <p className="text-white/40 text-sm font-medium max-w-lg ml-[72px]">
            Gerencie seu saldo interno, realize depósitos via PIX e assine o VIP M7.
          </p>
        </div>

        {/* CARDS DE SALDO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-6 border border-yellow-500/30 relative overflow-hidden"
            style={{ background: 'rgba(13, 13, 13, 0.8)', backdropFilter: 'blur(16px)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-yellow-400 font-headline">M7 Points (MP)</span>
              <Sparkles className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-4xl font-black text-white font-headline">{mp.toLocaleString()}</p>
            <p className="text-white/30 text-xs mt-2 uppercase tracking-wider">Moeda oficial da plataforma</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-6 border border-cyan-500/30 relative overflow-hidden"
            style={{ background: 'rgba(13, 13, 13, 0.8)', backdropFilter: 'blur(16px)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400 font-headline">M7 Coins (MC)</span>
              <Crown className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-4xl font-black text-white font-headline">{mc.toLocaleString()}</p>
            <p className="text-white/30 text-xs mt-2 uppercase tracking-wider">Moeda de recompensas e torneios</p>
          </motion.div>
        </div>

        {/* ÁREA DE DEPÓSITO PIX */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-white/10 p-8 space-y-6"
          style={{ background: 'rgba(13, 13, 13, 0.8)', backdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-xl font-black uppercase text-white tracking-wider font-headline flex items-center gap-3">
              <ArrowDownLeft className="text-green-400" /> Depósito via PIX
            </h3>
            <span className="text-xs text-green-400 font-black uppercase tracking-widest bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full font-headline">
              Aprovação Instantânea
            </span>
          </div>

          <div className="space-y-4">
            <label className="text-xs text-white/40 uppercase font-black tracking-widest">Valor do Depósito (R$)</label>
            <div className="grid grid-cols-4 gap-3">
              {['10', '20', '50', '100'].map((val) => (
                <button
                  key={val}
                  onClick={() => setValorDeposito(val)}
                  className={`py-3 rounded-xl border font-black text-sm transition-all cursor-pointer font-headline ${
                    valorDeposito === val
                      ? 'bg-[#FFB700] text-black border-[#FFB700]'
                      : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                  }`}
                >
                  R$ {val}
                </button>
              ))}
            </div>

            <button
              onClick={() => setDepositOpen(true)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-black font-black uppercase text-sm tracking-widest hover:brightness-110 transition-all cursor-pointer font-headline shadow-lg shadow-green-500/20"
            >
              Gerar PIX de R$ {valorDeposito},00
            </button>
          </div>
        </motion.div>

        {/* PLANO VIP */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border-2 border-yellow-500/50 p-8 relative overflow-hidden"
          style={{ background: 'rgba(13, 13, 13, 0.9)', backdropFilter: 'blur(20px)' }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <VipCrown />
                <h3 className="text-2xl font-black text-white uppercase italic tracking-wider font-headline">
                  Assinatura <span className="text-yellow-400">VIP M7</span>
                </h3>
              </div>
              <p className="text-white/60 text-sm max-w-md">
                Acesso ilimitado ao histórico completo de partidas, borda animada no perfil, destaque nos campeonatos e suporte prioritário.
              </p>
            </div>

            <div className="shrink-0 text-center">
              <p className="text-3xl font-black text-yellow-400 font-headline">R$ 14,90 <span className="text-xs text-white/40 font-normal uppercase">/ mês</span></p>
              <button
                onClick={() => setVipOpen(true)}
                className="mt-3 px-8 py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black text-sm uppercase hover:scale-105 transition-all cursor-pointer font-headline shadow-lg shadow-yellow-500/20"
              >
                {isVip ? 'Renovar VIP' : 'Assinar VIP Agora'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} />
      <VipModal isOpen={vipOpen} onClose={() => setVipOpen(false)} />
    </div>
  );
}
