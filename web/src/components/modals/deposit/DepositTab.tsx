// Depósito de MC (PIX) — aba do checkout. Recorte do DepositModal (spec
// saque-mc-pix): conteúdo visual com corte angular e tons suaves.
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader, CheckCircle2, Copy, Zap } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import GoldEssenceIcon from '../../icons/GoldEssenceIcon';
import { CUT_BUTTON, CUT_BUTTON_INNER, CUT_BADGE, CUT_BADGE_INNER } from '../../partidas/ModaisElegibilidade';

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
  const { user } = useAuth();
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
      checkPayment(true);
    }
  }, [paymentData?.orderId]);

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
    try {
      const data = await api.payments.createMcOrder(selectedPackage.id);

      if (data.method === 'pix' && !data.qrCode) {
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
      toast.error(error?.message || 'Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!paymentData ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-6 items-start">
          {/* Grade dos Pacotes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-zinc-400 text-xs uppercase tracking-wider font-bold">
                Selecione o valor
              </p>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFB700]">
                {selectedPackage ? `Selecionado: ${selectedPackage.label}` : 'Toque em um pacote'}
              </span>
            </div>

            {packagesLoading && packages.length === 0 ? (
              <div className="col-span-full text-zinc-500 text-sm py-8 text-center">
                Carregando pacotes...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {packages.map((pkg) => {
                  const bonusPct = pkg.bonusMc > 0 ? Math.round((pkg.bonusMc / pkg.baseMc) * 100) : 0;
                  const isSelected = selectedPackage?.id === pkg.id;
                  return (
                    <motion.button
                      key={pkg.id}
                      onClick={() => handleSelectPackage(pkg)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative p-[1px] transition-all duration-200 text-left flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'shadow-[0_0_20px_rgba(255,183,0,0.3)]'
                          : 'opacity-90 hover:opacity-100'
                      }`}
                      style={{
                        clipPath: CUT_BUTTON,
                        background: isSelected
                          ? 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)'
                          : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <div
                        className={`w-full h-full p-4 flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#141208]'
                            : 'bg-[#0d0d12] hover:bg-[#14141c]'
                        }`}
                        style={{ clipPath: CUT_BUTTON_INNER }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-base font-black tracking-tight ${isSelected ? 'text-[#FFB700]' : 'text-zinc-200'}`}>
                            {pkg.label}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {pkg.popular && (
                              <span
                                className="bg-[#FFB700] text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 shrink-0"
                                style={{ clipPath: CUT_BADGE }}
                              >
                                Mais Escolhido
                              </span>
                            )}
                            {bonusPct > 0 && !pkg.popular && (
                              <span
                                className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 shrink-0"
                                style={{ clipPath: CUT_BADGE }}
                              >
                                +{bonusPct}% bônus
                              </span>
                            )}
                            {isSelected && (
                              <CheckCircle2 size={16} className="text-[#FFB700] shrink-0" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <GoldEssenceIcon size={20} className={isSelected ? 'opacity-100' : 'opacity-80'} />
                          <div className="text-xl font-black text-zinc-100 tracking-tight">
                            {pkg.mcs.toLocaleString('pt-BR')} <span className="text-[11px] font-bold text-zinc-400 uppercase">MC</span>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo do Pedido */}
          <div
            className="p-[1px] lg:sticky lg:top-0"
            style={{
              clipPath: CUT_BUTTON,
              background: 'linear-gradient(135deg, #FFB700, rgba(255,183,0,0.3))',
            }}
          >
            <div
              className="bg-[#0c0c10] p-5 space-y-4 shadow-2xl"
              style={{ clipPath: CUT_BUTTON_INNER }}
            >
              <p className="text-[#FFB700] text-[10px] uppercase tracking-widest font-black flex items-center gap-1.5">
                <Zap size={12} className="text-[#FFB700]" fill="currentColor" />
                Resumo do Pedido
              </p>

              {selectedPackage ? (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-zinc-400 text-xs font-bold uppercase">Total a Pagar</span>
                      <span className="text-3xl font-black text-[#FFB700] tracking-tight">
                        R$ {selectedPackage.priceInReais.toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <span className="text-zinc-400 text-xs font-bold uppercase">Você Recebe</span>
                      <div className="flex items-center gap-1.5 text-zinc-100">
                        <GoldEssenceIcon size={16} />
                        <span className="text-base font-black">{selectedPackage.mcs.toLocaleString('pt-BR')} MCs</span>
                      </div>
                    </div>

                    <div
                      className="bg-[#14141a] px-3 py-2 flex items-center justify-between"
                      style={{ clipPath: CUT_BADGE_INNER }}
                    >
                      <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Custo por MC</span>
                      <span className="text-zinc-200 text-xs font-black">
                        R$ {(selectedPackage.priceInReais / selectedPackage.mcs).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-zinc-400 text-[10px]">
                    <CheckCircle2 size={12} className="text-[#FFB700] shrink-0" />
                    <span>Liberação imediata pós-PIX • Sem taxas</span>
                  </div>

                  <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.97 }}
                    onClick={handleBuyClick}
                    disabled={!selectedPackage || loading}
                    className="w-full relative p-[1px] cursor-pointer shadow-lg disabled:opacity-50"
                    style={{
                      clipPath: CUT_BUTTON,
                      background: 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)',
                    }}
                  >
                    <div
                      className="w-full py-3.5 px-4 flex items-center justify-center gap-2 font-black text-xs md:text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
                      style={{ clipPath: CUT_BUTTON_INNER }}
                    >
                      {loading ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={15} fill="currentColor" />
                          <span>Confirmar Depósito</span>
                        </>
                      )}
                    </div>
                  </motion.button>
                </>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-zinc-500 text-xs font-medium">
                    Selecione um pacote
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Tela de QR Code PIX */
        <div className="space-y-5 max-w-md mx-auto py-2 text-center">
          {paymentData.method === 'pix' && paymentData.qrCode ? (
            <>
              <div className="flex flex-col items-center">
                <div
                  className="mb-4 bg-[#141208] border border-[#FFB700]/30 px-5 py-2 inline-flex items-baseline gap-1.5"
                  style={{ clipPath: CUT_BADGE_INNER }}
                >
                  <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Pagando</span>
                  <span className="text-2xl font-black text-[#FFB700]">
                    R$ {selectedPackage?.priceInReais.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div
                  className="p-3 bg-white border-2 border-[#FFB700] shadow-xl"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <img
                    src={`data:image/png;base64,${paymentData.qrCode}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 bg-white"
                  />
                </div>
                <div className="mt-3">
                  <h3
                    className="text-xl uppercase text-[#EDEDEE]"
                    style={{ fontFamily: '"Anton", "Arial Narrow", Impact, sans-serif' }}
                  >
                    Escaneie o QR Code
                  </h3>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    Abra o app do seu banco e escaneie o código acima.
                  </p>
                </div>
              </div>

              {paymentData.brCode && (
                <div
                  className="p-[1px]"
                  style={{ clipPath: CUT_BUTTON, background: 'rgba(255,255,255,0.15)' }}
                >
                  <div
                    className="bg-[#0d0d12] p-3.5"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black mb-2">Código PIX (Copia e Cola)</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(paymentData.brCode);
                        toast.success('Código PIX copiado!');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-bold transition-all border border-white/10"
                      style={{ clipPath: CUT_BADGE }}
                    >
                      <Copy size={14} />
                      Copiar Código PIX
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <a
                href={paymentData.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 font-black text-xs uppercase text-black bg-[#FFB700] transition-all hover:brightness-105"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                <Zap size={16} fill="currentColor" />
                Abrir Página de Pagamento
              </a>
            </div>
          )}

          <div className="flex flex-col items-center gap-2.5 pt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => checkPayment(false)}
              disabled={verifying}
              className="w-full relative p-[1px] cursor-pointer disabled:opacity-50"
              style={{
                clipPath: CUT_BUTTON,
                background: 'linear-gradient(135deg, #FFB700, #FFE082)',
              }}
            >
              <div
                className="w-full py-3 px-4 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                {verifying ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Já paguei — verificar agora</span>
                  </>
                )}
              </div>
            </motion.button>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      )}
    </>
  );
}
