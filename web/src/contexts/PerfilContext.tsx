import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { buildProfileIconUrl } from '../api/riot';

export interface PerfilData {
  id: string;
  nome: string;
  tag: string;
  elo: string;
  avatar?: string;
  riotId?: string;
  iconId?: number;
  contaVinculada: boolean;
  isVip: boolean;
  saldo: number;
  cargo: string;
  twitch?: string;
}

interface PerfilContextType {
  perfil: PerfilData | null;
  loading: boolean;
  refetch: () => void;
  refetchCargo: () => Promise<void>;
  desvincular: () => void;
  // Dados adicionais da RPC expandida
  profileData?: any;
  myTeam?: any;
  eloCache?: any;
  championsCache?: any;
}

// Hook com fallback seguro para consumidores
export function usePerfilSafe(): PerfilContextType {
  const context = useContext(PerfilContext);
  if (!context) {
    return {
      perfil: null,
      loading: true,
      refetch: () => {},
      refetchCargo: async () => {},
      desvincular: () => {},
    };
  }
  return context;
}

const PerfilContext = createContext<PerfilContextType | null>(null);

export function PerfilProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [eloCache, setEloCache] = useState<any>(null);
  const [championsCache, setChampionsCache] = useState<any>(null);

  const carregarPerfil = useCallback(async () => {
    if (!user) {
      setPerfil(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // ✅ RPC otimizada: 5 queries → 1 chamada (80% mais leve!)
      const { data: perfilData, error } = await supabase
        .rpc('carregar_perfil_completo', { p_user_id: user.id });

      if (error) throw error;

      const contaRiot = perfilData?.contaRiot;
      const profile = perfilData?.profile;
      const saldoData = perfilData?.saldoData;
      const adminData = perfilData?.adminData;
      const team = perfilData?.myTeam;

      const cargo = adminData?.cargo ?? 'jogador';

      // ✅ Armazenar dados da RPC expandida para a página de perfil usar
      setProfileData(profile);
      // ✅ Mapear myTeam: converter snake_case do RPC para camelCase
      if (team) {
        setMyTeam({
          id: team.id,
          nome: team.nome,
          name: team.nome, // Para compatibilidade
          tag: team.tag,
          logoUrl: team.logo_url,
          logo_url: team.logo_url,
          gradientFrom: team.gradient_from,
          gradient_from: team.gradient_from,
          gradientTo: team.gradient_to,
          gradient_to: team.gradient_to,
          pdl: team.pdl,
          winrate: team.winrate,
          ranking: team.ranking,
          wins: team.wins,
          gamesPlayed: team.games_played,
          games_played: team.games_played,
          donoId: team.dono_id,
          dono_id: team.dono_id,
          membro_role: team.membro_role,
        });
      } else {
        setMyTeam(null);
      }
      setEloCache(contaRiot?.elo_cache);
      setChampionsCache(contaRiot?.champions_cache);

      if (contaRiot) {
        const [nome, tag] = (contaRiot.riot_id || '').split('#');
        const avatarUrl = contaRiot.profile_icon_id
          ? buildProfileIconUrl(contaRiot.profile_icon_id)
          : undefined;

        setPerfil({
          id: user.id,
          nome: nome || user.email?.split('@')[0] || 'Jogador',
          tag: tag ? `#${tag}` : '',
          elo: contaRiot.elo_cache?.soloQ?.tier || 'Sem Elo',
          avatar: avatarUrl,
          riotId: contaRiot.riot_id,
          iconId: contaRiot.profile_icon_id,
          contaVinculada: true,
          isVip: profile?.is_vip ?? false,
          saldo: saldoData?.saldo ?? 0,
          cargo,
          twitch: profile?.twitch,
        });
      } else {
        setPerfil({
          id: user.id,
          nome: user.email?.split('@')[0] || 'Jogador',
          tag: '',
          elo: 'Sem Elo',
          contaVinculada: false,
          isVip: profile?.is_vip ?? false,
          saldo: saldoData?.saldo ?? 0,
          cargo,
          twitch: profile?.twitch,
        });
      }

    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load perfil once on user change, cache across all routes
  useEffect(() => {
    if (!user) {
      setPerfil(null);
      setLoading(false);
      return;
    }

    carregarPerfil();
  }, [user?.id]); // Only reload when user ID changes (login/logout)

  const desvincular = useCallback(() => {
    if (!user) return;
    setPerfil({
      id: user.id,
      nome: user.email?.split('@')[0] || 'Jogador',
      tag: '',
      elo: 'Sem Elo',
      contaVinculada: false,
      isVip: false,
      saldo: 0,
      cargo: 'jogador',
    });
  }, [user]);

  // ✅ Atualizar cargo quando admin avisar (zero overhead até haver mudança)
  const refetchCargo = useCallback(async () => {
    if (!user || !perfil) return;

    try {
      // ✅ Schema novo: cargo vive em `platform_roles`.
      const { data: cargoData } = await supabase
        .from('platform_roles')
        .select('cargo')
        .eq('user_id', user.id)
        .maybeSingle();

      setPerfil((prev) => prev ? { ...prev, cargo: cargoData?.cargo ?? 'jogador' } : null);
    } catch (err) {
    }
  }, [user, perfil]);

  return (
    <PerfilContext.Provider value={{
      perfil,
      loading,
      refetch: carregarPerfil,
      refetchCargo,
      desvincular,
      profileData,
      myTeam,
      eloCache,
      championsCache
    }}>
      {children}
    </PerfilContext.Provider>
  );
}

export function usePerfil() {
  const context = useContext(PerfilContext);
  if (!context) {
    throw new Error('usePerfil deve ser usado dentro de PerfilProvider');
  }
  return context;
}
