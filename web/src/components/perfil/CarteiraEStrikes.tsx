// src/components/perfil/CarteiraEStrikes.tsx
// Wallet transparente + advertências/ban no perfil (ADR-033):
// "X MC disponível + Y MC em partida", com o valor reservado linkando para a
// sala que o segura; e o contador "X/3 advertências" com o status de ban
// quando aplicável. Saldo que "some" sem explicação vira ticket de suporte.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoaderCircle, ShieldAlert, Ban } from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';
import { api, type ApiWalletBalance } from '../../lib/api';

interface CarteiraEStrikesProps {
    saldoDisponivel: number;
    advertencias: number;
    advertenciasMax: number;
    status?: string;
    banMotivo?: string | null;
    suspensaAte: string | null;
}

export function CarteiraEStrikes({ saldoDisponivel, advertencias, advertenciasMax, status, banMotivo, suspensaAte }: CarteiraEStrikesProps) {
    const navigate = useNavigate();
    const [wallet, setWallet] = useState<ApiWalletBalance | null>(null);
    const [carregando, setCarregando] = useState(false);

    useEffect(() => {
        let mounted = true;
        setCarregando(true);
        api.wallet.balance()
            .then((w) => { if (mounted) setWallet(w); })
            .catch(() => {})
            .finally(() => { if (mounted) setCarregando(false); });
        return () => { mounted = false; };
    }, []);

    const emPartida = wallet?.emPartida ?? [];
    const mcReservado = wallet?.mcReservado ?? emPartida.reduce((acc, s) => acc + (s.apostaMc || 0), 0);
    const disponivel = wallet?.mc ?? saldoDisponivel;
    const limiteAviso = Math.max(0, (advertenciasMax ?? 3) - 1);
    const banido = status === 'banida';

    const formatarFimSuspensao = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch {
            return iso;
        }
    };

    return (
        <div className="grid md:grid-cols-2 gap-8">
            {/* Wallet */}
            <div className="rounded-3xl p-5 sm:p-8 relative overflow-hidden border border-white/10" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center justify-between mb-5">
                    <span className="text-xs text-white/30 font-normal uppercase tracking-widest">Carteira</span>
                    <GiTwoCoins className="w-5 h-5 text-primary" />
                </div>

                {carregando && !wallet ? (
                    <div className="flex items-center gap-2 text-white/30 text-xs uppercase tracking-widest py-6">
                        <LoaderCircle className="w-4 h-4 animate-spin" /> Carregando saldo...
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
                            <span className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Disponível</span>
                            <span className="flex items-center gap-1.5 text-white font-black text-base">
                                <GiTwoCoins className="w-4 h-4 text-primary" /> {disponivel.toLocaleString('pt-BR')} MC
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-primary/5 border border-primary/20">
                            <span className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Em partida</span>
                            <span className="flex items-center gap-1.5 text-primary font-black text-base">
                                <GiTwoCoins className="w-4 h-4 text-primary" /> {mcReservado.toLocaleString('pt-BR')} MC
                            </span>
                        </div>
                        {emPartida.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Reservado em:</p>
                                {emPartida.map((s) => (
                                    <button key={s.salaNum} onClick={() => navigate(`/${s.modo || '5v5'}/${s.salaNum}`)}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-primary/40 hover:bg-white/5 transition-all text-left">
                                        <span className="text-white/60 text-[11px] font-bold uppercase tracking-wider truncate">
                                            #{String(s.salaNum).padStart(6, '0')} · {s.nome || 'Sala'}
                                        </span>
                                        <span className="text-yellow-400 text-[11px] font-black shrink-0 ml-2">{s.apostaMc} MC</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Advertências / Ban */}
            <div className="rounded-3xl p-5 sm:p-8 relative overflow-hidden border border-white/10" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
                <div className="flex items-center justify-between mb-5">
                    <span className="text-xs text-white/30 font-normal uppercase tracking-widest">Punições</span>
                    <ShieldAlert className="w-5 h-5 text-red-400/50" />
                </div>
                <div className="space-y-3">
                    <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Advertências</span>
                            <span className={`font-black text-sm ${advertencias >= advertenciasMax ? 'text-red-400' : advertencias >= limiteAviso ? 'text-yellow-400' : 'text-white'}`}>
                                {advertencias}/{advertenciasMax}
                            </span>
                        </div>
                        <div className="flex gap-1.5">
                            {Array.from({ length: Math.max(1, advertenciasMax) }).map((_, i) => (
                                <div key={i} className={`h-1.5 flex-1 rounded-full ${i < advertencias ? (advertencias >= advertenciasMax ? 'bg-red-500' : 'bg-yellow-400') : 'bg-white/10'}`} />
                            ))}
                        </div>
                        <p className="mt-2 text-[10px] text-white/40 leading-relaxed">
                            {banido
                                ? 'Sua conta está banida — você não pode jogar partidas casuais nem apostadas.'
                                : advertencias >= limiteAviso
                                    ? `Atenção: ${advertenciasMax} advertências resultam em ban.`
                                    : `Advertências são aplicadas pela administração. 3 advertências resultam em ban.`}
                        </p>
                    </div>
                    {banido && (
                        <div className="px-4 py-3 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-center gap-3">
                            <Ban className="w-4 h-4 text-red-400 shrink-0" />
                            <p className="text-red-300 text-xs font-bold">
                                {banMotivo
                                    ? `Motivo: ${banMotivo}`
                                    : 'Conta banida.'} <span className="text-red-400/70 font-normal">Fale com o suporte no Discord.</span>
                            </p>
                        </div>
                    )}
                    {suspensaAte && (
                        <div className="px-4 py-3 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-center gap-3">
                            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                            <p className="text-red-300 text-xs font-bold">
                                Suspensão de salas apostadas até <b>{formatarFimSuspensao(suspensaAte)}</b>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
