// src/pages/RedefinirSenha.tsx
// Página pública do reset feito pelo painel (spec 2026-10-20). Visual copiado
// do Login.tsx: mesmo fundo, card, inputs e botão — sem a coluna do Yasuo.
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, ArrowRight, ShieldAlert, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const LOGO_URL = '/uploads/public-images/logo-m7.png';
const MAPA_BACKGROUND = '/images/mapa2.webp';

type Estado = 'validando' | 'invalido' | 'form' | 'enviando';

export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [estado, setEstado] = useState<Estado>('validando');
  const [emailMascarado, setEmailMascarado] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!token) {
      setEstado('invalido');
      return () => { ativo = false; };
    }

    api.authReset.validar(token)
      .then((r) => {
        if (!ativo) return;
        setEmailMascarado(r.email);
        setEstado('form');
      })
      .catch(() => {
        if (ativo) setEstado('invalido');
      });

    return () => { ativo = false; };
  }, [token]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }

    setEstado('enviando');
    try {
      await api.authReset.redefinir(token, senha);
      // No auto-reset o servidor acabou de apagar a sessão do próprio
      // proprietário; sem isto o AuthContext ainda o veria logado e o Login
      // redirecionaria para /lobby antes de mostrar a mensagem de sucesso.
      await refresh();
      navigate('/login?senha_alterada=1', { replace: true });
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg === 'link_invalido_ou_expirado' || msg === 'token_ausente') {
        setEstado('invalido');
        return;
      }
      setErro(
        msg === 'senha_curta'
          ? 'A senha deve ter pelo menos 8 caracteres.'
          : 'Não foi possível redefinir a senha. Tente novamente.'
      );
      setEstado('form');
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-0 md:p-8 overflow-y-auto overflow-x-hidden font-sans bg-[#050505]">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-25 mix-blend-luminosity pointer-events-none"
        style={{ backgroundImage: `url(${MAPA_BACKGROUND})` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#050505] via-[#0A0A0A]/90 to-[#050505] backdrop-blur-sm pointer-events-none" />

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FFB800]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#FF5E00]/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md min-h-screen md:min-h-0 rounded-none md:rounded-3xl overflow-hidden bg-[#0D0D0D] border-0 md:border border-white/5 shadow-none md:shadow-[0_24px_80px_rgba(0,0,0,0.8)] mx-auto my-auto px-6 py-10 md:p-10">
        <div className="flex items-center gap-3.5 mb-8">
          <img src={LOGO_URL} alt="Logo" className="h-10 w-auto filter drop-shadow-[0_2px_8px_rgba(255,184,0,0.15)]" />
          <span className="text-sm font-black text-white uppercase tracking-widest font-headline">M7 Arena</span>
        </div>

        {estado === 'validando' && (
          <div className="py-16 flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[#FFB800] border-t-transparent rounded-full animate-spin" />
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-black">Validando link...</p>
          </div>
        )}

        {estado === 'invalido' && (
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-headline font-black text-white uppercase tracking-tight">
                Link inválido
              </h1>
              <p className="text-white/40 text-sm font-semibold mt-2 leading-relaxed">
                Este link expirou ou já foi usado. Peça um novo link ao suporte.
              </p>
            </div>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-4 bg-gradient-to-r from-[#FFB800] to-[#FF5E00] text-black font-headline font-black uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(255,184,0,0.25)] hover:shadow-[0_6px_32px_rgba(255,184,0,0.45)] transition-all duration-300"
            >
              Ir para o login <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {(estado === 'form' || estado === 'enviando') && (
          <>
            <h1 className="text-3xl md:text-4xl font-headline font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFB800] to-[#FF5E00] uppercase tracking-tight mb-2">
              Nova senha
            </h1>
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-black mb-6">
              Conta: {emailMascarado}
            </p>

            {erro && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/20 flex items-start gap-2.5">
                <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-200 text-xs font-semibold">{erro}</p>
              </div>
            )}

            <form onSubmit={enviar} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Nova senha</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    disabled={estado === 'enviando'}
                    minLength={8}
                    className="w-full pl-12 pr-12 py-3.5 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:bg-black focus:outline-none focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]/25 transition-all text-sm font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  >
                    {mostrarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-white/30 text-[10px] font-bold mt-1.5">Mínimo de 8 caracteres.</p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Confirmar nova senha</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type={mostrarConfirmar ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    disabled={estado === 'enviando'}
                    minLength={8}
                    className="w-full pl-12 pr-12 py-3.5 bg-white/[0.02] border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:bg-black focus:outline-none focus:border-[#FFB800] focus:ring-1 focus:ring-[#FFB800]/25 transition-all text-sm font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  >
                    {mostrarConfirmar ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={estado === 'enviando'}
                className="w-full py-4 bg-gradient-to-r from-[#FFB800] to-[#FF5E00] text-black font-headline font-black uppercase tracking-widest rounded-full disabled:opacity-50 flex items-center justify-center gap-2 mt-6 cursor-pointer shadow-[0_6px_24px_rgba(255,184,0,0.25)] hover:shadow-[0_6px_32px_rgba(255,184,0,0.45)] transition-all duration-300"
              >
                {estado === 'enviando' ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Definir nova senha</span>
                    <ArrowRight className="w-5 h-5 shrink-0" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
