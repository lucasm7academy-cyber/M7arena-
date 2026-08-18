// src/components/partidas/ChatDaSala.tsx
// Chat da sala (ADR-040): widget flutuante no canto inferior esquerdo, quase
// encostado na borda, aberto por padrão. Fundo preto sólido + borda dourada
// cortada (frame). Só o nome do jogador muda de cor (blue/red/dourado conforme
// o time do envio); o resto do accent é o dourado padrão.

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import type { ApiSalaChatMensagem } from '../../lib/api';

// Borda cortada no padrão das vagas/cards: wrapper com clipPath (frame) +
// conteúdo interno com clipPath um pouco menor (fill). O p-[2px] do frame
// expõe a cor do frame como borda — clip-path não corta o `border` nativo.
const CUT_FRAME = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const CUT_INNER = 'polygon(8.6px 0, 100% 0, 100% calc(100% - 8.6px), calc(100% - 8.6px) 100%, 0 100%, 0 8.6px)';

interface ChatDaSalaProps {
  mensagens: ApiSalaChatMensagem[];
  naoLidas: number;
  onMarcarLidas: () => void;
  enviarChat: (body: string) => void;
  carregarHistorico: () => void;
}

export default function ChatDaSala({ mensagens, naoLidas, onMarcarLidas, enviarChat, carregarHistorico }: ChatDaSalaProps) {
    const [aberto, setAberto] = useState(true);
    const [texto, setTexto] = useState('');
    const [roladoPraCima, setRoladoPraCima] = useState(false);
    const listaRef = useRef<HTMLDivElement | null>(null);

    // Carrega o histórico ao montar (só é montado em sala ativa).
    useEffect(() => {
        carregarHistorico();
    }, [carregarHistorico]);

    // Auto-scroll: se não rolou pra cima, acompanha a última mensagem.
    useEffect(() => {
        const el = listaRef.current;
        if (!el || roladoPraCima) return;
        el.scrollTop = el.scrollHeight;
    }, [mensagens, roladoPraCima]);

    // Abrir o painel marca as não lidas como lidas.
    useEffect(() => {
        if (aberto) {
            onMarcarLidas();
            setRoladoPraCima(false);
        }
    }, [aberto, onMarcarLidas]);

    const handleScroll = () => {
        const el = listaRef.current;
        if (!el) return;
        const noFundo = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        setRoladoPraCima(!noFundo);
        if (noFundo && naoLidas > 0) onMarcarLidas();
    };

    const enviar = () => {
        const body = texto.trim();
        if (!body) return;
        enviarChat(body);
        setTexto('');
    };

    const minimizado = (
        <button
            onClick={() => setAberto(true)}
            className="relative p-[1px] bg-[#FFB700] transition-colors"
            style={{ clipPath: CUT_FRAME }}
            aria-label="Abrir chat da sala"
        >
            <span className="flex items-center gap-2 bg-[#0A0A0A] px-4 py-3 text-[#FFB700]"
                style={{ clipPath: CUT_INNER }}>
                <MessageSquare className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-widest">Chat</span>
            </span>
            {naoLidas > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center">
                    {naoLidas > 99 ? '99+' : naoLidas}
                </span>
            )}
        </button>
    );

    const expandido = (
        <div className="w-[calc(100vw-32px)] max-w-[320px] p-[1px] bg-[#FFB700]"
            style={{ clipPath: CUT_FRAME }}>
            <div className="h-[380px] flex flex-col bg-[#0A0A0A] overflow-hidden"
                style={{ clipPath: CUT_INNER }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-[#FFB700]" />
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-white">Chat da Sala</span>
                    </div>
                    <button onClick={() => setAberto(false)} className="text-white/40 hover:text-white" aria-label="Minimizar chat">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div ref={listaRef} onScroll={handleScroll}
                    className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                    {mensagens.length === 0 && (
                        <p className="text-xs text-white/40 text-center pt-6">
                            Nenhuma mensagem ainda. As mensagens somem após 5 minutos.
                        </p>
                    )}
                    {mensagens.map((m) => (
                        <div key={m.id} className="space-y-0.5">
                            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: m.cor || '#FFB700' }}>{m.nome}</p>
                            <p className="text-sm text-white/90 break-words leading-snug">{m.body}</p>
                        </div>
                    ))}
                </div>

                <div className="p-2 border-t border-white/10 flex items-center gap-2">
                    <input
                        value={texto}
                        onChange={(e) => setTexto(e.target.value.slice(0, 200))}
                        onKeyDown={(e) => { if (e.key === 'Enter') enviar(); }}
                        maxLength={200}
                        placeholder="Digite sua mensagem..."
                        className="flex-1 bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
                    />
                    <button onClick={enviar}
                        className="p-[1.5px] bg-black hover:bg-black transition-colors shrink-0"
                        style={{ clipPath: CUT_FRAME }}
                        aria-label="Enviar mensagem">
                        <span className="flex items-center justify-center bg-[#FFB700] px-3 py-2 text-black"
                            style={{ clipPath: CUT_INNER }}>
                            <Send className="w-4 h-4" />
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed bottom-4 left-4 z-[120]">
            {aberto ? expandido : minimizado}
        </div>
    );
}
