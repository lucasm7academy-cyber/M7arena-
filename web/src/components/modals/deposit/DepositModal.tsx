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
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(
    () => PACKAGES.find((pkg) => pkg.popular) || PACKAGES[0]
  );
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

  // ⚡ Garante que o pacote Especial venha pré-selecionado sempre que o modal for aberto
  useEffect(() => {
    if (isOpen) {
      setSelectedPackage(PACKAGES.find((pkg) => pkg.popular) || PACKAGES[0]);
    }
  }, [isOpen]);

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
    setSelectedPackage(PACKAGES.find((pkg) => pkg.popular) || PACKAGES[0]);
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
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={handleClose}
        >
          {/* Fundo sutil de luzes douradas */}
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
            {/* Linha acentuada no topo */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFD700] to-transparent rounded-t-3xl" />

            {/* Imagem do Twisted Fate na lateral direita sem colidir com rolagem */}
            <motion.img 
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              src="/images/25947-5-twisted-fate-picture_800x800.png"
              alt="Twisted Fate"
              className="absolute -right-[240px] bottom-0 w-[640px] max-w-none z-0 pointer-events-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.9)] filter brightness-105 opacity-85 hidden md:block"
              referrerPolicy="no-referrer"
            />

            <div className="relative p-6 md:p-8 z-10">
              {/* Botão Fechar */}
              <button
                onClick={handleClose}
                className="absolute top-6 right-6 z-20 w-9 h-9 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/15 transition-all flex items-center justify-center backdrop-blur-sm"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>

              {/* Cabeçalho */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 mb-2">
                  <Zap className="w-3 h-3 text-[#FFD700]" fill="currentColor" />
                  <span className="text-[#FFD700] font-black text-[10px] uppercase tracking-widest">Recarga Instantânea via PIX</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                  Depositar <span className="text-[#FFD700]">M7 COINS</span>
                </h2>
              </div>

              {!paymentData ? (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-6 items-start">
                  {/* Grade dos 5 Pacotes */}
                  <div className="space-y-3">
                    <p className="text-white/50 text-xs uppercase tracking-wider font-bold">
                      Selecione o valor do depósito
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {PACKAGES.map((pkg, idx) => (
                        <motion.button
                          key={pkg.id}
                          onClick={() => handleSelectPackage(pkg)}
                          className={`relative p-4 rounded-2xl border transition-all duration-200 text-left flex flex-col justify-between gap-3 backdrop-blur-md ${
                            selectedPackage?.id === pkg.id
                              ? 'border-2 border-[#FFD700] bg-[#FFD700]/10 shadow-[0_0_20px_rgba(255,215,0,0.2)]'
                              : 'border-white/10 bg-black/40 hover:border-white/20 hover:bg-white/5'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {pkg.popular && (
                            <span className="absolute -top-2 right-3 bg-[#FFD700] text-black text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-md">
                              Especial
                            </span>
                          )}

                          <div className="text-sm font-bold text-white/70">
                            {pkg.label}
                          </div>

                          <div className="flex items-center gap-2">
                            <GoldEssenceIcon size={20} className={selectedPackage?.id === pkg.id ? 'opacity-100' : 'opacity-70'} />
                            <div className="text-xl md:text-2xl font-black text-white tracking-tight">
                              {pkg.mcs.toLocaleString('pt-BR')} <span className="text-[10px] font-medium text-white/40">MCs</span>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Resumo do Pedido Glassmorphism */}
                  <div className="bg-black/60 border border-[#FFD700]/30 rounded-2xl p-5 backdrop-blur-lg space-y-4 shadow-xl z-10">
                    <p className="text-[#FFD700] text-[10px] uppercase tracking-widest font-black">Resumo do Pedido</p>

                    {selectedPackage ? (
                      <>
                        <div className="space-y-3">
                          <div className="flex justify-between items-baseline">
                            <span className="text-white/50 text-xs font-bold uppercase">Total a Pagar</span>
                            <span className="text-2xl md:text-3xl font-black text-[#FFD700]">
                              R$ {selectedPackage.priceInReais.toFixed(2).replace('.', ',')}
                            </span>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-white/10">
                            <span className="text-white/50 text-xs font-bold uppercase">Você Recebe</span>
                            <div className="flex items-center gap-1.5 text-white">
                              <GoldEssenceIcon size={18} />
                              <span className="text-lg font-black">{selectedPackage.mcs.toLocaleString('pt-BR')} MCs</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 text-white/50 text-[10px]">
                          <CheckCircle2 size={12} className="text-[#FFD700] shrink-0" />
                          <span>Liberação imediata pós-PIX • Sem taxas</span>
                        </div>

                        <button
                          onClick={handleBuyClick}
                          disabled={!selectedPackage || loading}
                          className={`relative w-full py-3.5 rounded-xl font-black uppercase tracking-wider text-xs md:text-sm text-black transition-all duration-300 overflow-hidden ${
                            selectedPackage && !loading
                              ? 'bg-gradient-to-r from-[#E6A600] via-[#FFD700] to-[#E6A600] hover:brightness-110 shadow-[0_8px_25px_rgba(230,166,0,0.35)] cursor-pointer active:scale-95'
                              : 'bg-white/10 text-white/20 cursor-not-allowed opacity-50'
                          }`}
                        >
                          {loading ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader size={16} className="animate-spin" />
                              Processando...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <Zap size={16} fill="currentColor" />
                              Confirmar Depósito
                            </span>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="py-4 text-center">
                        <p className="text-white/30 text-xs font-medium">
                          Selecione um pacote
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Tela de QR Code PIX */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 max-w-md mx-auto py-2 text-center"
                >
                  {paymentData.method === 'pix' && paymentData.qrCode ? (
                    <>
                      <div className="flex flex-col items-center">
                        <div className="relative p-4 bg-white rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(255,215,0,0.2)]">
                          <img
                            src={`data:image/png;base64,${paymentData.qrCode}`}
                            alt="QR Code PIX"
                            className="w-48 h-48 bg-white"
                          />
                        </div>
                        <div className="mt-4">
                          <h3 className="text-lg font-black text-white">Escaneie o QR Code</h3>
                          <p className="text-white/50 text-xs mt-1">
                            Abra o app do seu banco e escaneie o código abaixo.
                          </p>
                        </div>
                      </div>

                      {paymentData.brCode && (
                        <div className="bg-black/50 border border-white/10 rounded-xl p-4">
                          <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-2">Código PIX (Copia e Cola)</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(paymentData.brCode);
                              toast.success('Código PIX copiado!');
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-all border border-white/10"
                          >
                            <Copy size={14} />
                            Copiar Código PIX
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <a
                        href={paymentData.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-black text-xs uppercase text-black transition-all hover:scale-[1.01]"
                        style={{
                          background: 'linear-gradient(135deg, #E6A600, #FFD700)',
                          boxShadow: '0 8px 25px rgba(230,166,0,0.3)',
                        }}
                      >
                        <Zap size={16} fill="currentColor" />
                        Abrir Página de Pagamento
                      </a>
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-3 pt-2">
                    <button
                      onClick={() => checkPayment(false)}
                      disabled={verifying}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/20 font-black text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
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
                      className="text-white/40 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
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