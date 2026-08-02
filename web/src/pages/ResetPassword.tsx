import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Tela de definição de nova senha — desativada.
 *
 * Mesma razão do ResetHandler: dependia do token de recovery do GoTrue, que não
 * é mais emitido depois da ADR-011. Sem envio de e-mail configurado, ninguém
 * chega até aqui.
 *
 * Versão original preservada em
 * `D:\Aplicativos\M7AcademySite\src\pages\ResetPassword.tsx` (somente leitura).
 */
export default function ResetPassword() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return null;
}
