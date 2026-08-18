// Saque de MC via PIX — aba do checkout (spec saque-mc-pix). O jogador digita
// o valor em MC, vê ao vivo o equivalente em reais (100 MC = R$1) e solicita.
// O MC é debitado na solicitação; o admin paga o PIX fora do sistema e
// confirma no painel.
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader, CheckCircle2, XCircle, Clock, ArrowUpCircle, PiggyBank } from 'lucide-react';
import { api, type ApiWithdrawal } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { usePerfil } from '../../../contexts/PerfilContext';
import toast from 'react-hot-toast';
import GoldEssenceIcon from '../../icons/GoldEssenceIcon';
import { CUT_BUTTON, CUT_BADGE } from '../../partidas/ModaisElegibilidade';

const MC_POR_REAL = 100;
const VALOR_MINIMO_MC = 2000;

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mascararPix(chave: string): string {
  if (!chave) return '';
  if (chave.length <= 8) return '••••' + chave.slice(-4);
  return chave.slice(0, 4) + '••••••••' + chave.slice(-4);
}

const STATUS: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  pending: { label: 'Pendente', cls: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400', Icon: Clock },
  paid: { label: 'Pago', cls: 'bg-green-500/10 border-green-500/20 text-green-400', Icon: CheckCircle2 },
  rejected: { label: 'Rejeitado', cls: 'bg-red-500/10 border-red-500/20 text-red-400', Icon: XCircle },
};

export default function SaqueTab() {
  const { user } = useAuth();
  const { profileData } = usePerfil();
  const [saldoMc, setSaldoMc] = useState(0);
  const [mcInput, setMcInput] = useState('');
  const [pedidos, setPedidos] = useState<ApiWithdrawal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [solicitando, setSolicitando] = useState(false);

  const chavePix = (profileData?.chave_pix as string) || '';
  const nomePix = (profileData?.nome_pix as string) || '';
  const tipoPix = (profileData?.tipo_chave_pix as string) || '';

  useEffect(() => {
    if (!user) return;
    let ativo = true;
    Promise.all([api.wallet.balance(), api.withdrawals.mine()])
      .then(([bal, rows]) => {
        if (!ativo) return;
        setSaldoMc(bal?.mc ?? 0);
        setPedidos(rows ?? []);
      })
      .catch(() => {
        if (ativo) toast.error('Erro ao carregar dados de saque.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [user]);

  const mcValor = parseInt(mcInput, 10) || 0;
  const brlEquiv = brl(mcValor / MC_POR_REAL);
  const acimaMinimo = mcValor >= VALOR_MINIMO_MC;
  const podeSolicitar = !!user && !!chavePix && acimaMinimo && mcValor % MC_POR_REAL === 0 && !solicitando;

  const solicitar = async () => {
    if (!podeSolicitar) return;
    setSolicitando(true);
    try {
      await api.withdrawals.create(mcValor);
      toast.success('Saque solicitado! O admin vai pagar na sua chave PIX.');
      setMcInput('');
      const [bal, rows] = await Promise.all([api.wallet.balance(), api.withdrawals.mine()]);
      setSaldoMc(bal?.mc ?? 0);
      setPedidos(rows ?? []);
    } catch (e: any) {
      const mapa: Record<string, string> = {
        saldo_insuficiente: 'Saldo insuficiente.',
        pix_nao_cadastrado: 'Cadastre sua chave PIX no perfil antes de sacar.',
        valor_minimo_nao_atingido: `Mínimo de R$20,00 (${VALOR_MINIMO_MC.toLocaleString('pt-BR')} MC).`,
        valor_invalido: 'Valor inválido. Use múltiplos de 100 MC.',
      };
      toast.error(mapa[e?.message] || e?.message || 'Erro ao solicitar saque.');
    } finally {
      setSolicitando(false);
    }
  };

  if (!user) {
    return (
      <div className="py-10 text-center">
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Entre para solicitar saque</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-6 items-start">
      {/* Coluna esquerda: formulário de saque */}
      <div className="space-y-4">
        <div
          className="p-5 bg-[#0d0d12] border border-[#FFB700]/20 space-y-4"
          style={{ clipPath: CUT_BUTTON }}
        >
          <div className="flex items-center justify-between">
            <p className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Seu saldo disponível</p>
            <div className="flex items-center gap-2">
              <GoldEssenceIcon size={18} />
              <span className="text-[#FFB700] font-black text-lg tabular-nums">
                {saldoMc.toLocaleString('pt-BR')} MC
              </span>
              <span className="text-zinc-400 text-xs font-bold">= {brl(saldoMc / MC_POR_REAL)}</span>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-3">
            <p className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Chave PIX de destino</p>
            {chavePix ? (
              <div
                className="flex items-center justify-between gap-2 bg-[#14141a] px-4 py-3"
                style={{ clipPath: CUT_BADGE }}
              >
                <div>
                  <p className="text-zinc-100 font-black text-sm">{nomePix || 'Sem nome'}</p>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    {tipoPix && <span className="uppercase mr-1 text-[#FFB700]">[{tipoPix}]</span>}
                    {mascararPix(chavePix)}
                  </p>
                </div>
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              </div>
            ) : (
              <div
                className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-yellow-300 text-xs font-bold"
                style={{ clipPath: CUT_BADGE }}
              >
                <PiggyBank size={16} className="shrink-0 text-yellow-400" />
                Cadastre sua chave PIX na página de perfil antes de solicitar o saque.
              </div>
            )}
          </div>

          <div className="border-t border-white/5 pt-4 space-y-3">
            <p className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Valor do saque</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <GoldEssenceIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-80" />
                <input
                  type="number"
                  min={VALOR_MINIMO_MC}
                  step={MC_POR_REAL}
                  value={mcInput}
                  onChange={(e) => setMcInput(e.target.value)}
                  placeholder={`Mínimo ${VALOR_MINIMO_MC.toLocaleString('pt-BR')} MC`}
                  className="w-full bg-black/60 border border-white/10 pl-12 pr-4 py-3 text-zinc-100 text-sm font-bold focus:outline-none focus:border-[#FFB700] placeholder:text-zinc-600 transition-all font-mono"
                  style={{ clipPath: CUT_BADGE }}
                />
              </div>
              <div className="flex items-center gap-1.5 text-[#FFB700] font-black">
                <span className="text-xs uppercase tracking-widest text-zinc-500">=</span>
                <span className="text-2xl tabular-nums">{brlEquiv}</span>
              </div>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${acimaMinimo ? 'text-zinc-500' : 'text-yellow-400/80'}`}>
              Mínimo de R$20,00 ({VALOR_MINIMO_MC.toLocaleString('pt-BR')} MC) · Sem taxas · 100 MC = R$1,00
            </p>
          </div>

          <motion.button
            whileHover={{ scale: podeSolicitar ? 1.02 : 1 }}
            whileTap={{ scale: podeSolicitar ? 0.97 : 1 }}
            onClick={solicitar}
            disabled={!podeSolicitar}
            className="w-full relative p-[1px] cursor-pointer disabled:opacity-50"
            style={{
              clipPath: CUT_BUTTON,
              background: podeSolicitar ? 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)' : 'rgba(255,255,255,0.08)',
            }}
          >
            <div
              className={`w-full py-3.5 px-4 flex items-center justify-center gap-2 font-black text-xs md:text-sm uppercase tracking-wider transition-all ${
                podeSolicitar ? 'bg-[#FFB700] text-black hover:brightness-105' : 'bg-[#121216] text-zinc-500 cursor-not-allowed'
              }`}
              style={{ clipPath: CUT_BUTTON }}
            >
              {solicitando ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  <span>Solicitando...</span>
                </>
              ) : (
                <>
                  <ArrowUpCircle size={16} />
                  <span>Solicitar Saque</span>
                </>
              )}
            </div>
          </motion.button>
        </div>

        {/* Histórico */}
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-2">Solicitações recentes</p>
          {carregando ? (
            <div className="text-zinc-500 text-sm py-4 text-center">Carregando...</div>
          ) : pedidos.length === 0 ? (
            <div
              className="text-zinc-500 text-sm py-4 text-center bg-[#0d0d12] border border-white/5"
              style={{ clipPath: CUT_BUTTON }}
            >
              Nenhum saque solicitado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {pedidos.map((p) => {
                const st = STATUS[p.status] || STATUS.pending;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 bg-[#0d0d12] border border-white/5 px-4 py-3"
                    style={{ clipPath: CUT_BUTTON }}
                  >
                    <div>
                      <p className="text-zinc-200 font-black text-sm">
                        {p.mcAmount.toLocaleString('pt-BR')} MC{' '}
                        <span className="text-zinc-400 text-xs font-bold">= {brl(p.amountBrl)}</span>
                      </p>
                      <p className="text-zinc-500 text-[10px] mt-0.5">
                        {new Date(p.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${st.cls}`}
                      style={{ clipPath: CUT_BADGE }}
                    >
                      <st.Icon size={12} />
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Coluna direita: resumo fixo */}
      <div
        className="p-[1px] lg:sticky lg:top-0"
        style={{
          clipPath: CUT_BUTTON,
          background: 'linear-gradient(135deg, #FFB700, rgba(255,183,0,0.3))',
        }}
      >
        <div
          className="bg-[#0c0c10] p-5 space-y-4 shadow-2xl"
          style={{ clipPath: CUT_BUTTON }}
        >
          <p className="text-[#FFB700] text-[10px] uppercase tracking-widest font-black flex items-center gap-1.5">
            <ArrowUpCircle size={13} className="text-[#FFB700]" />
            Como funciona
          </p>
          <ul className="space-y-2.5 text-zinc-400 text-xs leading-relaxed font-medium">
            <li className="flex items-start gap-2">
              <span className="text-[#FFB700] font-black">•</span>
              <span>O valor sai do seu saldo assim que você solicita.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FFB700] font-black">•</span>
              <span>O admin paga o PIX para sua chave cadastrada e confirma.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FFB700] font-black">•</span>
              <span>Se o pedido for rejeitado, os MC voltam para o seu saldo.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FFB700] font-black">•</span>
              <span>Conversão fixa: <strong className="text-zinc-200 font-black">100 MC = R$ 1,00</strong>.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
