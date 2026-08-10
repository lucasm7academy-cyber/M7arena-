// src/components/partidas/AguardandoRevisao.tsx
// Estado pós-print de uma sala apostada (design v3 §6/§11): o jogador vê
// "Em análise — prints recebidos X/3 — pagamento em até 24h", pode enviar os
// prints de prova (máx. 3) e contestar o resultado. O envio nunca cai no vazio:
// cada print aparece na lista na hora, com a URL autenticada do servidor.
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImagePlus, Loader, CheckCircle2, AlertTriangle, Gavel, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';

export const SLA_REVISAO_HORAS = 24;

function formatarHorasRestantes(desde: string | null | undefined): string {
    if (!desde) return `em até ${SLA_REVISAO_HORAS} horas`;
    try {
        const fim = new Date(new Date(desde).getTime() + SLA_REVISAO_HORAS * 60 * 60 * 1000);
        const restanteMs = fim.getTime() - Date.now();
        if (restanteMs <= 0) return 'a qualquer momento';
        const h = Math.floor(restanteMs / 3_600_000);
        const m = Math.floor((restanteMs % 3_600_000) / 60_000);
        if (h > 0) return `em até ${h}h${m > 0 ? `${String(m).padStart(2, '0')}` : ''}`;
        return `em até ${m} min`;
    } catch {
        return `em até ${SLA_REVISAO_HORAS} horas`;
    }
}

interface AguardandoRevisaoProps {
    sala: any;
    /** Quem jogou a partida (lineup Blue/Red exibido no card). */
    jogadores: any[];
    /** Usuário logado está confirmado na sala (condição para enviar print). */
    jogadorConfirmado: boolean;
    /** Id do usuário logado — marca a contestação dele na lista. */
    usuarioId: string;
    /** Refaz o GET da sala após transições/upload (realtime ou manual). */
    onAtualizar: () => void;
}

export function AguardandoRevisao({ sala, jogadores, jogadorConfirmado, usuarioId, onAtualizar }: AguardandoRevisaoProps) {
    const matchId = sala?.match_id as string | undefined;
    const recebidos = sala?.prints_recebidos ?? 0;
    const necessarios = sala?.prints_necessarios ?? 3;
    const [prints, setPrints] = useState<any[]>([]);
    const [carregandoPrints, setCarregandoPrints] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [contestar, setContestar] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [contestando, setContestando] = useState(false);
    const [minhaDisputa, setMinhaDisputa] = useState<any>(null);
    // Print em exibição ampliada (lightbox, mesmo padrão dos logos de time).
    const [lightboxPrint, setLightboxPrint] = useState<any>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const jaEnviei = prints.some((p: any) => p.userId === usuarioId);

    const carregarPrints = useCallback(async () => {
        if (!matchId) return;
        setCarregandoPrints(true);
        try {
            const dados = await api.prints.list(matchId);
            setPrints(dados);
        } catch (e: any) {
            // Nunca engole erro: sem permissão não há prints para mostrar.
            console.error('[Prints] falha ao listar:', e?.message);
            setPrints([]);
        } finally {
            setCarregandoPrints(false);
        }
    }, [matchId]);

    // Recarrega os prints sempre que a contagem do servidor mudar (novo upload
    // em outra aba, transição para revisão, etc.) — nunca fica desatualizado.
    useEffect(() => {
        carregarPrints();
    }, [carregarPrints, recebidos]);

    // Verifica se o usuário logado já contestou esta partida (1 por jogador).
    useEffect(() => {
        if (!matchId) return;
        api.disputas.list(matchId)
            .then((d) => setMinhaDisputa(d.find((x: any) => x.userId === usuarioId) ?? null))
            .catch(() => {});
    }, [matchId, usuarioId]);

    const enviarPrint = async (file: File) => {
        if (!matchId || !file) return;
        if (enviando) return;
        setEnviando(true);
        try {
            await api.prints.upload(matchId, file);
            toast.success('Print enviado! Em análise pelo admin.');
            await carregarPrints();
            onAtualizar();
        } catch (e: any) {
            toast.error(e?.message || 'Falha ao enviar o print. Tente novamente.');
        } finally {
            setEnviando(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const abrirContestacao = async () => {
        if (!matchId) return;
        if (motivo.trim().length < 5) {
            toast.error('Descreva o motivo (mínimo 5 caracteres).');
            return;
        }
        setContestando(true);
        try {
            await api.disputas.abrir(matchId, motivo.trim());
            toast.success('Contestação registrada — o admin vai considerar antes de decidir.');
            setContestar(false);
            setMotivo('');
        } catch (e: any) {
            toast.error(e?.message || 'Não foi possível registrar a contestação.');
        } finally {
            setContestando(false);
        }
    };

    const podeEnviar = jogadorConfirmado && !jaEnviei && recebidos < necessarios && !enviando;

    // Lineup de quem jogou (Blue x Red) — quem já anexou o print ganha um
    // check verde na própria linha do card.
    const timeA = jogadores.filter((j: any) => j.is_time_a);
    const timeB = jogadores.filter((j: any) => !j.is_time_a);
    const enviouPrint = (userId: string) => prints.some((p: any) => p.userId === userId);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[65] w-[min(90vw,520px)]"
        >
            <div className="rounded-2xl overflow-hidden border border-[#FFB700]/30 shadow-[0_0_60px_rgba(255,183,0,0.15)]"
                style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(16px)' }}>
                {/* Cabeçalho — Partida finalizada, status Em análise */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                            className="w-3 h-3 rounded-full bg-[#FFB700] shadow-[0_0_12px_rgba(255,183,0,0.8)]" />
                        <div>
                            <p className="text-white font-black text-sm uppercase tracking-widest">Partida Finalizada</p>
                            <p className="text-[11px] text-[#FFB700]/80 font-bold uppercase tracking-wider">
                                Em análise · Pagamento {formatarHorasRestantes(sala?.revisao_desde)}
                            </p>
                        </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest">
                        {recebidos}/{necessarios} prints
                    </span>
                </div>

                <div className="p-5 space-y-4">
                    {/* Barra de progresso dos prints */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Prints recebidos</span>
                            <span className="text-[#FFB700] font-black text-xs">{recebidos}/{necessarios}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-[#FFB700] transition-all duration-500"
                                style={{ width: `${Math.min(100, (recebidos / Math.max(1, necessarios)) * 100)}%` }} />
                        </div>
                    </div>

                    {/* Lineup — quem jogou (Blue x Red), check verde em quem já
                        enviou o print */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-blue-500/[0.06] border border-blue-500/20 p-2">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Blue Side</p>
                            <div className="space-y-1">
                                {timeA.map((j: any) => (
                                    <div key={j.user_id} className="flex items-center gap-1.5">
                                        {j.avatar ? (
                                            <img src={j.avatar} alt={j.nome} className="w-4 h-4 rounded-full object-cover shrink-0" loading="lazy" />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full bg-white/10 shrink-0" />
                                        )}
                                        <span className="flex-1 truncate text-[10px] font-bold text-white/80">{j.nome}</span>
                                        {enviouPrint(j.user_id) ? (
                                            <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                                        ) : (
                                            <span className="w-3 h-3 rounded-full border border-white/15 shrink-0" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl bg-red-500/[0.06] border border-red-500/20 p-2">
                            <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1.5">Red Side</p>
                            <div className="space-y-1">
                                {timeB.map((j: any) => (
                                    <div key={j.user_id} className="flex items-center gap-1.5">
                                        {j.avatar ? (
                                            <img src={j.avatar} alt={j.nome} className="w-4 h-4 rounded-full object-cover shrink-0" loading="lazy" />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full bg-white/10 shrink-0" />
                                        )}
                                        <span className="flex-1 truncate text-[10px] font-bold text-white/80">{j.nome}</span>
                                        {enviouPrint(j.user_id) ? (
                                            <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                                        ) : (
                                            <span className="w-3 h-3 rounded-full border border-white/15 shrink-0" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Prints enviados — miniatura + quem anexou; clicar amplia
                        (lightbox, mesmo padrão dos logos de time) */}
                    {prints.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                            {prints.map((p) => (
                                <button key={p.id} onClick={() => setLightboxPrint(p)}
                                    className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group text-left cursor-pointer"
                                    title={`Print de ${p.nomeJogador} — clique para ampliar`}>
                                    <img src={api.prints.file(p.id)} alt={`Print de ${p.nomeJogador}`}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white/70 text-[8px] font-black uppercase tracking-widest px-1 py-0.5 truncate">
                                        {p.nomeJogador}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    {carregandoPrints && prints.length === 0 && (
                        <div className="flex items-center justify-center py-3 text-white/30">
                            <Loader className="w-4 h-4 animate-spin" />
                        </div>
                    )}

                    {/* Upload de print — só quem é da partida e ainda não enviou */}
                    {podeEnviar ? (
                        <>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarPrint(f); }} />
                            <p className="text-center text-white/60 text-[11px] font-bold uppercase tracking-wider">
                                Mande o resultado da partida
                            </p>
                            <button onClick={() => fileRef.current?.click()} disabled={enviando}
                                className="w-full py-3 rounded-xl bg-[#FFB700] text-black text-sm font-black uppercase tracking-widest hover:bg-yellow-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                {enviando ? <Loader className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                                {enviando ? 'Enviando...' : `Enviar print ${recebidos >= 1 ? `(${recebidos}/${necessarios})` : 'da vitória'}`}
                            </button>
                        </>
                    ) : jaEnviei ? (
                        <div className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-green-500/5 border border-green-500/20 text-green-400 text-xs font-bold">
                            <CheckCircle2 className="w-4 h-4 shrink-0" /> Print enviado — aguardando análise
                        </div>
                    ) : (
                        <p className="text-center text-white/30 text-[10px] uppercase tracking-widest font-bold">
                            {recebidos >= necessarios
                                ? 'Limite de prints atingido'
                                : 'Aguardando os jogadores enviarem o resultado'}
                        </p>
                    )}

                    {/* Contestação — só participante confirmado da partida */}
                    {jogadorConfirmado && (
                    <div className="pt-3 border-t border-white/10">
                        {minhaDisputa ? (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-500/5 border border-green-500/20 text-green-400 text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4" /> Contestação registrada — aguardando análise
                            </div>
                        ) : contestar ? (
                            <div className="space-y-2">
                                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
                                    placeholder="Descreva o motivo da contestação (ex.: resultado reportado incorretamente)..."
                                    rows={3} maxLength={500}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFB700]/50 placeholder:text-white/25" />
                                <div className="flex gap-2">
                                    <button onClick={() => setContestar(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-bold hover:bg-white/10">Cancelar</button>
                                    <button onClick={abrirContestacao} disabled={contestando}
                                        className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-black uppercase tracking-widest hover:bg-red-500/25 disabled:opacity-50 flex items-center justify-center gap-1.5">
                                        <Gavel className="w-3.5 h-3.5" /> {contestando ? 'Enviando...' : 'Enviar'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setContestar(true)}
                                className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white/50 hover:text-red-300 hover:border-red-500/30 text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" /> Contestar resultado
                            </button>
                        )}
                    </div>
                    )}
                </div>
            </div>

            {/* Lightbox do print (mesmo padrão dos logos de time) */}
            <AnimatePresence>
                {lightboxPrint && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setLightboxPrint(null)}
                        className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center cursor-zoom-out"
                    >
                        <motion.img
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            src={api.prints.file(lightboxPrint.id)}
                            alt={`Print de ${lightboxPrint.nomeJogador}`}
                            className="max-w-[min(1400px,94vw)] max-h-[92vh] object-contain rounded-2xl shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setLightboxPrint(null)}
                            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm">
                            <span className="text-white/80 text-xs font-black uppercase tracking-widest">
                                Print de {lightboxPrint.nomeJogador}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
