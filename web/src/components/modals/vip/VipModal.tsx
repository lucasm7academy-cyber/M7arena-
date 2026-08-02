'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Loader, Crown, Sparkles, Gem, Zap, Shield, 
  Trophy, TrendingUp, CheckCircle, Copy, QrCode,
  Clock, CreditCard, Lock, Star, ChevronRight
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

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
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  const checkPayment = async (silent = false) => {
    if (!paymentData?.orderId) return;
    if (!silent) setCheckingPayment(true);
    try {
      const { data, error } = await supabase
        .from('pagamentos')
        .select('status')
        .eq('cakto_order_id', paymentData.orderId)
        .maybeSingle();

      if (!error && data?.status === 'aprovado') {
        toast.success('Pagamento aprovado! VIP ativado.');
        handleClose();
      } else if (!silent) {
        toast('Pagamento ainda não confirmado. Aguarde alguns instantes e tente novamente.');
      }
    } catch (err) {
      if (!silent) toast.error('Erro ao verificar pagamento.');
    } finally {
      if (!silent) setCheckingPayment(false);
    }
  };

  useEffect(() => {
    if (paymentData?.orderId) {
      checkPayment(true);
    }
  }, [paymentData?.orderId]);

  const generatePixCode = (key: string, name: string, city: string, amount: number, txid: string) => {
    const formatField = (id: string, val: string) => {
      const len = String(val.length).padStart(2, '0');
      return id + len + val;
    };
    const merchantAccountInfo = formatField('00', 'BR.GOV.BCB.PIX') + formatField('01', key);
    const payload = [
      formatField('00', '01'),
      formatField('26', merchantAccountInfo),
      formatField('52', '0000'),
      formatField('53', '986'),
      formatField('54', Number(amount).toFixed(2)),
      formatField('58', 'BR'),
      formatField('59', name.substring(0, 25)),
      formatField('60', city.substring(0, 15)),
      formatField('62', formatField('05', txid || 'VIP')),
    ].join('');
    
    const fullPayload = payload + '6304';
    let crc = 0xFFFF;
    for (let i = 0; i < fullPayload.length; i++) {
      crc ^= fullPayload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    const crcHex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return fullPayload + crcHex;
  };

  const createFallbackPayment = () => {
    const brCode = generatePixCode(
      'lucasm7academy@gmail.com',
      'M7 ACADEMY',
      'SAO PAULO',
      9.90,
      'VIP' + Date.now().toString().slice(-6)
    );
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(brCode)}`;
    return {
      orderId: 'VIP-' + Date.now(),
      method: 'pix',
      qrCode: qrCodeUrl,
      brCode: brCode,
      paymentUrl: 'https://www.mercadolivre.com.br'
    };
  };

  const handleBuyVip = async () => {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const token = session.access_token;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bfsusctegzvfrlehhink.supabase.co';

        const response = await fetch(
          `${supabaseUrl}/functions/v1/create-vip-order`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({}),
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.method === 'pix' && data.qrCode) {
            setPaymentData(data);
            toast.success('QR Code gerado! Escaneie para ativar VIP.');
            setLoading(false);
            return;
          }
        }
      }

      // Fallback para ambiente local/demonstração
      const fallback = createFallbackPayment();
      setPaymentData(fallback);
      toast.success('QR Code PIX gerado! Escaneie para assinar VIP.');
    } catch (error) {
      const fallback = createFallbackPayment();
      setPaymentData(fallback);
      toast.success('QR Code PIX gerado! Escaneie para assinar VIP.');
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
      toast.success('Código PIX copiado!');
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
            {/* Decorative Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#FFB700]/15 rounded-full blur-[100px]" />
              <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-[#FFB700]/8 rounded-full blur-[100px]" />
              <div 
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: `linear-gradient(#FFB700 1px, transparent 1px), linear-gradient(90deg, #FFB700 1px, transparent 1px)`,
                  backgroundSize: '40px 40px'
                }}
              />
            </div>

            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFB700] to-transparent" />

            {/* Close Button */}
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
                  {/* HERO */}
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
                      Desbloqueie todos os benefícios premium e domine a M7 Academy com estilo.
                    </motion.p>
                  </div>

                  {/* BENEFITS */}
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

                  {/* PRICE + CTA */}
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
                            <span className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none">9,90</span>
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
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
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

                    <div className="flex items-center justify-center gap-3 mt-4">
                      <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-bold uppercase tracking-wider">
                        <CreditCard className="w-3 h-3" />
                        <span>PIX</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                      <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-bold uppercase tracking-wider">
                        <Lock className="w-3 h-3" />
                        <span>100% Seguro</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                      <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-bold uppercase tracking-wider">
                        <Zap className="w-3 h-3" />
                        <span>Ativação Imediata</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* PAYMENT SCREEN */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6 md:p-10"
                >
                  {/* Header */}
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
                      {paymentData.method === 'pix' && paymentData.qrCode ? (
                        <>Escaneie o <span className="text-[#FFB700]">QR Code</span></>
                      ) : (
                        <>Pagamento via <span className="text-[#FFB700]">Checkout</span></>
                      )}
                    </h3>
                    <p className="text-white/50 text-sm">
                      {paymentData.method === 'pix' && paymentData.qrCode
                        ? 'Use o app do seu banco para escanear o código'
                        : 'Clique no botão para abrir a página segura de pagamento'}
                    </p>
                  </div>

                  {paymentData.method === 'pix' && paymentData.qrCode ? (
                    <>
                      {/* QR Code */}
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex justify-center mb-6"
                      >
                        <div className="relative">
                          <div className="absolute inset-0 bg-[#FFB700]/30 blur-2xl rounded-3xl animate-pulse" />
                          <div className="relative p-5 bg-white rounded-2xl border-4 border-[#FFB700]/40 shadow-2xl">
                            <img
                              src={
                                paymentData.qrCode.startsWith('http') || paymentData.qrCode.startsWith('data:')
                                  ? paymentData.qrCode
                                  : `data:image/png;base64,${paymentData.qrCode}`
                              }
                              alt="QR Code PIX"
                              className="w-56 h-56 md:w-64 md:h-64 object-contain"
                            />
                          </div>
                        </div>
                      </motion.div>

                      {paymentData.brCode && (
                        <div className="mb-6">
                          <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] mb-2.5 text-center font-bold">
                            Ou copie o código PIX
                          </p>
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
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                  <span className="text-green-400 font-bold text-xs">Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  <span className="font-bold text-xs hidden sm:inline">Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mb-6">
                      <p className="text-white/50 text-sm mb-4 text-center">
                        Clique abaixo para abrir a página segura. Lá você escolhe PIX, cartão ou outro método.
                      </p>
                      <a
                        href={paymentData.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2.5 w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider text-black transition-all hover:scale-[1.01] active:scale-[0.98]"
                        style={{
                          background: 'linear-gradient(135deg, #FFB700 0%, #FFD700 50%, #FFB700 100%)',
                          boxShadow: '0 10px 40px -10px rgba(255, 183, 0, 0.5)',
                        }}
                      >
                        <Crown className="w-5 h-5 fill-black" strokeWidth={2.5} />
                        Abrir Página de Pagamento
                      </a>
                    </div>
                  )}

                  {/* Status */}
                  <div className="p-4 rounded-xl border border-[#FFB700]/20 bg-[#FFB700]/[0.04] mb-5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FFB700]/10 border border-[#FFB700]/30 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-[#FFB700] animate-pulse" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">Aguardando pagamento</p>
                      <p className="text-white/50 text-xs">Após pagar, clique abaixo para ativar seu VIP</p>
                    </div>
                  </div>

                  {/* Verify Button */}
                  <button
                    onClick={() => checkPayment(false)}
                    disabled={checkingPayment}
                    className="w-full py-3.5 mb-2 rounded-xl bg-[#FFB700]/10 border border-[#FFB700]/30 text-[#FFB700] hover:bg-[#FFB700]/20 hover:border-[#FFB700]/50 font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
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
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
