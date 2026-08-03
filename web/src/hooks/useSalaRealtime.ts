/**
 * useSalaRealtime — assina mudanças de uma sala via WebSocket próprio (P4,
 * design v3 §7).
 *
 * O socket NÃO transporta dados da sala: só avisa "a sala X mudou"
 * (`{ type: "match_update", matchId }`). Ao receber, faz debounce de 250ms e
 * chama `onUpdate(matchId)` — quem consome o hook refaz `GET /api/matches/:id`
 * (que revalida permissão no servidor; trava 4).
 *
 * Reconexão automática com backoff (1s, 2s, 4s... máx 30s): ao reconectar,
 * re-assina a sala e chama `onReconnect` (para refazer o GET e recuperar o que
 * passou offline). Cleanup no unmount.
 */

import { useEffect, useRef } from "react";

const WS_URL = () =>
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

const DEBOUNCE_MS = 250;
const RECONEXAO_BASE_MS = 1_000;
const RECONEXAO_MAX_MS = 30_000;

export interface UseSalaRealtimeOptions {
  /** Chamado após debounce de 250ms quando a sala mudou. */
  onUpdate: (matchId: string | number) => void;
  /** Chamado ao reconectar (após re-assinar), para refazer o GET. */
  onReconnect?: () => void;
  /** Pausa a conexão quando false (default true). */
  enabled?: boolean;
}

export function useSalaRealtime(matchId: string | number, options: UseSalaRealtimeOptions) {
  const { onUpdate, onReconnect, enabled = true } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const debounceRef = useRef<number | null>(null);
  const backoffRef = useRef(RECONEXAO_BASE_MS);
  const primeiraConexaoRef = useRef(true);
  const ativoRef = useRef(enabled);

  // Callbacks e id em refs: mudanças não recriam a conexão.
  const onUpdateRef = useRef(onUpdate);
  const onReconnectRef = useRef(onReconnect);
  const matchIdRef = useRef(matchId);
  onUpdateRef.current = onUpdate;
  onReconnectRef.current = onReconnect;
  matchIdRef.current = matchId;

  useEffect(() => {
    ativoRef.current = enabled;
    if (!enabled) return;

    let desmontado = false;

    const agendarUpdate = (recebido: string | number) => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        onUpdateRef.current(recebido);
      }, DEBOUNCE_MS);
    };

    const conectar = () => {
      if (!ativoRef.current || desmontado) return;

      const ws = new WebSocket(WS_URL());
      wsRef.current = ws;

      ws.onopen = () => {
        const reconectou = !primeiraConexaoRef.current;
        primeiraConexaoRef.current = false;
        backoffRef.current = RECONEXAO_BASE_MS;
        ws.send(JSON.stringify({ type: "subscribe_match", matchId: matchIdRef.current }));
        if (reconectou && onReconnectRef.current) onReconnectRef.current();
      };

      ws.onmessage = (evento) => {
        let dados: any;
        try {
          dados = JSON.parse(evento.data);
        } catch {
          return; // mensagem não-JSON é ignorada
        }
        if (dados?.type === "match_update") {
          agendarUpdate(dados.matchId ?? matchIdRef.current);
        }
      };

      ws.onclose = () => {
        if (desmontado) return;
        wsRef.current = null;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, RECONEXAO_MAX_MS);
        window.setTimeout(conectar, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    conectar();

    return () => {
      desmontado = true;
      ativoRef.current = false;
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, matchId]);
}
