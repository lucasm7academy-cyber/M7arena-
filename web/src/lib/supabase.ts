import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════
// ANTI BOUNCE-TRACKING PATCH
// ═══════════════════════════════════════════════════════════════════
// O Chrome pode deletar o localStorage de sites que redirecionam
// para outros domínios (bounce tracking mitigation).
// O supabase usa localStorage pra salvar o code_verifier do PKCE.
// Se o Chrome limpa o localStorage entre o login e o callback,
// o PKCE falha porque o code_verifier sumiu.
//
// SOLUÇÃO: Na página de login, salvamos o code_verifier TAMBÉM no
// sessionStorage (que sobrevive à navegação na mesma aba).
// Aqui, ANTES do cliente Supabase ser criado, restauramos o
// code_verifier do sessionStorage pro localStorage.
//
// sessionStorage é restaurado quando o usuário volta pro mesmo origin
// na mesma aba, mesmo após navegar por outros sites.
// ═══════════════════════════════════════════════════════════════════

const STORAGE_VERIFIER_KEY = 'sb-bfsusctegzvfrlehhink-auth-token-code-verifier'

try {
  const lsVerifier = localStorage.getItem(STORAGE_VERIFIER_KEY)
  const ssVerifier = sessionStorage.getItem(STORAGE_VERIFIER_KEY)

  if (!lsVerifier && ssVerifier) {
    // code_verifier foi limpo do localStorage (provavelmente bounce tracking)
    // Restaura do sessionStorage
    console.log('[SupabaseInit] code_verifier sumiu do localStorage, restaurando do sessionStorage')
    localStorage.setItem(STORAGE_VERIFIER_KEY, ssVerifier)
    // Limpa o sessionStorage pra não reusar stale
    sessionStorage.removeItem(STORAGE_VERIFIER_KEY)
  } else if (lsVerifier) {
    // code_verifier existe no localStorage, limpa o sessionStorage (stale)
    sessionStorage.removeItem(STORAGE_VERIFIER_KEY)
  }
} catch (e) {
  // Ignora erros de storage (ambientes sem localStorage, etc)
}

// ═══════════════════════════════════════════════════════════════════
// CLIENTE SUPABASE
// ═══════════════════════════════════════════════════════════════════

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bfsusctegzvfrlehhink.supabase.co'
const supabaseAnonKey = 'sb_publishable_ACtVE6AlOZIVMaAFXWXiLw_c2EMwwgz'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Desativado: OAuthCallbackHandler processa o ?code= manualmente
    flowType: 'pkce',
  },
})
