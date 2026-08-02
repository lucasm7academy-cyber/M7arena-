import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Tela do link de recuperação de senha — desativada.
 *
 * Existia para consumir o token de recovery que o GoTrue enviava por e-mail.
 * Com a sessão migrada para o servidor próprio (ADR-011) e sem provedor de envio
 * configurado, nenhum e-mail é disparado e esta rota deixou de ser alcançável.
 *
 * A versão original, com o fluxo completo e o layout, continua disponível em
 * `D:\Aplicativos\M7AcademySite\src\pages\ResetHandler.tsx` (somente leitura).
 * Para reativar: configurar envio de e-mail, criar as rotas de recovery na API
 * e restaurar o arquivo de lá.
 */
export default function ResetHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return null;
}
