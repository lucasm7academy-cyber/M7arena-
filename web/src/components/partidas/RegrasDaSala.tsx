// src/components/partidas/RegrasDaSala.tsx
// Valores visíveis ANTES de confirmar numa sala apostada (design v3 §11):
// valor da aposta, pote total (sala cheia/fechada) e ganho por jogador do
// time vencedor. Sem taxas e sem SLA — só o que o jogador quer saber.
import { Coins, Trophy, Users } from 'lucide-react';
import { getModoInfo } from '../../api/salamod1';

interface RegrasDaSalaProps {
    aposta: number;
    modo: string;
}

const fmt = (n: number) => n.toLocaleString('pt-BR');

export function RegrasDaSala({ aposta, modo }: RegrasDaSalaProps) {
    const modoInfo = getModoInfo(modo);
    const pote = aposta * (modoInfo.maxJogadores || 10); // valor da sala FECHADA
    const ganhoPorJogador = modoInfo.jogadoresPorTime > 0
        ? Math.floor(pote / modoInfo.jogadoresPorTime)
        : pote;

    return (
        <div className="w-full rounded-2xl overflow-hidden border border-white/10" style={{ background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(12px)' }}>
            <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#FFB700]" />
                <span className="text-white font-black text-[11px] uppercase tracking-widest">Valores da Partida</span>
            </div>
            <div className="divide-y divide-white/5">
                <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-white/50 text-[10px] uppercase tracking-widest font-bold">
                        <Coins className="w-3.5 h-3.5 text-yellow-400" /> Valor da aposta
                    </span>
                    <span className="text-yellow-400 font-black text-sm">{fmt(aposta)} MC</span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-white/50 text-[10px] uppercase tracking-widest font-bold">
                        <Trophy className="w-3.5 h-3.5 text-[#FFB700]" /> Valor do pote (sala cheia)
                    </span>
                    <span className="text-[#FFB700] font-black text-sm">{fmt(pote)} MC</span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-white/50 text-[10px] uppercase tracking-widest font-bold">
                        <Users className="w-3.5 h-3.5 text-green-400" /> Ganho por jogador vencedor
                    </span>
                    <span className="text-green-400 font-black text-sm">{fmt(ganhoPorJogador)} MC</span>
                </div>
            </div>
        </div>
    );
}
