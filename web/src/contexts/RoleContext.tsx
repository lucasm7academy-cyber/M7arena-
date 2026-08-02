// src/contexts/RoleContext.tsx
// Contexto de papel/cargo do usuário na plataforma
// 'admin' = proprietario ou admin | 'player' = demais cargos
//
// ⚡ OTIMIZAÇÃO: Lê o cargo do PerfilContext (que já carrega via RPC única
// `carregar_perfil_completo`) em vez de fazer uma SELECT redundante em
// `admin_usuarios` em toda sessão. Mantém a mesma API pública.

import React, { createContext, useContext, useMemo } from 'react';
import { usePerfilSafe } from './PerfilContext';

type Role = 'admin' | 'player';

interface RoleContextValue {
  role: Role;
  cargo: string | null;
  loadingRole: boolean;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'player',
  cargo: null,
  loadingRole: true,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { perfil, loading } = usePerfilSafe();

  const value = useMemo<RoleContextValue>(() => {
    const userCargo = perfil?.cargo ?? null;
    const role: Role =
      userCargo === 'admin' || userCargo === 'proprietario' ? 'admin' : 'player';
    return {
      role,
      cargo: userCargo,
      loadingRole: loading,
    };
  }, [perfil?.cargo, loading]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
