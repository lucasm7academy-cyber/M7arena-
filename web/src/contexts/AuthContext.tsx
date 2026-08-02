// contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api, ApiUser } from '../lib/api';

/**
 * Forma compatível com o `User` do Supabase que as telas já consomem.
 *
 * O app inteiro usa só três coisas: `user.id` (42 lugares), `user.email` (4) e
 * `user_metadata.{full_name,avatar_url}` (5, todos no LayoutWrapper). Manter
 * exatamente esses nomes é o que permite trocar a origem da sessão sem tocar em
 * uma linha de JSX — ADR-005.
 */
export interface AuthUser {
  id: string;
  email: string;
  isVip: boolean;
  roles: string[];
  user_metadata: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

function toAuthUser(u: ApiUser): AuthUser {
  return {
    id: u.id,
    email: u.email,
    isVip: Boolean(u.isVip),
    roles: u.roles ?? [],
    user_metadata: {
      full_name: u.displayName ?? null,
      avatar_url: u.avatarUrl ?? null,
    },
  };
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, displayName: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * A sessão vive num cookie httpOnly (ADR-011), então o cliente não tem como
   * lê-la: a única forma de saber quem está logado é perguntar ao servidor.
   * `/api/auth/me` responde 401 quando não há sessão, e o SDK transforma isso
   * em exceção — por isso o catch trata 401 como "deslogado", não como falha.
   */
  const carregarSessao = useCallback(async () => {
    try {
      const { user: apiUser } = await api.auth.me();
      setUser(apiUser ? toAuthUser(apiUser) : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let ativo = true;

    (async () => {
      await carregarSessao();
      if (ativo) setIsLoading(false);
    })();

    return () => {
      ativo = false;
    };
  }, [carregarSessao]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: apiUser } = await api.auth.login(email, password);
    const novo = toAuthUser(apiUser);
    setUser(novo);
    return novo;
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { user: apiUser } = await api.auth.register({ email, password, displayName });
      const novo = toAuthUser(apiUser);
      setUser(novo);
      return novo;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      // Mesmo que a chamada falhe, o cliente tem que sair do estado logado —
      // deixar o usuário "logado" numa sessão que o servidor já matou é pior.
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refresh: carregarSessao,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ✅ Hook principal - use SEMPRE em vez de qualquer outra coisa
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}

// ✅ Helper opcional para acesso direto ao user (apenas sintaxe sugar)
export function useAuthUser() {
  const { user } = useAuth();
  return user;
}
