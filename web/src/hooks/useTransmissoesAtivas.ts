import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

interface TimeInfo {
  id: string;
  nome: string;
  tag: string;
  logo_url?: string;
  gradient_from?: string;
}

export interface TransmissaoAtiva {
  id: string;
  user_id: string;
  twitch_channel: string;
  titulo: string;
  modo: 'padrao' | 'amistoso' | 'campeonato';
  time1?: TimeInfo;
  time2?: TimeInfo;
  thumbnail_url: string;
  campeonato_id?: string;
  nomecamp?: string;
}

export function useTransmissoesAtivas() {
  const [transmissoes, setTransmissoes] = useState<TransmissaoAtiva[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    let cancelled = false;

    const fetchTransmissoes = async () => {
      try {
        const now = new Date().toISOString();

        // Buscar transmissões ativas não expiradas
        const { data: txData, error: txError } = await supabase
          .from('transmissoes')
          .select('id, user_id, twitch_channel, titulo, modo, time1_id, time2_id, campeonato_id')
          .eq('ativo', true)
          .gt('expira_em', now);

        if (cancelled) return;

        if (txError || !txData || txData.length === 0) {
          setTransmissoes([]);
          setLoading(false);
          return;
        }

        // Deduplicate por user_id
        const seenUsers = new Set<string>();
        const uniqueTx = txData.filter((tx: any) => {
          if (seenUsers.has(tx.user_id)) return false;
          seenUsers.add(tx.user_id);
          return true;
        });

        // Coletar todos os time_ids e campeonato_ids únicos
        const timeIds = new Set<string>();
        const campIds = new Set<string>();
        uniqueTx.forEach((tx: any) => {
          if (tx.time1_id) timeIds.add(tx.time1_id);
          if (tx.time2_id) timeIds.add(tx.time2_id);
          if (tx.campeonato_id) campIds.add(tx.campeonato_id);
        });

        // Buscar dados dos times de uma vez
        const timesMap = new Map<string, TimeInfo>();
        if (timeIds.size > 0) {
          const timesData = await api.teams.batch(Array.from(timeIds));
          if (timesData) {
            timesData.forEach((t: any) => timesMap.set(t.id, t));
          }
        }

        // Buscar dados dos campeonatos
        const campsMap = new Map<string, { id: string; nome: string }>();
        if (campIds.size > 0) {
          const { data: campsData } = await supabase
            .from('campeonatos')
            .select('id, nome')
            .in('id', Array.from(campIds));

          if (campsData) {
            campsData.forEach((c: any) => campsMap.set(c.id, { id: c.id, nome: c.nome }));
          }
        }

        // Montar resultado
        const resultado: TransmissaoAtiva[] = uniqueTx.map((tx: any) => ({
          id: tx.id,
          user_id: tx.user_id,
          twitch_channel: tx.twitch_channel,
          titulo: tx.titulo || 'Transmissão ao vivo',
          modo: tx.modo || 'padrao',
          time1: tx.time1_id ? timesMap.get(tx.time1_id) : undefined,
          time2: tx.time2_id ? timesMap.get(tx.time2_id) : undefined,
          thumbnail_url: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${tx.twitch_channel.toLowerCase()}-600x600.jpg`,
          campeonato_id: tx.campeonato_id,
          nomecamp: tx.campeonato_id ? campsMap.get(tx.campeonato_id)?.nome : undefined
        }));

        setTransmissoes(resultado);
      } catch (err) {
        if (cancelled) return;
        console.error('Erro ao buscar transmissões:', err);
        setTransmissoes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTransmissoes();
    return () => { cancelled = true; };
  }, []);

  return { transmissoes, loading };
}
