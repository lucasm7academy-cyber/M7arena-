import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import DepositTab from './DepositTab';
import SaqueTab from './SaqueTab';
import { CUT_FRAME, CUT_INNER, CUT_BUTTON, CUT_BADGE } from '../../partidas/ModaisElegibilidade';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Aba = 'deposito' | 'saque';

const TITULO: Record<Aba, { badge: string; title: string; desc: string }> = {
  deposito: {
    badge: 'Recarga Instantânea via PIX',
    title: 'DEPOSITAR M7 COINS',
    desc: 'Escolha um pacote e seus MCs caem na hora. Quanto maior o pacote, maior o bônus.',
  },
  saque: {
    badge: 'Saque via PIX',
    title: 'SACAR M7 COINS',
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
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-hidden"
          onClick={handleClose}
        >
          {/* Luz ambiente suave */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
            <div className="absolute top-1/3 left-1/3 w-[450px] h-[450px] bg-[#FFB700]/20 blur-[120px] rounded-full" />
          </div>

          <motion.div
            key="deposit-modal-content"
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="relative p-[1.5px] w-full max-w-4xl mx-auto shadow-2xl transition-all"
            style={{
              clipPath: CUT_FRAME,
              background: 'linear-gradient(135deg, #FFB700 0%, #FFB70088 60%, color-mix(in srgb, #FFB700 30%, #000000) 100%)',
              boxShadow: '0 0 50px -10px rgba(255,183,0,0.45), 0 25px 70px rgba(0,0,0,0.95)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full bg-[#09090c] p-6 md:p-8 relative overflow-hidden"
              style={{ clipPath: CUT_INNER }}
            >
              {/* Personagem Twisted Fate na Lateral Direita */}
              <motion.img
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                src="/images/25947-5-twisted-fate-picture_800x800.webp"
                alt="Twisted Fate"
                className="absolute -right-[300px] lg:-right-[380px] bottom-0 w-[680px] lg:w-[820px] max-w-none z-0 pointer-events-none drop-shadow-[0_25px_60px_rgba(0,0,0,0.95)] filter brightness-105 opacity-90 hidden md:block select-none"
                referrerPolicy="no-referrer"
              />

              <div className="relative z-10">
                {/* Botão fechar estilo botão cortado */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={handleClose}
                  className="absolute top-0 right-0 p-[1px] bg-white/10 hover:bg-white/20 transition-colors z-20 cursor-pointer"
                  style={{ clipPath: CUT_BUTTON }}
                  title="Fechar"
                  aria-label="Fechar"
                >
                  <div
                    className="w-8 h-8 bg-[#141418] hover:bg-[#202028] flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
                    style={{ clipPath: CUT_BUTTON }}
                  >
                    <X size={16} />
                  </div>
                </motion.button>

                <div className="mb-6 pr-10">
                  <div className="mb-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black"
                      style={{ clipPath: CUT_BADGE, background: '#FFB700' }}
                    >
                      <Zap className="w-3 h-3 text-black" fill="currentColor" />
                      {info.badge}
                    </span>
                  </div>

                  <h2
                    className="text-2xl md:text-3xl uppercase tracking-tight text-[#EDEDEE] flex items-center gap-2 select-none"
                    style={{
                      fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                      textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                    }}
                  >
                    <span>{info.title.split('M7 COINS')[0]}</span>
                    <span className="text-[#FFB700]">M7 COINS</span>
                  </h2>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed max-w-md">{info.desc}</p>
                </div>

                {/* Toggle Depósito | Saque */}
                <div className="flex gap-2 mb-6 max-w-xs">
                  {(['deposito', 'saque'] as Aba[]).map((a) => (
                    <motion.button
                      key={a}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setAba(a)}
                      className="flex-1 relative p-[1px] cursor-pointer transition-all"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: aba === a ? 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)' : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <div
                        className={`w-full py-2.5 px-4 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-colors ${
                          aba === a
                            ? 'bg-[#FFB700] text-black'
                            : 'bg-[#121216] text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        {a === 'deposito' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                        <span>{a === 'deposito' ? 'Depósito' : 'Saque'}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {aba === 'deposito' ? <DepositTab onClose={handleClose} /> : <SaqueTab />}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
