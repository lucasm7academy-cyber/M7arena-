'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { PerfilProvider } from '@/contexts/PerfilContext';

/**
 * Providers de cliente da área logada.
 *
 * Fica separado do layout porque o layout precisa ser Server Component para
 * poder declarar `dynamic = 'force-dynamic'`. Um arquivo com 'use client' não
 * aceita essas configurações de rota.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PerfilProvider>{children}</PerfilProvider>
    </SessionProvider>
  );
}
