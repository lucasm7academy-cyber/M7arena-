// Depósito de MC (PIX) — aba do checkout. Recorte do DepositModal (spec
// saque-mc-pix): conteúdo visual idêntico, só o shell/toggle ficou no modal.
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader, CheckCircle2, Copy, Zap } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import GoldEssenceIcon from '../../icons/GoldEssenceIcon';

interface PackageOption {
  id: string;
  label: string;
  priceInReais: number;
  baseMc: number;
  bonusMc: number;
  mcs: number;
  popular?: boolean;
}

interface PaymentData {
  orderId: string;
  method: string;
  qrCode: string;
  brCode: string;
  paymentUrl: string;
}

export default function DepositTab({ onClose }: { onClose: () => void }) {
  const { user } = useAuth(); // ✅ Única fonte do usuário
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let active = true;
    api.payments
      .packages()
      .then((rows) => {
        if (!active) return;
        const lista = (rows || []).map((p) => ({
          id: p.id,
          label: `R$ ${p.priceBrl.toFixed(0)}`,
          priceInReais: p.priceBrl,
          baseMc: p.baseMc,
          bonusMc: p.bonusMc,
          mcs: p.totalMc,
          popular: p.isPopular,
        }));
        setPackages(lista);
        setSelectedPackage(lista.find((pkg) => pkg.popular) || lista[0] || null);
      })
      .catch(() => {
        if (active) toast.error('Erro ao carregar pacotes. Tente novamente.');
      })
      .finally(() => {
        if (active) setPackagesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // ⚡ OTIMIZAÇÃO: Sem polling automático (antes era setInterval 5s).
  // Verificação única ao abrir + botão "Já paguei — verificar agora" on-demand.
  const checkPayment = async (silent = false) => {
    if (!paymentData?.orderId) return;
    if (!silent) setVerifying(true);
    try {
      const { status } = await api.payments.status(paymentData.orderId);

      if (status === 'approved') {
        toast.success('Pagamento aprovado! MCs creditados.');
        onClose();
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

  // ⚡ Garante que o pacote Especial venha pré-selecionado sempre que a aba abrir
  useEffect(() => {
    setSelectedPackage(packages.find((pkg) => pkg.popular) || packages[0] || null);
  }, [packages]);

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
      packageId: selectedPackage.id,
    });

    try {
      const data = await api.payments.createMcOrder(selectedPackage.id);

      console.log('[DepositModal] Dados recebidos:', {
        paymentId: data.paymentId,
        orderId: data.orderId,
        hasQrCode: !!data.qrCode,
        hasBrCode: !!data.brCode,
      });

      if (data.method === 'pix' && !data.qrCode) {
        console.error('[DepositModal] PIX retornou sem QR Code!');
        toast.error('Erro: QR Code não foi gerado. Tente novamente.');
        setLoading(false);
        return;
      }

      setPaymentData({
        orderId: data.paymentId,
        method: data.method,
        qrCode: data.qrCode ?? '',
        brCode: data.brCode ?? '',
        paymentUrl: '',
      });
      toast.success('QR Code gerado com sucesso!');
    } catch (error: any) {
      console.error('[DepositModal] Erro inesperado:', error);
      toast.error(error?.message || 'Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedPackage(packages.find((pkg) => pkg.popular) || packages[0] || null);
    setPaymentData(null);
  };

  return (
    <>
              {!paymentData ? (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-6 items-start">
                  {/* Grade dos 5 Pacotes */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white/50 text-xs uppercase tracking-wider font-bold">
                        Selecione o valor
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFD700]/70">
                        {selectedPackage ? `Selecionado: ${selectedPackage.label}` : 'Toque em um pacote'}
                      </span>
                    </div>
                    {packagesLoading && packages.length === 0 ? (
                      <div className="col-span-full text-white/40 text-sm py-8 text-center">
                        Carregando pacotes...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {packages.map((pkg) => {
                        // Bônus promocional definido no servidor (ADR-031):
                        // % sobre o MC base (ex.: R$50 → 300/5000 = 6%).
                        const bonusPct = pkg.bonusMc > 0 ? Math.round((pkg.bonusMc / pkg.baseMc) * 100) : 0;
                        const isSelected = selectedPackage?.id === pkg.id;
                        return (
                        <motion.button
                          key={pkg.id}
                          onClick={() => handleSelectPackage(pkg)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative p-4 rounded-2xl border transition-all duration-200 text-left flex flex-col justify-between gap-3 ${
                            isSelected
                              ? 'border-[#FFB700] bg-[#FFB700]/10 shadow-[0_0_25px_rgba(255,183,0,0.25)]'
                              : 'border-white/10 bg-black/60 hover:border-white/25 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`text-base font-black tracking-tight ${isSelected ? 'text-[#FFB700]' : 'text-white'}`}>
                              {pkg.label}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {pkg.popular && (
                                <span className="bg-[#FFB700] text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-[0_0_10px_rgba(255,183,0,0.4)] shrink-0">
                                  Mais Escolhido
                                </span>
                              )}
                              {bonusPct > 0 && !pkg.popular && (
                                <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-[0_0_8px_rgba(16,185,129,0.3)] shrink-0">
                                  +{bonusPct}% bônus
                                </span>
                              )}
                              {isSelected && (
                                <CheckCircle2 size={16} className="text-[#FFB700] shrink-0" />
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <GoldEssenceIcon size={22} className={isSelected ? 'opacity-100' : 'opacity-80'} />
                            <div className="text-2xl font-black text-white tracking-tight">
                              {pkg.mcs.toLocaleString('pt-BR')} <span className="text-xs font-bold text-white/40 uppercase">MC</span>
                            </div>
                          </div>
                        </motion.button>
                        );
                      })}
                    </div>
                    )}
                  </div>

                  {/* Resumo do Pedido Glassmorphism */}
                  <div className="bg-[#0a0a0d]/90 border border-[#FFB700]/30 rounded-2xl p-5 backdrop-blur-xl space-y-4 shadow-2xl z-10 lg:sticky lg:top-0">
                    <p className="text-[#FFB700] text-[10px] uppercase tracking-widest font-black flex items-center gap-1.5">
                      <Zap size={12} className="text-[#FFB700]" fill="currentColor" />
                      Resumo do Pedido
                    </p>

                    {selectedPackage ? (
                      <>
                        <div className="space-y-3">
                          <div className="flex justify-between items-baseline">
                            <span className="text-white/50 text-xs font-bold uppercase">Total a Pagar</span>
                            <span className="text-3xl font-black text-[#FFB700] tracking-tight drop-shadow-[0_0_15px_rgba(255,183,0,0.3)]">
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

                          <div className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 flex items-center justify-between">
                            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Custo por MC</span>
                            <span className="text-white/70 text-xs font-black">
                              R$ {(selectedPackage.priceInReais / selectedPackage.mcs).toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 text-white/50 text-[10px]">
                          <CheckCircle2 size={12} className="text-[#FFB700] shrink-0" />
                          <span>Liberação imediata pós-PIX • Sem taxas</span>
                        </div>

                        <button
                          onClick={handleBuyClick}
                          disabled={!selectedPackage || loading}
                          className={`relative w-full py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs md:text-sm text-black transition-all duration-300 ${
                            selectedPackage && !loading
                              ? 'bg-[#FFB700] hover:bg-yellow-400 shadow-[0_8px_25px_rgba(255,183,0,0.35)] cursor-pointer active:scale-95'
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
                        {/* Valor do pedido em destaque */}
                        <div className="mb-4 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30 px-5 py-2.5 inline-flex items-baseline gap-1.5">
                          <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Pagando</span>
                          <span className="text-2xl font-black text-[#FFD700]">
                            R$ {selectedPackage?.priceInReais.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
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
                      onClick={onClose}
                      className="text-white/40 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
                    >
                      Voltar ao Início
                    </button>
                  </div>
                </motion.div>
              )}
    </>
  );
}
