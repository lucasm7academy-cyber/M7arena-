import React, { useState } from 'react';
import { api } from '../lib/api';
import { Search, KeyRound, Copy, Check, X, AlertTriangle } from 'lucide-react';
import type { CargoAdmin } from '../config/adminPermissoes';

interface UsuarioSenha {
  id: string;
  email: string;
  displayName: string;
  riotId: string | null;
  status: string;
  avatarUrl?: string | null;
}

interface LinkGerado {
  url: string;
  expira_em: string;
  usuario: UsuarioSenha;
}

function formatarValidade(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AbaSenhas({ adminCargo }: { adminCargo: CargoAdmin }) {
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioSenha[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [linkGerado, setLinkGerado] = useState<LinkGerado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const isProprietario = adminCargo === 'proprietario';

  const buscar = async () => {
    const q = busca.trim();
    if (!q) return;
    setBuscando(true);
    setErro(null);
    try {
      const rows = await api.adminSenhas.buscarUsuarios(q);
      setUsuarios(rows ?? []);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao buscar usuários.');
    } finally {
      setBuscando(false);
    }
  };

  const gerarLink = async (u: UsuarioSenha) => {
    setGerando(u.id);
    setErro(null);
    setLinkGerado(null);
    setCopiado(false);
    try {
      const r = await api.adminSenhas.gerarLink(u.id);
      setLinkGerado({ url: r.url, expira_em: r.expira_em, usuario: u });
    } catch (e: any) {
      const msg = e?.message || '';
      setErro(
        msg === 'apenas_proprietario'
          ? 'Apenas o proprietário pode gerar links de reset.'
          : msg === 'usuario_nao_encontrado'
            ? 'Usuário não encontrado.'
            : msg === 'nao_autenticado'
              ? 'Sua sessão expirou. Entre novamente.'
              : 'Erro ao gerar o link. Tente novamente.'
      );
    } finally {
      setGerando(null);
    }
  };

  const copiar = async () => {
    if (!linkGerado) return;
    try {
      await navigator.clipboard.writeText(linkGerado.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro('Não foi possível copiar automaticamente. Selecione o link e copie.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white uppercase">Senhas</h2>
        <p className="text-zinc-400 text-xs mt-1">
          Gere um link de uso único, válido por 24h, e envie ao cliente por WhatsApp/Discord.
          Ele define a nova senha — você nunca a vê.
        </p>
      </div>

      {erro && (
        <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-bold shadow-sm">
          {erro}
        </div>
      )}

      {!isProprietario ? (
        <div className="p-3.5 rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-sm font-bold shadow-sm">
          🔒 Apenas o proprietário pode redefinir senhas.
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por email, nome ou Riot ID..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                className="w-full pl-10 pr-4 py-3 bg-[#0e1320] border border-white/15 rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all shadow-sm"
              />
            </div>
            <button
              onClick={buscar}
              disabled={buscando || !busca.trim()}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-yellow-500 text-black font-black text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-40 transition-all shadow-md shadow-primary/20"
            >
              {buscando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {usuarios.length > 0 && (
            <div
              className="overflow-auto rounded-xl border border-white/10 shadow-xl"
              style={{
                background: 'linear-gradient(180deg, rgba(22, 28, 44, 0.8) 0%, rgba(15, 19, 30, 0.9) 100%)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0e1320] border-b border-white/10 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Usuário</th>
                    <th className="px-4 py-3 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Email</th>
                    <th className="px-4 py-3 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Status</th>
                    <th className="px-4 py-3 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Reset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="px-4 py-3 text-zinc-200 font-bold">
                        {u.displayName || u.email?.split('@')[0]}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.status === 'banida' ? (
                          <span className="px-2.5 py-1 rounded-lg font-bold text-xs border bg-red-500/20 border-red-500/40 text-red-400 inline-block">
                            Banido
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg font-bold text-xs border bg-green-500/15 border-green-500/30 text-green-400 inline-block">
                            Ativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => gerarLink(u)}
                          disabled={gerando === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 disabled:opacity-40 text-xs font-black uppercase tracking-widest transition-colors shadow-sm"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          {gerando === u.id ? 'Gerando...' : 'Gerar link'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {linkGerado && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl"
            style={{ background: 'linear-gradient(180deg, rgba(22, 28, 44, 0.98) 0%, rgba(15, 19, 30, 0.99) 100%)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-black text-lg flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" /> Link de reset
                </p>
                <p className="text-zinc-400 text-xs mt-1">{linkGerado.usuario.email}</p>
              </div>
              <button
                onClick={() => setLinkGerado(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                readOnly
                value={linkGerado.url}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-primary"
              />
              <button
                onClick={copiar}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all shrink-0"
              >
                {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
              <p className="text-yellow-200 text-xs font-semibold leading-relaxed">
                O link vale até <span className="font-black">{formatarValidade(linkGerado.expira_em)}</span> e só pode ser usado uma vez.
                Quem abrir define a nova senha. Envie por WhatsApp/Discord.
              </p>
            </div>

            <button
              onClick={() => setLinkGerado(null)}
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 font-black text-xs uppercase tracking-widest transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
