import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';
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
  // Advertências manuais + ban (ADR-033) — vêm de /profiles/me.
  advertencias?: number;
  advertenciasMax?: number;
  status?: string;
  banMotivo?: string | null;
  banAutomatico?: boolean;
  suspensaAte?: string | null;
  termosAceitos?: boolean;
}

interface PerfilContextType {
  perfil: PerfilData | null;
  loading: boolean;
  refetch: () => void;
  refetchCargo: () => Promise<void>;
  desvincular: () => void;
  // Dados adicionais que a RPC carregava junto (agora vêm da API própria)
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

/** Cargo legado a partir das roles do schema novo (user_roles). */
function rolesToCargo(roles: string[]): string {
  if (roles.includes('proprietario')) return 'proprietario';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('organizador') || roles.includes('organizer')) return 'organizador';
  return 'jogador';
}

/**
 * Converte o time (ApiLegacyTeamDetail) no shape camelCase que o fork consome.
 * `membro_role` é a lane do usuário logado dentro do time (vinda de time_membros).
 */
function toMyTeam(team: any, userId: string) {
  const membro = (team?.time_membros ?? []).find((m: any) => m.user_id === userId);
  return {
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
    membro_role: membro?.lane ?? null,
  };
}

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
      // RPC carregar_perfil_completo (5 queries em 1) → 3 rotas da API própria:
      // /profiles/me (profile + contaRiot + roles), /wallet/balance (saldo) e
      // /teams/by-user/:id (time). O shape de PerfilData não muda.
      const [me, balance, userTeams] = await Promise.all([
        api.profiles.me(),
        api.wallet.balance(),
        api.teams.byUser(user.id),
      ]);

      const contaRiot = me?.riotAccount ?? null;
      const profile = me?.profile ?? null;
      const cargo = rolesToCargo(me?.roles ?? []);

      // ✅ Dados para a página de perfil usar (shape legado de profiles)
      setProfileData(profile);

      // ✅ myTeam: by-user entrega o id/time em batch; o detail traz o shape
      // completo (pdl, winrate, ranking, dono_id, time_membros) que o card usa.
      const membership = userTeams?.memberships?.find((m: any) => m.status === 'ativo')
        ?? userTeams?.memberships?.[0];
      if (membership?.time_id) {
        try {
          const team = await api.teams.detail(membership.time_id);
          setMyTeam(toMyTeam(team, user.id));
        } catch (err) {
          console.error('❌ Erro ao carregar time no perfil:', err);
          setMyTeam(null);
        }
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
          saldo: balance?.mc ?? 0,
          cargo,
          twitch: profile?.twitch,
          advertencias: me?.advertencias ?? 0,
          advertenciasMax: me?.advertenciasMax ?? 3,
          status: me?.status ?? 'active',
          banMotivo: me?.banMotivo ?? null,
          banAutomatico: me?.banAutomatico ?? false,
          suspensaAte: me?.suspensaAte ?? null,
          termosAceitos: me?.termosAceitos ?? false,
        });
      } else {
        setPerfil({
          id: user.id,
          nome: user.email?.split('@')[0] || 'Jogador',
          tag: '',
          elo: 'Sem Elo',
          contaVinculada: false,
          isVip: profile?.is_vip ?? false,
          saldo: balance?.mc ?? 0,
          cargo,
          twitch: profile?.twitch,
          advertencias: me?.advertencias ?? 0,
          advertenciasMax: me?.advertenciasMax ?? 3,
          status: me?.status ?? 'active',
          banMotivo: me?.banMotivo ?? null,
          banAutomatico: me?.banAutomatico ?? false,
          suspensaAte: me?.suspensaAte ?? null,
          termosAceitos: me?.termosAceitos ?? false,
        });
      }
    } catch (err) {
      console.error('❌ Erro ao carregar perfil:', err);
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
      // Cargo vive em user_roles; /auth/me devolve as roles do usuário logado.
      const { user: apiUser } = await api.auth.me();
      const roles = apiUser?.roles ?? [];
      const cargo = rolesToCargo(roles);
      setPerfil((prev) => prev ? { ...prev, cargo } : null);
    } catch (err) {
      console.error('❌ Erro ao atualizar cargo:', err);
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
