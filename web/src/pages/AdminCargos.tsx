import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ArrowLeft, Shield, Search, Edit2, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CARGO_LABELS, CARGO_COLORS, type CargoAdmin } from '../config/adminPermissoes';
import { usePerfilSafe } from '../contexts/PerfilContext';

interface UsuarioComCargo {
  id: string;
  user_id: string;
  email: string;
  riotId: string;
  cargo: CargoAdmin;
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA REUTILIZÁVEL (usada também como aba dentro de /admin)
// ─────────────────────────────────────────────────────────────────────────────
export function AbaCargos({ adminCargo }: { adminCargo: CargoAdmin }) {
  const [usuarios, setUsuarios] = useState<UsuarioComCargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [novosCargos, setNovosCargos] = useState<Record<string, CargoAdmin>>({});

  const isProprietario = adminCargo === 'proprietario';

  useEffect(() => { carregarUsuarios(); }, []);

  const carregarUsuarios = async () => {
    try {
      const admins = await api.adminCargos.listar();
      if (!admins) { setLoading(false); return; }

      // Contas Riot via API própria (by-ids); o RPC listar_admins fica p/ app.swap.rpc.
      const userIds = admins.map((a: any) => a.user_id).filter(Boolean);
      const contas = userIds.length ? await api.players.byIds(userIds) : [];

      const riotIdMap: Record<string, string> = {};
      (contas ?? []).forEach(c => { riotIdMap[c.user_id] = c.riot_id || 'Sem LOL'; });

      setUsuarios(admins.map((a: any) => ({
        id: a.id,
        user_id: a.user_id,
        email: a.email || 'Sem email',
        riotId: riotIdMap[a.user_id] || 'Sem LOL',
        cargo: a.cargo as CargoAdmin,
      })));
    } catch (e) {
      setErro('Erro ao carregar usuários.');
      console.error('❌ Erro ao carregar admins:', e);
    } finally {
      setLoading(false);
    }
  };

  const usuariosFiltrados = usuarios.filter(u => {
    const s = busca.toLowerCase();
    return u.email.toLowerCase().includes(s) || u.riotId.toLowerCase().includes(s);
  });

  const handleSalvar = async (userId: string) => {
    if (!isProprietario) {
      setErro('Apenas proprietários podem alterar cargos.');
      return;
    }
    const novoCargo = novosCargos[userId];
    if (!novoCargo) return;

    // A API valida a permissão de proprietário no servidor (substitui a RPC)
    try {
      await api.adminCargos.atualizar(userId, novoCargo);
    } catch (error: any) {
      if (error.message?.includes('Acesso negado') || error.message?.includes('proprietário')) {
        setErro('Sem permissão: apenas proprietários podem alterar cargos.');
      } else {
        setErro(`Erro ao atualizar cargo: ${error.message}`);
      }
      return;
    }

    setErro(null);
    setUsuarios(prev => prev.map(u => u.user_id === userId ? { ...u, cargo: novoCargo } : u));
    setEditando(null);
    const { [userId]: _, ...restante } = novosCargos;
    setNovosCargos(restante);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white uppercase">Gerenciar Cargos</h2>
        <p className="text-white/30 text-xs mt-1">
          {isProprietario ? 'Atribua funções a usuários.' : 'Visualização apenas — somente proprietários editam.'}
        </p>
      </div>

      {!isProprietario && (
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-bold">
          🔒 Apenas proprietários podem alterar cargos.
        </div>
      )}

      {erro && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold">{erro}</div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Buscar por email ou Riot ID..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20"
        />
      </div>

      <div className="overflow-auto rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)' }}>
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 border-b border-white/10 sticky top-0">
            <tr>
              <th className="px-4 py-3 font-black text-white/60 uppercase tracking-widest text-[10px]">Email</th>
              <th className="px-4 py-3 font-black text-white/60 uppercase tracking-widest text-[10px]">Usuário</th>
              <th className="px-4 py-3 font-black text-white/60 uppercase tracking-widest text-[10px]">Cargo</th>
              <th className="px-4 py-3 font-black text-white/60 uppercase tracking-widest text-[10px]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {usuariosFiltrados.map((usuario) => {
              const colors = CARGO_COLORS[usuario.cargo];
              const isEditando = editando === usuario.user_id;
              const cargoSelecionado = novosCargos[usuario.user_id] || usuario.cargo;
              const cargoColorsSelecionado = CARGO_COLORS[cargoSelecionado];

              return (
                <tr key={usuario.user_id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white/80 text-sm font-medium">{usuario.email}</td>
                  <td className="px-4 py-3 text-sm">
                    {usuario.riotId !== 'Sem LOL' ? (
                      <span className="text-white/80 font-medium">{usuario.riotId}</span>
                    ) : (
                      <span className="text-red-400/60 text-xs">Sem Riot ID</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditando ? (
                      <select
                        value={cargoSelecionado}
                        onChange={(e) => setNovosCargos({ ...novosCargos, [usuario.user_id]: e.target.value as CargoAdmin })}
                        className={`px-2.5 py-1.5 rounded border font-bold text-xs cursor-pointer ${cargoColorsSelecionado.bg} ${cargoColorsSelecionado.border} ${cargoColorsSelecionado.text} focus:outline-none`}
                      >
                        {(['proprietario', 'admin', 'organizador', 'streamer', 'coach', 'jogador'] as CargoAdmin[]).map(cargo => (
                          <option key={cargo} value={cargo} className="bg-[#111]">{CARGO_LABELS[cargo]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`px-2.5 py-1 rounded font-bold text-xs ${colors.bg} ${colors.border} ${colors.text} border inline-block`}>
                        {CARGO_LABELS[usuario.cargo]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditando ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSalvar(usuario.user_id)}
                          className="p-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditando(null);
                            const { [usuario.user_id]: _, ...restante } = novosCargos;
                            setNovosCargos(restante);
                          }}
                          className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (!isProprietario) { setErro('Apenas proprietários podem alterar cargos.'); return; }
                          setEditando(usuario.user_id);
                          setNovosCargos({ ...novosCargos, [usuario.user_id]: usuario.cargo });
                        }}
                        className={`p-2 rounded-lg border transition-colors ${
                          isProprietario
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 hover:bg-blue-500/30 cursor-pointer'
                            : 'bg-gray-500/10 border-gray-500/20 text-gray-500 cursor-not-allowed opacity-50'
                        }`}
                        disabled={!isProprietario}
                        title={!isProprietario ? 'Apenas proprietários podem editar cargos' : 'Editar cargo'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {usuariosFiltrados.length === 0 && (
          <div className="p-8 text-center text-white/30">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-black uppercase tracking-widest">Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <p className="text-xs text-blue-300">
          <strong>ℹ Informação:</strong> Novos usuários recebem cargo "Jogador" automaticamente.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA STANDALONE (rota /admin/cargos)
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminCargos() {
  const navigate = useNavigate();
  const { perfil } = usePerfilSafe();
  const adminCargo = (perfil?.cargo as CargoAdmin) || 'jogador';

  return (
    <div className="flex-1 bg-[#050505] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-white/40 hover:text-white text-sm font-black uppercase tracking-widest transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o painel
        </button>
        <AbaCargos adminCargo={adminCargo} />
      </div>
    </div>
  );
}
