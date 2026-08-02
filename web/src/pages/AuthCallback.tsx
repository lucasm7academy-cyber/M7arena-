import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Rota /auth/callback — desativada (ADR-011).
 *
 * Era onde o Google devolvia o usuário no fluxo do GoTrue, para o cliente trocar
 * o `code` por sessão. Agora o Google devolve direto em
 * `/api/auth/google/callback`, no servidor, que cria a sessão e manda o
 * navegador para o /lobby já logado.
 *
 * A rota permanece registrada só para não deixar link antigo ou favorito em 404.
 *
 * Versão original em `D:\Aplicativos\M7AcademySite\src\pages\AuthCallback.tsx`.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/lobby', { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <p className="text-lg text-gray-200">Finalizando login...</p>
      </div>
    </div>
  );
}
