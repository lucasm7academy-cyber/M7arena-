// Saque de MC via PIX — aba do checkout (spec saque-mc-pix). O jogador digita
// o valor em MC, vê ao vivo o equivalente em reais (100 MC = R$1) e solicita.
// O MC é debitado na solicitação; o admin paga o PIX fora do sistema e
// confirma no painel.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader, CheckCircle2, XCircle, Clock, ArrowUpCircle, PiggyBank } from 'lucide-react';
import { api, type ApiWithdrawal } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { usePerfil } from '../../../contexts/PerfilContext';
import toast from 'react-hot-toast';
import GoldEssenceIcon from '../../icons/GoldEssenceIcon';

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
        <p className="text-white/30 text-sm font-bold uppercase tracking-widest">Entre para solicitar saque</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-6 items-start">
      {/* Coluna esquerda: formulário de saque */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold">Seu saldo</p>
            <div className="flex items-center gap-2">
              <GoldEssenceIcon size={18} />
              <span className="text-white font-black text-lg tabular-nums">
                {saldoMc.toLocaleString('pt-BR')} MC
              </span>
              <span className="text-white/40 text-xs font-bold">= {brl(saldoMc / MC_POR_REAL)}</span>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold">Chave PIX de destino</p>
            {chavePix ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                <div>
                  <p className="text-white font-black text-sm">{nomePix || 'Sem nome'}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {tipoPix && <span className="uppercase mr-1">[{tipoPix}]</span>}
                    {mascararPix(chavePix)}
                  </p>
                </div>
                <CheckCircle2 size={16} className="text-green-400 shrink-0" />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-yellow-300 text-xs font-bold">
                <PiggyBank size={16} className="shrink-0" />
                Cadastre sua chave PIX na página de perfil antes de solicitar o saque.
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold">Valor do saque</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <GoldEssenceIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min={VALOR_MINIMO_MC}
                  step={MC_POR_REAL}
                  value={mcInput}
                  onChange={(e) => setMcInput(e.target.value)}
                  placeholder={`Mínimo ${VALOR_MINIMO_MC.toLocaleString('pt-BR')} MC`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-[#FFD700]/40 placeholder:text-white/20"
                />
              </div>
              <div className="flex items-center gap-1.5 text-[#FFD700] font-black">
                <span className="text-xs uppercase tracking-widest">=</span>
                <span className="text-2xl tabular-nums">{brlEquiv}</span>
              </div>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${acimaMinimo ? 'text-white/30' : 'text-yellow-400/80'}`}>
              Mínimo de R$20,00 · Sem taxas · 100 MC = R$1,00
            </p>
          </div>

          <button
            onClick={solicitar}
            disabled={!podeSolicitar}
            className={`relative w-full py-4 rounded-xl font-black uppercase tracking-wider text-xs md:text-sm transition-all duration-300 ${
              podeSolicitar
                ? 'bg-gradient-to-r from-[#E6A600] via-[#FFD700] to-[#E6A600] text-black hover:brightness-110 shadow-[0_8px_25px_rgba(230,166,0,0.35)] cursor-pointer active:scale-95'
                : 'bg-white/10 text-white/20 cursor-not-allowed opacity-50'
            }`}
          >
            {solicitando ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size={16} className="animate-spin" />
                Solicitando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <ArrowUpCircle size={16} />
                Solicitar Saque
              </span>
            )}
          </button>
        </div>

        {/* Histórico */}
        <div>
          <p className="text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Solicitações recentes</p>
          {carregando ? (
            <div className="text-white/30 text-sm py-4 text-center">Carregando...</div>
          ) : pedidos.length === 0 ? (
            <div className="text-white/25 text-sm py-4 text-center rounded-xl border border-white/5 bg-white/[0.02]">
              Nenhum saque solicitado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {pedidos.map((p) => {
                const st = STATUS[p.status] || STATUS.pending;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                    <div>
                      <p className="text-white font-black text-sm">
                        {p.mcAmount.toLocaleString('pt-BR')} MC{' '}
                        <span className="text-white/40 text-xs font-bold">= {brl(p.amountBrl)}</span>
                      </p>
                      <p className="text-white/30 text-[10px] mt-0.5">
                        {new Date(p.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${st.cls}`}>
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
      <div className="bg-black/60 border border-[#FFD700]/30 rounded-2xl p-5 backdrop-blur-lg space-y-4 shadow-xl lg:sticky lg:top-0">
        <p className="text-[#FFD700] text-[10px] uppercase tracking-widest font-black">Como funciona</p>
        <ul className="space-y-2.5 text-white/50 text-xs leading-relaxed">
          <li>O valor sai do seu saldo assim que você solicita.</li>
          <li>O admin paga o PIX fora do sistema e confirma no painel.</li>
          <li>Se o pedido for rejeitado, os MC voltam para o seu saldo.</li>
          <li>Conversão fixa: <span className="text-white/80 font-black">100 MC = R$1,00</span>.</li>
        </ul>
      </div>
    </div>
  );
}
