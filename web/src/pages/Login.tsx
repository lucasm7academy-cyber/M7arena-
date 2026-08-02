// src/pages/Login.tsx
import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Zap, Check, X, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ── URLs CONSTANTES (não mudam, não precisam de query) ──
const LOGO_URL = 'https://bfsusctegzvfrlehhink.supabase.co/storage/v1/object/public/public-images/logo-m7.png';
const YASUO_URL = 'https://bfsusctegzvfrlehhink.supabase.co/storage/v1/object/public/public-images/Yasuo1.webp';
const MAPA_BACKGROUND = '/images/mapa2.png';

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();

  // ── Estados ──────────────────────────────────────
  const [formMode, setFormMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Redirecionar se já logado ─────────────────────
  useEffect(() => {
    if (user) {
      navigate('/lobby', { replace: true });
    }
  }, [user, navigate]);

  // ── Ações ─────────────────────────────────────────
  /**
   * O OAuth passou a ser resolvido inteiramente no servidor (ADR-011): o
   * navegador vai para /api/auth/google, a API conversa com o Google, cria a
   * sessão e devolve o usuário já logado no /lobby.
   *
   * Sumiu com isso todo o malabarismo de PKCE do GoTrue — code_verifier no
   * localStorage, backup no sessionStorage por causa do Chrome, redirect manual.
   * O segredo do OAuth nunca chega ao cliente.
   */
  const signInWithGoogle = async () => {
    window.location.href = '/api/auth/google';
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showError('Digite seu e-mail.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Recuperação por e-mail está fora do ar por decisão de escopo: o servidor
      // próprio (ADR-011) não tem provedor de envio configurado, e o GoTrue do
      // Supabase deixou de ser a fonte da sessão. O formulário continua aqui
      // para não alterar o layout — só a ação mudou.
      throw new Error(
        'Recuperação de senha por e-mail está temporariamente indisponível. Fale com o suporte.'
      );
    } catch (err: any) {
      showError(err.message ?? 'Erro ao enviar e-mail de recuperação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const traduzirErro = (msg: string): string => {
    if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
    if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado. Faça login.';
    if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
    if (msg.includes('Unable to validate email')) return 'E-mail inválido.';
    if (msg.includes('Email rate limit exceeded')) return 'Muitas tentativas. Aguarde.';
    return msg;
  };

  const showError = (msg: string) => {
    setErrorMessage(traduzirErro(msg));
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (formMode === 'register') {
      if (!email || !senha || !confirmarSenha) { showError('Preencha todos os campos.'); return; }
      if (senha !== confirmarSenha) { showError('As senhas não coincidem!'); return; }
      if (senha.length < 6) { showError('A senha deve ter pelo menos 6 caracteres.'); return; }

      setIsSubmitting(true);
      try {
        // O nome de exibição não é pedido neste formulário; o próprio app já usa
        // o prefixo do e-mail como fallback de nome (ver LayoutWrapper).
        await register(email, senha, email.split('@')[0]);
        setSuccessMessage('Conta criada!');
        setEmail(''); setSenha(''); setConfirmarSenha('');
        navigate('/lobby');
      } catch (err: any) {
        showError(err?.message || 'Não foi possível criar a conta.');
      } finally {
        setIsSubmitting(false);
      }
    } else if (formMode === 'login') {
      if (!email || !senha) { showError('Preencha e-mail e senha.'); return; }

      setIsSubmitting(true);
      try {
        await login(email, senha);
        navigate('/lobby');
      } catch (err: any) {
        showError(err?.message || 'Não foi possível entrar.');
      } finally {
        setIsSubmitting(false);
      }
    } else if (formMode === 'forgot') {
      await handleForgotPassword(e);
    }
  };

  // ── Render ────────────────────────────────────────
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-0 md:p-8 overflow-y-auto overflow-x-hidden font-sans bg-[#050505]">
      {/* Background Map & Vignette */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-25 mix-blend-luminosity pointer-events-none" 
        style={{ backgroundImage: `url(${MAPA_BACKGROUND})` }} 
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#050505] via-[#0A0A0A]/90 to-[#050505] backdrop-blur-sm pointer-events-none" />

      {/* Decorative Brand Glow Spots */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FFB800]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#FF5E00]/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Toast Messages (Premium Sleek Glass) */}
      <AnimatePresence>
        {(errorMessage || successMessage) && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-8 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md px-6 py-4 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex items-center gap-4 border backdrop-blur-xl transition-all duration-300 ${
              errorMessage 
                ? 'bg-red-950/80 border-red-500/20 text-red-200 shadow-red-950/10' 
                : 'bg-green-950/80 border-green-500/20 text-green-200 shadow-green-950/10'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${errorMessage ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
              {errorMessage ? <X className="w-5 h-5 text-red-400" /> : <Check className="w-5 h-5 text-green-400" />}
            </div>
            <div>
              <p className="font-headline font-bold text-xs uppercase tracking-wider">
                {errorMessage ? 'Atenção' : 'Sucesso'}
              </p>
              <p className="text-xs opacity-75 font-semibold mt-0.5">{errorMessage || successMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container Card (Dual-Pane) */}
      <div className="relative z-10 w-full max-w-4xl min-h-screen md:min-h-0 flex flex-col md:flex-row rounded-none md:rounded-3xl overflow-hidden bg-[#0D0D0D] border-0 md:border border-white/5 shadow-none md:shadow-[0_24px_80px_rgba(0,0,0,0.8)] mx-auto my-auto">
        
        {/* Form Section (Left Side - Premium Dark Fundo) */}
        <div className="flex-1 bg-[#0D0D0D] px-6 py-10 md:p-12 flex flex-col justify-start md:justify-center order-2 md:order-1">
          {/* Header/Logo */}
          <div className="flex items-center gap-3.5 mb-8">
            <img src={LOGO_URL} alt="Logo" className="h-10 w-auto filter drop-shadow-[0_2px_8px_rgba(255,184,0,0.15)]" />
            <span className="text-sm font-black text-white uppercase tracking-widest font-headline">M7 Academy</span>
          </div>

          {/* Dynamic Titles with Brand Gradient */}
          <h1 className="text-3xl md:text-4xl font-headline font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFB800] to-[#FF5E00] uppercase tracking-tight mb-2">
            {formMode === 'login' && 'Bem-vindo'}
            {formMode === 'register' && 'Crie sua conta'}
            {formMode === 'forgot' && 'Recuperar Senha'}
          </h1>
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-black mb-8">
            {formMode === 'login' && 'Acesse sua conta para entrar na arena.'}
            {formMode === 'register' && 'Inicie sua jornada lendária.'}
            {formMode === 'forgot' && 'Insira seu e-mail para receber o link.'}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40">E-mail</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type="email" 
                  placeholder="exemplo@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:bg-black focus:outline-none focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]/25 transition-all text-sm font-medium"
                  required
                />
              </div>
            </div>

            {/* Password Field (Only for Login & Register) */}
            {formMode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Senha</label>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:bg-black focus:outline-none focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]/25 transition-all text-sm font-medium"
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formMode === 'login' && (
                  <div className="flex justify-end mt-2">
                    <button 
                      type="button" 
                      onClick={() => { setFormMode('forgot'); setErrorMessage(null); setSuccessMessage(null); }}
                      className="text-[10px] font-black uppercase text-[#FFB800] hover:text-[#FF5E00] transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Confirm Password Field (Only for Register) */}
            {formMode === 'register' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Confirmar Senha</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:bg-black focus:outline-none focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]/25 transition-all text-sm font-medium"
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Submit Button (Vibrant Branded Gradient) */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-[#FFB800] to-[#FF5E00] text-black font-headline font-black uppercase tracking-widest rounded-full disabled:opacity-50 flex items-center justify-center gap-2 mt-6 cursor-pointer shadow-[0_6px_24px_rgba(255,184,0,0.25)] hover:shadow-[0_6px_32px_rgba(255,184,0,0.45)] transition-all duration-300"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {formMode === 'login' && 'Acessar Arena'}
                    {formMode === 'register' && 'Criar Conta'}
                    {formMode === 'forgot' && 'Enviar Link'}
                  </span>
                  <ArrowRight className="w-5 h-5 shrink-0" />
                </>
              )}
            </motion.button>

            {/* Divider & Google OAuth (Only for login and register) */}
            {formMode !== 'forgot' && (
              <>
                <div className="relative flex items-center py-3">
                  <div className="w-full border-t border-white/5" />
                  <span className="px-4 text-[10px] font-black text-white/20 uppercase tracking-widest">Ou</span>
                  <div className="w-full border-t border-white/5" />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="button" 
                  onClick={signInWithGoogle}
                  className="w-full py-3.5 bg-white/[0.02] border border-white/10 hover:bg-white/[0.05] text-white font-headline font-bold uppercase tracking-widest text-xs rounded-full flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                >
                  <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" className="w-4 h-4 shrink-0" />
                  Entrar com Google
                </motion.button>
              </>
            )}
          </form>

          {/* Toggle Screen State Links */}
          <div className="text-center mt-8">
            {formMode === 'login' && (
              <p className="text-sm text-white/40 font-bold">
                Não tem conta?
                <button 
                  type="button"
                  onClick={() => { setFormMode('register'); setErrorMessage(null); setSuccessMessage(null); }} 
                  className="ml-2 text-[#FFB800] hover:text-[#FF5E00] font-black uppercase transition-colors"
                >
                  Cadastre-se
                </button>
              </p>
            )}
            {formMode === 'register' && (
              <p className="text-sm text-white/40 font-bold">
                Já tem conta?
                <button 
                  type="button"
                  onClick={() => { setFormMode('login'); setErrorMessage(null); setSuccessMessage(null); }} 
                  className="ml-2 text-[#FFB800] hover:text-[#FF5E00] font-black uppercase transition-colors"
                >
                  Login
                </button>
              </p>
            )}
            {formMode === 'forgot' && (
              <button 
                type="button"
                onClick={() => { setFormMode('login'); setErrorMessage(null); setSuccessMessage(null); }} 
                className="text-[#FFB800] hover:text-[#FF5E00] font-black uppercase tracking-wider text-xs transition-colors flex items-center gap-1.5 mx-auto"
              >
                ← Voltar para o Login
              </button>
            )}
          </div>
        </div>

        {/* Hero Illustration Section (Right Side - Pure Solid Black Fundo) */}
        <div className="hidden md:flex md:w-[40%] bg-black md:border-l border-white/5 flex-col items-center justify-center p-8 relative overflow-hidden order-1 md:order-2">
          
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10 w-full max-w-[200px]"
          >
            <img 
              src={YASUO_URL} 
              alt="Yasuo Character" 
              className="w-full h-auto object-contain drop-shadow-[0_0_24px_rgba(255,184,0,0.15)]" 
            />
            
            {/* Elegant Badge Zap */}
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 4, repeat: Infinity, delay: 1 }}
              className="absolute -top-3 -right-3 px-3 py-1.5 bg-black border border-[#FFB800]/30 rounded-2xl backdrop-blur-md shadow-[0_4px_12px_rgba(255,184,0,0.15)]"
            >
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#FFB800] fill-[#FFB800]" />
                <span className="text-[9px] font-headline font-black text-white uppercase tracking-wider">Elite</span>
              </div>
            </motion.div>
            
            {/* Elegant Badge Trophy */}
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 5, repeat: Infinity, delay: 2 }}
              className="absolute -bottom-3 -left-3 px-3 py-1.5 bg-black border border-white/10 rounded-2xl backdrop-blur-md shadow-lg shadow-black/40"
            >
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#FFB800]" />
                <span className="text-[9px] font-headline font-black text-white uppercase tracking-wider">Rank #1</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Heading Content */}
          <div className="relative z-10 text-center mt-8">
            <h2 className="text-2xl font-headline font-black text-white uppercase italic tracking-tighter">
              Domine a <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFB800] to-[#FF5E00]">Arena</span>
            </h2>
            <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1.5">
              A plataforma oficial das lendas
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}