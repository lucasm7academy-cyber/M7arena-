import React, { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getDDRVersion } from "./api/riot";

import Layout from "./components/layout/LayoutWrapper";
import { VerificacaoProvider } from './contexts/VerificacaoContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PerfilProvider } from './contexts/PerfilContext';
import { RoleProvider } from './contexts/RoleContext';
import VerificacaoStatus from './components/notifications/VerificacaoStatus';
// ✅ Recupera de "chunk velho" após um novo deploy.
// Quando sai uma versão nova, os arquivos .js mudam de hash. Se o usuário está
// com a versão antiga aberta e navega, o import dinâmico falha (o arquivo antigo
// não existe mais). Em vez de deixar a tela preta/travada, recarrega a página 1x
// para pegar a versão nova. O flag em sessionStorage evita loop de reload.
function lazyWithRetry(factory: () => Promise<any>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      window.sessionStorage.removeItem('chunk_reloaded');
      return mod;
    } catch (err) {
      if (!window.sessionStorage.getItem('chunk_reloaded')) {
        window.sessionStorage.setItem('chunk_reloaded', '1');
        window.location.reload();
        return { default: () => null };
      }
      throw err;
    }
  });
}

// ✅ Lazy loading para páginas que não são imediatamente necessárias
const Login = lazyWithRetry(() => import("./pages/Login"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const ResetHandler = lazyWithRetry(() => import("./pages/ResetHandler"));
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"));
const Lobby = lazyWithRetry(() => import("./pages/Lobby"));
const Jogar = lazyWithRetry(() => import("./pages/Jogar"));

const SalaMod1 = lazyWithRetry(() => import("./pages/SalaMod1"));
const Vincular = lazyWithRetry(() => import("./pages/Vincular"));
const DiscordCallback = lazyWithRetry(() => import("./pages/DiscordCallback"));
const Perfil = lazyWithRetry(() => import("./pages/perfil"));
const Equipes = lazyWithRetry(() => import("./pages/equipes"));
const Players = lazyWithRetry(() => import("./pages/players"));
const TimePage = lazyWithRetry(() => import("./pages/TimePage"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const AdminCargos = lazyWithRetry(() => import("./pages/AdminCargos"));
const AdminContatos = lazyWithRetry(() => import("./pages/AdminContatos"));
const Streamers = lazyWithRetry(() => import("./pages/Streamers"));
const Politicas = lazyWithRetry(() => import("./pages/Politicas"));
const Tutorial = lazyWithRetry(() => import("./pages/Tutorial"));
const Campeonatos = lazyWithRetry(() => import('./pages/campeonatos'));
const CampeonatoDetalhes = lazyWithRetry(() => import('./pages/CampeonatoDetalhes'));
const CreateCampPage = lazyWithRetry(() => import('./pages/createCampPage'));
const MinhasPartidas = lazyWithRetry(() => import("./pages/MinhasPartidas"));
const Recrutamento = lazyWithRetry(() => import("./pages/recrutamento"));
const QuemSomos = lazyWithRetry(() => import("./pages/QuemSomos"));

// ✅ Componente para inicializar o cache do DDragon (seguro)
function DDRagonInitializer() {
  useEffect(() => {
    // Inicializa o cache da versão do DDragon apenas uma vez
    getDDRVersion();
  }, []);
  return null;
}


function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050506]">
        <div className="animate-pulse text-primary">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RouteWithSuspense({ element }: { element: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#050506]">
        <div className="animate-pulse text-primary">Carregando...</div>
      </div>
    }>
      {element}
    </Suspense>
  );
}

// ✅ Rede de segurança: captura qualquer erro de renderização e mostra uma tela
// de "recarregar" em vez de deixar a tela preta/travada. Se for erro de chunk
// antigo (após deploy), recarrega sozinho para pegar a versão nova.
class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    const msg = String(error?.message || error || '');
    if (/dynamically imported module|Loading chunk|Failed to fetch|MIME type/i.test(msg)) {
      if (!window.sessionStorage.getItem('chunk_reloaded')) {
        window.sessionStorage.setItem('chunk_reloaded', '1');
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#050506] text-white px-6 text-center">
          <p className="text-white/60 text-sm font-medium max-w-sm">
            Ops, algo deu errado ao carregar a página. Recarregue para continuar.
          </p>
          <button
            onClick={() => { window.sessionStorage.removeItem('chunk_reloaded'); window.location.reload(); }}
            className="px-6 py-3 rounded-xl bg-primary text-black font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-transform"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * RootRedirect
 *
 * Na rota "/", verifica se a URL contém parâmetros OAuth (?code=, #access_token=, etc.).
 * Se sim, mostra um loading e deixa o OAuthCallbackHandler / Supabase processar o callback.
 * Se não, redireciona normalmente para /lobby.
 *
 * Isso resolve o problema de o <Navigate to="/lobby"> descartar o ?code= antes
 * do Supabase trocar o authorization code por uma sessão.
 */
function RootRedirect() {
  const { user, isLoading } = useAuth();
  const url = window.location.href;
  const hasOAuthParams =
    url.includes('?code=') || url.includes('&code=') ||
    url.includes('#access_token=') || url.includes('#error=') ||
    url.includes('?error=') || url.includes('&error=');

  // Se tem parâmetros OAuth, espera o OAuthCallbackHandler processar
  if (hasOAuthParams) {
    // Se já tem sessão (callback processado com sucesso), redireciona
    if (!isLoading && user) {
      return <Navigate to="/lobby" replace />;
    }
    // Mostra loading enquanto processa o callback
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050506]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-white/60 text-sm">Finalizando login...</p>
        </div>
      </div>
    );
  }

  // Sem parâmetros OAuth, redireciona normalmente para o lobby
  return <Navigate to="/lobby" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <PerfilProvider>
        <RoleProvider>
        <VerificacaoProvider>
          <BrowserRouter>
          <DDRagonInitializer /> {/* ✅ Inicialização segura do DDragon */}
          <VerificacaoStatus />
          <RootErrorBoundary>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<RouteWithSuspense element={<Login />} />} />
            <Route path="/reset-password" element={<RouteWithSuspense element={<ResetHandler />} />} />
            <Route path="/resetpassword" element={<RouteWithSuspense element={<ResetPassword />} />} />

                        {/* OAuth Callback */}
                        <Route path="/auth/callback" element={<RouteWithSuspense element={<AuthCallback />} />} />

                        {/* Admin em tela cheia: fora do Layout do site (sem header/sidebar do
                            site, como nas salas). O painel tem sidebar própria + botão voltar. */}
                        <Route path="/admin" element={<PrivateRoute><RouteWithSuspense element={<Admin />} /></PrivateRoute>} />

                        {/* Rotas com Layout */}
            <Route element={<Layout />}>
              {/* Rotas Públicas */}
              <Route path="/lobby" element={<RouteWithSuspense element={<Lobby />} />} />
              <Route path="/times" element={<RouteWithSuspense element={<Equipes />} />} />
              <Route path="/times/:id" element={<RouteWithSuspense element={<TimePage />} />} />
              <Route path="/players" element={<RouteWithSuspense element={<Players />} />} />
              <Route path="/streamers" element={<RouteWithSuspense element={<Streamers />} />} />
              <Route path="/quem-somos" element={<RouteWithSuspense element={<QuemSomos />} />} />
              <Route path="/politicas" element={<RouteWithSuspense element={<Politicas />} />} />
              <Route path="/campeonatos" element={<RouteWithSuspense element={<Campeonatos />} />} />
              <Route path="/campeonato/:id" element={<RouteWithSuspense element={<CampeonatoDetalhes />} />} />
              <Route path="/tutorial" element={<RouteWithSuspense element={<Tutorial />} />} />
              <Route path="/recrutamento" element={<RouteWithSuspense element={<Recrutamento />} />} />
              <Route path="/auth/discord/callback" element={<RouteWithSuspense element={<DiscordCallback />} />} />

              {/* Rotas Privadas (Necessitam de Conta) */}
              {/* `/jogar` é vitrine pública (design v3 §2.1): visitante vê salas e
                  estado; ações abrem o modal de cadastro/login dentro de Jogar.tsx. */}
              <Route path="/jogar" element={<RouteWithSuspense element={<Jogar />} />} />
              <Route path="/perfil" element={<PrivateRoute><RouteWithSuspense element={<Perfil />} /></PrivateRoute>} />
              <Route path="/partidas" element={<PrivateRoute><RouteWithSuspense element={<MinhasPartidas />} /></PrivateRoute>} />
              <Route path="/vincular" element={<PrivateRoute><RouteWithSuspense element={<Vincular />} /></PrivateRoute>} />
              <Route path="/admin/criar-campeonato" element={<PrivateRoute><RouteWithSuspense element={<CreateCampPage />} /></PrivateRoute>} />
              {/* Sala por modo: /5v5/:id, /aram/:id, /1v1/:id, /time_vs_time/:id.
                  O slug reflete o modo real da sala (rota pública — visitante vê sem login). */}
              <Route path="/5v5/:id" element={<RouteWithSuspense element={<SalaMod1 />} />} />
              <Route path="/aram/:id" element={<RouteWithSuspense element={<SalaMod1 />} />} />
              <Route path="/1v1/:id" element={<RouteWithSuspense element={<SalaMod1 />} />} />
              <Route path="/time_vs_time/:id" element={<RouteWithSuspense element={<SalaMod1 />} />} />
              <Route path="/admin/cargos" element={<PrivateRoute><RouteWithSuspense element={<AdminCargos />} /></PrivateRoute>} />
              <Route path="/admin/contatos" element={<PrivateRoute><RouteWithSuspense element={<AdminContatos />} /></PrivateRoute>} />
            </Route>
          </Routes>
          </RootErrorBoundary>
            </BrowserRouter>
          </VerificacaoProvider>
        </RoleProvider>
      </PerfilProvider>
    </AuthProvider>
  );
}