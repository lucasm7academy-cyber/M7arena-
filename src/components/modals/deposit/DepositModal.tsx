'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader, CheckCircle2, Copy, Zap } from 'lucide-react';
import { usePerfil } from '@/contexts/PerfilContext';

interface PackageOption {
  id: string;
  label: string;
  priceInReais: number;
  mcs: number;
  productId: string;
  popular?: boolean;
}

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GoldEssenceIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <g filter="url(#glow)">
      <path
        d="M16 2L22 16L16 30L10 16L16 2Z"
        fill="url(#essence_grad)"
      />
      <path d="M16 2L16 30L10 16L16 2Z" fill="white" fillOpacity="0.2" />
      <path d="M16 2L22 16L16 16L16 2Z" fill="white" fillOpacity="0.1" />
      <path d="M25 10L28 13L24 14L25 10Z" fill="#FFD700" />
      <path d="M7 20L4 23L8 24L7 20Z" fill="#E6A600" />
      <path d="M23 24L25 27L21 28L23 24Z" fill="#FFD700" opacity="0.6" />
    </g>
    <defs>
      <linearGradient id="essence_grad" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFD700" />
        <stop offset="0.5" stopColor="#E6A600" />
        <stop offset="1" stopColor="#996F00" />
      </linearGradient>
      <filter id="glow" x="0" y="0" width="32" height="32" filterUnits="userSpaceOnUse">
        <feGaussianBlur stdDeviation="1.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  </svg>
);

const PACKAGES: PackageOption[] = [
  {
    id: 'test',
    label: 'R$ 2',
    priceInReais: 2,
    mcs: 110,
    productId: 'test_product_2',
    popular: false,
  },
  {
    id: 'starter',
    label: 'R$ 10',
    priceInReais: 10,
    mcs: 550,
    productId: '4nphvqr_850185',
    popular: false,
  },
  {
    id: 'plus',
    label: 'R$ 20',
    priceInReais: 20,
    mcs: 1187,
    productId: 'prgoz44',
    popular: true,
  },
  {
    id: 'pro',
    label: 'R$ 50',
    priceInReais: 50,
    mcs: 3100,
    productId: 'etgawgo',
    popular: false,
  },
  {
    id: 'elite',
    label: 'R$ 100',
    priceInReais: 100,
    mcs: 6547,
    productId: '358aqek',
    popular: false,
  },
];

interface PaymentData {
  orderId: string;
  method: string;
  qrCode: string;
  brCode: string;
  paymentUrl: string;
}

export default function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { perfil } = usePerfil();
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [verifying, setVerifying] = useState(false);

  const checkPayment = async (silent = false) => {
    if (!paymentData?.orderId) return;
    if (!silent) setVerifying(true);
    try {
      const res = await fetch(`/api/pagamento/${paymentData.orderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'aprovado') {
          handleClose();
        }
      }
    } finally {
      if (!silent) setVerifying(false);
    }
  };

  useEffect(() => {
    if (paymentData?.orderId) {
      checkPayment(true);
    }
  }, [paymentData?.orderId]);

  const handleSelectPackage = (pkg: PackageOption) => {
    setSelectedPackage(pkg);
  };

  const handleBuyClick = async () => {
    if (!selectedPackage) return;
    setLoading(true);

    try {
      const res = await fetch('/api/pagamentos/depositar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedPackage.productId,
          amount: selectedPackage.priceInReais,
          mcs: selectedPackage.mcs,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPaymentData(data);
      } else {
        // Fallback simulado para desenvolvimento
        setPaymentData({
          orderId: `DEP-${Date.now()}`,
          method: 'pix',
          qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          brCode: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5910M7 ACADEMY6009SAO PAULO62070503***63041D3D',
          paymentUrl: '#',
        });
      }
    } catch {
      setPaymentData({
        orderId: `DEP-${Date.now()}`,
        method: 'pix',
        qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        brCode: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5910M7 ACADEMY6009SAO PAULO62070503***63041D3D',
        paymentUrl: '#',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedPackage(null);
    setPaymentData(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="deposit-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[#050505]/95 backdrop-blur-[12px]"
          onClick={handleClose}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
                x: [-20, 20, -20],
                y: [-20, 20, -20]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[#E6A600]/20 blur-[100px] rounded-full" 
            />
            <motion.div 
              animate={{ 
                scale: [1.2, 1, 1.2],
                opacity: [0.2, 0.4, 0.2],
                x: [20, -20, 20],
                y: [20, -20, 20]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-red-900/10 blur-[120px] rounded-full" 
            />
          </div>

          <motion.div
            key="deposit-modal-content"
            initial={{ scale: 0.95, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 rounded-[40px] bg-[#111111]/40 border border-white/[0.08] backdrop-blur-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-[120px] bg-gradient-to-b from-[#E6A600]/10 to-transparent pointer-events-none" />
            </div>

            <div className="relative p-10 md:p-12 z-10">
              <button
                onClick={handleClose}
                className="absolute top-8 right-8 w-10 h-10 bg-white/5 border border-white/[0.05] rounded-full text-white/40 hover:text-white transition-all flex items-center justify-center hover:bg-white/10"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>

              <div className="mb-10">
                <motion.h2 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-4xl font-black uppercase tracking-[-0.04em] text-white"
                >
                  Depositar <span className="text-[#E6A600]">MCs</span>
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-white/40 text-xs uppercase tracking-[0.2em] mt-2 font-semibold"
                >
                  M7 Coins • Transação Segura via PIX
                </motion.p>
              </div>

              {!paymentData ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    {PACKAGES.map((pkg, idx) => (
                      <motion.button
                        key={pkg.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => handleSelectPackage(pkg)}
                        className={`relative group p-6 rounded-[24px] border-2 transition-all duration-300 text-left overflow-hidden ${
                          selectedPackage?.id === pkg.id
                            ? 'border-[#E6A600] bg-[#E6A600]/10 shadow-[0_0_20px_rgba(230,166,0,0.1)]'
                            : 'border-white/[0.05] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {pkg.popular && (
                          <div className="absolute -top-1 -right-1 bg-[#E6A600] text-black text-[10px] font-black uppercase tracking-tighter px-3 py-1.5 rounded-bl-xl">
                            Especial
                          </div>
                        )}

                        <div className="relative z-10 flex flex-col gap-1">
                          <div className={`text-sm font-bold opacity-60 transition-colors duration-300 ${
                            selectedPackage?.id === pkg.id ? 'text-[#E6A600]' : 'text-white'
                          }`}>
                            {pkg.label}
                          </div>
                          <div className="flex items-center gap-2">
                            <GoldEssenceIcon size={24} className={selectedPackage?.id === pkg.id ? 'opacity-100' : 'opacity-60'} />
                            <div className="text-3xl font-black text-white tracking-tight leading-none">
                              {pkg.mcs.toLocaleString('pt-BR')} <span className="text-xs font-medium opacity-40">MCs</span>
                            </div>
                          </div>
                        </div>

                        {selectedPackage?.id === pkg.id && (
                          <motion.div 
                            layoutId="package-glow"
                            className="absolute inset-0 bg-gradient-to-tr from-[#E6A600]/20 to-transparent blur-xl pointer-events-none" 
                          />
                        )}
                      </motion.button>
                    ))}
                  </div>

                  {selectedPackage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-white/[0.03] border border-white/[0.05] rounded-[24px] p-6 space-y-4"
                    >
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Total a Pagar</p>
                          <p className="text-3xl font-black text-[#E6A600]">R$ {selectedPackage.priceInReais.toFixed(2).replace('.', ',')}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Você Recebe</p>
                          <div className="flex items-center justify-end gap-2 text-white">
                            <GoldEssenceIcon size={20} />
                            <p className="text-2xl font-black">{selectedPackage.mcs.toLocaleString('pt-BR')} MCs</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 pt-4 border-t border-white/[0.05]">
                        <div className="w-5 h-5 rounded-full bg-[#E6A600]/20 border border-[#E6A600]/40 flex items-center justify-center">
                          <CheckCircle2 size={10} className="text-[#E6A600]" />
                        </div>
                        <p className="text-[11px] text-white/30 font-medium">Liberação imediata pós-PIX • Sem taxas de serviço</p>
                      </div>
                    </motion.div>
                  )}

                  <motion.button
                    layout
                    onClick={handleBuyClick}
                    disabled={!selectedPackage || loading}
                    className={`relative w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm text-black transition-all duration-500 overflow-hidden ${
                      selectedPackage && !loading
                        ? 'bg-gradient-to-r from-[#E6A600] via-[#FFD700] to-[#E6A600] bg-[length:200%_auto] hover:bg-right shadow-[0_8px_32px_rgba(230,166,0,0.3)] cursor-pointer'
                        : 'bg-white/10 text-white/20 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-3">
                        <Loader size={18} className="animate-spin" />
                        Gerando Pagamento...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-3">
                        <Zap size={18} fill="currentColor" />
                        Confirmar Depósito
                      </span>
                    )}
                  </motion.button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-8"
                >
                  {paymentData.method === 'pix' && paymentData.qrCode ? (
                    <>
                      <div className="flex flex-col items-center">
                        <div className="relative p-6 bg-white rounded-[32px] overflow-hidden group shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                          <img
                            src={paymentData.qrCode.startsWith('data:') ? paymentData.qrCode : `data:image/png;base64,${paymentData.qrCode}`}
                            alt="QR Code PIX"
                            className="w-56 h-56 bg-white"
                          />
                        </div>

                        <div className="mt-8 text-center">
                          <h3 className="text-xl font-black text-white">Escaneie o QR Code</h3>
                          <p className="text-white/40 text-sm mt-2 max-w-[280px] mx-auto font-medium">
                            Utilize o app do seu banco para ler o QR Code e completar o pagamento.
                          </p>
                        </div>
                      </div>

                      {paymentData.brCode && (
                        <div className="bg-white/[0.03] border border-white/[0.08] rounded-[24px] p-6">
                          <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-4">Código PIX (Copia e Cola)</p>
                          <div className="relative group">
                            <div className="w-full bg-black/40 p-4 rounded-xl border border-white/[0.1] break-all text-[10px] font-mono text-[#E6A600] min-h-[60px] flex items-center">
                              {paymentData.brCode}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(paymentData.brCode);
                              }}
                              className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition-all border border-white/[0.1]"
                            >
                              <Copy size={14} />
                              Copiar Código PIX
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}

                  <div className="flex flex-col items-center gap-4">
                    <button
                      onClick={() => checkPayment(false)}
                      disabled={verifying}
                      className="w-full max-w-sm flex items-center justify-center gap-2 py-4 bg-[#E6A600]/10 border border-[#E6A600]/40 text-[#E6A600] hover:bg-[#E6A600]/20 font-black text-sm uppercase tracking-widest rounded-2xl transition-all disabled:opacity-50"
                    >
                      {verifying ? (
                        <>
                          <Loader size={14} className="animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          Já paguei — verificar agora
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleClose}
                      className="text-white/40 hover:text-white transition-all text-sm font-bold uppercase tracking-widest border-b border-transparent hover:border-white/20 pb-1"
                    >
                      Voltar ao Início
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
