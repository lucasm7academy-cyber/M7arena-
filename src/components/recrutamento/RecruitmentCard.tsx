'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, Check, Copy } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useSound } from '@/hooks/useSound';
import {
  RECRUITMENT_ROLES,
  normalizeWhatsapp,
  type Recrutamento,
} from '@/types/recrutamento';

interface CardProps {
  post: Recrutamento;
  myUserId: string;
  onEdit: (p: Recrutamento) => void;
  onDelete: (p: Recrutamento) => void;
  onClick: () => void;
}

export default function RecruitmentCard({ post, myUserId, onEdit, onDelete, onClick }: CardProps) {
  const { playSound } = useSound();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const isOwner = post.criado_por === myUserId;

  const roleCfg = RECRUITMENT_ROLES.find((r) => r.value === post.role);

  const timeData = post.time ?? {
    nome: 'Time Desconhecido',
    tag: '???',
    logo_url: null,
    gradient_from: '#FFB700',
    gradient_to: '#FF6B00',
    ranking: 0,
  };
  const from = timeData.gradient_from ?? '#FFB700';
  const to = timeData.gradient_to ?? '#FF6B00';

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
      onClick={() => {
        playSound('click');
        onClick();
      }}
      className="group relative bg-[#0a0b0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:border-primary/40 hover:bg-[#0a0b0f]/80 shadow-lg shadow-black/20 flex flex-col h-full"
    >
      {/* HERO — logo grande com gradient do time */}
      <div
        className="relative h-40 flex items-center justify-center px-4"
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
      >
        <div className="w-24 h-24 rounded-2xl bg-black/35 backdrop-blur-md border-2 border-white/25 flex items-center justify-center overflow-hidden shadow-2xl">
          {timeData.logo_url ? (
            <img src={timeData.logo_url} alt={timeData.nome} className="w-full h-full object-contain p-1.5" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-black text-2xl text-white/70 font-headline">
              {timeData.tag}
            </div>
          )}
        </div>

        {/* Owner actions / Ver Time */}
        <div className="absolute top-3 right-3">
          {isOwner ? (
            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onEdit(post)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 hover:bg-black/60 text-white transition-all text-xs font-bold border border-white/20 backdrop-blur-md cursor-pointer"
                title="Editar"
              >
                ✏️
              </button>
              <button
                onClick={() => onDelete(post)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 hover:bg-red-500 text-white transition-all text-xs font-bold border border-white/20 backdrop-blur-md cursor-pointer"
                title="Remover"
              >
                <X size={14} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/times/${post.time_id}`);
              }}
              className="text-[10px] bg-black/40 text-white hover:bg-black/60 transition-all px-3 py-1.5 rounded-lg font-black uppercase tracking-wider border border-white/20 backdrop-blur-md cursor-pointer font-headline"
            >
              Ver Time →
            </button>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5 flex-1 flex flex-col gap-4">
        {/* Nome do time + role badge */}
        <div className="text-center space-y-2.5">
          <div className="space-y-0.5">
            <h3 className="text-base font-black text-white uppercase tracking-tight truncate font-headline">
              {timeData.nome}
            </h3>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest font-headline">
              #{timeData.tag}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 bg-white/5 py-2 px-3 rounded-lg border border-white/10">
            {roleCfg?.img && (
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <img src={roleCfg.img} alt={roleCfg.label} className="w-full h-full object-contain" />
              </div>
            )}
            <p className="text-primary font-black uppercase tracking-widest text-xs leading-none font-headline">
              {roleCfg?.label ?? post.role}
            </p>
          </div>
        </div>

        {/* Elo + Horário */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl space-y-0.5">
            <p className="text-[9px] text-white/40 uppercase font-black tracking-widest font-headline">Elo</p>
            <p className="text-xs font-bold text-white/90 truncate">{post.elo_min} – {post.elo_max}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl space-y-0.5">
            <p className="text-[9px] text-white/40 uppercase font-black tracking-widest font-headline">Horário</p>
            <p className="text-xs font-bold text-white/90 truncate">{post.horarios || 'Flexível'}</p>
          </div>
        </div>

        {/* Descrição */}
        <p className="text-xs text-white/60 line-clamp-3 font-medium leading-relaxed px-3 py-2.5 bg-white/5 border-l-2 border-primary rounded-r-lg italic">
          "{post.descricao}"
        </p>

        {/* WhatsApp Button */}
        <div className="mt-auto">
          {post.discord ? (
            <button
              onClick={handleCopyWhatsapp}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all duration-150 border shadow-lg cursor-pointer font-headline ${
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
            <div className="w-full bg-white/5 py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] text-white/30 text-center border border-white/10 font-headline">
              WhatsApp não informado
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
