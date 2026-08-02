'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Loader, Crown, Sparkles, Gem, Zap, 
  Trophy, TrendingUp, CheckCircle, Copy, QrCode,
  Clock, CreditCard, Lock, Star, ChevronRight
} from 'lucide-react';
import { usePerfil } from '@/contexts/PerfilContext';

interface VipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaymentData {
  orderId: string;
  method: string;
  qrCode: string;
  brCode: string;
  paymentUrl: string;
}

const VIP_BENEFITS = [
  { 
    icon: Sparkles, 
    title: 'Card RGB Animado', 
    description: 'Borda exclusiva que brilha e destaca seu perfil',
  },
  { 
    icon: Crown, 
    title: 'Badge VIP', 
    description: 'Selo de elite no perfil e nas salas de jogo',
  },
  { 
    icon: Trophy, 
    title: 'Prioridade em Torneios', 
    description: 'Vagas garantidas em campeonatos exclusivos',
  },
  { 
    icon: Gem, 
    title: 'Recompensas em Dobro', 
    description: 'Ganhe 2x MP Coins em todas as partidas',
  },
  { 
    icon: TrendingUp, 
    title: 'Histórico Ilimitado', 
    description: 'Acesso completo a partidas e estatísticas',
  },
  { 
    icon: Star, 
    title: 'Emblema Exclusivo', 
    description: 'Destaque-se com insígnia única na comunidade',
  },
];

export default function VipModal({ isOpen, onClose }: VipModalProps) {
  const { perfil } = usePerfil();
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  const checkPayment = async (silent = false) => {
    if (!paymentData?.orderId) return;
    if (!silent) setCheckingPayment(true);
    try {
      const res = await fetch(`/api/pagamento/${paymentData.orderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'aprovado') {
          handleClose();
        }
      }
    } finally {
      if (!silent) setCheckingPayment(false);
    }
  };

  useEffect(() => {
    if (paymentData?.orderId) {
      checkPayment(true);
    }
  }, [paymentData?.orderId]);

  const handleBuyVip = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pagamentos/vip', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPaymentData(data);
      } else {
        setPaymentData({
          orderId: `VIP-${Date.now()}`,
          method: 'pix',
          qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          brCode: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540514.905802BR5910M7 ACADEMY6009SAO PAULO62070503VIP63048E12',
          paymentUrl: '#',
        });
      }
    } catch {
      setPaymentData({
        orderId: `VIP-${Date.now()}`,
        method: 'pix',
        qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        brCode: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540514.905802BR5910M7 ACADEMY6009SAO PAULO62070503VIP63048E12',
        paymentUrl: '#',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPaymentData(null);
    setCopied(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleCopyCode = () => {
    if (paymentData?.brCode) {
      navigator.clipboard.writeText(paymentData.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-3xl bg-[#0a0a0c] border border-[#FFB700]/30 shadow-[0_0_80px_-10px_rgba(255,183,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#FFB700]/15 rounded-full blur-[100px]" />
              <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-[#FFB700]/8 rounded-full blur-[100px]" />
            </div>

            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFB700] to-transparent" />

            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/40 border border-white/10 text-white/60 hover:text-white hover:bg-black/60 hover:border-white/20 transition-all flex items-center justify-center backdrop-blur-sm"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            <div className="relative z-10 max-h-[92vh] overflow-y-auto custom-scrollbar">
              {!paymentData ? (
                <>
                  <div className="relative pt-10 pb-8 px-6 md:px-10 text-center">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                      className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-5 relative"
                    >
                      <div className="absolute inset-0 bg-[#FFB700]/20 rounded-full blur-xl animate-pulse" />
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#FFB700] via-[#FFD700] to-[#FF9500] flex items-center justify-center shadow-[0_0_30px_rgba(255,183,0,0.5)]">
                        <Crown className="w-10 h-10 text-black fill-black" strokeWidth={2.5} />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFB700]/10 border border-[#FFB700]/30 mb-4"
                    >
                      <Sparkles className="w-3 h-3 text-[#FFB700]" />
                      <span className="text-[#FFB700] font-black text-[10px] uppercase tracking-[0.2em]">Acesso Premium</span>
                    </motion.div>

                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter leading-[0.9] mb-3"
                    >
                      Torne-se <span className="text-[#FFB700]">VIP</span>
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-white/50 text-sm md:text-base max-w-md mx-auto leading-relaxed"
                    >
                      Desbloqueie todos os benefícios premium e domine a M7 Arena com estilo.
                    </motion.p>
                  </div>

                  <div className="px-6 md:px-10 pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {VIP_BENEFITS.map((benefit, idx) => {
                        const Icon = benefit.icon;
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 + idx * 0.04 }}
                            className="group relative p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#FFB700]/40 hover:bg-[#FFB700]/[0.03] transition-all duration-300"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FFB700]/20 to-[#FFB700]/5 border border-[#FFB700]/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(255,183,0,0.3)] transition-all duration-300">
                                <Icon className="w-5 h-5 text-[#FFB700]" strokeWidth={2.5} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white font-black text-sm mb-0.5">
                                  {benefit.title}
                                </h4>
                                <p className="text-white/50 text-xs leading-snug">
                                  {benefit.description}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="px-6 md:px-10 pb-8">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className="relative rounded-2xl overflow-hidden border border-[#FFB700]/40 bg-gradient-to-br from-[#FFB700]/10 via-[#FFB700]/[0.03] to-transparent p-6 mb-5"
                    >
                      <div className="absolute top-0 right-0 bg-[#FFB700] text-black px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-bl-xl">
                        Melhor Oferta
                      </div>
                      <div className="flex items-end justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-white/50 text-[10px] uppercase tracking-[0.2em] mb-2 font-bold">Plano Mensal</p>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs text-white/50 font-bold">R$</span>
                            <span className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none">14,90</span>
                            <span className="text-white/50 text-sm font-bold mb-1">/mês</span>
                          </div>
                          <p className="text-white/40 text-[11px] mt-2">Cancele quando quiser • Sem fidelidade</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-1.5 text-green-400 text-xs font-bold">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Acesso Imediato</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-white/50 text-xs font-bold">
                            <Lock className="w-3 h-3" />
                            <span>Pagamento Seguro</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.65 }}
                      onClick={handleBuyVip}
                      disabled={loading}
                      whileHover={{ scale: loading ? 1 : 1.01 }}
                      whileTap={{ scale: loading ? 1 : 0.98 }}
                      className="relative w-full py-4 rounded-xl font-black text-sm md:text-base uppercase tracking-wider text-black transition-all disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2.5 overflow-hidden group"
                      style={{
                        background: 'linear-gradient(135deg, #FFB700 0%, #FFD700 50%, #FFB700 100%)',
                        boxShadow: '0 10px 40px -10px rgba(255, 183, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.3)',
                      }}
                    >
                      {loading ? (
                        <>
                          <Loader size={18} className="animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <Crown className="w-5 h-5 fill-black" strokeWidth={2.5} />
                          <span>Assinar VIP Agora</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </motion.button>
                  </div>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6 md:p-10"
                >
                  <div className="text-center mb-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 12 }}
                      className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 mb-4"
                    >
                      <QrCode className="w-8 h-8 text-green-400" strokeWidth={2.5} />
                    </motion.div>
                    <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight mb-2">
                      Escaneie o <span className="text-[#FFB700]">QR Code</span>
                    </h3>
                  </div>

                  {paymentData.method === 'pix' && paymentData.qrCode && (
                    <>
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex justify-center mb-6"
                      >
                        <div className="relative p-5 bg-white rounded-2xl border-4 border-[#FFB700]/40 shadow-2xl">
                          <img
                            src={paymentData.qrCode.startsWith('data:') ? paymentData.qrCode : `data:image/png;base64,${paymentData.qrCode}`}
                            alt="QR Code PIX"
                            className="w-56 h-56 md:w-64 md:h-64 object-contain"
                          />
                        </div>
                      </motion.div>

                      {paymentData.brCode && (
                        <div className="mb-6">
                          <div className="flex items-stretch gap-2">
                            <div className="flex-1 p-3 rounded-xl border border-white/10 bg-black/40 text-left min-w-0">
                              <code className="text-white/60 text-xs font-mono break-all line-clamp-2 block">
                                {paymentData.brCode.substring(0, 60)}...
                              </code>
                            </div>
                            <button
                              onClick={handleCopyCode}
                              className="px-4 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2 flex-shrink-0"
                            >
                              {copied ? (
                                <span className="text-green-400 font-bold text-xs">Copiado!</span>
                              ) : (
                                <span className="font-bold text-xs">Copiar</span>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex flex-col items-center gap-4">
                    <button
                      onClick={() => checkPayment(false)}
                      disabled={checkingPayment}
                      className="w-full max-w-sm flex items-center justify-center gap-2 py-4 bg-[#FFB700]/10 border border-[#FFB700]/30 text-[#FFB700] hover:bg-[#FFB700]/20 font-black text-sm uppercase tracking-widest rounded-2xl transition-all disabled:opacity-50"
                    >
                      {checkingPayment ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Já paguei — verificar agora
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleClose}
                      className="w-full py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white/50 hover:text-white hover:bg-white/5 font-bold text-xs uppercase tracking-wider transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
