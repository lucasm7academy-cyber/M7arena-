'use client';

import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');
    setTimeout(() => {
      setLoading(false);
      alert('Senha alterada com sucesso! Faça login com sua nova senha.');
      router.push('/login');
    }, 1000);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-black text-white font-sans">
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-black/90 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-black text-[#FFB700] uppercase tracking-tight font-headline">
                Redefinir Senha
              </h1>
              <p className="text-white/60 text-sm">Digite sua nova senha abaixo</p>
            </div>

            <form className="space-y-4" onSubmit={handleResetPassword}>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-white/60 font-headline">
                  Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFB700]"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-white/60 font-headline">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFB700]"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-[#FFB700] to-[#FF5E00] text-black font-black uppercase tracking-wider rounded-xl hover:brightness-110 disabled:opacity-50 cursor-pointer font-headline"
              >
                {loading ? 'ALTERANDO...' : 'CONFIRMAR'}
              </button>
            </form>

            <div className="text-center">
              <button
                onClick={() => router.push('/login')}
                className="text-white/40 hover:text-[#FFB700] transition-colors text-sm font-bold uppercase"
              >
                VOLTAR PARA LOGIN
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
