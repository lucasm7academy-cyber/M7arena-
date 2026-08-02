/**
 * OAuthCallbackHandler — desativado (ADR-011).
 *
 * Existia para processar o callback PKCE do GoTrue em qualquer rota: restaurava
 * o `code_verifier` do sessionStorage quando o Chrome limpava o localStorage,
 * tentava `exchangeCodeForSession` e, se falhasse, ficava até 15s em polling
 * esperando a sessão aparecer.
 *
 * Nada disso é necessário agora: o OAuth acontece inteiro no servidor
 * (`/api/auth/google` → `/api/auth/google/callback`), que já devolve o navegador
 * ao app com o cookie de sessão pronto. O `code` nunca chega ao cliente.
 *
 * O componente continua montado no App.tsx só para não mexer na árvore de
 * render. Quando o último resquício de OAuth do Supabase sair, pode ser removido
 * junto com a linha que o monta.
 *
 * Versão original em `D:\Aplicativos\M7AcademySite\src\components\OAuthCallbackHandler.tsx`.
 */
export default function OAuthCallbackHandler() {
  return null;
}
