// src/pages/recrutamento.tsx
// Página de recrutamento — design Cut-Edge oficial M7 Arena

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

// ── Polígonos de corte angular oficiais da M7 Arena (com espessura uniforme de 1px)
const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
const CUT_FRAME_INNER = 'polygon(10.6px 0, 100% 0, 100% calc(100% - 10.6px), calc(100% - 10.6px) 100%, 0 100%, 0 10.6px)';

const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';
const CUT_BUTTON_INNER = 'polygon(5.6px 0, 100% 0, 100% calc(100% - 5.6px), calc(100% - 5.6px) 100%, 0 100%, 0 5.6px)';

const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CUT_BADGE_INNER = 'polygon(2.6px 0, 100% 0, 100% calc(100% - 2.6px), calc(100% - 2.6px) 100%, 0 100%, 0 2.6px)';

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
      className="group relative p-[1px] cursor-pointer transition-all duration-300 flex flex-col h-full hover:shadow-[0_0_25px_-5px_rgba(255,183,0,0.25)]"
      style={{
        clipPath: CUT_FRAME,
        background: `linear-gradient(135deg, ${from}90 0%, ${to}40 50%, rgba(255,255,255,0.08) 100%)`,
      }}
    >
      <div
        className="w-full flex-1 bg-[#08080a] group-hover:bg-[#0c0c10] overflow-hidden flex flex-col justify-between transition-colors duration-300"
        style={{ clipPath: CUT_FRAME_INNER }}
      >
        {/* HERO — logo com gradient do time */}
        <div
          className="relative h-40 flex items-center justify-center px-4 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${from}, ${to})`,
          }}
        >
          {/* Logo — Cut-Corner Container */}
          <div
            className="p-[1.5px] shadow-2xl"
            style={{
              clipPath: CUT_BUTTON,
              background: 'rgba(255,255,255,0.3)',
            }}
          >
            <div
              className="w-20 h-20 bg-black/40 backdrop-blur-md flex items-center justify-center overflow-hidden"
              style={{ clipPath: CUT_BUTTON_INNER }}
            >
              {timeData.logo_url ? (
                <img src={timeData.logo_url} loading="lazy" alt={timeData.nome} className="w-full h-full object-contain p-1.5" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-black text-2xl text-white/70">
                  {timeData.tag}
                </div>
              )}
            </div>
          </div>

          {/* Owner actions / Ver Time — canto superior direito */}
          <div className="absolute top-3 right-3 z-10">
            {isOwner ? (
              <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onEdit(post)}
                  className="p-[1px] bg-white/20 hover:bg-white/40 transition-all text-white font-bold cursor-pointer"
                  style={{ clipPath: CUT_BADGE }}
                  title="Editar"
                >
                  <div
                    className="w-7 h-7 flex items-center justify-center bg-black/50 hover:bg-black/70 text-xs backdrop-blur-md"
                    style={{ clipPath: CUT_BADGE_INNER }}
                  >
                    ✏️
                  </div>
                </button>
                <button
                  onClick={() => onDelete(post)}
                  className="p-[1px] bg-white/20 hover:bg-red-500/80 transition-all text-white font-bold cursor-pointer"
                  style={{ clipPath: CUT_BADGE }}
                  title="Remover"
                >
                  <div
                    className="w-7 h-7 flex items-center justify-center bg-black/50 hover:bg-red-600 text-xs backdrop-blur-md"
                    style={{ clipPath: CUT_BADGE_INNER }}
                  >
                    <X size={13} strokeWidth={3} />
                  </div>
                </button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); navigate(`/times/${post.time_id}`); }}
                className="p-[1px] bg-white/20 hover:bg-white/40 transition-all group/btn cursor-pointer"
                style={{ clipPath: CUT_BADGE }}
              >
                <div
                  className="text-[10px] bg-black/50 group-hover/btn:bg-black/70 text-white transition-all px-3 py-1.5 font-black uppercase tracking-wider backdrop-blur-md flex items-center gap-1"
                  style={{ clipPath: CUT_BADGE_INNER }}
                >
                  <span>Ver Time</span>
                  <span>→</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
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
            <div
              className="inline-flex p-[1px] bg-white/10"
              style={{ clipPath: CUT_BADGE }}
            >
              <div
                className="inline-flex items-center gap-2 bg-[#12131a] py-1.5 px-3"
                style={{ clipPath: CUT_BADGE_INNER }}
              >
                {roleCfg?.img && (
                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    <img src={roleCfg.img} alt={roleCfg.label} className="w-full h-full object-contain" />
                  </div>
                )}
                <p className="text-primary font-black uppercase tracking-widest text-xs leading-none">
                  {roleCfg?.label ?? post.role}
                </p>
              </div>
            </div>
          </div>

          {/* Elo + Horário */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-[1px] bg-white/10" style={{ clipPath: CUT_BADGE }}>
              <div className="bg-[#12131a]/80 p-2.5 space-y-0.5" style={{ clipPath: CUT_BADGE_INNER }}>
                <p className="text-[9px] text-white/40 uppercase font-black tracking-widest">Elo</p>
                <p className="text-xs font-bold text-white/90 truncate">{post.elo_min} – {post.elo_max}</p>
              </div>
            </div>
            <div className="p-[1px] bg-white/10" style={{ clipPath: CUT_BADGE }}>
              <div className="bg-[#12131a]/80 p-2.5 space-y-0.5" style={{ clipPath: CUT_BADGE_INNER }}>
                <p className="text-[9px] text-white/40 uppercase font-black tracking-widest">Horário</p>
                <p className="text-xs font-bold text-white/90 truncate">{post.horarios || 'Flexível'}</p>
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div className="p-[1px] bg-primary/25" style={{ clipPath: CUT_BADGE }}>
            <p
              className="text-xs text-white/70 line-clamp-3 font-medium leading-relaxed px-3 py-2.5 bg-[#0e0f14] border-l-2 border-primary italic"
              style={{ clipPath: CUT_BADGE_INNER }}
            >
              "{post.descricao}"
            </p>
          </div>

          {/* WhatsApp Button */}
          <div className="mt-auto pt-1">
            {post.discord ? (
              <button
                onClick={handleCopyWhatsapp}
                className={`w-full p-[1px] transition-all duration-150 cursor-pointer ${
                  copied
                    ? 'bg-green-400'
                    : 'bg-[#25D366]/40 hover:bg-[#25D366]'
                }`}
                style={{ clipPath: CUT_BUTTON }}
              >
                <div
                  className={`w-full flex items-center gap-3 px-4 py-3 font-black uppercase text-xs tracking-widest transition-all ${
                    copied
                      ? 'bg-green-950/90 text-green-400'
                      : 'bg-[#075E54] text-white hover:brightness-110'
                  }`}
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  {copied ? (
                    <>
                      <Check size={15} className="shrink-0 text-green-400" />
                      <span className="flex-1 text-center">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <FaWhatsapp size={18} className="shrink-0 text-[#25D366]" />
                      <span className="flex-1 truncate text-left">{post.discord}</span>
                      <Copy size={13} className="shrink-0 opacity-70" />
                    </>
                  )}
                </div>
              </button>
            ) : (
              <div
                className="w-full p-[1px] bg-white/10"
                style={{ clipPath: CUT_BUTTON }}
              >
                <div
                  className="w-full bg-[#12131a]/60 py-3 font-black uppercase text-[10px] tracking-[0.2em] text-white/30 text-center"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  WhatsApp não informado
                </div>
              </div>
            )}
          </div>
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.08 }}
      className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-4 pt-24 sm:pt-20 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.08 }}
        onClick={e => e.stopPropagation()}
        className="relative p-[1.5px] w-full max-w-xl shadow-2xl my-auto"
        style={{
          clipPath: CUT_FRAME,
          background: 'linear-gradient(135deg, #FFB700 0%, rgba(255,183,0,0.4) 60%, rgba(255,255,255,0.1) 100%)',
          boxShadow: '0 0 50px -10px rgba(255,183,0,0.3), 0 25px 70px rgba(0,0,0,0.95)',
        }}
      >
        <div
          className="w-full bg-[#09090c] overflow-hidden flex flex-col"
          style={{ clipPath: CUT_FRAME_INNER }}
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-[#0e0f14]">
            <h2 className="text-white font-black text-xl uppercase tracking-widest">
              {editando ? 'Editar ' : 'Nova '}<span className="text-primary">Vaga</span>
            </h2>
            <button
              onClick={onClose}
              className="p-[1px] bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              style={{ clipPath: CUT_BUTTON }}
              title="Fechar"
            >
              <div
                className="w-8 h-8 bg-[#141418] hover:bg-[#202028] flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                <X size={16} />
              </div>
            </button>
          </div>

          <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Time */}
            {myTeams.length === 0 ? (
              <div className="p-[1px] bg-red-500/40" style={{ clipPath: CUT_BADGE }}>
                <div className="bg-red-950/40 px-5 py-4 text-sm text-red-300 font-bold" style={{ clipPath: CUT_BADGE_INNER }}>
                  Você não pertence a nenhum time ativo. Entre em um time para publicar vagas.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">Time</label>
                <div className="p-[1px] bg-white/10 focus-within:bg-primary/50 transition-all" style={{ clipPath: CUT_BUTTON }}>
                  <select
                    value={teamId}
                    onChange={e => setTeamId(e.target.value)}
                    className="w-full bg-[#0d0e13] px-4 py-3.5 text-white text-sm font-bold focus:outline-none transition-all appearance-none cursor-pointer"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    {myTeams.map(t => (
                      <option key={String(t.id)} value={String(t.id)} className="bg-[#0a0b0f]">
                        {t.nome} (#{t.tag})
                      </option>
                    ))}
                  </select>
                </div>
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
                    className="p-[1px] transition-all cursor-pointer"
                    style={{
                      clipPath: CUT_BUTTON,
                      background: posicao === role.value ? '#FFB700' : 'rgba(255,255,255,0.12)',
                    }}
                  >
                    <div
                      className={`flex items-center gap-2 px-4 py-3 font-black text-[10px] uppercase tracking-widest transition-all ${
                        posicao === role.value
                          ? 'bg-primary text-black'
                          : 'bg-[#0f1015] text-white/60 hover:bg-[#15161e] hover:text-white'
                      }`}
                      style={{ clipPath: CUT_BUTTON_INNER }}
                    >
                      <img
                        src={role.img}
                        alt={role.label}
                        className={`w-4 h-4 object-contain ${posicao === role.value ? 'brightness-0' : 'opacity-60'}`}
                      />
                      <span>{role.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Elo range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">Elo Mínimo</label>
                <div className="p-[1px] bg-white/10 focus-within:bg-primary/50 transition-all" style={{ clipPath: CUT_BUTTON }}>
                  <select
                    value={eloMin}
                    onChange={e => setEloMin(e.target.value as any)}
                    className="w-full bg-[#0d0e13] px-4 py-3.5 text-white text-sm font-bold focus:outline-none transition-all appearance-none cursor-pointer"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    {TIER_LIST.map(e => <option key={e} value={e} className="bg-[#0a0b0f]">{e}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">Elo Máximo</label>
                <div className="p-[1px] bg-white/10 focus-within:bg-primary/50 transition-all" style={{ clipPath: CUT_BUTTON }}>
                  <select
                    value={eloMax}
                    onChange={e => setEloMax(e.target.value as any)}
                    className="w-full bg-[#0d0e13] px-4 py-3.5 text-white text-sm font-bold focus:outline-none transition-all appearance-none cursor-pointer"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    {TIER_LIST.map(e => <option key={e} value={e} className="bg-[#0a0b0f]">{e}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Horário */}
            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">Horário</label>
              <div className="p-[1px] bg-white/10 focus-within:bg-primary/50 transition-all" style={{ clipPath: CUT_BUTTON }}>
                <input
                  value={horarios}
                  onChange={e => setHorarios(e.target.value)}
                  placeholder="Ex: Seg-Sex 20h"
                  className="w-full bg-[#0d0e13] px-4 py-3.5 text-white text-sm font-bold focus:outline-none placeholder:text-white/30 transition-all"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">
                Descrição <span className="normal-case text-white/30 font-bold">(10–500 chars)</span>
              </label>
              <div className="p-[1px] bg-white/10 focus-within:bg-primary/50 transition-all" style={{ clipPath: CUT_BUTTON }}>
                <textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Fale um pouco sobre a organização e o que buscam no candidato..."
                  rows={3}
                  className="w-full bg-[#0d0e13] px-4 py-3.5 text-white text-sm font-bold focus:outline-none placeholder:text-white/30 transition-all resize-none block"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                />
              </div>
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <label className="text-white/40 text-[10px] uppercase font-black tracking-widest">WhatsApp para Contato</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366] z-10 pointer-events-none">
                  <FaWhatsapp size={20} />
                </div>
                <div className="p-[1px] bg-white/10 focus-within:bg-primary/50 transition-all" style={{ clipPath: CUT_BUTTON }}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={whatsapp}
                    onChange={e => setWhatsapp(maskWhatsapp(e.target.value))}
                    placeholder="(11) 91234-5678"
                    maxLength={16}
                    className="w-full bg-[#0d0e13] pl-12 pr-4 py-3.5 text-white text-sm font-bold focus:outline-none placeholder:text-white/30 transition-all"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-white/30 font-bold pl-1">
                Formato BR: DDD + 9 + número (somente números são aceitos).
              </p>
            </div>

            {/* Erro */}
            {erro && (
              <div className="p-[1px] bg-red-500/40" style={{ clipPath: CUT_BADGE }}>
                <div className="bg-red-950/40 px-5 py-3 text-sm text-red-300 font-bold" style={{ clipPath: CUT_BADGE_INNER }}>
                  {erro}
                </div>
              </div>
            )}

            {/* Submit */}
            <motion.button
              whileHover={{ scale: (loading || !posicao || !teamId || myTeams.length === 0) ? 1 : 1.01 }}
              whileTap={{ scale: (loading || !posicao || !teamId || myTeams.length === 0) ? 1 : 0.98 }}
              onClick={handleSubmit}
              disabled={loading || !posicao || !teamId || myTeams.length === 0}
              className="w-full p-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 cursor-pointer"
              style={{
                clipPath: CUT_BUTTON,
                background: 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)',
              }}
            >
              <div
                className="w-full py-4 bg-gradient-to-r from-primary to-[#E6A600] text-black font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:brightness-105 transition-all"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                {loading
                  ? <RefreshCw size={20} className="animate-spin text-black" />
                  : editando ? 'Salvar Alterações' : 'Publicar Recrutamento'}
              </div>
            </motion.button>
          </div>
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
      transition={{ duration: 0.08 }}
      className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-4 pt-24 sm:pt-20 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.08 }}
        onClick={e => e.stopPropagation()}
        className="relative p-[1.5px] w-full max-w-sm mx-auto shadow-2xl"
        style={{
          clipPath: CUT_FRAME,
          background: 'linear-gradient(135deg, #EF4444 0%, rgba(239,68,68,0.4) 60%, rgba(255,255,255,0.1) 100%)',
          boxShadow: '0 0 40px -10px rgba(239,68,68,0.3), 0 25px 70px rgba(0,0,0,0.95)',
        }}
      >
        <div
          className="w-full bg-[#09090c] p-6"
          style={{ clipPath: CUT_FRAME_INNER }}
        >
          <h3 className="text-white font-black text-lg uppercase tracking-widest mb-3">
            Remover <span className="text-red-400">Vaga?</span>
          </h3>
          <p className="text-white/60 text-sm mb-6">
            A vaga de <span className="text-white font-bold">{post.time?.nome ?? 'seu time'}</span> buscando{' '}
            <span className="text-primary font-bold">{post.role}</span> será desativada.
          </p>
          {erro && (
            <div className="p-[1px] bg-red-500/40 mb-4" style={{ clipPath: CUT_BADGE }}>
              <p className="text-red-400 text-xs bg-red-950/60 px-4 py-3" style={{ clipPath: CUT_BADGE_INNER }}>
                {erro}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 p-[1px] bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
              style={{ clipPath: CUT_BUTTON }}
            >
              <div
                className="w-full py-3.5 bg-[#141418] hover:bg-[#1a1b24] text-white/70 hover:text-white font-black uppercase text-xs tracking-widest text-center transition-colors"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                Cancelar
              </div>
            </button>
            <button
              onClick={confirmar}
              disabled={loading}
              className="flex-1 p-[1px] bg-red-500/40 hover:bg-red-500 transition-all disabled:opacity-50 cursor-pointer"
              style={{ clipPath: CUT_BUTTON }}
            >
              <div
                className="w-full py-3.5 bg-red-950/80 hover:bg-red-600 text-red-300 hover:text-white font-black uppercase text-xs tracking-widest flex items-center justify-center transition-colors"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin mx-auto" /> : 'Remover'}
              </div>
            </button>
          </div>
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
        <div
          className="relative p-[1.5px] shadow-2xl shadow-black/40"
          style={{
            clipPath: CUT_FRAME,
            background: 'linear-gradient(135deg, rgba(255,183,0,0.35) 0%, rgba(255,255,255,0.08) 50%, rgba(255,183,0,0.15) 100%)',
          }}
        >
          <div
            className="relative w-full bg-[#0a0b0f] overflow-hidden p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6"
            style={{ clipPath: CUT_FRAME_INNER }}
          >
            <div
              className="absolute inset-0 z-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,183,0,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,107,0,0.1) 0%, transparent 50%)',
              }}
            />

            <div className="relative z-10 space-y-3 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase leading-none tracking-widest text-white">
                Recrutar <span className="text-primary">Talentos</span>
              </h1>
              <p className="text-white/60 text-sm md:text-base font-medium leading-relaxed">
                A plataforma oficial para times buscarem novos talentos.
              </p>
            </div>

            {podePublicar && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { playSound('click'); setEditando(null); setModalOpen(true); }}
                className="relative z-10 shrink-0 p-[1px] transition-all cursor-pointer shadow-lg shadow-primary/20"
                style={{
                  clipPath: CUT_BUTTON,
                  background: 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)',
                }}
              >
                <div
                  className="flex items-center gap-2.5 bg-gradient-to-r from-primary to-[#E6A600] text-black px-6 py-3.5 font-black text-sm uppercase tracking-widest hover:brightness-110 transition-all"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <Plus size={18} strokeWidth={3} />
                  <span>Criar Vaga</span>
                </div>
              </motion.button>
            )}
          </div>
        </div>

        {/* ── BARRA DE FILTROS (sticky) ── */}
        <div
          className="sticky top-4 z-40 p-[1px] shadow-xl shadow-black/40"
          style={{
            clipPath: CUT_FRAME,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
          }}
        >
          <div
            className="w-full bg-[#0a0b0f]/95 backdrop-blur-xl p-3 md:p-4 flex flex-col md:flex-row items-center gap-3"
            style={{ clipPath: CUT_FRAME_INNER }}
          >
            {/* Search */}
            <div
              className="flex-1 w-full p-[1px] bg-white/10 focus-within:bg-primary/50 transition-all"
              style={{ clipPath: CUT_BUTTON }}
            >
              <div
                className="w-full bg-white/5 flex items-center px-4 py-2.5 gap-3"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                <Search size={18} className="text-white/40 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por time ou vaga..."
                  className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-white/30 font-bold"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-white/40 hover:text-white transition-colors cursor-pointer">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Role filters */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 w-full md:w-auto">
              <button
                onClick={() => { playSound('click'); setRoleFilter(null); }}
                className={`shrink-0 p-[1px] transition-all cursor-pointer ${
                  !roleFilter
                    ? 'bg-primary shadow-lg shadow-primary/20'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
                style={{ clipPath: CUT_BADGE }}
              >
                <div
                  className={`px-4 py-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                    !roleFilter
                      ? 'bg-primary text-black'
                      : 'bg-[#12131a] text-white/60 hover:text-white'
                  }`}
                  style={{ clipPath: CUT_BADGE_INNER }}
                >
                  Todos
                </div>
              </button>
              {RECRUITMENT_ROLES.map(role => (
                <button
                  key={role.value}
                  onClick={() => { playSound('click'); setRoleFilter(role.value); }}
                  className={`shrink-0 p-[1px] transition-all cursor-pointer ${
                    roleFilter === role.value
                      ? 'bg-primary shadow-lg shadow-primary/20'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                  style={{ clipPath: CUT_BADGE }}
                >
                  <div
                    className={`flex items-center gap-2 px-3.5 py-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                      roleFilter === role.value
                        ? 'bg-primary text-black'
                        : 'bg-[#12131a] text-white/60 hover:text-white'
                    }`}
                    style={{ clipPath: CUT_BADGE_INNER }}
                  >
                    <img
                      src={role.img}
                      alt={role.label}
                      className={`w-4 h-4 object-contain ${roleFilter === role.value ? 'brightness-0' : 'opacity-60'}`}
                    />
                    <span>{role.label}</span>
                  </div>
                </button>
              ))}

              {/* Refresh */}
              <button
                onClick={() => { playSound('click'); loadData(); }}
                disabled={loading}
                className="shrink-0 p-[1px] bg-white/10 hover:bg-white/25 transition-all disabled:opacity-50 cursor-pointer"
                style={{ clipPath: CUT_BADGE }}
                title="Atualizar"
              >
                <div
                  className="px-3 py-2 bg-[#12131a] text-white/60 hover:text-white flex items-center justify-center transition-colors"
                  style={{ clipPath: CUT_BADGE_INNER }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </div>
              </button>
            </div>
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
                className="col-span-full p-[1px]"
                style={{
                  clipPath: CUT_FRAME,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
                }}
              >
                <div
                  className="w-full py-28 flex flex-col items-center justify-center text-center bg-[#0a0b0f]/90 px-4"
                  style={{ clipPath: CUT_FRAME_INNER }}
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
                      className="mt-6 p-[1px] bg-gradient-to-r from-primary to-[#E6A600] hover:brightness-110 transition-all shadow-lg shadow-primary/20 cursor-pointer"
                      style={{ clipPath: CUT_BUTTON }}
                    >
                      <div
                        className="flex items-center gap-2 bg-gradient-to-r from-primary to-[#E6A600] text-black px-5 py-3 font-black text-sm uppercase tracking-widest"
                        style={{ clipPath: CUT_BUTTON_INNER }}
                      >
                        <Plus size={16} strokeWidth={3} />
                        <span>Publicar Vaga</span>
                      </div>
                    </button>
                  )}
                </div>
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
