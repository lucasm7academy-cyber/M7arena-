// src/components/partidas/ModaisElegibilidade.tsx
// Modais da M7 Arena com o estilo cortado (cut-edge) das salas e partidas finalizadas:
// bordas angulares 100% contínuas (incluindo cantos diagonais cortados), cores vivas sólidas (#FFB700, #3B82F6, #EF4444),
// tipografia Anton/impact nos títulos, tons suaves sem branco estourado e 100% integrados à arena.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Wallet,
  ShieldCheck,
  Ban,
  Swords,
  Gamepad2,
  LogIn,
  Plus,
  Lock,
  Trophy,
} from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';
import type { ErroElegibilidade } from '../../hooks/useSalaSimples';

const DEPOSIT_EVENT = 'm7:open-deposit';

// ── Polígonos de corte angular oficiais da M7 Arena (com pares Frame + Inner para bordas 100% contínuas e espessura uniforme de 1px) ──
export const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
export const CUT_FRAME_INNER = 'polygon(10.6px 0, 100% 0, 100% calc(100% - 10.6px), calc(100% - 10.6px) 100%, 0 100%, 0 10.6px)';

export const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';
export const CUT_BUTTON_INNER = 'polygon(5.6px 0, 100% 0, 100% calc(100% - 5.6px), calc(100% - 5.6px) 100%, 0 100%, 0 5.6px)';

export const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
export const CUT_BADGE_INNER = 'polygon(2.6px 0, 100% 0, 100% calc(100% - 2.6px), calc(100% - 2.6px) 100%, 0 100%, 0 2.6px)';

export interface CutCardProps {
  children: React.ReactNode;
  corBorda?: string;
  corBg?: string;
  bordaOpacity?: number;
  className?: string;
}

export function CutCard({
  children,
  corBorda = '#FFB700',
  corBg = '#0d0d12',
  bordaOpacity = 0.35,
  className = '',
}: CutCardProps) {
  return (
    <div
      className="relative p-[1px] w-full"
      style={{
        clipPath: CUT_BUTTON,
        background: `color-mix(in srgb, ${corBorda} ${Math.round(bordaOpacity * 100)}%, transparent)`,
      }}
    >
      <div
        className={`w-full p-4 ${className}`}
        style={{
          clipPath: CUT_BUTTON_INNER,
          background: corBg,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export interface ModalShellProps {
  titulo: string;
  subtitulo?: string;
  badge?: string;
  corBorda?: string;
  icone?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}

export function ModalShell({
  titulo,
  subtitulo,
  badge,
  corBorda = '#FFB700',
  icone,
  children,
  onClose,
  maxWidth = 'max-w-md',
}: ModalShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.08 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.08 }}
        className={`relative p-[1.5px] w-full ${maxWidth} shadow-2xl transition-all`}
        style={{
          clipPath: CUT_FRAME,
          background: `linear-gradient(135deg, ${corBorda} 0%, ${corBorda}88 60%, color-mix(in srgb, ${corBorda} 30%, #000000) 100%)`,
          boxShadow: `0 0 45px -10px ${corBorda}45, 0 25px 50px -12px rgba(0,0,0,0.9)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Container interno escuro com corte angular */}
        <div
          className="w-full bg-[#08080a] p-5 sm:p-6 relative overflow-hidden"
          style={{ clipPath: CUT_FRAME_INNER }}
        >
          {/* Luz ambiente suave no topo */}
          <div
            className="absolute -top-12 -right-12 w-40 h-40 pointer-events-none opacity-20 blur-3xl"
            style={{ background: corBorda }}
          />

          {/* Botão de fechar estilo botão cortado com borda completa */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={onClose}
            className="absolute top-4 right-4 p-[1px] bg-white/10 hover:bg-white/20 transition-colors z-20 cursor-pointer"
            style={{ clipPath: CUT_BUTTON }}
            title="Fechar"
            aria-label="Fechar"
          >
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 bg-[#121216] hover:bg-[#1c1c22] flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
              style={{ clipPath: CUT_BUTTON_INNER }}
            >
              <X className="w-4 h-4" />
            </div>
          </motion.button>

          {/* Cabeçalho estilo Partidas Finalizadas */}
          <div className="flex items-center gap-3.5 mb-4 pr-9">
            {icone && (
              <div
                className="relative p-[1px] shrink-0"
                style={{
                  clipPath: CUT_BUTTON,
                  background: `linear-gradient(135deg, ${corBorda}, transparent)`,
                }}
              >
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center bg-[#101014]"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  {icone}
                </div>
              </div>
            )}

            <div className="min-w-0 flex-1">
              {badge && (
                <div className="mb-1">
                  <span
                    className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black"
                    style={{
                      clipPath: CUT_BADGE,
                      background: corBorda,
                    }}
                  >
                    {badge}
                  </span>
                </div>
              )}
              <h2
                className="text-[#EDEDEE] uppercase tracking-tight text-xl sm:text-2xl leading-none truncate select-none"
                style={{
                  fontFamily: '"Anton", "Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
                  textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                  letterSpacing: '0.02em',
                }}
              >
                {titulo}
              </h2>
              {subtitulo && (
                <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider mt-1 truncate">
                  {subtitulo}
                </p>
              )}
            </div>
          </div>

          {/* Conteúdo do corpo */}
          <div className="space-y-4">
            {children}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export interface ModaisElegibilidadeProps {
  erro: ErroElegibilidade;
  onClose: () => void;
  onAceitarTermos: () => void;
}

export function ModaisElegibilidade({ erro, onClose, onAceitarTermos }: ModaisElegibilidadeProps) {
  const navigate = useNavigate();

  const abrirDeposito = () => {
    onClose();
    window.dispatchEvent(new Event(DEPOSIT_EVENT));
  };

  return (
    <AnimatePresence>
      {/* 1. TERMOS DE USO & DECLARAÇÃO 18+ */}
      {erro?.tipo === 'termos' && (
        <ModalShell
          titulo="Maioridade Obrigatória (18+)"
          badge="Salas Apostadas • MC"
          subtitulo="Declaração para partidas valendo M7 Coins"
          corBorda="#FFB700"
          icone={<ShieldCheck className="w-6 h-6 text-[#FFB700]" />}
          onClose={onClose}
        >
          <CutCard corBorda="#FFB700" corBg="#0d0d12" bordaOpacity={0.35} className="space-y-3">
            <p className="text-zinc-300 text-xs font-bold leading-relaxed">
              As salas valendo <span className="text-[#FFB700] font-black">M7 Coins (MC)</span> envolvem premiação real e são restritas a maiores de 18 anos.
            </p>

            <div className="space-y-2 pt-2 border-t border-white/5 text-xs font-bold text-zinc-300">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-5 h-5 bg-[#FFB700] text-black text-[10px] font-black flex items-center justify-center shrink-0"
                  style={{ clipPath: CUT_BADGE }}
                >
                  18+
                </span>
                <span>Declaro ter <strong className="text-zinc-100">18 anos completos ou mais</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-5 h-5 bg-[#FFB700] text-black text-[10px] font-black flex items-center justify-center shrink-0"
                  style={{ clipPath: CUT_BADGE }}
                >
                  ✓
                </span>
                <span>Aceito os <strong className="text-zinc-100">Termos de Uso</strong> e as <strong className="text-zinc-100">Regras da Arena</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-5 h-5 bg-[#FFB700] text-black text-[10px] font-black flex items-center justify-center shrink-0"
                  style={{ clipPath: CUT_BADGE }}
                >
                  ✓
                </span>
                <span>Ciente das regras de <strong className="text-zinc-100">resultado oficial e premiação</strong></span>
              </div>
            </div>
          </CutCard>

          <div className="flex flex-col gap-2.5 pt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onAceitarTermos}
              className="w-full relative p-[1px] cursor-pointer shadow-lg"
              style={{
                clipPath: CUT_BUTTON,
                background: 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)',
                boxShadow: '0 0 25px -5px rgba(255,183,0,0.4)',
              }}
            >
              <div
                className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirmar Maior de 18 Anos</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
              style={{ clipPath: CUT_BUTTON }}
            >
              <div
                className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-zinc-400 hover:text-zinc-100 bg-[#121216] transition-colors"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                Cancelar
              </div>
            </motion.button>
          </div>
        </ModalShell>
      )}

      {/* 2. SALDO INSUFICIENTE */}
      {erro?.tipo === 'saldo' && (
        <ModalShell
          titulo="Saldo Insuficiente"
          badge="M7 Coins • Carteira"
          subtitulo="Recarregue para entrar na disputa"
          corBorda="#FFB700"
          icone={<GiTwoCoins className="w-7 h-7 text-[#FFB700]" />}
          onClose={onClose}
        >
          <CutCard corBorda="#FFB700" corBg="#0d0d12" bordaOpacity={0.35} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-zinc-400 text-[10px] uppercase font-black tracking-widest block">Entrada da Sala</span>
                <span className="text-zinc-200 font-bold text-xs">Valor necessário</span>
              </div>
              <div className="text-right">
                <span className="text-zinc-400 text-[10px] uppercase font-black tracking-widest block">Faltam</span>
                <span className="text-2xl font-black text-[#FFB700] tracking-tight flex items-center gap-1.5 justify-end">
                  <GiTwoCoins className="w-5 h-5" /> {erro.faltam} MC
                </span>
              </div>
            </div>

            <div className="relative p-[1px]" style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-2 bg-black/60 overflow-hidden" style={{ clipPath: CUT_BADGE_INNER }}>
                <div
                  className="h-full bg-[#FFB700] shadow-[0_0_10px_rgba(255,183,0,0.5)]"
                  style={{ width: `${Math.max(15, Math.min(100, (erro.faltam / 1000) * 100))}%` }}
                />
              </div>
            </div>

            <p className="text-zinc-400 text-[10px] uppercase font-black tracking-wider text-center pt-0.5">
              ⚡ Recarga instantânea via PIX • Crédito na hora
            </p>
          </CutCard>

          <div className="flex flex-col gap-2.5 pt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={abrirDeposito}
              className="w-full relative p-[1px] cursor-pointer shadow-lg"
              style={{
                clipPath: CUT_BUTTON,
                background: 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)',
                boxShadow: '0 0 25px -5px rgba(255,183,0,0.4)',
              }}
            >
              <div
                className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                <Wallet className="w-4 h-4" />
                <span>Recarregar MC via PIX</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
              style={{ clipPath: CUT_BUTTON }}
            >
              <div
                className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-zinc-400 hover:text-zinc-100 bg-[#121216] transition-colors"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                Depois
              </div>
            </motion.button>
          </div>
        </ModalShell>
      )}

      {/* 3. VOCÊ JÁ ESTÁ EM OUTRA SALA */}
      {erro?.tipo === 'outra_sala' && (
        <ModalShell
          titulo="Você Já Está em Uma Sala"
          badge="Partida Ativa"
          subtitulo="Limite de uma sala apostada por vez"
          corBorda="#3b82f6"
          icone={<Swords className="w-6 h-6 text-blue-400" />}
          onClose={onClose}
        >
          <CutCard corBorda="#3b82f6" corBg="#080d16" bordaOpacity={0.35} className="space-y-3">
            <p className="text-zinc-300 text-xs font-bold leading-relaxed">
              Você só pode participar de <strong className="text-zinc-100">uma sala apostada ativa por vez</strong>. Sua vaga e seu MC estão protegidos na sala:
            </p>

            <div
              className="relative p-[1px] w-full"
              style={{ clipPath: CUT_BADGE, background: 'rgba(59,130,246,0.3)' }}
            >
              <div
                className="p-3 bg-[#040810] flex items-center justify-between"
                style={{ clipPath: CUT_BADGE_INNER }}
              >
                <span className="text-zinc-400 text-xs uppercase font-black tracking-wider">Sala Ativa</span>
                <span className="text-blue-400 font-black text-sm font-mono">#{String(erro.salaNum).padStart(6, '0')}</span>
              </div>
            </div>
          </CutCard>

          <div className="flex flex-col gap-2.5 pt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                onClose();
                navigate(`/${erro.modo || '5v5'}/${erro.salaNum}`);
              }}
              className="w-full relative p-[1px] cursor-pointer shadow-lg"
              style={{
                clipPath: CUT_BUTTON,
                background: 'linear-gradient(135deg, #3b82f6, #60a5fa, #2563eb)',
                boxShadow: '0 0 25px -5px rgba(59,130,246,0.4)',
              }}
            >
              <div
                className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 transition-all"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                <Swords className="w-4 h-4" />
                <span>Ir Para Minha Sala #{String(erro.salaNum).padStart(6, '0')}</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
              style={{ clipPath: CUT_BUTTON }}
            >
              <div
                className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-zinc-400 hover:text-zinc-100 bg-[#121216] transition-colors"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                Fechar
              </div>
            </motion.button>
          </div>
        </ModalShell>
      )}

      {/* 4. RIOT ID OBRIGATÓRIO */}
      {erro?.tipo === 'riot_id' && (
        <ModalVincularConta
          onClose={onClose}
          motivo="Esta sala vale MC. Vincule seu Riot ID (Nick #TAG) para jogar — é ele que valida sua elegibilidade e amarra o resultado oficial ao seu perfil."
        />
      )}

      {/* 5. CONTA BANIDA */}
      {erro?.tipo === 'banida' && (
        <ModalShell
          titulo="Acesso Restrito"
          badge="Conta Suspensa"
          subtitulo="Restrição ativa de participação"
          corBorda="#ef4444"
          icone={<Ban className="w-6 h-6 text-red-500" />}
          onClose={onClose}
        >
          <CutCard corBorda="#ef4444" corBg="#140608" bordaOpacity={0.35} className="space-y-3">
            <p className="text-zinc-300 text-xs font-bold leading-relaxed">
              Sua conta está impossibilitada de entrar em partidas. Se você acredita que isso foi um equívoco, consulte as regras ou solicite suporte.
            </p>
          </CutCard>

          <div className="flex flex-col gap-2.5 pt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="w-full relative p-[1px] cursor-pointer"
              style={{
                clipPath: CUT_BUTTON,
                background: 'rgba(239, 68, 68, 0.4)',
              }}
            >
              <div
                className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-red-300 bg-[#140608] hover:bg-[#20080a] transition-colors"
                style={{ clipPath: CUT_BUTTON_INNER }}
              >
                Entendido
              </div>
            </motion.button>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

/**
 * Modal de login / cadastro para visitantes que tentam entrar em salas
 * ou criar partidas a partir da vitrine pública.
 */
export function ModalLoginVitrine({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();

  return (
    <ModalShell
      titulo="Crie Sua Conta Para Jogar"
      badge="Vitrine M7 Arena"
      subtitulo="Entre na disputa por premiações em MC"
      corBorda="#FFB700"
      icone={<Trophy className="w-6 h-6 text-[#FFB700]" />}
      onClose={onClose}
    >
      <CutCard corBorda="#FFB700" corBg="#0d0d12" bordaOpacity={0.35} className="space-y-3">
        <p className="text-zinc-300 text-xs font-bold leading-relaxed">
          As salas valendo <span className="text-[#FFB700] font-black">MC</span> são a vitrine da arena. Crie sua conta grátis e ocupe uma vaga antes que a sala encha.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div
            className="relative p-[1px]"
            style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.1)' }}
          >
            <div
              className="px-3 py-2 bg-black/70 flex items-center gap-2 text-xs font-black text-zinc-200 uppercase tracking-wider"
              style={{ clipPath: CUT_BADGE_INNER }}
            >
              <span className="text-[#FFB700]">⚡</span> 100% Grátis
            </div>
          </div>

          <div
            className="relative p-[1px]"
            style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.1)' }}
          >
            <div
              className="px-3 py-2 bg-black/70 flex items-center gap-2 text-xs font-black text-zinc-200 uppercase tracking-wider"
              style={{ clipPath: CUT_BADGE_INNER }}
            >
              <GiTwoCoins className="text-[#FFB700] w-3.5 h-3.5 shrink-0" /> Prêmios MC
            </div>
          </div>
        </div>
      </CutCard>

      <div className="flex flex-col gap-2.5 pt-1">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            onClose();
            navigate('/login');
          }}
          className="w-full relative p-[1px] cursor-pointer shadow-lg"
          style={{
            clipPath: CUT_BUTTON,
            background: 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)',
            boxShadow: '0 0 25px -5px rgba(255,183,0,0.4)',
          }}
        >
          <div
            className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            <Plus className="w-4 h-4" />
            <span>Criar Conta Gratuita</span>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            onClose();
            navigate('/login');
          }}
          className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
          style={{ clipPath: CUT_BUTTON }}
        >
          <div
            className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-zinc-300 hover:text-zinc-100 bg-[#16161c] transition-colors"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            <LogIn className="w-4 h-4" />
            <span>Já Tenho Conta — Entrar</span>
          </div>
        </motion.button>

        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-200 text-[11px] font-black uppercase tracking-widest text-center pt-1 transition-colors cursor-pointer"
        >
          Continuar assistindo como visitante
        </button>
      </div>
    </ModalShell>
  );
}

/**
 * Modal de aviso de vínculo de conta Riot Games (Riot ID).
 */
export function ModalVincularConta({ onClose, motivo }: { onClose: () => void; motivo?: string }) {
  const navigate = useNavigate();

  return (
    <ModalShell
      titulo="Vincule Sua Conta Riot"
      badge="Riot Games • Vínculo"
      subtitulo="Conecte seu Nick #TAG para disputar partidas"
      corBorda="#3b82f6"
      icone={<Gamepad2 className="w-6 h-6 text-blue-400" />}
      onClose={onClose}
    >
      <CutCard corBorda="#3b82f6" corBg="#080d16" bordaOpacity={0.35} className="space-y-3">
        <p className="text-zinc-300 text-xs font-bold leading-relaxed">
          {motivo || 'Para criar sala e participar das partidas valendo MC, você precisa vincular sua conta Riot.'}
        </p>

        <div className="space-y-2 pt-2 border-t border-white/5 text-xs font-bold text-zinc-300">
          <div className="flex items-center gap-2.5">
            <span
              className="w-5 h-5 bg-blue-500 text-black text-[10px] font-black flex items-center justify-center shrink-0"
              style={{ clipPath: CUT_BADGE }}
            >
              ✓
            </span>
            <span>Sincronização oficial de <strong className="text-zinc-100">Elo e Liga no LoL</strong></span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className="w-5 h-5 bg-blue-500 text-black text-[10px] font-black flex items-center justify-center shrink-0"
              style={{ clipPath: CUT_BADGE }}
            >
              ✓
            </span>
            <span>Geração de <strong className="text-zinc-100">códigos de partida oficiais</strong></span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className="w-5 h-5 bg-blue-500 text-black text-[10px] font-black flex items-center justify-center shrink-0"
              style={{ clipPath: CUT_BADGE }}
            >
              ✓
            </span>
            <span>Validação de prints e <strong className="text-zinc-100">recebimento de MC</strong></span>
          </div>
        </div>
      </CutCard>

      <div className="flex flex-col gap-2.5 pt-1">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            onClose();
            navigate('/vincular');
          }}
          className="w-full relative p-[1px] cursor-pointer shadow-lg"
          style={{
            clipPath: CUT_BUTTON,
            background: 'linear-gradient(135deg, #3b82f6, #60a5fa, #2563eb)',
            boxShadow: '0 0 25px -5px rgba(59,130,246,0.4)',
          }}
        >
          <div
            className="w-full py-3.5 px-5 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 transition-all"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Vincular Conta Riot</span>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="w-full relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
          style={{ clipPath: CUT_BUTTON }}
        >
          <div
            className="w-full py-3 px-5 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest text-zinc-400 hover:text-zinc-100 bg-[#121216] transition-colors"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            Agora não
          </div>
        </motion.button>
      </div>
    </ModalShell>
  );
}

/**
 * Modal para digitar senha de sala privada.
 */
export function ModalSenhaSala({
  nome,
  onClose,
  onConfirm,
  erro,
}: {
  nome: string;
  onClose: () => void;
  onConfirm: (senha: string) => void;
  erro?: string;
}) {
  const [senha, setSenha] = useState('');

  return (
    <ModalShell
      titulo="Sala Privada"
      badge="Acesso Protegido"
      subtitulo={`Digite a senha para entrar em ${nome}`}
      corBorda="#FFB700"
      icone={<Lock className="w-6 h-6 text-[#FFB700]" />}
      onClose={onClose}
    >
      <CutCard corBorda="#FFB700" corBg="#0d0d12" bordaOpacity={0.35} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-zinc-400 text-[10px] uppercase font-black tracking-widest block">
            Senha da Sala
          </label>
          <div
            className="relative p-[1px] w-full"
            style={{ clipPath: CUT_BADGE, background: 'rgba(255,255,255,0.15)' }}
          >
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite a senha da partida"
              className="w-full bg-[#050508] p-3 text-zinc-200 text-sm focus:outline-none placeholder:text-zinc-600 font-mono"
              style={{ clipPath: CUT_BADGE_INNER }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && senha) {
                  onConfirm(senha);
                }
              }}
            />
          </div>
        </div>
        {erro && <p className="text-red-400 text-xs font-black uppercase tracking-wider">{erro}</p>}
      </CutCard>

      <div className="flex gap-3 pt-1">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="flex-1 relative p-[1px] cursor-pointer bg-white/10 hover:bg-white/20 transition-all"
          style={{ clipPath: CUT_BUTTON }}
        >
          <div
            className="w-full py-3 px-4 flex items-center justify-center font-black text-xs uppercase tracking-widest text-zinc-400 hover:text-zinc-100 bg-[#121216] transition-colors"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            Cancelar
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onConfirm(senha)}
          disabled={!senha}
          className="flex-1 relative p-[1px] cursor-pointer disabled:opacity-50"
          style={{
            clipPath: CUT_BUTTON,
            background: 'linear-gradient(135deg, #FFB700, #FFE082, #FF9500)',
          }}
        >
          <div
            className="w-full py-3 px-4 flex items-center justify-center font-black text-xs uppercase tracking-wider text-black bg-[#FFB700] hover:brightness-105 transition-all"
            style={{ clipPath: CUT_BUTTON_INNER }}
          >
            Entrar na Sala
          </div>
        </motion.button>
      </div>
    </ModalShell>
  );
}
