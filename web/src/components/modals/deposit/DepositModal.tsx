import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import DepositTab from './DepositTab';
import SaqueTab from './SaqueTab';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Aba = 'deposito' | 'saque';

const TITULO: Record<Aba, { badge: string; title: string; desc: string }> = {
  deposito: {
    badge: 'Recarga Instantânea via PIX',
    title: 'Depositar M7 COINS',
    desc: 'Escolha um pacote e seus MCs caem na hora. Quanto maior o pacote, maior o bônus.',
  },
  saque: {
    badge: 'Saque via PIX',
    title: 'Sacar M7 COINS',
    desc: 'Converta seus MC em reais e receba na sua chave PIX. 100 MC = R$1,00.',
  },
};

export default function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [aba, setAba] = useState<Aba>('deposito');

  const handleClose = () => {
    setAba('deposito');
    onClose();
  };

  const info = TITULO[aba];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="deposit-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={handleClose}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
            <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-[#FFD700]/20 blur-[120px] rounded-full animate-pulse" />
          </div>

          <motion.div
            key="deposit-modal-content"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="relative w-full max-w-4xl mx-auto rounded-3xl bg-[#0a0a0d]/95 border border-white/10 backdrop-blur-xl shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFD700] to-transparent rounded-t-3xl" />

            <motion.img
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              src="/images/25947-5-twisted-fate-picture_800x800.webp"
              alt="Twisted Fate"
              className="absolute -right-[240px] bottom-0 w-[640px] max-w-none z-0 pointer-events-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.9)] filter brightness-105 opacity-85 hidden md:block"
              referrerPolicy="no-referrer"
            />

            <div className="relative p-6 md:p-8 z-10">
              <button
                onClick={handleClose}
                className="absolute top-6 right-6 z-20 w-9 h-9 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/15 transition-all flex items-center justify-center backdrop-blur-sm"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>

              <div className="mb-7">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 mb-3">
                  <Zap className="w-3 h-3 text-[#FFD700]" fill="currentColor" />
                  <span className="text-[#FFD700] font-black text-[10px] uppercase tracking-widest">{info.badge}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                  {info.title.split('M7 COINS')[0]}
                  <span className="text-[#FFD700]">M7 COINS</span>
                </h2>
                <p className="text-white/45 text-sm mt-1.5 leading-relaxed max-w-md">{info.desc}</p>
              </div>

              {/* Toggle Depósito | Saque (Depósito padrão) */}
              <div className="flex gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/5 mb-6 max-w-xs">
                {(['deposito', 'saque'] as Aba[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAba(a)}
                    className={`flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                      aba === a ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {a === 'deposito' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                    {a === 'deposito' ? 'Depósito' : 'Saque'}
                  </button>
                ))}
              </div>

              {aba === 'deposito' ? <DepositTab onClose={handleClose} /> : <SaqueTab />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
