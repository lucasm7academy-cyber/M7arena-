// src/pages/recrutamento.tsx
// Página de recrutamento — design alinhado ao restante do site (dark glass + primary)

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, ShieldCheck,
  RefreshCw, X, Check, Copy,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useSound } from '../hooks/useSound';
import { useAuth } from '../contexts/AuthContext';
import { usePerfilSafe } from '../contexts/PerfilContext';
import {
  fetchRecruitments,
  fetchRecruitmentsByRole,
  createRecruitment,
  updateRecruitment,
  deleteRecruitment,
  fetchMyTeamsForRecrutamento,
  type TimeParaRecrutamento,
} from '../api/recrutamento';
import {
  RECRUITMENT_ROLES,
  TIER_LIST,
  maskWhatsapp,
  normalizeWhatsapp,
  type Recrutamento,
  type RecrutamentoInput,
  type RoleRecrutamento,
} from '../types/recrutamento';

// ── Card de recrutamento ──────────────────────────────────────────────────────

interface CardProps {
  post:     Recrutamento;
  myUserId: string;
  onEdit:   (p: Recrutamento) => void;
  onDelete: (p: Recrutamento) => void;
  onClick:  () => void;
}

function RecruitmentCard({ post, myUserId, onEdit, onDelete, onClick }: CardProps) {
  const { playSound } = useSound();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const isOwner = post.criado_por === myUserId;

  const roleCfg = RECRUITMENT_ROLES.find(r => r.value === post.role);

  const timeData = post.time ?? {
    nome: 'Time Desconhecido',
    tag:  '???',
    logo_url:      null,
    gradient_from: '#FFB700',
    gradient_to:   '#FF6B00',
    ranking: 0,
  };
  const from = timeData.gradient_from ?? '#FFB700';
  const to   = timeData.gradient_to   ?? '#FF6B00';

  function handleCopyWhatsapp(e: React.MouseEvent) {
    e.stopPropagation();
    if (!post.discord) return;
    // Copia SEM máscara (só dígitos) — abre direto no WhatsApp ao colar
    const digits = normalizeWhatsapp(post.discord);
    if (!digits) return;
    navigator.clipboard.writeText(digits).catch(() => {});
    setCopied(true);
    playSound('success');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => { playSound('click'); onClick(); }}
      className="group relative bg-[#0a0b0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:border-primary/40 hover:bg-[#0a0b0f]/80 shadow-lg shadow-black/20 flex flex-col h-full"
    >
      {/* HERO — logo grande com gradient do time */}
      <div
        className="relative h-40 flex items-center justify-center px-4"
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
      >
        {/* Logo grande — preenche o hero */}
        <div className="w-24 h-24 rounded-2xl bg-black/35 backdrop-blur-md border-2 border-white/25 flex items-center justify-center overflow-hidden shadow-2xl">
          {timeData.logo_url ? (
            <img src={timeData.logo_url} loading="lazy" alt={timeData.nome} className="w-full h-full object-contain p-1.5" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-black text-2xl text-white/70">
              {timeData.tag}
            </div>
          )}
        </div>

        {/* Owner actions / Ver Time — canto superior direito */}
        <div className="absolute top-3 right-3">
          {isOwner ? (
            <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => onEdit(post)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 hover:bg-black/60 text-white transition-all text-xs font-bold border border-white/20 backdrop-blur-md"
                title="Editar"
              >
                ✏️
              </button>
              <button
                onClick={() => onDelete(post)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 hover:bg-red-500 text-white transition-all text-xs font-bold border border-white/20 backdrop-blur-md"
                title="Remover"
              >
                <X size={14} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/times/${post.time_id}`); }}
              className="text-[10px] bg-black/40 text-white hover:bg-black/60 transition-all px-3 py-1.5 rounded-lg font-black uppercase tracking-wider border border-white/20 backdrop-blur-md"
            >
              Ver Time →
            </button>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5 flex-1 flex flex-col gap-4">
        {/* Nome do time + role badge centralizado */}
        <div className="text-center space-y-2.5">
          <div className="space-y-0.5">
            <h3 className="text-base font-black text-white uppercase tracking-tight truncate">
              {timeData.nome}
            </h3>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">
              #{timeData.tag}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 bg-white/5 py-2 px-3 rounded-lg border border-white/10">
            {roleCfg?.img && (
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <img src={roleCfg.img} alt={roleCfg.label} className="w-full h-full object-contain" />
              </div>
            )}
            <p className="text-primary font-black uppercase tracking-widest text-xs leading-none">
              {roleCfg?.label ?? post.role}
            </p>
          </div>
        </div>

        {/* Elo + Horário */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl space-y-0.5">
            <p className="text-[9px] text-white/40 uppercase font-black tracking-widest">Elo</p>
            <p className="text-xs font-bold text-white/90 truncate">{post.elo_min} – {post.elo_max}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl space-y-0.5">
            <p className="text-[9px] text-white/40 uppercase font-black tracking-widest">Horário</p>
            <p className="text-xs font-bold text-white/90 truncate">{post.horarios || 'Flexível'}</p>
          </div>
        </div>

        {/* Descrição */}
        <p className="text-xs text-white/60 line-clamp-3 font-medium leading-relaxed px-3 py-2.5 bg-white/5 border-l-2 border-primary rounded-r-lg italic">
          "{post.descricao}"
        </p>

        {/* WhatsApp Button — verde escuro */}
        <div className="mt-auto">
          {post.discord ? (
            <button
              onClick={handleCopyWhatsapp}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all duration-150 border shadow-lg ${
                copied
                  ? 'bg-green-500/20 text-green-400 border-green-500/40'
                  : 'bg-[#075E54] text-white hover:brightness-125 border-[#044d44] shadow-[#075E54]/20'
              }`}
            >
              {copied ? (
                <>
                  <Check size={15} className="shrink-0" />
                  <span className="flex-1 text-center">Copiado!</span>
                </>
              ) : (
                <>
                  <FaWhatsapp size={18} className="shrink-0" />
                  <span className="flex-1 truncate text-left">{post.discord}</span>
                  <Copy size={13} className="shrink-0 opacity-70" />
                </>
              )}
            </button>
          ) : (
            <div className="w-full bg-white/5 py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] text-white/30 text-center border border-white/10">
              WhatsApp não informado
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Modal de criação / edição ─────────────────────────────────────────────────

interface ModalProps {
  editando:  Recrutamento | null;
  myTeams:   TimeParaRecrutamento[];
  userId:    string;
  onClose:   () => void;
  onSuccess: () => void;
}

function RecruitmentModal({ editando, myTeams, userId, onClose, onSuccess }: ModalProps) {
  const { playSound } = useSound();
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState('');

  const [teamId,   setTeamId]   = useState(editando ? String(editando.time_id) : (myTeams[0] ? String(myTeams[0].id) : ''));
  const [posicao,  setPosicao]  = useState<RoleRecrutamento | ''>(editando?.role ?? '');
  const [eloMin,   setEloMin]   = useState(editando?.elo_min   ?? 'Prata');
  const [eloMax,   setEloMax]   = useState(editando?.elo_max   ?? 'Diamante');
  const [descricao,setDescricao]= useState(editando?.descricao ?? '');
  const [horarios, setHorarios] = useState(editando?.horarios  ?? '');
  const [whatsapp, setWhatsapp] = useState(
    editando?.discord ? maskWhatsapp(editando.discord) : ''
  );

  async function handleSubmit() {
    if (!userId || !teamId || !posicao) return;
    setLoading(true);
    setErro('');

    try {
      const input: RecrutamentoInput = {
        time_id:  teamId,
        role:     posicao as RoleRecrutamento,
        elo_min:  eloMin  as any,
        elo_max:  eloMax  as any,
        discord:  whatsapp,
        descricao,
        horarios: horarios || undefined,
      };

      if (editando) {
        await updateRecruitment(editando.id, input, userId);
      } else {
        await createRecruitment(input, userId);
      }

      playSound('success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm font-bold focus:outline-none focus:border-primary focus:bg-white/[0.08] transition-all appearance-none';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-4 pt-24 sm:pt-20 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-xl bg-[#0a0b0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-black text-xl uppercase tracking-widest">
            {editando ? 'Editar ' : 'Nova '}<span className="text-primary">Vaga</span>
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Time */}
          {myTeams.length === 0 ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 text-sm text-red-300 font-bold">
              Você não pertence a nenhum time ativo. Entre em um time para publicar vagas.
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">Time</label>
              <select
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                className={inputCls}
              >
                {myTeams.map(t => (
                  <option key={String(t.id)} value={String(t.id)} className="bg-[#0a0b0f]">
                    {t.nome} (#{t.tag})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cargo */}
          <div className="space-y-2">
            <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">Cargo Desejado</label>
            <div className="flex flex-wrap gap-2">
              {RECRUITMENT_ROLES.map(role => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => { playSound('click'); setPosicao(role.value); }}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${
                    posicao === role.value
                      ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
                      : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <img
                    src={role.img}
                    alt={role.label}
                    className={`w-4 h-4 object-contain ${posicao === role.value ? 'brightness-0' : 'opacity-60'}`}
                  />
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Elo range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">Elo Mínimo</label>
              <select value={eloMin} onChange={e => setEloMin(e.target.value as any)} className={inputCls}>
                {TIER_LIST.map(e => <option key={e} value={e} className="bg-[#0a0b0f]">{e}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">Elo Máximo</label>
              <select value={eloMax} onChange={e => setEloMax(e.target.value as any)} className={inputCls}>
                {TIER_LIST.map(e => <option key={e} value={e} className="bg-[#0a0b0f]">{e}</option>)}
              </select>
            </div>
          </div>

          {/* Horário */}
          <div className="space-y-2">
            <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">Horário</label>
            <input
              value={horarios}
              onChange={e => setHorarios(e.target.value)}
              placeholder="Ex: Seg-Sex 20h"
              className={inputCls}
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">
              Descrição <span className="normal-case text-white/30 font-bold">(10–500 chars)</span>
            </label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Fale um pouco sobre a organização e o que buscam no candidato..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* WhatsApp */}
          <div className="space-y-2">
            <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">WhatsApp para Contato</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366]">
                <FaWhatsapp size={20} />
              </div>
              <input
                type="tel"
                inputMode="numeric"
                value={whatsapp}
                onChange={e => setWhatsapp(maskWhatsapp(e.target.value))}
                placeholder="(11) 91234-5678"
                maxLength={16}
                className={`${inputCls} pl-12`}
              />
            </div>
            <p className="text-[10px] text-white/30 font-bold pl-1">
              Formato BR: DDD + 9 + número (somente números são aceitos).
            </p>
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 text-sm text-red-300 font-bold">
              {erro}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !posicao || !teamId || myTeams.length === 0}
            className="w-full py-4 bg-gradient-to-r from-primary to-[#E6A600] text-black font-black uppercase tracking-widest text-sm rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
          >
            {loading
              ? <RefreshCw size={20} className="animate-spin mx-auto" />
              : editando ? 'Salvar Alterações' : 'Publicar Recrutamento'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Modal de confirmação de delete ────────────────────────────────────────────

function DeleteModal({ post, userId, onClose, onDeleted }: {
  post: Recrutamento; userId: string; onClose: () => void; onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState('');

  async function confirmar() {
    setLoading(true);
    try {
      await deleteRecruitment(post.id, userId);
      onDeleted();
      onClose();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao remover.');
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-4 pt-24 sm:pt-20 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-[#0a0b0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl"
      >
        <h3 className="text-white font-black text-lg uppercase tracking-widest mb-3">
          Remover <span className="text-red-400">Vaga?</span>
        </h3>
        <p className="text-white/60 text-sm mb-6">
          A vaga de <span className="text-white font-bold">{post.time?.nome ?? 'seu time'}</span> buscando{' '}
          <span className="text-primary font-bold">{post.role}</span> será desativada.
        </p>
        {erro && <p className="text-red-400 text-xs mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{erro}</p>}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/60 font-black uppercase text-xs tracking-widest hover:bg-white/5 hover:text-white transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={loading}
            className="flex-1 py-3.5 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white font-black uppercase text-xs tracking-widest border border-red-500/30 transition-all disabled:opacity-50"
          >
            {loading ? <RefreshCw size={16} className="animate-spin mx-auto" /> : 'Remover'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Recrutamento() {
  const { playSound } = useSound();
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const { perfil }    = usePerfilSafe();
  const userId        = user?.id ?? '';

  const [posts,     setPosts]     = useState<Recrutamento[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [roleFilter,setRoleFilter]= useState<RoleRecrutamento | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editando,  setEditando]  = useState<Recrutamento | null>(null);
  const [deletando, setDeletando] = useState<Recrutamento | null>(null);
  const [myTeams,   setMyTeams]   = useState<TimeParaRecrutamento[]>([]);

  const podePublicar = !!userId;

  async function loadData(role: RoleRecrutamento | null = roleFilter) {
    setLoading(true);
    try {
      const data = role
        ? await fetchRecruitmentsByRole(role)
        : await fetchRecruitments();
      setPosts(data);
    } catch { setPosts([]); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadData();
  }, [roleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    fetchMyTeamsForRecrutamento(userId).then(setMyTeams).catch(() => {});
  }, [userId]);

  const filteredPosts = useMemo(() => {
    if (!search) return posts;
    const q = search.toLowerCase();
    return posts.filter(p =>
      p.time?.nome.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      p.descricao.toLowerCase().includes(q),
    );
  }, [posts, search]);

  if (loading && posts.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── HERO BANNER ── */}
        <div className="relative bg-[#0a0b0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
               style={{
                 backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,183,0,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,107,0,0.1) 0%, transparent 50%)',
               }}
          />

          <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase leading-none tracking-widest text-white">
                Recrutar <span className="text-primary">Talentos</span>
              </h1>
              <p className="text-white/60 text-sm md:text-base font-medium leading-relaxed">
                A plataforma oficial para times buscarem novos talentos.
              </p>
            </div>

            {podePublicar && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { playSound('click'); setEditando(null); setModalOpen(true); }}
                className="shrink-0 flex items-center gap-2.5 bg-gradient-to-r from-primary to-[#E6A600] text-black px-5 py-3.5 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
              >
                <Plus size={18} strokeWidth={3} />
                Criar Vaga
              </motion.button>
            )}
          </div>
        </div>

        {/* ── BARRA DE FILTROS (sticky) ── */}
        <div className="sticky top-4 z-40 rounded-2xl bg-[#0a0b0f]/80 backdrop-blur-md border border-white/10 p-3 md:p-4 flex flex-col md:flex-row items-center gap-3 shadow-lg shadow-black/20">
          {/* Search */}
          <div className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl flex items-center px-4 py-3 gap-3 focus-within:border-primary/50 focus-within:bg-white/[0.08] transition-all">
            <Search size={18} className="text-white/40 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por time ou vaga..."
              className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-white/30 font-bold"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-white/40 hover:text-white transition-colors">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Role filters */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 w-full md:w-auto">
            <button
              onClick={() => { playSound('click'); setRoleFilter(null); }}
              className={`shrink-0 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${
                !roleFilter
                  ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
                  : 'bg-white/5 text-white/60 border-white/10 hover:border-white/20 hover:bg-white/10 hover:text-white'
              }`}
            >
              Todos
            </button>
            {RECRUITMENT_ROLES.map(role => (
              <button
                key={role.value}
                onClick={() => { playSound('click'); setRoleFilter(role.value); }}
                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${
                  roleFilter === role.value
                    ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
                    : 'bg-white/5 text-white/60 border-white/10 hover:border-white/20 hover:bg-white/10 hover:text-white'
                }`}
              >
                <img
                  src={role.img}
                  alt={role.label}
                  className={`w-4 h-4 object-contain ${roleFilter === role.value ? 'brightness-0' : 'opacity-60'}`}
                />
                {role.label}
              </button>
            ))}

            {/* Refresh */}
            <button
              onClick={() => { playSound('click'); loadData(); }}
              disabled={loading}
              className="shrink-0 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white transition-all disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── GRID DE CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post, idx) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.04, type: 'spring', damping: 25 }}
                >
                  <RecruitmentCard
                    post={post}
                    myUserId={userId}
                    onClick={() => navigate(`/times/${post.time_id}`)}
                    onEdit={p => { setEditando(p); setModalOpen(true); }}
                    onDelete={p => setDeletando(p)}
                  />
                </motion.div>
              ))
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-32 flex flex-col items-center justify-center text-center bg-[#0a0b0f]/60 backdrop-blur-xl border border-dashed border-white/10 rounded-2xl"
              >
                <ShieldCheck size={64} className="text-white/20 mb-4" />
                <p className="text-white/70 text-lg font-black uppercase tracking-widest">
                  Nenhum recrutamento no radar.
                </p>
                <p className="text-white/40 text-sm mt-2 font-medium">
                  Ajuste seus filtros ou volte em breve.
                </p>
                {podePublicar && (
                  <button
                    onClick={() => { setEditando(null); setModalOpen(true); }}
                    className="mt-6 flex items-center gap-2 bg-gradient-to-r from-primary to-[#E6A600] text-black px-5 py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                  >
                    <Plus size={16} strokeWidth={3} />
                    Publicar Vaga
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Modais ── */}
      <AnimatePresence>
        {modalOpen && (
          <RecruitmentModal
            key="form"
            editando={editando}
            myTeams={myTeams}
            userId={userId}
            onClose={() => { setModalOpen(false); setEditando(null); }}
            onSuccess={() => loadData()}
          />
        )}
        {deletando && (
          <DeleteModal
            key="delete"
            post={deletando}
            userId={userId}
            onClose={() => setDeletando(null)}
            onDeleted={() => { setPosts(prev => prev.filter(p => p.id !== deletando?.id)); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
