/**
 * PAINEL DE CONTATOS DOS TIMES - Admin
 *
 * Visualizar e gerenciar WhatsApp e Telefone dos times.
 * Exporta AbaContatos (usado dentro de /admin) e default page (rota /admin/contatos).
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, MessageCircle, Search, Download, Copy, Check,
  AlertCircle, Loader, ArrowLeft,
} from 'lucide-react';
import { api } from '../lib/api';
import { usePerfilSafe } from '../contexts/PerfilContext';
import { useSound } from '../hooks/useSound';
import type { CargoAdmin } from '../config/adminPermissoes';

// ── TIPOS ──────────────────────────────────────────────────────────────────
interface TimeContato {
  id: string | number;
  nome: string;
  tag: string;
  logo_url?: string;
  gradient_from: string;
  whatsapp?: string;
  discord?: string;
  dono_id: string;
  ranking: number;
}

// ── HELPERS ────────────────────────────────────────────────────────────────
const formatarTelefone = (numero: string) => {
  if (!numero) return '-';
  const clean = numero.replace(/\D/g, '');
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return numero;
};
const gerarLinkWhatsapp = (numero: string) => `https://wa.me/${numero.replace(/\D/g, '')}`;

// ─────────────────────────────────────────────────────────────────────────────
// ABA REUTILIZÁVEL
// ─────────────────────────────────────────────────────────────────────────────
export function AbaContatos({ adminCargo }: { adminCargo: CargoAdmin }) {
  const { playSound } = useSound();
  const [times, setTimes] = useState<TimeContato[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterComContato, setFilterComContato] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, 'whatsapp' | 'discord' | null>>({});

  const isAuthorized = adminCargo === 'admin' || adminCargo === 'proprietario';

  useEffect(() => {
    if (!isAuthorized) { setLoading(false); return; }
    (async () => {
      try {
        const { teams: data } = await api.teams.list({ sort: 'ranking', dir: 'asc', limit: 1000 });
        setTimes(data as any);
      } catch (err) {
        console.error('❌ Erro ao buscar times:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthorized]);

  const timesFiltered = useMemo(() => times.filter(time => {
    const matchSearch =
      time.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      time.tag.toLowerCase().includes(searchQuery.toLowerCase());
    const matchContato = !filterComContato || (time.whatsapp || time.discord);
    return matchSearch && matchContato;
  }), [times, searchQuery, filterComContato]);

  const handleExportCSV = () => {
    const csv = [
      ['Nome', 'Tag', 'WhatsApp', 'Discord', 'Ranking'].join(','),
      ...timesFiltered.map(t => [`"${t.nome}"`, t.tag, t.whatsapp || '', t.discord || '', t.ranking].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contatos-times-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    playSound('success');
  };

  if (!isAuthorized) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3 opacity-50" />
        <h2 className="text-white font-black text-lg uppercase mb-1">Acesso Negado</h2>
        <p className="text-white/40 text-sm">Apenas admins e proprietários acessam contatos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white uppercase">Contatos dos Times</h2>
        <p className="text-white/30 text-xs mt-1">Visualize e gerencie WhatsApp e Discord dos responsáveis.</p>
      </div>

      {!loading && (
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Buscar por nome ou tag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 placeholder:text-white/20"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterComContato(!filterComContato)}
              className={`px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                filterComContato
                  ? 'bg-white text-black'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {filterComContato ? '✓ Com Contato' : 'Todos'}
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && timesFiltered.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <div className="col-span-4 text-[10px] text-white/40 uppercase font-black tracking-widest">Time</div>
            <div className="col-span-4 text-[10px] text-white/40 uppercase font-black tracking-widest flex items-center gap-1"><MessageCircle className="w-3 h-3" /> WhatsApp</div>
            <div className="col-span-3 text-[10px] text-white/40 uppercase font-black tracking-widest flex items-center gap-1"><Phone className="w-3 h-3" /> Discord</div>
            <div className="col-span-1 text-[10px] text-white/40 uppercase font-black tracking-widest text-right">#</div>
          </div>

          <AnimatePresence>
            {timesFiltered.map(time => {
              const handleCopyWhatsapp = () => {
                navigator.clipboard.writeText(time.whatsapp || '');
                setCopiedStates(prev => ({ ...prev, [`${time.id}-wa`]: 'whatsapp' }));
                playSound('success');
                setTimeout(() => setCopiedStates(prev => { const n = { ...prev }; delete n[`${time.id}-wa`]; return n; }), 2000);
              };
              const handleCopyDiscord = () => {
                navigator.clipboard.writeText(time.discord || '');
                setCopiedStates(prev => ({ ...prev, [`${time.id}-disc`]: 'discord' }));
                playSound('success');
                setTimeout(() => setCopiedStates(prev => { const n = { ...prev }; delete n[`${time.id}-disc`]; return n; }), 2000);
              };
              const copiedWa = copiedStates[`${time.id}-wa`] === 'whatsapp';
              const copiedDisc = copiedStates[`${time.id}-disc`] === 'discord';

              return (
                <motion.div
                  key={time.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/5 transition-all"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    {time.logo_url ? (
                      <img src={time.logo_url} alt={time.nome} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] text-white/40 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${time.gradient_from}, ${time.gradient_from}30)` }}>
                        {time.tag}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{time.nome}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">#{time.tag}</p>
                    </div>
                  </div>

                  <div className="col-span-4 flex items-center gap-2">
                    {time.whatsapp ? (
                      <>
                        <a href={gerarLinkWhatsapp(time.whatsapp)} target="_blank" rel="noopener noreferrer"
                          className="flex-1 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 hover:border-green-500/50 hover:bg-green-500/20 transition-all text-sm font-medium truncate"
                          title="Abrir no WhatsApp">
                          {formatarTelefone(time.whatsapp)}
                        </a>
                        <button onClick={handleCopyWhatsapp}
                          className={`flex-shrink-0 p-2 rounded-lg transition-all ${copiedWa ? 'bg-green-500/30 text-green-400' : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70'}`}
                          title="Copiar WhatsApp">
                          {copiedWa ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-white/20 italic">-</p>
                    )}
                  </div>

                  <div className="col-span-3 flex items-center gap-2">
                    {time.discord ? (
                      <>
                        <div className="flex-1 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm font-medium truncate">
                          {time.discord}
                        </div>
                        <button onClick={handleCopyDiscord}
                          className={`flex-shrink-0 p-2 rounded-lg transition-all ${copiedDisc ? 'bg-blue-500/30 text-blue-400' : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70'}`}
                          title="Copiar Discord">
                          {copiedDisc ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-white/20 italic">-</p>
                    )}
                  </div>

                  <div className="col-span-1 flex items-center justify-end">
                    <p className="text-lg font-black" style={{ color: time.gradient_from }}>#{time.ranking}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {!loading && times.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-2xl">
          <AlertCircle className="w-12 h-12 mx-auto text-white/20 mb-3" />
          <h2 className="text-white font-black uppercase mb-1">Nenhum time cadastrado</h2>
          <p className="text-white/40 text-sm">Quando times forem criados, seus contatos aparecerão aqui.</p>
        </div>
      )}

      {!loading && times.length > 0 && timesFiltered.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-2xl">
          <Search className="w-12 h-12 mx-auto text-white/20 mb-3" />
          <h2 className="text-white font-black uppercase mb-1">Nenhum resultado</h2>
          <p className="text-white/40 text-sm">Ajuste seus filtros e tente novamente.</p>
        </div>
      )}

      {!loading && times.length > 0 && (
        <div className="flex justify-center gap-8 py-6 border-t border-white/5">
          <div className="text-center">
            <p className="text-white/30 text-[10px] uppercase font-black tracking-widest mb-1">Total</p>
            <p className="text-2xl font-black text-primary">{times.length}</p>
          </div>
          <div className="text-center">
            <p className="text-white/30 text-[10px] uppercase font-black tracking-widest mb-1">Com Contato</p>
            <p className="text-2xl font-black text-green-400">{times.filter(t => t.whatsapp || t.discord).length}</p>
          </div>
          <div className="text-center">
            <p className="text-white/30 text-[10px] uppercase font-black tracking-widest mb-1">Sem Contato</p>
            <p className="text-2xl font-black text-red-400">{times.filter(t => !t.whatsapp && !t.discord).length}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA STANDALONE (rota /admin/contatos)
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminContatos() {
  const navigate = useNavigate();
  const { perfil } = usePerfilSafe();
  const adminCargo = (perfil?.cargo as CargoAdmin) || 'jogador';

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="flex-1 bg-[#050505] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-white/40 hover:text-white text-sm font-black uppercase tracking-widest transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o painel
        </button>
        <AbaContatos adminCargo={adminCargo} />
      </div>
    </div>
  );
}
