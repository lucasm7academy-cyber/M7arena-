// src/components/partidas/RegrasDaSala.tsx
// Regras visíveis ANTES de confirmar numa sala apostada (design v3 §11):
// valor da aposta, taxa da plataforma, regra de abandono (AFK perde) e SLA de
// pagamento. Em plataforma de aposta, confiança é o produto.
import { Coins, Percent, Timer, ShieldAlert } from 'lucide-react';
import { SLA_REVISAO_HORAS } from './AguardandoRevisao';

interface RegrasDaSalaProps {
    aposta: number;
    taxaPct: string | number;
}

export function RegrasDaSala({ aposta, taxaPct }: RegrasDaSalaProps) {
    const taxa = Number(taxaPct ?? 8.99);
    const pote = aposta * 10; // pote nominal com sala cheia (5v5/ARAM)

    return (
        <div className="w-full rounded-2xl overflow-hidden border border-white/10" style={{ background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(12px)' }}>
            <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#FFB700]" />
                <span className="text-white font-black text-[11px] uppercase tracking-widest">Regras da Partida</span>
            </div>
            <div className="divide-y divide-white/5">
                <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-white/50 text-[10px] uppercase tracking-widest font-bold">
                        <Coins className="w-3.5 h-3.5 text-yellow-400" /> Valor da aposta
                    </span>
                    <span className="text-yellow-400 font-black text-sm">{aposta} MC</span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-white/50 text-[10px] uppercase tracking-widest font-bold">
                        <Percent className="w-3.5 h-3.5 text-cyan-400" /> Taxa da plataforma
                    </span>
                    <span className="text-cyan-400 font-black text-sm">{taxa}% do pote{aposta > 0 ? ` (≈ ${pote} MC cheio)` : ''}</span>
                </div>
                <div className="px-4 py-2.5 flex items-start justify-between gap-3">
                    <span className="flex items-center gap-2 text-white/50 text-[10px] uppercase tracking-widest font-bold">
                        <Timer className="w-3.5 h-3.5 text-orange-400" /> SLA de pagamento
                    </span>
                    <span className="text-white/80 text-[11px] font-bold text-right">
                        Print aprovado pela staff — pagamento em até {SLA_REVISAO_HORAS} horas no Pix
                    </span>
                </div>
                {aposta > 0 && (
                    <div className="px-4 py-2.5">
                        <span className="flex items-center gap-2 text-white/50 text-[10px] uppercase tracking-widest font-bold mb-1">
                            <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Abandono
                        </span>
                        <p className="text-white/70 text-[11px] leading-relaxed">
                            <b className="text-red-300">AFK / abandono após o início não devolve nada</b> — o resultado da partida decide. No-show (ocioso 30 min na vaga) gera strike e a vaga é liberada.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
