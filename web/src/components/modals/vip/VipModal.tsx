'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Loader, Crown, Sparkles, Gem, Zap, 
  Trophy, TrendingUp, CheckCircle, Copy, QrCode,
  Clock, CreditCard, Lock, Star, ChevronRight
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { CUT_FRAME, CUT_INNER, CUT_BUTTON, CUT_BADGE } from '../../partidas/ModaisElegibilidade';

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
      'M7 ARENA',
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
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 12, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="relative p-[1.5px] w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl transition-all"
            style={{
              clipPath: CUT_FRAME,
              background: 'linear-gradient(135deg, #FFB700 0%, #FFB70088 60%, color-mix(in srgb, #FFB700 30%, #000000) 100%)',
              boxShadow: '0 0 50px -10px rgba(255,183,0,0.45), 0 25px 70px rgba(0,0,0,0.95)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full bg-[#09090c] p-6 md:p-8 relative overflow-y-auto custom-scrollbar flex-1"
              style={{ clipPath: CUT_INNER }}
            >
              {/* Luz ambiente suave */}
              <div
                className="absolute -top-16 -right-16 w-52 h-52 pointer-events-none opacity-20 blur-3xl"
                style={{ background: '#FFB700' }}
              />

              {/* Botão de fechar com corte */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleClose}
                className="absolute top-4 right-4 p-[1px] bg-white/10 hover:bg-white/20 transition-colors z-20 cursor-pointer"
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

              {!paymentData ? (
                <>
                  {/* HERO */}
                  <div className="relative pt-2 pb-6 px-2 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 relative mb-3">
                      <div
                        className="relative p-[1px]"
                        style={{ clipPath: CUT_BUTTON, background: 'linear-gradient(135deg, #FFB700, #FF9500)' }}
                      >
                        <div
                          className="w-14 h-14 bg-[#FFB700] flex items-center justify-center shadow-[0_0_25px_rgba(255,183,0,0.5)]"
                          style={{ clipPath: CUT_BUTTON }}
                        >
                          <Crown className="w-8 h-8 text-black fill-black" strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>

                    <div className="mb-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black"
                        style={{ clipPath: CUT_BADGE, background: '#FFB700' }}
                      >
                        <Sparkles className="w-3 h-3 text-black" />
                        Acesso Premium M7
                      </span>
                    </div>

                    <h2
                      className="text-3xl md:text-5xl uppercase tracking-tight text-[#EDEDEE] leading-none mb-2 select-none"
                      style={{
                        fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                        textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                      }}
                    >
                      TORNE-SE <span className="text-[#FFB700]">VIP</span>
                    </h2>

                    <p className="text-zinc-400 text-xs md:text-sm max-w-md mx-auto leading-relaxed">
                      Desbloqueie todos os benefícios premium e domine a M7 Arena com estilo e vantagens exclusivas.
                    </p>
                  </div>

                  {/* BENEFITS */}
                  <div className="pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {VIP_BENEFITS.map((benefit, idx) => {
                        const Icon = benefit.icon;
                        return (
                          <div
                            key={idx}
                            className="p-3.5 bg-[#0d0d12] border border-[#FFB700]/20 flex items-start gap-3 transition-colors hover:border-[#FFB700]/50"
                            style={{ clipPath: CUT_BUTTON }}
                          >
                            <div
                              className="w-9 h-9 bg-[#16161f] border border-[#FFB700]/30 flex items-center justify-center shrink-0 text-[#FFB700]"
                              style={{ clipPath: CUT_BADGE }}
                            >
                              <Icon className="w-4 h-4 text-[#FFB700]" strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-zinc-100 font-black text-xs uppercase tracking-wide mb-0.5">
                                {benefit.title}
                              </h4>
                              <p className="text-zinc-400 text-[11px] leading-snug">
                                {benefit.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* PRICE + CTA */}
                  <div className="pb-2">
                    <div
                      className="p-5 bg-[#0d0d12] border border-[#FFB700]/30 relative mb-4"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      <div className="flex items-end justify-between gap-4 flex-wrap">
                        <div>
                          <span
                            className="inline-block px-2 py-0.5 text-[8.5px] font-black uppercase tracking-widest text-black mb-1.5"
                            style={{ clipPath: CUT_BADGE, background: '#FFB700' }}
                          >
                            Melhor Oferta
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs text-zinc-400 font-bold">R$</span>
                            <span
                              className="text-4xl md:text-5xl font-black text-[#EDEDEE] tracking-tight leading-none"
                              style={{ fontFamily: '"Anton", "Arial Narrow", Impact, sans-serif' }}
                            >
                              9,90
                            </span>
                            <span className="text-zinc-400 text-xs font-bold mb-1">/mês</span>
                          </div>
                          <p className="text-zinc-400 text-[11px] mt-1 font-bold">Cancele quando quiser • Sem fidelidade</p>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 text-xs font-bold">
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Acesso Imediato</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Pagamento Seguro</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: loading ? 1 : 1.01 }}
                      whileTap={{ scale: loading ? 1 : 0.98 }}
                      onClick={handleBuyVip}
                      disabled={loading}
                      className="w-full relative p-[1px] cursor-pointer shadow-lg disabled:opacity-50"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)',
                        boxShadow: '0 0 30px -5px rgba(255,183,0,0.5)',
                      }}
                    >
                      <div
                        className="w-full py-4 px-5 flex items-center justify-center gap-2.5 font-black text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
                        style={{ clipPath: CUT_BUTTON }}
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
                      </div>
                    </motion.button>

                    <div className="flex items-center justify-center gap-3 mt-3.5">
                      <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                        <CreditCard className="w-3 h-3" />
                        <span>PIX</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                      <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                        <Lock className="w-3 h-3" />
                        <span>100% Seguro</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-white/20" />
                      <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                        <Zap className="w-3 h-3" />
                        <span>Ativação Imediata</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* PAYMENT SCREEN */
                <div className="py-4 text-center">
                  <div className="mb-4">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black mb-2"
                      style={{ clipPath: CUT_BADGE, background: '#FFB700' }}
                    >
                      <QrCode className="w-3 h-3" />
                      Pagamento Seguro
                    </span>
                    <h3
                      className="text-2xl md:text-3xl uppercase tracking-tight text-[#EDEDEE]"
                      style={{ fontFamily: '"Anton", "Arial Narrow", Impact, sans-serif' }}
                    >
                      {paymentData.method === 'pix' && paymentData.qrCode ? 'ESCANEIE O QR CODE PIX' : 'CHECKOUT SEGURO'}
                    </h3>
                    <p className="text-zinc-400 text-xs mt-1">
                      {paymentData.method === 'pix' && paymentData.qrCode
                        ? 'Use o aplicativo do seu banco para ler o QR Code ou copie o código abaixo'
                        : 'Abra a página segura de pagamento para finalizar a assinatura'}
                    </p>
                  </div>

                  {paymentData.method === 'pix' && paymentData.qrCode ? (
                    <>
                      <div className="flex justify-center mb-5">
                        <div
                          className="p-3 bg-white border-2 border-[#FFB700] shadow-xl"
                          style={{ clipPath: CUT_BUTTON }}
                        >
                          <img
                            src={
                              paymentData.qrCode.startsWith('http') || paymentData.qrCode.startsWith('data:')
                                ? paymentData.qrCode
                                : `data:image/png;base64,${paymentData.qrCode}`
                            }
                            alt="QR Code PIX"
                            className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                          />
                        </div>
                      </div>

                      {paymentData.brCode && (
                        <div className="mb-5 max-w-lg mx-auto">
                          <div className="flex items-stretch gap-2">
                            <div
                              className="flex-1 p-3 bg-black/60 border border-white/10 text-left min-w-0"
                              style={{ clipPath: CUT_BADGE }}
                            >
                              <code className="text-zinc-300 text-xs font-mono break-all line-clamp-1 block">
                                {paymentData.brCode}
                              </code>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={handleCopyCode}
                              className="px-4 py-2 relative p-[1px] cursor-pointer"
                              style={{
                                clipPath: CUT_BUTTON,
                                background: 'linear-gradient(135deg, #FFB700, #FFE082)',
                              }}
                            >
                              <div
                                className="h-full px-3 flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-black bg-[#FFB700]"
                                style={{ clipPath: CUT_BUTTON }}
                              >
                                {copied ? (
                                  <>
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </div>
                            </motion.button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mb-5 max-w-md mx-auto">
                      <a
                        href={paymentData.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-5 font-black text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        <Crown className="w-4 h-4" />
                        <span>Abrir Página de Pagamento</span>
                      </a>
                    </div>
                  )}

                  <div
                    className="p-3.5 bg-[#0d0d12] border border-[#FFB700]/20 max-w-lg mx-auto mb-4 flex items-center gap-3 text-left"
                    style={{ clipPath: CUT_BUTTON }}
                  >
                    <div
                      className="w-8 h-8 bg-[#16161f] border border-[#FFB700]/30 flex items-center justify-center shrink-0 text-[#FFB700]"
                      style={{ clipPath: CUT_BADGE }}
                    >
                      <Clock className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-zinc-200 font-bold text-xs">Aguardando confirmação do PIX</p>
                      <p className="text-zinc-400 text-[11px]">Após o pagamento, o VIP é ativado automaticamente</p>
                    </div>
                  </div>

                  <div className="max-w-lg mx-auto flex flex-col gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => checkPayment(false)}
                      disabled={checkingPayment}
                      className="w-full relative p-[1px] cursor-pointer disabled:opacity-50"
                      style={{
                        clipPath: CUT_BUTTON,
                        background: 'linear-gradient(135deg, #FFB700, #FFE082)',
                      }}
                    >
                      <div
                        className="w-full py-3 px-4 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
                        style={{ clipPath: CUT_BUTTON }}
                      >
                        {checkingPayment ? (
                          <>
                            <Loader size={14} className="animate-spin" />
                            <span>Verificando...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Já paguei — verificar agora</span>
                          </>
                        )}
                      </div>
                    </motion.button>

                    <button
                      onClick={handleClose}
                      className="w-full py-2.5 text-zinc-400 hover:text-zinc-200 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
