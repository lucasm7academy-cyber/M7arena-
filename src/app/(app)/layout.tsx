import React from 'react';
import { AppProviders } from './providers';
import LayoutWrapper from '@/components/layout/LayoutWrapper';

/**
 * A área logada nunca é pré-renderizada em tempo de build.
 *
 * Todas estas telas dependem de sessão e de dados do banco, e várias usam
 * useSearchParams — que, sem isto, faz o build de produção falhar exigindo
 * um Suspense em volta de cada página. Renderizar sob demanda é o
 * comportamento correto aqui, não um contorno.
 */
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <LayoutWrapper>{children}</LayoutWrapper>
    </AppProviders>
  );
}
