// src/hooks/useSalaChat.ts
// Estado do chat da sala (ADR-040): lista de mensagens, não lidas, histórico e
// autoexclusão de 5 min. O transporte é o socket do useSalaRealtime (já
// assinado); aqui só a UI/estado. Receber = onChatMessage; carregar = onReconnect.

import { useState, useCallback, useEffect, useRef } from 'react';
import { api, type ApiSalaChatMensagem } from '../lib/api';

const TTL_MS = 5 * 60 * 1000;      // autoexclusão
const PRUNE_INTERVALO_MS = 5000;   // varredura leve de expiração

export function useSalaChat(salaId: number, usuarioAtualId?: string) {
    const [mensagens, setMensagens] = useState<ApiSalaChatMensagem[]>([]);
    const [naoLidas, setNaoLidas] = useState(0);

    // IDs já conhecidos: a mesma mensagem pode chegar por mais de um caminho
    // (socket + histórico). Espelha `mensagens` para decidir, fora do updater,
    // se a chegada é realmente nova — duplicata não conta como não-lida.
    const idsRef = useRef<Set<number>>(new Set());

    const receber = useCallback((msg: ApiSalaChatMensagem) => {
        if (idsRef.current.has(msg.id)) return; // duplicata: não conta não-lida
        idsRef.current.add(msg.id);
        setMensagens((prev) => [...prev, msg]);
        if (msg.user_id !== usuarioAtualId) {
            setNaoLidas((n) => n + 1);
        }
    }, [usuarioAtualId]);

    const marcarLidas = useCallback(() => setNaoLidas(0), []);

    const carregarHistorico = useCallback(async () => {
        try {
            const rows = await api.matches.mensagens(salaId);
            idsRef.current = new Set(rows.map((m) => m.id));
            setMensagens(rows);
        } catch (err) {
            // 403 (visitante/não-participante) é esperado e o widget nem é
            // montado nesse caso. Qualquer outro erro não pode virar falha
            // invisível (invariante: nunca engolir erro) — loga e mantém vazio.
            console.error('[Chat] Falha ao carregar histórico da sala:', err);
        }
    }, [salaId]);

    // Autoexclusão de 5 min: varredura leve, remove o que expirou.
    useEffect(() => {
        const id = setInterval(() => {
            setMensagens((prev) => {
                const corte = Date.now() - TTL_MS;
                const filtrado = prev.filter((m) => new Date(m.created_at).getTime() > corte);
                return filtrado.length === prev.length ? prev : filtrado;
            });
        }, PRUNE_INTERVALO_MS);
        return () => clearInterval(id);
    }, []);

    return { mensagens, naoLidas, receber, carregarHistorico, marcarLidas };
}
