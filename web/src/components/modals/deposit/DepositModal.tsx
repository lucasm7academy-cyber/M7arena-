import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader, CheckCircle2, Copy, Zap } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

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
  const { user } = useAuth(); // ✅ Única fonte do usuário
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [verifying, setVerifying] = useState(false);

  // ⚡ OTIMIZAÇÃO: Sem polling automático (antes era setInterval 5s).
  // Verificação única ao abrir + botão "Já paguei — verificar agora" on-demand.
  const checkPayment = async (silent = false) => {
    if (!paymentData?.orderId) return;
    if (!silent) setVerifying(true);
    try {
      const { data, error } = await supabase
        .from('pagamentos')
        .select('status')
        .eq('cakto_order_id', paymentData.orderId)
        .maybeSingle();

      if (!error && data?.status === 'aprovado') {
        toast.success('Pagamento aprovado! MCs creditados.');
        handleClose();
      } else if (!silent) {
        toast('Pagamento ainda não confirmado. Aguarde alguns instantes e tente novamente.');
      }
    } catch (err) {
      if (!silent) toast.error('Erro ao verificar pagamento.');
    } finally {
      if (!silent) setVerifying(false);
    }
  };

  useEffect(() => {
    if (paymentData?.orderId) {
      // Verificação única ao abrir o QR (caso já tenha pago em outra aba)
      checkPayment(true);
    }
  }, [paymentData?.orderId]);

  const handleSelectPackage = (pkg: PackageOption) => {
    setSelectedPackage(pkg);
  };

  const handleBuyClick = async () => {
    if (!selectedPackage) return;
    if (!user) {
      toast.error('Você precisa estar logado para comprar MCs');
      return;
    }

    setLoading(true);
    console.log('[DepositModal] Iniciando pagamento...', {
      userId: user.id,
      productId: selectedPackage.productId,
      amount: selectedPackage.priceInReais,
      mcs: selectedPackage.mcs,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Depois da ADR-011 o login não passa mais pelo GoTrue, então esta
        // sessão do Supabase é sempre nula — o pagamento fica indisponível até
        // create-mercado-pago-order virar rota da API própria (ver sec.pix).
        // A mensagem antiga dizia "sessão expirada" e mandava relogar, o que
        // manda o usuário para um loop que não resolve nada.
        console.error('[DepositModal] Pagamento indisponível: edge function ainda não migrada (sec.pix)');
        toast.error('Pagamentos temporariamente indisponíveis. Tente novamente mais tarde.');
        setLoading(false);
        return;
      }

      const token = session.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bfsusctegzvfrlehhink.supabase.co';

      console.log('[DepositModal] Chamando edge function...', { supabaseUrl });

      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-mercado-pago-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: selectedPackage.productId,
            amount: selectedPackage.priceInReais,
            mcs: selectedPackage.mcs,
          }),
        }
      );

      console.log('[DepositModal] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[DepositModal] Erro na response:', errorData);
        toast.error(errorData.error || 'Erro ao criar pagamento. Tente novamente.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('[DepositModal] Dados recebidos:', {
        success: data.success,
        orderId: data.orderId,
        hasQrCode: !!data.qrCode,
        hasBrCode: !!data.brCode,
        hasPaymentUrl: !!data.paymentUrl,
        qrCodeLength: data.qrCode?.length || 0,
      });

      if (data.method === 'pix' && !data.qrCode) {
        console.error('[DepositModal] PIX retornou sem QR Code!');
        toast.error('Erro: QR Code não foi gerado. Tente novamente.');
        setLoading(false);
        return;
      }

      setPaymentData(data);
      toast.success('QR Code gerado com sucesso!');
    } catch (error) {
      console.error('[DepositModal] Erro inesperado:', error);
      toast.error('Erro inesperado. Tente novamente.');
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
            className="relative w-full max-w-4xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 rounded-3xl bg-[#111111]/40 border border-white/[0.08] backdrop-blur-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-[120px] bg-gradient-to-b from-[#E6A600]/10 to-transparent pointer-events-none" />
            </div>

            <motion.img 
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              src="/images/25947-5-twisted-fate-picture_800x800.png"
              alt="Twisted Fate"
              className="absolute -right-[400px] bottom-0 w-[900px] z-0 pointer-events-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] filter brightness-110"
              referrerPolicy="no-referrer"
            />

            <div className="relative p-6 md:p-10 z-10 max-h-[92vh] overflow-y-auto">
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
                  className="text-3xl md:text-4xl font-black uppercase tracking-[-0.04em] text-white"
                >
                  Depositar <span className="text-[#E6A600]">M7 COINS</span>
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
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 items-start">
                  <div className="space-y-4">
                    <p className="text-white/40 text-xs uppercase tracking-[0.2em] font-semibold">
                      Escolha o pacote
                    </p>
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      {PACKAGES.map((pkg, idx) => (
                        <motion.button
                          key={pkg.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          onClick={() => handleSelectPackage(pkg)}
                          className={`relative group p-4 md:p-5 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${
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
                              <GoldEssenceIcon size={22} className={selectedPackage?.id === pkg.id ? 'opacity-100' : 'opacity-60'} />
                              <div className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none">
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
                  </div>

                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-5 md:p-6 space-y-4 lg:sticky lg:top-0"
                  >
                    <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Resumo do Pedido</p>

                    {selectedPackage ? (
                      <>
                        <div className="flex justify-between items-end">
                          <div className="space-y-1">
                            <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Total a Pagar</p>
                            <p className="text-3xl font-black text-[#E6A600]">R$ {selectedPackage.priceInReais.toFixed(2).replace('.', ',')}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Você Recebe</p>
                            <div className="flex items-center justify-end gap-2 text-white">
                              <GoldEssenceIcon size={20} />
                              <p className="text-xl md:text-2xl font-black">{selectedPackage.mcs.toLocaleString('pt-BR')} MCs</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-4 border-t border-white/[0.05]">
                          <div className="w-5 h-5 rounded-full bg-[#E6A600]/20 border border-[#E6A600]/40 flex items-center justify-center">
                            <CheckCircle2 size={10} className="text-[#E6A600]" />
                          </div>
                          <p className="text-[11px] text-white/30 font-medium">Liberação imediata pós-PIX • Sem taxas de serviço</p>
                        </div>

                        <motion.button
                          layout
                          onClick={handleBuyClick}
                          disabled={!selectedPackage || loading}
                          className={`relative w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-sm text-black transition-all duration-500 overflow-hidden ${
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
                          
                          {selectedPackage && !loading && (
                            <motion.div 
                              animate={{ x: ['100%', '-100%'] }}
                              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] pointer-events-none"
                            />
                          )}
                        </motion.button>
                      </>
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-white/30 text-xs font-medium">
                          Selecione um pacote para ver o resumo do pedido
                        </p>
                      </div>
                    )}
                  </motion.div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-8"
                >
                  {/* QR Code PIX real ou botão de checkout */}
                  {paymentData.method === 'pix' && paymentData.qrCode ? (
                    <>
                      <div className="flex flex-col items-center">
                        <div className="relative p-6 bg-white rounded-2xl overflow-hidden group shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                          <img
                            src={`data:image/png;base64,${paymentData.qrCode}`}
                            alt="QR Code PIX"
                            className="w-56 h-56 bg-white"
                          />
                          <div className="absolute inset-0 border-[10px] border-[#E6A600]/10 pointer-events-none" />
                        </div>

                        <div className="mt-8 text-center">
                          <h3 className="text-xl font-black text-white">Escaneie o QR Code</h3>
                          <p className="text-white/40 text-sm mt-2 max-w-[280px] mx-auto font-medium">
                            Utilize o app do seu banco para ler o QR Code e completar o pagamento.
                          </p>
                        </div>
                      </div>

                      {paymentData.brCode && (
                        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                          <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-4">Código PIX (Copia e Cola)</p>
                          <div className="relative group">
                            <div className="w-full bg-black/40 p-4 rounded-xl border border-white/[0.1] break-all text-[10px] font-mono text-[#E6A600] min-h-[60px] flex items-center">
                              {paymentData.brCode}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(paymentData.brCode);
                                toast.success('Código PIX copiado!');
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
                  ) : (
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative p-6 bg-white/[0.03] border border-[#E6A600]/30 rounded-2xl text-center max-w-sm">
                        <h3 className="text-xl font-black text-white mb-3">Pagamento via Checkout</h3>
                        <p className="text-white/40 text-sm mb-6">
                          Clique no botão abaixo para abrir a página segura do Mercado Pago. Lá você pode escolher PIX, cartão ou outro método.
                        </p>
                        <a
                          href={paymentData.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 w-full py-4 rounded-xl font-black text-sm uppercase text-black transition-all hover:scale-[1.02]"
                          style={{
                            background: 'linear-gradient(135deg, #E6A600, #FFD700)',
                            boxShadow: '0 8px 32px rgba(230,166,0,0.3)',
                          }}
                        >
                          <Zap size={18} fill="currentColor" />
                          Abrir Página de Pagamento
                        </a>
                      </div>
                    </div>
                  )}

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