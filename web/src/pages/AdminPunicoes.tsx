import React, { useState } from 'react';
import { api } from '../lib/api';
import { Search, Ban, ShieldAlert, ShieldCheck, X, AlertTriangle, UserCheck } from 'lucide-react';
import type { CargoAdmin } from '../config/adminPermissoes';

interface UsuarioPunicao {
  id: string;
  email: string;
  displayName: string;
  riotId: string | null;
  status: string;
  avatarUrl?: string | null;
}

interface AdvertenciaItem {
  id: string;
  userId: string;
  criadoPor: string | null;
  matchId: string | null;
  motivo: string;
  createdAt: string;
  removidoPor: string | null;
  removidoEm: string | null;
}

const ADVERTENCIAS_PARA_BAN = 3;

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA REUTILIZÁVEL (usada também como aba dentro de /admin)
// ─────────────────────────────────────────────────────────────────────────────
export function AbaPunicoes({ adminCargo }: { adminCargo: CargoAdmin }) {
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioPunicao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<UsuarioPunicao | null>(null);
  const [advertencias, setAdvertencias] = useState<AdvertenciaItem[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Modal de ação
  const [modal, setModal] = useState<null | { tipo: 'advertir' | 'banir'; userId: string; nome: string }>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const isAdminOuProprietario = adminCargo === 'admin' || adminCargo === 'proprietario';

  const buscar = async () => {
    const q = busca.trim();
    if (!q) return;
    setBuscando(true);
    setErro(null);
    try {
      const rows = await api.adminPunicoes.buscarUsuarios(q);
      setUsuarios(rows ?? []);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao buscar usuários.');
    } finally {
      setBuscando(false);
    }
  };

  const selecionar = async (u: UsuarioPunicao) => {
    setSelecionado(u);
    setErro(null);
    setSucesso(null);
    setCarregandoHistorico(true);
    try {
      const rows = await api.adminPunicoes.listarAdvertencias(u.id);
      setAdvertencias(rows ?? []);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar histórico.');
    } finally {
      setCarregandoHistorico(false);
    }
  };

  const ativas = advertencias.filter((a) => !a.removidoEm).length;
  const banido = selecionado?.status === 'banida';
  const atingiuBan = ativas >= ADVERTENCIAS_PARA_BAN;

  const confirmarModal = async () => {
    if (!modal || !motivo.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      if (modal.tipo === 'advertir') {
        const r = await api.adminPunicoes.aplicarAdvertencia(modal.userId, motivo.trim());
        setSucesso(r.banido
          ? `Advertência aplicada (${r.advertencias}/${ADVERTENCIAS_PARA_BAN}) — o usuário foi BANIDO automaticamente.`
          : `Advertência aplicada (${r.advertencias}/${ADVERTENCIAS_PARA_BAN}).`);
      } else {
        await api.adminPunicoes.banir(modal.userId, motivo.trim());
        setSucesso('Usuário banido. O ban bloqueia partidas casuais e apostadas até o desban.');
      }
      setModal(null);
      setMotivo('');
      if (selecionado?.id === modal.userId) await selecionar(selecionado);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao aplicar punição.');
    } finally {
      setEnviando(false);
    }
  };

  const removerAdvertencia = async (id: string) => {
    setErro(null);
    setSucesso(null);
    try {
      const r = await api.adminPunicoes.removerAdvertencia(id);
      setSucesso(`Advertência removida (${r.advertencias}/${ADVERTENCIAS_PARA_BAN} ativas). O ban, se houver, continua até desbanir.`);
      if (selecionado) await selecionar(selecionado);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao remover advertência.');
    }
  };

  const desbanir = async (userId: string) => {
    setErro(null);
    setSucesso(null);
    try {
      await api.adminPunicoes.desbanir(userId);
      setSucesso('Usuário desbanido — pode voltar a jogar.');
      if (selecionado) await selecionar(selecionado);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao desbanir.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white uppercase">Punições</h2>
        <p className="text-white/30 text-xs mt-1">
          Advertências e ban são aplicados manualmente. {ADVERTENCIAS_PARA_BAN} advertências ativas geram ban automático — que só sai com desban.
        </p>
      </div>

      {erro && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold">{erro}</div>}
      {sucesso && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-bold">{sucesso}</div>}

      {!isAdminOuProprietario && (
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-bold">
          🔒 Apenas admin/proprietário pode aplicar punições.
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar por email, nome ou Riot ID..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20"
          />
        </div>
        <button
          onClick={buscar}
          disabled={buscando || !busca.trim()}
          className="px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/20 disabled:opacity-40 transition-colors"
        >
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Resultados da busca */}
      {usuarios.length > 0 && (
        <div className="overflow-auto rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)' }}>
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-black text-white/60 uppercase tracking-widest text-[10px]">Usuário</th>
                <th className="px-4 py-3 font-black text-white/60 uppercase tracking-widest text-[10px]">Email</th>
                <th className="px-4 py-3 font-black text-white/60 uppercase tracking-widest text-[10px]">Status</th>
                <th className="px-4 py-3 font-black text-white/60 uppercase tracking-widest text-[10px]">Abrir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white/80 font-medium">{u.displayName || u.email?.split('@')[0]}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.status === 'banida' ? (
                      <span className="px-2.5 py-1 rounded font-bold text-xs border bg-red-500/20 border-red-500/40 text-red-400 inline-block">Banido</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded font-bold text-xs border bg-green-500/10 border-green-500/30 text-green-400 inline-block">Ativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => selecionar(u)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30 text-xs font-black uppercase tracking-widest transition-colors"
                    >
                      Gerenciar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Painel do usuário selecionado */}
      {selecionado && (
        <div className="rounded-2xl border border-white/10 p-5 space-y-5" style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-white font-black text-lg">{selecionado.displayName || selecionado.email?.split('@')[0]}</p>
              <p className="text-white/40 text-xs">
                {selecionado.email} {selecionado.riotId ? `· ${selecionado.riotId}` : '· sem Riot ID'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {banido ? (
                <button
                  onClick={() => desbanir(selecionado.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 font-black text-xs uppercase tracking-widest transition-colors"
                >
                  <UserCheck className="w-4 h-4" /> Desbanir
                </button>
              ) : (
                <button
                  onClick={() => setModal({ tipo: 'banir', userId: selecionado.id, nome: selecionado.displayName })}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 font-black text-xs uppercase tracking-widest transition-colors"
                >
                  <Ban className="w-4 h-4" /> Banir
                </button>
              )}
              <button
                onClick={() => setModal({ tipo: 'advertir', userId: selecionado.id, nome: selecionado.displayName })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30 font-black text-xs uppercase tracking-widest transition-colors"
              >
                <ShieldAlert className="w-4 h-4" /> Advertir
              </button>
            </div>
          </div>

          {/* Contador + aviso de ban */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Advertências ativas</span>
              <span className={`font-black text-lg ${atingiuBan ? 'text-red-400' : ativas >= ADVERTENCIAS_PARA_BAN - 1 ? 'text-yellow-400' : 'text-white'}`}>
                {ativas}/{ADVERTENCIAS_PARA_BAN}
              </span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: ADVERTENCIAS_PARA_BAN }).map((_, i) => (
                <div key={i} className={`w-6 h-1.5 rounded-full ${i < ativas ? (atingiuBan ? 'bg-red-500' : 'bg-yellow-400') : 'bg-white/10'}`} />
              ))}
            </div>
          </div>

          {banido && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
              <Ban className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm font-bold">
                Usuário BANIDO — não pode jogar partidas casuais nem apostadas. O ban só sai com desban manual.
              </p>
            </div>
          )}
          {!banido && atingiuBan && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
              <p className="text-yellow-300 text-sm font-bold">
                {ativas}/{ADVERTENCIAS_PARA_BAN} advertências ativas — o próximo Advertir aplica ban automático.
              </p>
            </div>
          )}

          {/* Histórico */}
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-3">Histórico de advertências</p>
            {carregandoHistorico ? (
              <div className="py-6 text-center text-white/30 text-xs uppercase tracking-widest">Carregando...</div>
            ) : advertencias.length === 0 ? (
              <div className="py-6 text-center text-white/30">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest">Nenhuma advertência</p>
              </div>
            ) : (
              <div className="space-y-2">
                {advertencias.map((a) => (
                  <div key={a.id} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${a.removidoEm ? 'bg-white/[0.02] border-white/5 opacity-60' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
                    <div className="min-w-0">
                      <p className="text-white/80 text-sm font-bold truncate">{a.motivo}</p>
                      <p className="text-white/30 text-[10px] uppercase tracking-widest">
                        {formatarData(a.createdAt)}
                        {a.removidoEm ? ` · removida em ${formatarData(a.removidoEm)}` : ' · ativa'}
                      </p>
                    </div>
                    {!a.removidoEm && (
                      <button
                        onClick={() => removerAdvertencia(a.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-widest transition-colors shrink-0"
                      >
                        <X className="w-3 h-3" /> Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {usuarios.length === 0 && !buscando && (
        <div className="p-8 text-center text-white/30">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-black uppercase tracking-widest">Busque um usuário para gerenciar punições</p>
        </div>
      )}

      {/* Modal de advertência/ban */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70" onClick={() => !enviando && setModal(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 p-6" style={{ background: '#0d0d0d', backdropFilter: 'blur(16px)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black uppercase tracking-widest text-sm">
                {modal.tipo === 'advertir' ? `Advertir ${modal.nome}` : `Banir ${modal.nome}`}
              </h3>
              <button onClick={() => setModal(null)} disabled={enviando} className="text-white/40 hover:text-white disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/40 text-xs mb-3">
              {modal.tipo === 'advertir'
                ? 'A advertência fica no histórico e conta para o ban automático (3 ativas). Não expira — só sai com remoção manual.'
                : 'O ban bloqueia partidas casuais e apostadas. É permanente até o desban manual.'}
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo da punição (obrigatório)..."
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setModal(null)}
                disabled={enviando}
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs font-black uppercase tracking-widest disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarModal}
                disabled={enviando || !motivo.trim()}
                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-40 transition-colors ${
                  modal.tipo === 'advertir'
                    ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30'
                    : 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {enviando ? 'Aplicando...' : modal.tipo === 'advertir' ? 'Aplicar Advertência' : 'Confirmar Ban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
