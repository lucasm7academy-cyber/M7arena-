'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

/** Elo de uma fila ranqueada, como vem do cache da conta do jogo. */
export interface EloFila {
  tier: string;
  rank: string;
  lp: number;
  wins: number;
  losses: number;
}

export interface ChampionStat {
  championName: string;
  games: number;
  wins: number;
  winrate: number;
}

export interface MeuTime {
  id: string;
  nome: string;
  tag: string | null;
  logoUrl: string | null;
  gradientFrom: string | null;
  pdl: number;
  wins: number;
  gamesPlayed: number;
  winrate: number;
  ranking: number | null;
  membroRole: string | null;
}

export interface UserProfileData {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isVip: boolean;
  status: string;
  roles: string[];
  wallet: { mp: number; mc: number };
  gameAccounts: Array<{
    id: string;
    gameId: string;
    externalId: string;
    handle: string;
    verified: boolean;
  }>;

  // Preferências de jogo (antes: profiles.lane_primaria / lane_secundaria)
  lanePrimaria: string | null;
  laneSecundaria: string | null;

  // Redes sociais (antes: colunas soltas em profiles)
  instagram: string | null;
  twitch: string | null;
  youtube: string | null;
  discord: string | null;

  // Recebimento (antes: profiles.chave_pix — agora em user_payout_info)
  pix: { tipo: string | null; chave: string | null; nome: string | null };

  // Derivados da conta do jogo, para exibição
  riotId: string | null;
  eloPrincipal: string;
  eloCache: { soloQ: EloFila | null; flexQ: EloFila | null } | null;
  championsCache: { topChampions: ChampionStat[]; totalGames: number } | null;

  meuTime: MeuTime | null;
}

interface PerfilContextType {
  perfil: UserProfileData | null;
  loading: boolean;
  error: string | null;
  refetchPerfil: () => Promise<void>;
  refetchCargo: () => Promise<void>;
  /**
   * Atualização otimista de campos do perfil já salvos no servidor.
   * Evita um refetch completo só para refletir a edição de uma bio ou de uma lane.
   */
  aplicarPatchLocal: (patch: Partial<UserProfileData>) => void;
}

const PerfilContext = createContext<PerfilContextType | undefined>(undefined);

export function PerfilProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [perfil, setPerfil] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPerfil = useCallback(async () => {
    if (!session?.user?.id) {
      setPerfil(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/perfil/${session.user.id}`);
      if (!res.ok) {
        throw new Error(`Falha ao carregar perfil: ${res.statusText}`);
      }

      const data = await res.json();
      setPerfil(data);
    } catch (err: any) {
      console.error("[PerfilContext] Erro ao buscar perfil:", err);
      setError(err?.message || "Erro inesperado ao carregar dados do usuário.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  const refetchCargo = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/perfil/${session.user.id}/cargo`);
      if (res.ok) {
        const { roles } = await res.json();
        setPerfil((prev) => (prev ? { ...prev, roles } : null));
      }
    } catch (err) {
      console.error("[PerfilContext] Erro ao atualizar cargos:", err);
    }
  }, [session]);

  const aplicarPatchLocal = useCallback((patch: Partial<UserProfileData>) => {
    setPerfil((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPerfil();
    } else if (status === 'unauthenticated') {
      setPerfil(null);
      setLoading(false);
    }
  }, [status, fetchPerfil]);

  return (
    <PerfilContext.Provider
      value={{
        perfil,
        loading,
        error,
        refetchPerfil: fetchPerfil,
        refetchCargo,
        aplicarPatchLocal,
      }}
    >
      {children}
    </PerfilContext.Provider>
  );
}

export function usePerfil() {
  const context = useContext(PerfilContext);
  if (!context) {
    throw new Error('usePerfil deve ser usado dentro de um PerfilProvider');
  }
  return context;
}
