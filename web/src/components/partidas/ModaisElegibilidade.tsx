// src/components/partidas/ModaisElegibilidade.tsx
// Modais de entrada em salas apostadas (design v3 §11 / ADR-033): saldo
// insuficiente, "você já está em outra sala", Riot ID obrigatório, termos 18+
// e conta banida. Seguem o tema visual dos modais existentes (fundos escuros
// + borda dourada #FFB700) e NUNCA viram erro genérico — cada código do
// servidor tem sua explicação e seu botão de ação.
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Wallet, AlertTriangle, LinkIcon, ShieldCheck, Ban, Coins, Swords } from 'lucide-react';
import type { ErroElegibilidade } from '../../hooks/useSalaSimples';

const DEPOSIT_EVENT = 'm7:open-deposit';

interface ModalShellProps {
    titulo: string;
    corIcone: string;
    icone?: React.ReactNode;
    children: React.ReactNode;
    onClose: () => void;
}

function ModalShell({ titulo, corIcone, icone, children, onClose }: ModalShellProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm rounded-2xl overflow-hidden"
                style={{
                    background: 'rgba(13, 13, 13, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 25px 70px rgba(0,0,0,0.9)',
                    backdropFilter: 'blur(16px)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Linha acentuada no topo com a cor do tipo */}
                <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${corIcone}, transparent)` }} />
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${corIcone}18`, border: `1px solid ${corIcone}35` }}>
                            {icone ?? <AlertTriangle className="w-5 h-5" style={{ color: corIcone }} />}
                        </span>
                        <h2 className="text-white font-black text-base uppercase tracking-tight leading-tight">{titulo}</h2>
                    </div>
                    <button onClick={onClose} className="text-white/30 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="px-6 pb-6 space-y-4">{children}</div>
            </motion.div>
        </motion.div>
    );
}

const btnPrimario = 'w-full py-3.5 rounded-xl bg-yellow-500 text-black text-sm font-black hover:bg-yellow-400 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_8px_25px_-5px_rgba(255,183,0,0.4)]';
const btnSecundario = 'w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-bold hover:bg-white/10 transition-all';

export interface ModaisElegibilidadeProps {
    erro: ErroElegibilidade;
    onClose: () => void;
    onAceitarTermos: () => void;
}

export function ModaisElegibilidade({ erro, onClose, onAceitarTermos }: ModaisElegibilidadeProps) {
    const navigate = useNavigate();

    const abrirDeposito = () => {
        onClose();
        window.dispatchEvent(new Event(DEPOSIT_EVENT));
    };

    return (
        <AnimatePresence>
            {erro?.tipo === 'saldo' && (
                <ModalShell titulo="Saldo Insuficiente" corIcone="#fbbf24" icone={<Wallet className="w-5 h-5" style={{ color: "#fbbf24" }} />} onClose={onClose}>
                    <p className="text-white/70 text-sm leading-relaxed">
                        Você precisa de mais MC para entrar nesta partida — e a vaga não espera.
                    </p>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-white/50 text-xs uppercase tracking-widest font-bold">Faltam</span>
                            <span className="flex items-center gap-1.5 text-yellow-400 font-black text-xl">
                                <Coins className="w-4 h-4" /> {erro.faltam} MC
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400" style={{ width: `${Math.max(8, Math.min(100, (erro.faltam / 1000) * 100))}%` }} />
                        </div>
                        <p className="text-white/30 text-[10px] uppercase tracking-widest text-center pt-0.5">Recarga em segundos via PIX</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button onClick={abrirDeposito} className={btnPrimario}>
                            <Wallet className="w-4 h-4" /> Recarregar e garantir vaga
                        </button>
                        <button onClick={onClose} className={btnSecundario}>Depois</button>
                    </div>
                </ModalShell>
            )}

            {erro?.tipo === 'outra_sala' && (
                <ModalShell titulo="Você já está em outra sala" corIcone="#3b82f6" icone={<Swords className="w-5 h-5" style={{ color: "#3b82f6" }} />} onClose={onClose}>
                    <p className="text-white/70 text-sm leading-relaxed">
                        Você só pode estar em <b className="text-white">uma sala apostada por vez</b>. Sua vaga (e seus MC) estão seguros na sala abaixo.
                    </p>
                    <button
                        onClick={() => {
                            onClose();
                            navigate(`/${erro.modo || '5v5'}/${erro.salaNum}`);
                        }}
                        className={btnPrimario}
                    >
                        <LinkIcon className="w-4 h-4" /> Ir para minha sala #{String(erro.salaNum).padStart(6, '0')}
                    </button>
                </ModalShell>
            )}

            {erro?.tipo === 'riot_id' && (
                <ModalShell titulo="Riot ID obrigatório" corIcone="#3b82f6" icone={<LinkIcon className="w-5 h-5" style={{ color: "#3b82f6" }} />} onClose={onClose}>
                    <p className="text-white/70 text-sm leading-relaxed">
                        Vincule seu <b className="text-white">Riot ID</b> para jogar valendo MC. É ele que amarra o print de resultado ao seu perfil.
                    </p>
                    <button
                        onClick={() => {
                            onClose();
                            navigate('/vincular');
                        }}
                        className={btnPrimario}
                    >
                        <LinkIcon className="w-4 h-4" /> Vincular Riot ID
                    </button>
                </ModalShell>
            )}

            {erro?.tipo === 'termos' && (
                <ModalShell titulo="Termos de Uso (18+)" corIcone="#fbbf24" icone={<ShieldCheck className="w-5 h-5" style={{ color: "#fbbf24" }} />} onClose={onClose}>
                    <p className="text-white/70 text-sm leading-relaxed">
                        Salas apostadas exigem a declaração de maioridade. Você precisa aceitar os Termos de Uso e a Política de Privacidade.
                    </p>
                    <button onClick={onAceitarTermos} className={btnPrimario}>
                        <ShieldCheck className="w-4 h-4" /> Aceitar Termos e Continuar
                    </button>
                </ModalShell>
            )}

            {erro?.tipo === 'banida' && (
                <ModalShell titulo="Conta banida" corIcone="#ef4444" icone={<Ban className="w-5 h-5" style={{ color: "#ef4444" }} />} onClose={onClose}>
                    <p className="text-white/70 text-sm leading-relaxed">
                        Sua conta foi banida — você não pode jogar partidas casuais nem apostadas. Se você acha que isso é um engano, fale com o suporte no Discord.
                    </p>
                    <span className="block w-full text-center">
                        <Ban className="w-8 h-8 text-red-500/40 mx-auto" />
                    </span>
                </ModalShell>
            )}
        </AnimatePresence>
    );
}
